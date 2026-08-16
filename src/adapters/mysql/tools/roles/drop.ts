import { z, ZodError } from "zod";
import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "../core/error-helpers.js";
import { RoleDropOutputSchema } from "../../schemas/roles.js";
import type { MySQLAdapter } from "../../mysql-adapter/index.js";
import type { ToolDefinition, RequestContext } from "../../../../types/index.js";
import { MySQLMcpError } from "../../../../types/modules/errors.js";
import { ErrorCategory } from "../../../../types/modules/error-types.js";
import { validateMySQLUserHost } from "../../../../utils/validators.js";
import { DESTRUCTIVE } from "../../../../utils/annotations.js";

export const RoleDropSchemaBase = z.object({
  name: z.coerce.string().optional().describe("Role name"),
  role: z.coerce.string().optional().describe("Alias for name"),
  roleName: z.coerce.string().optional().describe("Alias for name"),
  ifExists: z.preprocess((val) => {
    if (typeof val === 'boolean') return val;
    if (val === 'true') return true;
    if (val === 'false') return false;
    return val;
  }, z.boolean().default(false)),
});

export const RoleDropSchema = RoleDropSchemaBase.refine(
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

export function getRoleDropTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_role_drop",
    title: "MySQL Drop Role",
    description: "Drop a role.",
    group: "roles",
    inputSchema: RoleDropSchemaBase,
    outputSchema: RoleDropOutputSchema,
    requiredScopes: ["admin"],
    annotations: DESTRUCTIVE,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { rawName, name, roleHost, ifExists } = RoleDropSchema.parse(params);
        validateMySQLUserHost(name, "role");
        validateMySQLUserHost(roleHost, "host");

        let roleAbsent = false;
        const checkResult = await adapter.executeQuery(
          `WITH _dummy AS (SELECT 1) SELECT 1 FROM mysql.user WHERE User = ? AND Host = ? AND account_locked = 'Y' AND password_expired = 'Y' AND authentication_string = ''`,
          [name, roleHost],
        );
        if (!checkResult.rows || checkResult.rows.length === 0) {
          roleAbsent = true;
        }

        if (roleAbsent && !ifExists) {
          return formatHandlerErrorResponse(
            new MySQLMcpError(`Role '${rawName}' does not exist`, "OBJECT_NOT_FOUND", ErrorCategory.RESOURCE)
          );
        }

        if (!roleAbsent) {
          await adapter.executeQuery(
            `DROP ROLE ${ifExists ? "IF EXISTS " : ""}'${name}'@'${roleHost}'`,
          );
        }

        if (roleAbsent) {
          const data = {
            skipped: true,
            roleName: rawName,
            reason: "Role did not exist",
          };
          const response = { success: true, data };
          const tokenEstimate = Math.ceil(
            Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
          );
          return withTokenEstimate({ ...response, metrics: { tokenEstimate } });
        }

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
        if (message.includes("Operation DROP ROLE failed")) {
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
            new MySQLMcpError(`Role '${roleName}' does not exist`, "OBJECT_NOT_FOUND", ErrorCategory.RESOURCE)
          );
        }
        return formatHandlerErrorResponse(error);
      }
    },
  };
}
