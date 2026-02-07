/**
 * mysql-mcp - ProxySQL Tools Unit Tests
 *
 * Tests for proxysql tool definitions, annotations, and handler execution.
 * Mocks mysql2/promise to test ProxySQL admin interface queries.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getProxySQLTools } from "../proxysql.js";
import type { MySQLAdapter } from "../../MySQLAdapter.js";
import {
  createMockMySQLAdapter,
  createMockRequestContext,
} from "../../../../__tests__/mocks/index.js";

// Mock mysql2/promise for ProxySQL connection testing
const mockQuery = vi.fn();
const mockEnd = vi.fn();
const mockCreateConnection = vi.fn();

vi.mock("mysql2/promise", () => ({
  default: {
    createConnection: (...args: unknown[]) => mockCreateConnection(...args),
  },
}));

describe("getProxySQLTools", () => {
  let tools: ReturnType<typeof getProxySQLTools>;

  beforeEach(() => {
    vi.clearAllMocks();
    tools = getProxySQLTools(
      createMockMySQLAdapter() as unknown as MySQLAdapter,
    );
  });

  it("should return 12 proxysql tools", () => {
    expect(tools).toHaveLength(12);
  });

  it("should have proxysql group for all tools", () => {
    for (const tool of tools) {
      expect(tool.group).toBe("proxysql");
    }
  });

  it("should have handler functions for all tools", () => {
    for (const tool of tools) {
      expect(typeof tool.handler).toBe("function");
    }
  });

  it("should have inputSchema for all tools", () => {
    for (const tool of tools) {
      expect(tool.inputSchema).toBeDefined();
    }
  });

  it("should include all expected tool names", () => {
    const toolNames = tools.map((t) => t.name);
    expect(toolNames).toContain("proxysql_status");
    expect(toolNames).toContain("proxysql_servers");
    expect(toolNames).toContain("proxysql_hostgroups");
    expect(toolNames).toContain("proxysql_query_rules");
    expect(toolNames).toContain("proxysql_query_digest");
    expect(toolNames).toContain("proxysql_connection_pool");
    expect(toolNames).toContain("proxysql_users");
    expect(toolNames).toContain("proxysql_global_variables");
    expect(toolNames).toContain("proxysql_runtime_status");
    expect(toolNames).toContain("proxysql_memory_stats");
    expect(toolNames).toContain("proxysql_commands");
    expect(toolNames).toContain("proxysql_process_list");
  });
});

describe("Tool Structure Validation", () => {
  let tools: ReturnType<typeof getProxySQLTools>;

  beforeEach(() => {
    vi.clearAllMocks();
    tools = getProxySQLTools(
      createMockMySQLAdapter() as unknown as MySQLAdapter,
    );
  });

  it("proxysql_status should have correct structure", () => {
    const tool = tools.find((t) => t.name === "proxysql_status")!;
    expect(tool.name).toBe("proxysql_status");
    expect(tool.description).toBeDefined();
    expect(tool.annotations?.readOnlyHint).toBe(true);
    expect(tool.annotations?.openWorldHint).toBe(true);
  });

  it("proxysql_query_digest should be read-only", () => {
    const tool = tools.find((t) => t.name === "proxysql_query_digest")!;
    expect(tool.annotations?.readOnlyHint).toBe(true);
  });

  it("proxysql_commands should require admin scope", () => {
    const tool = tools.find((t) => t.name === "proxysql_commands")!;
    expect(tool.requiredScopes).toContain("admin");
  });

  it("all read-only tools should have read scope", () => {
    const readOnlyTools = tools.filter((t) => t.annotations?.readOnlyHint);
    for (const tool of readOnlyTools) {
      expect(tool.requiredScopes).toContain("read");
    }
  });

  it("all tools should have openWorldHint true", () => {
    for (const tool of tools) {
      expect(tool.annotations?.openWorldHint).toBe(true);
    }
  });
});

describe("Handler Execution", () => {
  let tools: ReturnType<typeof getProxySQLTools>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    tools = getProxySQLTools(
      createMockMySQLAdapter() as unknown as MySQLAdapter,
    );
    mockContext = createMockRequestContext();

    // Setup mock connection
    mockCreateConnection.mockResolvedValue({
      query: mockQuery,
      end: mockEnd,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("proxysql_status", () => {
    it("should query stats_mysql_global and return stats", async () => {
      const mockStats = [
        { Variable_Name: "Client_Connections_connected", Variable_Value: "10" },
        { Variable_Name: "Server_Connections_connected", Variable_Value: "5" },
      ];
      mockQuery.mockResolvedValue([mockStats]);

      const tool = tools.find((t) => t.name === "proxysql_status")!;
      const result = await tool.handler({}, mockContext);

      expect(mockCreateConnection).toHaveBeenCalled();
      expect(mockQuery).toHaveBeenCalledWith(
        "SELECT * FROM stats_mysql_global",
      );
      expect(mockEnd).toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        summary: false,
        stats: mockStats,
        totalVarsAvailable: 2,
      });
    });
  });

  describe("proxysql_runtime_status", () => {
    it("should return version and admin variables", async () => {
      mockQuery
        .mockResolvedValueOnce([[{ variable_value: "3.0.3" }]])
        .mockResolvedValueOnce([
          [{ variable_name: "admin-read_only", variable_value: "false" }],
        ]);

      const tool = tools.find((t) => t.name === "proxysql_runtime_status")!;
      const result = await tool.handler({}, mockContext);

      expect(mockQuery).toHaveBeenCalledWith(
        "SELECT variable_value FROM global_variables WHERE variable_name = 'admin-version'",
      );
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("version", "3.0.3");
    });

    it("should handle missing version", async () => {
      mockQuery.mockResolvedValueOnce([[{}]]).mockResolvedValueOnce([[]]);

      const tool = tools.find((t) => t.name === "proxysql_runtime_status")!;
      const result = await tool.handler({}, mockContext);

      expect(result).toHaveProperty("version", "unknown");
    });

    it("should redact sensitive admin variables", async () => {
      mockQuery
        .mockResolvedValueOnce([[{ variable_value: "3.0.3" }]])
        .mockResolvedValueOnce([
          [
            { variable_name: "admin-read_only", variable_value: "false" },
            {
              variable_name: "admin-admin_credentials",
              variable_value: "admin:admin",
            },
            {
              variable_name: "admin-cluster_password",
              variable_value: "secret123",
            },
          ],
        ]);

      const tool = tools.find((t) => t.name === "proxysql_runtime_status")!;
      const result = (await tool.handler({}, mockContext)) as {
        adminVariables: { variable_name: string; variable_value: string }[];
      };

      const credVar = result.adminVariables.find(
        (v) => v.variable_name === "admin-admin_credentials",
      );
      expect(credVar?.variable_value).toBe("********");

      const pwVar = result.adminVariables.find(
        (v) => v.variable_name === "admin-cluster_password",
      );
      expect(pwVar?.variable_value).toBe("********");

      const safeVar = result.adminVariables.find(
        (v) => v.variable_name === "admin-read_only",
      );
      expect(safeVar?.variable_value).toBe("false");
    });
  });

  describe("proxysql_servers", () => {
    it("should list all servers without hostgroup filter", async () => {
      const mockServers = [
        { hostgroup_id: 1, hostname: "mysql1", port: 3306, status: "ONLINE" },
        { hostgroup_id: 2, hostname: "mysql2", port: 3306, status: "ONLINE" },
      ];
      mockQuery.mockResolvedValue([mockServers]);

      const tool = tools.find((t) => t.name === "proxysql_servers")!;
      const result = await tool.handler({}, mockContext);

      expect(mockQuery).toHaveBeenCalledWith("SELECT * FROM mysql_servers");
      expect(result).toEqual({
        success: true,
        servers: mockServers,
        count: 2,
      });
    });

    it("should filter by hostgroup_id when provided", async () => {
      const mockServers = [{ hostgroup_id: 1, hostname: "mysql1", port: 3306 }];
      mockQuery.mockResolvedValue([mockServers]);

      const tool = tools.find((t) => t.name === "proxysql_servers")!;
      const result = await tool.handler({ hostgroup_id: 1 }, mockContext);

      expect(mockQuery).toHaveBeenCalledWith(
        "SELECT * FROM mysql_servers WHERE hostgroup_id = 1",
      );
      expect(result).toHaveProperty("count", 1);
    });
  });

  describe("proxysql_hostgroups", () => {
    it("should return connection pool stats", async () => {
      const mockPools = [
        { hostgroup: 1, srv_host: "mysql1", ConnUsed: 5, ConnFree: 10 },
      ];
      mockQuery.mockResolvedValue([mockPools]);

      const tool = tools.find((t) => t.name === "proxysql_hostgroups")!;
      const result = await tool.handler({}, mockContext);

      expect(mockQuery).toHaveBeenCalledWith(
        "SELECT * FROM stats_mysql_connection_pool",
      );
      expect(result).toEqual({
        success: true,
        hostgroups: mockPools,
        count: 1,
      });
    });
  });

  describe("proxysql_query_rules", () => {
    it("should return query rules with default limit", async () => {
      const mockRules = [{ rule_id: 1, match_pattern: "SELECT.*" }];
      mockQuery.mockResolvedValue([mockRules]);

      const tool = tools.find((t) => t.name === "proxysql_query_rules")!;
      const result = await tool.handler({}, mockContext);

      expect(mockQuery).toHaveBeenCalledWith(
        "SELECT * FROM mysql_query_rules LIMIT 100",
      );
      expect(result).toHaveProperty("queryRules", mockRules);
    });

    it("should respect custom limit", async () => {
      mockQuery.mockResolvedValue([[]]);

      const tool = tools.find((t) => t.name === "proxysql_query_rules")!;
      await tool.handler({ limit: 10 }, mockContext);

      expect(mockQuery).toHaveBeenCalledWith(
        "SELECT * FROM mysql_query_rules LIMIT 10",
      );
    });
  });

  describe("proxysql_query_digest", () => {
    it("should return top queries by count", async () => {
      const mockDigests = [
        {
          digest: "abc123",
          digest_text: "SELECT ?",
          count_star: 1000,
          sum_time: 5000,
        },
      ];
      mockQuery.mockResolvedValue([mockDigests]);

      const tool = tools.find((t) => t.name === "proxysql_query_digest")!;
      const result = await tool.handler({}, mockContext);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("ORDER BY count_star DESC"),
      );
      expect(result).toHaveProperty("queryDigests", mockDigests);
    });

    it("should respect custom limit", async () => {
      mockQuery.mockResolvedValue([[]]);

      const tool = tools.find((t) => t.name === "proxysql_query_digest")!;
      await tool.handler({ limit: 25 }, mockContext);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("LIMIT 25"),
      );
    });
  });

  describe("proxysql_connection_pool", () => {
    it("should return all connection pools", async () => {
      const mockPools = [{ hostgroup: 1, srv_host: "localhost" }];
      mockQuery.mockResolvedValue([mockPools]);

      const tool = tools.find((t) => t.name === "proxysql_connection_pool")!;
      const result = await tool.handler({}, mockContext);

      expect(mockQuery).toHaveBeenCalledWith(
        "SELECT * FROM stats_mysql_connection_pool",
      );
      expect(result).toHaveProperty("connectionPools", mockPools);
    });

    it("should filter by hostgroup", async () => {
      mockQuery.mockResolvedValue([[]]);

      const tool = tools.find((t) => t.name === "proxysql_connection_pool")!;
      await tool.handler({ hostgroup_id: 2 }, mockContext);

      expect(mockQuery).toHaveBeenCalledWith(
        "SELECT * FROM stats_mysql_connection_pool WHERE hostgroup = 2",
      );
    });
  });

  describe("proxysql_users", () => {
    it("should return users without passwords", async () => {
      const mockUsers = [
        { username: "app_user", active: 1, default_hostgroup: 1 },
      ];
      mockQuery.mockResolvedValue([mockUsers]);

      const tool = tools.find((t) => t.name === "proxysql_users")!;
      const result = await tool.handler({}, mockContext);

      // Should not include password column
      expect(mockQuery).toHaveBeenCalledWith(
        expect.not.stringContaining("password"),
      );
      expect(result).toHaveProperty("users", mockUsers);
    });
  });

  describe("proxysql_global_variables", () => {
    it("should return all variables by default", async () => {
      const mockVars = [
        { variable_name: "mysql-threads", variable_value: "4" },
      ];
      mockQuery.mockResolvedValue([mockVars]);

      const tool = tools.find((t) => t.name === "proxysql_global_variables")!;
      const result = await tool.handler({}, mockContext);

      expect(mockQuery).toHaveBeenCalledWith(
        "SELECT * FROM global_variables LIMIT 200",
      );
      expect(result).toHaveProperty("variables", mockVars);
    });

    it("should filter by mysql prefix", async () => {
      mockQuery.mockResolvedValue([[]]);

      const tool = tools.find((t) => t.name === "proxysql_global_variables")!;
      await tool.handler({ prefix: "mysql" }, mockContext);

      expect(mockQuery).toHaveBeenCalledWith(
        "SELECT * FROM global_variables WHERE variable_name LIKE 'mysql-%' LIMIT 200",
      );
    });

    it("should filter by admin prefix", async () => {
      mockQuery.mockResolvedValue([[]]);

      const tool = tools.find((t) => t.name === "proxysql_global_variables")!;
      await tool.handler({ prefix: "admin" }, mockContext);

      expect(mockQuery).toHaveBeenCalledWith(
        "SELECT * FROM global_variables WHERE variable_name LIKE 'admin-%' LIMIT 200",
      );
    });

    it("should respect custom limit", async () => {
      mockQuery.mockResolvedValue([[]]);

      const tool = tools.find((t) => t.name === "proxysql_global_variables")!;
      await tool.handler({ limit: 50 }, mockContext);

      expect(mockQuery).toHaveBeenCalledWith(
        "SELECT * FROM global_variables LIMIT 50",
      );
    });

    it("should redact sensitive credential variables", async () => {
      const mockVars = [
        { variable_name: "mysql-threads", variable_value: "4" },
        {
          variable_name: "admin-admin_credentials",
          variable_value: "admin:admin",
        },
        {
          variable_name: "mysql-monitor_password",
          variable_value: "monpass",
        },
        {
          variable_name: "admin-stats_credentials",
          variable_value: "stats:stats",
        },
      ];
      mockQuery.mockResolvedValue([mockVars]);

      const tool = tools.find((t) => t.name === "proxysql_global_variables")!;
      const result = (await tool.handler({}, mockContext)) as {
        variables: { variable_name: string; variable_value: string }[];
      };

      // Non-sensitive should be preserved
      const threads = result.variables.find(
        (v) => v.variable_name === "mysql-threads",
      );
      expect(threads?.variable_value).toBe("4");

      // Sensitive should be redacted
      const creds = result.variables.find(
        (v) => v.variable_name === "admin-admin_credentials",
      );
      expect(creds?.variable_value).toBe("********");

      const monPw = result.variables.find(
        (v) => v.variable_name === "mysql-monitor_password",
      );
      expect(monPw?.variable_value).toBe("********");

      const statsCreds = result.variables.find(
        (v) => v.variable_name === "admin-stats_credentials",
      );
      expect(statsCreds?.variable_value).toBe("********");
    });
  });

  describe("proxysql_memory_stats", () => {
    it("should return memory metrics", async () => {
      const mockMemory = [
        { Variable_Name: "SQLite3_memory_bytes", Variable_Value: "1048576" },
      ];
      mockQuery.mockResolvedValue([mockMemory]);

      const tool = tools.find((t) => t.name === "proxysql_memory_stats")!;
      const result = await tool.handler({}, mockContext);

      expect(mockQuery).toHaveBeenCalledWith(
        "SELECT * FROM stats_memory_metrics",
      );
      expect(result).toEqual({
        success: true,
        memoryStats: mockMemory,
      });
    });
  });

  describe("proxysql_commands", () => {
    it("should execute admin command", async () => {
      mockQuery.mockResolvedValue([]);

      const tool = tools.find((t) => t.name === "proxysql_commands")!;
      const result = await tool.handler(
        { command: "LOAD MYSQL USERS TO RUNTIME" },
        mockContext,
      );

      expect(mockQuery).toHaveBeenCalledWith("LOAD MYSQL USERS TO RUNTIME");
      expect(result).toEqual({
        success: true,
        command: "LOAD MYSQL USERS TO RUNTIME",
        message: "Command executed: LOAD MYSQL USERS TO RUNTIME",
      });
    });
  });

  describe("proxysql_process_list", () => {
    it("should return active processes", async () => {
      const mockProcesses = [
        { ThreadID: 1, user: "app", db: "test", command: "Query" },
      ];
      mockQuery.mockResolvedValue([mockProcesses]);

      const tool = tools.find((t) => t.name === "proxysql_process_list")!;
      const result = await tool.handler({}, mockContext);

      expect(mockQuery).toHaveBeenCalledWith(
        "SELECT * FROM stats_mysql_processlist",
      );
      expect(result).toEqual({
        success: true,
        processes: mockProcesses,
        count: 1,
      });
    });
  });
});

describe("Connection Error Handling", () => {
  let tools: ReturnType<typeof getProxySQLTools>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    tools = getProxySQLTools(
      createMockMySQLAdapter() as unknown as MySQLAdapter,
    );
    mockContext = createMockRequestContext();
  });

  it("should propagate connection errors", async () => {
    mockCreateConnection.mockRejectedValue(new Error("Connection refused"));

    const tool = tools.find((t) => t.name === "proxysql_status")!;

    await expect(tool.handler({}, mockContext)).rejects.toThrow(
      "Connection refused",
    );
  });

  it("should propagate query errors", async () => {
    mockCreateConnection.mockResolvedValue({
      query: vi.fn().mockRejectedValue(new Error("Access denied")),
      end: mockEnd,
    });

    const tool = tools.find((t) => t.name === "proxysql_status")!;

    await expect(tool.handler({}, mockContext)).rejects.toThrow(
      "Access denied",
    );
  });
});
