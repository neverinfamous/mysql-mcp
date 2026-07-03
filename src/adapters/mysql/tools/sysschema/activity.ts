/**
 * MySQL sys Schema Tools - Activity Monitoring
 *
 * Tools for monitoring user and host activity.
 * 2 tools: user_summary, host_summary.
 */

import { z } from "zod";
import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "../core/error-helpers.js";
import {
  SysUserSummaryOutputSchema,
  SysHostSummaryOutputSchema,
} from "../../schemas/sysschema.js";
import type { MySQLAdapter } from "../../mysql-adapter/index.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import { READ_ONLY } from "../../../../utils/annotations.js";

// =============================================================================
// Helpers
// =============================================================================

// =============================================================================
// Zod Schemas
// =============================================================================

const UserSummarySchemaBase = z.object({
  user: z.string().optional().describe("Filter by specific user. Anti-Hallucination: Pass 'user', not 'userName' or 'account'."),
  username: z.string().optional().describe("Alias for user"),
  userName: z.string().optional().describe("Alias for user"),
  account: z.string().optional().describe("Alias for user"),
  limit: z.number().optional().describe("Maximum number of results"),
});

const UserSummarySchema = z.preprocess(
  (val: unknown) => {
    if (val === undefined || val === null || typeof val !== "object") {
      return val;
    }
    const v = val as { user?: unknown; username?: unknown; userName?: unknown; account?: unknown; limit?: unknown };
    return {
      user: v.user ?? v.username ?? v.userName ?? v.account,
      limit: v.limit,
    };
  },
  z.object({
    user: z.string().optional(),
    limit: z.coerce.number().int().positive().default(5),
  })
);

const HostSummarySchemaBase = z.object({
  host: z.string().optional().describe("Filter by specific host. Anti-Hallucination: Pass 'host', not 'hostName' or 'ip'."),
  hostname: z.string().optional().describe("Alias for host"),
  hostName: z.string().optional().describe("Alias for host"),
  ip: z.string().optional().describe("Alias for host"),
  address: z.string().optional().describe("Alias for host"),
  limit: z.number().optional().describe("Maximum number of results"),
});

const HostSummarySchema = z.preprocess(
  (val: unknown) => {
    if (val === undefined || val === null || typeof val !== "object") {
      return val;
    }
    const v = val as { host?: unknown; hostname?: unknown; hostName?: unknown; ip?: unknown; address?: unknown; limit?: unknown };
    return {
      host: v.host ?? v.hostname ?? v.hostName ?? v.ip ?? v.address,
      limit: v.limit,
    };
  },
  z.object({
    host: z.string().optional(),
    limit: z.coerce.number().int().positive().default(5),
  })
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
    outputSchema: SysUserSummaryOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
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

        const cleanRow = (row: Record<string, unknown>): Record<string, unknown> => {
          const cleaned: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(row)) {
            if (value !== 0 && value !== "0" && value !== "  0 ps" && value !== "   0 bytes" && value !== "" && value !== null) {
              cleaned[key] = value;
            }
          }
          return cleaned;
        };

        const result = await adapter.executeQuery(query, queryParams);
        return withTokenEstimate({
          success: true,
          data: {
            rows: (result.rows ?? []).map(cleanRow),
            count: result.rows?.length ?? 0,
          },
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
    outputSchema: SysHostSummaryOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
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

        const cleanRow = (row: Record<string, unknown>): Record<string, unknown> => {
          const cleaned: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(row)) {
            if (value !== 0 && value !== "0" && value !== "  0 ps" && value !== "   0 bytes" && value !== "" && value !== null) {
              cleaned[key] = value;
            }
          }
          return cleaned;
        };

        const result = await adapter.executeQuery(query, queryParams);
        return withTokenEstimate({
          success: true,
          data: {
            rows: (result.rows ?? []).map(cleanRow),
            count: result.rows?.length ?? 0,
          },
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
