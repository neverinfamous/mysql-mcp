/**
 * Dangerous SQL patterns for query validation (hoisted for performance)
 */
export const DANGEROUS_QUERY_PATTERNS: RegExp[] = [
  /;\s*(?:DROP|DELETE|TRUNCATE|INSERT|UPDATE|CREATE|ALTER|GRANT|REVOKE|REPLACE|RENAME|CALL|LOAD)\s+/i,
  /--\s*$/m, // SQL comment at end of line
  /\bINTO\s+(?:OUTFILE|DUMPFILE)\b/i,
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
  "RENAME",
  "LOAD",
  "CALL",
  "DO",
  "SET",
  "LOCK",
  "UNLOCK",
  "FLUSH",
  "RESET",
  "PURGE",
  "KILL",
  "SHUTDOWN",
  "INSTALL",
  "UNINSTALL",
  "HANDLER",
  "PREPARE",
  "EXECUTE",
  "DEALLOCATE",
  "IMPORT",
  "START",
  "BEGIN",
  "COMMIT",
  "ROLLBACK",
  "SAVEPOINT",
  "XA",
  "ANALYZE",
  "OPTIMIZE",
  "REPAIR",
  "CHECK",
  "CHECKSUM",
  "BINLOG",
  "CACHE",
  "CLONE",
  "RESIGNAL",
  "SIGNAL",
  "GET",
  "USE",
];

/**
 * Allowed statement starter keywords in read-only mode (hoisted for performance)
 */
export const READ_ONLY_KEYWORDS: ReadonlySet<string> = new Set([
  "SELECT",
  "WITH",
  "SHOW",
  "DESCRIBE",
  "DESC",
  "EXPLAIN",
  "TABLE",
  "VALUES",
  "HELP",
]);
