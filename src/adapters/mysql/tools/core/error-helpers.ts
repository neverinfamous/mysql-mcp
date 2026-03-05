/**
 * Centralized Error Helpers for MySQL-MCP
 *
 * Provides consistent error formatting across all tool handlers.
 * Replaces ad-hoc error message cleaning scattered across individual files.
 */

import { ZodError } from "zod";

/**
 * Extract human-readable messages from a ZodError instead of raw JSON array.
 * Replaces ~30 local copies of this function across tool files.
 */
export function formatZodError(error: ZodError): string {
  return error.issues.map((i) => i.message).join("; ");
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
      // Strip adapter-layer prefixes (Query failed: / Execute failed:)
      .replace(/^(Query failed:\s*)?(Execute failed:\s*)*/i, "")
      // Strip MySQL error code prefixes (ER_NO_SUCH_TABLE: / ER_DUP_ENTRY: etc.)
      .replace(/^ER_[A-Z_]+:\s*/i, "")
      // Strip numeric error code patterns (e.g., "1146 (42S02): ...")
      .replace(/^\d+\s*\([A-Z0-9]+\):\s*/, "")
      .trim()
  );
}

/**
 * Format any caught error into a structured handler error response.
 *
 * Handles ZodError (validation) and general errors (MySQL/runtime).
 * Use as the single catch block for all tool handlers:
 *
 * ```typescript
 * handler: async (params) => {
 *   try {
 *     const parsed = Schema.parse(params);
 *     // ... domain logic ...
 *     return { success: true, ... };
 *   } catch (err) {
 *     return formatHandlerError(err);
 *   }
 * }
 * ```
 */
export function formatHandlerError(err: unknown): {
  success: false;
  error: string;
} {
  if (err instanceof ZodError) {
    return { success: false, error: formatZodError(err) };
  }
  return { success: false, error: formatMysqlError(err) };
}
