import { z } from "zod";
import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "../core/error-helpers.js";
import {
  RoleGrantsOutputSchema,
  RoleGrantPrivilegeOutputSchema,
} from "../../schemas/roles.js";
import type { MySQLAdapter } from "../../mysql-adapter/index.js";
import type { ToolDefinition, RequestContext } from "../../../../types/index.js";
import { MySQLMcpError } from "../../../../types/modules/errors.js";
import { ErrorCategory } from "../../../../types/modules/error-types.js";
import {
  validateIdentifier,
  validateMySQLPrivilege,
} from "../../../../utils/validators.js";
import { READ_ONLY, WRITE } from "../../../../utils/annotations.js";

export const RoleGrantsSchemaBase = z.object({
  role: z.string().optional().describe("Role name (e.g. 'my_role')"),
  name: z.string().optional().describe("Alias for role"),
  roleName: z.string().optional().describe("Alias for role"),
});

export const RoleGrantsSchema = RoleGrantsSchemaBase.refine(
  (val) => val.role || val.name || val.roleName,
  {
    message: "Must provide 'role', 'name', or 'roleName'",
  },
).transform((val) => {
  const role = val.role || val.name || val.roleName || "";
  return { ...val, role };
});

export const RoleGrantPrivilegeSchemaBase = z.object({
  role: z.string().optional().describe("Role name"),
  name: z.string().optional().describe("Alias for role"),
  roleName: z.string().optional().describe("Alias for role"),
  privileges: z.union([z.string(), z.array(z.string())]).optional().describe("Array of privileges to grant"),
  privilege: z.string().optional().describe("Single privilege to grant"),
  database: z.string().default("*").describe("Database name or '*'"),
  schema: z.string().optional().describe("Alias for database"),
  db: z.string().optional().describe("Alias for database"),
  table: z.string().default("*").describe("Table name or '*'"),
  tableName: z.string().optional().describe("Alias for table"),
  on: z.string().optional().describe("Target object (e.g. 'db.table')"),
  object: z.string().optional().describe("Alias for on"),
});

export const RoleGrantPrivilegeSchema = RoleGrantPrivilegeSchemaBase.refine(
  (val) => val.role || val.name || val.roleName,
  {
    message: "Must provide 'role', 'name', or 'roleName'",
  },
)
  .transform((val) => {
    const role = val.role || val.name || val.roleName || "";
    const privsRaw = val.privileges ?? (val.privilege ? [val.privilege] : []);
    const privileges = Array.isArray(privsRaw) ? privsRaw : [privsRaw];
    let database = val.db ?? val.schema ?? val.database;
    let table = val.tableName ?? val.table;
    const targetOn = val.on ?? val.object;

    if (targetOn) {
      if (targetOn.includes(".")) {
        const [db, tbl] = targetOn.split(".");
        database = db || "*";
        table = tbl || "*";
      } else {
        database = targetOn;
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
            return formatHandlerErrorResponse(
              new MySQLMcpError(`Role '${role}' does not exist`, "OBJECT_NOT_FOUND", ErrorCategory.RESOURCE)
            );
          }

          const result = await adapter.rawQuery(`SHOW GRANTS FOR '${role}'`);
          const grants = (result.rows ?? []).map((r) => Object.values(r)[0]);
          const data = { role, grants, exists: true };
          const response = { success: true, data };
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

          validateIdentifier(role, "role");

          for (const priv of privileges) {
            validateMySQLPrivilege(priv);
          }

          const checkResult = await adapter.executeQuery(
            `SELECT 1 FROM mysql.user WHERE User = ? AND account_locked = 'Y' AND password_expired = 'Y' AND authentication_string = ''`,
            [role],
          );
          if (!checkResult.rows || checkResult.rows.length === 0) {
            return formatHandlerErrorResponse(
              new MySQLMcpError(`Role '${role}' does not exist`, "OBJECT_NOT_FOUND", ErrorCategory.RESOURCE)
            );
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
          const response = { success: true, data };
          const tokenEstimate = Math.ceil(
            Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
          );
          return withTokenEstimate({ ...response, metrics: { tokenEstimate } });
        } catch (error: unknown) {
          return formatHandlerErrorResponse(error);
        }
      },
    },
  ];
}
