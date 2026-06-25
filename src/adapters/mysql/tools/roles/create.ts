import { z, ZodError } from "zod";
import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "../core/error-helpers.js";
import { RoleCreateOutputSchema } from "../../schemas/roles.js";
import type { MySQLAdapter } from "../../mysql-adapter/index.js";
import type { ToolDefinition, RequestContext } from "../../../../types/index.js";
import { MySQLMcpError } from "../../../../types/modules/errors.js";
import { ErrorCategory } from "../../../../types/modules/error-types.js";
import { validateIdentifier } from "../../../../utils/validators.js";
import { WRITE } from "../../../../utils/annotations.js";

export const RoleCreateSchemaBase = z.object({
  name: z.string().optional().describe("Role name"),
  role: z.string().optional().describe("Alias for name"),
  roleName: z.string().optional().describe("Alias for name"),
  ifNotExists: z.boolean().default(false),
});

export const RoleCreateSchema = RoleCreateSchemaBase.refine(
  (val) => val.name || val.role || val.roleName,
  {
    message: "Must provide 'name', 'role', or 'roleName'",
  },
).transform((val) => {
  const name = val.name || val.role || val.roleName || "";
  return { ...val, name };
});

export function getRoleCreateTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_role_create",
    title: "MySQL Create Role",
    description: "Create a new role.",
    group: "roles",
    inputSchema: RoleCreateSchemaBase,
    outputSchema: RoleCreateOutputSchema,
    requiredScopes: ["admin"],
    annotations: WRITE,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { name, ifNotExists } = RoleCreateSchema.parse(params);
        validateIdentifier(name, "role");

        if (ifNotExists) {
          const checkResult = await adapter.executeQuery(
            `SELECT 1 FROM mysql.user WHERE User = ? AND account_locked = 'Y' AND password_expired = 'Y' AND authentication_string = ''`,
            [name],
          );
          if (checkResult.rows && checkResult.rows.length > 0) {
            const data = {
              skipped: true,
              roleName: name,
              reason: "Role already exists",
            };
            const response = { success: true, data };
            const tokenEstimate = Math.ceil(
              Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
            );
            return withTokenEstimate({ ...response, metrics: { tokenEstimate } });
          }
        }

        const clause = ifNotExists ? "IF NOT EXISTS " : "";
        await adapter.executeQuery(`CREATE ROLE ${clause}'${name}'`);
        const data = { roleName: name };
        const response = { success: true, data };
        const tokenEstimate = Math.ceil(
          Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
        );
        return withTokenEstimate({ ...response, metrics: { tokenEstimate } });
      } catch (error: unknown) {
        if (error instanceof ZodError) {
          return formatHandlerErrorResponse(error);
        }
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("Operation CREATE ROLE failed")) {
          const pName =
            params !== null &&
            typeof params === "object" &&
            "name" in params &&
            typeof params.name === "string"
              ? params.name
              : undefined;
          const pRole =
            params !== null &&
            typeof params === "object" &&
            "role" in params &&
            typeof params.role === "string"
              ? params.role
              : undefined;
          const pRoleName =
            params !== null &&
            typeof params === "object" &&
            "roleName" in params &&
            typeof params.roleName === "string"
              ? params.roleName
              : undefined;
          const roleName = pName ?? pRole ?? pRoleName ?? "unknown";
          return formatHandlerErrorResponse(
            new MySQLMcpError(`Role '${roleName}' already exists`, "OBJECT_ALREADY_EXISTS", ErrorCategory.RESOURCE)
          );
        }
        return formatHandlerErrorResponse(error);
      }
    },
  };
}
