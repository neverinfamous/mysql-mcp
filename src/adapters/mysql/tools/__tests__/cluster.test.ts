/**
 * mysql-mcp - Cluster Tools Unit Tests
 * 
 * Tests for cluster tool definitions, annotations, and handler execution.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getClusterTools } from '../cluster/index.js';
import type { MySQLAdapter } from '../../MySQLAdapter.js';
import { createMockMySQLAdapter, createMockRequestContext, createMockQueryResult } from '../../../../__tests__/mocks/index.js';

describe('getClusterTools', () => {
    let tools: ReturnType<typeof getClusterTools>;

    beforeEach(() => {
        vi.clearAllMocks();
        tools = getClusterTools(createMockMySQLAdapter() as unknown as MySQLAdapter);
    });

    it('should return 10 cluster tools', () => {
        expect(tools).toHaveLength(10);
    });

    it('should have cluster group for all tools', () => {
        for (const tool of tools) {
            expect(tool.group).toBe('cluster');
        }
    });

    it('should have handler functions for all tools', () => {
        for (const tool of tools) {
            expect(typeof tool.handler).toBe('function');
        }
    });

    it('should have inputSchema for all tools', () => {
        for (const tool of tools) {
            expect(tool.inputSchema).toBeDefined();
        }
    });

    it('should include expected tool names', () => {
        const names = tools.map(t => t.name);
        expect(names).toContain('mysql_gr_status');
        expect(names).toContain('mysql_gr_members');
        expect(names).toContain('mysql_gr_primary');
        expect(names).toContain('mysql_gr_transactions');
        expect(names).toContain('mysql_gr_flow_control');
        expect(names).toContain('mysql_cluster_status');
        expect(names).toContain('mysql_cluster_instances');
        expect(names).toContain('mysql_cluster_topology');
        expect(names).toContain('mysql_cluster_router_status');
        expect(names).toContain('mysql_cluster_switchover');
    });
});

describe('Handler Execution', () => {
    let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
    let tools: ReturnType<typeof getClusterTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockMySQLAdapter();
        tools = getClusterTools(mockAdapter as unknown as MySQLAdapter);
        mockContext = createMockRequestContext();
    });

    describe('mysql_gr_status', () => {
        it('should query group_replication status', async () => {
            mockAdapter.executeQuery
                .mockResolvedValueOnce(createMockQueryResult([{ PLUGIN_STATUS: 'ACTIVE' }])) // Plugin check
                .mockResolvedValueOnce(
                    createMockQueryResult([{ MEMBER_STATE: 'ONLINE' }])
                );

            const tool = tools.find(t => t.name === 'mysql_gr_status')!;
            const result = await tool.handler({}, mockContext);

            expect(mockAdapter.executeQuery).toHaveBeenCalled();
            // Returns enabled, groupName, members etc
            expect(result).toHaveProperty('enabled');
            expect(result).toHaveProperty('members');
        });
    });

    describe('mysql_gr_members', () => {
        it('should list group replication members', async () => {
            mockAdapter.executeQuery
                .mockResolvedValueOnce(createMockQueryResult([{ PLUGIN_STATUS: 'ACTIVE' }])) // Plugin check
                .mockResolvedValueOnce(
                    createMockQueryResult([
                        { memberId: 'uuid1', host: 'node1', state: 'ONLINE' },
                        { memberId: 'uuid2', host: 'node2', state: 'ONLINE' }
                    ])
                );

            const tool = tools.find(t => t.name === 'mysql_gr_members')!;
            const result = await tool.handler({}, mockContext);

            expect(mockAdapter.executeQuery).toHaveBeenCalled();
            const call = mockAdapter.executeQuery.mock.calls[1][0] as string; // Second call is the query
            expect(call).toContain('replication_group_members');
            expect(result).toHaveProperty('members');
            expect(result).toHaveProperty('count');
        });

        it('should accept memberId parameter', async () => {
            mockAdapter.executeQuery
                .mockResolvedValueOnce(createMockQueryResult([{ PLUGIN_STATUS: 'ACTIVE' }])) // Plugin check
                .mockResolvedValueOnce(createMockQueryResult([]));

            const tool = tools.find(t => t.name === 'mysql_gr_members')!;
            await tool.handler({ memberId: 'uuid1' }, mockContext);

            // Plugin check is first call
            expect(mockAdapter.executeQuery).toHaveBeenNthCalledWith(1,
                expect.stringContaining('SELECT PLUGIN_STATUS FROM information_schema.PLUGINS')
            );

            // Uses parameterized query with ?
            expect(mockAdapter.executeQuery).toHaveBeenNthCalledWith(2,
                expect.stringContaining('WHERE m.MEMBER_ID = ?'),
                ['uuid1']
            );
        });
    });

    describe('mysql_gr_primary', () => {
        it('should get primary member info', async () => {
            mockAdapter.executeQuery
                .mockResolvedValueOnce(createMockQueryResult([{ PLUGIN_STATUS: 'ACTIVE' }])) // Plugin check
                .mockResolvedValueOnce(
                    createMockQueryResult([{ memberId: 'uuid1', host: 'primary.local' }])
                );

            const tool = tools.find(t => t.name === 'mysql_gr_primary')!;
            const result = await tool.handler({}, mockContext);

            expect(mockAdapter.executeQuery).toHaveBeenCalled();
            expect(result).toHaveProperty('primary');
            expect(result).toHaveProperty('hasPrimary');
        });
    });

    describe('mysql_gr_transactions', () => {
        it('should get transaction status', async () => {
            mockAdapter.executeQuery
                .mockResolvedValueOnce(createMockQueryResult([{ PLUGIN_STATUS: 'ACTIVE' }])) // Plugin check
                .mockResolvedValueOnce(createMockQueryResult([
                    { memberId: 'uuid1', txInQueue: 0, txChecked: 100 }
                ]));

            const tool = tools.find(t => t.name === 'mysql_gr_transactions')!;
            const result = await tool.handler({}, mockContext);

            expect(mockAdapter.executeQuery).toHaveBeenCalled();
            expect(result).toHaveProperty('memberStats');
            expect(result).toHaveProperty('gtid');
        });
    });

    describe('mysql_gr_flow_control', () => {
        it('should get flow control statistics', async () => {
            mockAdapter.executeQuery
                .mockResolvedValueOnce(createMockQueryResult([{ PLUGIN_STATUS: 'ACTIVE' }])) // Plugin check
                .mockResolvedValueOnce(createMockQueryResult([
                    { flowControlMode: 'QUOTA', certifierThreshold: 25000 }
                ]));

            const tool = tools.find(t => t.name === 'mysql_gr_flow_control')!;
            const result = await tool.handler({}, mockContext);

            expect(mockAdapter.executeQuery).toHaveBeenCalled();
            expect(result).toHaveProperty('configuration');
            expect(result).toHaveProperty('memberQueues');
            expect(result).toHaveProperty('isThrottling');
        });
    });

    describe('mysql_cluster_status', () => {
        it('should get cluster status', async () => {
            mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([
                { cluster_name: 'myCluster', status: 'OK' }
            ]));

            const tool = tools.find(t => t.name === 'mysql_cluster_status')!;
            const result = await tool.handler({}, mockContext);

            expect(mockAdapter.executeQuery).toHaveBeenCalled();
            // Returns isInnoDBCluster, cluster, etc
            expect(result).toBeDefined();
        });
    });

    describe('mysql_cluster_instances', () => {
        it('should list cluster instances', async () => {
            mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([
                { instance_name: 'mysql-1', address: 'mysql-1:3306' }
            ]));

            const tool = tools.find(t => t.name === 'mysql_cluster_instances')!;
            const result = await tool.handler({}, mockContext);

            expect(mockAdapter.executeQuery).toHaveBeenCalled();
            expect(result).toHaveProperty('instances');
        });

        it('should fallback to GR members if metadata query fails', async () => {
            // First query (metadata) fails
            mockAdapter.executeQuery.mockRejectedValueOnce(new Error('Table not found'));

            // Second query (GR members) succeeds
            mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([
                { serverUuid: 'uuid1', address: 'node1:3306', memberState: 'ONLINE' }
            ]));

            const tool = tools.find(t => t.name === 'mysql_cluster_instances')!;
            const result = await tool.handler({}, mockContext);

            expect(result).toHaveProperty('source', 'group_replication');
            expect(result).toHaveProperty('instances');
            // Two calls: 1. metadata query, 2. fallback query
            expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(2);
        });
    });

    describe('mysql_cluster_topology', () => {
        it('should get cluster topology', async () => {
            mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([
                { id: 'uuid1', host: 'node1', role: 'PRIMARY', state: 'ONLINE' }
            ]));

            const tool = tools.find(t => t.name === 'mysql_cluster_topology')!;
            const result = await tool.handler({}, mockContext);

            expect(mockAdapter.executeQuery).toHaveBeenCalled();
            expect(result).toHaveProperty('topology');
            expect(result).toHaveProperty('visualization');
        });

        it('should visualize all member states correctly', async () => {
            mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([
                { id: 'uuid1', host: 'node1', role: 'PRIMARY', state: 'ONLINE', port: 3306 },
                { id: 'uuid2', host: 'node2', role: 'SECONDARY', state: 'ONLINE', port: 3306 },
                { id: 'uuid3', host: 'node3', role: 'SECONDARY', state: 'RECOVERING', port: 3306 },
                { id: 'uuid4', host: 'node4', role: 'SECONDARY', state: 'OFFLINE', port: 3306 }
            ]));

            const tool = tools.find(t => t.name === 'mysql_cluster_topology')!;
            const result: any = await tool.handler({}, mockContext);
            const viz = result.visualization;

            expect(viz).toContain('PRIMARY:');
            expect(viz).toContain('SECONDARY:');
            expect(viz).toContain('RECOVERING:');
            expect(viz).toContain('OFFLINE/ERROR:');
            expect(viz).toContain('★ node1:3306 (ONLINE)');
            expect(viz).toContain('○ node2:3306 (ONLINE)');
            expect(viz).toContain('⟳ node3:3306');
            expect(viz).toContain('✗ node4:3306 (OFFLINE)');
        });
    });

    describe('mysql_cluster_router_status', () => {
        it('should get router status from cluster perspective', async () => {
            mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([
                { routerName: 'router1', lastCheckIn: '2024-01-01' }
            ]));

            const tool = tools.find(t => t.name === 'mysql_cluster_router_status')!;
            const result = await tool.handler({}, mockContext);

            expect(mockAdapter.executeQuery).toHaveBeenCalled();
            expect(result).toBeDefined();
        });

        it('should handle error when router metadata is missing', async () => {
            mockAdapter.executeQuery.mockRejectedValue(new Error('Table not found'));

            const tool = tools.find(t => t.name === 'mysql_cluster_router_status')!;
            const result: any = await tool.handler({}, mockContext);

            expect(result.available).toBe(false);
            expect(result.message).toContain('Router metadata not available');
            expect(result.suggestion).toBeDefined();
        });
    });

    describe('mysql_cluster_switchover', () => {
        it('should get switchover recommendation', async () => {
            mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([
                { memberId: 'uuid1', host: 'node1', role: 'SECONDARY', state: 'ONLINE' }
            ]));

            const tool = tools.find(t => t.name === 'mysql_cluster_switchover')!;
            const result = await tool.handler({}, mockContext);

            expect(mockAdapter.executeQuery).toHaveBeenCalled();
            expect(result).toHaveProperty('candidates');
            expect(result).toHaveProperty('canSwitchover');
        });

        it('should categorize candidates by lag suitability', async () => {
            // Mock members with different queue sizes
            // uuid1: 0 queue (GOOD)
            // uuid2: 50 queue (ACCEPTABLE)
            // uuid3: 200 queue (NOT_RECOMMENDED)
            mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([
                { memberId: 'uuid1', host: 'node1', role: 'SECONDARY', state: 'ONLINE', txQueue: 0, applierQueue: 0 },
                { memberId: 'uuid2', host: 'node2', role: 'SECONDARY', state: 'ONLINE', txQueue: 20, applierQueue: 30 },
                { memberId: 'uuid3', host: 'node3', role: 'SECONDARY', state: 'ONLINE', txQueue: 150, applierQueue: 50 },
                { memberId: 'uuid4', host: 'node4', role: 'PRIMARY', state: 'ONLINE', txQueue: 0, applierQueue: 0 } // Should be ignored
            ]));

            const tool = tools.find(t => t.name === 'mysql_cluster_switchover')!;
            const result: any = await tool.handler({}, mockContext);
            const candidates = result.candidates;

            // Should filter out PRIMARY, so 3 candidates
            expect(candidates).toHaveLength(3);

            // Sort order check: GOOD -> ACCEPTABLE -> NOT_RECOMMENDED
            expect(candidates[0].memberId).toBe('uuid1');
            expect(candidates[0].suitability).toBe('GOOD');

            expect(candidates[1].memberId).toBe('uuid2');
            expect(candidates[1].suitability).toBe('ACCEPTABLE');

            expect(candidates[2].memberId).toBe('uuid3');
            expect(candidates[2].suitability).toBe('NOT_RECOMMENDED');

            expect(result.recommendedTarget.memberId).toBe('uuid1');
            expect(result.canSwitchover).toBe(true);
        });

        it('should warn if all candidates are not recommended', async () => {
            mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([
                { memberId: 'uuid1', host: 'node1', role: 'SECONDARY', state: 'ONLINE', txQueue: 200, applierQueue: 0 }
            ]));

            const tool = tools.find(t => t.name === 'mysql_cluster_switchover')!;
            const result: any = await tool.handler({}, mockContext);

            expect(result.recommendedTarget).toBeNull();
            expect(result.warning).toBeDefined();
        });
    });
});
