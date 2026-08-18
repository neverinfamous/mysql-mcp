import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAuditInterceptor } from '../interceptor.js';
import type { AuditLogger } from '../logger.js';
import type { BackupManager, SnapshotQueryAdapter } from '../backup-manager/index.js';

vi.mock('../../auth/auth-context.js', () => ({
  getAuthContext: vi.fn(),
}));

vi.mock('../../auth/scope-map.js', () => ({
  getRequiredScope: vi.fn(),
}));

vi.mock('../../utils/tokens.js', () => ({
  estimateTokens: vi.fn(),
  estimateObjectTokens: vi.fn(),
}));

vi.mock('../../observability/metrics/index.js', () => ({
  metrics: {
    recordToolCall: vi.fn(),
  },
}));

vi.mock('../../utils/error-suggestions.js', () => ({
  findSuggestion: vi.fn(),
  heuristicCategorize: vi.fn(),
}));

import { getAuthContext } from '../../auth/auth-context.js';
import { getRequiredScope } from '../../auth/scope-map.js';
import { estimateTokens, estimateObjectTokens } from '../../utils/tokens.js';
import { metrics } from '../../observability/metrics/index.js';
import { findSuggestion, heuristicCategorize } from '../../utils/error-suggestions.js';

describe('createAuditInterceptor', () => {
  let mockAuditLogger: AuditLogger;
  let mockBackupManager: BackupManager;
  let mockQueryAdapter: SnapshotQueryAdapter;

  beforeEach(() => {
    vi.clearAllMocks();

    mockAuditLogger = {
      log: vi.fn(),
      config: {
        auditReads: false,
        redact: false,
      },
      close: vi.fn(),
    } as unknown as AuditLogger;

    mockBackupManager = {
      shouldSnapshot: vi.fn().mockReturnValue(false),
      createSnapshot: vi.fn().mockResolvedValue('backup-123'),
      restoreSnapshot: vi.fn(),
    } as unknown as BackupManager;

    mockQueryAdapter = {
      query: vi.fn(),
    } as unknown as SnapshotQueryAdapter;

    vi.mocked(getAuthContext).mockReturnValue({
      claims: { sub: 'test-user' },
      scopes: ['read', 'write'],
    } as any);

    vi.mocked(getRequiredScope).mockReturnValue('write');
    vi.mocked(estimateObjectTokens).mockReturnValue(100);
    vi.mocked(estimateTokens).mockReturnValue(50);
    vi.mocked(findSuggestion).mockReturnValue(undefined);
    vi.mocked(heuristicCategorize).mockReturnValue({ type: 'UNKNOWN', category: 'unknown' });
  });

  describe('successful execution', () => {
    it('should log a write scope tool call correctly', async () => {
      vi.mocked(getRequiredScope).mockReturnValue('write');
      const interceptor = createAuditInterceptor(mockAuditLogger);

      const fn = vi.fn().mockResolvedValue({ id: 1 });
      const result = await interceptor.around('testTool', { arg1: 'value' }, 'req-1', fn);

      expect(result).toEqual({ id: 1 });
      expect(fn).toHaveBeenCalled();
      
      expect(metrics.recordToolCall).toHaveBeenCalledWith(
        'testTool',
        expect.any(Number),
        true,
        112, // promptTokenEstimate 100 + 12
        112, // completionTokens 100 + 12
        undefined,
        undefined
      );

      expect(mockAuditLogger.log).toHaveBeenCalledWith({
        timestamp: expect.any(String),
        requestId: 'req-1',
        tool: 'testTool',
        category: 'write',
        scope: 'write',
        user: 'test-user',
        durationMs: expect.any(Number),
        success: true,
        status: 'info',
        error: undefined,
        args: { arg1: 'value' },
        scopes: ['read', 'write'],
        tokenEstimate: 112,
        completionTokens: 112,
      });
    });

    it('should not log a read scope tool if auditReads is false', async () => {
      vi.mocked(getRequiredScope).mockReturnValue('read');
      mockAuditLogger.config.auditReads = false;
      const interceptor = createAuditInterceptor(mockAuditLogger);

      const fn = vi.fn().mockResolvedValue({ id: 1 });
      await interceptor.around('testTool', {}, 'req-2', fn);

      expect(mockAuditLogger.log).not.toHaveBeenCalled();
      expect(metrics.recordToolCall).toHaveBeenCalled(); // metrics still recorded
    });

    it('should log a read scope tool as compact entry if auditReads is true', async () => {
      vi.mocked(getRequiredScope).mockReturnValue('read');
      mockAuditLogger.config.auditReads = true;
      const interceptor = createAuditInterceptor(mockAuditLogger);

      const fn = vi.fn().mockResolvedValue({ id: 1 });
      await interceptor.around('testTool', {}, 'req-3', fn);

      expect(mockAuditLogger.log).toHaveBeenCalledWith({
        timestamp: expect.any(String),
        requestId: 'req-3',
        tool: 'testTool',
        category: 'read',
        scope: 'read',
        durationMs: expect.any(Number),
        success: true,
        status: 'info',
        error: undefined,
        tokenEstimate: 112,
        completionTokens: 112,
      });
    });

    it('should redact args if auditLogger.config.redact is true', async () => {
      vi.mocked(getRequiredScope).mockReturnValue('write');
      mockAuditLogger.config.redact = true;
      const interceptor = createAuditInterceptor(mockAuditLogger);

      const fn = vi.fn().mockResolvedValue({ id: 1 });
      await interceptor.around('testTool', { secret: '123' }, 'req-4', fn);

      expect(mockAuditLogger.log).toHaveBeenCalledWith(expect.objectContaining({
        args: undefined,
      }));
    });
  });

  describe('error handling and tool failure', () => {
    it('should handle thrown errors and re-throw', async () => {
      const interceptor = createAuditInterceptor(mockAuditLogger);
      const fn = vi.fn().mockRejectedValue(new Error('Test error'));

      await expect(interceptor.around('testTool', {}, 'req-err', fn)).rejects.toThrow('Test error');

      expect(metrics.recordToolCall).toHaveBeenCalledWith(
        'testTool',
        expect.any(Number),
        false,
        112, // promptTokens
        112, // completionTokens
        'UNKNOWN',
        'unknown'
      );

      expect(mockAuditLogger.log).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        status: 'error',
        error: 'Test error',
      }));
    });

    it('should handle ZodError specifically', async () => {
      const interceptor = createAuditInterceptor(mockAuditLogger);
      class ZodError extends Error {
        constructor() { super('Zod validation failed'); this.name = 'ZodError'; }
      }
      const fn = vi.fn().mockRejectedValue(new ZodError());

      await expect(interceptor.around('testTool', {}, 'req-zod', fn)).rejects.toThrow('Zod validation failed');

      expect(metrics.recordToolCall).toHaveBeenCalledWith(
        'testTool',
        expect.any(Number),
        false,
        112,
        112,
        'VALIDATION_ERROR',
        'validation'
      );
    });

    it('should handle CallToolResult with isError: true', async () => {
      const interceptor = createAuditInterceptor(mockAuditLogger);
      const fn = vi.fn().mockResolvedValue({
        isError: true,
        content: [{ text: 'Tool internal failure' }]
      });

      const result = await interceptor.around('testTool', {}, 'req-fail', fn);
      expect(result).toEqual({ isError: true, content: [{ text: 'Tool internal failure' }] });

      expect(metrics.recordToolCall).toHaveBeenCalledWith(
        'testTool',
        expect.any(Number),
        false,
        112,
        112,
        'UNKNOWN',
        'unknown'
      );

      expect(mockAuditLogger.log).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        status: 'error',
        error: 'Tool internal failure',
      }));
    });
    
    it('should handle CallToolResult with structuredContent error', async () => {
      const interceptor = createAuditInterceptor(mockAuditLogger);
      const fn = vi.fn().mockResolvedValue({
        isError: true,
        structuredContent: { error: 'Structured error message' }
      });

      await interceptor.around('testTool', {}, 'req-struct-fail', fn);

      expect(mockAuditLogger.log).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        status: 'error',
        error: 'Structured error message',
      }));
    });

    it('should handle suggestion finding for errors', async () => {
      vi.mocked(findSuggestion).mockReturnValue({ code: 'DB_TIMEOUT', category: 'database', message: 'x', severity: 'error' });
      const interceptor = createAuditInterceptor(mockAuditLogger);
      const fn = vi.fn().mockRejectedValue(new Error('Timeout'));

      await expect(interceptor.around('testTool', {}, 'req-sug', fn)).rejects.toThrow();

      expect(metrics.recordToolCall).toHaveBeenCalledWith(
        'testTool',
        expect.any(Number),
        false,
        112,
        112,
        'DB_TIMEOUT',
        'database'
      );
    });
  });

  describe('token estimation', () => {
    it('should estimate tokens for string results', async () => {
      const interceptor = createAuditInterceptor(mockAuditLogger);
      const fn = vi.fn().mockResolvedValue('just a string');
      
      await interceptor.around('testTool', {}, 'req-tok1', fn);
      
      expect(estimateTokens).toHaveBeenCalledWith('just a string', 'text');
      expect(mockAuditLogger.log).toHaveBeenCalledWith(expect.objectContaining({
        tokenEstimate: 112,
        completionTokens: 50, // mock return
      }));
    });

    it('should estimate tokens for SQL string results', async () => {
      const interceptor = createAuditInterceptor(mockAuditLogger);
      const fn = vi.fn().mockResolvedValue('SELECT * FROM table');
      
      await interceptor.around('testTool', {}, 'req-tok2', fn);
      
      expect(estimateTokens).toHaveBeenCalledWith('SELECT * FROM table', 'sql');
      expect(mockAuditLogger.log).toHaveBeenCalledWith(expect.objectContaining({
        tokenEstimate: 112,
        completionTokens: 50,
      }));
    });

    it('should handle estimateObjectTokens throwing without blocking', async () => {
      vi.mocked(estimateObjectTokens).mockImplementation(() => { throw new Error('Circular'); });
      const interceptor = createAuditInterceptor(mockAuditLogger);
      const fn = vi.fn().mockResolvedValue({ circular: true });
      
      const result = await interceptor.around('testTool', {}, 'req-tok3', fn);
      
      expect(result).toEqual({ circular: true });
      expect(mockAuditLogger.log).toHaveBeenCalledWith(expect.objectContaining({
        tokenEstimate: 0,
        completionTokens: undefined,
      }));
    });
  });

  describe('backup manager integration', () => {
    it('should call createSnapshot if shouldSnapshot returns true', async () => {
      vi.mocked(mockBackupManager.shouldSnapshot).mockReturnValue(true);
      const interceptor = createAuditInterceptor(mockAuditLogger, mockBackupManager, mockQueryAdapter);
      
      const fn = vi.fn().mockResolvedValue({ ok: true });
      await interceptor.around('testTool', { tbl: 'x' }, 'req-bak1', fn);

      expect(mockBackupManager.shouldSnapshot).toHaveBeenCalledWith('testTool');
      expect(mockBackupManager.createSnapshot).toHaveBeenCalledWith(
        'testTool',
        { tbl: 'x' },
        'req-bak1',
        mockQueryAdapter,
        undefined
      );
      
      expect(mockAuditLogger.log).toHaveBeenCalledWith(expect.objectContaining({
        backup: 'backup-123',
      }));
    });

    it('should not block if createSnapshot throws', async () => {
      vi.mocked(mockBackupManager.shouldSnapshot).mockReturnValue(true);
      vi.mocked(mockBackupManager.createSnapshot).mockRejectedValue(new Error('Backup failed'));
      
      const interceptor = createAuditInterceptor(mockAuditLogger, mockBackupManager, mockQueryAdapter);
      
      const fn = vi.fn().mockResolvedValue({ ok: true });
      await interceptor.around('testTool', {}, 'req-bak2', fn); // Should not throw

      expect(mockAuditLogger.log).toHaveBeenCalledWith(expect.objectContaining({
        backup: undefined,
      }));
    });
  });
});
