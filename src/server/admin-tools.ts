/**
 * mysql-mcp - Admin Tools
 *
 * Registration of server-level administrative tools.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { logger } from "../utils/logger.js";
import type { LogLevel } from "../utils/logger.js";
import { getAuthContext } from "../auth/auth-context.js";
import { hasScope, SCOPES } from "../auth/scopes.js";
import { InsufficientScopeError } from "../auth/errors.js";

/**
 * Register administrative tools
 */
export function registerAdminTools(server: McpServer): void {
  server.registerTool(
    "mysql_server_config",
    {
      title: "Server Configuration",
      description:
        "Get or update runtime configuration values for the server. Currently supports updating the log level.",
      inputSchema: z.object({
        action: z
          .enum(["get", "set"])
          .describe("Whether to get or set the configuration value"),
        setting: z
          .enum(["logLevel"])
          .optional()
          .describe("The setting to modify"),
        value: z
          .string()
          .optional()
          .describe(
            "The new value for the setting (e.g., 'debug', 'info', 'warning')",
          ),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    (args: unknown) => {
      const authCtx = getAuthContext();
      if (
        authCtx &&
        !hasScope(authCtx.scopes, SCOPES.ADMIN)
      ) {
        throw new InsufficientScopeError([SCOPES.ADMIN]);
      }
      try {
        const parsed = z
          .object({
            action: z.enum(["get", "set"]),
            setting: z.enum(["logLevel"]).optional(),
            value: z.string().optional(),
          })
          .parse(args ?? {});

        const { action, setting, value } = parsed;

        if (action === "get") {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    success: true,
                    config: {
                      logLevel: logger.getLevel(),
                    },
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        if (action === "set") {
          if (setting === "logLevel" && value) {
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
              return {
                content: [
                  {
                    type: "text" as const,
                    text: JSON.stringify(
                      {
                        success: false,
                        error: `Invalid log level: ${value}. Must be one of: ${validLevels.join(", ")}`,
                        code: "INVALID_CONFIG",
                        category: "validation",
                      },
                      null,
                      2,
                    ),
                  },
                ],
                isError: true,
              };
            }

            logger.setLevel(value.toLowerCase() as LogLevel);
            logger.info(
              `Log level dynamically changed to ${value} via mysql_server_config tool`,
              {
                module: "SERVER",
              },
            );

            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify(
                    {
                      success: true,
                      message: `Log level successfully updated to ${value}`,
                    },
                    null,
                    2,
                  ),
                },
              ],
            };
          }

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    success: false,
                    error: "Missing setting or value for set action",
                    code: "INVALID_CONFIG",
                    category: "validation",
                  },
                  null,
                  2,
                ),
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ 
                success: false, 
                error: "Invalid action",
                code: "INVALID_CONFIG",
                category: "validation"
              }),
            },
          ],
          isError: true,
        };
      } catch (error) {
        if (error instanceof z.ZodError) {
          const errMsg = "Validation error: " + error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ");
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  success: false,
                  error: errMsg,
                  code: "VALIDATION_ERROR",
                  category: "validation",
                }, null, 2),
              },
            ],
            isError: true,
          };
        }
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : String(error),
                code: "UNKNOWN_ERROR",
                category: "internal",
              }, null, 2),
            },
          ],
          isError: true,
        };
      }
    },
  );
}
