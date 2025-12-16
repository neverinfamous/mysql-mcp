
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createProcesslistResource } from '../processlist.js';
import type { MySQLAdapter } from '../../MySQLAdapter.js';
import { createMockMySQLAdapter, createMockRequestContext, createMockQueryResult } from '../../../../__tests__/mocks/index.js';

describe('ProcessList Resource', () => {
    let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockMySQLAdapter();
        mockContext = createMockRequestContext();
    });

    it('should execute SHOW PROCESSLIST query', async () => {
        mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([
            { Id: 1, User: 'root', Host: 'localhost', db: 'test', Command: 'Query', Time: 0, State: 'executing', Info: 'SELECT 1' }
        ]));

        const resource = createProcesslistResource(mockAdapter as unknown as MySQLAdapter);
        await resource.handler('mysql://processlist', mockContext);

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
            expect.stringContaining('PROCESSLIST')
        );
    });
});
