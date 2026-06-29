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
  role: z.string().optional(),
  name: z.string().optional(),
  roleName: z.string().optional(),
  user: z.string().optional(),
  toUser: z.string().optional(),
  userName: z.string().optional(),
  host: z.string().default("%"),
  withAdminOption: z.boolean().default(false),
});

export const RoleAssignSchema = RoleAssignSchemaBase.refine((val) => val.role || val.name || val.roleName, {
  message: "Must provide 'role', 'name', or 'roleName'",
})
  .refine((val) => val.user || val.toUser || val.userName, {
    message: "Must provide 'user', 'toUser', or 'userName'",
  })
  .transform((val) => {
    const role = val.role || val.name || val.roleName || "";
    const user = val.user || val.toUser || val.userName || "";
    return { ...val, role, user };
  });

export const RoleRevokeSchemaBase = z.object({
  role: z.string().optional(),
  name: z.string().optional(),
  roleName: z.string().optional(),
  user: z.string().optional(),
  fromUser: z.string().optional(),
  userName: z.string().optional(),
  host: z.string().default("%"),
  privileges: z.union([z.string(), z.array(z.string())]).optional(),
  privilege: z.string().optional(),
  database: z.string().default("*"),
  db: z.string().optional(),
  table: z.string().default("*"),
  on: z.string().optional(),
});

export const RoleRevokeSchema = RoleRevokeSchemaBase.refine((val) => val.role || val.name || val.roleName, {
  message: "Must provide 'role', 'name', or 'roleName'",
})
  .refine(
    (val) =>
      Boolean(val.user) ||
      Boolean(val.fromUser) ||
      Boolean(val.userName) ||
      Boolean(val.privileges) ||
      Boolean(val.privilege),
    {
      message: "Must provide 'user'/'fromUser'/'userName' OR 'privileges'/'privilege'",
    },
  )
  .transform((val) => {
    const role = val.role || val.name || val.roleName || "";
    const user = val.user || val.fromUser || val.userName || "";
    const privsRaw = val.privileges ?? (val.privilege ? [val.privilege] : []);
    const privileges = Array.isArray(privsRaw) ? privsRaw : [privsRaw];
    let database = val.db ?? val.database;
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

    return { ...val, role, user, privileges, database, table };
  });

export const UserRolesSchemaBase = z.object({
  user: z.string().optional(),
  targetUser: z.string().optional(),
  userName: z.string().optional(),
  host: z.string().default("%"),
});

export const UserRolesSchema = UserRolesSchemaBase.refine(
  (val) => val.user || val.targetUser || val.userName,
  {
    message: "Must provide 'user', 'targetUser', or 'userName'",
  },
).transform((val) => {
  const user = val.user || val.targetUser || val.userName || "";
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
