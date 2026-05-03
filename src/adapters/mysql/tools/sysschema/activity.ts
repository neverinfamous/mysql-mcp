/**
 * MySQL sys Schema Tools - Activity Monitoring
 *
 * Tools for monitoring user and host activity.
 * 2 tools: user_summary, host_summary.
 */

import { z } from "zod";
import { formatHandlerErrorResponse, withTokenEstimate } from "../core/error-helpers.js";
import type { MySQLAdapter } from "../../mysql-adapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";

// =============================================================================
// Helpers
// =============================================================================

// =============================================================================
// Zod Schemas
// =============================================================================

const UserSummarySchemaBase = z.object({
  user: z.string().optional().describe("Filter by specific user"),
  limit: z.unknown().optional().describe("Maximum number of results"),
});

const UserSummarySchema = z.object({
  user: z.string().optional(),
  limit: z.unknown().optional(),
})
.transform((data) => ({
  user: data.user,
  limit: data.limit !== undefined ? Number(data.limit) : 5,
}))
.refine(
  (data) => !Number.isNaN(data.limit) && data.limit > 0,
  { message: "limit must be a positive number" }
);

const HostSummarySchemaBase = z.object({
  host: z.string().optional().describe("Filter by specific host"),
  limit: z.unknown().optional().describe("Maximum number of results"),
});

const HostSummarySchema = z.object({
  host: z.string().optional(),
  limit: z.unknown().optional(),
})
.transform((data) => ({
  host: data.host,
  limit: data.limit !== undefined ? Number(data.limit) : 5,
}))
.refine(
  (data) => !Number.isNaN(data.limit) && data.limit > 0,
  { message: "limit must be a positive number" }
);

/**
 * Get user activity summary
 */
export function createSysUserSummaryTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_sys_user_summary",
    title: "MySQL User Summary",
    description:
      "Get user activity summary including statements, connections, and latency from sys schema.",
    group: "sysschema",
    inputSchema: UserSummarySchemaBase,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { user, limit } = UserSummarySchema.parse(params);

        let query = `
                SELECT
                    user,
                    statements,
                    statement_latency,
                    statement_avg_latency,
                    table_scans,
                    file_ios,
                    file_io_latency,
                    current_connections,
                    total_connections
                FROM sys.user_summary
            `;

        const queryParams: unknown[] = [];
        if (user) {
          query += " WHERE user = ?";
          queryParams.push(user);
        }

        query += ` ORDER BY statement_latency DESC LIMIT ${String(limit)}`;

        const result = await adapter.executeQuery(query, queryParams);
        return withTokenEstimate({
          success: true,
          data: result.rows,
          count: result.rows?.length ?? 0,
        });
      } catch (err) {
        if (err instanceof z.ZodError) {
          return formatHandlerErrorResponse(err);
        }
        return formatHandlerErrorResponse(err);
      }
    },
  };
}

/**
 * Get host connection summary
 */
export function createSysHostSummaryTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_sys_host_summary",
    title: "MySQL Host Summary",
    description: "Get connection and activity summary by host from sys schema.",
    group: "sysschema",
    inputSchema: HostSummarySchemaBase,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { host, limit } = HostSummarySchema.parse(params);

        let query = `
                SELECT
                    host,
                    statements,
                    statement_latency,
                    statement_avg_latency,
                    table_scans,
                    file_ios,
                    file_io_latency,
                    current_connections,
                    total_connections
                FROM sys.host_summary
            `;

        const queryParams: unknown[] = [];
        if (host) {
          query += " WHERE host = ?";
          queryParams.push(host);
        }

        query += ` ORDER BY statement_latency DESC LIMIT ${String(limit)}`;

        const result = await adapter.executeQuery(query, queryParams);
        return withTokenEstimate({
          success: true,
          data: result.rows,
          count: result.rows?.length ?? 0,
        });
      } catch (err) {
        if (err instanceof z.ZodError) {
          return formatHandlerErrorResponse(err);
        }
        return formatHandlerErrorResponse(err);
      }
    },
  };
}
