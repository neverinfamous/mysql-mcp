import { z, ZodError } from "zod";
import {
  stripErrorPrefix,
  formatZodError,
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
import {
  validateIdentifier,
  validateMySQLPrivilege,
  validateMySQLUserHost,
} from "../../../../utils/validators.js";
import { READ_ONLY, WRITE } from "../../../../utils/annotations.js";

export const RoleAssignSchemaBase = z.object({
  role: z.string().optional(),
  user: z.string().optional(),
  toUser: z.string().optional(),
  host: z.string().default("%"),
  withAdminOption: z.boolean().default(false),
});

export const RoleAssignSchema = RoleAssignSchemaBase.refine((val) => val.role, {
  message: "Must provide 'role'",
})
  .refine((val) => val.user || val.toUser, {
    message: "Must provide 'user' or 'toUser'",
  })
  .transform((val) => {
    const role = val.role || "";
    const user = val.user || val.toUser || "";
    return { ...val, role, user };
  });

export const RoleRevokeSchemaBase = z.object({
  role: z.string().optional(),
  user: z.string().optional(),
  fromUser: z.string().optional(),
  host: z.string().default("%"),
  privileges: z.union([z.string(), z.array(z.string())]).optional(),
  privilege: z.string().optional(),
  database: z.string().default("*"),
  table: z.string().default("*"),
  on: z.string().optional(),
});

export const RoleRevokeSchema = RoleRevokeSchemaBase.refine((val) => val.role, {
  message: "Must provide 'role'",
})
  .refine(
    (val) =>
      Boolean(val.user) ||
      Boolean(val.fromUser) ||
      Boolean(val.privileges) ||
      Boolean(val.privilege),
    {
      message: "Must provide 'user'/'fromUser' OR 'privileges'/'privilege'",
    },
  )
  .transform((val) => {
    const role = val.role || "";
    const user = val.user || val.fromUser || "";
    const privsRaw = val.privileges ?? (val.privilege ? [val.privilege] : []);
    const privileges = Array.isArray(privsRaw) ? privsRaw : [privsRaw];
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

    return { ...val, role, user, privileges, database, table };
  });

export const UserRolesSchemaBase = z.object({
  user: z.string().optional(),
  targetUser: z.string().optional(),
  host: z.string().default("%"),
});

export const UserRolesSchema = UserRolesSchemaBase.refine(
  (val) => val.user || val.targetUser,
  {
    message: "Must provide 'user' or 'targetUser'",
  },
).transform((val) => {
  const user = val.user || val.targetUser || "";
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
            return formatHandlerErrorResponse(new Error("Role does not exist"));
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
            return formatHandlerErrorResponse(new Error(formatZodError(error)));
          }
          const message = error instanceof Error ? error.message : String(error);
          if (message.includes("Unknown authorization ID")) {
            return formatHandlerErrorResponse(new Error("User does not exist"));
          }
          const response = { success: false, error: stripErrorPrefix(message) };
          const tokenEstimate = Math.ceil(
            Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
          );
          return withTokenEstimate({ ...response, metrics: { tokenEstimate } });
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
            return formatHandlerErrorResponse(new Error("Role does not exist"));
          }

          if (user) {
            const userCheck = await adapter.executeQuery(
              `SELECT 1 FROM mysql.user WHERE User = ? AND Host = ?`,
              [user, host],
            );
            if (!userCheck.rows || userCheck.rows.length === 0) {
              return formatHandlerErrorResponse(
                new Error("User does not exist"),
              );
            }

            const assignCheck = await adapter.executeQuery(
              `SELECT 1 FROM mysql.role_edges WHERE FROM_USER = ? AND FROM_HOST = '%' AND TO_USER = ? AND TO_HOST = ?`,
              [role, user, host],
            );
            if (!assignCheck.rows || assignCheck.rows.length === 0) {
              return formatHandlerErrorResponse(
                new Error(
                  `Role '${role}' is not assigned to user '${user}'@'${host}'`,
                ),
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
            const response = {
              success: false,
              error:
                "Must provide 'user' to revoke role from user, or 'privileges' to revoke privileges from role",
            };
            const tokenEstimate = Math.ceil(
              Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
            );
            return withTokenEstimate({ ...response, metrics: { tokenEstimate } });
          }
        } catch (error: unknown) {
          if (error instanceof ZodError) {
            return formatHandlerErrorResponse(new Error(formatZodError(error)));
          }
          const message = error instanceof Error ? error.message : String(error);
          if (message.includes("Unknown authorization ID")) {
            return formatHandlerErrorResponse(new Error("User does not exist"));
          }
          const cleanMsg = stripErrorPrefix(message);
          const pRole =
            params !== null &&
            typeof params === "object" &&
            "role" in params &&
            typeof params.role === "string"
              ? params.role
              : undefined;
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
            return formatHandlerErrorResponse(new Error("User does not exist"));
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
          return { ...response, metrics: { tokenEstimate } };
        } catch (error: unknown) {
          return formatHandlerErrorResponse(error);
        }
      },
    },
  ];
}
