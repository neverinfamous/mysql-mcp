import { ValidationError } from "../../types/index.js";
import { DANGEROUS_QUERY_PATTERNS, WRITE_KEYWORDS } from "./constants.js";

/**
 * Validate query for safety (SQL injection prevention)
 * @param sql - SQL query to validate
 * @param isReadOnly - Whether to enforce read-only restrictions
 */
export function validateSqlSafety(sql: string, isReadOnly: boolean): void {
  if (!sql || typeof sql !== "string") {
    throw new ValidationError("Query must be a non-empty string");
  }

  const normalizedSql = sql.trim().toUpperCase();

  // Check for dangerous patterns
  for (const pattern of DANGEROUS_QUERY_PATTERNS) {
    if (pattern.test(sql)) {
      throw new ValidationError(
        "Query contains potentially dangerous patterns",
      );
    }
  }

  // Enforce read-only for SELECT queries
  if (isReadOnly) {
    for (const keyword of WRITE_KEYWORDS) {
      if (normalizedSql.startsWith(keyword)) {
        throw new ValidationError(
          `Read-only mode: ${keyword} statements are not allowed`,
        );
      }
    }
  }
}
