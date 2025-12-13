/**
 * mysql-mcp - HTTP Transport
 * 
 * HTTP/SSE transport with OAuth 2.0 support.
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { OAuthResourceServer } from '../auth/OAuthResourceServer.js';
import type { TokenValidator } from '../auth/TokenValidator.js';
import { validateAuth, formatOAuthError } from '../auth/middleware.js';
import { logger } from '../utils/logger.js';

/**
 * HTTP transport configuration
 */
export interface HttpTransportConfig {
    /** Port to listen on */
    port: number;

    /** Host to bind to (default: localhost) */
    host?: string;

    /** OAuth resource server (optional) */
    resourceServer?: OAuthResourceServer;

    /** Token validator (optional, required if resourceServer is provided) */
    tokenValidator?: TokenValidator;

    /** CORS allowed origins (default: none) */
    corsOrigins?: string[];
}

/**
 * HTTP Transport for MCP
 */
export class HttpTransport {
    private server: ReturnType<typeof createServer> | null = null;
    private readonly config: HttpTransportConfig;

    constructor(config: HttpTransportConfig) {
        this.config = {
            ...config,
            host: config.host ?? 'localhost'
        };
    }

    /**
     * Start the HTTP server
     */
    async start(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.server = createServer((req, res) => {
                this.handleRequest(req, res).catch((error: unknown) => {
                    logger.error('HTTP request handler error', { error: String(error) });
                    res.writeHead(500);
                    res.end(JSON.stringify({ error: 'Internal server error' }));
                });
            });

            this.server.on('error', reject);

            this.server.listen(this.config.port, this.config.host, () => {
                logger.info(`HTTP transport listening on ${this.config.host}:${this.config.port}`);
                resolve();
            });
        });
    }

    /**
     * Stop the HTTP server
     */
    async stop(): Promise<void> {
        return new Promise((resolve) => {
            if (this.server) {
                this.server.close(() => {
                    logger.info('HTTP transport stopped');
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    /**
     * Handle incoming HTTP request
     */
    private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
        // Set CORS headers
        this.setCorsHeaders(req, res);

        // Handle preflight
        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }

        const url = new URL(req.url ?? '/', `http://${req.headers.host}`);

        // Handle well-known endpoints
        if (url.pathname === '/.well-known/oauth-protected-resource') {
            this.handleProtectedResourceMetadata(res);
            return;
        }

        // Health check
        if (url.pathname === '/health') {
            this.handleHealthCheck(res);
            return;
        }

        // Authenticate if OAuth is configured
        if (this.config.resourceServer && this.config.tokenValidator) {
            try {
                await validateAuth(req.headers.authorization, {
                    tokenValidator: this.config.tokenValidator,
                    required: true
                });
            } catch (error) {
                const { status, body } = formatOAuthError(error);
                res.writeHead(status, {
                    'Content-Type': 'application/json',
                    'WWW-Authenticate': 'Bearer'
                });
                res.end(JSON.stringify(body));
                return;
            }
        }

        // TODO: Handle MCP requests via SSE/HTTP
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Not found' }));
    }

    /**
     * Handle protected resource metadata endpoint
     */
    private handleProtectedResourceMetadata(res: ServerResponse): void {
        if (!this.config.resourceServer) {
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'OAuth not configured' }));
            return;
        }

        const metadata = this.config.resourceServer.getMetadata();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(metadata));
    }

    /**
     * Handle health check endpoint
     */
    private handleHealthCheck(res: ServerResponse): void {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'healthy', timestamp: new Date().toISOString() }));
    }

    /**
     * Set CORS headers
     */
    private setCorsHeaders(req: IncomingMessage, res: ServerResponse): void {
        const origin = req.headers.origin;

        // Only allow configured origins
        if (origin && this.config.corsOrigins?.includes(origin)) {
            res.setHeader('Access-Control-Allow-Origin', origin);
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            res.setHeader('Access-Control-Max-Age', '86400');
        }
    }
}

/**
 * Create an HTTP transport instance
 */
export function createHttpTransport(config: HttpTransportConfig): HttpTransport {
    return new HttpTransport(config);
}
