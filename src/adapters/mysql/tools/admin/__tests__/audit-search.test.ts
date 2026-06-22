import { describe, it, expect, vi, beforeEach } from "vitest";
import { createAuditSearchTool } from "../audit-search.js";

describe("Audit Search Tool", () => {
  let mockAdapter: any;
  let mockAuditLogger: any;
  let mockContext: any;

  beforeEach(() => {
    mockAuditLogger = {
      search: vi.fn(),
    };
    mockAdapter = {
      getAuditLogger: vi.fn(() => mockAuditLogger),
    };
    mockContext = { connectionId: "test" };
  });

  describe("mysql_audit_search", () => {
    it("should return search results from auditLogger", async () => {
      mockAuditLogger.search.mockResolvedValue({
        entries: [{ tool: "mysql_write_query", success: true }],
        totalCount: 1,
      });
      const tool = createAuditSearchTool(mockAdapter);
      const result = await tool.handler({}, mockContext);
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("data.entries.length", 1);
      expect(result).toHaveProperty("data.totalCount", 1);
      expect(mockAuditLogger.search).toHaveBeenCalledWith({
        limit: 5,
        offset: 0,
      });
    });

    it("should pass filters to auditLogger", async () => {
      mockAuditLogger.search.mockResolvedValue({
        entries: [],
        totalCount: 0,
      });
      const tool = createAuditSearchTool(mockAdapter);
      const result = await tool.handler(
        { tool: "test_tool", success: false, limit: 10 },
        mockContext,
      );
      expect(result).toHaveProperty("success", true);
      expect(mockAuditLogger.search).toHaveBeenCalledWith({
        tool: "test_tool",
        success: false,
        limit: 10,
        offset: 0,
      });
    });

    it("should handle missing auditLogger", async () => {
      mockAdapter.getAuditLogger.mockReturnValue(null);
      const tool = createAuditSearchTool(mockAdapter);
      const result = await tool.handler({}, mockContext);
      expect(result).toHaveProperty("success", false);
      expect(result).toHaveProperty("error", "Audit Logger is not enabled or available");
    });

    it("should return validation error on invalid params", async () => {
      const tool = createAuditSearchTool(mockAdapter);
      const result = await tool.handler(
        { limit: -1 }, // Invalid limit
        mockContext,
      );
      expect(result).toHaveProperty("success", false);
      expect(result).toHaveProperty("error");
    });
  });
});
