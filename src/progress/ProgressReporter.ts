/**
 * MCP Protocol Progress Notifications
 * 
 * Reports progress for long-running operations to MCP clients.
 * Clients can use this to display progress bars or status updates.
 * 
 * MCP Spec Reference:
 * https://modelcontextprotocol.io/specification/2025-11-25/server/utilities/progress
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * Progress token type as defined in MCP spec
 */
export type ProgressToken = string | number;

/**
 * Progress notification parameters (matches MCP spec)
 */
interface ProgressNotificationParams {
    progressToken: ProgressToken;
    progress: number;
    total?: number;
    message?: string;
}

/**
 * ProgressReporter wraps progress notification sending for a specific operation
 * 
 * Usage:
 *   const reporter = new ProgressReporter(server, progressToken);
 *   reporter.report(10, 100, 'Processing rows...');
 *   reporter.report(50, 100, 'Halfway done...');
 *   reporter.complete('Done!');
 */
export class ProgressReporter {
    private completed = false;

    constructor(
        private server: McpServer,
        private progressToken: ProgressToken
    ) { }

    /**
     * Get the progress token for this reporter
     */
    getToken(): ProgressToken {
        return this.progressToken;
    }

    /**
     * Send a progress notification to the client
     */
    private sendProgress(params: ProgressNotificationParams): void {
        try {
            // Access the underlying Server instance and use its notification method
            // The McpServer wraps Server, which has notification() for raw notifications
            const underlyingServer = this.server.server;
            void underlyingServer.notification({
                method: 'notifications/progress',
                params
            });
        } catch {
            // Silently fail - progress is non-critical
            // Transport might not support progress or not be connected yet
        }
    }

    /**
     * Report progress to the client
     * 
     * @param progress - Current progress value (e.g., rows processed, bytes transferred)
     * @param total - Optional total expected value for percentage calculation
     * @param message - Optional human-readable status message
     */
    report(progress: number, total?: number, message?: string): void {
        if (this.completed) return;

        this.sendProgress({
            progressToken: this.progressToken,
            progress,
            total,
            message
        });
    }

    /**
     * Report completion with optional final message
     */
    complete(message?: string): void {
        if (this.completed) return;
        this.completed = true;

        this.sendProgress({
            progressToken: this.progressToken,
            progress: 1,
            total: 1,
            message: message ?? 'Complete'
        });
    }

    /**
     * Report an error condition
     */
    error(message: string): void {
        if (this.completed) return;
        this.completed = true;

        this.sendProgress({
            progressToken: this.progressToken,
            progress: 0,
            message: `Error: ${message}`
        });
    }

    /**
     * Check if this reporter is still active
     */
    isActive(): boolean {
        return !this.completed;
    }
}

/**
 * Progress reporter factory
 * 
 * Use this when you need to create progress reporters across the application.
 * Initialize with the SDK server instance at startup.
 */
class ProgressReporterFactory {
    private server: McpServer | null = null;

    /**
     * Initialize the factory with the SDK server
     */
    setServer(server: McpServer): void {
        this.server = server;
    }

    /**
     * Create a new progress reporter for an operation
     * 
     * @param progressToken - Token from the client request (if provided)
     * @returns ProgressReporter if token provided and server available, null otherwise
     */
    create(progressToken: ProgressToken | undefined): ProgressReporter | null {
        if (!this.server || progressToken === undefined) {
            return null;
        }
        return new ProgressReporter(this.server, progressToken);
    }

    /**
     * Check if progress reporting is available
     */
    isAvailable(): boolean {
        return this.server !== null;
    }
}

/**
 * Singleton factory instance
 * 
 * Usage:
 *   import { progressFactory } from './progress/ProgressReporter.js';
 *   
 *   // In server startup:
 *   progressFactory.setServer(sdkServer);
 *   
 *   // In tool handler:
 *   const reporter = progressFactory.create(context.progressToken);
 *   if (reporter) {
 *     reporter.report(0, totalRows, 'Starting export...');
 *     // ... do work ...
 *     reporter.complete('Export finished');
 *   }
 */
export const progressFactory = new ProgressReporterFactory();
