/**
 * mysql-mcp - Security Audit Tools Unit Tests
 *
 * Comprehensive tests for audit.ts module functions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createSecurityAuditTool,
  createSecurityFirewallStatusTool,
  createSecurityFirewallRulesTool,
} from "../audit.js";
import type { MySQLAdapter } from "../../../MySQLAdapter.js";
import {
  createMockMySQLAdapter,
  createMockRequestContext,
  createMockQueryResult,
} from "../../../../../__tests__/mocks/index.js";

describe("Security Audit Tools", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    mockContext = createMockRequestContext();
  });

  describe("createSecurityAuditTool", () => {
    it("should query mysql.audit_log if available", async () => {
      // Mock table check
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([{ TABLE_NAME: "audit_log" }]),
      );

      // Mock log query
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([{ user: "test", event_type: "LOGIN" }]),
      );

      const tool = createSecurityAuditTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        {
          limit: 10,
          user: "test",
        },
        mockContext,
      )) as { source: string; events: any[] };

      expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(2);
      expect(result.source).toBe("mysql.audit_log");
      expect(result.events).toHaveLength(1);

      const queryCall = mockAdapter.executeQuery.mock.calls[1][0] as string;
      expect(queryCall).toContain("FROM mysql.audit_log");
      expect(queryCall).toContain("WHERE user LIKE ?");
      expect(queryCall).toContain("WHERE user LIKE ?");
    });

    it("should apply all filters in normal mode", async () => {
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([{ TABLE_NAME: "audit_log" }]),
      );
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

      const tool = createSecurityAuditTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      await tool.handler(
        {
          limit: 10,
          user: "test",
          eventType: "LOGIN",
          startTime: "2023-01-01",
        },
        mockContext,
      );

      const queryCall = mockAdapter.executeQuery.mock.calls[1][0] as string;
      const queryParams = mockAdapter.executeQuery.mock.calls[1][1] as any[];

      expect(queryCall).toContain("user LIKE ?");
      expect(queryCall).toContain("event_type = ?");
      expect(queryCall).toContain("timestamp >= ?");
      expect(queryParams).toHaveLength(4);
    });

    it("should fallback to performance_schema if audit_log is missing", async () => {
      // Mock table check - empty result
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

      // Mock fallback query
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([{ event: "select" }]),
      );

      const tool = createSecurityAuditTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        {
          limit: 10,
        },
        mockContext,
      )) as { source: string };

      expect(result.source).toBe("performance_schema");

      const queryCall = mockAdapter.executeQuery.mock.calls[1][0] as string;
      expect(queryCall).toContain(
        "FROM performance_schema.events_statements_history",
      );
      expect(queryCall).toContain(
        "FROM performance_schema.events_statements_history",
      );
    });

    it("should apply user filter in fallback mode", async () => {
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([])); // No audit log
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

      const tool = createSecurityAuditTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      await tool.handler(
        {
          limit: 10,
          user: "test_user",
        },
        mockContext,
      );

      const queryCall = mockAdapter.executeQuery.mock.calls[1][0] as string;

      expect(queryCall).toContain("t.PROCESSLIST_USER LIKE '%test_user%'");
    });

    it("should apply eventType filter in fallback mode", async () => {
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([])); // No audit log
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

      const tool = createSecurityAuditTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      await tool.handler(
        {
          limit: 10,
          eventType: "CONNECT",
        },
        mockContext,
      );

      const queryCall = mockAdapter.executeQuery.mock.calls[1][0] as string;

      expect(queryCall).toContain("e.EVENT_NAME LIKE '%CONNECT%'");
    });

    it("should include filtersIgnored when startTime used in fallback mode", async () => {
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([])); // No audit log
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

      const tool = createSecurityAuditTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        {
          limit: 10,
          startTime: "2023-01-01",
        },
        mockContext,
      )) as { filtersIgnored?: string[]; note?: string };

      expect(result.filtersIgnored).toEqual(["startTime"]);
      expect(result.note).toContain("picosecond");
    });

    it("should return structured error for non-audit failures", async () => {
      mockAdapter.executeQuery.mockRejectedValue(
        new Error("Connection lost to host"),
      );

      const tool = createSecurityAuditTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({}, mockContext)) as {
        success: boolean;
        error: string;
      };

      expect(result.success).toBe(false);
      expect(result.error).toBe("Connection lost to host");
    });

    it("should handle error when checking audit log", async () => {
      mockAdapter.executeQuery.mockRejectedValue(new Error("Access denied"));

      const tool = createSecurityAuditTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({}, mockContext)) as {
        available: boolean;
      };

      expect(result.available).toBe(false);
    });
  });

  describe("createSecurityFirewallStatusTool", () => {
    it("should check firewall status when installed", async () => {
      // Mock plugin check
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([
          { PLUGIN_NAME: "mysql_firewall", PLUGIN_STATUS: "ACTIVE" },
        ]),
      );

      // Mock variables check
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([
          { Variable_name: "mysql_firewall_mode", Value: "ON" },
        ]),
      );

      const tool = createSecurityFirewallStatusTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({}, mockContext)) as {
        installed: boolean;
        configuration: any;
      };

      expect(result.installed).toBe(true);
      expect(result.configuration).toHaveProperty("mysql_firewall_mode", "ON");
    });

    it("should report not installed if plugin missing", async () => {
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

      const tool = createSecurityFirewallStatusTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({}, mockContext)) as {
        installed: boolean;
      };

      expect(result.installed).toBe(false);
    });
  });

  describe("createSecurityFirewallRulesTool", () => {
    it("should list firewall rules", async () => {
      // Mock users query
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([{ USERHOST: "user@%", MODE: "PROTECTING" }]),
      );

      // Mock rules query
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([{ USERHOST: "user@%", RULE: "SELECT *" }]),
      );

      const tool = createSecurityFirewallRulesTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        {
          user: "user",
        },
        mockContext,
      )) as { users: any[]; rules: any[] };

      expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(2);
      expect(result.users).toHaveLength(1);
      expect(result.rules).toHaveLength(1);
    });

    it("should handle errors gracefully", async () => {
      mockAdapter.executeQuery.mockRejectedValue(new Error("Table missing"));

      const tool = createSecurityFirewallRulesTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({}, mockContext)) as {
        available: boolean;
      };

      expect(result.available).toBe(false);
    });
  });
});
