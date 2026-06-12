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
    it("should accept valid code", async () => {
      const result = manager.validateCode(
        'const x = await mysql.core.readQuery("SELECT 1")',
      );
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject empty string", async () => {
      const result = manager.validateCode("");
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("non-empty string");
    });

    it("should reject non-string input", async () => {
      const result = manager.validateCode(null as unknown as string);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("non-empty string");
    });

    it("should reject code exceeding max length", async () => {
      const longCode = "x".repeat(100_000);
      const result = manager.validateCode(longCode);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("maximum length");
    });

    it("should detect require() pattern", async () => {
      const result = manager.validateCode('const fs = require("fs")');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should detect dynamic import()", async () => {
      const result = manager.validateCode('const m = import("child_process")');
      expect(result.valid).toBe(false);
    });

    it("should detect process access", async () => {
      const result = manager.validateCode("process.exit(1)");
      expect(result.valid).toBe(false);
    });

    it("should detect eval()", async () => {
      const result = manager.validateCode('eval("malicious")');
      expect(result.valid).toBe(false);
    });

    it("should detect Function constructor", async () => {
      const result = manager.validateCode('new Function("return 1")');
      expect(result.valid).toBe(false);
    });

    it("should detect __proto__ access", async () => {
      const result = manager.validateCode("obj.__proto__.polluted = true");
      expect(result.valid).toBe(false);
    });

    it("should detect constructor.constructor chaining", async () => {
      const result = manager.validateCode(
        '"".constructor.constructor("return this")()',
      );
      expect(result.valid).toBe(false);
    });

    it("should detect globalThis access", async () => {
      const result = manager.validateCode("globalThis.foo = 1");
      expect(result.valid).toBe(false);
    });

    it("should detect child_process", async () => {
      const result = manager.validateCode("child_process.exec('ls')");
      expect(result.valid).toBe(false);
    });

    it("should detect fs access", async () => {
      const result = manager.validateCode("fs.readFileSync('/etc/passwd')");
      expect(result.valid).toBe(false);
    });

    it("should detect net access", async () => {
      const result = manager.validateCode("net.connect(80)");
      expect(result.valid).toBe(false);
    });

    it("should detect http access", async () => {
      const result = manager.validateCode("http.get('http://evil.test')");
      expect(result.valid).toBe(false);
    });

    it("should detect https access", async () => {
      const result = manager.validateCode("https.get('https://evil.test')");
      expect(result.valid).toBe(false);
    });

    it("should detect bracket-notation constructor access", async () => {
      const result = manager.validateCode('x["constructor"]');
      expect(result.valid).toBe(false);
    });

    it("should detect Reflect.construct", async () => {
      const result = manager.validateCode("Reflect.construct(Array, [])");
      expect(result.valid).toBe(false);
    });

    it("should exit on first blocked pattern", async () => {
      const result = manager.validateCode(
        'require("fs"); process.exit(1); eval("x")',
      );
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(1);
    });

    it("should respect custom maxCodeLength", async () => {
      const small = new CodeModeSecurityManager({ maxCodeLength: 10 });
      const result = small.validateCode("a".repeat(11));
      expect(result.valid).toBe(false);
    });
  });

  // ===========================================================================
  // checkRateLimit
  // ===========================================================================
  describe("checkRateLimit", () => {
    it("should allow first request", async () => {
      expect(await await manager.checkRateLimit("client-1")).toBe(true);
    });

    it("should allow requests within limit", async () => {
      for (let i = 0; i < 59; i++) {
        expect(await await manager.checkRateLimit("client-2")).toBe(true);
      }
    });

    it("should block when limit exceeded", async () => {
      const smallLimit = new CodeModeSecurityManager({
        maxExecutionsPerMinute: 3,
      });
      expect(await await smallLimit.checkRateLimit("c")).toBe(true);
      expect(await await smallLimit.checkRateLimit("c")).toBe(true);
      expect(await await smallLimit.checkRateLimit("c")).toBe(true);
      expect(await await smallLimit.checkRateLimit("c")).toBe(false);
    });

    it("should reset after window expires", async () => {
      const smallLimit = new CodeModeSecurityManager({
        maxExecutionsPerMinute: 1,
      });
      expect(await await smallLimit.checkRateLimit("c")).toBe(true);
      expect(await await smallLimit.checkRateLimit("c")).toBe(false);

      // Simulate time passage by manipulating the internal map
      vi.useFakeTimers();
      vi.advanceTimersByTime(61_000);
      expect(await await smallLimit.checkRateLimit("c")).toBe(true);
      vi.useRealTimers();
    });

    it("should track clients independently", async () => {
      const smallLimit = new CodeModeSecurityManager({
        maxExecutionsPerMinute: 1,
      });
      expect(await await smallLimit.checkRateLimit("a")).toBe(true);
      expect(await await smallLimit.checkRateLimit("a")).toBe(false);
      expect(await await smallLimit.checkRateLimit("b")).toBe(true);
    });
  });

  // ===========================================================================
  // getRateLimitRemaining
  // ===========================================================================
  describe("getRateLimitRemaining", () => {
    it("should return full limit for unknown client", async () => {
      expect(await manager.getRateLimitRemaining("unknown")).toBe(60);
    });

    it("should decrease after requests", async () => {
      await manager.checkRateLimit("client");
      expect(await manager.getRateLimitRemaining("client")).toBe(59);
    });

    it("should return 0 when exhausted", async () => {
      const small = new CodeModeSecurityManager({
        maxExecutionsPerMinute: 2,
      });
      await small.checkRateLimit("c");
      await small.checkRateLimit("c");
      expect(await small.getRateLimitRemaining("c")).toBe(0);
    });

    it("should return full limit after window expires", async () => {
      await manager.checkRateLimit("client");
      vi.useFakeTimers();
      vi.advanceTimersByTime(61_000);
      expect(await manager.getRateLimitRemaining("client")).toBe(60);
      vi.useRealTimers();
    });
  });

  // ===========================================================================
  // Redis Rate Limiting
  // ===========================================================================
  describe("Redis Rate Limiting", () => {
    let mockRedisClient: any;

    beforeEach(() => {
      mockRedisClient = {
        isOpen: true,
        incr: vi.fn(),
        pExpire: vi.fn(),
        pTTL: vi.fn(),
      };
      // Inject mock client via private property bypass
      (manager as any).redisClient = mockRedisClient;
    });

    it("should allow requests and expire on first request", async () => {
      mockRedisClient.incr.mockResolvedValue(1);
      
      const allowed = await manager.checkRateLimit("client-redis");
      expect(allowed).toBe(true);
      expect(mockRedisClient.incr).toHaveBeenCalledWith("codemode:rl:client-redis");
      expect(mockRedisClient.pExpire).toHaveBeenCalledWith("codemode:rl:client-redis", 60000);
    });

    it("should block request when limit exceeded", async () => {
      mockRedisClient.incr.mockResolvedValue(61); // exceeds 60 limit
      
      const allowed = await manager.checkRateLimit("client-redis");
      expect(allowed).toBe(false);
      expect(mockRedisClient.pExpire).not.toHaveBeenCalled();
    });

    it("should fallback to memory if redis throws", async () => {
      mockRedisClient.incr.mockRejectedValue(new Error("Redis disconnect"));
      
      const allowed = await manager.checkRateLimit("client-redis");
      expect(allowed).toBe(true); // Falls back to local map which is empty, so allowed = true
    });
  });

  // ===========================================================================
  // sanitizeResult
  // ===========================================================================
  describe("sanitizeResult", () => {
    it("should pass through small results", async () => {
      const input = { foo: "bar" };
      expect(manager.sanitizeResult(input)).toEqual(input);
    });

    it("should truncate oversized results", async () => {
      const small = new CodeModeSecurityManager({ maxResultSize: 10 });
      const result = small.sanitizeResult({ data: "a".repeat(100) }) as {
        _truncated: boolean;
      };
      expect(result._truncated).toBe(true);
    });

    it("should handle non-serializable results", async () => {
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
    it("should create record with correct fields", async () => {
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

    it("should truncate long code in preview", async () => {
      const longCode = "x".repeat(300);
      const result: SandboxResult = {
        success: true,
        metrics: { wallTimeMs: 0, cpuTimeMs: 0, memoryUsedMb: 0 },
      };
      const record = manager.createExecutionRecord(longCode, result, true);

      expect(record.codePreview.length).toBeLessThan(longCode.length);
      expect(record.codePreview).toContain("...");
    });

    it("should redact code with sensitive patterns", async () => {
      const result: SandboxResult = {
        success: true,
        metrics: { wallTimeMs: 0, cpuTimeMs: 0, memoryUsedMb: 0 },
      };
      const record = manager.createExecutionRecord('const password = "mysecret"', result, false);
      expect(record.codePreview).toContain("<REDACTED DUE TO SENSITIVE PATTERN MATCH>");
    });

    it("should handle undefined clientId", async () => {
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
    it("should remove expired entries", async () => {
      const small = new CodeModeSecurityManager({
        maxExecutionsPerMinute: 1,
      });
      await small.checkRateLimit("client-old");
      await small.checkRateLimit("client-old"); // blocked

      vi.useFakeTimers();
      vi.advanceTimersByTime(61_000);
      small.cleanupRateLimits();

      // After cleanup, should have full limit again
      expect(await small.getRateLimitRemaining("client-old")).toBe(1);
      vi.useRealTimers();
    });

    it("should keep active entries", async () => {
      await manager.checkRateLimit("active");
      manager.cleanupRateLimits();
      expect(await manager.getRateLimitRemaining("active")).toBe(59);
    });
  });
});
