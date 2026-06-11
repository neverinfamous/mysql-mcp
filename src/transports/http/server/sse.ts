import type { IncomingMessage, ServerResponse } from "node:http";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { AuthenticatedContext } from "../../../auth/middleware.js";
import { logger } from "../../../utils/logger.js";
import { readBody } from "../security.js";
import { SESSION_ABSOLUTE_TTL_MS } from "../types.js";
import type { SessionManager } from "../session-manager.js";
import { checkToolScope } from "./utils.js";

/**
 * Extended SSE Transport that tracks the raw HTTP response object
 */
// eslint-disable-next-line @typescript-eslint/no-deprecated
export class ExtendedSSEServerTransport extends SSEServerTransport {}

/**
 * Handle legacy SSE connections (Protocol 2024-11-05)
 */
export async function handleLegacySSERequest(
  _req: IncomingMessage,
  res: ServerResponse,
  sessionManager: SessionManager,
  onConnect?: (transport: Transport) => void | Promise<void>,
): Promise<void> {
  logger.debug("Legacy SSE connection established");

  // eslint-disable-next-line @typescript-eslint/no-deprecated
  const transport = new SSEServerTransport("/messages", res);
  sessionManager.register(transport.sessionId, transport);

  res.on("close", () => {
    void sessionManager.close(transport.sessionId);
  });

  // Connect MCP server to this transport (must complete before client sends messages)
  if (onConnect) {
    await onConnect(transport);
  }
}

/**
 * Handle legacy SSE POST messages (Protocol 2024-11-05)
 */
export async function handleLegacyMessageRequest(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  sessionManager: SessionManager,
  authContext?: AuthenticatedContext,
): Promise<void> {
  const sessionId = url.searchParams.get("sessionId");

  if (!sessionId) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Missing sessionId parameter" }));
    return;
  }

  const session = sessionManager.get(sessionId);

  if (!session) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "No transport found for sessionId" }));
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-deprecated
  if (!(session.transport instanceof SSEServerTransport)) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error:
          "Session exists but uses a different transport protocol. Use /mcp instead.",
      }),
    );
    return;
  }

  if (Date.now() - session.createdAt > SESSION_ABSOLUTE_TTL_MS) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Unauthorized: Session absolute TTL expired" }));
    return;
  }

  let body: unknown;
  try {
    body = await readBody(req);
  } catch {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Parse error: Invalid JSON" }));
    return;
  }

  if (authContext && !checkToolScope(body, authContext, res)) {
    return;
  }

  sessionManager.touch(sessionId);
  sessionManager.incrementInFlight(sessionId);
  try {
    await session.transport.handlePostMessage(req, res, body);
  } finally {
    sessionManager.decrementInFlight(sessionId);
    sessionManager.touch(sessionId);
  }
}
