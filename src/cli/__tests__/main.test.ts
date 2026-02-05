import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from "vitest";
import { main } from "../../cli.js";
import { createServer } from "../../server/McpServer.js";
import { MySQLAdapter } from "../../adapters/mysql/MySQLAdapter.js";

// Mock dependencies
vi.mock("../../server/McpServer.js");
vi.mock("../../adapters/mysql/MySQLAdapter.js");
vi.mock("../args.js", () => ({
  parseArgs: vi.fn(() => ({
    config: { name: "test-server", version: "1.0.0" },
    databases: [],
    oauth: undefined,
    shouldExit: false,
  })),
}));

// Mock process methods
const originalExit = process.exit;

describe("CLI Main", () => {
  let mockServer: any;
  let mockAdapter: any;
  let mockExit: any;
  let mockConsoleError: any;
  let mockProcessOn: any;

  // Custom error to simulate process.exit
  class ExitError extends Error {
    constructor(public code: number) {
      super(`Process exited with code ${code}`);
    }
  }

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Setup mock server
    mockServer = {
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      registerAdapter: vi.fn(),
    };
    (createServer as unknown as Mock).mockReturnValue(mockServer);

    // Mock MySQLAdapter
    mockAdapter = {
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      getCapabilities: vi.fn().mockReturnValue({}),
      isConnected: vi.fn().mockReturnValue(true),
    };
    (MySQLAdapter as unknown as Mock).mockImplementation(function () {
      return mockAdapter;
    });

    // Mock process.exit
    mockExit = vi.fn().mockImplementation((code) => {
      throw new ExitError(code);
    });
    Object.defineProperty(process, "exit", { value: mockExit });

    // Mock console.error
    mockConsoleError = vi.fn();
    console.error = mockConsoleError;

    // Mock process.on
    mockProcessOn = vi.fn();
    process.on = mockProcessOn;
  });

  afterEach(() => {
    if (originalExit) {
      Object.defineProperty(process, "exit", { value: originalExit });
    }
    vi.restoreAllMocks();
  });

  it("should exit if shouldExit is true", async () => {
    await expect(
      main({
        config: {},
        databases: [],
        oauth: undefined,
        shouldExit: true,
      }),
    ).rejects.toThrow(/Process exited with code 0/);

    expect(mockExit).toHaveBeenCalledWith(0);
    expect(createServer).not.toHaveBeenCalled();
  });

  it("should exit with error if no databases specified", async () => {
    await expect(
      main({
        config: {},
        databases: [],
        oauth: undefined,
      }),
    ).rejects.toThrow(/Process exited with code 1/);

    expect(mockConsoleError).toHaveBeenCalledWith(
      expect.stringContaining("Error: No database connection specified"),
    );
    expect(mockExit).toHaveBeenCalledWith(1);
    expect(createServer).not.toHaveBeenCalled();
  });

  it("should start server with valid configuration", async () => {
    const dbConfig = {
      type: "mysql" as const,
      username: "root",
      password: "password",
      database: "test_db",
    };

    await main({
      config: { name: "test-server" },
      databases: [dbConfig],
      oauth: undefined,
    });

    expect(createServer).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "test-server",
        databases: [dbConfig],
      }),
    );
    expect(MySQLAdapter).toHaveBeenCalled();
    expect(mockAdapter.connect).toHaveBeenCalledWith(dbConfig);
    expect(mockServer.registerAdapter).toHaveBeenCalledWith(
      mockAdapter,
      "mysql:test_db",
    );
    expect(mockServer.start).toHaveBeenCalled();
    expect(mockExit).not.toHaveBeenCalled();
  });

  it("should log OAuth status if enabled", async () => {
    const dbConfig = { type: "mysql" as const };
    const oauthConfig = {
      enabled: true,
      issuer: "http://test",
      audience: "test",
    };

    await main({
      config: { name: "test", version: "1.0.0" },
      databases: [dbConfig],
      oauth: oauthConfig,
    });

    expect(mockConsoleError).toHaveBeenCalledWith(
      "OAuth authentication enabled",
    );
  });

  it("should handle adapter connection errors", async () => {
    const dbConfig = { type: "mysql" as const };
    const error = new Error("Connection failed");
    mockAdapter.connect.mockRejectedValue(error);

    await expect(
      main({
        config: {},
        databases: [dbConfig],
        oauth: undefined,
      }),
    ).rejects.toThrow(/Process exited with code 1/);

    expect(mockConsoleError).toHaveBeenCalledWith("Fatal error:", error);
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it("should register signal handlers for graceful shutdown", async () => {
    const dbConfig = { type: "mysql" as const };

    await main({
      config: {},
      databases: [dbConfig],
      oauth: undefined,
    });

    expect(mockProcessOn).toHaveBeenCalledWith("SIGINT", expect.any(Function));
    expect(mockProcessOn).toHaveBeenCalledWith("SIGTERM", expect.any(Function));
  });

  it("should handle graceful shutdown correctly", async () => {
    const dbConfig = { type: "mysql" as const };

    await main({
      config: {},
      databases: [dbConfig],
      oauth: undefined,
    });

    // Get the shutdown handler
    const shutdownHandler = mockProcessOn.mock.calls.find(
      (call: any[]) => call[0] === "SIGINT",
    )[1];

    // Override mockExit to not throw for this test to avoid Unhandled Rejection in the void wrapper
    mockExit.mockImplementation(() => {});

    // Execute shutdown
    shutdownHandler();

    // Wait for async shutdown to loop
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockConsoleError).toHaveBeenCalledWith(
      expect.stringContaining("Shutting down"),
    );
    expect(mockServer.stop).toHaveBeenCalled();
    expect(mockExit).toHaveBeenCalledWith(0);
  });
});
