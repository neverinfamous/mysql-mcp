import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerHelpResources, registerAuditResource, registerObservabilityResource } from "../resources.js";
import type { McpServer } from "../mcp-server.js";
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
  let mockSdkServer: any;

  beforeEach(() => {
    mockSdkServer = {
      registerResource: vi.fn(),
    };
    const mockAdapter = {
      getToolDefinitions: () => [
        { name: "mysql_read_query" },
        { name: "mysql_server_config" }
      ]
    };
    mcpServer = {
      getSdkServer: () => mockSdkServer,
      getToolFilter: () => ({ enabledTools: new Set(["mysql_read_query", "mysql_server_config"]) }),
      getAdapters: () => new Map([["test", mockAdapter]]),
    } as unknown as McpServer;
    vi.clearAllMocks();
  });

  describe("registerHelpResources", () => {
    it("should register base help resource and enabled group resources", () => {
      registerHelpResources(mcpServer);
      
      expect(mockSdkServer.registerResource).toHaveBeenCalledWith(
        "mysql_help",
        "mysql://help",
        expect.any(Object),
        expect.any(Function)
      );

      expect(mockSdkServer.registerResource).toHaveBeenCalledWith(
        "mysql_help_group",
        expect.any(Object), // ResourceTemplate
        expect.any(Object),
        expect.any(Function)
      );

      // Verify the handler works for the base json endpoint
      const baseCall = vi.mocked(mockSdkServer.registerResource).mock.calls.find(call => call[1] === "mysql://help");
      const baseHandler = baseCall![3];
      const baseResult = baseHandler(undefined, undefined);
      
      const parsed = JSON.parse(baseResult.contents[0].text);
      const groupNames = parsed.groups.map((g: any) => g.name);
      expect(groupNames).toContain("gotchas");
      expect(groupNames).toContain("core");
      expect(groupNames).toContain("admin");
      expect(metrics.recordResourceRead).toHaveBeenCalledWith("mysql://help");
    });

    it("should correctly handle dynamic group resolution for ResourceTemplate", () => {
      registerHelpResources(mcpServer);
      
      const groupCall = vi.mocked(mockSdkServer.registerResource).mock.calls.find(call => call[0] === "mysql_help_group");
      const groupHandler = groupCall![3];
      
      const getSpy = vi.spyOn(HELP_CONTENT, "get");
      getSpy.mockReturnValue("Mock gotchas content");
      
      const result = groupHandler(new URL("mysql://help/gotchas"), { group: "gotchas" });
      const parsed = JSON.parse(result.contents[0].text);
      expect(parsed.helpContent).toBe("Mock gotchas content");
      expect(parsed.group).toBe("gotchas");
      expect(metrics.recordResourceRead).toHaveBeenCalledWith("mysql://help/gotchas");
      
      getSpy.mockRestore();
    });
  });

  describe("registerAuditResource", () => {
    it("should return early if auditLogger is null", () => {
      registerAuditResource(mockSdkServer, null, null);
      expect(mockSdkServer.registerResource).not.toHaveBeenCalled();
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

      registerAuditResource(mockSdkServer, mockAuditLogger as Record<string, unknown>, mockBackupManager as Record<string, unknown>);
      
      expect(mockSdkServer.registerResource).toHaveBeenCalledWith(
        "mysql_audit",
        "mysql://audit",
        expect.any(Object),
        expect.any(Function)
      );

      const handler = vi.mocked(mockSdkServer.registerResource).mock.calls[0][3];
      const result: any = await handler(undefined, undefined);
      
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

      registerAuditResource(mockSdkServer, mockAuditLogger as Record<string, unknown>, null);
      
      const handler = vi.mocked(mockSdkServer.registerResource).mock.calls[0][3];
      const result: any = await handler(undefined, undefined);
      
      const parsed = JSON.parse(result.contents[0].text);
      expect(parsed.summary.backups).toBeUndefined();
    });
  });

  describe("registerObservabilityResource", () => {
    it("should register metrics resource", async () => {
      registerObservabilityResource(mockSdkServer);
      
      expect(mockSdkServer.registerResource).toHaveBeenCalledWith(
        "mysql_metrics",
        "mysql://metrics",
        expect.any(Object),
        expect.any(Function)
      );

      const handler = vi.mocked(mockSdkServer.registerResource).mock.calls[0][3];
      const result: any = await handler(undefined, undefined);
      
      expect(metrics.recordResourceRead).toHaveBeenCalledWith("mysql://metrics");
      
      const parsed = JSON.parse(result.contents[0].text);
      expect(parsed).toEqual({ totalRequests: 5 });
    });
  });
});
