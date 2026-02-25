/**
 * mysql-mcp - Router Tools Unit Tests
 *
 * Tests for router tool definitions, annotations, and handler execution.
 * Mocks https module to test MySQL Router REST API calls.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getRouterTools } from "../router.js";
import type { MySQLAdapter } from "../../MySQLAdapter.js";
import {
  createMockMySQLAdapter,
  createMockRequestContext,
} from "../../../../__tests__/mocks/index.js";
import { EventEmitter } from "events";

// Mock https module
vi.mock("node:https", () => ({
  default: {
    request: vi.fn(),
  },
}));

import https from "node:https";
const mockRequest = https.request as ReturnType<typeof vi.fn>;

describe("getRouterTools", () => {
  let tools: ReturnType<typeof getRouterTools>;

  beforeEach(() => {
    vi.clearAllMocks();
    tools = getRouterTools(createMockMySQLAdapter() as unknown as MySQLAdapter);
  });

  it("should return 9 router tools", () => {
    expect(tools).toHaveLength(9);
  });

  it("should have router group for all tools", () => {
    for (const tool of tools) {
      expect(tool.group).toBe("router");
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
    expect(toolNames).toContain("mysql_router_status");
    expect(toolNames).toContain("mysql_router_routes");
    expect(toolNames).toContain("mysql_router_route_status");
    expect(toolNames).toContain("mysql_router_route_health");
    expect(toolNames).toContain("mysql_router_route_connections");
    expect(toolNames).toContain("mysql_router_route_destinations");
    expect(toolNames).toContain("mysql_router_route_blocked_hosts");
    expect(toolNames).toContain("mysql_router_metadata_status");
    expect(toolNames).toContain("mysql_router_pool_status");
  });
});

describe("Tool Structure Validation", () => {
  let tools: ReturnType<typeof getRouterTools>;

  beforeEach(() => {
    vi.clearAllMocks();
    tools = getRouterTools(createMockMySQLAdapter() as unknown as MySQLAdapter);
  });

  it("mysql_router_status should have correct structure", () => {
    const tool = tools.find((t) => t.name === "mysql_router_status")!;
    expect(tool.name).toBe("mysql_router_status");
    expect(tool.description).toBeDefined();
    expect(tool.annotations?.readOnlyHint).toBe(true);
    expect(tool.annotations?.openWorldHint).toBe(true);
  });

  it("all router tools should be read-only", () => {
    for (const tool of tools) {
      expect(tool.annotations?.readOnlyHint).toBe(true);
    }
  });

  it("all router tools should have correct requiredScopes", () => {
    for (const tool of tools) {
      expect(tool.requiredScopes).toContain("read");
    }
  });

  it("all tools should have openWorldHint true", () => {
    for (const tool of tools) {
      expect(tool.annotations?.openWorldHint).toBe(true);
    }
  });

  it("all tools should have idempotentHint true", () => {
    for (const tool of tools) {
      expect(tool.annotations?.idempotentHint).toBe(true);
    }
  });
});

describe("Handler Execution", () => {
  let tools: ReturnType<typeof getRouterTools>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    tools = getRouterTools(createMockMySQLAdapter() as unknown as MySQLAdapter);
    mockContext = createMockRequestContext();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper to mock successful https response
  const mockHttpsResponse = (data: unknown, statusCode = 200) => {
    const mockReq = new EventEmitter() as EventEmitter & {
      end: () => void;
      destroy: () => void;
    };
    mockReq.end = vi.fn();
    mockReq.destroy = vi.fn();

    mockRequest.mockImplementation((_options, callback) => {
      const mockRes = new EventEmitter() as EventEmitter & {
        statusCode: number;
        statusMessage: string;
      };
      mockRes.statusCode = statusCode;
      mockRes.statusMessage = statusCode === 200 ? "OK" : "Error";

      setImmediate(() => {
        callback?.(mockRes);
        mockRes.emit("data", JSON.stringify(data));
        mockRes.emit("end");
      });

      return mockReq;
    });
  };

  describe("mysql_router_status", () => {
    it("should fetch router status and return result", async () => {
      const mockStatus = {
        processId: 1234,
        version: "8.0.35",
        hostname: "router-host",
        timeStarted: "2024-01-01T00:00:00Z",
      };
      mockHttpsResponse(mockStatus);

      const tool = tools.find((t) => t.name === "mysql_router_status")!;
      const result = await tool.handler({}, mockContext);

      expect(mockRequest).toHaveBeenCalled();
      const options = mockRequest.mock.calls[0][0] as Record<string, unknown>;
      expect(options.method).toBe("GET");
      expect(options.path).toContain("/router/status");
      expect(result).toEqual({
        success: true,
        status: mockStatus,
      });
    });
  });

  describe("mysql_router_routes", () => {
    it("should fetch all routes", async () => {
      const mockRoutes = {
        items: [{ name: "bootstrap_ro" }, { name: "bootstrap_rw" }],
      };
      mockHttpsResponse(mockRoutes);

      const tool = tools.find((t) => t.name === "mysql_router_routes")!;
      const result = await tool.handler({}, mockContext);

      expect(mockRequest).toHaveBeenCalled();
      const options = mockRequest.mock.calls[0][0] as Record<string, unknown>;
      expect(options.path).toContain("/routes");
      expect(result).toEqual({
        success: true,
        routes: mockRoutes,
      });
    });
  });

  describe("mysql_router_route_status", () => {
    it("should fetch status for specific route", async () => {
      const mockRouteStatus = {
        activeConnections: 5,
        totalConnections: 100,
        blockedHosts: 0,
      };
      mockHttpsResponse(mockRouteStatus);

      const tool = tools.find((t) => t.name === "mysql_router_route_status")!;
      const result = await tool.handler(
        { routeName: "bootstrap_ro" },
        mockContext,
      );

      expect(mockRequest).toHaveBeenCalled();
      const options = mockRequest.mock.calls[0][0] as Record<string, unknown>;
      expect(options.path).toContain("/routes/bootstrap_ro/status");
      expect(result).toEqual({
        success: true,
        routeName: "bootstrap_ro",
        status: mockRouteStatus,
      });
    });

    it("should URL-encode route names", async () => {
      mockHttpsResponse({});

      const tool = tools.find((t) => t.name === "mysql_router_route_status")!;
      await tool.handler({ routeName: "route/with/slashes" }, mockContext);

      const options = mockRequest.mock.calls[0][0] as Record<string, unknown>;
      expect(options.path).toContain("route%2Fwith%2Fslashes");
    });
  });

  describe("mysql_router_route_health", () => {
    it("should check route health", async () => {
      const mockHealth = { isAlive: true };
      mockHttpsResponse(mockHealth);

      const tool = tools.find((t) => t.name === "mysql_router_route_health")!;
      const result = await tool.handler(
        { routeName: "bootstrap_ro" },
        mockContext,
      );

      expect(mockRequest).toHaveBeenCalled();
      const options = mockRequest.mock.calls[0][0] as Record<string, unknown>;
      expect(options.path).toContain("/routes/bootstrap_ro/health");
      expect(result).toEqual({
        success: true,
        routeName: "bootstrap_ro",
        health: mockHealth,
      });
    });
  });

  describe("mysql_router_route_connections", () => {
    it("should list active connections", async () => {
      const mockConnections = {
        items: [
          {
            sourceAddress: "192.168.1.1",
            destinationAddress: "10.0.0.1",
            bytesIn: 1024,
          },
        ],
      };
      mockHttpsResponse(mockConnections);

      const tool = tools.find(
        (t) => t.name === "mysql_router_route_connections",
      )!;
      const result = await tool.handler(
        { routeName: "bootstrap_rw" },
        mockContext,
      );

      expect(mockRequest).toHaveBeenCalled();
      const options = mockRequest.mock.calls[0][0] as Record<string, unknown>;
      expect(options.path).toContain("/routes/bootstrap_rw/connections");
      expect(result).toEqual({
        success: true,
        routeName: "bootstrap_rw",
        connections: mockConnections,
      });
    });
  });

  describe("mysql_router_route_destinations", () => {
    it("should list backend destinations", async () => {
      const mockDestinations = {
        items: [
          { address: "mysql-1.example.com", port: 3306 },
          { address: "mysql-2.example.com", port: 3306 },
        ],
      };
      mockHttpsResponse(mockDestinations);

      const tool = tools.find(
        (t) => t.name === "mysql_router_route_destinations",
      )!;
      const result = await tool.handler(
        { routeName: "bootstrap_ro" },
        mockContext,
      );

      expect(mockRequest).toHaveBeenCalled();
      const options = mockRequest.mock.calls[0][0] as Record<string, unknown>;
      expect(options.path).toContain("/routes/bootstrap_ro/destinations");
      expect(result).toEqual({
        success: true,
        routeName: "bootstrap_ro",
        destinations: mockDestinations,
      });
    });
  });

  describe("mysql_router_route_blocked_hosts", () => {
    it("should list blocked hosts", async () => {
      const mockBlockedHosts = {
        items: [{ address: "192.168.1.100" }],
      };
      mockHttpsResponse(mockBlockedHosts);

      const tool = tools.find(
        (t) => t.name === "mysql_router_route_blocked_hosts",
      )!;
      const result = await tool.handler(
        { routeName: "bootstrap_rw" },
        mockContext,
      );

      expect(mockRequest).toHaveBeenCalled();
      const options = mockRequest.mock.calls[0][0] as Record<string, unknown>;
      expect(options.path).toContain("/routes/bootstrap_rw/blockedHosts");
      expect(result).toEqual({
        success: true,
        routeName: "bootstrap_rw",
        blockedHosts: mockBlockedHosts,
      });
    });
  });

  describe("mysql_router_metadata_status", () => {
    it("should fetch metadata cache status", async () => {
      const mockMetadata = {
        refreshTotal: 100,
        refreshSucceeded: 99,
        lastRefreshHostName: "mysql-primary.example.com",
      };
      mockHttpsResponse(mockMetadata);

      const tool = tools.find(
        (t) => t.name === "mysql_router_metadata_status",
      )!;
      const result = await tool.handler(
        { metadataName: "my_cluster" },
        mockContext,
      );

      expect(mockRequest).toHaveBeenCalled();
      const options = mockRequest.mock.calls[0][0] as Record<string, unknown>;
      expect(options.path).toContain("/metadata/my_cluster/status");
      expect(result).toEqual({
        success: true,
        metadataName: "my_cluster",
        status: mockMetadata,
      });
    });
  });

  describe("mysql_router_pool_status", () => {
    it("should fetch connection pool status", async () => {
      const mockPoolStatus = {
        idleServerConnections: 10,
        stashedServerConnections: 5,
      };
      mockHttpsResponse(mockPoolStatus);

      const tool = tools.find((t) => t.name === "mysql_router_pool_status")!;
      const result = await tool.handler({ poolName: "default" }, mockContext);

      expect(mockRequest).toHaveBeenCalled();
      const options = mockRequest.mock.calls[0][0] as Record<string, unknown>;
      expect(options.path).toContain("/connection_pool/default/status");
      expect(result).toEqual({
        success: true,
        poolName: "default",
        status: mockPoolStatus,
      });
    });
  });
});

describe("HTTP Header Handling", () => {
  let tools: ReturnType<typeof getRouterTools>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    tools = getRouterTools(createMockMySQLAdapter() as unknown as MySQLAdapter);
    mockContext = createMockRequestContext();
  });

  it("should send Accept: application/json header", async () => {
    const mockReq = new EventEmitter() as EventEmitter & {
      end: () => void;
      destroy: () => void;
    };
    mockReq.end = vi.fn();
    mockReq.destroy = vi.fn();

    mockRequest.mockImplementation((_options, callback) => {
      const mockRes = new EventEmitter() as EventEmitter & {
        statusCode: number;
        statusMessage: string;
      };
      mockRes.statusCode = 200;
      mockRes.statusMessage = "OK";

      setImmediate(() => {
        callback?.(mockRes);
        mockRes.emit("data", "{}");
        mockRes.emit("end");
      });

      return mockReq;
    });

    const tool = tools.find((t) => t.name === "mysql_router_status")!;
    await tool.handler({}, mockContext);

    const options = mockRequest.mock.calls[0][0] as Record<
      string,
      Record<string, string>
    >;
    expect(options.headers?.Accept).toBe("application/json");
  });
});

describe("Error Handling", () => {
  let tools: ReturnType<typeof getRouterTools>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    tools = getRouterTools(createMockMySQLAdapter() as unknown as MySQLAdapter);
    mockContext = createMockRequestContext();
  });

  it("should return unavailable response on 401 Unauthorized", async () => {
    const mockReq = new EventEmitter() as EventEmitter & {
      end: () => void;
      destroy: () => void;
    };
    mockReq.end = vi.fn();
    mockReq.destroy = vi.fn();

    mockRequest.mockImplementation((_options, callback) => {
      const mockRes = new EventEmitter() as EventEmitter & {
        statusCode: number;
        statusMessage: string;
      };
      mockRes.statusCode = 401;
      mockRes.statusMessage = "Unauthorized";

      setImmediate(() => {
        callback?.(mockRes);
        mockRes.emit("end");
      });

      return mockReq;
    });

    const tool = tools.find((t) => t.name === "mysql_router_status")!;
    const result = await tool.handler({}, mockContext);

    expect(result).toEqual({
      available: false,
      error: "Router API error: 401 Unauthorized",
    });
  });

  it("should return unavailable response on 404 Not Found", async () => {
    const mockReq = new EventEmitter() as EventEmitter & {
      end: () => void;
      destroy: () => void;
    };
    mockReq.end = vi.fn();
    mockReq.destroy = vi.fn();

    mockRequest.mockImplementation((_options, callback) => {
      const mockRes = new EventEmitter() as EventEmitter & {
        statusCode: number;
        statusMessage: string;
      };
      mockRes.statusCode = 404;
      mockRes.statusMessage = "Not Found";

      setImmediate(() => {
        callback?.(mockRes);
        mockRes.emit("end");
      });

      return mockReq;
    });

    const tool = tools.find((t) => t.name === "mysql_router_route_status")!;
    const result = await tool.handler(
      { routeName: "nonexistent" },
      mockContext,
    );

    expect(result).toEqual({
      success: false,
      error: "Router API error: 404 Not Found",
    });
  });

  it("should return unavailable response on network error", async () => {
    const mockReq = new EventEmitter() as EventEmitter & {
      end: () => void;
      destroy: () => void;
    };
    mockReq.end = vi.fn();
    mockReq.destroy = vi.fn();

    mockRequest.mockImplementation(() => {
      setImmediate(() => {
        mockReq.emit("error", new Error("Network error"));
      });
      return mockReq;
    });

    const tool = tools.find((t) => t.name === "mysql_router_status")!;
    const result = await tool.handler({}, mockContext);

    expect(result).toEqual({
      available: false,
      error: "Router API request failed: Network error",
    });
  });

  it("should return unavailable response on connection refused", async () => {
    const mockReq = new EventEmitter() as EventEmitter & {
      end: () => void;
      destroy: () => void;
    };
    mockReq.end = vi.fn();
    mockReq.destroy = vi.fn();

    mockRequest.mockImplementation(() => {
      setImmediate(() => {
        const error = new Error("ECONNREFUSED") as NodeJS.ErrnoException;
        error.code = "ECONNREFUSED";
        mockReq.emit("error", error);
      });
      return mockReq;
    });

    const tool = tools.find((t) => t.name === "mysql_router_status")!;
    const result = await tool.handler({}, mockContext);

    expect(result).toEqual({
      available: false,
      error: expect.stringContaining("Connection refused"),
    });
  });
});

describe("Zod Validation Error Handling", () => {
  let tools: ReturnType<typeof getRouterTools>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    tools = getRouterTools(createMockMySQLAdapter() as unknown as MySQLAdapter);
    mockContext = createMockRequestContext();
  });

  it("should return structured error for invalid routeName type", async () => {
    const tool = tools.find((t) => t.name === "mysql_router_route_status")!;
    const result = await tool.handler({ routeName: 123 }, mockContext);

    expect(result).toHaveProperty("success", false);
    expect(result).toHaveProperty("error");
  });

  it("should return structured error for invalid metadataName type", async () => {
    const tool = tools.find((t) => t.name === "mysql_router_metadata_status")!;
    const result = await tool.handler({ metadataName: true }, mockContext);

    expect(result).toHaveProperty("success", false);
    expect(result).toHaveProperty("error");
  });
});

describe("Authentication and TLS Handling", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    vi.clearAllMocks();
    // Save original env
    originalEnv = { ...process.env };
    // Clear relevant env vars
    delete process.env["MYSQL_ROUTER_URL"];
    delete process.env["MYSQL_ROUTER_USER"];
    delete process.env["MYSQL_ROUTER_PASSWORD"];
    delete process.env["MYSQL_ROUTER_INSECURE"];
    delete process.env["NODE_TLS_REJECT_UNAUTHORIZED"];
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Restore original env
    process.env = originalEnv;
  });

  // Helper to mock response
  const setupMockRequest = () => {
    const mockReq = new EventEmitter() as EventEmitter & {
      end: () => void;
      destroy: () => void;
    };
    mockReq.end = vi.fn();
    mockReq.destroy = vi.fn();

    mockRequest.mockImplementation((_options, callback) => {
      const mockRes = new EventEmitter() as EventEmitter & {
        statusCode: number;
        statusMessage: string;
      };
      mockRes.statusCode = 200;
      mockRes.statusMessage = "OK";

      setImmediate(() => {
        callback?.(mockRes);
        mockRes.emit("data", "{}");
        mockRes.emit("end");
      });

      return mockReq;
    });

    return mockReq;
  };

  it("should add Basic auth header when credentials provided", async () => {
    process.env["MYSQL_ROUTER_USER"] = "admin";
    process.env["MYSQL_ROUTER_PASSWORD"] = "secret";

    setupMockRequest();

    const tools = getRouterTools(
      createMockMySQLAdapter() as unknown as MySQLAdapter,
    );
    const tool = tools.find((t) => t.name === "mysql_router_status")!;
    await tool.handler({}, createMockRequestContext());

    const options = mockRequest.mock.calls[0][0] as Record<
      string,
      Record<string, string>
    >;
    expect(options.headers?.Authorization).toMatch(/^Basic /);
    // Verify the encoded value
    const expectedAuth = Buffer.from("admin:secret").toString("base64");
    expect(options.headers?.Authorization).toBe(`Basic ${expectedAuth}`);
  });

  it("should not add auth header when no credentials provided", async () => {
    setupMockRequest();

    const tools = getRouterTools(
      createMockMySQLAdapter() as unknown as MySQLAdapter,
    );
    const tool = tools.find((t) => t.name === "mysql_router_status")!;
    await tool.handler({}, createMockRequestContext());

    const options = mockRequest.mock.calls[0][0] as Record<
      string,
      Record<string, string>
    >;
    expect(options.headers?.Authorization).toBeUndefined();
  });

  it("should set rejectUnauthorized=false for HTTPS with insecure=true", async () => {
    process.env["MYSQL_ROUTER_URL"] = "https://localhost:8443";
    process.env["MYSQL_ROUTER_INSECURE"] = "true";

    setupMockRequest();

    const tools = getRouterTools(
      createMockMySQLAdapter() as unknown as MySQLAdapter,
    );
    const tool = tools.find((t) => t.name === "mysql_router_status")!;
    await tool.handler({}, createMockRequestContext());

    const options = mockRequest.mock.calls[0][0] as Record<string, unknown>;
    // insecure=true means rejectUnauthorized should be false
    expect(options.rejectUnauthorized).toBe(false);
  });

  it("should set rejectUnauthorized=true for secure HTTPS requests", async () => {
    process.env["MYSQL_ROUTER_URL"] = "https://localhost:8443";
    process.env["MYSQL_ROUTER_INSECURE"] = "false";

    setupMockRequest();

    const tools = getRouterTools(
      createMockMySQLAdapter() as unknown as MySQLAdapter,
    );
    const tool = tools.find((t) => t.name === "mysql_router_status")!;
    await tool.handler({}, createMockRequestContext());

    const options = mockRequest.mock.calls[0][0] as Record<string, unknown>;
    // insecure=false means rejectUnauthorized should be true
    expect(options.rejectUnauthorized).toBe(true);
  });

  it("should not modify NODE_TLS_REJECT_UNAUTHORIZED env var", async () => {
    process.env["MYSQL_ROUTER_URL"] = "https://localhost:8443";
    process.env["MYSQL_ROUTER_INSECURE"] = "true";
    const originalValue = process.env["NODE_TLS_REJECT_UNAUTHORIZED"];

    setupMockRequest();

    const tools = getRouterTools(
      createMockMySQLAdapter() as unknown as MySQLAdapter,
    );
    const tool = tools.find((t) => t.name === "mysql_router_status")!;
    await tool.handler({}, createMockRequestContext());

    // New implementation should not modify this env var
    expect(process.env["NODE_TLS_REJECT_UNAUTHORIZED"]).toBe(originalValue);
  });
});
