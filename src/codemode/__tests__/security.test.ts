/**
 * mysql-mcp - Code Mode Security Unit Tests
 *
 * Tests for CodeModeSecurityManager: validation, rate limiting,
 * result sanitization, audit logging, and cleanup.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { CodeModeSecurityManager } from "../security.js";
import type { SandboxResult } from "../types.js";

// Suppress logger output
vi.mock("../../utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  },
}));

describe("CodeModeSecurityManager", () => {
  let manager: CodeModeSecurityManager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new CodeModeSecurityManager();
  });

  // ===========================================================================
  // validateCode
  // ===========================================================================
  describe("validateCode", () => {
    it("should accept valid code", () => {
      const result = manager.validateCode(
        'const x = await mysql.core.readQuery("SELECT 1")',
      );
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject empty string", () => {
      const result = manager.validateCode("");
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("non-empty string");
    });

    it("should reject non-string input", () => {
      const result = manager.validateCode(null as unknown as string);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("non-empty string");
    });

    it("should reject code exceeding max length", () => {
      const longCode = "x".repeat(100_000);
      const result = manager.validateCode(longCode);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("maximum length");
    });

    it("should detect require() pattern", () => {
      const result = manager.validateCode('const fs = require("fs")');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should detect dynamic import()", () => {
      const result = manager.validateCode('const m = import("child_process")');
      expect(result.valid).toBe(false);
    });

    it("should detect process access", () => {
      const result = manager.validateCode("process.exit(1)");
      expect(result.valid).toBe(false);
    });

    it("should detect eval()", () => {
      const result = manager.validateCode('eval("malicious")');
      expect(result.valid).toBe(false);
    });

    it("should detect Function constructor", () => {
      const result = manager.validateCode('new Function("return 1")');
      expect(result.valid).toBe(false);
    });

    it("should detect __proto__ access", () => {
      const result = manager.validateCode("obj.__proto__.polluted = true");
      expect(result.valid).toBe(false);
    });

    it("should detect constructor.constructor chaining", () => {
      const result = manager.validateCode(
        '"".constructor.constructor("return this")()',
      );
      expect(result.valid).toBe(false);
    });

    it("should detect globalThis access", () => {
      const result = manager.validateCode("globalThis.foo = 1");
      expect(result.valid).toBe(false);
    });

    it("should detect child_process", () => {
      const result = manager.validateCode("child_process.exec('ls')");
      expect(result.valid).toBe(false);
    });

    it("should detect fs access", () => {
      const result = manager.validateCode("fs.readFileSync('/etc/passwd')");
      expect(result.valid).toBe(false);
    });

    it("should detect net access", () => {
      const result = manager.validateCode("net.connect(80)");
      expect(result.valid).toBe(false);
    });

    it("should detect http access", () => {
      const result = manager.validateCode("http.get('http://evil.test')");
      expect(result.valid).toBe(false);
    });

    it("should detect https access", () => {
      const result = manager.validateCode("https.get('https://evil.test')");
      expect(result.valid).toBe(false);
    });

    it("should detect bracket-notation constructor access", () => {
      const result = manager.validateCode('x["constructor"]');
      expect(result.valid).toBe(false);
    });

    it("should detect Reflect.construct", () => {
      const result = manager.validateCode("Reflect.construct(Array, [])");
      expect(result.valid).toBe(false);
    });

    it("should accumulate multiple blocked pattern errors", () => {
      const result = manager.validateCode(
        'require("fs"); process.exit(1); eval("x")',
      );
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });

    it("should respect custom maxCodeLength", () => {
      const small = new CodeModeSecurityManager({ maxCodeLength: 10 });
      const result = small.validateCode("a".repeat(11));
      expect(result.valid).toBe(false);
    });
  });

  // ===========================================================================
  // checkRateLimit
  // ===========================================================================
  describe("checkRateLimit", () => {
    it("should allow first request", () => {
      expect(manager.checkRateLimit("client-1")).toBe(true);
    });

    it("should allow requests within limit", () => {
      for (let i = 0; i < 59; i++) {
        expect(manager.checkRateLimit("client-2")).toBe(true);
      }
    });

    it("should block when limit exceeded", () => {
      const smallLimit = new CodeModeSecurityManager({
        maxExecutionsPerMinute: 3,
      });
      expect(smallLimit.checkRateLimit("c")).toBe(true);
      expect(smallLimit.checkRateLimit("c")).toBe(true);
      expect(smallLimit.checkRateLimit("c")).toBe(true);
      expect(smallLimit.checkRateLimit("c")).toBe(false);
    });

    it("should reset after window expires", () => {
      const smallLimit = new CodeModeSecurityManager({
        maxExecutionsPerMinute: 1,
      });
      expect(smallLimit.checkRateLimit("c")).toBe(true);
      expect(smallLimit.checkRateLimit("c")).toBe(false);

      // Simulate time passage by manipulating the internal map
      vi.useFakeTimers();
      vi.advanceTimersByTime(61_000);
      expect(smallLimit.checkRateLimit("c")).toBe(true);
      vi.useRealTimers();
    });

    it("should track clients independently", () => {
      const smallLimit = new CodeModeSecurityManager({
        maxExecutionsPerMinute: 1,
      });
      expect(smallLimit.checkRateLimit("a")).toBe(true);
      expect(smallLimit.checkRateLimit("a")).toBe(false);
      expect(smallLimit.checkRateLimit("b")).toBe(true);
    });
  });

  // ===========================================================================
  // getRateLimitRemaining
  // ===========================================================================
  describe("getRateLimitRemaining", () => {
    it("should return full limit for unknown client", () => {
      expect(manager.getRateLimitRemaining("unknown")).toBe(60);
    });

    it("should decrease after requests", () => {
      manager.checkRateLimit("client");
      expect(manager.getRateLimitRemaining("client")).toBe(59);
    });

    it("should return 0 when exhausted", () => {
      const small = new CodeModeSecurityManager({
        maxExecutionsPerMinute: 2,
      });
      small.checkRateLimit("c");
      small.checkRateLimit("c");
      expect(small.getRateLimitRemaining("c")).toBe(0);
    });

    it("should return full limit after window expires", () => {
      manager.checkRateLimit("client");
      vi.useFakeTimers();
      vi.advanceTimersByTime(61_000);
      expect(manager.getRateLimitRemaining("client")).toBe(60);
      vi.useRealTimers();
    });
  });

  // ===========================================================================
  // sanitizeResult
  // ===========================================================================
  describe("sanitizeResult", () => {
    it("should pass through small results", () => {
      const input = { foo: "bar" };
      expect(manager.sanitizeResult(input)).toEqual(input);
    });

    it("should truncate oversized results", () => {
      const small = new CodeModeSecurityManager({ maxResultSize: 10 });
      const result = small.sanitizeResult({ data: "a".repeat(100) }) as {
        _truncated: boolean;
      };
      expect(result._truncated).toBe(true);
    });

    it("should handle non-serializable results", () => {
      const circular: Record<string, unknown> = {};
      circular.self = circular;
      const result = manager.sanitizeResult(circular) as {
        _error: string;
      };
      expect(result._error).toContain("could not be serialized");
    });
  });

  // ===========================================================================
  // auditLog
  // ===========================================================================
  describe("auditLog", () => {
    const makeResult = (success: boolean): SandboxResult => ({
      success,
      result: success ? "ok" : undefined,
      error: success ? undefined : "test error",
      stack: success ? undefined : "Error: test error\n  at line 1",
      metrics: { wallTimeMs: 10, cpuTimeMs: 5, memoryUsedMb: 1 },
    });

    it("should log successful executions", async () => {
      const { logger } = await import("../../utils/logger.js");
      const record = manager.createExecutionRecord(
        "const x = 1",
        makeResult(true),
        false,
        "client-1",
      );
      manager.auditLog(record);
      expect(logger.info).toHaveBeenCalled();
    });

    it("should log failed executions with warning", async () => {
      const { logger } = await import("../../utils/logger.js");
      const record = manager.createExecutionRecord(
        "bad code",
        makeResult(false),
        true,
      );
      manager.auditLog(record);
      expect(logger.warning).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // createExecutionRecord
  // ===========================================================================
  describe("createExecutionRecord", () => {
    it("should create record with correct fields", () => {
      const result: SandboxResult = {
        success: true,
        result: 42,
        metrics: { wallTimeMs: 10, cpuTimeMs: 5, memoryUsedMb: 1 },
      };
      const record = manager.createExecutionRecord(
        "const x = 1",
        result,
        false,
        "client-1",
      );

      expect(record.id).toBeTruthy();
      expect(record.clientId).toBe("client-1");
      expect(record.timestamp).toBeInstanceOf(Date);
      expect(record.codePreview).toBe("const x = 1");
      expect(record.result).toEqual(result);
      expect(record.readonly).toBe(false);
    });

    it("should truncate long code in preview", () => {
      const longCode = "x".repeat(300);
      const result: SandboxResult = {
        success: true,
        metrics: { wallTimeMs: 0, cpuTimeMs: 0, memoryUsedMb: 0 },
      };
      const record = manager.createExecutionRecord(longCode, result, true);

      expect(record.codePreview.length).toBeLessThan(longCode.length);
      expect(record.codePreview).toContain("...");
    });

    it("should handle undefined clientId", () => {
      const result: SandboxResult = {
        success: true,
        metrics: { wallTimeMs: 0, cpuTimeMs: 0, memoryUsedMb: 0 },
      };
      const record = manager.createExecutionRecord("x", result, false);
      expect(record.clientId).toBeUndefined();
    });
  });

  // ===========================================================================
  // cleanupRateLimits
  // ===========================================================================
  describe("cleanupRateLimits", () => {
    it("should remove expired entries", () => {
      const small = new CodeModeSecurityManager({
        maxExecutionsPerMinute: 1,
      });
      small.checkRateLimit("client-old");
      small.checkRateLimit("client-old"); // blocked

      vi.useFakeTimers();
      vi.advanceTimersByTime(61_000);
      small.cleanupRateLimits();

      // After cleanup, should have full limit again
      expect(small.getRateLimitRemaining("client-old")).toBe(1);
      vi.useRealTimers();
    });

    it("should keep active entries", () => {
      manager.checkRateLimit("active");
      manager.cleanupRateLimits();
      expect(manager.getRateLimitRemaining("active")).toBe(59);
    });
  });
});
