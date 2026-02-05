/**
 * Error Types
 *
 * Custom error classes for mysql-mcp server.
 */

/**
 * Base error class for mysql-mcp
 */
export class MySQLMcpError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "MySQLMcpError";
  }
}

/**
 * Database connection error
 */
export class ConnectionError extends MySQLMcpError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "CONNECTION_ERROR", details);
    this.name = "ConnectionError";
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
  ) {
    super(message, code ?? "POOL_ERROR", details);
    this.name = "PoolError";
  }
}

/**
 * Query execution error
 */
export class QueryError extends MySQLMcpError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "QUERY_ERROR", details);
    this.name = "QueryError";
  }
}

/**
 * Authentication error
 */
export class AuthenticationError extends MySQLMcpError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "AUTHENTICATION_ERROR", details);
    this.name = "AuthenticationError";
  }
}

/**
 * Authorization error (insufficient permissions)
 */
export class AuthorizationError extends MySQLMcpError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "AUTHORIZATION_ERROR", details);
    this.name = "AuthorizationError";
  }
}

/**
 * Validation error for input parameters
 */
export class ValidationError extends MySQLMcpError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "VALIDATION_ERROR", details);
    this.name = "ValidationError";
  }
}

/**
 * Transaction error
 */
export class TransactionError extends MySQLMcpError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "TRANSACTION_ERROR", details);
    this.name = "TransactionError";
  }
}
