/**
 * mysql-mcp - MySQLAdapter Unit Tests
 *
 * Tests for the MySQL-specific adapter implementation.
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from "vitest";
import { MySQLAdapter } from "../MySQLAdapter.js";
import { ConnectionPool } from "../../../pool/ConnectionPool.js";
import {
  ConnectionError,
  QueryError,
  TransactionError,
  ValidationError,
} from "../../../types/index.js";

// Mock generic ConnectionPool
vi.mock("../../../pool/ConnectionPool.js");

describe("MySQLAdapter", () => {
  let adapter: MySQLAdapter;
  let mockPool: any;
  let mockConnection: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock connection
    mockConnection = {
      execute: vi.fn(),
      query: vi.fn(),
      release: vi.fn(),
      beginTransaction: vi.fn(),
      commit: vi.fn(),
      rollback: vi.fn(),
      ping: vi.fn(),
    };

    // Setup mock pool
    mockPool = {
      initialize: vi.fn().mockResolvedValue(undefined),
      shutdown: vi.fn().mockResolvedValue(undefined),
      checkHealth: vi.fn().mockResolvedValue({ connected: true }),
      execute: vi.fn(),
      query: vi.fn(),
      getConnection: vi.fn().mockResolvedValue(mockConnection),
    };

    // Mock ConnectionPool constructor to return our mockPool
    (ConnectionPool as unknown as Mock).mockImplementation(function () {
      return mockPool;
    });

    adapter = new MySQLAdapter();
  });

  afterEach(async () => {
    if (adapter.isConnected()) {
      await adapter.disconnect();
    }
  });

  const config = {
    type: "mysql" as const,
    host: "localhost",
    port: 3306,
    database: "test_db",
    username: "user",
    password: "password",
  };

  describe("connection", () => {
    it("should connect successfully", async () => {
      await adapter.connect(config);
      expect(adapter.isConnected()).toBe(true);
      expect(ConnectionPool).toHaveBeenCalledWith(
        expect.objectContaining({
          host: "localhost",
          database: "test_db",
        }),
      );
      expect(mockPool.initialize).toHaveBeenCalled();
    });

    it("should not connect if already connected", async () => {
      await adapter.connect(config);
      await adapter.connect(config); // Should warn and return
      expect(mockPool.initialize).toHaveBeenCalledTimes(1);
    });

    it("should handle connection failure", async () => {
      mockPool.initialize.mockRejectedValue(new Error("Connection failed"));
      await expect(adapter.connect(config)).rejects.toThrow(ConnectionError);
      expect(adapter.isConnected()).toBe(false);
    });

    it("should disconnect successfully", async () => {
      await adapter.connect(config);
      await adapter.disconnect();
      expect(adapter.isConnected()).toBe(false);
      expect(mockPool.shutdown).toHaveBeenCalled();
    });

    it("should handle disconnect when not connected", async () => {
      await adapter.disconnect();
      expect(mockPool.shutdown).not.toHaveBeenCalled();
    });

    it("should rollback active transactions on disconnect", async () => {
      await adapter.connect(config);
      // Mock a transaction
      const mockConn = {
        rollback: vi.fn().mockResolvedValue(undefined),
        release: vi.fn(),
      };
      (adapter as any).activeTransactions.set("tx-1", mockConn);

      await adapter.disconnect();

      expect(mockConn.rollback).toHaveBeenCalled();
      expect(mockConn.release).toHaveBeenCalled();
    });

    it("should ignore errors during transaction rollback on disconnect", async () => {
      await adapter.connect(config);
      const mockConn = {
        rollback: vi.fn().mockRejectedValue(new Error("Rollback failed")),
        release: vi.fn(),
      };
      (adapter as any).activeTransactions.set("tx-1", mockConn);

      // Should not throw
      await expect(adapter.disconnect()).resolves.not.toThrow();
      expect(mockConn.release).toHaveBeenCalled();
    });

    it("should use default config values when not provided", async () => {
      await adapter.connect({ type: "mysql" });
      expect(ConnectionPool).toHaveBeenCalledWith(
        expect.objectContaining({
          host: "localhost",
          port: 3306,
          user: "root",
          password: "",
          database: "",
          charset: "utf8mb4",
          timezone: "local",
          connectTimeout: 10000,
        }),
      );
    });
  });

  describe("health check", () => {
    const dbConfig = {
      type: "mysql" as const,
      host: "localhost",
      port: 3306,
      database: "test_db",
      username: "user",
      password: "password",
    };

    it("should return not connected status when pool is null", async () => {
      const health = await adapter.getHealth();
      expect(health.connected).toBe(false);
      expect(health.error).toBe("Not connected");
    });

    it("should return pool health when connected", async () => {
      await adapter.connect(dbConfig);
      mockPool.checkHealth.mockResolvedValue({ connected: true });

      const health = await adapter.getHealth();

      expect(health.connected).toBe(true);
      expect(mockPool.checkHealth).toHaveBeenCalled();
    });
  });

  describe("query execution", () => {
    beforeEach(async () => {
      await adapter.connect({
        type: "mysql",
        host: "localhost",
        username: "root",
        password: "",
      });
    });

    it("should execute read query", async () => {
      const mockRows = [{ id: 1, name: "test" }];
      const mockFields = [
        { name: "id", type: 3 },
        { name: "name", type: 253 },
      ];
      mockPool.execute.mockResolvedValue([mockRows, mockFields]);

      const result = await adapter.executeReadQuery("SELECT * FROM users");

      expect(result.rows).toEqual(mockRows);
      expect(result.columns).toHaveLength(2);
      expect(result.columns?.[0].type).toBe("INT");
    });

    it("should execute write query", async () => {
      const mockResult = { affectedRows: 1, insertId: 100, warningStatus: 0 };
      mockPool.execute.mockResolvedValue([mockResult, undefined]);

      const result = await adapter.executeWriteQuery(
        "INSERT INTO users VALUES (?)",
        ["test"],
      );

      expect(result.rowsAffected).toBe(1);
      expect(result.lastInsertId).toBe(100);
    });

    it("should throw ConnectionError if not connected", async () => {
      await adapter.disconnect();
      await expect(adapter.executeQuery("SELECT 1")).rejects.toThrow(
        ConnectionError,
      );
    });

    it("should throw QueryError on failure", async () => {
      mockPool.execute.mockRejectedValue(new Error("Syntax error"));
      await expect(adapter.executeQuery("BAD QUERY")).rejects.toThrow(
        QueryError,
      );
    });

    it("should execute raw query", async () => {
      const mockRows = [{ status: "OK" }];
      mockPool.query.mockResolvedValue([mockRows, undefined]);

      const result = await adapter.rawQuery("SHOW STATUS");

      expect(result.rows).toEqual(mockRows);
      expect(mockPool.query).toHaveBeenCalledWith("SHOW STATUS");
    });

    it("should throw QueryError on raw query failure", async () => {
      mockPool.query.mockRejectedValue(new Error("Raw query error"));
      await expect(adapter.rawQuery("BAD RAW QUERY")).rejects.toThrow(
        QueryError,
      );
    });

    it("should throw ConnectionError when executing rawQuery if not connected", async () => {
      await adapter.disconnect();
      await expect(adapter.rawQuery("SELECT 1")).rejects.toThrow(
        ConnectionError,
      );
    });

    it("should handle raw query write result", async () => {
      const mockResult = { affectedRows: 5, insertId: 0 };
      mockPool.query.mockResolvedValue([mockResult, undefined]);

      const result = await adapter.rawQuery("DELETE FROM users");

      expect(result.rowsAffected).toBe(5);
      expect(mockPool.query).toHaveBeenCalledWith("DELETE FROM users");
    });
  });

  describe("transactions", () => {
    beforeEach(async () => {
      await adapter.connect({
        type: "mysql",
        host: "localhost",
        username: "root",
        password: "",
      });
    });

    it("should begin transaction", async () => {
      const txId = await adapter.beginTransaction();

      expect(txId).toBeDefined();
      expect(mockPool.getConnection).toHaveBeenCalled();
      expect(mockConnection.beginTransaction).toHaveBeenCalled();
    });

    it("should commit transaction", async () => {
      const txId = await adapter.beginTransaction();
      await adapter.commitTransaction(txId);

      expect(mockConnection.commit).toHaveBeenCalled();
      expect(mockConnection.release).toHaveBeenCalled();
    });

    it("should rollback transaction", async () => {
      const txId = await adapter.beginTransaction();
      await adapter.rollbackTransaction(txId);

      expect(mockConnection.rollback).toHaveBeenCalled();
      expect(mockConnection.release).toHaveBeenCalled();
    });

    it("should throw error for invalid transaction id", async () => {
      await expect(adapter.commitTransaction("invalid-id")).rejects.toThrow(
        TransactionError,
      );
    });

    it("should throw error for invalid transaction id on rollback", async () => {
      await expect(adapter.rollbackTransaction("invalid-id")).rejects.toThrow(
        TransactionError,
      );
    });

    it("should handle beginTransaction failure", async () => {
      mockConnection.beginTransaction.mockRejectedValue(
        new Error("Start tx failed"),
      );
      await expect(adapter.beginTransaction()).rejects.toThrow(
        TransactionError,
      );
      expect(mockConnection.release).toHaveBeenCalled();
    });

    it("should throw error when beginning transaction if not connected", async () => {
      await adapter.disconnect();
      await expect(adapter.beginTransaction()).rejects.toThrow(ConnectionError);
    });

    it("should throw ConnectionError when executing query if not connected (pool null)", async () => {
      // Force pool to be null even if connected flag might be true (simulating weird state or just standard disconnect)
      await adapter.disconnect();
      await expect(adapter.executeQuery("SELECT 1")).rejects.toThrow(
        ConnectionError,
      );
    });

    it("should handle transaction rollback failure", async () => {
      const txId = await adapter.beginTransaction();
      mockConnection.rollback.mockRejectedValue(new Error("Rollback failed"));

      await expect(adapter.rollbackTransaction(txId)).rejects.toThrow();
      expect(mockConnection.release).toHaveBeenCalled(); // Should still release
    });

    it("should handle transaction commit failure", async () => {
      const txId = await adapter.beginTransaction();
      mockConnection.commit.mockRejectedValue(new Error("Commit failed"));

      await expect(adapter.commitTransaction(txId)).rejects.toThrow();
      expect(mockConnection.release).toHaveBeenCalled(); // Should still release
    });

    it("should throw when getting connection for invalid transaction", () => {
      expect(adapter.getTransactionConnection("bad-id")).toBeUndefined();
    });

    it("should execute query on transaction connection", async () => {
      const txId = await adapter.beginTransaction();
      const connection = adapter.getTransactionConnection(txId);

      expect(connection).toBeDefined();

      mockConnection.execute.mockResolvedValue([[], undefined]);
      await adapter.executeOnConnection(connection!, "SELECT 1");

      expect(mockConnection.execute).toHaveBeenCalledWith(
        "SELECT 1",
        undefined,
      );
    });

    it("should handle write query result on transaction connection", async () => {
      const txId = await adapter.beginTransaction();
      const connection = adapter.getTransactionConnection(txId);

      const mockResult = { affectedRows: 1, insertId: 123 };
      mockConnection.execute.mockResolvedValue([mockResult, undefined]);

      const result = await adapter.executeOnConnection(
        connection!,
        "INSERT INTO foo VALUES (1)",
      );

      expect(result.rowsAffected).toBe(1);
      expect(result.lastInsertId).toBe(123);
    });
  });

  describe("schema operations", () => {
    beforeEach(async () => {
      await adapter.connect({
        type: "mysql",
        host: "localhost",
        username: "root",
        password: "",
      });
    });

    it("should list tables", async () => {
      const mockTables = [
        {
          name: "users",
          type: "table",
          engine: "InnoDB",
          rowCount: 10,
        },
      ];
      mockPool.execute.mockResolvedValue([mockTables, undefined]);

      const tables = await adapter.listTables();

      expect(tables).toHaveLength(1);
      expect(tables[0].name).toBe("users");
      expect(tables[0].type).toBe("table");
    });

    it("should describe table", async () => {
      // Mock column info
      mockPool.execute.mockResolvedValueOnce([
        [
          {
            name: "id",
            type: "int",
            nullable: "NO",
            columnKey: "PRI",
            extra: "auto_increment",
          },
        ],
        undefined,
      ]);

      // Mock table info
      mockPool.execute.mockResolvedValueOnce([
        [
          {
            type: "BASE TABLE",
            engine: "InnoDB",
          },
        ],
        undefined,
      ]);

      const info = await adapter.describeTable("users");

      expect(info.name).toBe("users");
      expect(info.columns).toHaveLength(1);
      expect(info.columns?.[0].primaryKey).toBe(true);
    });

    it("should validate table name in describeTable", async () => {
      await expect(adapter.describeTable("invalid;table")).rejects.toThrow(
        ValidationError,
      );
    });

    it("should list schemas", async () => {
      mockPool.execute.mockResolvedValue([
        [{ Database: "test_db" }],
        undefined,
      ]);
      const schemas = await adapter.listSchemas();
      expect(schemas).toContain("test_db");
    });

    it("should get table indexes", async () => {
      mockPool.execute.mockResolvedValue([
        [
          {
            name: "PRIMARY",
            nonUnique: 0,
            columnName: "id",
            type: "BTREE",
          },
        ],
        undefined,
      ]);

      const indexes = await adapter.getTableIndexes("users");

      expect(indexes).toHaveLength(1);
      expect(indexes[0].name).toBe("PRIMARY");
      expect(indexes[0].unique).toBe(true);
    });

    it("should handle composite indexes", async () => {
      mockPool.execute.mockResolvedValue([
        [
          {
            name: "composite_idx",
            nonUnique: 1,
            columnName: "col1",
            type: "BTREE",
          },
          {
            name: "composite_idx",
            nonUnique: 1,
            columnName: "col2",
            type: "BTREE",
          },
        ],
        undefined,
      ]);

      const indexes = await adapter.getTableIndexes("users");
      expect(indexes).toHaveLength(1);
      expect(indexes[0].name).toBe("composite_idx");
      expect(indexes[0].columns).toEqual(["col1", "col2"]);
    });
  });

  describe("views handling", () => {
    beforeEach(async () => {
      await adapter.connect(config);
    });

    it("should identify views in listTables", async () => {
      const mockTables = [
        {
          name: "user_view",
          type: "VIEW",
          engine: null,
          rowCount: null,
        },
      ];
      mockPool.execute.mockResolvedValue([mockTables, undefined]);

      const tables = await adapter.listTables();
      expect(tables[0].type).toBe("view");
    });

    it("should identify views in describeTable", async () => {
      // Mock columns
      mockPool.execute.mockResolvedValueOnce([[], undefined]);

      // Mock view info
      mockPool.execute.mockResolvedValueOnce([
        [
          {
            type: "VIEW",
            engine: null,
          },
        ],
        undefined,
      ]);

      const table = await adapter.describeTable("user_view");
      expect(table.type).toBe("view");
    });
  });

  describe("capabilities and metadata", () => {
    it("should return correct capabilities", () => {
      const caps = adapter.getCapabilities();
      expect(caps.json).toBe(true);
      expect(caps.transactions).toBe(true);
      expect(caps.fullTextSearch).toBe(true);
    });

    it("should return supported tool groups", () => {
      const groups = adapter.getSupportedToolGroups();
      expect(groups).toContain("core");
      expect(groups).toContain("json");
      expect(groups.length).toBeGreaterThan(20);
    });

    it("should return definitions", () => {
      expect(adapter.getToolDefinitions()).toBeDefined();
      expect(adapter.getResourceDefinitions()).toBeDefined();
      expect(adapter.getPromptDefinitions()).toBeDefined();
    });

    it("should return adapter info", () => {
      const info = adapter.getInfo();
      expect(info.type).toBe("mysql");
      expect(info.name).toBe("MySQL Adapter");
    });
  });

  describe("tool definition caching", () => {
    it("should return same array reference on repeated getToolDefinitions calls", () => {
      const first = adapter.getToolDefinitions();
      const second = adapter.getToolDefinitions();
      expect(first).toBe(second); // Same reference = cached
      expect(first.length).toBe(192);
    });
  });

  describe("accessor methods", () => {
    it("should return null pool when not connected", () => {
      expect(adapter.getPool()).toBeNull();
    });

    it("should return pool when connected", async () => {
      await adapter.connect(config);
      expect(adapter.getPool()).toBeDefined();
    });
  });
});
