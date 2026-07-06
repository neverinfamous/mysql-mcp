/**
 * Dangerous SQL patterns for query validation (hoisted for performance)
 */
export const DANGEROUS_QUERY_PATTERNS: RegExp[] = [
  /;\s*DROP\s+/i,
  /;\s*DELETE\s+/i,
  /;\s*TRUNCATE\s+/i,
  /;\s*INSERT\s+/i,
  /;\s*UPDATE\s+/i,
  /--\s*$/m, // SQL comment at end of line
];

/**
 * Write keywords for read-only query enforcement (hoisted for performance)
 */
export const WRITE_KEYWORDS: string[] = [
  "INSERT",
  "UPDATE",
  "DELETE",
  "DROP",
  "CREATE",
  "ALTER",
  "TRUNCATE",
  "REPLACE",
  "GRANT",
  "REVOKE",
];
