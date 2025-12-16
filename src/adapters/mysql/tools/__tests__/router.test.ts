/**
 * mysql-mcp - Router Tools Unit Tests
 * 
 * Tests for router tool definitions, annotations, and handler execution.
 * Mocks global fetch to test MySQL Router REST API calls.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getRouterTools } from '../router.js';
import type { MySQLAdapter } from '../../MySQLAdapter.js';
import { createMockMySQLAdapter, createMockRequestContext } from '../../../../__tests__/mocks/index.js';

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('getRouterTools', () => {
    let tools: ReturnType<typeof getRouterTools>;

    beforeEach(() => {
        vi.clearAllMocks();
        tools = getRouterTools(createMockMySQLAdapter() as unknown as MySQLAdapter);
    });

    it('should return 9 router tools', () => {
        expect(tools).toHaveLength(9);
    });

    it('should have router group for all tools', () => {
        for (const tool of tools) {
            expect(tool.group).toBe('router');
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

    it('should include all expected tool names', () => {
        const toolNames = tools.map(t => t.name);
        expect(toolNames).toContain('mysql_router_status');
        expect(toolNames).toContain('mysql_router_routes');
        expect(toolNames).toContain('mysql_router_route_status');
        expect(toolNames).toContain('mysql_router_route_health');
        expect(toolNames).toContain('mysql_router_route_connections');
        expect(toolNames).toContain('mysql_router_route_destinations');
        expect(toolNames).toContain('mysql_router_route_blocked_hosts');
        expect(toolNames).toContain('mysql_router_metadata_status');
        expect(toolNames).toContain('mysql_router_pool_status');
    });
});

describe('Tool Structure Validation', () => {
    let tools: ReturnType<typeof getRouterTools>;

    beforeEach(() => {
        vi.clearAllMocks();
        tools = getRouterTools(createMockMySQLAdapter() as unknown as MySQLAdapter);
    });

    it('mysql_router_status should have correct structure', () => {
        const tool = tools.find(t => t.name === 'mysql_router_status')!;
        expect(tool.name).toBe('mysql_router_status');
        expect(tool.description).toBeDefined();
        expect(tool.annotations?.readOnlyHint).toBe(true);
        expect(tool.annotations?.openWorldHint).toBe(true);
    });

    it('all router tools should be read-only', () => {
        for (const tool of tools) {
            expect(tool.annotations?.readOnlyHint).toBe(true);
        }
    });

    it('all router tools should have correct requiredScopes', () => {
        for (const tool of tools) {
            expect(tool.requiredScopes).toContain('read');
        }
    });

    it('all tools should have openWorldHint true', () => {
        for (const tool of tools) {
            expect(tool.annotations?.openWorldHint).toBe(true);
        }
    });

    it('all tools should have idempotentHint true', () => {
        for (const tool of tools) {
            expect(tool.annotations?.idempotentHint).toBe(true);
        }
    });
});

describe('Handler Execution', () => {
    let tools: ReturnType<typeof getRouterTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        tools = getRouterTools(createMockMySQLAdapter() as unknown as MySQLAdapter);
        mockContext = createMockRequestContext();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // Helper to mock successful fetch response
    const mockJsonResponse = (data: unknown) => {
        mockFetch.mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue(data)
        });
    };

    describe('mysql_router_status', () => {
        it('should fetch router status and return result', async () => {
            const mockStatus = {
                processId: 1234,
                version: '8.0.35',
                hostname: 'router-host',
                timeStarted: '2024-01-01T00:00:00Z'
            };
            mockJsonResponse(mockStatus);

            const tool = tools.find(t => t.name === 'mysql_router_status')!;
            const result = await tool.handler({}, mockContext);

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/router/status'),
                expect.objectContaining({ method: 'GET' })
            );
            expect(result).toEqual({
                success: true,
                status: mockStatus
            });
        });
    });

    describe('mysql_router_routes', () => {
        it('should fetch all routes', async () => {
            const mockRoutes = {
                items: [
                    { name: 'bootstrap_ro' },
                    { name: 'bootstrap_rw' }
                ]
            };
            mockJsonResponse(mockRoutes);

            const tool = tools.find(t => t.name === 'mysql_router_routes')!;
            const result = await tool.handler({}, mockContext);

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/routes'),
                expect.any(Object)
            );
            expect(result).toEqual({
                success: true,
                routes: mockRoutes
            });
        });
    });

    describe('mysql_router_route_status', () => {
        it('should fetch status for specific route', async () => {
            const mockRouteStatus = {
                activeConnections: 5,
                totalConnections: 100,
                blockedHosts: 0
            };
            mockJsonResponse(mockRouteStatus);

            const tool = tools.find(t => t.name === 'mysql_router_route_status')!;
            const result = await tool.handler({ routeName: 'bootstrap_ro' }, mockContext);

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/routes/bootstrap_ro/status'),
                expect.any(Object)
            );
            expect(result).toEqual({
                success: true,
                routeName: 'bootstrap_ro',
                status: mockRouteStatus
            });
        });

        it('should URL-encode route names', async () => {
            mockJsonResponse({});

            const tool = tools.find(t => t.name === 'mysql_router_route_status')!;
            await tool.handler({ routeName: 'route/with/slashes' }, mockContext);

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('route%2Fwith%2Fslashes'),
                expect.any(Object)
            );
        });
    });

    describe('mysql_router_route_health', () => {
        it('should check route health', async () => {
            const mockHealth = { isAlive: true };
            mockJsonResponse(mockHealth);

            const tool = tools.find(t => t.name === 'mysql_router_route_health')!;
            const result = await tool.handler({ routeName: 'bootstrap_ro' }, mockContext);

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/routes/bootstrap_ro/health'),
                expect.any(Object)
            );
            expect(result).toEqual({
                success: true,
                routeName: 'bootstrap_ro',
                health: mockHealth
            });
        });
    });

    describe('mysql_router_route_connections', () => {
        it('should list active connections', async () => {
            const mockConnections = {
                items: [
                    { sourceAddress: '192.168.1.1', destinationAddress: '10.0.0.1', bytesIn: 1024 }
                ]
            };
            mockJsonResponse(mockConnections);

            const tool = tools.find(t => t.name === 'mysql_router_route_connections')!;
            const result = await tool.handler({ routeName: 'bootstrap_rw' }, mockContext);

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/routes/bootstrap_rw/connections'),
                expect.any(Object)
            );
            expect(result).toEqual({
                success: true,
                routeName: 'bootstrap_rw',
                connections: mockConnections
            });
        });
    });

    describe('mysql_router_route_destinations', () => {
        it('should list backend destinations', async () => {
            const mockDestinations = {
                items: [
                    { address: 'mysql-1.example.com', port: 3306 },
                    { address: 'mysql-2.example.com', port: 3306 }
                ]
            };
            mockJsonResponse(mockDestinations);

            const tool = tools.find(t => t.name === 'mysql_router_route_destinations')!;
            const result = await tool.handler({ routeName: 'bootstrap_ro' }, mockContext);

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/routes/bootstrap_ro/destinations'),
                expect.any(Object)
            );
            expect(result).toEqual({
                success: true,
                routeName: 'bootstrap_ro',
                destinations: mockDestinations
            });
        });
    });

    describe('mysql_router_route_blocked_hosts', () => {
        it('should list blocked hosts', async () => {
            const mockBlockedHosts = {
                items: [
                    { address: '192.168.1.100' }
                ]
            };
            mockJsonResponse(mockBlockedHosts);

            const tool = tools.find(t => t.name === 'mysql_router_route_blocked_hosts')!;
            const result = await tool.handler({ routeName: 'bootstrap_rw' }, mockContext);

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/routes/bootstrap_rw/blockedHosts'),
                expect.any(Object)
            );
            expect(result).toEqual({
                success: true,
                routeName: 'bootstrap_rw',
                blockedHosts: mockBlockedHosts
            });
        });
    });

    describe('mysql_router_metadata_status', () => {
        it('should fetch metadata cache status', async () => {
            const mockMetadata = {
                refreshTotal: 100,
                refreshSucceeded: 99,
                lastRefreshHostName: 'mysql-primary.example.com'
            };
            mockJsonResponse(mockMetadata);

            const tool = tools.find(t => t.name === 'mysql_router_metadata_status')!;
            const result = await tool.handler({ metadataName: 'my_cluster' }, mockContext);

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/metadata/my_cluster/status'),
                expect.any(Object)
            );
            expect(result).toEqual({
                success: true,
                metadataName: 'my_cluster',
                status: mockMetadata
            });
        });
    });

    describe('mysql_router_pool_status', () => {
        it('should fetch connection pool status', async () => {
            const mockPoolStatus = {
                reusedConnections: 50,
                idleServerConnections: 10
            };
            mockJsonResponse(mockPoolStatus);

            const tool = tools.find(t => t.name === 'mysql_router_pool_status')!;
            const result = await tool.handler({ poolName: 'default' }, mockContext);

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/connection_pool/default/status'),
                expect.any(Object)
            );
            expect(result).toEqual({
                success: true,
                poolName: 'default',
                status: mockPoolStatus
            });
        });
    });
});

describe('HTTP Header Handling', () => {
    let tools: ReturnType<typeof getRouterTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        tools = getRouterTools(createMockMySQLAdapter() as unknown as MySQLAdapter);
        mockContext = createMockRequestContext();

        mockFetch.mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({})
        });
    });

    it('should send Accept: application/json header', async () => {
        const tool = tools.find(t => t.name === 'mysql_router_status')!;
        await tool.handler({}, mockContext);

        expect(mockFetch).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                headers: expect.objectContaining({
                    Accept: 'application/json'
                })
            })
        );
    });
});

describe('Error Handling', () => {
    let tools: ReturnType<typeof getRouterTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        tools = getRouterTools(createMockMySQLAdapter() as unknown as MySQLAdapter);
        mockContext = createMockRequestContext();
    });

    it('should throw on non-ok response', async () => {
        mockFetch.mockResolvedValue({
            ok: false,
            status: 401,
            statusText: 'Unauthorized'
        });

        const tool = tools.find(t => t.name === 'mysql_router_status')!;

        await expect(tool.handler({}, mockContext)).rejects.toThrow('Router API error: 401 Unauthorized');
    });

    it('should throw on 404 response', async () => {
        mockFetch.mockResolvedValue({
            ok: false,
            status: 404,
            statusText: 'Not Found'
        });

        const tool = tools.find(t => t.name === 'mysql_router_route_status')!;

        await expect(tool.handler({ routeName: 'nonexistent' }, mockContext)).rejects.toThrow('Router API error: 404 Not Found');
    });

    it('should throw on network error', async () => {
        mockFetch.mockRejectedValue(new Error('Network error'));

        const tool = tools.find(t => t.name === 'mysql_router_status')!;

        await expect(tool.handler({}, mockContext)).rejects.toThrow('Network error');
    });

    it('should throw on connection refused', async () => {
        mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

        const tool = tools.find(t => t.name === 'mysql_router_status')!;

        await expect(tool.handler({}, mockContext)).rejects.toThrow('ECONNREFUSED');
    });
});

describe('Authentication and TLS Handling', () => {
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
        vi.clearAllMocks();
        // Save original env
        originalEnv = { ...process.env };
        // Clear relevant env vars
        delete process.env['MYSQL_ROUTER_URL'];
        delete process.env['MYSQL_ROUTER_USER'];
        delete process.env['MYSQL_ROUTER_PASSWORD'];
        delete process.env['MYSQL_ROUTER_INSECURE'];
        delete process.env['NODE_TLS_REJECT_UNAUTHORIZED'];
    });

    afterEach(() => {
        vi.restoreAllMocks();
        // Restore original env
        process.env = originalEnv;
    });

    it('should add Basic auth header when credentials provided', async () => {
        process.env['MYSQL_ROUTER_USER'] = 'admin';
        process.env['MYSQL_ROUTER_PASSWORD'] = 'secret';

        mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });

        const tools = getRouterTools(createMockMySQLAdapter() as unknown as MySQLAdapter);
        const tool = tools.find(t => t.name === 'mysql_router_status')!;
        await tool.handler({}, createMockRequestContext());

        const headers = mockFetch.mock.calls[0][1]?.headers as Record<string, string>;
        expect(headers['Authorization']).toMatch(/^Basic /);
        // Verify the encoded value
        const expectedAuth = Buffer.from('admin:secret').toString('base64');
        expect(headers['Authorization']).toBe(`Basic ${expectedAuth}`);
    });

    it('should not add auth header when no credentials provided', async () => {
        mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });

        const tools = getRouterTools(createMockMySQLAdapter() as unknown as MySQLAdapter);
        const tool = tools.find(t => t.name === 'mysql_router_status')!;
        await tool.handler({}, createMockRequestContext());

        const headers = mockFetch.mock.calls[0][1]?.headers as Record<string, string>;
        expect(headers['Authorization']).toBeUndefined();
    });

    it('should set NODE_TLS_REJECT_UNAUTHORIZED=0 for HTTPS with insecure=true', async () => {
        process.env['MYSQL_ROUTER_URL'] = 'https://localhost:8443';
        process.env['MYSQL_ROUTER_INSECURE'] = 'true';

        let capturedTlsSetting: string | undefined;

        mockFetch.mockImplementation(async () => {
            capturedTlsSetting = process.env['NODE_TLS_REJECT_UNAUTHORIZED'];
            return { ok: true, json: () => Promise.resolve({}) };
        });

        const tools = getRouterTools(createMockMySQLAdapter() as unknown as MySQLAdapter);
        const tool = tools.find(t => t.name === 'mysql_router_status')!;
        await tool.handler({}, createMockRequestContext());

        expect(capturedTlsSetting).toBe('0');
    });

    it('should restore original TLS setting after request when it was defined', async () => {
        process.env['MYSQL_ROUTER_URL'] = 'https://localhost:8443';
        process.env['MYSQL_ROUTER_INSECURE'] = 'true';
        process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '1';

        mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });

        const tools = getRouterTools(createMockMySQLAdapter() as unknown as MySQLAdapter);
        const tool = tools.find(t => t.name === 'mysql_router_status')!;
        await tool.handler({}, createMockRequestContext());

        expect(process.env['NODE_TLS_REJECT_UNAUTHORIZED']).toBe('1');
    });

    it('should delete TLS setting if originally undefined', async () => {
        process.env['MYSQL_ROUTER_URL'] = 'https://localhost:8443';
        process.env['MYSQL_ROUTER_INSECURE'] = 'true';
        // Ensure it's undefined for this test
        delete process.env['NODE_TLS_REJECT_UNAUTHORIZED'];

        mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });

        const tools = getRouterTools(createMockMySQLAdapter() as unknown as MySQLAdapter);
        const tool = tools.find(t => t.name === 'mysql_router_status')!;
        await tool.handler({}, createMockRequestContext());

        expect(process.env['NODE_TLS_REJECT_UNAUTHORIZED']).toBeUndefined();
    });

    it('should not modify TLS setting for HTTP URLs even with insecure=true', async () => {
        process.env['MYSQL_ROUTER_URL'] = 'http://localhost:8080';
        process.env['MYSQL_ROUTER_INSECURE'] = 'true';
        process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '1';

        let capturedTlsSetting: string | undefined;

        mockFetch.mockImplementation(async () => {
            capturedTlsSetting = process.env['NODE_TLS_REJECT_UNAUTHORIZED'];
            return { ok: true, json: () => Promise.resolve({}) };
        });

        const tools = getRouterTools(createMockMySQLAdapter() as unknown as MySQLAdapter);
        const tool = tools.find(t => t.name === 'mysql_router_status')!;
        await tool.handler({}, createMockRequestContext());

        // Should remain '1', not changed to '0'
        expect(capturedTlsSetting).toBe('1');
    });

    it('should restore TLS setting even when fetch throws', async () => {
        process.env['MYSQL_ROUTER_URL'] = 'https://localhost:8443';
        process.env['MYSQL_ROUTER_INSECURE'] = 'true';
        process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '1';

        mockFetch.mockRejectedValue(new Error('Network error'));

        const tools = getRouterTools(createMockMySQLAdapter() as unknown as MySQLAdapter);
        const tool = tools.find(t => t.name === 'mysql_router_status')!;

        await expect(tool.handler({}, createMockRequestContext())).rejects.toThrow('Network error');

        // Should still be restored
        expect(process.env['NODE_TLS_REJECT_UNAUTHORIZED']).toBe('1');
    });
});
