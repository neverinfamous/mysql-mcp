/**
 * mysql-mcp - Code Mode Sandbox Unit Tests
 *
 * Tests for CodeModeSandbox (vm-based) and SandboxPool.
 * Uses real Node.js vm module for sandbox execution.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CodeModeSandbox, SandboxPool } from "../sandbox.js";

// Suppress logger
vi.mock("../../utils/logger.js", () => ({
  logger: { info: vi.fn(), warning: vi.fn(), error: vi.fn() },
}));

describe("CodeModeSandbox", () => {
  let sandbox: CodeModeSandbox;

  beforeEach(() => {
    sandbox = CodeModeSandbox.create({
      memoryLimitMb: 64,
      timeoutMs: 5000,
      cpuLimitMs: 5000,
    });
  });

  afterEach(() => {
    sandbox.dispose();
  });

  // ===========================================================================
  // Creation
  // ===========================================================================
  describe("create", () => {
    it("should create a sandbox with default options", () => {
      const s = CodeModeSandbox.create();
      expect(s).toBeDefined();
      expect(s.isHealthy()).toBe(true);
      s.dispose();
    });

    it("should create a sandbox with custom options", () => {
      expect(sandbox).toBeDefined();
      expect(sandbox.isHealthy()).toBe(true);
    });
  });

  // ===========================================================================
  // Execution
  // ===========================================================================
  describe("execute", () => {
    it("should execute simple code and return result", async () => {
      const result = await sandbox.execute("return 42", {});
      expect(result.success).toBe(true);
      expect(result.result).toBe(42);
      expect(result.metrics.wallTimeMs).toBeGreaterThanOrEqual(0);
    });

    it("should provide access to api bindings", async () => {
      const mockApi = {
        core: {
          readQuery: vi
            .fn()
            .mockResolvedValue({ rows: [{ id: 1 }], rowsAffected: 0 }),
        },
      };
      const result = await sandbox.execute(
        "return await mysql.core.readQuery('SELECT 1')",
        mockApi,
      );
      expect(result.success).toBe(true);
      expect(mockApi.core.readQuery).toHaveBeenCalledWith("SELECT 1");
    });

    it("should capture console output", async () => {
      await sandbox.execute(
        'console.log("hello"); console.warn("warning")',
        {},
      );
      const output = sandbox.getConsoleOutput();
      expect(output.some((line: string) => line.includes("hello"))).toBe(true);
      expect(output.some((line: string) => line.includes("warning"))).toBe(
        true,
      );
    });

    it("should handle code errors gracefully", async () => {
      const result = await sandbox.execute("throw new Error('test error')", {});
      expect(result.success).toBe(false);
      expect(result.error).toContain("test error");
    });

    it("should handle syntax errors", async () => {
      const result = await sandbox.execute("const x = {{{", {});
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it("should handle async code", async () => {
      const result = await sandbox.execute(
        "const val = await Promise.resolve(99); return val",
        {},
      );
      expect(result.success).toBe(true);
      expect(result.result).toBe(99);
    });

    it("should fail on disposed sandbox", async () => {
      sandbox.dispose();
      const result = await sandbox.execute("return 1", {});
      expect(result.success).toBe(false);
      expect(result.error).toContain("disposed");
    });

    it("should include execution metrics", async () => {
      const result = await sandbox.execute("return 1", {});
      expect(result.metrics).toBeDefined();
      expect(result.metrics.wallTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.metrics.memoryUsedMb).toBeGreaterThanOrEqual(0);
    });

    it("should handle console.error and console.info", async () => {
      await sandbox.execute('console.error("err"); console.info("inf")', {});
      const output = sandbox.getConsoleOutput();
      expect(output.some((line: string) => line.includes("err"))).toBe(true);
      expect(output.some((line: string) => line.includes("inf"))).toBe(true);
    });
  });

  // ===========================================================================
  // calculateMetrics
  // ===========================================================================
  describe("calculateMetrics", () => {
    it("should calculate correct metrics", () => {
      const metrics = sandbox.calculateMetrics(0, 100, 1000, 2000);
      expect(metrics.wallTimeMs).toBe(100);
      expect(metrics.memoryUsedMb).toBeGreaterThanOrEqual(0);
    });
  });

  // ===========================================================================
  // Console output management
  // ===========================================================================
  describe("getConsoleOutput / clearConsoleOutput", () => {
    it("should return empty array initially", () => {
      expect(sandbox.getConsoleOutput()).toHaveLength(0);
    });

    it("should clear console output", async () => {
      await sandbox.execute('console.log("test")', {});
      expect(sandbox.getConsoleOutput().length).toBeGreaterThan(0);
      sandbox.clearConsoleOutput();
      expect(sandbox.getConsoleOutput()).toHaveLength(0);
    });
  });

  // ===========================================================================
  // Health and disposal
  // ===========================================================================
  describe("isHealthy / dispose", () => {
    it("should be healthy after creation", () => {
      expect(sandbox.isHealthy()).toBe(true);
    });

    it("should be unhealthy after dispose", () => {
      sandbox.dispose();
      expect(sandbox.isHealthy()).toBe(false);
    });

    it("should handle multiple dispose calls", () => {
      sandbox.dispose();
      sandbox.dispose(); // Should not throw
      expect(sandbox.isHealthy()).toBe(false);
    });
  });
});

// =============================================================================
// SandboxPool
// =============================================================================
describe("SandboxPool", () => {
  let pool: SandboxPool;

  beforeEach(() => {
    pool = new SandboxPool(
      { minInstances: 0, maxInstances: 3, idleTimeoutMs: 1000 },
      { memoryLimitMb: 64, timeoutMs: 5000, cpuLimitMs: 5000 },
    );
  });

  afterEach(() => {
    pool.dispose();
  });

  describe("initialize", () => {
    it("should initialize without error", () => {
      pool.initialize();
      const stats = pool.getStats();
      expect(stats.max).toBe(3);
    });

    it("should pre-warm minimum instances", () => {
      const warmPool = new SandboxPool(
        { minInstances: 2, maxInstances: 5, idleTimeoutMs: 1000 },
        { memoryLimitMb: 64, timeoutMs: 5000, cpuLimitMs: 5000 },
      );
      warmPool.initialize();
      expect(warmPool.getStats().available).toBe(2);
      warmPool.dispose();
    });
  });

  describe("acquire / release", () => {
    it("should acquire and release sandboxes", () => {
      pool.initialize();
      const s = pool.acquire();
      expect(s).toBeDefined();
      expect(s.isHealthy()).toBe(true);
      pool.release(s);
    });

    it("should track in-use count", () => {
      pool.initialize();
      const s = pool.acquire();
      expect(pool.getStats().inUse).toBe(1);
      pool.release(s);
      expect(pool.getStats().inUse).toBe(0);
    });

    it("should throw when pool is exhausted", () => {
      pool.initialize();
      const acquired: CodeModeSandbox[] = [];
      for (let i = 0; i < 3; i++) {
        acquired.push(pool.acquire());
      }
      expect(() => pool.acquire()).toThrow();
      for (const s of acquired) pool.release(s);
    });

    it("should dispose unhealthy sandbox on release", () => {
      pool.initialize();
      const s = pool.acquire();
      s.dispose(); // Make it unhealthy
      pool.release(s);
      expect(pool.getStats().available).toBe(0);
    });
  });

  describe("execute", () => {
    it("should execute code using pooled sandbox", async () => {
      pool.initialize();
      const result = await pool.execute("return 42", {});
      expect(result.success).toBe(true);
      expect(result.result).toBe(42);
    });

    it("should handle execution errors", async () => {
      pool.initialize();
      const result = await pool.execute("throw new Error('pool error')", {});
      expect(result.success).toBe(false);
      expect(result.error).toContain("pool error");
    });
  });

  describe("cleanup", () => {
    it("should clean up idle sandboxes", () => {
      pool.initialize();
      // Acquire and release to create idle sandbox
      const s = pool.acquire();
      pool.release(s);
      expect(pool.getStats().available).toBeGreaterThan(0);

      // Advance time past idle timeout
      vi.useFakeTimers();
      vi.advanceTimersByTime(2000);
      pool.cleanup();
      vi.useRealTimers();
    });
  });

  describe("getStats", () => {
    it("should return correct stats", () => {
      pool.initialize();
      const stats = pool.getStats();
      expect(stats).toHaveProperty("available");
      expect(stats).toHaveProperty("inUse");
      expect(stats).toHaveProperty("max");
      expect(stats.max).toBe(3);
    });
  });

  describe("dispose", () => {
    it("should dispose all sandboxes", () => {
      pool.initialize();
      const s = pool.acquire();
      pool.release(s);
      pool.dispose();
      expect(pool.getStats().available).toBe(0);
    });
  });
});
