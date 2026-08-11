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
  validateMySQLUserHost,
  validateMySQLPrivilege,
} from "../../../../utils/validators.js";
import { READ_ONLY, WRITE } from "../../../../utils/annotations.js";

export const RoleGrantsSchemaBase = z.object({
  role: z.coerce.string().optional().describe("Role name (e.g. 'my_role')"),
  name: z.coerce.string().optional().describe("Alias for role"),
  roleName: z.coerce.string().optional().describe("Alias for role"),
});

export const RoleGrantsSchema = RoleGrantsSchemaBase.refine(
  (val) => val.role || val.name || val.roleName,
  {
    message: "Must provide 'role', 'name', or 'roleName'",
  },
)  .transform((val) => {
    let role = val.role || val.name || val.roleName || "";
    let roleHost = "%";
    if (role?.includes("@")) {
      const parts = role.split("@");
      role = parts[0] || "";
      if (parts.length > 1) {
        roleHost = parts.slice(1).join("@");
      }
    }
    return { ...val, role, roleHost };
  });

export const RoleGrantPrivilegeSchemaBase = z.object({
  role: z.coerce.string().optional().describe("Role name"),
  name: z.coerce.string().optional().describe("Alias for role"),
  roleName: z.coerce.string().optional().describe("Alias for role"),
  privileges: z.union([z.array(z.coerce.string()), z.coerce.string()]).optional().describe("Array of privileges to grant"),
  privilege: z.coerce.string().optional().describe("Single privilege to grant"),
  database: z.coerce.string().default("*").describe("Database name or '*'"),
  schema: z.coerce.string().optional().describe("Alias for database"),
  db: z.coerce.string().optional().describe("Alias for database"),
  table: z.coerce.string().default("*").describe("Table name or '*'"),
  tableName: z.coerce.string().optional().describe("Alias for table"),
  on: z.coerce.string().optional().describe("Target object (e.g. 'db.table')"),
  object: z.coerce.string().optional().describe("Alias for on"),
});

export const RoleGrantPrivilegeSchema = RoleGrantPrivilegeSchemaBase.refine(
  (val) => val.role || val.name || val.roleName,
  {
    message: "Must provide 'role', 'name', or 'roleName'",
  },
)
  .refine(
    (val) => {
      const targetOn = val.on ?? val.object;
      if (targetOn && targetOn.split(".").length > 2) return false;
      return true;
    },
    {
      message: "Column-level privileges are not supported via the 'on' parameter. Use 'database' and 'table' for table-level grants, and provide at most 'db.table'.",
    }
  )
  .transform((val) => {
    let role = val.role || val.name || val.roleName || "";
    let roleHost = "%";
    if (role?.includes("@")) {
      const parts = role.split("@");
      role = parts[0] || "";
      if (parts.length > 1) {
        roleHost = parts.slice(1).join("@");
      }
    }
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

    return { ...val, role, roleHost, privileges, database, table };
  })
  .refine((val) => val.privileges.length > 0, {
    message: "Must provide 'privileges' array or single 'privilege' string",
  })
  .refine((val) => !(val.database === "*" && val.table !== "*"), {
    message: "Cannot specify a table without a specific database. MySQL does not support granting on a specific table across all databases (*.table). Use database: '*' and table: '*' for global privileges, or provide a specific database.",
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
          const { role, roleHost } = RoleGrantsSchema.parse(params);

          validateMySQLUserHost(role, "role");
          validateMySQLUserHost(roleHost, "host");

          const checkResult = await adapter.executeQuery(
            `SELECT 1 FROM mysql.user WHERE User = ? AND Host = ? AND account_locked = 'Y' AND password_expired = 'Y' AND authentication_string = ''`,
            [role, roleHost],
          );
          if (!checkResult.rows || checkResult.rows.length === 0) {
            const roleStr = roleHost === "%" ? role : `${role}@${roleHost}`;
            return formatHandlerErrorResponse(
              new MySQLMcpError(`Role '${roleStr}' does not exist`, "OBJECT_NOT_FOUND", ErrorCategory.RESOURCE)
            );
          }

          const result = await adapter.rawQuery(`SHOW GRANTS FOR '${role}'@'${roleHost}'`);
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
          const { role, roleHost, privileges, database, table } =
            RoleGrantPrivilegeSchema.parse(params);

          validateMySQLUserHost(role, "role");
          validateMySQLUserHost(roleHost, "host");

          for (const priv of privileges) {
            validateMySQLPrivilege(priv);
          }

          const checkResult = await adapter.executeQuery(
            `SELECT 1 FROM mysql.user WHERE User = ? AND Host = ? AND account_locked = 'Y' AND password_expired = 'Y' AND authentication_string = ''`,
            [role, roleHost],
          );
          if (!checkResult.rows || checkResult.rows.length === 0) {
            const roleStr = roleHost === "%" ? role : `${role}@${roleHost}`;
            return formatHandlerErrorResponse(
              new MySQLMcpError(`Role '${roleStr}' does not exist`, "OBJECT_NOT_FOUND", ErrorCategory.RESOURCE)
            );
          }

          const targetDb = database;
          const targetTable = table;

          if (targetDb !== "*") validateIdentifier(targetDb, "database");
          if (targetTable !== "*") validateIdentifier(targetTable, "table");

          const db = targetDb === "*" ? "*" : `\`${targetDb}\``;
          const tbl = targetTable === "*" ? "*" : `\`${targetTable}\``;

          let onClause = `${db}.${tbl}`;
          if (targetDb === "*" && targetTable !== "*") {
            onClause = tbl;
          }

          await adapter.rawQuery(
            `GRANT ${privileges.join(", ")} ON ${onClause} TO '${role}'@'${roleHost}'`,
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
