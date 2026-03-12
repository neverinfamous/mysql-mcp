/**
 * Server Configuration Types
 *
 * Type definitions for MCP server transport and configuration.
 */

import type { DatabaseConfig } from "./database.js";
import type { OAuthConfig } from "./oauth.js";

/**
 * Transport type for MCP communication
 */
export type TransportType = "stdio" | "http" | "sse";

/**
 * MCP Server configuration
 */
export interface McpServerConfig {
  /** Server name */
  name: string;

  /** Server version */
  version: string;

  /** Transport configuration */
  transport: TransportType;

  /** HTTP port (for http/sse transports) */
  port?: number;

  /** Host to bind HTTP transport to (default: localhost) */
  host?: string;

  /** Database configurations */
  databases: DatabaseConfig[];

  /** OAuth configuration */
  oauth?: OAuthConfig;

  /** Simple bearer token for HTTP authentication (alternative to OAuth) */
  authToken?: string;

  /** Enable stateless HTTP mode (no sessions, no SSE) */
  stateless?: boolean;

  /** Trust X-Forwarded-For header for client IP (behind reverse proxy) */
  trustProxy?: boolean;

  /** Tool filtering configuration */
  toolFilter?: string;
}
