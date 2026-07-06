/**
 * Error Types
 *
 * Custom error classes for mysql-mcp server.
 * Follows the harmonized error handling standard with
 * category, suggestion, recoverable flag, and toResponse().
 */

import { ErrorCategory } from "./error-types.js";
import type { ErrorResponse } from "./error-types.js";
import { findSuggestion } from "../../utils/error-suggestions.js";

/**
 * Generic error codes that should be auto-refined when findSuggestion
 * provides a more specific code (e.g., QUERY_ERROR → TABLE_NOT_FOUND).
 */
const REFINABLE_CODES = new Set([
  "QUERY_ERROR",
  "VALIDATION_ERROR",
  "RESOURCE_ERROR",
  "UNKNOWN_ERROR",
]);

/**
 * Base error class for mysql-mcp with enhanced diagnostics
 */
export class MySQLMcpError extends Error {
  /** Error category for classification */
  readonly category: ErrorCategory;
  /** Module-prefixed error code (e.g., CONNECTION_ERROR) */
  readonly code: string;
  /** Actionable suggestion for resolving the error */
  readonly suggestion: string | undefined;
  /** Additional error details */
  readonly details: Record<string, unknown> | undefined;
  /** Whether the error is recoverable (can retry) */
  readonly recoverable: boolean;

  constructor(
    message: string,
    code: string,
    category: ErrorCategory,
    options?: {
      suggestion?: string | undefined;
      details?: Record<string, unknown> | undefined;
      recoverable?: boolean | undefined;
      cause?: Error | undefined;
    },
  ) {
    super(message, { cause: options?.cause });
    this.name = this.constructor.name;
    this.recoverable = options?.recoverable ?? false;
    this.details = options?.details;

    // Auto-detect suggestion and refine generic codes
    const match = findSuggestion(message);
    this.suggestion = options?.suggestion ?? match?.suggestion;

    // Prefer the suggestion's specific code and category over generic ones
    this.code = match?.code && REFINABLE_CODES.has(code) ? match.code : code;
    this.category =
      match?.category !== undefined && REFINABLE_CODES.has(code)
        ? match.category
        : category;

    // Capture stack trace
    Error.captureStackTrace?.(this, this.constructor);
  }

  /**
   * Convert to structured response object
   */
  toResponse(): ErrorResponse {
    return {
      success: false,
      error: this.message,
      code: this.code,
      category: this.category,
      suggestion: this.suggestion,
      recoverable: this.recoverable,
      details: this.details,
    };
  }
}

/**
 * Database connection error
 */
export class ConnectionError extends MySQLMcpError {
  constructor(
    message: string,
    details?: Record<string, unknown>,
    options?: { cause?: Error },
  ) {
    super(message, "CONNECTION_ERROR", ErrorCategory.CONNECTION, {
      suggestion:
        "Verify MySQL is running and connection parameters are correct.",
      details,
      recoverable: true,
      cause: options?.cause,
    });
  }
}

/**
 * Connection pool error
 */
export class PoolError extends MySQLMcpError {
  constructor(
    message: string,
    details?: Record<string, unknown>,
    code?: string,
    options?: { cause?: Error },
  ) {
    super(message, code ?? "POOL_ERROR", ErrorCategory.CONNECTION, {
      suggestion:
        "Check pool size limits or wait for connections to be released.",
      details,
      recoverable: true,
      cause: options?.cause,
    });
  }
}

/**
 * Query execution error
 */
export class QueryError extends MySQLMcpError {
  constructor(
    message: string,
    details?: Record<string, unknown>,
    options?: { cause?: Error },
  ) {
    super(message, "QUERY_ERROR", ErrorCategory.QUERY, {
      details,
      recoverable: false,
      cause: options?.cause,
    });
  }
}

/**
 * Authentication error
 */
export class AuthenticationError extends MySQLMcpError {
  constructor(
    message: string,
    details?: Record<string, unknown>,
    options?: { cause?: Error },
  ) {
    super(message, "AUTHENTICATION_ERROR", ErrorCategory.AUTHENTICATION, {
      suggestion: "Verify database credentials and authentication method.",
      details,
      recoverable: false,
      cause: options?.cause,
    });
  }
}

/**
 * Authorization error (insufficient permissions)
 */
export class AuthorizationError extends MySQLMcpError {
  constructor(
    message: string,
    details?: Record<string, unknown>,
    options?: { cause?: Error },
  ) {
    super(message, "AUTHORIZATION_ERROR", ErrorCategory.AUTHORIZATION, {
      suggestion: "Check the user's privileges on the target database object.",
      details,
      recoverable: false,
      cause: options?.cause,
    });
  }
}

/**
 * Validation error for input parameters
 */
export class ValidationError extends MySQLMcpError {
  constructor(
    message: string,
    details?: Record<string, unknown>,
    options?: { cause?: Error },
  ) {
    super(message, "VALIDATION_ERROR", ErrorCategory.VALIDATION, {
      details,
      recoverable: false,
      cause: options?.cause,
    });
  }
}

/**
 * Transaction error
 */
export class TransactionError extends MySQLMcpError {
  constructor(
    message: string,
    details?: Record<string, unknown>,
    options?: { cause?: Error },
  ) {
    super(message, "TRANSACTION_ERROR", ErrorCategory.QUERY, {
      suggestion:
        "Use mysql_transaction_rollback to end the aborted transaction, or mysql_transaction_rollback_to to recover to a savepoint.",
      details,
      recoverable: true,
      cause: options?.cause,
    });
  }
}

/**
 * Operation exceeded time limit
 */
export class TimeoutError extends MySQLMcpError {
  constructor(
    message: string,
    details?: Record<string, unknown>,
    options?: { cause?: Error },
  ) {
    super(message, "TIMEOUT_ERROR", ErrorCategory.CONNECTION, {
      details,
      recoverable: true,
      cause: options?.cause,
    });
  }
}

/**
 * Too many requests / rate limiting
 */
export class RateLimitError extends MySQLMcpError {
  constructor(
    message: string,
    details?: Record<string, unknown>,
    options?: { cause?: Error },
  ) {
    super(message, "RATE_LIMIT_ERROR", ErrorCategory.CONNECTION, {
      suggestion: "Wait before retrying the operation.",
      details,
      recoverable: true,
      cause: options?.cause,
    });
  }
}

/**
 * Resource version conflict (optimistic concurrency)
 */
export class ConflictError extends MySQLMcpError {
  constructor(
    message: string,
    details?: Record<string, unknown>,
    options?: { cause?: Error },
  ) {
    super(message, "CONFLICT_ERROR", ErrorCategory.QUERY, {
      suggestion: "The resource was modified by another request. Fetch the latest version and try again.",
      details,
      recoverable: true,
      cause: options?.cause,
    });
  }
}

/**
 * Required extension/plugin not available
 */
export class ExtensionNotAvailableError extends MySQLMcpError {
  constructor(
    extensionName: string,
    details?: Record<string, unknown>,
    options?: { cause?: Error },
  ) {
    super(
      `Extension '${extensionName}' is not installed or enabled`,
      "EXTENSION_MISSING",
      ErrorCategory.CONFIGURATION,
      {
        suggestion: `Verify that the '${extensionName}' plugin/extension is loaded on the MySQL server.`,
        details: { extension: extensionName, ...details },
        recoverable: false,
        cause: options?.cause,
      },
    );
  }
}
