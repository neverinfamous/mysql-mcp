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
      const tool = tools.find((t) => t.name === "mysql_role_revoke")!;
      await tool.handler(
        { role: "test_role", user: "testuser", host: "localhost" },
        mockContext,
      );

      expect(mockAdapter.rawQuery).toHaveBeenCalled();
      const call = mockAdapter.rawQuery.mock.calls[0][0] as string;
      expect(call).toContain("REVOKE");
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
      expect(call).toContain("role_edges");
    });
  });
});
