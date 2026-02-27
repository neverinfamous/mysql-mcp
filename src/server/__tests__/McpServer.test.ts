/**
 * mysql-mcp - McpServer Unit Tests
 *
 * Tests for MCP server lifecycle, adapter registration,
 * tool filtering integration, and configuration.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  McpServer,
  createServer,
  parseMySQLConnectionString,
  DEFAULT_CONFIG,
} from "../McpServer.js";
import { createMockMySQLAdapter } from "../../__tests__/mocks/index.js";

// Mock the StdioServerTransport
vi.mock("@modelcontextprotocol/sdk/server/stdio.js", () => ({
  StdioServerTransport: class MockStdioTransport {},
}));

// Mock HTTP transport
const mockHttpTransport = {
  start: vi.fn(),
  stop: vi.fn(),
};

vi.mock("../../transports/http.js", () => ({
  createHttpTransport: vi.fn(() => mockHttpTransport),
}));

// Mock OAuth dependencies
vi.mock("../auth/OAuthResourceServer.js", () => ({
  OAuthResourceServer: class MockOAuthResourceServer {
    constructor(_config: any) {}
  },
}));

vi.mock("../auth/TokenValidator.js", () => ({
  TokenValidator: class MockTokenValidator {
    constructor(_config: any) {}
  },
}));

// Mock the MCP SDK server with a proper class - capture constructor args
let lastMockMcpServerOptions: unknown = null;
vi.mock("@modelcontextprotocol/sdk/server/mcp.js", () => ({
  McpServer: class MockMcpServer {
    connect = vi.fn().mockResolvedValue(undefined);
    close = vi.fn().mockResolvedValue(undefined);
    tool = vi.fn();
    resource = vi.fn();
    prompt = vi.fn();
    constructor(_serverInfo: unknown, options: unknown) {
      lastMockMcpServerOptions = options;
    }
  },
}));

// Mock logger
vi.mock("../../utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock MCP logging
vi.mock("../../logging/McpLogging.js", () => ({
  mcpLogger: {
    setServer: vi.fn(),
    setConnected: vi.fn(),
    info: vi.fn(),
    notice: vi.fn(),
  },
}));

// Mock progress reporter
vi.mock("../../progress/ProgressReporter.js", () => ({
  progressFactory: {
    setServer: vi.fn(),
  },
}));

describe("DEFAULT_CONFIG", () => {
  it("should have correct default values", () => {
    expect(DEFAULT_CONFIG.name).toBe("mysql-mcp");
    expect(DEFAULT_CONFIG.version).toBe("0.1.0");
    expect(DEFAULT_CONFIG.transport).toBe("stdio");
    expect(DEFAULT_CONFIG.databases).toEqual([]);
  });
});

describe("McpServer", () => {
  let server: McpServer;

  beforeEach(() => {
    vi.clearAllMocks();
    server = new McpServer();
  });

  describe("constructor", () => {
    it("should create server with default config", () => {
      const config = server.getConfig();
      expect(config.name).toBe("mysql-mcp");
      expect(config.version).toBe("0.1.0");
      expect(config.transport).toBe("stdio");
    });

    it("should merge custom config with defaults", () => {
      const customServer = new McpServer({
        name: "custom-server",
        transport: "http",
      });
      const config = customServer.getConfig();
      expect(config.name).toBe("custom-server");
      expect(config.transport).toBe("http");
      expect(config.version).toBe("0.1.0"); // Default preserved
    });

    it("should parse tool filter from config", () => {
      const filteredServer = new McpServer({
        toolFilter: "-base,+starter",
      });
      const filter = filteredServer.getToolFilter();
      expect(filter.rules.length).toBeGreaterThan(0);
    });

    it("should pass instructions to SDK server", () => {
      new McpServer();
      expect(lastMockMcpServerOptions).toHaveProperty("instructions");
      expect(
        (lastMockMcpServerOptions as { instructions: string }).instructions,
      ).toContain("mysql-mcp Usage Instructions");
    });
  });

  describe("registerAdapter", () => {
    it("should register an adapter", () => {
      const mockAdapter = createMockMySQLAdapter();
      server.registerAdapter(
        mockAdapter as unknown as Parameters<typeof server.registerAdapter>[0],
      );
      expect(server.getAdapter("mysql:default")).toBe(mockAdapter);
    });

    it("should register adapter with custom alias", () => {
      const mockAdapter = createMockMySQLAdapter();
      server.registerAdapter(
        mockAdapter as unknown as Parameters<typeof server.registerAdapter>[0],
        "primary-db",
      );
      expect(server.getAdapter("primary-db")).toBe(mockAdapter);
    });

    it("should not register duplicate adapters", () => {
      const mockAdapter = createMockMySQLAdapter();
      server.registerAdapter(
        mockAdapter as unknown as Parameters<typeof server.registerAdapter>[0],
      );
      server.registerAdapter(
        mockAdapter as unknown as Parameters<typeof server.registerAdapter>[0],
      ); // Should warn but not fail
      expect(server.getAdapters().size).toBe(1);
    });
  });

  describe("getAdapter", () => {
    it("should return undefined for non-existent adapter", () => {
      expect(server.getAdapter("non-existent")).toBeUndefined();
    });
  });

  describe("getAdapters", () => {
    it("should return empty map initially", () => {
      expect(server.getAdapters().size).toBe(0);
    });

    it("should return all registered adapters", () => {
      server.registerAdapter(
        createMockMySQLAdapter() as unknown as Parameters<
          typeof server.registerAdapter
        >[0],
        "db1",
      );
      server.registerAdapter(
        createMockMySQLAdapter() as unknown as Parameters<
          typeof server.registerAdapter
        >[0],
        "db2",
      );
      expect(server.getAdapters().size).toBe(2);
    });
  });

  describe("start", () => {
    it("should start the server with stdio transport by default", async () => {
      await server.start();
      expect(server.isRunning()).toBe(true);
    });

    it("should start with http transport", async () => {
      const httpServer = new McpServer({
        transport: "http",
        port: 8080,
      });

      await httpServer.start();
      expect(httpServer.isRunning()).toBe(true);

      // Verify http transport was created and started
      const { createHttpTransport } = await import("../../transports/http.js");
      expect(createHttpTransport).toHaveBeenCalledWith(
        expect.objectContaining({ port: 8080 }),
        expect.any(Function),
      );
      expect(mockHttpTransport.start).toHaveBeenCalled();
    });

    it("should configure OAuth when enabled", async () => {
      const oauthServer = new McpServer({
        transport: "http",
        oauth: {
          enabled: true,
          issuer: "https://auth.example.com",
          audience: "test-audience",
          jwksUri: "https://auth.example.com/.well-known/jwks.json",
        },
      });

      await oauthServer.start();

      const { createHttpTransport } = await import("../../transports/http.js");
      expect(createHttpTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceServer: expect.any(Object),
          tokenValidator: expect.any(Object),
        }),
        expect.any(Function),
      );
    });

    it("should throw if OAuth enabled but missing config", async () => {
      const badConfigServer = new McpServer({
        transport: "http",
        oauth: {
          enabled: true,
          // Missing issuer/audience
        } as any,
      });

      await expect(badConfigServer.start()).rejects.toThrow();
    });

    it("should fail if transport start fails", async () => {
      mockHttpTransport.start.mockRejectedValueOnce(new Error("Port in use"));

      const httpServer = new McpServer({ transport: "http" });
      await expect(httpServer.start()).rejects.toThrow("Port in use");
      expect(httpServer.isRunning()).toBe(false);
    });

    it("should not start twice", async () => {
      await server.start();
      await server.start(); // Should warn but not fail
      expect(server.isRunning()).toBe(true);
    });
  });

  describe("stop", () => {
    it("should stop the server", async () => {
      await server.start();
      expect(server.isRunning()).toBe(true);
      await server.stop();
      expect(server.isRunning()).toBe(false);
    });

    it("should stop active transport", async () => {
      const httpServer = new McpServer({ transport: "http" });
      await httpServer.start();
      await httpServer.stop();
      expect(mockHttpTransport.stop).toHaveBeenCalled();
    });

    it("should safely handle transport stop errors", async () => {
      const httpServer = new McpServer({ transport: "http" });
      await httpServer.start();

      mockHttpTransport.stop.mockRejectedValueOnce(new Error("Stop failed"));
      await httpServer.stop(); // Should not throw
      expect(httpServer.isRunning()).toBe(false);

      // cleanup for other tests
      mockHttpTransport.stop.mockResolvedValue(undefined);
    });

    it("should do nothing if not started", async () => {
      await server.stop(); // Should not throw
      expect(server.isRunning()).toBe(false);
    });

    it("should disconnect all adapters", async () => {
      const mockAdapter = createMockMySQLAdapter();
      server.registerAdapter(
        mockAdapter as unknown as Parameters<typeof server.registerAdapter>[0],
      );
      await server.start();
      await server.stop();
      expect(mockAdapter.disconnect).toHaveBeenCalled();
    });
  });

  describe("getConfig", () => {
    it("should return a copy of config", () => {
      const config1 = server.getConfig();
      const config2 = server.getConfig();
      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });
  });

  describe("getToolFilter", () => {
    it("should return tool filter config", () => {
      const filter = server.getToolFilter();
      expect(filter).toHaveProperty("enabledTools");
      expect(filter).toHaveProperty("rules");
    });
  });

  describe("isRunning", () => {
    it("should return false initially", () => {
      expect(server.isRunning()).toBe(false);
    });
  });

  describe("getSdkServer", () => {
    it("should return the SDK server instance", () => {
      const sdk = server.getSdkServer();
      expect(sdk).toBeDefined();
    });
  });
});

describe("createServer", () => {
  it("should create a server instance", () => {
    const server = createServer();
    expect(server).toBeInstanceOf(McpServer);
  });

  it("should accept custom config", () => {
    const server = createServer({ name: "test-server" });
    expect(server.getConfig().name).toBe("test-server");
  });
});

describe("parseMySQLConnectionString", () => {
  it("should parse basic connection string", () => {
    const config = parseMySQLConnectionString(
      "mysql://user:password@localhost:3306/testdb",
    );
    expect(config.type).toBe("mysql");
    expect(config.host).toBe("localhost");
    expect(config.port).toBe(3306);
    expect(config.username).toBe("user");
    expect(config.password).toBe("password");
    expect(config.database).toBe("testdb");
  });

  it("should handle default port", () => {
    const config = parseMySQLConnectionString(
      "mysql://user:password@localhost/testdb",
    );
    expect(config.port).toBe(3306);
  });

  it("should decode URL-encoded credentials", () => {
    const config = parseMySQLConnectionString(
      "mysql://user%40domain:p%40ss%2Fword@localhost/db",
    );
    expect(config.username).toBe("user@domain");
    expect(config.password).toBe("p@ss/word");
  });

  it("should parse query parameters as options", () => {
    const config = parseMySQLConnectionString(
      "mysql://user:pass@localhost/db?ssl=true&timeout=5000",
    );
    expect(config.options).toHaveProperty("ssl", "true");
    expect(config.options).toHaveProperty("timeout", "5000");
  });

  it("should handle different hosts", () => {
    const config1 = parseMySQLConnectionString(
      "mysql://u:p@host.docker.internal:3306/db",
    );
    expect(config1.host).toBe("host.docker.internal");

    const config2 = parseMySQLConnectionString(
      "mysql://u:p@192.168.1.100:3306/db",
    );
    expect(config2.host).toBe("192.168.1.100");

    const config3 = parseMySQLConnectionString(
      "mysql://u:p@db.example.com:3306/db",
    );
    expect(config3.host).toBe("db.example.com");
  });
});
