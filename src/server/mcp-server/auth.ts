import { OAuthResourceServer } from "../../auth/oauth-resource-server.js";
import { TokenValidator } from "../../auth/token-validator.js";
import { ProtocolError, ProtocolErrorCode } from "@modelcontextprotocol/server";
import type { McpServerConfig } from "../../types/index.js";

/**
 * Create OAuth resource server from config
 */
export function createOAuthResourceServer(config: McpServerConfig): OAuthResourceServer {
  if (!config.oauth?.enabled) {
    throw new ProtocolError(ProtocolErrorCode.InvalidParams, "OAuth is not enabled");
  }

  // Use audience as resource ID if not explicitly configured in future
  const resourceId = config.oauth.audience ?? "mysql-mcp";

  const issuer = config.oauth.issuer;
  if (!issuer) {
    throw new ProtocolError(ProtocolErrorCode.InvalidParams, "OAuth issuer is required");
  }

  return new OAuthResourceServer({
    resource: resourceId,
    authorizationServers: [issuer],
    scopesSupported: ["read", "write", "admin"],
    bearerMethodsSupported: ["header"],
  });
}

/**
 * Create token validator from config
 */
export function createTokenValidator(config: McpServerConfig): TokenValidator {
  if (!config.oauth?.enabled) {
    throw new ProtocolError(ProtocolErrorCode.InvalidParams, "OAuth is not enabled");
  }

  if (!config.oauth.jwksUri) {
    throw new ProtocolError(
      ProtocolErrorCode.InvalidParams,
      "OAuth JWKS URI is required for validation",
    );
  }

  const issuer = config.oauth.issuer;
  const audience = config.oauth.audience;
  if (!issuer || !audience) {
    throw new ProtocolError(
      ProtocolErrorCode.InvalidParams,
      "OAuth issuer and audience are required",
    );
  }

  return new TokenValidator({
    issuer,
    audience,
    jwksUri: config.oauth.jwksUri,
    clockTolerance: config.oauth.clockTolerance,
  });
}
