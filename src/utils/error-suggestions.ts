/**
 * Error Suggestions
 *
 * Pattern-based suggestions for common MySQL errors. Maps error message
 * patterns to actionable user-facing suggestions. Used by MySQLMcpError
 * constructor for auto-refinement of generic error codes and suggestion
 * auto-detection.
 *
 * MySQL wire-protocol error codes are matched via their message patterns
 * (e.g., errno 1146 → "Table '.*' does not exist").
 */

import { ErrorCategory } from "../types/modules/error-types.js";

/**
 * Pattern-based suggestions for common errors
 */
const ERROR_SUGGESTIONS: {
  pattern: RegExp;
  suggestion: string;
  category?: ErrorCategory | undefined;
  /** Specific error code override (takes precedence over category default code) */
  code?: string | undefined;
}[] = [
  // =========================================================================
  // Resource errors — table/column/schema/index not found
  // =========================================================================
  {
    pattern: /(?:Table|Collection) '.*' (?:doesn't|does not) exist/i,
    suggestion:
      "Table or collection does not exist. Run mysql_list_tables or mysql_doc_list_collections to see available objects.",
    category: ErrorCategory.RESOURCE,
    code: "TABLE_NOT_FOUND",
  },
  {
    pattern: /Unknown table ['"].*['"]/i,
    suggestion:
      "Table or view does not exist. Run mysql_list_tables or mysql_list_views to see available objects.",
    category: ErrorCategory.RESOURCE,
    code: "TABLE_NOT_FOUND",
  },
  {
    pattern: /table (?:or view )?['"].*['"] not found/i,
    suggestion:
      "Table or view does not exist. Run mysql_list_tables to see available tables.",
    category: ErrorCategory.RESOURCE,
    code: "TABLE_NOT_FOUND",
  },
  {
    pattern: /(?:Unknown column ['"].*['"]|Column ['"].*['"] not found|Key column ['"].*['"] (?:doesn't|does not) exist)/i,
    suggestion:
      "Column not found. Use mysql_describe_table to see available columns.",
    category: ErrorCategory.RESOURCE,
    code: "COLUMN_NOT_FOUND",
  },
  {
    pattern: /(?:Unknown database|Database (?:'.*?' )?(?:doesn't|does not) exist)/i,
    suggestion:
      "Schema not found. Use mysql_list_schemas to see available databases.",
    category: ErrorCategory.RESOURCE,
    code: "SCHEMA_NOT_FOUND",
  },
  {
    pattern: /Schema (?:'.*?' )?(?:doesn't|does not) exist/i,
    suggestion:
      "Schema not found. Use mysql_list_schemas to see available databases.",
    category: ErrorCategory.RESOURCE,
    code: "SCHEMA_NOT_FOUND",
  },
  {
    pattern: /Event (?:'.*?' )?(?:doesn't|does not) exist/i,
    suggestion:
      "Event does not exist. Run mysql_event_list to see available events.",
    category: ErrorCategory.RESOURCE,
    code: "OBJECT_NOT_FOUND",
  },
  {
    pattern: /No row found matching WHERE/i,
    suggestion:
      "No rows matched the provided WHERE clause. Verify the condition and ensure the row exists.",
    category: ErrorCategory.RESOURCE,
    code: "NOT_FOUND",
  },
  {
    pattern: /index ['"].*['"] (?:does not exist|not found)/i,
    suggestion:
      "Index not found. Use mysql_get_indexes to see available indexes.",
    category: ErrorCategory.RESOURCE,
    code: "INDEX_NOT_FOUND",
  },
  {
    pattern: /No FULLTEXT index found for the specified columns/i,
    suggestion:
      "A FULLTEXT index is required for this operation. Create one using mysql_fulltext_create.",
    category: ErrorCategory.RESOURCE,
    code: "INDEX_NOT_FOUND",
  },
  {
    pattern: /Can't find FULLTEXT index matching the column list/i,
    suggestion:
      "A FULLTEXT index is required for this operation. Create one using mysql_fulltext_create.",
    category: ErrorCategory.RESOURCE,
    code: "INDEX_NOT_FOUND",
  },
  {
    pattern: /object ['"].*['"] not found/i,
    suggestion:
      "Object not found. Use mysql_list_tables or mysql_list_schemas to discover database objects.",
    category: ErrorCategory.RESOURCE,
    code: "OBJECT_NOT_FOUND",
  },

  // =========================================================================
  // Validation errors
  // =========================================================================
  {
    pattern: /Invalid search syntax/i,
    suggestion:
      "Check your search query syntax. Boolean mode has strict operator requirements (+, -, *, etc.).",
    category: ErrorCategory.VALIDATION,
    code: "INVALID_QUERY_SYNTAX",
  },
  {
    pattern: /invalid table name/i,
    suggestion:
      "Table names must follow MySQL identifier rules: 1-64 characters, alphanumeric or underscores.",
    category: ErrorCategory.VALIDATION,
    code: "VALIDATION_ERROR",
  },
  {
    pattern: /invalid column name/i,
    suggestion:
      "Column names must follow MySQL identifier rules: 1-64 characters, alphanumeric or underscores.",
    category: ErrorCategory.VALIDATION,
    code: "VALIDATION_ERROR",
  },
  {
    pattern: /invalid (view|index|schema|database|collection) name/i,
    suggestion:
      "Names must follow MySQL identifier rules: 1-64 characters, alphanumeric or underscores.",
    category: ErrorCategory.VALIDATION,
    code: "VALIDATION_ERROR",
  },
  {
    pattern: /Identifier name .* is too long/i,
    suggestion:
      "Identifier names (databases, tables, columns, events) must not exceed 64 characters.",
    category: ErrorCategory.VALIDATION,
    code: "VALIDATION_ERROR",
  },
  {
    pattern: /invalid name syntax/i,
    suggestion:
      "Check that the identifier name follows proper syntax and does not contain unauthorized characters or empty strings.",
    category: ErrorCategory.VALIDATION,
    code: "INVALID_IDENTIFIER",
  },
  {
    pattern: /is not VIEW/i,
    suggestion:
      "The specified object is not a view. Verify the object name or use the correct tool for the object type.",
    category: ErrorCategory.VALIDATION,
    code: "INVALID_OBJECT_TYPE",
  },
  {
    pattern: /Invalid (?:charset|collation)/i,
    suggestion:
      "Check that the charset or collation is valid and contains only alphanumeric characters or underscores.",
    category: ErrorCategory.VALIDATION,
    code: "VALIDATION_ERROR",
  },
  {
    pattern: /Data too long for column/i,
    suggestion:
      "The value exceeds the column's maximum length. Check column limits with mysql_describe_table.",
    category: ErrorCategory.VALIDATION,
    code: "COLUMN_TYPE_MISMATCH",
  },
  {
    pattern: /Data truncated for column/i,
    suggestion:
      "The provided value does not match the column type. Verify data types with mysql_describe_table.",
    category: ErrorCategory.VALIDATION,
    code: "COLUMN_TYPE_MISMATCH",
  },
  {
    pattern: /Incorrect (?:integer|decimal|double|float) value/i,
    suggestion: "The provided value is not valid for the numeric column type.",
    category: ErrorCategory.VALIDATION,
    code: "VALIDATION_ERROR",
  },
  {
    pattern: /Incorrect datetime value/i,
    suggestion:
      "The provided value is not a valid datetime. Use ISO 8601 format (YYYY-MM-DD HH:MM:SS).",
    category: ErrorCategory.VALIDATION,
    code: "VALIDATION_ERROR",
  },
  {
    pattern: /^Missing required parameters:/i,
    suggestion: "Provide all required parameters in your request.",
    category: ErrorCategory.VALIDATION,
    code: "VALIDATION_ERROR",
  },
  {
    pattern: /already exists/i,
    suggestion:
      "The specified object already exists. Use IF NOT EXISTS or verify the object name.",
    category: ErrorCategory.VALIDATION,
    code: "OBJECT_ALREADY_EXISTS",
  },

  // =========================================================================
  // Query errors — syntax, constraints, transactions
  // =========================================================================
  {
    pattern: /Incorrect arguments to COM_STMT_EXECUTE/i,
    suggestion:
      "The number of parameters provided does not match the number of placeholders (?) in the SQL query.",
    category: ErrorCategory.QUERY,
    code: "PARAMETER_MISMATCH",
  },
  {
    pattern: /You have an error in your SQL syntax/i,
    suggestion:
      "Check SQL syntax. Common issues: missing quotes, commas, parentheses, or reserved word conflicts.",
    category: ErrorCategory.QUERY,
    code: "SYNTAX_ERROR",
  },
  {
    pattern: /syntax error/i,
    suggestion:
      "Check SQL syntax. Common issues: missing quotes, commas, parentheses, or reserved word conflicts.",
    category: ErrorCategory.QUERY,
    code: "SYNTAX_ERROR",
  },
  {
    pattern: /Duplicate entry .* for key/i,
    suggestion:
      "A row with this key already exists. Use ON DUPLICATE KEY UPDATE or INSERT IGNORE for upsert behavior.",
    category: ErrorCategory.QUERY,
    code: "DUPLICATE_KEY",
  },
  {
    pattern: /Cannot add or update a child row: a foreign key constraint/i,
    suggestion:
      "The referenced row does not exist. Ensure the parent record exists before inserting.",
    category: ErrorCategory.QUERY,
    code: "CONSTRAINT_ERROR",
  },
  {
    pattern: /Cannot delete or update a parent row: a foreign key constraint/i,
    suggestion:
      "Child rows reference this record. Delete or update child rows first, or use CASCADE.",
    category: ErrorCategory.QUERY,
    code: "CONSTRAINT_ERROR",
  },
  {
    pattern: /Column .* cannot be null/i,
    suggestion:
      "A required column is missing a value. Provide a value or set a DEFAULT.",
    category: ErrorCategory.QUERY,
    code: "CONSTRAINT_ERROR",
  },
  {
    pattern: /Check constraint .* is violated/i,
    suggestion:
      "The value does not meet the column's check constraint requirements.",
    category: ErrorCategory.QUERY,
    code: "CONSTRAINT_ERROR",
  },
  {
    pattern: /Deadlock found when trying to get lock/i,
    suggestion:
      "Transaction was rolled back due to deadlock. Retry the operation.",
    category: ErrorCategory.QUERY,
    code: "DEADLOCK",
  },
  {
    pattern: /Lock wait timeout exceeded/i,
    suggestion:
      "Another transaction holds the lock. Retry after it completes, or increase innodb_lock_wait_timeout.",
    category: ErrorCategory.QUERY,
    code: "LOCK_TIMEOUT",
  },
  {
    pattern: /SAVEPOINT .* does not exist/i,
    suggestion:
      "The savepoint was already released or rolled back. Use mysql_transaction_savepoint to create a new one.",
    category: ErrorCategory.QUERY,
    code: "TRANSACTION_CONFLICT",
  },
  {
    pattern: /Transaction (?:not found|ID is invalid)/i,
    suggestion: "Transaction ID is invalid or has already been committed/rolled back.",
    category: ErrorCategory.QUERY,
    code: "TRANSACTION_NOT_FOUND",
  },

  // =========================================================================
  // Connection errors
  // =========================================================================
  {
    pattern: /not connected|ENOTFOUND|ECONNRESET|ETIMEDOUT|EHOSTUNREACH/i,
    suggestion:
      "Database connection not established. Ensure MySQL is configured and connected.",
    category: ErrorCategory.CONNECTION,
    code: "CONNECTION_ERROR",
  },
  {
    pattern: /Connection refused|ECONNREFUSED/i,
    suggestion:
      "MySQL server is not accepting connections. Verify the host, port, and that the server is running.",
    category: ErrorCategory.CONNECTION,
    code: "CONNECTION_ERROR",
  },
  {
    pattern: /Too many connections/i,
    suggestion:
      "Connection limit reached. Close unused connections or increase max_connections.",
    category: ErrorCategory.CONNECTION,
    code: "CONNECTION_ERROR",
  },
  {
    pattern: /Connection (?:lost|terminated|closed|reset)/i,
    suggestion:
      "Database connection was closed unexpectedly. This may indicate a server restart or timeout.",
    category: ErrorCategory.CONNECTION,
    code: "CONNECTION_ERROR",
  },
  {
    pattern: /Can't connect to (?:local )?MySQL server/i,
    suggestion:
      "Cannot reach MySQL server. Verify the host, port, and that mysqld is running.",
    category: ErrorCategory.CONNECTION,
    code: "CONNECTION_ERROR",
  },

  // =========================================================================
  // Permission errors
  // =========================================================================
  {
    pattern: /Access denied for user/i,
    suggestion:
      "Insufficient privileges. Check the user's permissions on the target database object.",
    category: ErrorCategory.PERMISSION,
    code: "PERMISSION_DENIED",
  },
  {
    pattern: /command denied to user/i,
    suggestion:
      "This command requires elevated privileges. Check GRANT statements for the user.",
    category: ErrorCategory.PERMISSION,
    code: "PERMISSION_DENIED",
  },
  {
    pattern: /needs to be performed by user with .* privileges/i,
    suggestion:
      "This command requires elevated privileges. Check GRANT statements for the user.",
    category: ErrorCategory.PERMISSION,
    code: "PERMISSION_DENIED",
  },

  // =========================================================================
  // Configuration errors
  // =========================================================================
  {
    pattern: /(?:extension|plugin) .* (?:not available|not loaded|disabled)/i,
    suggestion:
      "Verify that the required plugin/extension is loaded on the MySQL server.",
    category: ErrorCategory.CONFIGURATION,
    code: "EXTENSION_MISSING",
  },
  {
    pattern: /Unknown system variable/i,
    suggestion:
      "Verify the variable name. Use mysql_show_variables to see available server variables.",
    category: ErrorCategory.CONFIGURATION,
    code: "VALIDATION_ERROR",
  },
  {
    pattern: /Variable .* is a read only variable/i,
    suggestion:
      "This variable cannot be changed at runtime. It must be set in the MySQL configuration file (my.cnf).",
    category: ErrorCategory.CONFIGURATION,
    code: "VALIDATION_ERROR",
  },

  // =========================================================================
  // Code Mode errors
  // =========================================================================
  {
    pattern: /code validation failed/i,
    suggestion:
      "Check for blocked patterns: require(), process., eval(), Function(), import(). Use mysql.* API instead.",
    category: ErrorCategory.VALIDATION,
    code: "SANDBOX_VALIDATION_ERROR",
  },
  {
    pattern: /rate limit exceeded/i,
    suggestion:
      "Wait before retrying. Combine multiple operations into fewer mysql_execute_code calls.",
    category: ErrorCategory.CONNECTION,
    code: "RATE_LIMIT_ERROR",
  },
  {
    pattern: /execution timed out|wait_timeout exceeded|read timeout/i,
    suggestion:
      "Reduce query/code complexity or increase timeout. Break into smaller operations.",
    category: ErrorCategory.CONNECTION,
    code: "TIMEOUT_ERROR",
  },
  {
    pattern: /sandbox.*not initialized/i,
    suggestion: "Internal sandbox error. Retry the operation.",
    category: ErrorCategory.INTERNAL,
    code: "SANDBOX_ERROR",
  },
];

/**
 * Find a suggestion for an error message
 */
export function findSuggestion(message: string): {
  suggestion: string;
  category?: ErrorCategory | undefined;
  code?: string | undefined;
} | null {
  for (const entry of ERROR_SUGGESTIONS) {
    if (entry.pattern.test(message)) {
      return {
        suggestion: entry.suggestion,
        category: entry.category,
        code: entry.code,
      };
    }
  }
  return null;
}

/**
 * Heuristic fallback for unhandled error categorization.
 * Ensures metrics never report 'unknown' categories for tool errors.
 */
export function heuristicCategorize(errorMsg: string): { type: string; category: string } {
  const lower = errorMsg.toLowerCase();
  if (lower.includes("invalid parameters") || lower.includes("validation") || lower.includes("zoderror")) {
    return { type: "VALIDATION_ERROR", category: "validation" };
  }
  if (lower.includes("syntax")) {
    return { type: "SYNTAX_ERROR", category: "query" };
  }
  if (lower.includes("denied") || lower.includes("privilege")) {
    return { type: "PERMISSION_DENIED", category: "permission" };
  }
  if (lower.includes("timeout") || lower.includes("connect")) {
    return { type: "CONNECTION_ERROR", category: "connection" };
  }
  if (lower.includes("not found") || lower.includes("doesn't exist") || lower.includes("does not exist")) {
    return { type: "OBJECT_NOT_FOUND", category: "resource" };
  }
  return { type: "TOOL_ERROR", category: "internal" };
}
