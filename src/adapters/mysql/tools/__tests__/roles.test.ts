/**
 * mysql-mcp - Roles Tools Unit Tests
 *
 * Tests for roles tool definitions and annotations.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { getRoleTools } from "../roles.js";
import type { MySQLAdapter } from "../../MySQLAdapter.js";
import {
  createMockMySQLAdapter,
  createMockRequestContext,
  createMockQueryResult,
} from "../../../../__tests__/mocks/index.js";

describe("getRoleTools", () => {
  let tools: ReturnType<typeof getRoleTools>;

  beforeEach(() => {
    vi.clearAllMocks();
    tools = getRoleTools(createMockMySQLAdapter() as unknown as MySQLAdapter);
  });

  it("should return 8 role tools", () => {
    expect(tools).toHaveLength(8);
  });

  it("should have roles group for all tools", () => {
    for (const tool of tools) {
      expect(tool.group).toBe("roles");
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
});

describe("Handler Execution", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let tools: ReturnType<typeof getRoleTools>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    tools = getRoleTools(mockAdapter as unknown as MySQLAdapter);
    mockContext = createMockRequestContext();
  });

  describe("mysql_role_list", () => {
    it("should list roles", async () => {
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([{ ROLE_NAME: "admin_role" }]),
      );

      const tool = tools.find((t) => t.name === "mysql_role_list")!;
      await tool.handler({}, mockContext);

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
    });

    it("should list roles with pattern", async () => {
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([{ ROLE_NAME: "admin_role" }]),
      );

      const tool = tools.find((t) => t.name === "mysql_role_list")!;
      await tool.handler({ pattern: "admin%" }, mockContext);

      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain("LIKE 'admin%'");
    });
  });

  describe("mysql_role_create", () => {
    it("should create a role with IF NOT EXISTS default", async () => {
      const tool = tools.find((t) => t.name === "mysql_role_create")!;
      await tool.handler({ name: "test_role" }, mockContext);

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain("CREATE ROLE IF NOT EXISTS");
    });

    it("should create a role without IF NOT EXISTS", async () => {
      const tool = tools.find((t) => t.name === "mysql_role_create")!;
      await tool.handler(
        { name: "test_role", ifNotExists: false },
        mockContext,
      );

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain("CREATE ROLE 'test_role'");
    });

    it("should reject invalid role names", async () => {
      const tool = tools.find((t) => t.name === "mysql_role_create")!;
      await expect(
        tool.handler({ name: "invalid-role" }, mockContext),
      ).rejects.toThrow("Invalid role name");
    });
  });

  describe("mysql_role_grant", () => {
    it("should grant privileges to role", async () => {
      const tool = tools.find((t) => t.name === "mysql_role_grant")!;
      await tool.handler(
        {
          role: "test_role",
          privileges: ["SELECT"],
          database: "testdb",
          table: "*",
        },
        mockContext,
      );

      expect(mockAdapter.rawQuery).toHaveBeenCalled();
      const call = mockAdapter.rawQuery.mock.calls[0][0] as string;
      expect(call).toContain("GRANT SELECT ON `testdb`.* TO 'test_role'");
    });

    it("should handle schema-qualified table name", async () => {
      const tool = tools.find((t) => t.name === "mysql_role_grant")!;
      await tool.handler(
        { role: "test_role", privileges: ["SELECT"], table: "testdb.mytable" },
        mockContext,
      );

      expect(mockAdapter.rawQuery).toHaveBeenCalled();
      const call = mockAdapter.rawQuery.mock.calls[0][0] as string;
      expect(call).toContain(
        "GRANT SELECT ON `testdb`.`mytable` TO 'test_role'",
      );
    });

    it("should reject invalid role names", async () => {
      const tool = tools.find((t) => t.name === "mysql_role_grant")!;
      await expect(
        tool.handler(
          { role: "invalid-role", privileges: ["SELECT"] },
          mockContext,
        ),
      ).rejects.toThrow("Invalid role name");
    });
  });

  describe("mysql_role_revoke", () => {
    it("should revoke role from user", async () => {
      // 1: role exists check; 2: user exists check; 3: role_edges assignment check
      mockAdapter.executeQuery
        .mockResolvedValueOnce(createMockQueryResult([{ "1": 1 }]))
        .mockResolvedValueOnce(createMockQueryResult([{ "1": 1 }]))
        .mockResolvedValueOnce(createMockQueryResult([{ "1": 1 }]));

      const tool = tools.find((t) => t.name === "mysql_role_revoke")!;
      await tool.handler(
        { role: "test_role", user: "testuser", host: "localhost" },
        mockContext,
      );

      expect(mockAdapter.rawQuery).toHaveBeenCalled();
      const call = mockAdapter.rawQuery.mock.calls[0][0] as string;
      expect(call).toContain("REVOKE");
    });

    it("should return graceful error when role is not assigned", async () => {
      // 1: role exists; 2: user exists; 3: role_edges returns empty
      mockAdapter.executeQuery
        .mockResolvedValueOnce(createMockQueryResult([{ "1": 1 }]))
        .mockResolvedValueOnce(createMockQueryResult([{ "1": 1 }]))
        .mockResolvedValueOnce(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_role_revoke")!;
      const result = await tool.handler(
        { role: "test_role", user: "testuser", host: "localhost" },
        mockContext,
      );

      expect(result).toEqual({
        success: false,
        role: "test_role",
        user: "testuser",
        host: "localhost",
        reason:
          "Role 'test_role' is not assigned to user 'testuser'@'localhost'",
      });
      expect(mockAdapter.rawQuery).not.toHaveBeenCalled();
    });
  });

  describe("mysql_role_drop", () => {
    it("should drop a role with IF EXISTS default", async () => {
      const tool = tools.find((t) => t.name === "mysql_role_drop")!;
      await tool.handler({ name: "test_role" }, mockContext);

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain("DROP ROLE IF EXISTS");
    });

    it("should drop a role without IF EXISTS", async () => {
      const tool = tools.find((t) => t.name === "mysql_role_drop")!;
      await tool.handler({ name: "test_role", ifExists: false }, mockContext);

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain("DROP ROLE 'test_role'");
    });

    it("should reject invalid role names", async () => {
      const tool = tools.find((t) => t.name === "mysql_role_drop")!;
      await expect(
        tool.handler({ name: "invalid-role" }, mockContext),
      ).rejects.toThrow("Invalid role name");
    });
  });

  describe("mysql_role_assign", () => {
    it("should assign role to user", async () => {
      const tool = tools.find((t) => t.name === "mysql_role_assign")!;
      await tool.handler(
        { role: "test_role", user: "testuser", host: "localhost" },
        mockContext,
      );

      expect(mockAdapter.rawQuery).toHaveBeenCalled();
      const call = mockAdapter.rawQuery.mock.calls[0][0] as string;
      expect(call).toContain("GRANT");
    });

    it("should assign role with admin option", async () => {
      const tool = tools.find((t) => t.name === "mysql_role_assign")!;
      await tool.handler(
        {
          role: "test_role",
          user: "testuser",
          host: "localhost",
          withAdminOption: true,
        },
        mockContext,
      );

      const call = mockAdapter.rawQuery.mock.calls[0][0] as string;
      expect(call).toContain("WITH ADMIN OPTION");
    });
  });

  describe("mysql_role_grants", () => {
    it("should list grants for a role", async () => {
      mockAdapter.rawQuery.mockResolvedValue(
        createMockQueryResult([{ Grants: "SELECT ON *.*" }]),
      );

      const tool = tools.find((t) => t.name === "mysql_role_grants")!;
      await tool.handler({ role: "test_role" }, mockContext);

      expect(mockAdapter.rawQuery).toHaveBeenCalled();
      const call = mockAdapter.rawQuery.mock.calls[0][0] as string;
      expect(call).toContain("SHOW GRANTS");
    });
  });

  describe("mysql_user_roles", () => {
    it("should list roles assigned to user", async () => {
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([{ roleName: "admin_role", roleHost: "%" }]),
      );

      const tool = tools.find((t) => t.name === "mysql_user_roles")!;
      await tool.handler({ user: "testuser", host: "localhost" }, mockContext);

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain("mysql.user");
    });

    it("should return exists: false for nonexistent user", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_user_roles")!;
      const result = await tool.handler(
        { user: "nonexistent", host: "%" },
        mockContext,
      );

      expect(result).toEqual({
        user: "nonexistent",
        host: "%",
        exists: false,
      });
    });
  });

  describe("mysql_role_create - error handling", () => {
    it("should return graceful error for duplicate role", async () => {
      mockAdapter.executeQuery.mockRejectedValue(
        new Error("Operation CREATE ROLE failed for 'test_role'@'%'"),
      );

      const tool = tools.find((t) => t.name === "mysql_role_create")!;
      const result = await tool.handler(
        { name: "test_role", ifNotExists: false },
        mockContext,
      );

      expect(result).toEqual({
        success: false,
        reason: "Role 'test_role' already exists",
      });
    });
  });

  describe("mysql_role_drop - error handling", () => {
    it("should return graceful error for nonexistent role", async () => {
      mockAdapter.executeQuery.mockRejectedValue(
        new Error("Operation DROP ROLE failed for 'test_role'@'%'"),
      );

      const tool = tools.find((t) => t.name === "mysql_role_drop")!;
      const result = await tool.handler(
        { name: "test_role", ifExists: false },
        mockContext,
      );

      expect(result).toEqual({
        success: false,
        reason: "Role 'test_role' does not exist",
      });
    });
  });

  describe("mysql_role_assign - error handling", () => {
    it("should return graceful error for nonexistent user", async () => {
      // Role exists check succeeds
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([{ "1": 1 }]),
      );
      // GRANT rawQuery fails with unknown user
      mockAdapter.rawQuery.mockRejectedValue(
        new Error("Unknown authorization ID `baduser`@`%`"),
      );

      const tool = tools.find((t) => t.name === "mysql_role_assign")!;
      const result = await tool.handler(
        { role: "test_role", user: "baduser", host: "%" },
        mockContext,
      );

      expect(result).toEqual({
        success: false,
        role: "test_role",
        user: "baduser",
        host: "%",
        error: "User does not exist",
      });
    });
  });

  describe("mysql_role_revoke - error handling", () => {
    it("should return graceful error for nonexistent user", async () => {
      // 1: role exists; 2: user does NOT exist
      mockAdapter.executeQuery
        .mockResolvedValueOnce(createMockQueryResult([{ "1": 1 }]))
        .mockResolvedValueOnce(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_role_revoke")!;
      const result = await tool.handler(
        { role: "test_role", user: "baduser", host: "%" },
        mockContext,
      );

      expect(result).toEqual({
        success: false,
        role: "test_role",
        user: "baduser",
        host: "%",
        error: "User does not exist",
      });
      expect(mockAdapter.rawQuery).not.toHaveBeenCalled();
    });
  });

  describe("mysql_role_grant - error handling", () => {
    it("should return graceful error for nonexistent table", async () => {
      // Role exists check succeeds
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([{ "1": 1 }]),
      );
      // GRANT rawQuery fails with table not found
      mockAdapter.rawQuery.mockRejectedValue(
        new Error("Table 'testdb.nonexistent' doesn't exist"),
      );

      const tool = tools.find((t) => t.name === "mysql_role_grant")!;
      const result = await tool.handler(
        {
          role: "test_role",
          privileges: ["SELECT"],
          database: "testdb",
          table: "nonexistent",
        },
        mockContext,
      );

      expect(result).toEqual({
        success: false,
        role: "test_role",
        error: "Table 'testdb.nonexistent' doesn't exist",
      });
    });
  });
});
