/**
 * mysql-mcp - Auth Module Public Exports
 *
 * OAuth 2.1 authentication and authorization components.
 */

// Types
export type * from "./types.js";
export {
  OAuthError,
  TokenMissingError,
  InvalidTokenError,
  TokenExpiredError,
  InvalidSignatureError,
  InsufficientScopeError,
  AuthServerDiscoveryError,
  JwksFetchError,
  ClientRegistrationError,
  isOAuthError,
} from "./errors.js";

// Scopes
export * from "./scopes.js";

// Scope Map (tool → scope reverse lookup)
export { getRequiredScope, getToolScopeMap } from "./scope-map.js";

// Auth Context (AsyncLocalStorage per-request threading)
export { runWithAuthContext, getAuthContext } from "./auth-context.js";

// Core classes
export {
  OAuthResourceServer,
  createOAuthResourceServer,
} from "./OAuthResourceServer.js";
export {
  AuthorizationServerDiscovery,
  createAuthServerDiscovery,
} from "./AuthorizationServerDiscovery.js";
export { TokenValidator, createTokenValidator } from "./TokenValidator.js";

// Middleware
export {
  extractBearerToken,
  createAuthContext,
  validateAuth,
  requireScope,
  requireAnyScope,
  requireToolScope,
  formatOAuthError,
  type AuthenticatedContext,
  type AuthMiddlewareConfig,
} from "./middleware.js";

