import type { ServerResponse } from "node:http";
import type { AuthenticatedContext } from "../../../auth/middleware.js";
import { getRequiredScope } from "../../../auth/scope-map.js";
import { hasScope } from "../../../auth/scopes.js";
import { InsufficientScopeError } from "../../../auth/errors.js";
import { logger } from "../../../utils/logger.js";
import { formatOAuthError } from "../../../auth/middleware.js";

/**
 * Check if a path is public (bypasses authentication)
 */
export function isPublicPath(pathname: string, publicPaths: string[] = []): boolean {
  for (const pattern of publicPaths) {
    if (pattern.endsWith("/*")) {
      const prefix = pattern.slice(0, -2);
      if (pathname.startsWith(prefix)) return true;
    } else if (pattern === pathname) {
      return true;
    }
  }
  return false;
}

/**
 * Check if the authenticated context has the required scope for a tool call.
 * Returns true if authorized, false if unauthorized (and sends response).
 */
export function checkToolScope(
  body: unknown,
  authContext: AuthenticatedContext,
  res: ServerResponse,
): boolean {
  interface JsonRpcBody {
    method?: string;
    params?: { name?: string };
  }
  const jsonBody = body as JsonRpcBody | null | undefined;

  if (jsonBody?.method === "tools/call") {
    const toolName = jsonBody.params?.name;
    if (toolName) {
      const requiredScope = getRequiredScope(toolName);
      const granted = hasScope(authContext.scopes, requiredScope);

      if (!granted) {
        const error = new InsufficientScopeError([requiredScope]);
        logger.warn(`Insufficient scope for tool: ${toolName}`, {
          module: "AUTH",
          operation: "scope-check",
          entityId: toolName,
        });
        const { status, body: errBody } = formatOAuthError(error);
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ...errBody, tool: toolName }));
        return false;
      }
    }
  }
  return true;
}
