import { describe, it, expect, vi, beforeEach } from "vitest";
import { main } from "../cli.js";

// Hoist mocks to be accessible in vi.mock factory
const mocks = vi.hoisted(() => ({
  createServer: vi.fn(),
  MySQLAdapter: vi.fn(),
  serverInstance: {
    start: vi.fn(),
    stop: vi.fn(),
    registerAdapter: vi.fn(),
  },
  adapterInstance: {
    connect: vi.fn(),
  },
}));

// Mock McpServer partially
vi.mock("../server/mcp-server/index.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../server/mcp-server/index.js")>();
  return {
    ...actual,
    createServer: mocks.createServer,
  };
});

// Mock MySQLAdapter
vi.mock("../adapters/mysql/mysql-adapter/index.js", () => ({
  MySQLAdapter: mocks.MySQLAdapter,
}));

// Mock output module — cliError/cliInfo write to stderr, cliFatal throws (simulating process.exit)
vi.mock("../cli/output.js", () => ({
  cliError: vi.fn(),
  cliInfo: vi.fn(),
  cliWarn: vi.fn(),
  cliVersion: vi.fn(),
  cliFatal: vi.fn((_msg: string, _err?: unknown) => {
    throw new Error(`process.exit(1)`);
  }),
}));

import { cliError, cliInfo, cliFatal } from "../cli/output.js";
// Ensure TS sees these mocked imports as used (they're passed to expect())
void cliError; void cliInfo; void cliFatal;

// Mock process.exit
const mockExit = vi
  .spyOn(process, "exit")
  .mockImplementation((code?: number | string | null  ) => {
    throw new Error(`process.exit(${code})`);
  });

// Fix: Use a regular function for implementation so it can be called with 'new'
const mockMySQLAdapterImplementation = function () {
  return mocks.adapterInstance;
};

