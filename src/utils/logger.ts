/**
 * mysql-mcp - Structured Logger
 *
 * Centralized logging utility with RFC 5424 severity levels and structured output.
 * Supports dual-mode logging: stderr for local debugging and MCP protocol notifications.
 *
 * Format: [timestamp] [LEVEL] [MODULE] [CODE] message {context}
 * Example: [2025-12-18T01:30:00Z] [ERROR] [ADAPTER] [MYSQL_CONNECT_FAILED] Failed to connect {"host":"localhost"}
 */

/**
 * RFC 5424 syslog severity levels
 * @see https://datatracker.ietf.org/doc/html/rfc5424#section-6.2.1
 */
export type LogLevel =
  | "debug" // 7 - Debug-level messages
  | "info" // 6 - Informational messages
  | "notice" // 5 - Normal but significant condition
  | "warning" // 4 - Warning conditions
  | "error" // 3 - Error conditions
  | "critical" // 2 - Critical conditions
  | "alert" // 1 - Action must be taken immediately
  | "emergency"; // 0 - System is unusable

/**
 * Module identifiers for log categorization
 */
export type LogModule =
  | "SERVER" // MCP server lifecycle
  | "ADAPTER" // Database adapter operations
  | "AUTH" // OAuth/authentication
  | "TOOLS" // Tool execution
  | "RESOURCES" // Resource handlers
  | "PROMPTS" // Prompt handlers
  | "TRANSPORT" // HTTP/SSE/stdio transport
  | "QUERY" // SQL query execution
  | "POOL" // Connection pool
  | "FILTER" // Tool filtering
  | "ROUTER" // MySQL Router
  | "PROXYSQL" // ProxySQL
  | "SHELL" // MySQL Shell
  | "CLI"; // Command line interface

/**
 * Structured log context following MCP logging standards
 */
export interface LogContext {
  /** Module identifier */
  module?: LogModule;
  /** Module-prefixed error/event code (e.g., MYSQL_CONNECT_FAILED) */
  code?: string;
  /** Operation being performed (e.g., executeQuery, connect) */
  operation?: string;
  /** Entity identifier (e.g., table name, connection id) */
  entityId?: string;
  /** Request identifier for tracing */
  requestId?: string;
  /** Error stack trace */
  stack?: string;
  /** Additional context fields */
  [key: string]: unknown;
}

interface LogEntry {
  level: LogLevel;
  module?: LogModule | undefined;
  code?: string | undefined;
  message: string;
  timestamp: string;
  context?: LogContext | undefined;
}

/**
 * Sensitive patterns to redact from logs
 * Note: Patterns are designed to avoid ReDoS by using non-overlapping character classes
 * and avoiding nested quantifiers on ambiguous patterns.
 */
const SENSITIVE_PATTERNS = [
  // Use word boundaries and specific character classes to avoid backtracking
  /\bpassword[=:]\s*[^\s,;]{1,100}/gi,
  /\bsecret[=:]\s*[^\s,;]{1,100}/gi,
  /\btoken[=:]\s*[^\s,;]{1,100}/gi,
  /\bauthorization:\s*bearer\s+\S{1,500}/gi,
  // MySQL connection string - use specific pattern with length limits
  /mysql:\/\/[^:]{1,50}:[^@]{1,100}@/gi,
];

/**
 * Maximum length of input to process with regex
 * Prevents ReDoS on extremely long strings
 */
const MAX_REDACT_LENGTH = 10000;

/**
 * Redact sensitive information from a string
 */
