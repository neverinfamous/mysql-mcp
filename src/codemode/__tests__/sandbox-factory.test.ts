/**
 * mysql-mcp - Sandbox Factory Unit Tests
 *
 * Tests for sandbox factory functions: mode management,
 * sandbox/pool creation, and mode info retrieval.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  setDefaultSandboxMode,
  getDefaultSandboxMode,
  getAvailableSandboxModes,
  createSandbox,
  createSandboxPool,
  getSandboxModeInfo,
} from "../sandbox-factory.js";

// Suppress logger
vi.mock("../../utils/logger.js", () => ({
  logger: { info: vi.fn(), warning: vi.fn(), error: vi.fn() },
}));

describe("Sandbox Factory", () => {
  afterEach(() => {
    // Reset default mode to 'worker' after each test
    setDefaultSandboxMode("worker");
  });

  // ===========================================================================
  // Mode management
  // ===========================================================================
  describe("setDefaultSandboxMode / getDefaultSandboxMode", () => {
    it("should default to 'worker'", () => {
      expect(getDefaultSandboxMode()).toBe("worker");
    });

    it("should allow setting to 'vm'", () => {
      setDefaultSandboxMode("vm");
      expect(getDefaultSandboxMode()).toBe("vm");
    });

    it("should allow setting back to 'worker'", () => {
      setDefaultSandboxMode("vm");
      setDefaultSandboxMode("worker");
      expect(getDefaultSandboxMode()).toBe("worker");
    });
  });

  describe("getAvailableSandboxModes", () => {
    it("should return both modes", () => {
      const modes = getAvailableSandboxModes();
      expect(modes).toContain("vm");
      expect(modes).toContain("worker");
      expect(modes).toHaveLength(2);
    });
  });

  // ===========================================================================
  // createSandbox
  // ===========================================================================
  describe("createSandbox", () => {
    it("should create a vm sandbox when mode is 'vm'", () => {
      const sandbox = createSandbox("vm");
      expect(sandbox).toBeDefined();
      expect(sandbox.isHealthy()).toBe(true);
      expect(sandbox.execute).toBeTypeOf("function");
      expect(sandbox.dispose).toBeTypeOf("function");
      sandbox.dispose();
    });

    it("should create a worker sandbox when mode is 'worker'", () => {
      const sandbox = createSandbox("worker");
      expect(sandbox).toBeDefined();
      expect(sandbox.isHealthy()).toBe(true);
      sandbox.dispose();
    });

    it("should use default mode when no mode specified", () => {
      setDefaultSandboxMode("vm");
      const sandbox = createSandbox();
      expect(sandbox).toBeDefined();
      expect(sandbox.isHealthy()).toBe(true);
      sandbox.dispose();
    });

    it("should accept sandbox options", () => {
      const sandbox = createSandbox("vm", {
        memoryLimitMb: 64,
        timeoutMs: 5000,
      });
      expect(sandbox).toBeDefined();
      sandbox.dispose();
    });
  });

  // ===========================================================================
  // createSandboxPool
  // ===========================================================================
  describe("createSandboxPool", () => {
    it("should create a vm pool", () => {
      const pool = createSandboxPool("vm", {
        minInstances: 0,
        maxInstances: 2,
      });
      expect(pool).toBeDefined();
      expect(pool.getStats).toBeTypeOf("function");
      pool.dispose();
    });

    it("should create a worker pool", () => {
      const pool = createSandboxPool("worker", {
        minInstances: 0,
        maxInstances: 2,
      });
      expect(pool).toBeDefined();
      pool.dispose();
    });

    it("should use default mode when no mode specified", () => {
      setDefaultSandboxMode("vm");
      const pool = createSandboxPool(undefined, {
        minInstances: 0,
        maxInstances: 2,
      });
      expect(pool).toBeDefined();
      pool.dispose();
    });
  });

  // ===========================================================================
  // getSandboxModeInfo
  // ===========================================================================
  describe("getSandboxModeInfo", () => {
    it("should return worker mode info", () => {
      const info = getSandboxModeInfo("worker");
      expect(info.name).toBe("Worker Thread");
      expect(info.isolation).toContain("V8");
      expect(info.security).toContain("Enhanced");
    });

    it("should return vm mode info", () => {
      const info = getSandboxModeInfo("vm");
      expect(info.name).toBe("VM Context");
      expect(info.isolation).toContain("Script isolation");
    });

    it("should have all required fields", () => {
      for (const mode of getAvailableSandboxModes()) {
        const info = getSandboxModeInfo(mode);
        expect(info.name).toBeTruthy();
        expect(info.isolation).toBeTruthy();
        expect(info.performance).toBeTruthy();
        expect(info.security).toBeTruthy();
        expect(info.requirements).toBeTruthy();
      }
    });
  });
});
