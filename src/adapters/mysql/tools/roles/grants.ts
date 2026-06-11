import { z, ZodError } from "zod";
import {
  stripErrorPrefix,
  formatZodError,
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "../core/error-helpers.js";
import {
  RoleGrantsOutputSchema,
  RoleGrantPrivilegeOutputSchema,
} from "../../schemas/roles.js";
import type { MySQLAdapter } from "../../mysql-adapter/index.js";
import type { ToolDefinition, RequestContext } from "../../../../types/index.js";
import {
  validateIdentifier,
  validateMySQLPrivilege,
} from "../../../../utils/validators.js";
import { READ_ONLY, WRITE } from "../../../../utils/annotations.js";

export const RoleGrantsSchemaBase = z.object({
  role: z.string().optional(),
  name: z.string().optional(),
});

export const RoleGrantsSchema = RoleGrantsSchemaBase.refine(
  (val) => val.role || val.name,
  {
    message: "Must provide 'role' or 'name'",
  },
).transform((val) => {
  const role = val.role || val.name || "";
  return { ...val, role };
});

export const RoleGrantPrivilegeSchemaBase = z.object({
  role: z.string().optional(),
  privileges: z.array(z.string()).optional(),
  privilege: z.string().optional(),
  database: z.string().default("*"),
  table: z.string().default("*"),
  on: z.string().optional(),
});

export const RoleGrantPrivilegeSchema = RoleGrantPrivilegeSchemaBase.refine(
  (val) => val.role,
  {
    message: "Must provide 'role'",
  },
)
  .transform((val) => {
    const role = val.role || "";
    const privileges = val.privileges ?? (val.privilege ? [val.privilege] : []);
    let database = val.database;
    let table = val.table;

    if (val.on) {
      if (val.on.includes(".")) {
        const [db, tbl] = val.on.split(".");
        database = db || "*";
        table = tbl || "*";
      } else {
        database = val.on;
      }
    }

    return { ...val, role, privileges, database, table };
  })
  .refine((val) => val.privileges.length > 0, {
    message: "Must provide 'privileges' array or single 'privilege' string",
  });

export function getRoleGrantsTools(adapter: MySQLAdapter): ToolDefinition[] {
  return [
    {
      name: "mysql_role_grants",
      title: "MySQL Role Grants",
      description: "List privileges granted to a role.",
      group: "roles",
      inputSchema: RoleGrantsSchemaBase,
      outputSchema: RoleGrantsOutputSchema,
      requiredScopes: ["read"],
      annotations: READ_ONLY,
      handler: async (params: unknown, _context: RequestContext) => {
        try {
          const { role } = RoleGrantsSchema.parse(params);

          validateIdentifier(role, "role");

          const checkResult = await adapter.executeQuery(
            `SELECT 1 FROM mysql.user WHERE User = ? AND account_locked = 'Y' AND password_expired = 'Y' AND authentication_string = ''`,
            [role],
          );
          if (!checkResult.rows || checkResult.rows.length === 0) {
            return formatHandlerErrorResponse(new Error("Role does not exist"));
          }

          const result = await adapter.rawQuery(`SHOW GRANTS FOR '${role}'`);
          const grants = (result.rows ?? []).map((r) => Object.values(r)[0]);
          const data = { role, grants, exists: true };
          const response = { success: true as const, data };
          const tokenEstimate = Math.ceil(
            Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
          );
          return withTokenEstimate({ ...response, metrics: { tokenEstimate } });
        } catch (error: unknown) {
          return formatHandlerErrorResponse(error);
        }
      },
    },
    {
      name: "mysql_role_grant",
      title: "MySQL Grant to Role",
      description: "Grant privileges to a role.",
      group: "roles",
      inputSchema: RoleGrantPrivilegeSchemaBase,
      outputSchema: RoleGrantPrivilegeOutputSchema,
      requiredScopes: ["admin"],
      annotations: WRITE,
      handler: async (params: unknown, _context: RequestContext) => {
        try {
          const { role, privileges, database, table } =
            RoleGrantPrivilegeSchema.parse(params);
          if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(role)) {
            return formatHandlerErrorResponse(new Error("Invalid role name"));
          }

          for (const priv of privileges) {
            validateMySQLPrivilege(priv);
          }

          const checkResult = await adapter.executeQuery(
            `SELECT 1 FROM mysql.user WHERE User = ? AND account_locked = 'Y' AND password_expired = 'Y' AND authentication_string = ''`,
            [role],
          );
          if (!checkResult.rows || checkResult.rows.length === 0) {
            return formatHandlerErrorResponse(new Error("Role does not exist"));
          }

          let targetDb = database;
          let targetTable = table;

          if (targetTable.includes(".") && targetTable !== "*") {
            const [dbPart, tablePart] = targetTable.split(".");
            if (dbPart && tablePart) {
              targetDb = dbPart;
              targetTable = tablePart;
            }
          }

          if (targetDb !== "*") validateIdentifier(targetDb, "database");
          if (targetTable !== "*") validateIdentifier(targetTable, "table");

          const db = targetDb === "*" ? "*" : `\`${targetDb}\``;
          const tbl = targetTable === "*" ? "*" : `\`${targetTable}\``;

          let onClause = `${db}.${tbl}`;
          if (targetDb === "*" && targetTable !== "*") {
            onClause = tbl;
          }

          await adapter.rawQuery(
            `GRANT ${privileges.join(", ")} ON ${onClause} TO '${role}'`,
          );
          const data = {
            role,
            privileges,
            database: targetDb,
            table: targetTable,
          };
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
          const cleanMsg = stripErrorPrefix(message);
          const parsed =
            params !== null && typeof params === "object"
              ? (params as Record<string, unknown>)
              : {};
          const pRole =
            typeof parsed["role"] === "string" ? parsed["role"] : undefined;
          if (pRole !== undefined) {
            const response = { success: false, role: pRole, error: cleanMsg };
            const tokenEstimate = Math.ceil(
              Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
            );
            return withTokenEstimate({ ...response, metrics: { tokenEstimate } });
          }
          const response = { success: false, error: cleanMsg };
          const tokenEstimate = Math.ceil(
            Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
          );
          return withTokenEstimate({ ...response, metrics: { tokenEstimate } });
        }
      },
    },
  ];
}
