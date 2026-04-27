/**
 * Centralized Error Helpers for MySQL-MCP
 *
 * Provides consistent error formatting across all tool handlers.
 * Replaces ad-hoc error message cleaning scattered across individual files.
 */

import { ZodError } from "zod";
import { MySQLMcpError } from "../../../../types/modules/errors.js";
import type { ErrorResponse } from "../../../../types/modules/error-types.js";

/**
 * Extract human-readable messages from a ZodError instead of raw JSON array.
 * Replaces ~30 local copies of this function across tool files.
 */
export function formatZodError(error: ZodError): string {
  return (
    "Validation error: " +
    error.issues
      .map((i) => {
        const path = i.path.join(".");
        return path ? `${path}: ${i.message}` : i.message;
      })
      .join("; ")
  );
}

/**
 * Format a MySQL error into a clean, human-readable message.
 *
 * Strips adapter/driver prefixes and MySQL error code prefixes,
 * returning just the meaningful error description.
 *
 * @example
 * formatMysqlError(new Error("Query failed: ER_NO_SUCH_TABLE: Table 'testdb.xyz' doesn't exist"))
 * // => "Table 'testdb.xyz' doesn't exist"
 *
 * formatMysqlError(new Error("Execute failed: ER_DUP_ENTRY: Duplicate entry '1' for key 'PRIMARY'"))
 * // => "Duplicate entry '1' for key 'PRIMARY'"
 */
export function formatMysqlError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);

  return (
    message
      // Strip adapter-layer prefixes (Raw query failed: / Query failed: / Execute failed:)
      .replace(
        /^(Raw query failed:\s*)?(Query failed:\s*)?(Execute failed:\s*)*/i,
        "",
      )
      // Strip MySQL error code prefixes (ER_NO_SUCH_TABLE: / ER_DUP_ENTRY: etc.)
      .replace(/^ER_[A-Z_]+:\s*/i, "")
      // Strip numeric error code patterns (e.g., "1146 (42S02): ...")
      .replace(/^\d+\s*\([A-Z0-9]+\):\s*/, "")
      .trim()
  );
}

/**
 * Alias for formatMysqlError that accepts a pre-extracted message string.
 * Use this when you've already extracted the message from the Error object.
 */
export function stripErrorPrefix(msg: string): string {
  return formatMysqlError(msg);
}

/**
 * Format any caught error into an enriched ErrorResponse.
 *
 * Returns the full harmonized error response with code, category,
 * suggestion, and recoverable fields. Handles MySQLMcpError instances,
 * ZodErrors, raw MySQL errors, and unknown errors.
 *
 * Use as the single catch block for all tool handlers:
 *
 * ```typescript
 * handler: async (params) => {
 *   try {
 *     const parsed = Schema.parse(params);
 *     // ... domain logic ...
 *     return { success: true, ... };
 *   } catch (err) {
 *     return formatHandlerErrorResponse(err);
 *   }
 * }
 * ```
 */
export function formatHandlerErrorResponse(err: unknown): ErrorResponse {
  // MySQLMcpError — already enriched
  if (err instanceof MySQLMcpError) {
    const response = err.toResponse();
    response.error = formatMysqlError(response.error);
    return response;
  }

  // Zod validation error
  if (err instanceof ZodError) {
    return {
      success: false,
      error: formatZodError(err),
    };
  }

  // Raw MySQL / unknown error
  return {
    success: false,
    error: formatMysqlError(err),
  };
}