function redactSensitive(input: string): string {
  // Limit input length to prevent ReDoS attacks
  if (input.length > MAX_REDACT_LENGTH) {
    // For very long strings, truncate and add indicator
    // codeql[js/polynomial-redos] - Input is length-limited before regex processing
    return (
      redactSensitive(input.substring(0, MAX_REDACT_LENGTH)) + "...[TRUNCATED]"
    );
  }

  let result = input;
  for (const pattern of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, (match) => {
      // Keep the key part, redact the value
      const colonIndex = match.indexOf(":");
      const equalIndex = match.indexOf("=");
      const delimiterIndex = colonIndex >= 0 ? colonIndex : equalIndex;

      if (delimiterIndex >= 0) {
        return match.substring(0, delimiterIndex + 1) + "[REDACTED]";
      }
      return "[REDACTED]";
    });
  }
  return result;
}

/**
 * Sensitive keys to redact from context objects
 */
const SENSITIVE_KEYS = new Set([
  "password",
  "secret",
  "token",
  "authorization",
  "apikey",
  "api_key",
  "accesstoken",
  "access_token",
  "refreshtoken",
  "refresh_token",
  "credential",
  "credentials",
  "issuer",
  "audience",
  "jwksuri",
  "jwks_uri",
  "client_secret",
  "clientsecret",
]);

/**
 * Pre-compiled regex for substring matching of sensitive keys.
 * Avoids O(n×m) spread-and-some on every context key.
 */
const SENSITIVE_KEY_PATTERN = new RegExp(
  [...SENSITIVE_KEYS]
    .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|"),
);

/**
 * Sanitize log context by redacting sensitive values
 */
