/**
 * MCP Protocol Logging
 * 
 * Bridges application logging to MCP protocol log notifications.
 * This allows MCP clients to receive log messages from the server.
 * 
 * MCP Spec Reference:
 * https://modelcontextprotocol.io/specification/2025-11-25/server/utilities/logging
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * MCP log levels as defined in the specification
 * Maps to syslog severity levels (RFC 5424)
 */
export type McpLogLevel =
    | 'debug'     // Detailed debug information
    | 'info'      // Informational messages
    | 'notice'    // Normal but significant events
    | 'warning'   // Warning conditions
    | 'error'     // Error conditions
    | 'critical'  // Critical conditions
    | 'alert'     // Action must be taken immediately
    | 'emergency'; // System is unusable

/**
 * MCP Logger class that sends log messages to connected clients
 */
class McpLogger {
    private server: McpServer | null = null;
    private loggerName = 'mysql-mcp';
    private enabled = true;
    private minLevel: McpLogLevel = 'info';

    /**
     * Level priority for filtering
     */
    private readonly levelPriority: Record<McpLogLevel, number> = {
        debug: 0,
        info: 1,
        notice: 2,
        warning: 3,
        error: 4,
        critical: 5,
        alert: 6,
        emergency: 7
    };

    /**
     * Initialize the MCP logger with the SDK server instance
     */
    setServer(server: McpServer): void {
        this.server = server;
    }

    /**
     * Set the logger name (appears in log messages)
     */
    setLoggerName(name: string): void {
        this.loggerName = name;
    }

    /**
     * Enable or disable MCP logging
     */
    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
    }

    /**
     * Set minimum log level
     */
    setMinLevel(level: McpLogLevel): void {
        this.minLevel = level;
    }

    /**
     * Check if a level should be logged
     */
    private shouldLog(level: McpLogLevel): boolean {
        return this.levelPriority[level] >= this.levelPriority[this.minLevel];
    }

    /**
     * Send a log message to connected MCP clients
     */
    log(level: McpLogLevel, message: string, data?: Record<string, unknown>): void {
        if (!this.enabled || !this.server || !this.shouldLog(level)) {
            return;
        }

        try {
            // Use the SDK's sendLoggingMessage method
            void this.server.sendLoggingMessage({
                level,
                logger: this.loggerName,
                data: data ? { message, ...data } : message
            });
        } catch {
            // Silently fail if logging fails - don't crash the server
            // The MCP transport might not be connected yet
        }
    }

    // Convenience methods for each log level

    debug(message: string, data?: Record<string, unknown>): void {
        this.log('debug', message, data);
    }

    info(message: string, data?: Record<string, unknown>): void {
        this.log('info', message, data);
    }

    notice(message: string, data?: Record<string, unknown>): void {
        this.log('notice', message, data);
    }

    warning(message: string, data?: Record<string, unknown>): void {
        this.log('warning', message, data);
    }

    error(message: string, data?: Record<string, unknown>): void {
        this.log('error', message, data);
    }

    critical(message: string, data?: Record<string, unknown>): void {
        this.log('critical', message, data);
    }

    alert(message: string, data?: Record<string, unknown>): void {
        this.log('alert', message, data);
    }

    emergency(message: string, data?: Record<string, unknown>): void {
        this.log('emergency', message, data);
    }
}

/**
 * Singleton MCP logger instance
 * 
 * Usage:
 *   import { mcpLogger } from './logging/McpLogging.js';
 *   
 *   // In server startup:
 *   mcpLogger.setServer(sdkServer);
 *   
 *   // In application code:
 *   mcpLogger.info('Query executed', { rowCount: 100 });
 *   mcpLogger.error('Connection failed', { host: 'localhost' });
 */
export const mcpLogger = new McpLogger();
