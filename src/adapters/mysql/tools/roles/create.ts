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
import { validateMySQLUserHost } from "../../../../utils/validators.js";
import { WRITE } from "../../../../utils/annotations.js";

export const RoleCreateSchemaBase = z.object({
  name: z.coerce.string().optional().describe("Role name"),
  role: z.coerce.string().optional().describe("Alias for name"),
  roleName: z.coerce.string().optional().describe("Alias for name"),
  ifNotExists: z.preprocess((val) => {
    if (typeof val === 'boolean') return val;
    if (val === 'true') return true;
    if (val === 'false') return false;
    return val;
  }, z.boolean().default(false)),
});

export const RoleCreateSchema = RoleCreateSchemaBase.refine(
  (val) => val.name || val.role || val.roleName,
  {
    message: "Must provide 'name', 'role', or 'roleName'",
  },
).transform((val) => {
  const rawName = val.name || val.role || val.roleName || "";
  let name = rawName;
  let roleHost = "%";
  if (name.includes("@")) {
    const parts = name.split("@");
    name = parts[0] || "";
    if (parts.length > 1) {
      roleHost = parts.slice(1).join("@");
    }
  }
  return { ...val, rawName, name, roleHost };
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
        const { rawName, name, roleHost, ifNotExists } = RoleCreateSchema.parse(params);
        validateMySQLUserHost(name, "role");
        validateMySQLUserHost(roleHost, "host");

        if (ifNotExists) {
          const checkResult = await adapter.executeQuery(
            `SELECT account_locked, password_expired, authentication_string FROM mysql.user WHERE User = ? AND Host = ? FOR UPDATE`,
            [name, roleHost],
          );
          
          if (checkResult.rows && checkResult.rows.length > 0) {
            // Need to handle Record<string, unknown> safely
            const row = checkResult.rows[0];
            if (!row) {
              throw new Error("Unexpected empty row data");
            }
            const isRole = row['account_locked'] === 'Y' && 
                           row['password_expired'] === 'Y' && 
                           (row['authentication_string'] === '' || row['authentication_string'] === null);

            if (isRole) {
              const data = {
                skipped: true,
                roleName: rawName,
                reason: "Role already exists",
              };
              const response = { success: true, data };
              const tokenEstimate = Math.ceil(
                Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
              );
              return withTokenEstimate({ ...response, metrics: { tokenEstimate } });
            } else {
              return formatHandlerErrorResponse(
                new MySQLMcpError(`Cannot create role '${rawName}': A normal user with this name already exists`, "OBJECT_ALREADY_EXISTS", ErrorCategory.RESOURCE)
              );
            }
          }
        }

        const clause = ifNotExists ? "IF NOT EXISTS " : "";
        await adapter.executeQuery(`CREATE ROLE ${clause}'${name}'@'${roleHost}'`);
        const data = { roleName: rawName };
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