function sanitizeContext(context: LogContext): LogContext {
  const result: LogContext = {};

  for (const [key, value] of Object.entries(context)) {
    const lowerKey = key.toLowerCase();

    const isSensitive =
      SENSITIVE_KEYS.has(lowerKey) || SENSITIVE_KEY_PATTERN.test(lowerKey);

    if (isSensitive && value !== undefined && value !== null) {
      result[key] = "[REDACTED]";
    } else if (typeof value === "string") {
      result[key] = redactSensitive(value);
    } else if (
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value)
    ) {
      result[key] = sanitizeContext(value as LogContext);
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Remove control characters from log messages to prevent log injection
 */
// Pre-compiled regex for control character removal.
// Matches: 0x00-0x08, 0x0B, 0x0C, 0x0E-0x1F, 0x7F (excludes \t 0x09, \n 0x0A, \r 0x0D)
// eslint-disable-next-line no-control-regex
const CONTROL_CHAR_PATTERN = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

function sanitizeMessage(message: string): string {
  return message.replace(CONTROL_CHAR_PATTERN, "");
}

/**
 * RFC 5424 severity priority (lower number = higher severity)
 */
const LEVEL_PRIORITY: Record<LogLevel, number> = {
  emergency: 0,
  alert: 1,
  critical: 2,
  error: 3,
  warning: 4,
  notice: 5,
  info: 6,
  debug: 7,
};

/**
 * MCP-aware structured logger with dual-mode output
 *
 * Follows MCP Server Logging Standards:
 * - Centralized logger writing to stderr only (stdout reserved for MCP protocol)
 * - Include: module, operation, entityId, context, stack traces
 * - Module-prefixed codes (e.g., MYSQL_CONNECT_FAILED, AUTH_TOKEN_INVALID)
 * - Severity: RFC 5424 levels
 * - Format: [timestamp] [LEVEL] [MODULE] [CODE] message {context}
 */
class Logger {
  private minLevel: LogLevel = "info";
  private loggerName = "mysql-mcp";
  private defaultModule: LogModule = "SERVER";

  /**
   * Set the minimum log level
   */
  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  /**
   * Get the current minimum log level
   */
  getLevel(): LogLevel {
    return this.minLevel;
  }

  /**
   * Set the logger name
   */
  setLoggerName(name: string): void {
    this.loggerName = name;
  }

  /**
   * Get the logger name
   */
  getLoggerName(): string {
    return this.loggerName;
  }

  /**
   * Set the default module for logs without explicit module
   */
  setDefaultModule(module: LogModule): void {
    this.defaultModule = module;
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVEL_PRIORITY[level] <= LEVEL_PRIORITY[this.minLevel];
  }

  /**
   * Format log entry according to MCP logging standard
   * Format: [timestamp] [LEVEL] [MODULE] [CODE] message {context}
   */
  private formatEntry(entry: LogEntry): string {
    const parts: string[] = [
      `[${entry.timestamp}]`,
      `[${entry.level.toUpperCase()}]`,
    ];

    // Add module if present
    if (entry.module) {
      parts.push(`[${entry.module}]`);
    }

    // Add code if present
    if (entry.code) {
      parts.push(`[${entry.code}]`);
    }

    // Add message
    parts.push(entry.message);

    // Add context if present (excluding module and code which are already in the format)
    if (entry.context) {
      // Destructure out fields that are already in the log line format
      const { module, code, ...restContext } = entry.context;
      void module;
      void code; // Intentionally unused - already in format
      if (Object.keys(restContext).length > 0) {
        const sanitizedContext = sanitizeContext(restContext);
        parts.push(JSON.stringify(sanitizedContext));
      }
    }

    return parts.join(" ");
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, context?: LogContext): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const sanitizedMessage = sanitizeMessage(redactSensitive(message));

    const entry: LogEntry = {
      level,
      module: context?.module ?? this.defaultModule,
      code: context?.code,
      message: sanitizedMessage,
      timestamp: new Date().toISOString(),
      context,
    };

    const formatted = this.formatEntry(entry);

    // Write to stderr to avoid interfering with MCP stdio transport
    console.error(formatted);
  }

  // =========================================================================
  // Convenience methods for each log level
  // =========================================================================

  debug(message: string, context?: LogContext): void {
    this.log("debug", message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log("info", message, context);
  }

  notice(message: string, context?: LogContext): void {
    this.log("notice", message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log("warning", message, context);
  }

  warning(message: string, context?: LogContext): void {
    this.log("warning", message, context);
  }

  error(message: string, context?: LogContext): void {
    this.log("error", message, context);
  }

  critical(message: string, context?: LogContext): void {
    this.log("critical", message, context);
  }

  alert(message: string, context?: LogContext): void {
    this.log("alert", message, context);
  }

  emergency(message: string, context?: LogContext): void {
    this.log("emergency", message, context);
  }

  // =========================================================================
  // Module-scoped logging helpers
  // =========================================================================

  /**
   * Create a child logger scoped to a specific module
   */
  forModule(module: LogModule): ModuleLogger {
    return new ModuleLogger(this, module);
  }
}

/**
 * Module-scoped logger for cleaner code in specific modules
 */
class ModuleLogger {
  constructor(
    private parent: Logger,
    private module: LogModule,
  ) {}

  private withModule(context?: LogContext): LogContext {
    return { ...context, module: this.module };
  }

  debug(message: string, context?: LogContext): void {
    this.parent.debug(message, this.withModule(context));
  }

  info(message: string, context?: LogContext): void {
    this.parent.info(message, this.withModule(context));
  }

  notice(message: string, context?: LogContext): void {
    this.parent.notice(message, this.withModule(context));
  }

  warn(message: string, context?: LogContext): void {
    this.parent.warn(message, this.withModule(context));
  }

  warning(message: string, context?: LogContext): void {
    this.parent.warning(message, this.withModule(context));
  }

  error(message: string, context?: LogContext): void {
    this.parent.error(message, this.withModule(context));
  }

  critical(message: string, context?: LogContext): void {
    this.parent.critical(message, this.withModule(context));
  }

  alert(message: string, context?: LogContext): void {
    this.parent.alert(message, this.withModule(context));
  }

  emergency(message: string, context?: LogContext): void {
    this.parent.emergency(message, this.withModule(context));
  }
}

export const logger = new Logger();

// Initialize log level from environment
const envLevel = process.env["LOG_LEVEL"]?.toLowerCase();
if (envLevel && envLevel in LEVEL_PRIORITY) {
  logger.setLevel(envLevel as LogLevel);
}
