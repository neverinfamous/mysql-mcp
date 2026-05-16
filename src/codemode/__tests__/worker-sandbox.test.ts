/**
 * mysql-mcp - Worker Sandbox Unit Tests
 *
 * Tests for WorkerSandbox and WorkerSandboxPool.
 * Mocks worker_threads to test sandbox lifecycle and pool management.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WorkerSandbox, WorkerSandboxPool } from "../worker-sandbox.js";

// Suppress logger
vi.mock("../../utils/logger.js", () => ({
  logger: { info: vi.fn(), warning: vi.fn(), error: vi.fn() },
}));

// Mock worker_threads
vi.mock("node:worker_threads", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:worker_threads")>();
  return {
    ...actual,
    Worker: class MockWorker {
      listeners: Record<string, ((data: any) => void)[]> = {};
      
      constructor(path: string, options: any) {
        setTimeout(() => {
          if (options.workerData.code.includes("timeout")) {
            // Do nothing, let timeout trigger
          } else if (options.workerData.code.includes("invalid code {")) {
            this.emit("error", new Error("Syntax error"));
          } else if (options.workerData.code.includes("rpc")) {
            // Trigger rpc
            options.workerData.rpcPort.postMessage({ id: 0, group: "core", method: "testMethod", args: [] });
            setTimeout(() => {
              this.emit("message", { success: true, result: "rpc result" });
            }, 10);
          } else {
            this.emit("message", { success: true, result: options.workerData.code.includes("1 + 1") ? 2 : 42 });
          }
        }, 10);
      }
      
      on(event: string, fn: (data: any) => void) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(fn);
      }
      
      emit(event: string, data: any) {
        if (this.listeners[event]) {
          this.listeners[event].forEach(fn => fn(data));
        }
      }
      
      terminate() {
        return Promise.resolve();
      }
    }
  };
});

describe("WorkerSandbox", () => {
  let sandbox: WorkerSandbox;

  beforeEach(() => {
    sandbox = WorkerSandbox.create({
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
    it("should create a worker sandbox with default options", () => {
      const s = WorkerSandbox.create();
      expect(s).toBeDefined();
      expect(s.isHealthy()).toBe(true);
      s.dispose();
    });

    it("should create a worker sandbox with custom options", () => {
      expect(sandbox).toBeDefined();
      expect(sandbox.isHealthy()).toBe(true);
    });
  });

  // ===========================================================================
  // serializeBindings
  // ===========================================================================
  describe("serializeBindings", () => {
    it("should serialize group methods", () => {
      const bindings = {
        core: {
          readQuery: vi.fn(),
          writeQuery: vi.fn(),
          help: vi.fn(),
        },
        json: {
          extract: vi.fn(),
        },
      };

      const serialized = (sandbox as any).serializeBindings(bindings);
      expect(serialized).toHaveProperty("core");
      expect(serialized).toHaveProperty("json");
      expect(serialized["core"]).toContain("readQuery");
      expect(serialized["core"]).toContain("writeQuery");
    });

    it("should handle top-level function bindings", () => {
      const bindings = {
        readQuery: vi.fn(),
        help: vi.fn(),
        core: { readQuery: vi.fn() },
      };

      const serialized = (sandbox as any).serializeBindings(bindings);
      expect(serialized).toHaveProperty("_topLevel");
      expect(serialized["_topLevel"]).toContain("readQuery");
      expect(serialized["_topLevel"]).toContain("help");
    });

    it("should handle empty bindings", () => {
      const serialized = (sandbox as any).serializeBindings({});
      expect(Object.keys(serialized)).toHaveLength(0);
    });
  });

  // ===========================================================================
  // calculateMetrics
  // ===========================================================================
  describe("calculateMetrics", () => {
    it("should calculate correct metrics", () => {
      const metrics = (sandbox as any).calculateMetrics(0, 150, 1000, 3000);
      expect(metrics.wallTimeMs).toBe(150);
      expect(metrics.memoryUsedMb).toBeGreaterThanOrEqual(0);
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
      sandbox.dispose();
      expect(sandbox.isHealthy()).toBe(false);
    });
  });

  // ===========================================================================
  // execute
  // ===========================================================================
  describe("execute", () => {
    it("should execute valid code and return result", async () => {
      const result = await sandbox.execute("return 42;", {});
      expect(result.success).toBe(true);
      expect(result.result).toBe(42);
    });

    it("should fail on syntax error", async () => {
      const result = await sandbox.execute("invalid code {", {});
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should timeout if execution takes too long", async () => {
      const fastSandbox = WorkerSandbox.create({ memoryLimitMb: 64, timeoutMs: 10, cpuLimitMs: 10 });
      const result = await fastSandbox.execute("timeout test", {});
      expect(result.success).toBe(false);
      expect(result.error).toContain("timeout");
      fastSandbox.dispose();
    });

    it("should successfully call an API binding via RPC", async () => {
      const apiBindings = {
        core: {
          testMethod: vi.fn().mockResolvedValue("rpc result")
        }
      };
      // The code should call mysql.core.testMethod()
      const code = "rpc test: await mysql.core.testMethod();";
      const result = await sandbox.execute(code, apiBindings);
      expect(result.success).toBe(true);
      expect(result.result).toBe("rpc result");
      // Wait a tick for RPC to process if it's async
      await new Promise(r => setTimeout(r, 50));
      expect(apiBindings.core.testMethod).toHaveBeenCalled();
    });

    it("should fail on disposed sandbox", async () => {
      sandbox.dispose();
      const result = await sandbox.execute("return 1", {});
      expect(result.success).toBe(false);
      expect(result.error).toContain("disposed");
    });
  });
});

// =============================================================================
// WorkerSandboxPool
// =============================================================================
describe("WorkerSandboxPool", () => {
  let pool: WorkerSandboxPool;

  beforeEach(() => {
    pool = new WorkerSandboxPool(
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
      expect(pool.getStats().max).toBe(3);
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
      expect(stats.inUse).toBe(0);
    });
  });

  describe("dispose", () => {
    it("should dispose without error", () => {
      pool.initialize();
      pool.dispose();
      // After dispose, pool may still report stats but should not be usable
      const stats = pool.getStats();
      expect(stats).toBeDefined();
    });
  });

  describe("execute", () => {
    it("should execute code through the pool", async () => {
      const result = await pool.execute("return 1 + 1;", {});
      expect(result.success).toBe(true);
      expect(result.result).toBe(2);
    });

    it("should return error if pool is exhausted", async () => {
      // Pool has maxInstances = 3
      const code = "await new Promise(r => setTimeout(r, 50)); return 1;";
      const promises = [
        pool.execute(code, {}),
        pool.execute(code, {}),
        pool.execute(code, {}),
        pool.execute(code, {}) // 4th should fail
      ];
      
      const results = await Promise.all(promises);
      const failures = results.filter(r => !r.success && r.error?.includes("exhausted"));
      expect(failures.length).toBeGreaterThan(0);
    });

    it("should fail on disposed pool", async () => {
      pool.dispose();
      const result = await pool.execute("return 1", {});
      expect(result.success).toBe(false);
      expect(result.error).toContain("disposed");
    });
  });
});
