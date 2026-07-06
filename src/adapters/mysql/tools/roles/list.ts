import { z } from "zod";
import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "../core/error-helpers.js";
import { RoleListOutputSchema } from "../../schemas/roles.js";
import type { MySQLAdapter } from "../../mysql-adapter/index.js";
import type { ToolDefinition, RequestContext } from "../../../../types/index.js";
import { READ_ONLY } from "../../../../utils/annotations.js";

export const RoleListSchemaBase = z.object({
  pattern: z.string().optional().describe("Filter pattern (LIKE syntax)"),
  limit: z.number().int().min(1).max(100).default(50).describe("Max results"),
});

export const RoleListSchema = z.preprocess((val: unknown) => {
  if (typeof val !== "object" || val === null) return val;
  const res = { ...(val as Record<string, unknown>) };
  if ("limit" in res && typeof res["limit"] !== "number") {
    const parsed = Number(res["limit"]);
    res["limit"] = isNaN(parsed) ? res["limit"] : parsed;
  }
  return res;
}, RoleListSchemaBase);

export function getRoleListTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_role_list",
    title: "MySQL List Roles",
    description: "List all roles defined in MySQL.",
    group: "roles",
    inputSchema: RoleListSchemaBase,
    outputSchema: RoleListOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { pattern, limit } = RoleListSchema.parse(params);
        let query = `SELECT u.User as roleName, u.Host FROM mysql.user u
                    WHERE u.account_locked='Y' AND u.password_expired='Y' AND u.authentication_string=''`;
        const args: unknown[] = [];
        if (pattern) {
          query += ` AND u.User LIKE ?`;
          args.push(pattern);
        }
        if (limit) {
          query += ` LIMIT ${limit}`;
        }
        const result = await adapter.executeQuery(query, args);
        const data = {
          roles: result.rows ?? [],
          count: result.rows?.length ?? 0,
        };
        const response = { success: true, data };
        const tokenEstimate = Math.ceil(
          Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
        );
        return withTokenEstimate({ ...response, metrics: { tokenEstimate } });
      } catch (error: unknown) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}
