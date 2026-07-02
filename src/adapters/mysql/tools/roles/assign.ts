import { z, ZodError } from "zod";
import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "../core/error-helpers.js";
import {
  RoleAssignOutputSchema,
  RoleRevokeOutputSchema,
  UserRolesOutputSchema,
} from "../../schemas/roles.js";
import type { MySQLAdapter } from "../../mysql-adapter/index.js";
import type { ToolDefinition, RequestContext } from "../../../../types/index.js";
import { MySQLMcpError } from "../../../../types/modules/errors.js";
import { ErrorCategory } from "../../../../types/modules/error-types.js";
import {
  validateIdentifier,
  validateMySQLPrivilege,
  validateMySQLUserHost,
} from "../../../../utils/validators.js";
import { READ_ONLY, WRITE } from "../../../../utils/annotations.js";

export const RoleAssignSchemaBase = z.object({
  role: z.string().optional().describe("Role name"),
  name: z.string().optional().describe("Alias for role"),
  roleName: z.string().optional().describe("Alias for role"),
  user: z.string().optional().describe("User name"),
  toUser: z.string().optional().describe("Alias for user"),
  userName: z.string().optional().describe("Alias for user"),
  username: z.string().optional().describe("Alias for user"),
  host: z.string().default("%").describe("Host name"),
  withAdminOption: z.boolean().default(false).describe("Grant with admin option"),
});

export const RoleAssignSchema = RoleAssignSchemaBase.refine((val) => val.role || val.name || val.roleName, {
  message: "Must provide 'role', 'name', or 'roleName'",
})
  .refine((val) => val.user || val.toUser || val.userName || val.username, {
    message: "Must provide 'user', 'toUser', 'userName', or 'username'",
  })
  .transform((val) => {
    const role = val.role || val.name || val.roleName || "";
    const user = val.user || val.toUser || val.userName || val.username || "";
    return { ...val, role, user };
  });

export const RoleRevokeSchemaBase = z.object({
  role: z.string().optional().describe("Role name"),
  name: z.string().optional().describe("Alias for role"),
  roleName: z.string().optional().describe("Alias for role"),
  user: z.string().optional().describe("User name"),
  fromUser: z.string().optional().describe("Alias for user"),
  userName: z.string().optional().describe("Alias for user"),
  username: z.string().optional().describe("Alias for user"),
  host: z.string().default("%").describe("Host name"),
  privileges: z.union([z.string(), z.array(z.string())]).optional().describe("Privileges to revoke"),
  privilege: z.string().optional().describe("Single privilege to revoke"),
  database: z.string().default("*").describe("Database name or '*'"),
  schema: z.string().optional().describe("Alias for database"),
  db: z.string().optional().describe("Alias for database"),
  table: z.string().default("*").describe("Table name or '*'"),
  tableName: z.string().optional().describe("Alias for table"),
  on: z.string().optional().describe("Target object (e.g. 'db.table')"),
  object: z.string().optional().describe("Alias for on"),
});

export const RoleRevokeSchema = RoleRevokeSchemaBase.refine((val) => val.role || val.name || val.roleName, {
  message: "Must provide 'role', 'name', or 'roleName'",
})
  .refine(
    (val) =>
      Boolean(val.user) ||
      Boolean(val.fromUser) ||
      Boolean(val.userName) ||
      Boolean(val.username) ||
      Boolean(val.privileges) ||
      Boolean(val.privilege),
    {
      message: "Must provide 'user'/'fromUser'/'userName'/'username' OR 'privileges'/'privilege'",
    },
  )
  .transform((val) => {
    const role = val.role || val.name || val.roleName || "";
    const user = val.user || val.fromUser || val.userName || val.username || "";
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

    return { ...val, role, user, privileges, database, table };
  });

export const UserRolesSchemaBase = z.object({
  user: z.string().optional(),
  targetUser: z.string().optional(),
  userName: z.string().optional(),
  username: z.string().optional(),
  host: z.string().default("%"),
});

export const UserRolesSchema = UserRolesSchemaBase.refine(
  (val) => val.user || val.targetUser || val.userName || val.username,
  {
    message: "Must provide 'user', 'targetUser', 'userName', or 'username'",
  },
).transform((val) => {
  const user = val.user || val.targetUser || val.userName || val.username || "";
  return { ...val, user };
});

