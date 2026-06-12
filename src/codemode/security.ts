/**
 * mysql-mcp - Code Mode Security
 *
 * Input validation, rate limiting, and audit logging for code execution.
 */

import { logger } from "../utils/logger.js";
import {
  DEFAULT_SECURITY_CONFIG,
  type SecurityConfig,
  type ValidationResult,
  type ExecutionRecord,
  type SandboxResult,
} from "./types.js";
import { createClient, type RedisClientType } from "redis";

const SENSITIVE_KEY_PATTERN = /password|secret|token|key|auth|cred/i;
const MAX_RATE_LIMIT_ENTRIES = 10000;

/**
 * Security manager for Code Mode executions
 */
export class CodeModeSecurityManager {
  private readonly config: SecurityConfig;
  private readonly rateLimitMap = new Map<
    string,
    { count: number; resetTime: number }
  >();
  private redisClient?: RedisClientType;

  constructor(config?: Partial<SecurityConfig>) {
    this.config = { ...DEFAULT_SECURITY_CONFIG, ...config };
    setInterval(() => this.cleanupRateLimits(), 5 * 60 * 1000).unref();
    if (process.env["REDIS_URL"]) {
      this.redisClient = createClient({ url: process.env["REDIS_URL"] });
      this.redisClient.connect().catch((err: unknown) => {
        logger.error("Redis connection failed in CodeModeSecurityManager", {
          error: err instanceof Error ? err : new Error(String(err)),
        });
      });
    }
  }

  /**
   * Validate code before execution
   */
  validateCode(code: string): ValidationResult {
    const errors: string[] = [];

    // Check code length
    if (!code || typeof code !== "string") {
      errors.push("Code must be a non-empty string");
      return { valid: false, errors };
    }

    if (code.length > this.config.maxCodeLength) {
      errors.push(
        `Code exceeds maximum length of ${String(this.config.maxCodeLength)} bytes`,
      );
      return { valid: false, errors };
    }

    // Check for unicode escapes
    const hasUnicodeEscapes = /\\u[0-9a-fA-F]{4}|\\u\{[0-9a-fA-F]+\}|\\x[0-9a-fA-F]{2}/i.test(code);
    if (hasUnicodeEscapes) {
      errors.push("Unicode escape sequences in identifiers are not allowed");
      return { valid: false, errors };
    }

    // Normalize and strip comments before pattern matching
    const strippedCode = code
      .normalize("NFKC")
      .replace(/\/\*[\s\S]*?\*\//g, " ")  // block comments
      .replace(/\/\/[^\n]*/g, " ");       // line comments

    // Check for blocked patterns
    for (const pattern of this.config.blockedPatterns) {
      if (pattern.test(strippedCode)) {
        errors.push(`Blocked pattern detected: ${pattern.source}`);
        break; // Early exit on first match
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check rate limit for a client
   * @returns true if within limits, false if rate limited
   */
  async checkRateLimit(clientId: string): Promise<boolean> {
    if (this.redisClient?.isOpen) {
      try {
        const windowMs = 60000;
        const key = `codemode:rl:${clientId}`;
        const current = await this.redisClient.incr(key);
        if (current === 1) {
          await this.redisClient.pExpire(key, windowMs);
        }
        return current <= this.config.maxExecutionsPerMinute;
      } catch (err) {
        logger.error("Redis rate limit error, falling back to memory", {
          error: err instanceof Error ? err : new Error(String(err)),
        });
      }
    }

    const now = Date.now();
    const windowMs = 60000; // 1 minute window

    const existing = this.rateLimitMap.get(clientId);

    if (!existing || now >= existing.resetTime) {
      // Start new window
      if (this.rateLimitMap.size >= MAX_RATE_LIMIT_ENTRIES) {
        const firstKey = this.rateLimitMap.keys().next().value;
        if (firstKey) this.rateLimitMap.delete(firstKey);
      }
      this.rateLimitMap.set(clientId, {
        count: 1,
        resetTime: now + windowMs,
      });
      return true;
    }

    if (existing.count >= this.config.maxExecutionsPerMinute) {
      return false;
    }

    existing.count++;
    return true;
  }

  /**
   * Get remaining rate limit for a client
   */
  async getRateLimitRemaining(clientId: string): Promise<number> {
    if (this.redisClient?.isOpen) {
      try {
        const key = `codemode:rl:${clientId}`;
        const current = await this.redisClient.get(key);
        const count = current ? parseInt(current, 10) : 0;
        return Math.max(0, this.config.maxExecutionsPerMinute - count);
      } catch {
        // Fall back to memory
      }
    }

    const existing = this.rateLimitMap.get(clientId);
    if (!existing || Date.now() >= existing.resetTime) {
      return this.config.maxExecutionsPerMinute;
    }
    return Math.max(0, this.config.maxExecutionsPerMinute - existing.count);
  }

  /**
   * Sanitize and truncate result if too large
   */
  sanitizeResult(result: unknown): unknown {
    try {
      const serialized = JSON.stringify(result);
      if (serialized.length > this.config.maxResultSize) {
        return {
          _truncated: true,
          _originalSize: serialized.length,
          _maxSize: this.config.maxResultSize,
          preview: serialized.substring(0, 1000) + "...",
        };
      }
      return result;
    } catch {
      return {
        _error: "Result could not be serialized",
        _type: typeof result,
      };
    }
  }

  private redactCode(code: string): string {
    if (SENSITIVE_KEY_PATTERN.test(code)) {
      return "<REDACTED DUE TO SENSITIVE PATTERN MATCH>";
    }
    return code;
  }

  /**
   * Log execution for audit purposes
   */
  auditLog(execution: ExecutionRecord): void {
    const { id, clientId, codePreview, result, readonly } = execution;

    const logContext = {
      module: "CODEMODE" as const,
      operation: "execute",
      entityId: id,
      clientId: clientId ?? "anonymous",
      readonly,
      success: result.success,
      wallTimeMs: result.metrics.wallTimeMs,
      memoryUsedMb: result.metrics.memoryUsedMb,
    };

    const redactedPreview = this.redactCode(codePreview);

    if (result.success) {
      logger.info(
        `Code execution completed: ${redactedPreview.substring(0, 50)}...`,
        logContext,
      );
    } else {
      const errorContext = {
        ...logContext,
        ...(result.error !== undefined ? { error: result.error } : {}),
        ...(result.stack !== undefined ? { stack: result.stack } : {}),
      };
      logger.warning(
        `Code execution failed: ${result.error ?? "unknown error"}`,
        errorContext,
      );
    }
  }

  /**
   * Create execution record for audit
   */
  createExecutionRecord(
    code: string,
    result: SandboxResult,
    readonly: boolean,
    clientId?: string,
  ): ExecutionRecord {
    return {
      id: crypto.randomUUID(),
      clientId,
      timestamp: new Date(),
      codePreview: this.redactCode(code.length > 200 ? code.substring(0, 200) + "..." : code),
      result,
      readonly,
    };
  }

  /**
   * Clean up old rate limit entries
   */
  cleanupRateLimits(): void {
    const now = Date.now();
    for (const [clientId, entry] of this.rateLimitMap) {
      if (now >= entry.resetTime) {
        this.rateLimitMap.delete(clientId);
      }
    }
  }
}
