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
  user_name: z.string().optional().describe("Alias for user"),
  account: z.string().optional().describe("Alias for user"),
  limit: z.union([z.number(), z.string()]).optional().describe("Maximum number of results"),
  max: z.union([z.number(), z.string()]).optional().describe("Alias for limit"),
  count: z.union([z.number(), z.string()]).optional().describe("Alias for limit"),
}).loose();

const UserSummarySchema = z.preprocess(
  (val: unknown) => {
    if (val === undefined || val === null || typeof val !== "object") {
      return val;
    }
    const v = val as Record<string, unknown> & { user?: unknown; username?: unknown; userName?: unknown; user_name?: unknown; account?: unknown; limit?: unknown; max?: unknown; count?: unknown };
    const resolvedUser = v.user ?? v.username ?? v.userName ?? v.user_name ?? v.account;
    return {
      ...v,
      user: resolvedUser === "" ? undefined : resolvedUser,
      limit: v.limit ?? v.max ?? v.count,
    };
  },
  z.object({
    user: z.string().optional(),
    limit: z.coerce.number().int().positive().default(5),
    username: z.any().optional(),
    userName: z.any().optional(),
    user_name: z.any().optional(),
    account: z.any().optional(),
    max: z.any().optional(),
    count: z.any().optional(),
  }).strict()
);

const HostSummarySchemaBase = z.object({
  host: z.string().optional().describe("Filter by specific host. Anti-Hallucination: Pass 'host', not 'hostName' or 'ip'."),
  hostname: z.string().optional().describe("Alias for host"),
  hostName: z.string().optional().describe("Alias for host"),
  host_name: z.string().optional().describe("Alias for host"),
  ip: z.string().optional().describe("Alias for host"),
  address: z.string().optional().describe("Alias for host"),
  limit: z.union([z.number(), z.string()]).optional().describe("Maximum number of results"),
  max: z.union([z.number(), z.string()]).optional().describe("Alias for limit"),
  count: z.union([z.number(), z.string()]).optional().describe("Alias for limit"),
}).loose();

const HostSummarySchema = z.preprocess(
  (val: unknown) => {
    if (val === undefined || val === null || typeof val !== "object") {
      return val;
    }
    const v = val as Record<string, unknown> & { host?: unknown; hostname?: unknown; hostName?: unknown; host_name?: unknown; ip?: unknown; address?: unknown; limit?: unknown; max?: unknown; count?: unknown };
    const resolvedHost = v.host ?? v.hostname ?? v.hostName ?? v.host_name ?? v.ip ?? v.address;
    return {
      ...v,
      host: resolvedHost === "" ? undefined : resolvedHost,
      limit: v.limit ?? v.max ?? v.count,
    };
  },
  z.object({
    host: z.string().optional(),
    limit: z.coerce.number().int().positive().default(5),
    hostname: z.any().optional(),
    hostName: z.any().optional(),
    host_name: z.any().optional(),
    ip: z.any().optional(),
    address: z.any().optional(),
    max: z.any().optional(),
    count: z.any().optional(),
  }).strict()
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

        const actualLimit = Math.min(limit, 100);

        let query = `
                WITH sys_query AS (
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
                ) SELECT * FROM sys_query
            `;

        const queryParams: unknown[] = [];
        if (user !== undefined) {
          query += " WHERE user = ?";
          queryParams.push(user);
        }

        query += ` LIMIT ${String(actualLimit)}`;

        const cleanRow = (row: Record<string, unknown>): Record<string, unknown> => {
          const cleaned: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(row)) {
            if (value !== 0 && value !== "0" && value !== "0 ps" && value !== "  0 ps" && value !== "0 bytes" && value !== "   0 bytes" && value !== "" && value !== null) {
              cleaned[key] = value;
            }
          }
          return cleaned;
        };

        const result = await adapter.executeQuery(query, queryParams);

        if (user !== undefined && (!result.rows || result.rows.length === 0)) {
          return withTokenEstimate({
            success: false,
            error: `User '${user}' not found`,
            code: "NOT_FOUND_ERROR",
            category: "resource",
            recoverable: false,
          });
        }

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

        const actualLimit = Math.min(limit, 100);

        let query = `
                WITH sys_query AS (
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
                ) SELECT * FROM sys_query
            `;

        const queryParams: unknown[] = [];
        if (host !== undefined) {
          query += " WHERE host = ?";
          queryParams.push(host);
        }

        query += ` LIMIT ${String(actualLimit)}`;

        const cleanRow = (row: Record<string, unknown>): Record<string, unknown> => {
          const cleaned: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(row)) {
            if (value !== 0 && value !== "0" && value !== "0 ps" && value !== "  0 ps" && value !== "0 bytes" && value !== "   0 bytes" && value !== "" && value !== null) {
              cleaned[key] = value;
            }
          }
          return cleaned;
        };

        const result = await adapter.executeQuery(query, queryParams);

        if (host !== undefined && (!result.rows || result.rows.length === 0)) {
          return withTokenEstimate({
            success: false,
            error: `Host '${host}' not found`,
            code: "NOT_FOUND_ERROR",
            category: "resource",
            recoverable: false,
          });
        }

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
