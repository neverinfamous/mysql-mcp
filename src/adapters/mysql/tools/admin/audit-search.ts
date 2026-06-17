/**
 * MySQL Admin Tools - Audit Search
 *
 * Exposes the Audit Subsystem's search capabilities to the agent.
 */


import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "../core/error-helpers.js";
import type { MySQLAdapter } from "../../mysql-adapter/index.js";
import type { ToolDefinition, RequestContext } from "../../../../types/index.js";
import { READ_ONLY } from "../../../../utils/annotations.js";
import { hasScope, SCOPES } from "../../../../auth/scopes.js";
import { getAuthContext } from "../../../../auth/auth-context.js";
import { InsufficientScopeError } from "../../../../auth/errors.js";
import { AuditSearchOutputSchema, AuditSearchSchema, AuditSearchSchemaBase } from "../../schemas/index.js";

export function createAuditSearchTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_audit_search",
    title: "MySQL Audit Search",
    description:
      "Search and filter structured audit logs from the System Database. Returns recent tool invocations, outcomes, token estimates, and parameters.",
    group: "admin",
    inputSchema: AuditSearchSchemaBase,
    outputSchema: AuditSearchOutputSchema,
    requiredScopes: ["admin"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const authCtx = getAuthContext();
        if (authCtx && !hasScope(authCtx.scopes, SCOPES.ADMIN)) {
          throw new InsufficientScopeError([SCOPES.ADMIN]);
        }

        const parsed = AuditSearchSchema.parse(params);

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
          { ...formatHandlerErrorResponse(err) },
        );
      }
    },
  };
}
