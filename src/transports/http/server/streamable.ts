import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { AuthenticatedContext } from "../../../auth/middleware.js";
import { readBody } from "../security.js";
import { SESSION_ABSOLUTE_TTL_MS } from "../types.js";
import type { SessionManager } from "../session-manager.js";
import { checkToolScope } from "./utils.js";

/**
 * Handle streamable HTTP requests (Protocol 2025-03-26)
 */
export async function handleStreamableRequest(
  req: IncomingMessage,
  res: ServerResponse,
  sessionManager: SessionManager,
  authContext?: AuthenticatedContext,
  onConnect?: (transport: Transport) => void | Promise<void>,
): Promise<void> {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  if (req.method !== "POST") {
    if (sessionId) {
      const session = sessionManager.get(sessionId);
      if (session && session.transport instanceof StreamableHTTPServerTransport) {
        if (Date.now() - session.createdAt > SESSION_ABSOLUTE_TTL_MS) {
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              jsonrpc: "2.0",
              error: { code: -32000, message: "Unauthorized: Session absolute TTL expired" },
              id: null,
            }),
          );
          return;
        }
        sessionManager.touch(sessionId);
        sessionManager.incrementInFlight(sessionId);
        try {
          await session.transport.handleRequest(req, res);
        } finally {
          sessionManager.decrementInFlight(sessionId);
          sessionManager.touch(sessionId);
        }
        return;
      }
    }
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Bad Request: No valid session ID provided",
        },
        id: null,
      }),
    );
    return;
  }

  let body: unknown;
  try {
    body = await readBody(req);
  } catch {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32700, message: "Parse error: Invalid JSON" },
        id: null,
      }),
    );
    return;
  }

  if (authContext && !checkToolScope(body, authContext, res)) {
    return;
  }

  if (sessionId) {
    const session = sessionManager.get(sessionId);
    if (session && session.transport instanceof StreamableHTTPServerTransport) {
      if (Date.now() - session.createdAt > SESSION_ABSOLUTE_TTL_MS) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32000, message: "Unauthorized: Session absolute TTL expired" },
            id: null,
          }),
        );
        return;
      }
      sessionManager.touch(sessionId);
      sessionManager.incrementInFlight(sessionId);
      try {
        await session.transport.handleRequest(req, res, body);
      } finally {
        sessionManager.decrementInFlight(sessionId);
        sessionManager.touch(sessionId);
      }
      return;
    }
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message:
            "Bad Request: Session exists but uses a different transport protocol",
        },
        id: null,
      }),
    );
    return;
  }

  if (!sessionId && isInitializeRequest(body)) {
    const newTransport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (newSessionId: string) => {
        sessionManager.register(newSessionId, newTransport);
      },
    });

    newTransport.onclose = () => {
      const sid = newTransport.sessionId;
      if (sid && sessionManager.get(sid)) {
        void sessionManager.close(sid);
      }
    };

    if (onConnect) {
      await onConnect(newTransport);
    }

    const sid = newTransport.sessionId;
    if (sid) {
      sessionManager.incrementInFlight(sid);
    }
    try {
      await newTransport.handleRequest(req, res, body);
    } finally {
      if (sid) {
        sessionManager.decrementInFlight(sid);
        sessionManager.touch(sid);
      }
    }
    return;
  }

  res.writeHead(400, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Bad Request: No valid session ID provided",
      },
      id: null,
    }),
  );
}

/**
 * Handle stateless HTTP requests on `/mcp`.
 */
export async function handleStatelessRequest(
  req: IncomingMessage,
  res: ServerResponse,
  authContext?: AuthenticatedContext,
  onConnect?: (transport: Transport) => void | Promise<void>,
): Promise<void> {
  if (req.method === "GET") {
    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: {
          message: "SSE connections not available in stateless mode",
        },
      }),
    );
    return;
  }

  if (req.method === "DELETE") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== "POST") {
    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: { message: "Method not allowed" } }));
    return;
  }

  let body: unknown;
  try {
    body = await readBody(req);
  } catch {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32700, message: "Parse error: Invalid JSON" },
        id: null,
      }),
    );
    return;
  }

  if (authContext && !checkToolScope(body, authContext, res)) {
    return;
  }

  const transport = new StreamableHTTPServerTransport({});

  if (onConnect) {
    await onConnect(transport);
  }

  try {
    await transport.handleRequest(req, res, body);
  } catch {
    // Ignore transport closure errors
  }
  
  await transport.close();
}
