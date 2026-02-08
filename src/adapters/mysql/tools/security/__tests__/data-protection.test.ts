/**
 * mysql-mcp - Security Data Protection Tools Unit Tests
 *
 * Comprehensive tests for data-protection.ts module functions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createSecurityMaskDataTool,
  createSecurityUserPrivilegesTool,
  createSecuritySensitiveTablesTool,
} from "../data-protection.js";
import type { MySQLAdapter } from "../../../MySQLAdapter.js";
import {
  createMockMySQLAdapter,
  createMockRequestContext,
  createMockQueryResult,
} from "../../../../../__tests__/mocks/index.js";

describe("Security Data Protection Tools", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    mockContext = createMockRequestContext();
  });

  describe("createSecurityMaskDataTool", () => {
    it("should mask email addresses", async () => {
      const tool = createSecurityMaskDataTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        {
          value: "john.doe@example.com",
          type: "email",
        },
        mockContext,
      )) as { masked: string };

      expect(result.masked).toBe("j******e@example.com");
    });

    it("should mask phone numbers", async () => {
      const tool = createSecurityMaskDataTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        {
          value: "555-123-4567",
          type: "phone",
        },
        mockContext,
      )) as { masked: string };

      expect(result.masked).toBe("******4567");
    });

    it("should mask partial text", async () => {
      const tool = createSecurityMaskDataTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        {
          value: "sensitive data",
          type: "partial",
          keepFirst: 2,
          keepLast: 2,
        },
        mockContext,
      )) as { masked: string };

      expect(result.masked).toBe("se**********ta");
    });
  });

  describe("createSecurityUserPrivilegesTool", () => {
    it("should get user privileges and roles", async () => {
      // Mock P154 user existence pre-check
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([{ User: "john", Host: "localhost" }]),
      );

      // Mock users query
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([
          {
            User: "john",
            Host: "localhost",
            authPlugin: "native",
            accountLocked: "N",
            passwordExpired: "N",
          },
        ]),
      );

      // Mock permissions query for john
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([
          {
            "Grants for john@localhost":
              "GRANT ALL PRIVILEGES ON *.* TO 'john'@'localhost'",
          },
        ]),
      );

      // Mock roles query
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([{ FROM_USER: "admin_role", FROM_HOST: "%" }]),
      );

      const tool = createSecurityUserPrivilegesTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        {
          user: "john",
        },
        mockContext,
      )) as { users: any[] };

      expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(4);
      expect(result.users).toHaveLength(1);
      expect(result.users[0].user).toBe("john");
      expect(result.users[0].grants).toHaveLength(1);
      expect(result.users[0].roles).toContain("admin_role@%");
    });
  });

  describe("createSecuritySensitiveTablesTool", () => {
    it("should identify sensitive tables", async () => {
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([
          {
            tableName: "users",
            columnName: "password_hash",
            dataType: "varchar",
          },
          { tableName: "users", columnName: "email", dataType: "varchar" },
          {
            tableName: "payments",
            columnName: "credit_card",
            dataType: "varchar",
          },
        ]),
      );

      const tool = createSecuritySensitiveTablesTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        {
          schema: "test_db",
        },
        mockContext,
      )) as { sensitiveTables: any[]; totalSensitiveColumns: number };

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      expect(result.sensitiveTables).toHaveLength(2); // users, payments
      expect(result.totalSensitiveColumns).toBe(3);
      expect(result.sensitiveTables[0].table).toBe("users");
      expect(result.sensitiveTables[0].sensitiveColumns).toHaveLength(2);
    });
  });
});
