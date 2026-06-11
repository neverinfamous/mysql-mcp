import { z, ZodError } from "zod";
import {
  stripErrorPrefix,
  formatZodError,
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "../core/error-helpers.js";
import { RoleDropOutputSchema } from "../../schemas/roles.js";
import type { MySQLAdapter } from "../../mysql-adapter/index.js";
import type { ToolDefinition, RequestContext } from "../../../../types/index.js";
import { DESTRUCTIVE } from "../../../../utils/annotations.js";

export const RoleDropSchemaBase = z.object({
  name: z.string().optional().describe("Role name"),
  role: z.string().optional().describe("Alias for name"),
  ifExists: z.boolean().default(false),
});

export const RoleDropSchema = RoleDropSchemaBase.refine(
  (val) => val.name || val.role,
  {
    message: "Must provide 'name' or 'role'",
  },
).transform((val) => {
  const name = val.name || val.role || "";
  return { ...val, name };
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
        const { name, ifExists } = RoleDropSchema.parse(params);
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
          return formatHandlerErrorResponse(new Error("Invalid role name"));
        }

        let roleAbsent = false;
        if (ifExists) {
          const checkResult = await adapter.executeQuery(
            `SELECT 1 FROM mysql.user WHERE User = ? AND account_locked = 'Y' AND password_expired = 'Y' AND authentication_string = ''`,
            [name],
          );
          if (!checkResult.rows || checkResult.rows.length === 0) {
            roleAbsent = true;
          }
        }

        await adapter.executeQuery(
          `DROP ROLE ${ifExists ? "IF EXISTS " : ""}'${name}'`,
        );

        if (roleAbsent) {
          const data = {
            skipped: true,
            roleName: name,
            reason: "Role did not exist",
          };
          const response = { success: true as const, data };
          const tokenEstimate = Math.ceil(
            Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
          );
          return withTokenEstimate({ ...response, metrics: { tokenEstimate } });
        }

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
        if (message.includes("Operation DROP ROLE failed")) {
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
            error: `Role '${roleName}' does not exist`,
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
