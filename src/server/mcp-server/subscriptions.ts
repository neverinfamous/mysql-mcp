import { ProtocolError, ProtocolErrorCode } from "@modelcontextprotocol/server";
import type { McpServer as SdkMcpServer } from "@modelcontextprotocol/server";
import type { SubscriptionManager } from "../subscription-manager.js";

export function setupSubscriptions(server: SdkMcpServer, subscriptionManager: SubscriptionManager): void {
  // Handle subscribe request
  server.server.setRequestHandler(
    'resources/subscribe',
    (request, ctx) => {
      const uri = request.params.uri;
      let sessionId =
        ctx.sessionId ??
        (typeof ctx.http?.req?.headers?.get === 'function' 
          ? (ctx.http.req.headers.get("mcp-session-id") as string | undefined) 
          : ((ctx.http?.req?.headers as unknown) as Record<string, string | undefined>)?.["mcp-session-id"]) ??
        undefined;

      sessionId ??= "default";

      // Allow subscriptions to schema, tables, health, and dynamic table URIs
      if (
        !["mysql://schema", "mysql://tables", "mysql://health"].includes(
          uri,
        ) &&
        !uri.startsWith("mysql://table/")
      ) {
        throw new ProtocolError(
          ProtocolErrorCode.InvalidParams,
          `Resource ${uri} is not subscribable`,
        );
      }

      subscriptionManager.subscribe(
        uri,
        sessionId,
      );
      return {};
    },
  );

  // Handle unsubscribe request
  server.server.setRequestHandler(
    'resources/unsubscribe',
    (request, ctx) => {
      const uri = request.params.uri;
      let sessionId =
        ctx.sessionId ??
        (typeof ctx.http?.req?.headers?.get === 'function' 
          ? (ctx.http.req.headers.get("mcp-session-id") as string | undefined) 
          : ((ctx.http?.req?.headers as unknown) as Record<string, string | undefined>)?.["mcp-session-id"]) ??
        undefined;

      sessionId ??= "default";

      subscriptionManager.unsubscribe(
        uri,
        sessionId,
      );
      return {};
    },
  );
}
