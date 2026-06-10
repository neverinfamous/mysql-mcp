/**
 * MySQL Admin Tools - Audit Search
 *
 * Exposes the Audit Subsystem's search capabilities to the agent.
 */

import { z } from "zod";
import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "../core/error-helpers.js";
import type { MySQLAdapter } from "../../mysql-adapter.js";
import type { ToolDefinition, RequestContext } from "../../../../types/index.js";
import { READ_ONLY } from "../../../../utils/annotations.js";
import { hasScope, SCOPES } from "../../../../auth/scopes.js";
import { getAuthContext } from "../../../../auth/auth-context.js";
import { InsufficientScopeError } from "../../../../auth/errors.js";
import { AuditSearchOutputSchema } from "../../schemas/index.js";

export function createAuditSearchTool(adapter: MySQLAdapter): ToolDefinition {
  const schema = z.object({
    tool: z.string().optional().describe("Filter by exact tool name"),
    category: z.string().optional().describe("Filter by category (e.g. read, write, admin)"),
    success: z.boolean().optional().describe("Filter by success status"),
    requestId: z.string().optional().describe("Filter by exact request ID"),
    fromTimestamp: z.string().optional().describe("Filter by start timestamp (ISO 8601)"),
    toTimestamp: z.string().optional().describe("Filter by end timestamp (ISO 8601)"),
    limit: z.number().int().min(1).max(100).default(50).describe("Max results to return"),
    offset: z.number().int().min(0).default(0).describe("Pagination offset"),
  });

  return {
    name: "mysql_audit_search",
    title: "MySQL Audit Search",
    description:
      "Search and filter structured audit logs from the System Database. Returns recent tool invocations, outcomes, token estimates, and parameters.",
    group: "admin",
    inputSchema: schema,
    outputSchema: AuditSearchOutputSchema,
    requiredScopes: ["admin"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const authCtx = getAuthContext();
        if (authCtx && !hasScope(authCtx.scopes, SCOPES.ADMIN)) {
          throw new InsufficientScopeError([SCOPES.ADMIN]);
        }

        const parsed = schema.parse(params);

        const auditLogger = adapter.getAuditLogger();
        if (!auditLogger) {
          return withTokenEstimate({
            success: false,
            error: "Audit Logger is not enabled or available",
          });
        }

        const { entries, totalCount } = await auditLogger.search(parsed);

        return withTokenEstimate({
          success: true,
          data: {
            entries,
            count: entries.length,
            totalCount,
          }
        });
      } catch (err) {
        return withTokenEstimate(
          formatHandlerErrorResponse(err) as unknown as Record<string, unknown>,
        );
      }
    },
  };
}
