
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseArgs } from '../args.js';

// Mock process.exit
const mockExit = vi.spyOn(process, 'exit').mockImplementation((code?: number | string | null | undefined) => {
    throw new Error(`process.exit(${code})`);
});

// Mock console.error
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => { });

describe('CLI Args', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.unstubAllEnvs();

        delete process.env['MYSQL_HOST'];
        delete process.env['MYSQL_USER'];
        delete process.env['MYSQL_PASSWORD'];
        delete process.env['MYSQL_DATABASE'];
        delete process.env['MYSQL_MCP_TOOL_FILTER'];
        delete process.env['OAUTH_ENABLED'];
    });

    describe('parseArgs', () => {
        it('should parse mysql connection string flag', () => {
            const result = parseArgs(['--mysql', 'mysql://user:pass@host:3306/db']);
            expect(result.databases).toHaveLength(1);
            expect(result.databases[0]).toMatchObject({
                host: 'host',
                username: 'user',
                password: 'pass',
                database: 'db',
                port: 3306
            });
        });

        it('should parse individual mysql flags', () => {
            const result = parseArgs([
                '--mysql-host', 'localhost',
                '--mysql-user', 'root',
                '--mysql-password', 'secret',
                '--mysql-database', 'testdb',
                '--mysql-port', '3307'
            ]);
            expect(result.databases).toHaveLength(1);
            expect(result.databases[0]).toMatchObject({
                host: 'localhost',
                username: 'root',
                password: 'secret',
                database: 'testdb',
                port: 3307
            });
        });


        it('should use environment variables for fallback', () => {
            vi.stubEnv('MYSQL_HOST', 'env-host');
            vi.stubEnv('MYSQL_USER', 'env-user');

            const result = parseArgs([]);
            // Partial config won't create a database entry unless user AND database are present
            expect(result.databases).toHaveLength(0);

            vi.unstubAllEnvs();
        });

        it('should print help and exit when --help flag is used', () => {
            const result = parseArgs(['--help']);
            expect(result.shouldExit).toBe(true);
            expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('Usage: mysql-mcp [options]'));
        });

        it('should print help and exit when -h flag is used', () => {
            const result = parseArgs(['-h']);
            expect(result.shouldExit).toBe(true);
            expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('Usage: mysql-mcp [options]'));
        });

        it('should use TOOL_FILTER environment variable', () => {
            vi.stubEnv('TOOL_FILTER', '-admin');
            const result = parseArgs([]);
            expect(result.config.toolFilter).toBe('-admin');
            vi.unstubAllEnvs();
        });

        it('should prefer MYSQL_MCP_TOOL_FILTER over TOOL_FILTER', () => {
            vi.stubEnv('TOOL_FILTER', '-admin');
            vi.stubEnv('MYSQL_MCP_TOOL_FILTER', '-security');
            const result = parseArgs([]);
            expect(result.config.toolFilter).toBe('-security');
            vi.unstubAllEnvs();
        });

        it('should load oauth config from environment variables', () => {
            vi.stubEnv('OAUTH_ENABLED', 'true');
            vi.stubEnv('OAUTH_ISSUER', 'https://env-issuer.com');
            vi.stubEnv('OAUTH_AUDIENCE', 'env-aud');
            vi.stubEnv('OAUTH_JWKS_URI', 'https://jwks');
            vi.stubEnv('OAUTH_CLOCK_TOLERANCE', '120');

            const result = parseArgs([]);

            expect(result.oauth).toBeDefined();
            expect(result.oauth?.enabled).toBe(true);
            expect(result.oauth?.issuer).toBe('https://env-issuer.com');
            expect(result.oauth?.audience).toBe('env-aud');
            expect(result.oauth?.jwksUri).toBe('https://jwks');
            expect(result.oauth?.clockTolerance).toBe(120);

            vi.unstubAllEnvs();
        });

        it('should build database config from environment variables if no arguments provided', () => {
            vi.stubEnv('MYSQL_HOST', 'env-host');
            vi.stubEnv('MYSQL_USER', 'env-user');
            vi.stubEnv('MYSQL_PASSWORD', 'env-pass');
            vi.stubEnv('MYSQL_DATABASE', 'env-db');
            vi.stubEnv('MYSQL_PORT', '3307');
            vi.stubEnv('MYSQL_POOL_SIZE', '20');

            const result = parseArgs([]);
            expect(result.databases).toHaveLength(1);
            expect(result.databases[0]).toEqual(expect.objectContaining({
                host: 'env-host',
                username: 'env-user',
                port: 3307,
                database: 'env-db'
            }));
            expect(result.databases[0].pool?.connectionLimit).toBe(20);

            vi.unstubAllEnvs();
        });


        it('should parse transport flags', () => {
            const result = parseArgs(['--transport', 'sse', '--port', '8080']);
            expect(result.config.transport).toBe('sse');
            expect(result.config.port).toBe(8080);

            const resultShort = parseArgs(['-t', 'http', '-p', '9090']);
            expect(resultShort.config.transport).toBe('http');
            expect(resultShort.config.port).toBe(9090);
        });

        it('should parse pool config flags', () => {
            vi.stubEnv('MYSQL_HOST', 'localhost');
            vi.stubEnv('MYSQL_USER', 'user');
            vi.stubEnv('MYSQL_DATABASE', 'db');

            const resultEnv = parseArgs([
                '--pool-size', '25',
                '--pool-timeout', '6000',
                '--pool-queue-limit', '150'
            ]);

            expect(resultEnv.databases[0].pool?.connectionLimit).toBe(25);
            expect(resultEnv.databases[0].pool?.acquireTimeout).toBe(6000);
            expect(resultEnv.databases[0].pool?.queueLimit).toBe(150);

            vi.unstubAllEnvs();
        });

        it('should parse OAuth flags', () => {
            const result = parseArgs([
                '--oauth-enabled',
                '--oauth-issuer', 'https://auth.com',
                '--oauth-audience', 'api',
                '--oauth-jwks-uri', 'https://jwks',
                '--oauth-clock-tolerance', '30'
            ]);

            expect(result.oauth).toBeDefined();
            expect(result.oauth?.enabled).toBe(true);
            expect(result.oauth?.issuer).toBe('https://auth.com');
            expect(result.oauth?.audience).toBe('api');
            expect(result.oauth?.jwksUri).toBe('https://jwks');
            expect(result.oauth?.clockTolerance).toBe(30);
        });

        it('should exit error if value argument looks like a flag', () => {
            // Case: --mysql-user -flag
            expect(() => parseArgs(['--mysql-user', '-flag'])).toThrow('process.exit(1)');
        });

        it('should NOT add database if required fields are missing despite some being present', () => {
            // Case: Host provided, but User missing in both CLI and Env
            vi.stubEnv('MYSQL_DATABASE', 'env-db');
            // No MYSQL_USER

            const result = parseArgs(['--mysql-host', 'cli-host']);
            expect(result.databases).toHaveLength(0);

            vi.unstubAllEnvs();
        });

        it('should fallback to localhost if MYSQL_HOST is missing but others are present', () => {
            vi.stubEnv('MYSQL_USER', 'env-user');
            vi.stubEnv('MYSQL_DATABASE', 'env-db');
            // No MYSQL_HOST

            const result = parseArgs(['--mysql-user', 'cli-user']);

            expect(result.databases[0].host).toBe('localhost');
            expect(result.databases[0].username).toBe('cli-user');

            vi.unstubAllEnvs();
        });

        it('should parse --version flag', () => {
            const result = parseArgs(['--version']);
            expect(result.shouldExit).toBe(true);
            expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('mysql-mcp version'));
        });

        it('should print help when --help flag is used', () => {
            const result = parseArgs(['--help']);
            expect(result.shouldExit).toBe(true);
            expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('Usage: mysql-mcp [options]'));
        });
    });
});
