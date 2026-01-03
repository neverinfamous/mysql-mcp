
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as child_process from 'child_process';
import { createMockMySQLAdapter, createMockRequestContext } from '../../../../../__tests__/mocks/index.js';
import {
    createShellLoadDumpTool,
    createShellRunScriptTool
} from '../restore.js';

vi.mock('child_process', () => ({
    spawn: vi.fn()
}));

describe('Shell Restore and Script Tools', () => {
    let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
    let mockContext: ReturnType<typeof createMockRequestContext>;
    let mockSpawn: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockMySQLAdapter();
        mockContext = createMockRequestContext();
        mockSpawn = child_process.spawn as any;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    function setupMockSpawn(stdout = '', stderr = '', exitCode = 0) {
        const mockChild = {
            stdout: {
                on: vi.fn().mockImplementation((event, cb) => {
                    if (event === 'data') cb(Buffer.from(stdout));
                })
            },
            stderr: {
                on: vi.fn().mockImplementation((event, cb) => {
                    if (event === 'data') cb(Buffer.from(stderr));
                })
            },
            stdin: {
                write: vi.fn(),
                end: vi.fn()
            },
            on: vi.fn().mockImplementation((event, cb) => {
                if (event === 'close') cb(exitCode);
            }),
            kill: vi.fn()
        };
        mockSpawn.mockReturnValue(mockChild);
        return mockChild;
    }

    describe('mysqlsh_load_dump', () => {
        it('should load dump with options', async () => {
            const successJson = JSON.stringify({ success: true, result: { status: 'Completed' } });
            setupMockSpawn(successJson);

            const tool = createShellLoadDumpTool();
            const result = await tool.handler({
                inputDir: '/backup/full',
                ignoreVersion: true,
                resetProgress: true
            }, mockContext) as any;

            expect(result.success).toBe(true);

            const jsArg = mockSpawn.mock.calls[0][1][4];
            expect(jsArg).toContain('util.loadDump("/backup/full"');
            expect(jsArg).toContain('ignoreVersion: true');
            expect(jsArg).toContain('resetProgress: true');
        });

        it('should support all optional parameters', async () => {
            setupMockSpawn(JSON.stringify({ success: true }));
            const tool = createShellLoadDumpTool();
            await tool.handler({
                inputDir: '/in',
                threads: 4,
                dryRun: true,
                includeSchemas: ['s1'],
                excludeSchemas: ['s2'],
                includeTables: ['t1'],
                excludeTables: ['t2'],
                ignoreExistingObjects: true
            }, mockContext);

            const jsArg = mockSpawn.mock.calls[0][1][4];
            expect(jsArg).toContain('threads: 4');
            expect(jsArg).toContain('dryRun: true');
            expect(jsArg).toContain('includeSchemas: ["s1"]');
            expect(jsArg).toContain('excludeSchemas: ["s2"]');
            expect(jsArg).toContain('includeTables: ["t1"]');
            expect(jsArg).toContain('excludeTables: ["t2"]');
            expect(jsArg).toContain('ignoreExistingObjects: true');
        });

        it('should enable local_infile when updateServerSettings is true', async () => {
            setupMockSpawn(JSON.stringify({ success: true }));
            const tool = createShellLoadDumpTool();
            const result = await tool.handler({
                inputDir: '/backup',
                updateServerSettings: true
            }, mockContext) as any;

            expect(result.success).toBe(true);
            expect(result.localInfileEnabled).toBe(true);

            const jsArg = mockSpawn.mock.calls[0][1][4];
            expect(jsArg).toContain('SET GLOBAL local_infile = ON');
        });

        it('should throw helpful error when local_infile is disabled', async () => {
            setupMockSpawn('', 'ERROR: local_infile is disabled', 1);

            const tool = createShellLoadDumpTool();
            await expect(tool.handler({
                inputDir: '/backup'
            }, mockContext)).rejects.toThrow('local_infile is disabled');
        });

        it('should throw helpful error when Loading local data is disabled', async () => {
            setupMockSpawn('', 'Loading local data is disabled on the server', 1);

            const tool = createShellLoadDumpTool();
            await expect(tool.handler({
                inputDir: '/backup'
            }, mockContext)).rejects.toThrow('updateServerSettings: true');
        });

        it('should re-throw non-local_infile errors', async () => {
            setupMockSpawn('', 'Schema already exists', 1);

            const tool = createShellLoadDumpTool();
            await expect(tool.handler({
                inputDir: '/backup'
            }, mockContext)).rejects.toThrow('Schema already exists');
        });
    });

    describe('mysqlsh_run_script', () => {
        it('should run javascript script', async () => {
            setupMockSpawn('Script output');

            const tool = createShellRunScriptTool();
            const result = await tool.handler({
                script: 'print("hello")',
                language: 'js'
            }, mockContext) as any;

            expect(result.success).toBe(true);
            expect(result.stdout).toBe('Script output');

            const args = mockSpawn.mock.calls[0][1];
            expect(args).toContain('--js');
        });

        it('should run python script', async () => {
            setupMockSpawn('Python output');

            const tool = createShellRunScriptTool();
            const result = await tool.handler({
                script: 'print("hello")',
                language: 'py'
            }, mockContext) as any;

            expect(result.success).toBe(true);
            const args = mockSpawn.mock.calls[0][1];
            expect(args).toContain('--py');
        });

        it('should run sql script', async () => {
            setupMockSpawn('SQL output');

            const tool = createShellRunScriptTool();
            const result = await tool.handler({
                script: 'SELECT 1',
                language: 'sql'
            }, mockContext) as any;

            expect(result.success).toBe(true);
            const args = mockSpawn.mock.calls[0][1];
            expect(args).toContain('--sql');
        });
    });
});
