/**
 * mysql-mcp - ConnectionPool Unit Tests
 * 
 * Tests for connection pool initialization, queries, health checks,
 * and lifecycle management using mocked mysql2.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConnectionPool } from '../ConnectionPool.js';
import type { ConnectionPoolConfig } from '../ConnectionPool.js';
import mysql from 'mysql2/promise';

// Mock mysql2/promise
vi.mock('mysql2/promise', () => {
    const mockConnection = {
        query: vi.fn().mockResolvedValue([[{ version: '8.0.35' }], []]),
        execute: vi.fn().mockResolvedValue([[{ id: 1 }], []]),
        release: vi.fn(),
        ping: vi.fn().mockResolvedValue(undefined)
    };

    const mockPool = {
        getConnection: vi.fn().mockResolvedValue(mockConnection),
        query: vi.fn().mockResolvedValue([[], []]),
        execute: vi.fn().mockResolvedValue([[], []]),
        end: vi.fn().mockResolvedValue(undefined)
    };

    return {
        default: {
            createPool: vi.fn().mockReturnValue(mockPool)
        }
    };
});

describe('ConnectionPool', () => {
    let pool: ConnectionPool;
    let config: ConnectionPoolConfig;

    beforeEach(() => {
        vi.clearAllMocks();
        config = {
            host: 'localhost',
            port: 3306,
            user: 'root',
            password: 'root',
            database: 'testdb'
        };
        pool = new ConnectionPool(config);
    });

    describe('constructor', () => {
        it('should create a pool instance', () => {
            expect(pool).toBeInstanceOf(ConnectionPool);
        });

        it('should not be initialized by default', () => {
            expect(pool.isInitialized()).toBe(false);
        });

        it('should not be closing by default', () => {
            expect(pool.isClosing()).toBe(false);
        });
    });

    describe('initialize', () => {
        it('should initialize the pool', async () => {
            await pool.initialize();
            expect(pool.isInitialized()).toBe(true);
        });

        it('should not re-initialize if already initialized', async () => {
            await pool.initialize();
            await pool.initialize(); // Should not throw
            expect(pool.isInitialized()).toBe(true);
        });
    });

    describe('getConnection', () => {
        it('should throw if pool not initialized', async () => {
            await expect(pool.getConnection()).rejects.toThrow('Connection pool not initialized');
        });

        it('should return a connection after initialization', async () => {
            await pool.initialize();
            const connection = await pool.getConnection();
            expect(connection).toBeDefined();
        });

        it('should throw if pool is shutting down', async () => {
            await pool.initialize();
            await pool.shutdown();
            await expect(pool.getConnection()).rejects.toThrow();
        });
    });

    describe('query', () => {
        it('should throw if pool not initialized', async () => {
            await expect(pool.query('SELECT 1')).rejects.toThrow('Connection pool not initialized');
        });

        it('should execute queries after initialization', async () => {
            await pool.initialize();
            const [rows, _fields] = await pool.query('SELECT 1');
            expect(rows).toBeDefined();
        });

        it('should track query count', async () => {
            await pool.initialize();
            await pool.query('SELECT 1');
            await pool.query('SELECT 2');
            const stats = pool.getStats();
            expect(stats.totalQueries).toBe(2);
        });
    });

    describe('execute', () => {
        it('should throw if pool not initialized', async () => {
            await expect(pool.execute('SELECT ?', [1])).rejects.toThrow('Connection pool not initialized');
        });

        it('should execute prepared statements after initialization', async () => {
            await pool.initialize();
            const [rows, _fields] = await pool.execute('SELECT ?', [1]);
            expect(rows).toBeDefined();
        });

        it('should track query count for execute', async () => {
            await pool.initialize();
            await pool.execute('SELECT 1');
            const stats = pool.getStats();
            expect(stats.totalQueries).toBe(1);
        });
    });

    describe('getStats', () => {
        it('should return stats even before initialization', () => {
            const stats = pool.getStats();
            expect(stats).toHaveProperty('total');
            expect(stats).toHaveProperty('active');
            expect(stats).toHaveProperty('idle');
            expect(stats).toHaveProperty('waiting');
            expect(stats).toHaveProperty('totalQueries');
        });

        it('should track active connections', async () => {
            await pool.initialize();
            const _conn = await pool.getConnection();
            const stats = pool.getStats();
            expect(stats.active).toBe(1);
        });
    });

    describe('releaseConnection', () => {
        it('should decrease active count', async () => {
            await pool.initialize();
            const conn = await pool.getConnection();
            expect(pool.getStats().active).toBe(1);
            pool.releaseConnection(conn);
            expect(pool.getStats().active).toBe(0);
        });

        it('should not go below 0 active connections', async () => {
            await pool.initialize();
            const conn = await pool.getConnection();
            pool.releaseConnection(conn);
            pool.releaseConnection(conn); // Release twice
            expect(pool.getStats().active).toBe(0);
        });
    });

    describe('checkHealth', () => {
        it('should return unhealthy if not initialized', async () => {
            const health = await pool.checkHealth();
            expect(health.connected).toBe(false);
            expect(health.error).toContain('not initialized');
        });

        it('should return healthy after initialization', async () => {
            await pool.initialize();
            const health = await pool.checkHealth();
            expect(health.connected).toBe(true);
            expect(health.latencyMs).toBeDefined();
            expect(health.version).toBe('8.0.35');
        });

        it('should include pool stats in health check', async () => {
            await pool.initialize();
            const health = await pool.checkHealth();
            expect(health.poolStats).toBeDefined();
        });
    });

    describe('shutdown', () => {
        it('should do nothing if not initialized', async () => {
            await pool.shutdown(); // Should not throw
            expect(pool.isInitialized()).toBe(false);
        });

        it('should shutdown the pool', async () => {
            await pool.initialize();
            expect(pool.isInitialized()).toBe(true);
            await pool.shutdown();
            expect(pool.isClosing()).toBe(true);
        });
    });

    describe('isInitialized', () => {
        it('should return false before initialization', () => {
            expect(pool.isInitialized()).toBe(false);
        });

        it('should return true after initialization', async () => {
            await pool.initialize();
            expect(pool.isInitialized()).toBe(true);
        });
    });

    describe('isClosing', () => {
        it('should return false initially', () => {
            expect(pool.isClosing()).toBe(false);
        });

        it('should return true after shutdown starts', async () => {
            await pool.initialize();
            await pool.shutdown();
            expect(pool.isClosing()).toBe(true);
        });
    });
});

describe('ConnectionPool with SSL', () => {
    it('should handle boolean SSL config', async () => {
        const pool = new ConnectionPool({
            host: 'localhost',
            port: 3306,
            user: 'root',
            password: 'root',
            database: 'testdb',
            ssl: true
        });
        await pool.initialize();
        expect(pool.isInitialized()).toBe(true);
    });

    it('should handle boolean SSL config false', async () => {
        const pool = new ConnectionPool({
            host: 'localhost',
            port: 3306,
            user: 'root',
            password: 'root',
            database: 'testdb',
            ssl: false
        });
        await pool.initialize();
        expect(pool.isInitialized()).toBe(true);
    });

    it('should handle SSL options config', async () => {
        const pool = new ConnectionPool({
            host: 'localhost',
            port: 3306,
            user: 'root',
            password: 'root',
            database: 'testdb',
            ssl: { rejectUnauthorized: false }
        });
        await pool.initialize();
        expect(pool.isInitialized()).toBe(true);
    });
});

describe('ConnectionPool with custom pool config', () => {
    it('should apply custom connection limit', async () => {
        const pool = new ConnectionPool({
            host: 'localhost',
            port: 3306,
            user: 'root',
            password: 'root',
            database: 'testdb',
            pool: {
                connectionLimit: 20,
                waitForConnections: true,
                queueLimit: 10
            }
        });
        await pool.initialize();
        const stats = pool.getStats();
        expect(stats.total).toBe(20);
    });
});

describe('ConnectionPool Error Handling', () => {
    it('should handle initialization failure', async () => {
        const createPoolSpy = vi.spyOn(mysql, 'createPool');
        createPoolSpy.mockImplementationOnce(() => {
            throw new Error('Connection refused');
        });

        const pool = new ConnectionPool({
            host: 'localhost',
            port: 3306,
            user: 'root',
            password: 'root',
            database: 'testdb'
        });

        await expect(pool.initialize()).rejects.toThrow('Failed to initialize connection pool');
    });

    it('should fail if pool not initialized', async () => {
        const pool = new ConnectionPool({
            host: 'localhost',
            port: 3306,
            user: 'root',
            password: 'root',
            database: 'testdb'
        });

        // Skip initialize

        await expect(pool.getConnection()).rejects.toThrow('Connection pool not initialized');
        await expect(pool.query('SELECT 1')).rejects.toThrow('Connection pool not initialized');
        await expect(pool.execute('SELECT 1')).rejects.toThrow('Connection pool not initialized');
    });

    it('should handle getConnection failure', async () => {
        const pool = new ConnectionPool({
            host: 'localhost',
            port: 3306,
            user: 'root',
            password: 'root',
            database: 'testdb'
        });
        await pool.initialize();

        // Spy on the internal pool's getConnection
        // We cast to any to access the private pool property or just rely on the mock factory
        const internalPool = (pool as any).pool;
        vi.spyOn(internalPool, 'getConnection').mockRejectedValueOnce(new Error('Pool exhausted'));

        await expect(pool.getConnection()).rejects.toThrow('Failed to get connection: Pool exhausted');
    });

    it('should handle query failure', async () => {
        const pool = new ConnectionPool({
            host: 'localhost',
            port: 3306,
            user: 'root',
            password: 'root',
            database: 'testdb'
        });
        await pool.initialize();

        const internalPool = (pool as any).pool;
        vi.spyOn(internalPool, 'query').mockRejectedValueOnce(new Error('Query failed'));

        await expect(pool.query('SELECT 1')).rejects.toThrow('Query failed: Query failed');
    });

    it('should handle execute failure', async () => {
        const pool = new ConnectionPool({
            host: 'localhost',
            port: 3306,
            user: 'root',
            password: 'root',
            database: 'testdb'
        });
        await pool.initialize();

        const internalPool = (pool as any).pool;
        vi.spyOn(internalPool, 'execute').mockRejectedValueOnce(new Error('Execution failed'));

        await expect(pool.execute('UPDATE users SET name = ?', ['test'])).rejects.toThrow('Execute failed: Execution failed');
    });

    it('should fail if shutting down', async () => {
        const pool = new ConnectionPool({
            host: 'localhost',
            port: 3306,
            user: 'root',
            password: 'root',
            database: 'testdb'
        });
        await pool.initialize();

        // Force shutting down state
        (pool as any).isShuttingDown = true;

        await expect(pool.getConnection()).rejects.toThrow('Connection pool is shutting down');
        await expect(pool.getConnection()).rejects.toThrow('Connection pool is shutting down');
    });

    it('should handle shutdown failure', async () => {
        const pool = new ConnectionPool({
            host: 'localhost',
            port: 3306,
            user: 'root',
            password: 'root',
            database: 'testdb'
        });
        await pool.initialize();

        const internalPool = (pool as any).pool;
        vi.spyOn(internalPool, 'end').mockRejectedValueOnce(new Error('Forced error'));

        await expect(pool.shutdown()).rejects.toThrow('Forced error');
    });

    it('should handle releaseConnection failure', async () => {
        const pool = new ConnectionPool({
            host: 'localhost',
            port: 3306,
            user: 'root',
            password: 'root',
            database: 'testdb'
        });
        await pool.initialize();

        const connection = await pool.getConnection();

        // Mock release to throw
        vi.spyOn(connection, 'release').mockImplementationOnce(() => {
            throw new Error('Release failed');
        });

        // Should not throw, but log error
        pool.releaseConnection(connection);
    });

    it('should handle checkHealth failure', async () => {
        const pool = new ConnectionPool({
            host: 'localhost',
            port: 3306,
            user: 'root',
            password: 'root',
            database: 'testdb'
        });
        await pool.initialize();

        const internalPool = (pool as any).pool;
        vi.spyOn(internalPool, 'getConnection').mockRejectedValueOnce(new Error('Health check failed'));

        const health = await pool.checkHealth();
        expect(health.connected).toBe(false);
        expect(health.error).toContain('Health check failed');
    });
});
