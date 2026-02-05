/**
 * mysql-mcp - Sys Schema Activity Tools Unit Tests
 *
 * Comprehensive tests for activity.ts module functions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createSysUserSummaryTool,
  createSysHostSummaryTool,
} from "../activity.js";
import type { MySQLAdapter } from "../../../MySQLAdapter.js";
import {
  createMockMySQLAdapter,
  createMockRequestContext,
  createMockQueryResult,
} from "../../../../../__tests__/mocks/index.js";

describe("Sys Schema Activity Tools", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    mockContext = createMockRequestContext();
  });

  describe("createSysUserSummaryTool", () => {
    it("should create tool with correct definition", () => {
      const tool = createSysUserSummaryTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      expect(tool.name).toBe("mysql_sys_user_summary");
      expect(tool.group).toBe("sysschema");
    });

    it("should query user summary", async () => {
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([
          {
            user: "root",
            statements: 100,
          },
        ]),
      );

      const tool = createSysUserSummaryTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({ limit: 10 }, mockContext)) as {
        users: unknown[];
      };

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      expect(result.users).toHaveLength(1);
    });

    it("should filter by user", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createSysUserSummaryTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      await tool.handler({ user: "specific_user" }, mockContext);

      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain("WHERE user = ?");
      const args = mockAdapter.executeQuery.mock.calls[0][1] as unknown[];
      expect(args).toContain("specific_user");
    });
  });

  describe("createSysHostSummaryTool", () => {
    it("should create tool with correct definition", () => {
      const tool = createSysHostSummaryTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      expect(tool.name).toBe("mysql_sys_host_summary");
    });

    it("should query host summary", async () => {
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([
          {
            host: "localhost",
            statements: 100,
          },
        ]),
      );

      const tool = createSysHostSummaryTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({}, mockContext)) as {
        hosts: unknown[];
      };

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      expect(result.hosts).toHaveLength(1);
    });

    it("should filter by host", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createSysHostSummaryTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      await tool.handler({ host: "127.0.0.1" }, mockContext);

      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain("WHERE host = ?");
      const args = mockAdapter.executeQuery.mock.calls[0][1] as unknown[];
      expect(args).toContain("127.0.0.1");
    });
  });
});
