/**
 * MySQL Shell - Version and Info Tools
 *
 * Tools for checking MySQL Shell version and installation status.
 */

import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "../core/error-helpers.js";
import { ShellVersionInputSchema, ShellVersionOutputSchema } from "../../schemas/shell/index.js";
import { getShellConfig, execMySQLShell } from "./common.js";

/**
 * Get MySQL Shell version and status
 */
export function createShellVersionTool(): ToolDefinition {
  return {
    name: "mysqlsh_version",
    title: "MySQL Shell Version",
    description:
      "Get MySQL Shell version and installation status. Useful for verifying MySQL Shell is available before running other shell tools.",
    group: "shell",
    inputSchema: ShellVersionInputSchema,
    outputSchema: ShellVersionOutputSchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      destructiveHint: false,
      sensitiveHint: false,
    },
    handler: async (_params: unknown, _context: RequestContext) => {
      try {
        const config = getShellConfig();

        const result = await execMySQLShell(["--version"]);

        // Parse version from output like "mysqlsh   Ver 8.0.44 for Win64 on x86_64"
        const versionRegex = /Ver\s+(\d+\.\d+\.\d+)/;
        const versionMatch = versionRegex.exec(result.stdout);
        const version = versionMatch ? versionMatch[1] : "unknown";

        return withTokenEstimate({
          success: true,
          data: {
            version,
            binPath: config.binPath,
            rawOutput: result.stdout.trim(),
          },
        });
      } catch (error) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}
