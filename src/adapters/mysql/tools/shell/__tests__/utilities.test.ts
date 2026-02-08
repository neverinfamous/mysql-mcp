import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as child_process from "child_process";
import {
  createMockMySQLAdapter,
  createMockRequestContext,
} from "../../../../../__tests__/mocks/index.js";
import { createShellCheckUpgradeTool } from "../utilities.js";

vi.mock("child_process", () => ({
  spawn: vi.fn(),
}));

describe("Shell Utilities Tools", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let mockContext: ReturnType<typeof createMockRequestContext>;
  let mockSpawn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    mockContext = createMockRequestContext();
    mockSpawn = child_process.spawn as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function setupMockSpawn(stdout = "", stderr = "", exitCode = 0) {
    // Explicitly clear any previous call history
    mockSpawn.mockClear();

    const mockChild = {
      stdout: {
        on: vi.fn().mockImplementation((event, cb) => {
          if (event === "data") cb(Buffer.from(stdout));
        }),
      },
      stderr: {
        on: vi.fn().mockImplementation((event, cb) => {
          if (event === "data") cb(Buffer.from(stderr));
        }),
      },
      stdin: {
        write: vi.fn(),
        end: vi.fn(),
      },
      on: vi.fn().mockImplementation((event, cb) => {
        if (event === "close") cb(exitCode);
      }),
      kill: vi.fn(),
    };
    mockSpawn.mockReturnValue(mockChild);
    return mockChild;
  }

  describe("mysqlsh_check_upgrade", () => {
    it("should run upgrade check and return JSON result", async () => {
      const successJson = JSON.stringify({
        success: true,
        result: { status: "OK" },
      });
      setupMockSpawn(`${successJson}\n`, "");

      const tool = createShellCheckUpgradeTool();
      const result = (await tool.handler(
        { targetVersion: "8.0.35" },
        mockContext,
      )) as any;

      expect(result.success).toBe(true);
      expect(result.upgradeCheck).toEqual({ status: "OK" });

      // Check command args
      const callArgs = mockSpawn.mock.calls[0][1];
      expect(callArgs).toContain("--uri");
      expect(callArgs).toContain("--js");
      expect(callArgs[4]).toContain("util.checkForServerUpgrade");
    });

    it("should return raw output if JSON parsing fails", async () => {
      setupMockSpawn("Raw text output", "", 0);

      const tool = createShellCheckUpgradeTool();
      const result = (await tool.handler({}, mockContext)) as any;

      expect(result.success).toBe(true);
      expect(result.upgradeCheck).toEqual({ raw: "Raw text output" });
    });

    it("should return structured error for failed execution", async () => {
      // When execShellJS fails (exit code 1), handler returns structured error
      setupMockSpawn("some stderr output", "", 1);

      const tool = createShellCheckUpgradeTool();

      const result = (await tool.handler(
        {
          targetVersion: "8.4.0",
        },
        mockContext,
      )) as any;

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should return raw output if JSON parsing fails but exit code is 0", async () => {
      setupMockSpawn("Non-JSON output", "", 0);

      const tool = createShellCheckUpgradeTool();
      const result = (await tool.handler(
        { targetVersion: "8.0.0" },
        mockContext,
      )) as any;

      expect(result.upgradeCheck.raw).toBe("Non-JSON output");
    });

    it("should always use JSON outputFormat internally for reliable parsing", async () => {
      setupMockSpawn(JSON.stringify({ success: true }));

      const tool = createShellCheckUpgradeTool();
      await tool.handler(
        {
          targetVersion: "8.4.0",
          outputFormat: "TEXT", // User can request TEXT, but internally we use JSON
        },
        mockContext,
      );

      const jsArg = mockSpawn.mock.calls[0][1][4];
      // We force JSON internally for reliable parsing
      expect(jsArg).toContain('outputFormat: "JSON"');
    });

    it("should include targetVersion option when provided", async () => {
      setupMockSpawn(JSON.stringify({ success: true }));

      const tool = createShellCheckUpgradeTool();
      await tool.handler({ targetVersion: "8.4.0" }, mockContext);

      const jsArg = mockSpawn.mock.calls[0][1][4] as string;
      expect(jsArg).toContain('targetVersion: "8.4.0"');
    });

    it("should include outputFormat option when provided alone", async () => {
      setupMockSpawn(JSON.stringify({ success: true }));

      const tool = createShellCheckUpgradeTool();
      await tool.handler({ outputFormat: "JSON" }, mockContext);

      const jsArg = mockSpawn.mock.calls[0][1][4] as string;
      expect(jsArg).toContain('outputFormat: "JSON"');
    });

    it("should include targetVersion and always use JSON outputFormat", async () => {
      setupMockSpawn(JSON.stringify({ success: true }));

      const tool = createShellCheckUpgradeTool();
      await tool.handler(
        { targetVersion: "9.0.0", outputFormat: "TEXT" },
        mockContext,
      );

      const jsArg = mockSpawn.mock.calls[0][1][4] as string;
      expect(jsArg).toContain('targetVersion: "9.0.0"');
      // We always force JSON internally for reliable parsing
      expect(jsArg).toContain('outputFormat: "JSON"');
    });
  });
});
