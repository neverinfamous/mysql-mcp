import { z } from "zod";
import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "../core/error-helpers.js";
import { RoleListOutputSchema } from "../../schemas/roles.js";
import type { MySQLAdapter } from "../../mysql-adapter/index.js";
import type { ToolDefinition, RequestContext } from "../../../../types/index.js";
import { escapeLikePattern } from "../../../../utils/validators.js";
import { READ_ONLY } from "../../../../utils/annotations.js";

export const RoleListSchema = z.object({
  pattern: z.string().optional().describe("Filter pattern (LIKE syntax)"),
});

export function getRoleListTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_role_list",
    title: "MySQL List Roles",
    description: "List all roles defined in MySQL.",
    group: "roles",
    inputSchema: RoleListSchema,
    outputSchema: RoleListOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { pattern } = RoleListSchema.parse(params);
        let query = `SELECT u.User as roleName, u.Host FROM mysql.user u
                    WHERE u.account_locked='Y' AND u.password_expired='Y' AND u.authentication_string=''`;
        if (pattern)
          query += ` AND u.User LIKE '${escapeLikePattern(pattern)}'`;
        const result = await adapter.executeQuery(query);
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
