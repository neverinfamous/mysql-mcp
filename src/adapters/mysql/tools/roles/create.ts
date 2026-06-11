import { z, ZodError } from "zod";
import {
  stripErrorPrefix,
  formatZodError,
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "../core/error-helpers.js";
import { RoleCreateOutputSchema } from "../../schemas/roles.js";
import type { MySQLAdapter } from "../../mysql-adapter/index.js";
import type { ToolDefinition, RequestContext } from "../../../../types/index.js";
import { WRITE } from "../../../../utils/annotations.js";

export const RoleCreateSchemaBase = z.object({
  name: z.string().optional().describe("Role name"),
  role: z.string().optional().describe("Alias for name"),
  ifNotExists: z.boolean().default(false),
});

export const RoleCreateSchema = RoleCreateSchemaBase.refine(
  (val) => val.name || val.role,
  {
    message: "Must provide 'name' or 'role'",
  },
).transform((val) => {
  const name = val.name || val.role || "";
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
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
          return formatHandlerErrorResponse(new Error("Invalid role name"));
        }

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
            const response = { success: true as const, data };
            const tokenEstimate = Math.ceil(
              Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
            );
            return withTokenEstimate({ ...response, metrics: { tokenEstimate } });
          }
        }

        const clause = ifNotExists ? "IF NOT EXISTS " : "";
        await adapter.executeQuery(`CREATE ROLE ${clause}'${name}'`);
        const data = { roleName: name };
        const response = { success: true as const, data };
        const tokenEstimate = Math.ceil(
          Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
        );
        return withTokenEstimate({ ...response, metrics: { tokenEstimate } });
      } catch (error: unknown) {
        if (error instanceof ZodError) {
          return formatHandlerErrorResponse(new Error(formatZodError(error)));
        }
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("Operation CREATE ROLE failed")) {
          const parsed =
            params !== null && typeof params === "object"
              ? (params as Record<string, unknown>)
              : {};
          const pName =
            typeof parsed["name"] === "string" ? parsed["name"] : undefined;
          const pRole =
            typeof parsed["role"] === "string" ? parsed["role"] : undefined;
          const roleName = pName ?? pRole ?? "unknown";
          const response = {
            success: false,
            error: `Role '${roleName}' already exists`,
          };
          const tokenEstimate = Math.ceil(
            Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
          );
          return withTokenEstimate({ ...response, metrics: { tokenEstimate } });
        }
        const response = { success: false, error: stripErrorPrefix(message) };
        const tokenEstimate = Math.ceil(
          Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
        );
        return withTokenEstimate({ ...response, metrics: { tokenEstimate } });
      }
    },
  };
}
