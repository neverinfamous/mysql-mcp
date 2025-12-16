/**
 * mysql-mcp - Centralized Logger
 * 
 * Structured logging with security-aware sanitization.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
    context?: Record<string, unknown>;
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
        return redactSensitive(input.substring(0, MAX_REDACT_LENGTH)) + '...[TRUNCATED]';
    }

    let result = input;
    for (const pattern of SENSITIVE_PATTERNS) {
        result = result.replace(pattern, (match) => {
            // Keep the key part, redact the value
            const colonIndex = match.indexOf(':');
            const equalIndex = match.indexOf('=');
            const delimiterIndex = colonIndex >= 0 ? colonIndex : equalIndex;

            if (delimiterIndex >= 0) {
                return match.substring(0, delimiterIndex + 1) + '[REDACTED]';
            }
            return '[REDACTED]';
        });
    }
    return result;
}

/**
 * Sanitize log context by redacting sensitive values
 */
function sanitizeContext(context: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const sensitiveKeys = ['password', 'secret', 'token', 'authorization', 'apikey', 'api_key'];

    for (const [key, value] of Object.entries(context)) {
        const lowerKey = key.toLowerCase();

        if (sensitiveKeys.some(k => lowerKey.includes(k))) {
            result[key] = '[REDACTED]';
        } else if (typeof value === 'string') {
            result[key] = redactSensitive(value);
        } else if (typeof value === 'object' && value !== null) {
            result[key] = sanitizeContext(value as Record<string, unknown>);
        } else {
            result[key] = value;
        }
    }

    return result;
}

/**
 * Remove control characters from log messages to prevent log injection
 */
function sanitizeMessage(message: string): string {
    // Remove control characters except newlines and tabs
    // Using explicit character code check to avoid no-control-regex lint error
    let result = '';
    for (const char of message) {
        const code = char.charCodeAt(0);
        // Allow valid printable characters (>= 32), newlines (10), tabs (9), and carriage returns (13)
        // Exclude DEL (127)
        if ((code >= 32 && code !== 127) || code === 10 || code === 9 || code === 13) {
            result += char;
        }
    }
    return result;
}

/**
 * Format a log entry for output
 */
function formatEntry(entry: LogEntry): string {
    const prefix = `[mysql-mcp]`;
    const level = entry.level.toUpperCase().padEnd(5);

    let output = `${prefix} ${level} ${entry.message}`;

    if (entry.context && Object.keys(entry.context).length > 0) {
        output += ` ${JSON.stringify(entry.context)}`;
    }

    return output;
}

/**
 * Current log level (configurable via environment)
 */
let currentLogLevel: LogLevel = 'info';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
};

/**
 * Check if a level should be logged
 */
function shouldLog(level: LogLevel): boolean {
    return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[currentLogLevel];
}

/**
 * Core logging function
 */
function log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (!shouldLog(level)) return;

    const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level,
        message: sanitizeMessage(redactSensitive(message)),
        context: context ? sanitizeContext(context) : undefined
    };

    const formatted = formatEntry(entry);

    // All log output goes to stderr to avoid interfering with MCP stdio protocol
    // MCP requires only JSON-RPC messages on stdout
    console.error(formatted);
}

/**
 * Logger interface
 */
export const logger = {
    debug: (message: string, context?: Record<string, unknown>) => log('debug', message, context),
    info: (message: string, context?: Record<string, unknown>) => log('info', message, context),
    warn: (message: string, context?: Record<string, unknown>) => log('warn', message, context),
    error: (message: string, context?: Record<string, unknown>) => log('error', message, context),

    /**
     * Set the minimum log level
     */
    setLevel: (level: LogLevel) => {
        currentLogLevel = level;
    },

    /**
     * Get the current log level
     */
    getLevel: (): LogLevel => currentLogLevel
};

// Initialize log level from environment
const envLevel = process.env['LOG_LEVEL']?.toLowerCase();
if (envLevel && envLevel in LEVEL_PRIORITY) {
    currentLogLevel = envLevel as LogLevel;
}
