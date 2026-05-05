/**
 * mysql-mcp - HTTP Transport Handlers
 *
 * Utility endpoint handlers for health, root info, and OAuth metadata.
 */

import type { ServerResponse } from "node:http";
import type { HttpTransportConfig } from "./types.js";

// =============================================================================
// Health Check
// =============================================================================

/**
 * Handle GET /health — returns server health status.
 * Health checks bypass rate limiting so monitoring probes always succeed.
 */
export function handleHealthCheck(
  res: ServerResponse,
  config: HttpTransportConfig,
): void {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      status: "healthy",
      timestamp: new Date().toISOString(),
      oauthEnabled: !!(config.resourceServer && config.tokenValidator),
    }),
  );
}

// =============================================================================
// Root Info
// =============================================================================

/**
 * Handle GET / — helpful for browser visitors and debugging.
 */
export function handleRootInfo(res: ServerResponse): void {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      name: "mysql-mcp",
      description: "MySQL MCP Server with dual HTTP transport",
      endpoints: {
        "POST /mcp": "JSON-RPC requests (Streamable HTTP, MCP 2025-03-26)",
        "GET /mcp": "SSE stream for server-to-client notifications",
        "DELETE /mcp": "Session termination",
        "GET /sse": "Legacy SSE connection (MCP 2024-11-05)",
        "POST /messages": "Legacy SSE message endpoint",
        "GET /health": "Health check",
      },
      documentation: "https://github.com/neverinfamous/mysql-mcp",
    }),
  );
}

// =============================================================================
// OAuth Protected Resource Metadata
// =============================================================================

/**
 * Handle GET /.well-known/oauth-protected-resource
 */
export function handleProtectedResourceMetadata(
  res: ServerResponse,
  config: HttpTransportConfig,
): void {
  if (!config.resourceServer) {
    res.writeHead(404);
    res.end(JSON.stringify({ error: "OAuth not configured" }));
    return;
  }

  const metadata = config.resourceServer.getMetadata();
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(metadata));
}
