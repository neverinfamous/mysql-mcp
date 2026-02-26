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

      const serialized = sandbox.serializeBindings(bindings);
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

      const serialized = sandbox.serializeBindings(bindings);
      expect(serialized).toHaveProperty("_topLevel");
      expect(serialized["_topLevel"]).toContain("readQuery");
      expect(serialized["_topLevel"]).toContain("help");
    });

    it("should handle empty bindings", () => {
      const serialized = sandbox.serializeBindings({});
      expect(Object.keys(serialized)).toHaveLength(0);
    });
  });

  // ===========================================================================
  // calculateMetrics
  // ===========================================================================
  describe("calculateMetrics", () => {
    it("should calculate correct metrics", () => {
      const metrics = sandbox.calculateMetrics(0, 150, 1000, 3000);
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
});
