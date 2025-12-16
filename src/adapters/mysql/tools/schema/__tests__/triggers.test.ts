import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createListTriggersTool } from '../triggers.js';
import type { MySQLAdapter } from '../../../MySQLAdapter.js';
import { createMockMySQLAdapter, createMockRequestContext, createMockQueryResult } from '../../../../../__tests__/mocks/index.js';

describe('Schema Trigger Tools', () => {
    let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockMySQLAdapter();
        mockContext = createMockRequestContext();
    });

    describe('mysql_list_triggers', () => {
        it('should query INFORMATION_SCHEMA for triggers', async () => {
            mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([
                { TRIGGER_NAME: 'before_insert', EVENT_MANIPULATION: 'INSERT' }
            ]));

            const tool = createListTriggersTool(mockAdapter as unknown as MySQLAdapter);
            const result = await tool.handler({}, mockContext);

            expect(mockAdapter.executeQuery).toHaveBeenCalled();
            const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
            expect(call).toContain('information_schema.TRIGGERS');
            expect(result).toBeDefined();
        });

        it('should filter by table when provided', async () => {
            mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

            const tool = createListTriggersTool(mockAdapter as unknown as MySQLAdapter);
            await tool.handler({ table: 'users' }, mockContext);

            expect(mockAdapter.executeQuery).toHaveBeenCalled();
            const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
            expect(call).toContain('EVENT_OBJECT_TABLE = ?');
            const params = mockAdapter.executeQuery.mock.calls[0][1] as unknown[];
            expect(params).toContain('users');
        });
    });
});
