import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "../mcp-server.js";
import { DatabaseAdapter } from "../../../adapters/database-adapter/index.js";
import { DEFAULT_CONFIG } from "../config.js";
import { logger } from "../../../utils/logger.js";

// Mock dependencies
vi.mock("../../../utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../../logging/mcp-logging.js", () => ({
  mcpLogger: {
    setServer: vi.fn(),
    info: vi.fn(),
    setConnected: vi.fn(),
  },
}));

describe("McpServer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should warn if no tool filter and too many tools registered", () => {
    const server = new McpServer({ ...DEFAULT_CONFIG, toolFilter: "" });
    const mockAdapter = {
      name: "MockAdapter",
      type: "mock",
      getToolDefinitions: () => Array.from({ length: 51 }, (_, i) => ({ name: `tool${i}` })),
      getResourceDefinitions: () => [],
      getPromptDefinitions: () => [],
      registerTools: vi.fn(),
      registerResources: vi.fn(),
      registerPrompts: vi.fn(),
      setAllowedIoRoots: vi.fn(),
      on: vi.fn(),
    } as unknown as DatabaseAdapter;
    // Force the tool filter to return true for all tools to trigger the warning
    vi.spyOn(server.toolFilter.enabledTools, "has").mockReturnValue(true);

    server.registerAdapter(mockAdapter);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("CONTEXT BLOAT WARNING"));
  });

  it("should periodically notify health subscribers", () => {
    vi.useFakeTimers();
    const server = new McpServer();
    
    // Simulate someone subscribing to health
    vi.spyOn(server.subscriptionManager, "hasSubscribers").mockReturnValue(true);
    const notifySpy = vi.spyOn(server.subscriptionManager, "notifyResourceUpdated").mockResolvedValue();
    
    vi.advanceTimersByTime(60_000);
    
    expect(server.subscriptionManager.hasSubscribers).toHaveBeenCalledWith("mysql://health");
    expect(notifySpy).toHaveBeenCalledWith("mysql://health");
    
    // Cleanup
    server.stop();
    vi.useRealTimers();
  });

  it("should reject HTTP transport without allowedIoRoots", async () => {
    const server = new McpServer({ transport: "http", allowedIoRoots: [] });
    
    // We expect process.exit(1) to be called. We can mock it.
    const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    
    await server.start();
    
    expect(mockExit).toHaveBeenCalledWith(1);
    
    mockExit.mockRestore();
  });
});