export function getRoleAssignTools(adapter: MySQLAdapter): ToolDefinition[] {
  return [
    {
      name: "mysql_role_assign",
      title: "MySQL Assign Role",
      description: "Assign a role to a user.",
      group: "roles",
      inputSchema: RoleAssignSchemaBase,
      outputSchema: RoleAssignOutputSchema,
      requiredScopes: ["admin"],
      annotations: WRITE,
      handler: async (params: unknown, _context: RequestContext) => {
        try {
          const { role, user, host, withAdminOption } =
            RoleAssignSchema.parse(params);

          validateIdentifier(role, "role");
          validateMySQLUserHost(user, "user");
          validateMySQLUserHost(host, "host");

          const checkResult = await adapter.executeQuery(
            `SELECT 1 FROM mysql.user WHERE User = ? AND account_locked = 'Y' AND password_expired = 'Y' AND authentication_string = ''`,
            [role],
          );
          if (!checkResult.rows || checkResult.rows.length === 0) {
            return formatHandlerErrorResponse(
              new MySQLMcpError(`Role '${role}' does not exist`, "OBJECT_NOT_FOUND", ErrorCategory.RESOURCE)
            );
          }

          const userCheck = await adapter.executeQuery(
            `SELECT 1 FROM mysql.user WHERE User = ? AND Host = ?`,
            [user, host],
          );
          if (!userCheck.rows || userCheck.rows.length === 0) {
            return formatHandlerErrorResponse(
              new MySQLMcpError(`User '${user}' does not exist`, "OBJECT_NOT_FOUND", ErrorCategory.RESOURCE)
            );
          }

          let sql = `GRANT '${role}' TO '${user}'@'${host}'`;
          if (withAdminOption) sql += " WITH ADMIN OPTION";
          await adapter.rawQuery(sql);
          await adapter.rawQuery(
            `SET DEFAULT ROLE '${role}' TO '${user}'@'${host}'`,
          );
          const data = { role, user, host };
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
          if (message.includes("Unknown authorization ID")) {
            return formatHandlerErrorResponse(
              new MySQLMcpError("User does not exist", "OBJECT_NOT_FOUND", ErrorCategory.RESOURCE)
            );
          }
          return formatHandlerErrorResponse(error);
        }
      },
    },
    {
      name: "mysql_role_revoke",
      title: "MySQL Revoke Role",
      description: "Revoke a role from a user, or privileges from a role.",
      group: "roles",
      inputSchema: RoleRevokeSchemaBase,
      outputSchema: RoleRevokeOutputSchema,
      requiredScopes: ["admin"],
      annotations: WRITE,
      handler: async (params: unknown, _context: RequestContext) => {
        try {
          const { role, user, host, privileges, database, table } =
            RoleRevokeSchema.parse(params);

          const checkResult = await adapter.executeQuery(
            `SELECT 1 FROM mysql.user WHERE User = ? AND account_locked = 'Y' AND password_expired = 'Y' AND authentication_string = ''`,
            [role],
          );
          if (!checkResult.rows || checkResult.rows.length === 0) {
            return formatHandlerErrorResponse(
              new MySQLMcpError(`Role '${role}' does not exist`, "OBJECT_NOT_FOUND", ErrorCategory.RESOURCE)
            );
          }

          if (user) {
            const userCheck = await adapter.executeQuery(
              `SELECT 1 FROM mysql.user WHERE User = ? AND Host = ?`,
              [user, host],
            );
            if (!userCheck.rows || userCheck.rows.length === 0) {
              return formatHandlerErrorResponse(
                new MySQLMcpError(`User '${user}' does not exist`, "OBJECT_NOT_FOUND", ErrorCategory.RESOURCE)
              );
            }

            const assignCheck = await adapter.executeQuery(
              `SELECT 1 FROM mysql.role_edges WHERE FROM_USER = ? AND FROM_HOST = '%' AND TO_USER = ? AND TO_HOST = ?`,
              [role, user, host],
            );
            if (!assignCheck.rows || assignCheck.rows.length === 0) {
              return formatHandlerErrorResponse(
                new MySQLMcpError(
                  `Role '${role}' is not assigned to user '${user}'@'${host}'`,
                  "OBJECT_NOT_FOUND",
                  ErrorCategory.RESOURCE
                )
              );
            }

            validateIdentifier(role, "role");
            validateMySQLUserHost(user, "user");
            validateMySQLUserHost(host, "host");

            await adapter.rawQuery(`REVOKE '${role}' FROM '${user}'@'${host}'`);
            const data = { role, user, host };
            const response = { success: true, data };
            const tokenEstimate = Math.ceil(
              Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
            );
            return withTokenEstimate({ ...response, metrics: { tokenEstimate } });
          } else if (privileges.length > 0) {
            for (const priv of privileges) {
              validateMySQLPrivilege(priv);
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
              `REVOKE ${privileges.join(", ")} ON ${onClause} FROM '${role}'`,
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
          } else {
            return formatHandlerErrorResponse(
              new MySQLMcpError(
                "Must provide 'user' to revoke role from user, or 'privileges' to revoke privileges from role",
                "VALIDATION_ERROR",
                ErrorCategory.VALIDATION
              )
            );
          }
        } catch (error: unknown) {
          if (error instanceof ZodError) {
            return formatHandlerErrorResponse(error);
          }
          const message = error instanceof Error ? error.message : String(error);
          if (message.includes("Unknown authorization ID")) {
            return formatHandlerErrorResponse(
              new MySQLMcpError("User does not exist", "OBJECT_NOT_FOUND", ErrorCategory.RESOURCE)
            );
          }
          return formatHandlerErrorResponse(error);
        }
      },
    },
    {
      name: "mysql_user_roles",
      title: "MySQL User Roles",
      description: "List roles assigned to a user.",
      group: "roles",
      inputSchema: UserRolesSchemaBase,
      outputSchema: UserRolesOutputSchema,
      requiredScopes: ["read"],
      annotations: READ_ONLY,
      handler: async (params: unknown, _context: RequestContext) => {
        try {
          const { user, host } = UserRolesSchema.parse(params);

          const userCheck = await adapter.executeQuery(
            `SELECT 1 FROM mysql.user WHERE User = ? AND Host = ?`,
            [user, host],
          );
          if (!userCheck.rows || userCheck.rows.length === 0) {
            return formatHandlerErrorResponse(
              new MySQLMcpError(`User '${user}' does not exist`, "OBJECT_NOT_FOUND", ErrorCategory.RESOURCE)
            );
          }

          const result = await adapter.executeQuery(
            `SELECT FROM_USER as roleName, FROM_HOST as roleHost, WITH_ADMIN_OPTION as admin
                       FROM mysql.role_edges WHERE TO_USER=? AND TO_HOST=?`,
            [user, host],
          );
          const data = { user, host, roles: result.rows ?? [] };
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
