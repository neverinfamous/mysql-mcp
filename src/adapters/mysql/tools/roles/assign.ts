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
    let role = val.role || val.name || val.roleName || "";
    let roleHost = "%";
    if (role?.includes("@")) {
      const parts = role.split("@");
      role = parts[0] || "";
      if (parts.length > 1) {
        roleHost = parts.slice(1).join("@");
      }
    }
    let user = val.user || val.toUser || val.userName || val.username || "";
    let host = val.host;
    if (user?.includes("@")) {
      const parts = user.split("@");
      user = parts[0] || "";
      if (parts.length > 1) {
        host = parts.slice(1).join("@");
      }
    }
    return { ...val, role, roleHost, user, host };
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
  .refine(
    (val) => {
      const hasUser = Boolean(val.user) || Boolean(val.fromUser) || Boolean(val.userName) || Boolean(val.username);
      const hasPriv = Boolean(val.privileges) || Boolean(val.privilege);
      return !(hasUser && hasPriv);
    },
    {
      message: "Cannot provide both user and privileges. Use 'user' to revoke a role, or 'privileges' to revoke specific privileges.",
    }
  )
  .refine(
    (val) => {
      const targetOn = val.on ?? val.object;
      if (targetOn && targetOn.split(".").length > 2) return false;
      return true;
    },
    {
      message: "Column-level privileges are not supported via the 'on' parameter. Use 'database' and 'table' for table-level revokes, and provide at most 'db.table'.",
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
    let user = val.user || val.fromUser || val.userName || val.username || "";
    let host = val.host;
    if (user?.includes("@")) {
      const parts = user.split("@");
      user = parts[0] || "";
      if (parts.length > 1) {
        host = parts.slice(1).join("@");
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

    return { ...val, role, roleHost, user, host, privileges, database, table };
  })
  .refine((val) => {
    if (val.privileges.length > 0) {
      return !(val.database === "*" && val.table !== "*");
    }
    return true;
  }, {
    message: "Cannot specify a table without a specific database. MySQL does not support revoking on a specific table across all databases (*.table). Use database: '*' and table: '*' for global privileges, or provide a specific database.",
  });

export const UserRolesSchemaBase = z.object({
  user: z.string().optional().describe("User name"),
  targetUser: z.string().optional().describe("Alias for user"),
  userName: z.string().optional().describe("Alias for user"),
  username: z.string().optional().describe("Alias for user"),
  host: z.string().default("%").describe("Host name"),
});

export const UserRolesSchema = UserRolesSchemaBase.refine(
  (val) => val.user || val.targetUser || val.userName || val.username,
  {
    message: "Must provide 'user', 'targetUser', 'userName', or 'username'",
  },
).transform((val) => {
  let user = val.user || val.targetUser || val.userName || val.username || "";
  let host = val.host;
  if (user?.includes("@")) {
    const parts = user.split("@");
    user = parts[0] || "";
    if (parts.length > 1) {
      host = parts.slice(1).join("@");
    }
  }
  return { ...val, user, host };
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
          const { role, roleHost, user, host, withAdminOption } =
            RoleAssignSchema.parse(params);

          validateMySQLUserHost(role, "role");
          validateMySQLUserHost(roleHost, "host");
          validateMySQLUserHost(user, "user");
          validateMySQLUserHost(host, "host");

          const checkResult = await adapter.executeQuery(
            `(SELECT 1 FROM mysql.user WHERE User = ? AND Host = ? AND account_locked = 'Y' AND password_expired = 'Y' AND authentication_string = '')`,
            [role, roleHost],
          );
          if (!checkResult.rows || checkResult.rows.length === 0) {
            const roleStr = roleHost === "%" ? role : `${role}@${roleHost}`;
            return formatHandlerErrorResponse(
              new MySQLMcpError(`Role '${roleStr}' does not exist`, "OBJECT_NOT_FOUND", ErrorCategory.RESOURCE)
            );
          }

          const userCheck = await adapter.executeQuery(
            `(SELECT 1 FROM mysql.user WHERE User = ? AND Host = ?)`,
            [user, host],
          );
          if (!userCheck.rows || userCheck.rows.length === 0) {
            return formatHandlerErrorResponse(
              new MySQLMcpError(`User '${user}' at host '${host}' does not exist`, "OBJECT_NOT_FOUND", ErrorCategory.RESOURCE)
            );
          }

          let sql = `GRANT '${role}'@'${roleHost}' TO '${user}'@'${host}'`;
          if (withAdminOption) sql += " WITH ADMIN OPTION";
          await adapter.rawQuery(sql);
          await adapter.rawQuery(
            `SET DEFAULT ROLE '${role}'@'${roleHost}' TO '${user}'@'${host}'`,
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
          if (message.includes("GRANT would create a loop")) {
            return formatHandlerErrorResponse(
              new MySQLMcpError("Cannot assign a role to itself. The GRANT would create a loop.", "VALIDATION_ERROR", ErrorCategory.VALIDATION)
            );
          }
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
          const { role, roleHost, user, host, privileges, database, table } =
            RoleRevokeSchema.parse(params);

          validateMySQLUserHost(role, "role");
          validateMySQLUserHost(roleHost, "host");

          const checkResult = await adapter.executeQuery(
            `(SELECT 1 FROM mysql.user WHERE User = ? AND Host = ? AND account_locked = 'Y' AND password_expired = 'Y' AND authentication_string = '')`,
            [role, roleHost],
          );
          if (!checkResult.rows || checkResult.rows.length === 0) {
            const roleStr = roleHost === "%" ? role : `${role}@${roleHost}`;
            return formatHandlerErrorResponse(
              new MySQLMcpError(`Role '${roleStr}' does not exist`, "OBJECT_NOT_FOUND", ErrorCategory.RESOURCE)
            );
          }

          if (user) {
            validateMySQLUserHost(user, "user");
            validateMySQLUserHost(host, "host");

            const userCheck = await adapter.executeQuery(
              `(SELECT 1 FROM mysql.user WHERE User = ? AND Host = ?)`,
              [user, host],
            );
            if (!userCheck.rows || userCheck.rows.length === 0) {
              return formatHandlerErrorResponse(
                new MySQLMcpError(`User '${user}' at host '${host}' does not exist`, "OBJECT_NOT_FOUND", ErrorCategory.RESOURCE)
              );
            }

            const assignCheck = await adapter.executeQuery(
              `(SELECT 1 FROM mysql.role_edges WHERE FROM_USER = ? AND FROM_HOST = ? AND TO_USER = ? AND TO_HOST = ?)`,
              [role, roleHost, user, host],
            );
            if (!assignCheck.rows || assignCheck.rows.length === 0) {
              const roleStr = roleHost === "%" ? role : `${role}@${roleHost}`;
              return formatHandlerErrorResponse(
                new MySQLMcpError(
                  `Role '${roleStr}' is not assigned to user '${user}'`,
                  "OBJECT_NOT_FOUND",
                  ErrorCategory.RESOURCE
                )
              );
            }

            await adapter.rawQuery(`REVOKE '${role}'@'${roleHost}' FROM '${user}'@'${host}'`);
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
              `REVOKE ${privileges.join(", ")} ON ${onClause} FROM '${role}'@'${roleHost}'`,
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
          if (message.includes("There is no such grant")) {
            return formatHandlerErrorResponse(
              new MySQLMcpError("No such grant exists to revoke", "OBJECT_NOT_FOUND", ErrorCategory.RESOURCE)
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

          validateMySQLUserHost(user, "user");
          validateMySQLUserHost(host, "host");

          const userCheck = await adapter.executeQuery(
            `(SELECT 1 FROM mysql.user WHERE User = ? AND Host = ?)`,
            [user, host],
          );
          if (!userCheck.rows || userCheck.rows.length === 0) {
            return formatHandlerErrorResponse(
              new MySQLMcpError(`User '${user}' at host '${host}' does not exist`, "OBJECT_NOT_FOUND", ErrorCategory.RESOURCE)
            );
          }

          const result = await adapter.executeQuery(
            `(SELECT FROM_USER as roleName, FROM_HOST as roleHost, WITH_ADMIN_OPTION as admin
                       FROM mysql.role_edges WHERE TO_USER=? AND TO_HOST=?)`,
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