describe("CLI", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock behaviors
    mocks.createServer.mockReturnValue(mocks.serverInstance);
    // Set implementation for MySQLAdapter (class constructor mock)
    mocks.MySQLAdapter.mockImplementation(mockMySQLAdapterImplementation);

    mocks.serverInstance.start.mockResolvedValue(undefined);
    mocks.serverInstance.stop.mockResolvedValue(undefined);
    mocks.adapterInstance.connect.mockResolvedValue(undefined);

    delete process.env["MYSQL_HOST"];
    delete process.env["MYSQL_USER"];
    delete process.env["MYSQL_PASSWORD"];
    delete process.env["MYSQL_DATABASE"];

    delete process.env["OAUTH_ENABLED"];
  });

  describe("canSkipMySQLConnection logic", () => {
    it("should skip MySQL connection for router-only filter", async () => {
      await main({
        config: { toolFilter: "router" },
        databases: [
          { type: "mysql", host: "localhost", database: "test" },
        ],
        oauth: undefined,
      });

      // Should NOT call connect because router tools don't need MySQL
      expect(mocks.adapterInstance.connect).not.toHaveBeenCalled();
      expect(mocks.serverInstance.registerAdapter).toHaveBeenCalled();
    });

    it("should skip MySQL connection for proxysql-only filter", async () => {
      await main({
        config: { toolFilter: "proxysql" },
        databases: [
          { type: "mysql", host: "localhost", database: "test" },
        ],
        oauth: undefined,
      });

      expect(mocks.adapterInstance.connect).not.toHaveBeenCalled();
    });

    it("should skip MySQL connection for shell-only filter", async () => {
      await main({
        config: { toolFilter: "shell" },
        databases: [
          { type: "mysql", host: "localhost", database: "test" },
        ],
        oauth: undefined,
      });

      expect(mocks.adapterInstance.connect).not.toHaveBeenCalled();
    });

    it("should require MySQL connection for ecosystem shortcut (cluster needs MySQL)", async () => {
      await main({
        config: { toolFilter: "ecosystem" },
        databases: [
          { type: "mysql", host: "localhost", database: "test" },
        ],
        oauth: undefined,
      });

      // ecosystem now includes cluster group which requires MySQL connection
      expect(mocks.adapterInstance.connect).toHaveBeenCalled();
    });

    it("should skip MySQL connection for combined MySQL-optional groups", async () => {
      await main({
        config: { toolFilter: "router,proxysql,shell" },
        databases: [
          { type: "mysql", host: "localhost", database: "test" },
        ],
        oauth: undefined,
      });

      expect(mocks.adapterInstance.connect).not.toHaveBeenCalled();
    });

    it("should require MySQL connection for starter shortcut", async () => {
      await main({
        config: { toolFilter: "starter" },
        databases: [
          { type: "mysql", host: "localhost", database: "test" },
        ],
        oauth: undefined,
      });

      expect(mocks.adapterInstance.connect).toHaveBeenCalled();
    });

    it("should require MySQL connection for dev-power shortcut", async () => {
      await main({
        config: { toolFilter: "dev-power" },
        databases: [
          { type: "mysql", host: "localhost", database: "test" },
        ],
        oauth: undefined,
      });

      expect(mocks.adapterInstance.connect).toHaveBeenCalled();
    });

    it("should require MySQL connection for mixed MySQL and non-MySQL groups", async () => {
      await main({
        config: { toolFilter: "router,core" },
        databases: [
          { type: "mysql", host: "localhost", database: "test" },
        ],
        oauth: undefined,
      });

      expect(mocks.adapterInstance.connect).toHaveBeenCalled();
    });

    it("should require MySQL connection for exclusion-only filters", async () => {
      await main({
        config: { toolFilter: "-router" },
        databases: [
          { type: "mysql", host: "localhost", database: "test" },
        ],
        oauth: undefined,
      });

      // Exclusion only means no explicit enabled groups, so can't skip
      expect(mocks.adapterInstance.connect).toHaveBeenCalled();
    });

    it("should create placeholder adapter when no databases but using external-only tools", async () => {
      await main({
        config: { toolFilter: "router" },
        databases: [],
        oauth: undefined,
      });

      // Should register a placeholder adapter
      expect(mocks.serverInstance.registerAdapter).toHaveBeenCalledWith(
        expect.anything(),
        "mysql:external",
      );
    });

    it("should require MySQL connection for base-core shortcut", async () => {
      await main({
        config: { toolFilter: "base-core" },
        databases: [
          { type: "mysql", host: "localhost", database: "test" },
        ],
        oauth: undefined,
      });

      expect(mocks.adapterInstance.connect).toHaveBeenCalled();
    });

    it("should require MySQL connection for ai-data shortcut", async () => {
      await main({
        config: { toolFilter: "ai-data" },
        databases: [
          { type: "mysql", host: "localhost", database: "test" },
        ],
        oauth: undefined,
      });

      expect(mocks.adapterInstance.connect).toHaveBeenCalled();
    });

    it("should require MySQL connection with no toolFilter", async () => {
      await main({
        config: {},
        databases: [
          { type: "mysql", host: "localhost", database: "test" },
        ],
        oauth: undefined,
      });

      expect(mocks.adapterInstance.connect).toHaveBeenCalled();
    });
  });

  describe("main", () => {
    it("should fail if no database config provided", async () => {
      await expect(
        main({
          config: {},
          databases: [],
          oauth: undefined,
        }),
      ).rejects.toThrow("process.exit(1)");

      expect(cliError).toHaveBeenCalledWith(
        "No database connection specified",
        expect.stringContaining("--mysql"),
      );
    });

    it("should start server with valid config", async () => {
      await main({
        config: {},
        databases: [
          { type: "mysql", host: "localhost", database: "test" },
        ],
        oauth: undefined,
      });

      expect(mocks.createServer).toHaveBeenCalled();
      expect(mocks.MySQLAdapter).toHaveBeenCalled(); // verify class instantiation
      expect(mocks.adapterInstance.connect).toHaveBeenCalled();
      expect(mocks.serverInstance.registerAdapter).toHaveBeenCalled();
      expect(mocks.serverInstance.start).toHaveBeenCalled();
    });

    it("should handle startup error via cliFatal", async () => {
      mocks.serverInstance.start.mockRejectedValue(new Error("Startup failed"));

      await expect(
        main({
          config: {},
          databases: [
            { type: "mysql", host: "localhost", database: "test" },
          ],
          oauth: undefined,
        }),
      ).rejects.toThrow("process.exit(1)");

      expect(cliFatal).toHaveBeenCalledWith(
        "Server startup failed",
        expect.any(Error),
      );
    });

    it("should log oauth configuration if enabled", async () => {
      await main({
        config: {},
        databases: [
          { type: "mysql", host: "localhost", database: "test" },
        ],
        oauth: {
          enabled: true,
          issuer: "https://issuer.com",
          audience: "aud",
        },
      });

      expect(cliInfo).toHaveBeenCalledWith(
        "OAuth authentication enabled",
      );
    });

    it("should exit immediately if shouldExit is true", async () => {
      await expect(
        main({
          config: {},
          databases: [],
          oauth: undefined,
          shouldExit: true,
        }),
      ).rejects.toThrow("process.exit(0)");
    });

    it("should handle graceful shutdown on signal", async () => {
      // Override mockExit to NOT throw for this test to avoid unhandled rejections from async void handler
      mockExit.mockImplementation(() => {
        return undefined as never;
      });

      const handlers: Record<string, () => void> = {};
      const originalOn = process.on.bind(process);

      const onSpy = vi
        .spyOn(process, "on")
        .mockImplementation((event, listener) => {
          if (event === "SIGINT" || event === "SIGTERM") {
            handlers[event as string] = listener as () => void;
            return process;
          }
          return originalOn(event, listener);
        });

      await main({
        config: {},
        databases: [
          { type: "mysql", host: "localhost", database: "test" },
        ],
        oauth: undefined,
      });

      expect(handlers["SIGINT"]).toBeDefined();
      expect(handlers["SIGTERM"]).toBeDefined();

      // Trigger shutdown (SIGINT)
      handlers["SIGINT"]();

      // Wait for async execution
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mocks.serverInstance.stop).toHaveBeenCalled();
      expect(cliInfo).toHaveBeenCalledWith("Shutting down...");
      expect(mockExit).toHaveBeenCalledWith(0);

      onSpy.mockRestore();
    });
  });
});
