/**
 * mysql-mcp - Admin Monitoring Tools Unit Tests
 *
 * Comprehensive tests for monitoring.ts module functions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createShowProcesslistTool,
  createShowStatusTool,
  createShowVariablesTool,
  createInnodbStatusTool,
  createReplicationStatusTool,
  createPoolStatsTool,
  createServerHealthTool,
} from "../monitoring.js";
import type { MySQLAdapter } from "../../../MySQLAdapter.js";
import {
  createMockMySQLAdapter,
  createMockRequestContext,
  createMockQueryResult,
} from "../../../../../__tests__/mocks/index.js";

describe("Admin Monitoring Tools", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    mockContext = createMockRequestContext();
  });

  describe("createShowProcesslistTool", () => {
    it("should create tool with correct definition", () => {
      const tool = createShowProcesslistTool(
        mockAdapter as unknown as MySQLAdapter,
      );

      expect(tool.name).toBe("mysql_show_processlist");
      expect(tool.group).toBe("monitoring");
      expect(tool.requiredScopes).toContain("read");
      expect(tool.annotations?.readOnlyHint).toBe(true);
    });

    it("should show processlist", async () => {
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([
          {
            Id: 1,
            User: "root",
            Host: "localhost",
            db: "test",
            Command: "Query",
            Time: 0,
            State: "executing",
            Info: "SHOW PROCESSLIST",
          },
        ]),
      );

      const tool = createShowProcesslistTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = await tool.handler({ full: true }, mockContext);

      expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
        "SHOW FULL PROCESSLIST",
      );
      expect(result).toHaveProperty("processes");
    });

    it("should handle empty processlist", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createShowProcesslistTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = await tool.handler({}, mockContext);

      expect(result).toHaveProperty("processes");
      expect((result as { processes: unknown[] }).processes).toEqual([]);
    });
  });

  describe("createShowStatusTool", () => {
    it("should create tool with correct definition", () => {
      const tool = createShowStatusTool(mockAdapter as unknown as MySQLAdapter);

      expect(tool.name).toBe("mysql_show_status");
      expect(tool.group).toBe("monitoring");
      expect(tool.requiredScopes).toContain("read");
      expect(tool.annotations?.readOnlyHint).toBe(true);
    });

    it("should show global status without filter", async () => {
      mockAdapter.rawQuery.mockResolvedValue(
        createMockQueryResult([
          { Variable_name: "Threads_running", Value: "5" },
          { Variable_name: "Uptime", Value: "86400" },
        ]),
      );

      const tool = createShowStatusTool(mockAdapter as unknown as MySQLAdapter);
      const result = await tool.handler({}, mockContext);

      expect(mockAdapter.rawQuery).toHaveBeenCalledWith("SHOW GLOBAL STATUS");
      expect(result).toHaveProperty("status");
    });

    it("should show global status with LIKE filter", async () => {
      mockAdapter.rawQuery.mockResolvedValue(
        createMockQueryResult([
          { Variable_name: "Threads_running", Value: "5" },
          { Variable_name: "Threads_connected", Value: "10" },
        ]),
      );

      const tool = createShowStatusTool(mockAdapter as unknown as MySQLAdapter);
      const result = await tool.handler({ like: "Threads%" }, mockContext);

      expect(mockAdapter.rawQuery).toHaveBeenCalled();
      const call = mockAdapter.rawQuery.mock.calls[0][0] as string;
      expect(call).toContain("LIKE 'Threads%'");
      expect(result).toHaveProperty("status");
    });

    it("should show session status when global is false", async () => {
      mockAdapter.rawQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createShowStatusTool(mockAdapter as unknown as MySQLAdapter);
      await tool.handler({ global: false }, mockContext);

      expect(mockAdapter.rawQuery).toHaveBeenCalledWith("SHOW STATUS");
    });

    it("should handle session status with LIKE filter", async () => {
      mockAdapter.rawQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createShowStatusTool(mockAdapter as unknown as MySQLAdapter);
      await tool.handler({ global: false, like: "Com_%" }, mockContext);

      const call = mockAdapter.rawQuery.mock.calls[0][0] as string;
      expect(call).not.toContain("GLOBAL");
      expect(call).toContain("LIKE 'Com_%'");
    });

    it("should transform results to key-value pairs", async () => {
      mockAdapter.rawQuery.mockResolvedValue(
        createMockQueryResult([
          { Variable_name: "Uptime", Value: "12345" },
          { Variable_name: "Queries", Value: "98765" },
        ]),
      );

      const tool = createShowStatusTool(mockAdapter as unknown as MySQLAdapter);
      const result = (await tool.handler({}, mockContext)) as {
        status: Record<string, string>;
      };

      expect(result.status).toHaveProperty("Uptime", "12345");
      expect(result.status).toHaveProperty("Queries", "98765");
    });

    it("should apply default limit of 100 when results exceed it", async () => {
      const rows = Array.from({ length: 150 }, (_, i) => ({
        Variable_name: `Status_${i}`,
        Value: `${i}`,
      }));
      mockAdapter.rawQuery.mockResolvedValue(createMockQueryResult(rows));

      const tool = createShowStatusTool(mockAdapter as unknown as MySQLAdapter);
      const result = (await tool.handler({}, mockContext)) as {
        status: Record<string, string>;
        rowCount: number;
        totalAvailable: number;
        limited: boolean;
      };

      expect(Object.keys(result.status)).toHaveLength(100);
      expect(result.rowCount).toBe(100);
      expect(result.totalAvailable).toBe(150);
      expect(result.limited).toBe(true);
    });

    it("should respect explicit limit parameter", async () => {
      const rows = Array.from({ length: 20 }, (_, i) => ({
        Variable_name: `Status_${i}`,
        Value: `${i}`,
      }));
      mockAdapter.rawQuery.mockResolvedValue(createMockQueryResult(rows));

      const tool = createShowStatusTool(mockAdapter as unknown as MySQLAdapter);
      const result = (await tool.handler({ limit: 5 }, mockContext)) as {
        status: Record<string, string>;
        rowCount: number;
        totalAvailable: number;
        limited: boolean;
      };

      expect(Object.keys(result.status)).toHaveLength(5);
      expect(result.rowCount).toBe(5);
      expect(result.totalAvailable).toBe(20);
      expect(result.limited).toBe(true);
    });

    it("should redact RSA public key values", async () => {
      mockAdapter.rawQuery.mockResolvedValue(
        createMockQueryResult([
          { Variable_name: "Uptime", Value: "12345" },
          {
            Variable_name: "Caching_sha2_password_rsa_public_key",
            Value:
              "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkq...\n-----END PUBLIC KEY-----",
          },
        ]),
      );

      const tool = createShowStatusTool(mockAdapter as unknown as MySQLAdapter);
      const result = (await tool.handler({}, mockContext)) as {
        status: Record<string, string>;
      };

      expect(result.status["Uptime"]).toBe("12345");
      expect(result.status["Caching_sha2_password_rsa_public_key"]).toBe(
        "[REDACTED]",
      );
    });
  });

  describe("createShowVariablesTool", () => {
    it("should create tool with correct definition", () => {
      const tool = createShowVariablesTool(
        mockAdapter as unknown as MySQLAdapter,
      );

      expect(tool.name).toBe("mysql_show_variables");
      expect(tool.group).toBe("monitoring");
      expect(tool.requiredScopes).toContain("read");
      expect(tool.annotations?.readOnlyHint).toBe(true);
    });

    it("should show global variables without filter", async () => {
      mockAdapter.rawQuery.mockResolvedValue(
        createMockQueryResult([
          { Variable_name: "max_connections", Value: "151" },
        ]),
      );

      const tool = createShowVariablesTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = await tool.handler({}, mockContext);

      expect(mockAdapter.rawQuery).toHaveBeenCalledWith(
        "SHOW GLOBAL VARIABLES",
      );
      expect(result).toHaveProperty("variables");
    });

    it("should show global variables with LIKE filter", async () => {
      mockAdapter.rawQuery.mockResolvedValue(
        createMockQueryResult([
          { Variable_name: "max_connections", Value: "151" },
          { Variable_name: "max_allowed_packet", Value: "67108864" },
        ]),
      );

      const tool = createShowVariablesTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      await tool.handler({ like: "max%" }, mockContext);

      const call = mockAdapter.rawQuery.mock.calls[0][0] as string;
      expect(call).toContain("LIKE 'max%'");
    });

    it("should show session variables when global is false", async () => {
      mockAdapter.rawQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createShowVariablesTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      await tool.handler({ global: false }, mockContext);

      expect(mockAdapter.rawQuery).toHaveBeenCalledWith("SHOW VARIABLES");
    });

    it("should transform results to key-value pairs", async () => {
      mockAdapter.rawQuery.mockResolvedValue(
        createMockQueryResult([
          { Variable_name: "version", Value: "8.0.33" },
          { Variable_name: "datadir", Value: "/var/lib/mysql/" },
        ]),
      );

      const tool = createShowVariablesTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({}, mockContext)) as {
        variables: Record<string, string>;
      };

      expect(result.variables).toHaveProperty("version", "8.0.33");
      expect(result.variables).toHaveProperty("datadir", "/var/lib/mysql/");
    });

    it("should apply default limit of 100 when results exceed it", async () => {
      const rows = Array.from({ length: 200 }, (_, i) => ({
        Variable_name: `var_${i}`,
        Value: `val_${i}`,
      }));
      mockAdapter.rawQuery.mockResolvedValue(createMockQueryResult(rows));

      const tool = createShowVariablesTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({}, mockContext)) as {
        variables: Record<string, string>;
        rowCount: number;
        totalAvailable: number;
        limited: boolean;
      };

      expect(Object.keys(result.variables)).toHaveLength(100);
      expect(result.rowCount).toBe(100);
      expect(result.totalAvailable).toBe(200);
      expect(result.limited).toBe(true);
    });
  });

  describe("createInnodbStatusTool", () => {
    it("should create tool with correct definition", () => {
      const tool = createInnodbStatusTool(
        mockAdapter as unknown as MySQLAdapter,
      );

      expect(tool.name).toBe("mysql_innodb_status");
      expect(tool.group).toBe("monitoring");
      expect(tool.requiredScopes).toContain("read");
      expect(tool.annotations?.readOnlyHint).toBe(true);
    });

    it("should execute SHOW ENGINE INNODB STATUS", async () => {
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([
          {
            Type: "InnoDB",
            Name: "",
            Status: "BACKGROUND THREAD\n...\nEND OF INNODB MONITOR OUTPUT",
          },
        ]),
      );

      const tool = createInnodbStatusTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = await tool.handler({}, mockContext);

      expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
        "SHOW ENGINE INNODB STATUS",
      );
      expect(result).toHaveProperty("status");
    });

    it("should handle empty status result", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createInnodbStatusTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = await tool.handler({}, mockContext);

      expect(result).toHaveProperty("status");
    });
  });

  describe("createReplicationStatusTool", () => {
    it("should create tool with correct definition", () => {
      const tool = createReplicationStatusTool(
        mockAdapter as unknown as MySQLAdapter,
      );

      expect(tool.name).toBe("mysql_replication_status");
      expect(tool.group).toBe("monitoring");
      expect(tool.requiredScopes).toContain("read");
      expect(tool.annotations?.readOnlyHint).toBe(true);
    });

    it("should execute SHOW REPLICA STATUS", async () => {
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([
          {
            Replica_IO_Running: "Yes",
            Replica_SQL_Running: "Yes",
            Seconds_Behind_Master: 0,
          },
        ]),
      );

      const tool = createReplicationStatusTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = await tool.handler({}, mockContext);

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain("SHOW REPLICA STATUS");
      expect(result).toHaveProperty("status");
    });

    it("should handle no replication configured", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createReplicationStatusTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({}, mockContext)) as {
        status: unknown[];
      };

      expect(result.status).toBeUndefined();
    });

    it("should fallback to SHOW SLAVE STATUS on error", async () => {
      // First call fails (REPLICA not supported), second call succeeds
      mockAdapter.executeQuery
        .mockRejectedValueOnce(new Error("Unknown command REPLICA"))
        .mockResolvedValueOnce(
          createMockQueryResult([
            { Master_Host: "master.db", Slave_IO_Running: "Yes" },
          ]),
        );

      const tool = createReplicationStatusTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = await tool.handler({}, mockContext);

      expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(2);
      expect(result).toHaveProperty("status");
    });
  });

  describe("createPoolStatsTool", () => {
    it("should create tool with correct definition", () => {
      const tool = createPoolStatsTool(mockAdapter as unknown as MySQLAdapter);

      expect(tool.name).toBe("mysql_pool_stats");
      expect(tool.group).toBe("monitoring");
      expect(tool.requiredScopes).toContain("read");
      expect(tool.annotations?.readOnlyHint).toBe(true);
    });

    it("should return pool statistics", async () => {
      const mockPool = {
        getStats: vi.fn().mockReturnValue({
          _allConnections: { length: 10 },
          _freeConnections: { length: 5 },
          _acquiringConnections: { length: 2 },
        }),
      };
      mockAdapter.getPool = vi.fn().mockReturnValue(mockPool);

      const tool = createPoolStatsTool(mockAdapter as unknown as MySQLAdapter);
      const result = await tool.handler({}, mockContext);

      expect(mockAdapter.getPool).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it("should handle pool not available", async () => {
      mockAdapter.getPool = vi.fn().mockReturnValue(undefined);

      const tool = createPoolStatsTool(mockAdapter as unknown as MySQLAdapter);
      const result = (await tool.handler({}, mockContext)) as { error: string };

      expect(result.error).toBe("Pool not available");
    });

    it("should handle pool error", async () => {
      const mockPool = {
        getStats: vi.fn().mockImplementation(() => {
          throw new Error("Pool error");
        }),
      };
      mockAdapter.getPool = vi.fn().mockReturnValue(mockPool);

      const tool = createPoolStatsTool(mockAdapter as unknown as MySQLAdapter);
      await expect(tool.handler({}, mockContext)).rejects.toThrow("Pool error");
    });
  });

  describe("createServerHealthTool", () => {
    it("should create tool with correct definition", () => {
      const tool = createServerHealthTool(
        mockAdapter as unknown as MySQLAdapter,
      );

      expect(tool.name).toBe("mysql_server_health");
      expect(tool.group).toBe("monitoring");
      expect(tool.requiredScopes).toContain("read");
      expect(tool.annotations?.readOnlyHint).toBe(true);
    });

    it("should execute health check query", async () => {
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([{ result: 1 }]),
      );

      const tool = createServerHealthTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = await tool.handler({}, mockContext);

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it("should query server status metrics", async () => {
      mockAdapter.executeQuery
        .mockResolvedValueOnce(
          createMockQueryResult([{ Variable_name: "Uptime", Value: "86400" }]),
        )
        .mockResolvedValueOnce(
          createMockQueryResult([
            { Variable_name: "Threads_connected", Value: "10" },
          ]),
        )
        .mockResolvedValueOnce(
          createMockQueryResult([
            { Variable_name: "Questions", Value: "12345" },
          ]),
        );

      const tool = createServerHealthTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({}, mockContext)) as {
        healthy?: boolean;
        uptime?: number;
        activeConnections?: number;
        totalQueries?: number;
      };

      expect(result.uptime).toBe(86400);
      expect(result.activeConnections).toBe(10);
      expect(result.totalQueries).toBe(12345);
    });

    it("should handle missing status variables", async () => {
      mockAdapter.executeQuery
        .mockResolvedValueOnce(createMockQueryResult([]))
        .mockResolvedValueOnce(createMockQueryResult([]))
        .mockResolvedValueOnce(createMockQueryResult([]));

      const tool = createServerHealthTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({}, mockContext)) as {
        uptime?: number;
        activeConnections?: number;
      };

      expect(result.uptime).toBeUndefined();
      expect(result.activeConnections).toBeUndefined();
    });

    it("should handle partial status variables", async () => {
      mockAdapter.executeQuery
        .mockResolvedValueOnce(
          createMockQueryResult([{ Variable_name: "Uptime", Value: "3600" }]),
        )
        .mockResolvedValueOnce(createMockQueryResult([]))
        .mockResolvedValueOnce(createMockQueryResult([]));

      const tool = createServerHealthTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({}, mockContext)) as {
        uptime?: number;
        activeConnections?: number;
      };

      expect(result.uptime).toBe(3600);
      expect(result.activeConnections).toBeUndefined();
    });

    it("should mark unhealthy on connection failure", async () => {
      mockAdapter.executeQuery.mockRejectedValue(new Error("Connection lost"));

      const tool = createServerHealthTool(
        mockAdapter as unknown as MySQLAdapter,
      );

      await expect(tool.handler({}, mockContext)).rejects.toThrow();
    });
  });
});
