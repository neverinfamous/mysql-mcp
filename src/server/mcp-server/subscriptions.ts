import type { McpServer as SdkMcpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SubscribeRequestSchema, UnsubscribeRequestSchema, McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import type { SubscriptionManager } from "../subscription-manager.js";

export function setupSubscriptions(server: SdkMcpServer, subscriptionManager: SubscriptionManager): void {
  // Handle subscribe request
  server.server.setRequestHandler(
    SubscribeRequestSchema,
    (request, extra) => {
      const uri = request.params.uri;
      let sessionId =
        extra.sessionId ??
        extra.requestInfo?.headers["mcp-session-id"] ??
        undefined;

      sessionId ??= "default";

      // Allow subscriptions to schema, tables, health, and dynamic table URIs
      if (
        !["mysql://schema", "mysql://tables", "mysql://health"].includes(
          uri,
        ) &&
        !uri.startsWith("mysql://table/")
      ) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Resource ${uri} is not subscribable`,
        );
      }

      subscriptionManager.subscribe(
        uri,
        sessionId as string | undefined,
      );
      return {};
    },
  );

  // Handle unsubscribe request
  server.server.setRequestHandler(
    UnsubscribeRequestSchema,
    (request, extra) => {
      const uri = request.params.uri;
      let sessionId =
        extra.sessionId ??
        extra.requestInfo?.headers["mcp-session-id"] ??
        undefined;

      sessionId ??= "default";

      subscriptionManager.unsubscribe(
        uri,
        sessionId as string | undefined,
      );
      return {};
    },
  );
}
