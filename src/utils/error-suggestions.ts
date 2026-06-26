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
    pattern: /Table '.*' (?:doesn't|does not) exist/i,
    suggestion:
      "Table does not exist. Run mysql_list_tables to see available tables.",
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
    pattern: /Unknown column ['"].*['"]/i,
    suggestion:
      "Column not found. Use mysql_describe_table to see available columns.",
    category: ErrorCategory.RESOURCE,
    code: "COLUMN_NOT_FOUND",
  },
  {
    pattern: /(?:Unknown database|Database (?:'.*?' )?(?:doesn't|does not) exist|Schema (?:'.*?' )?(?:doesn't|does not) exist)/i,
    suggestion:
      "Database not found. Use mysql_list_schemas to see available databases.",
    category: ErrorCategory.RESOURCE,
    code: "DATABASE_NOT_FOUND",
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
    pattern: /invalid table name/i,
    suggestion:
      "Table names must follow MySQL identifier rules: 1-64 characters, alphanumeric or underscores.",
    category: ErrorCategory.VALIDATION,
  },
  {
    pattern: /invalid column name/i,
    suggestion:
      "Column names must follow MySQL identifier rules: 1-64 characters, alphanumeric or underscores.",
    category: ErrorCategory.VALIDATION,
  },
  {
    pattern: /invalid (view|index|schema|database) name/i,
    suggestion:
      "Names must follow MySQL identifier rules: 1-64 characters, alphanumeric or underscores.",
    category: ErrorCategory.VALIDATION,
  },
  {
    pattern: /invalid name syntax/i,
    suggestion:
      "Check that the identifier name follows proper syntax and does not contain unauthorized characters or empty strings.",
    category: ErrorCategory.VALIDATION,
    code: "INVALID_IDENTIFIER",
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
    pattern: /You have an error in your SQL syntax/i,
    suggestion:
      "Check SQL syntax. Common issues: missing quotes, commas, parentheses, or reserved word conflicts.",
    category: ErrorCategory.QUERY,
  },
  {
    pattern: /syntax error/i,
    suggestion:
      "Check SQL syntax. Common issues: missing quotes, commas, parentheses, or reserved word conflicts.",
    category: ErrorCategory.QUERY,
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
  },
  {
    pattern: /Cannot delete or update a parent row: a foreign key constraint/i,
    suggestion:
      "Child rows reference this record. Delete or update child rows first, or use CASCADE.",
    category: ErrorCategory.QUERY,
  },
  {
    pattern: /Column .* cannot be null/i,
    suggestion:
      "A required column is missing a value. Provide a value or set a DEFAULT.",
    category: ErrorCategory.QUERY,
  },
  {
    pattern: /Check constraint .* is violated/i,
    suggestion:
      "The value does not meet the column's check constraint requirements.",
    category: ErrorCategory.QUERY,
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

  // =========================================================================
  // Connection errors
  // =========================================================================
  {
    pattern: /not connected/i,
    suggestion:
      "Database connection not established. Ensure MySQL is configured and connected.",
    category: ErrorCategory.CONNECTION,
  },
  {
    pattern: /Connection refused/i,
    suggestion:
      "MySQL server is not accepting connections. Verify the host, port, and that the server is running.",
    category: ErrorCategory.CONNECTION,
  },
  {
    pattern: /Too many connections/i,
    suggestion:
      "Connection limit reached. Close unused connections or increase max_connections.",
    category: ErrorCategory.CONNECTION,
  },
  {
    pattern: /Connection (?:lost|terminated|closed)/i,
    suggestion:
      "Database connection was closed unexpectedly. This may indicate a server restart or timeout.",
    category: ErrorCategory.CONNECTION,
  },
  {
    pattern: /Can't connect to (?:local )?MySQL server/i,
    suggestion:
      "Cannot reach MySQL server. Verify the host, port, and that mysqld is running.",
    category: ErrorCategory.CONNECTION,
  },

  // =========================================================================
  // Permission errors
  // =========================================================================
  {
    pattern: /Access denied for user/i,
    suggestion:
      "Insufficient privileges. Check the user's permissions on the target database object.",
    category: ErrorCategory.PERMISSION,
  },
  {
    pattern: /command denied to user/i,
    suggestion:
      "This command requires elevated privileges. Check GRANT statements for the user.",
    category: ErrorCategory.PERMISSION,
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
