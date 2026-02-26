/**
 * Security Integration Tests
 *
 * End-to-end validation flow tests and error message leakage prevention.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createMockMySQLAdapter,
  createMockRequestContext,
} from "../../../../__tests__/mocks/index.js";
import { getBackupTools } from "../admin/index.js";
import { getJsonTools } from "../json/index.js";
import type { MySQLAdapter } from "../../MySQLAdapter.js";

describe("Security: Validation Flow Integration", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    mockContext = createMockRequestContext();
  });

  describe("End-to-End Injection Rejection", () => {
    it("should reject malicious input at validation layer, not database layer", async () => {
      const tools = getBackupTools(mockAdapter as unknown as MySQLAdapter);
      const exportTool = tools.find((t) => t.name === "mysql_export_table")!;

      // Malicious input should be rejected BEFORE any database call
      const result = (await exportTool.handler(
        {
          table: "users'; DROP TABLE users; --",
          format: "SQL",
        },
        mockContext,
      )) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid table name");

      // Verify NO database query was executed
      expect(mockAdapter.executeReadQuery).not.toHaveBeenCalled();
      expect(mockAdapter.executeWriteQuery).not.toHaveBeenCalled();
    });

    it("should reject complex injection attempt with multiple vectors", async () => {
      const tools = getJsonTools(mockAdapter as unknown as MySQLAdapter);
      const setTool = tools.find((t) => t.name === "mysql_json_set")!;

      // Multiple attack vectors in one request
      await expect(
        setTool.handler(
          {
            table: "users", // Valid
            column: "data", // Valid
            path: "$.name",
            value: "test",
            where: "1=1; DELETE FROM users; -- UNION SELECT * FROM passwords",
          },
          mockContext,
        ),
      ).rejects.toThrow("dangerous SQL patterns");

      expect(mockAdapter.executeWriteQuery).not.toHaveBeenCalled();
    });

    it("should process valid input successfully after validation", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue({
        rows: [{ id: 1, name: "Test User" }],
      });

      const tools = getBackupTools(mockAdapter as unknown as MySQLAdapter);
      const exportTool = tools.find((t) => t.name === "mysql_export_table")!;

      const result = await exportTool.handler(
        {
          table: "users",
          format: "SQL",
          where: "status = 'active'",
        },
        mockContext,
      );

      // Verify database was called with safe query
      expect(mockAdapter.executeReadQuery).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe("Error Message Security", () => {
    it("should not leak table name validation patterns in errors", async () => {
      const tools = getBackupTools(mockAdapter as unknown as MySQLAdapter);
      const exportTool = tools.find((t) => t.name === "mysql_export_table")!;

      const result = (await exportTool.handler(
        {
          table: "admin'; SELECT * FROM secrets; --",
          format: "SQL",
        },
        mockContext,
      )) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      // Error should indicate invalid input but not reveal regex pattern
      expect(result.error).not.toContain("regex");
      expect(result.error).not.toContain("/^[a-zA-Z");
      expect(result.error).not.toContain("secrets"); // Shouldn't echo user input
    });

    it("should not expose database schema information in errors", async () => {
      const tools = getJsonTools(mockAdapter as unknown as MySQLAdapter);
      const setTool = tools.find((t) => t.name === "mysql_json_set")!;

      try {
        await setTool.handler(
          {
            table: "users",
            column: "data",
            path: "$.x",
            value: "test",
            where: "1=1 AND information_schema.tables",
          },
          mockContext,
        );
        expect.fail("Should have thrown");
      } catch (error) {
        const message = (error as Error).message;
        // Should not reveal what patterns are being blocked
        expect(message).not.toContain("INFORMATION_SCHEMA");
        expect(message).not.toContain("information_schema.tables");
      }
    });

    it("should provide user-friendly error messages", async () => {
      const tools = getBackupTools(mockAdapter as unknown as MySQLAdapter);
      const exportTool = tools.find((t) => t.name === "mysql_export_table")!;

      const result = (await exportTool.handler(
        {
          table: "123invalid",
          format: "SQL",
        },
        mockContext,
      )) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      // Error should be helpful but not technical
      expect(result.error).toContain("table");
      expect(result.error).not.toContain("IDENTIFIER_PATTERN");
    });
  });

  describe("Validation Consistency", () => {
    it("should validate identifiers consistently across tools", async () => {
      const backupTools = getBackupTools(
        mockAdapter as unknown as MySQLAdapter,
      );
      const jsonTools = getJsonTools(mockAdapter as unknown as MySQLAdapter);

      const maliciousTable = "users'; DROP TABLE users; --";

      // Both tool families should reject the same malicious input
      const exportTool = backupTools.find(
        (t) => t.name === "mysql_export_table",
      )!;
      const jsonTool = jsonTools.find((t) => t.name === "mysql_json_extract")!;

      // Backup tools return structured errors (caught by try/catch)
      const exportResult = (await exportTool.handler(
        {
          table: maliciousTable,
          format: "SQL",
        },
        mockContext,
      )) as { success: boolean; error: string };

      expect(exportResult.success).toBe(false);
      expect(exportResult.error).toContain("Invalid table name");

      // JSON tools still throw (different error handling pattern)
      await expect(
        jsonTool.handler(
          {
            table: maliciousTable,
            column: "data",
            path: "$.x",
          },
          mockContext,
        ),
      ).rejects.toThrow("Invalid table name");
    });
  });
});

describe("Rate Limiting Preparation", () => {
  /**
   * These tests establish the patterns for rate limiting when implemented.
   * They verify the infrastructure is ready for rate limiting middleware.
   */

  it("should support request context for rate limiting metadata", () => {
    const context = createMockRequestContext();

    // Verify context has properties useful for rate limiting
    expect(context).toHaveProperty("requestId");
    // Rate limiting will need client identification
    expect(typeof context.requestId).toBe("string");
  });

  it("should have tool definitions with metadata for rate limiting rules", () => {
    const mockAdapter = createMockMySQLAdapter();
    const tools = getBackupTools(mockAdapter as unknown as MySQLAdapter);

    const exportTool = tools.find((t) => t.name === "mysql_export_table")!;

    // Tools have annotations that can inform rate limiting
    expect(exportTool.annotations).toBeDefined();
    expect(exportTool.annotations?.readOnlyHint).toBe(true);
    // Read-only tools could have different rate limits than write tools
  });

  it("should have scope information for tier-based rate limiting", () => {
    const mockAdapter = createMockMySQLAdapter();
    const tools = getBackupTools(mockAdapter as unknown as MySQLAdapter);

    const exportTool = tools.find((t) => t.name === "mysql_export_table")!;
    const importTool = tools.find((t) => t.name === "mysql_import_data")!;

    // Scopes can determine rate limit tiers
    expect(exportTool.requiredScopes).toContain("read");
    expect(importTool.requiredScopes).toContain("write");
    // Write operations could have stricter rate limits
  });

  it("should distinguish between tool groups for rate limiting categories", () => {
    const mockAdapter = createMockMySQLAdapter();
    const backupTools = getBackupTools(mockAdapter as unknown as MySQLAdapter);
    const jsonTools = getJsonTools(mockAdapter as unknown as MySQLAdapter);

    // All tools have group assignments for category-based limiting
    expect(backupTools.every((t) => t.group === "backup")).toBe(true);
    expect(jsonTools.every((t) => t.group === "json")).toBe(true);
  });

  /**
   * Future rate limiting implementation guide:
   *
   * 1. Add rate limiting middleware to HTTP transport
   * 2. Use request context clientId/IP for tracking
   * 3. Apply different limits based on:
   *    - Tool group (backup tools: stricter limits)
   *    - Required scopes (write ops: lower limits)
   *    - Request annotations (readOnlyHint: higher limits)
   * 4. Return 429 Too Many Requests with Retry-After header
   */
});
