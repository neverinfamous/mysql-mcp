/**
 * mysql-mcp - Sandbox Factory Unit Tests
 *
 * Tests for sandbox factory functions: mode management,
 * sandbox/pool creation, and mode info retrieval.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
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
    // Reset default mode
    setDefaultSandboxMode("isolate");
  });

  // ===========================================================================
  // Mode management
  // ===========================================================================
  describe("setDefaultSandboxMode / getDefaultSandboxMode", () => {
    it("should default to 'isolate'", () => {
      expect(getDefaultSandboxMode()).toBe("isolate");
    });

    it("should throw when setting to unsupported 'vm'", () => {
      expect(() => setDefaultSandboxMode("vm")).toThrowError("Only 'isolate' mode is supported.");
    });

    it("should throw when setting to unsupported 'worker'", () => {
      expect(() => setDefaultSandboxMode("worker")).toThrowError("Only 'isolate' mode is supported.");
    });
  });

  describe("getAvailableSandboxModes", () => {
    it("should return only isolate mode", () => {
      const modes = getAvailableSandboxModes();
      expect(modes).toContain("isolate");
      expect(modes).toHaveLength(1);
    });
  });

  // ===========================================================================
  // createSandbox
  // ===========================================================================
  describe("createSandbox", () => {
    it("should create an isolate sandbox", () => {
      const sandbox = createSandbox("isolate");
      expect(sandbox).toBeDefined();
      expect(sandbox.isHealthy()).toBe(true);
      expect(sandbox.execute).toBeTypeOf("function");
      expect(sandbox.dispose).toBeTypeOf("function");
      sandbox.dispose();
    });

    it("should throw for vm mode", () => {
      expect(() => createSandbox("vm")).toThrowError("Only 'isolate' mode is supported");
    });

    it("should throw for worker mode", () => {
      expect(() => createSandbox("worker")).toThrowError("Only 'isolate' mode is supported");
    });

    it("should use default mode when no mode specified", () => {
      const sandbox = createSandbox();
      expect(sandbox).toBeDefined();
      expect(sandbox.isHealthy()).toBe(true);
      sandbox.dispose();
    });

    it("should accept sandbox options", () => {
      const sandbox = createSandbox("isolate", {
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
    it("should create an isolate pool", () => {
      const pool = createSandboxPool("isolate", {
        minInstances: 0,
        maxInstances: 2,
      });
      expect(pool).toBeDefined();
      expect(pool.getStats).toBeTypeOf("function");
      pool.dispose();
    });

    it("should throw for worker mode", () => {
      expect(() => createSandboxPool("worker")).toThrowError("Only 'isolate' mode is supported");
    });

    it("should use default mode when no mode specified", () => {
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
    it("should return isolate mode info", () => {
      const info = getSandboxModeInfo("isolate");
      expect(info.name).toBe("Native Isolate");
      expect(info.isolation).toContain("V8");
      expect(info.security).toContain("Maximum");
    });

    it("should throw for vm mode", () => {
      expect(() => getSandboxModeInfo("vm")).toThrowError("Only 'isolate' mode is supported.");
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
