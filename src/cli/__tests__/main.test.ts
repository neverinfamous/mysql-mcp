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
import { createServer } from "../../server/mcp-server/index.js";
import { MySQLAdapter } from "../../adapters/mysql/mysql-adapter/index.js";

// Mock dependencies
vi.mock("../../server/mcp-server/index.js");
vi.mock("../../adapters/mysql/mysql-adapter/index.js");
vi.mock("../../cli/args/index.js", () => ({
  parseArgs: vi.fn(() => ({
    config: { name: "test-server", version: "1.0.0" },
    databases: [],
    oauth: undefined,
    shouldExit: false,
  })),
}));

// Mock output module — cliError/cliInfo write to stderr, cliFatal throws (simulating process.exit)
vi.mock("../../cli/output.js", () => ({
  cliError: vi.fn(),
  cliInfo: vi.fn(),
  cliWarn: vi.fn(),
  cliVersion: vi.fn(),
  cliFatal: vi.fn((_msg: string, _err?: unknown) => {
    throw new Error(`process.exit(1)`);
  }),
}));

import { cliError, cliInfo, cliFatal } from "../../cli/output.js";
// Ensure TS sees these mocked imports as used (they're passed to expect())
void cliError; void cliInfo; void cliFatal;

// Mock process methods
const originalExit = process.exit;

describe("CLI Main", () => {
  let mockServer: { start: Mock; stop: Mock; registerAdapter: Mock };
  let mockAdapter: { connect: Mock; disconnect: Mock; getCapabilities: Mock; isConnected: Mock };
  let mockExit: Mock;
  let mockProcessOn: Mock;

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

    expect(cliError).toHaveBeenCalledWith(
      "No database connection specified",
      expect.stringContaining("--mysql"),
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

    expect(cliInfo).toHaveBeenCalledWith(
      "OAuth authentication enabled",
    );
  });

  it("should handle adapter connection errors without exiting", async () => {
    const dbConfig = { type: "mysql" as const, database: "test_db" };
    const error = new Error("Connection failed");
    mockAdapter.connect.mockRejectedValue(error);

    await main({
      config: {},
      databases: [dbConfig],
      oauth: undefined,
    });

    // We have to wait a tick for the unhandled promise rejection catch block to run
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockExit).not.toHaveBeenCalled();
    expect(mockServer.start).toHaveBeenCalled();
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
      (call: unknown[]) => call[0] === "SIGINT",
    )[1];

    // Override mockExit to not throw for this test to avoid Unhandled Rejection in the void wrapper
    mockExit.mockImplementation(() => {});

    // Execute shutdown
    shutdownHandler();

    // Wait for async shutdown to loop
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(cliInfo).toHaveBeenCalledWith("Shutting down...");
    expect(mockServer.stop).toHaveBeenCalled();
    expect(mockExit).toHaveBeenCalledWith(0);
  });

  it("should handle fatal startup error via cliFatal", async () => {
    const dbConfig = { type: "mysql" as const, database: "test" };
    mockServer.start.mockRejectedValue(new Error("Startup failed"));

    await expect(
      main({
        config: {},
        databases: [dbConfig],
        oauth: undefined,
      }),
    ).rejects.toThrow("process.exit(1)");

    expect(cliFatal).toHaveBeenCalledWith(
      "Server startup failed",
      expect.any(Error),
    );
  });

  it("should dump config with redacted secrets", async () => {
    const mockStdoutWrite = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await expect(
      main({
        config: { authToken: "super-secret" },
        databases: [
          { type: "mysql" as const, database: "db", password: "secret-pw" },
        ],
        oauth: { enabled: true, jwksUri: "https://jwks-url" },
        dumpConfig: true,
      }),
    ).rejects.toThrow(/Process exited with code 0/);

    expect(mockStdoutWrite).toHaveBeenCalled();
    const output = (mockStdoutWrite.mock.calls[0] as [string])[0];
    const parsed = JSON.parse(output) as { config?: { authToken?: string }; databases?: { password?: string }[]; oauth?: { jwksUri?: string } };
    expect(parsed.config?.authToken).toBe("***REDACTED***");
    expect(parsed.databases?.[0]?.password).toBe("***REDACTED***");
    expect(parsed.oauth?.jwksUri).toBe("***REDACTED***");

    mockStdoutWrite.mockRestore();
  });
});
