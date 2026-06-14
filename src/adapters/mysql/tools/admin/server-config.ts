/**
 * MySQL Admin Tools - Server Configuration
 *
 * Dynamic runtime server configuration tool.
 */


import type { ToolDefinition, RequestContext } from "../../../../types/index.js";
import { logger } from "../../../../utils/logger.js";
import type { LogLevel } from "../../../../utils/logger.js";
import { getAuthContext } from "../../../../auth/auth-context.js";
import { hasScope, SCOPES } from "../../../../auth/scopes.js";
import { InsufficientScopeError } from "../../../../auth/errors.js";
import { formatHandlerErrorResponse, withTokenEstimate } from "../core/error-helpers.js";
import { ValidationError } from "../../../../types/index.js";
import { ServerConfigSchemaBase, ServerConfigSchema, ServerConfigOutputSchema } from "../../schemas/index.js";

// =============================================================================
// Tool
// =============================================================================

export function createServerConfigTool(): ToolDefinition {
  return {
    name: "mysql_server_config",
    title: "Server Configuration",
    description:
      "Get or update runtime configuration values for the server. Currently supports updating the log level.",
    group: "admin",
    inputSchema: ServerConfigSchemaBase,
    outputSchema: ServerConfigOutputSchema,
    requiredScopes: [SCOPES.ADMIN],
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
      sensitiveHint: true,
    },
    handler: (params: unknown, _context: RequestContext) => {
      const authCtx = getAuthContext();
      if (authCtx && !hasScope(authCtx.scopes, SCOPES.ADMIN)) {
        return Promise.resolve(formatHandlerErrorResponse(new InsufficientScopeError([SCOPES.ADMIN])));
      }

      try {
        const parsed = ServerConfigSchema.parse(params);
        const { action, setting, value } = parsed;

        if (action === "get") {
          return Promise.resolve(
            withTokenEstimate({
              success: true,
              data: {
                config: {
                  logLevel: logger.getLevel(),
                },
              },
            }),
          );
        }

        if (action === "set" && setting === "logLevel" && value) {
          const validLevels = [
            "debug",
            "info",
            "notice",
            "warning",
            "error",
            "critical",
            "alert",
            "emergency",
          ];

          if (!validLevels.includes(value.toLowerCase())) {
            return Promise.resolve(
              formatHandlerErrorResponse(
                new ValidationError(
                  `Invalid log level: ${value}. Must be one of: ${validLevels.join(", ")}`
                )
              )
            );
          }

          logger.setLevel(value.toLowerCase() as LogLevel);
          logger.info(
            `Log level dynamically changed to ${value} via mysql_server_config tool`,
            {
              module: "SERVER",
            },
          );

          return Promise.resolve(
            withTokenEstimate({
              success: true,
              data: {
                message: `Log level successfully updated to ${value}`,
              },
            }),
          );
        }

        return Promise.resolve(
          formatHandlerErrorResponse(new ValidationError("Invalid configuration or missing values for set action"))
        );
      } catch (err: unknown) {
        return Promise.resolve(formatHandlerErrorResponse(err));
      }
    },
  };
}
