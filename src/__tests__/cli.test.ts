
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { main } from '../cli.js';

// Hoist mocks to be accessible in vi.mock factory
const mocks = vi.hoisted(() => ({
    createServer: vi.fn(),
    MySQLAdapter: vi.fn(),
    serverInstance: {
        start: vi.fn(),
        stop: vi.fn(),
        registerAdapter: vi.fn()
    },
    adapterInstance: {
        connect: vi.fn()
    }
}));

// Mock McpServer partially
vi.mock('../server/McpServer.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../server/McpServer.js')>();
    return {
        ...actual,
        createServer: mocks.createServer
    };
});

// Mock MySQLAdapter
vi.mock('../adapters/mysql/MySQLAdapter.js', () => ({
    MySQLAdapter: mocks.MySQLAdapter
}));

// Mock process.exit
const mockExit = vi.spyOn(process, 'exit').mockImplementation((code?: number | string | null | undefined) => {
    throw new Error(`process.exit(${code})`);
});

// Mock console.error
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => { });

// Fix: Use a regular function for implementation so it can be called with 'new'
const mockMySQLAdapterImplementation = function () {
    return mocks.adapterInstance;
};

describe('CLI', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Setup default mock behaviors
        mocks.createServer.mockReturnValue(mocks.serverInstance);
        // Set implementation for MySQLAdapter (class constructor mock)
        mocks.MySQLAdapter.mockImplementation(mockMySQLAdapterImplementation);

        mocks.serverInstance.start.mockResolvedValue(undefined);
        mocks.serverInstance.stop.mockResolvedValue(undefined);
        mocks.adapterInstance.connect.mockResolvedValue(undefined);

        delete process.env['MYSQL_HOST'];
        delete process.env['MYSQL_USER'];
        delete process.env['MYSQL_PASSWORD'];
        delete process.env['MYSQL_DATABASE'];
        delete process.env['MYSQL_MCP_TOOL_FILTER'];
        delete process.env['OAUTH_ENABLED'];
    });

    describe('canSkipMySQLConnection logic', () => {
        it('should skip MySQL connection for router-only filter', async () => {
            await main({
                config: { toolFilter: 'router' },
                databases: [{ type: 'mysql', host: 'localhost', database: 'test' } as any],
                oauth: undefined
            });

            // Should NOT call connect because router tools don't need MySQL
            expect(mocks.adapterInstance.connect).not.toHaveBeenCalled();
            expect(mocks.serverInstance.registerAdapter).toHaveBeenCalled();
        });

        it('should skip MySQL connection for proxysql-only filter', async () => {
            await main({
                config: { toolFilter: 'proxysql' },
                databases: [{ type: 'mysql', host: 'localhost', database: 'test' } as any],
                oauth: undefined
            });

            expect(mocks.adapterInstance.connect).not.toHaveBeenCalled();
        });

        it('should skip MySQL connection for shell-only filter', async () => {
            await main({
                config: { toolFilter: 'shell' },
                databases: [{ type: 'mysql', host: 'localhost', database: 'test' } as any],
                oauth: undefined
            });

            expect(mocks.adapterInstance.connect).not.toHaveBeenCalled();
        });

        it('should skip MySQL connection for ecosystem shortcut', async () => {
            await main({
                config: { toolFilter: 'ecosystem' },
                databases: [{ type: 'mysql', host: 'localhost', database: 'test' } as any],
                oauth: undefined
            });

            expect(mocks.adapterInstance.connect).not.toHaveBeenCalled();
        });

        it('should skip MySQL connection for combined MySQL-optional groups', async () => {
            await main({
                config: { toolFilter: 'router,proxysql,shell' },
                databases: [{ type: 'mysql', host: 'localhost', database: 'test' } as any],
                oauth: undefined
            });

            expect(mocks.adapterInstance.connect).not.toHaveBeenCalled();
        });

        it('should require MySQL connection for starter shortcut', async () => {
            await main({
                config: { toolFilter: 'starter' },
                databases: [{ type: 'mysql', host: 'localhost', database: 'test' } as any],
                oauth: undefined
            });

            expect(mocks.adapterInstance.connect).toHaveBeenCalled();
        });

        it('should require MySQL connection for dev-power shortcut', async () => {
            await main({
                config: { toolFilter: 'dev-power' },
                databases: [{ type: 'mysql', host: 'localhost', database: 'test' } as any],
                oauth: undefined
            });

            expect(mocks.adapterInstance.connect).toHaveBeenCalled();
        });

        it('should require MySQL connection for mixed MySQL and non-MySQL groups', async () => {
            await main({
                config: { toolFilter: 'router,core' },
                databases: [{ type: 'mysql', host: 'localhost', database: 'test' } as any],
                oauth: undefined
            });

            expect(mocks.adapterInstance.connect).toHaveBeenCalled();
        });

        it('should require MySQL connection for exclusion-only filters', async () => {
            await main({
                config: { toolFilter: '-router' },
                databases: [{ type: 'mysql', host: 'localhost', database: 'test' } as any],
                oauth: undefined
            });

            // Exclusion only means no explicit enabled groups, so can't skip
            expect(mocks.adapterInstance.connect).toHaveBeenCalled();
        });

        it('should create placeholder adapter when no databases but using external-only tools', async () => {
            await main({
                config: { toolFilter: 'router' },
                databases: [],
                oauth: undefined
            });

            // Should register a placeholder adapter
            expect(mocks.serverInstance.registerAdapter).toHaveBeenCalledWith(
                expect.anything(),
                'mysql:external'
            );
        });

        it('should require MySQL connection for base-core shortcut', async () => {
            await main({
                config: { toolFilter: 'base-core' },
                databases: [{ type: 'mysql', host: 'localhost', database: 'test' } as any],
                oauth: undefined
            });

            expect(mocks.adapterInstance.connect).toHaveBeenCalled();
        });

        it('should require MySQL connection for ai-data shortcut', async () => {
            await main({
                config: { toolFilter: 'ai-data' },
                databases: [{ type: 'mysql', host: 'localhost', database: 'test' } as any],
                oauth: undefined
            });

            expect(mocks.adapterInstance.connect).toHaveBeenCalled();
        });

        it('should require MySQL connection with no toolFilter', async () => {
            await main({
                config: {},
                databases: [{ type: 'mysql', host: 'localhost', database: 'test' } as any],
                oauth: undefined
            });

            expect(mocks.adapterInstance.connect).toHaveBeenCalled();
        });
    });

    describe('main', () => {
        it('should fail if no database config provided', async () => {
            await expect(main({
                config: {},
                databases: [],
                oauth: undefined
            })).rejects.toThrow('process.exit(1)');

            expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('No database connection specified'));
        });

        it('should start server with valid config', async () => {
            await main({
                config: {},
                databases: [{ type: 'mysql', host: 'localhost', database: 'test' } as any],
                oauth: undefined
            });

            expect(mocks.createServer).toHaveBeenCalled();
            expect(mocks.MySQLAdapter).toHaveBeenCalled(); // verify class instantiation
            expect(mocks.adapterInstance.connect).toHaveBeenCalled();
            expect(mocks.serverInstance.registerAdapter).toHaveBeenCalled();
            expect(mocks.serverInstance.start).toHaveBeenCalled();
        });

        it('should handle startup error', async () => {
            mocks.serverInstance.start.mockRejectedValue(new Error('Startup failed'));

            await expect(main({
                config: {},
                databases: [{ type: 'mysql', host: 'localhost', database: 'test' } as any],
                oauth: undefined
            })).rejects.toThrow('process.exit(1)');

            expect(mockConsoleError).toHaveBeenCalledWith('Fatal error:', expect.any(Error));
        });

        it('should log oauth configuration if enabled', async () => {
            await main({
                config: {},
                databases: [{ type: 'mysql', host: 'localhost', database: 'test' } as any],
                oauth: {
                    enabled: true,
                    issuer: 'https://issuer.com',
                    audience: 'aud'
                }
            });

            expect(mockConsoleError).toHaveBeenCalledWith('OAuth authentication enabled');
        });


        it('should exit immediately if shouldExit is true', async () => {
            await expect(main({
                config: {},
                databases: [],
                oauth: undefined,
                shouldExit: true
            })).rejects.toThrow('process.exit(0)');
        });

        it('should handle graceful shutdown on signal', async () => {
            // Override mockExit to NOT throw for this test to avoid unhandled rejections from async void handler
            mockExit.mockImplementation(() => { return undefined as never });

            const handlers: Record<string, () => void> = {};
            const originalOn = process.on.bind(process);

            const onSpy = vi.spyOn(process, 'on').mockImplementation((event, listener) => {
                if (event === 'SIGINT' || event === 'SIGTERM') {
                    handlers[event as string] = listener as () => void;
                    return process;
                }
                return originalOn(event, listener);
            });

            await main({
                config: {},
                databases: [{ type: 'mysql', host: 'localhost', database: 'test' } as any],
                oauth: undefined
            });

            expect(handlers['SIGINT']).toBeDefined();
            expect(handlers['SIGTERM']).toBeDefined();

            // Trigger shutdown (SIGINT)
            handlers['SIGINT']();

            // Wait for async execution
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(mocks.serverInstance.stop).toHaveBeenCalled();
            expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('Shutting down'));
            expect(mockExit).toHaveBeenCalledWith(0);

            onSpy.mockRestore();
        });
    });
});
