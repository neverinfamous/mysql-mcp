import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as child_process from "child_process";
import { createMockRequestContext } from "../../../../../__tests__/mocks/index.js";
import { createShellVersionTool } from "../info.js";

vi.mock("child_process", () => ({
  spawn: vi.fn(),
}));

describe("Shell Info Tools", () => {
  let mockContext: ReturnType<typeof createMockRequestContext>;
  let mockSpawn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockContext = createMockRequestContext();
    mockSpawn = child_process.spawn as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function setupMockSpawn(stdout = "", stderr = "", exitCode = 0) {
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

  describe("mysqlsh_version", () => {
    it("should return version info", async () => {
      setupMockSpawn("mysqlsh   Ver 8.0.35 for Linux on x86_64");

      const tool = createShellVersionTool();
      const result = (await tool.handler({}, mockContext)) as any;

      expect(result.success).toBe(true);
      expect(result.version).toBe("8.0.35");
      expect(child_process.spawn).toHaveBeenCalledWith(
        "mysqlsh",
        ["--version"],
        expect.any(Object),
      );
    });

    it("should handle unknown version format", async () => {
      setupMockSpawn("Some other output");

      const tool = createShellVersionTool();
      const result = (await tool.handler({}, mockContext)) as any;

      expect(result.version).toBe("unknown");
    });
  });
});
