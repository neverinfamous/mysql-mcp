import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerHelpResources, registerAuditResource, registerObservabilityResource } from "../resources.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { metrics } from "../../../observability/metrics.js";
import { HELP_CONTENT } from "../../../constants/server-instructions.js";


vi.mock("../../../observability/metrics.js", () => ({
  metrics: {
    recordResourceRead: vi.fn(),
    getSummary: vi.fn().mockReturnValue({ totalRequests: 5 }),
  },
}));

vi.mock("../../../utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
  },
}));

describe("mcp-server resources", () => {
  let mcpServer: McpServer;

  beforeEach(() => {
    mcpServer = new McpServer({ name: "test", version: "1.0.0" });
    vi.spyOn(mcpServer, "registerResource").mockImplementation(() => {});
    vi.clearAllMocks();
  });

  describe("registerHelpResources", () => {
    it("should register base help resource and enabled group resources", () => {
      // Mock HELP_CONTENT to have some values
      const getSpy = vi.spyOn(HELP_CONTENT, "get");
      getSpy.mockImplementation((key) => {
        if (key === "gotchas") return "Gotchas content";
        if (key === "core") return "Core content";
        if (key === "admin") return "Admin content";
        return undefined;
      });

      const enabledTools = new Set(["mysql_read_query", "mysql_server_config"]); // core and admin
      
      registerHelpResources(mcpServer, enabledTools);
      
      expect(mcpServer.registerResource).toHaveBeenCalledWith(
        "mysql_help",
        "mysql://help",
        expect.any(Object),
        expect.any(Function)
      );

      expect(mcpServer.registerResource).toHaveBeenCalledWith(
        "mysql_help_core",
        "mysql://help/core",
        expect.any(Object),
        expect.any(Function)
      );

      expect(mcpServer.registerResource).toHaveBeenCalledWith(
        "mysql_help_admin",
        "mysql://help/admin",
        expect.any(Object),
        expect.any(Function)
      );

      // Verify the handler works for gotchas
      const gotchasCall = vi.mocked(mcpServer.registerResource).mock.calls.find(call => call[1] === "mysql://help");
      const gotchasHandler = gotchasCall![3];
      const gotchasResult = gotchasHandler(undefined as any, undefined as any);
      
      expect(gotchasResult).toEqual({
        contents: [
          {
            uri: "mysql://help",
            mimeType: "text/markdown",
            text: "Gotchas content",
          }
        ]
      });
      expect(metrics.recordResourceRead).toHaveBeenCalledWith("mysql://help");

      getSpy.mockRestore();
    });

    it("should register all help resources if codemode is enabled", () => {
      const getSpy = vi.spyOn(HELP_CONTENT, "get");
      getSpy.mockReturnValue("Mock content");

      const enabledTools = new Set(["mysql_execute_code"]); // codemode
      
      registerHelpResources(mcpServer, enabledTools);
      
      // Should register gotchas + all groups
      expect(mcpServer.registerResource).toHaveBeenCalledTimes(28); // gotchas + 27 groups
      
      getSpy.mockRestore();
    });
  });

  describe("registerAuditResource", () => {
    it("should return early if auditLogger is null", () => {
      registerAuditResource(mcpServer, null, null);
      expect(mcpServer.registerResource).not.toHaveBeenCalled();
    });

    it("should register audit resource and return recent data", async () => {
      const mockAuditLogger = {
        recent: vi.fn().mockResolvedValue([
          { success: true, tool: "mysql_query", tokenEstimate: 100 },
          { success: false, tool: "mysql_query", tokenEstimate: 50 },
          { success: true, tool: "mysql_ping", tokenEstimate: null },
        ])
      };
      
      const mockBackupManager = {
        getStats: vi.fn().mockResolvedValue({ total: 2 })
      };

      registerAuditResource(mcpServer, mockAuditLogger as any, mockBackupManager as any);
      
      expect(mcpServer.registerResource).toHaveBeenCalledWith(
        "mysql_audit",
        "mysql://audit",
        expect.any(Object),
        expect.any(Function)
      );

      const handler = vi.mocked(mcpServer.registerResource).mock.calls[0][3];
      const result: any = await handler(undefined as any, undefined as any);
      
      expect(metrics.recordResourceRead).toHaveBeenCalledWith("mysql://audit");
      
      const parsed = JSON.parse(result.contents[0].text);
      expect(parsed.summary.entries).toBe(3);
      expect(parsed.summary.errors).toBe(1);
      expect(parsed.summary.tokenEstimate).toBe(150);
      expect(parsed.summary.topTools).toEqual([
        { name: "mysql_query", count: 2 },
        { name: "mysql_ping", count: 1 }
      ]);
      expect(parsed.summary.backups).toEqual({ total: 2 });
    });

    it("should handle null backupManager", async () => {
      const mockAuditLogger = {
        recent: vi.fn().mockResolvedValue([])
      };

      registerAuditResource(mcpServer, mockAuditLogger as any, null);
      
      const handler = vi.mocked(mcpServer.registerResource).mock.calls[0][3];
      const result: any = await handler(undefined as any, undefined as any);
      
      const parsed = JSON.parse(result.contents[0].text);
      expect(parsed.summary.backups).toBeUndefined();
    });
  });

  describe("registerObservabilityResource", () => {
    it("should register metrics resource", async () => {
      registerObservabilityResource(mcpServer);
      
      expect(mcpServer.registerResource).toHaveBeenCalledWith(
        "mysql_metrics",
        "mysql://metrics",
        expect.any(Object),
        expect.any(Function)
      );

      const handler = vi.mocked(mcpServer.registerResource).mock.calls[0][3];
      const result: any = await handler(undefined as any, undefined as any);
      
      expect(metrics.recordResourceRead).toHaveBeenCalledWith("mysql://metrics");
      
      const parsed = JSON.parse(result.contents[0].text);
      expect(parsed).toEqual({ totalRequests: 5 });
    });
  });
});
