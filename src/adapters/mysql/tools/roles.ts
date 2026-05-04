/**
 * MySQL Roles Tools - 8 tools for role management
 */

import { z, ZodError } from "zod";
import { stripErrorPrefix, formatZodError, formatHandlerErrorResponse } from "./core/error-helpers.js";
import type { MySQLAdapter } from "../mysql-adapter.js";
import type { ToolDefinition, RequestContext } from "../../../types/index.js";
import {
  validateIdentifier,
  validateMySQLPrivilege,
  validateMySQLUserHost,
  escapeLikePattern,
} from "../../../utils/validators.js";

const RoleListSchema = z.object({
  pattern: z.string().optional().describe("Filter pattern (LIKE syntax)"),
});

const RoleCreateSchemaBase = z.object({
  name: z.string().optional().describe("Role name"),
  role: z.string().optional().describe("Alias for name"),
  ifNotExists: z.boolean().default(false),
});

const RoleCreateSchema = RoleCreateSchemaBase
  .refine((val) => val.name || val.role, {
    message: "Must provide 'name' or 'role'",
  })
  .transform((val) => {
    const name = val.name || val.role || "";
    return { ...val, name };
  });

const RoleDropSchemaBase = z.object({
  name: z.string().optional().describe("Role name"),
  role: z.string().optional().describe("Alias for name"),
  ifExists: z.boolean().default(false),
});

const RoleDropSchema = RoleDropSchemaBase
  .refine((val) => val.name || val.role, {
    message: "Must provide 'name' or 'role'",
  })
  .transform((val) => {
    const name = val.name || val.role || "";
    return { ...val, name };
  });

const RoleGrantsSchemaBase = z.object({
  role: z.string().optional(),
  name: z.string().optional(),
});

const RoleGrantsSchema = RoleGrantsSchemaBase
  .refine((val) => val.role || val.name, {
    message: "Must provide 'role' or 'name'",
  })
  .transform((val) => {
    const role = val.role || val.name || "";
    return { ...val, role };
  });

const RoleGrantPrivilegeSchemaBase = z.object({
  role: z.string().optional(),
  privileges: z.array(z.string()).optional(),
  privilege: z.string().optional(),
  database: z.string().default("*"),
  table: z.string().default("*"),
  on: z.string().optional(),
});

const RoleGrantPrivilegeSchema = RoleGrantPrivilegeSchemaBase
  .refine((val) => val.role, {
    message: "Must provide 'role'",
  })
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

const RoleAssignSchemaBase = z.object({
  role: z.string().optional(),
  user: z.string().optional(),
  toUser: z.string().optional(),
  host: z.string().default("%"),
  withAdminOption: z.boolean().default(false),
});

const RoleAssignSchema = RoleAssignSchemaBase
  .refine((val) => val.role, {
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

const RoleRevokeSchemaBase = z.object({
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

const RoleRevokeSchema = RoleRevokeSchemaBase
  .refine((val) => val.role, {
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

const UserRolesSchemaBase = z.object({
  user: z.string().optional(),
  targetUser: z.string().optional(),
  host: z.string().default("%"),
});

const UserRolesSchema = UserRolesSchemaBase
  .refine((val) => val.user || val.targetUser, {
    message: "Must provide 'user' or 'targetUser'",
  })
  .transform((val) => {
    const user = val.user || val.targetUser || "";
    return { ...val, user };
  });

export function getRoleTools(adapter: MySQLAdapter): ToolDefinition[] {
  return [
    {
      name: "mysql_role_list",
      title: "MySQL List Roles",
      description: "List all roles defined in MySQL.",
      group: "roles",
      inputSchema: RoleListSchema,
      requiredScopes: ["read"],
      annotations: { readOnlyHint: true, idempotentHint: true },
      handler: async (params: unknown, _context: RequestContext) => {
        try {
          const { pattern } = RoleListSchema.parse(params);
          let query = `SELECT u.User as roleName, u.Host FROM mysql.user u
                      WHERE u.account_locked='Y' AND u.password_expired='Y' AND u.authentication_string=''`;
          if (pattern)
            query += ` AND u.User LIKE '${escapeLikePattern(pattern)}'`;
          const result = await adapter.executeQuery(query);
          const data = {
            roles: result.rows ?? [],
            count: result.rows?.length ?? 0,
          };
          const response = { success: true as const, data };
            const tokenEstimate = Math.ceil(Buffer.byteLength(JSON.stringify(response), "utf8") / 4);
            return { ...response, metrics: { tokenEstimate } };
        } catch (error: unknown) {
          return formatHandlerErrorResponse(error);
        }
      },
    },
    {
      name: "mysql_role_create",
      title: "MySQL Create Role",
      description: "Create a new role.",
      group: "roles",
      inputSchema: RoleCreateSchemaBase,
      requiredScopes: ["admin"],
      annotations: { readOnlyHint: false },
      handler: async (params: unknown, _context: RequestContext) => {
        try {
          const { name, ifNotExists } = RoleCreateSchema.parse(params);
          if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name))
{ return formatHandlerErrorResponse(new Error("Invalid role name")); }

          // Pre-check existence for skipped indicator when ifNotExists is true
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
            const tokenEstimate = Math.ceil(Buffer.byteLength(JSON.stringify(response), "utf8") / 4);
            return { ...response, metrics: { tokenEstimate } };
            }
          }

          const clause = ifNotExists ? "IF NOT EXISTS " : "";
          await adapter.executeQuery(`CREATE ROLE ${clause}'${name}'`);
          const data = { roleName: name };
          const response = { success: true as const, data };
          const tokenEstimate = Math.ceil(Buffer.byteLength(JSON.stringify(response), "utf8") / 4);
          return { ...response, metrics: { tokenEstimate } };
        } catch (error: unknown) {
          if (error instanceof ZodError)
{ return formatHandlerErrorResponse(new Error(formatZodError(error))); }
          const message =
            error instanceof Error ? error.message : String(error);
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
            const response = { success: false,
              error: `Role '${roleName}' already exists`,
            };
            const tokenEstimate = Math.ceil(Buffer.byteLength(JSON.stringify(response), "utf8") / 4);
            return { ...response, metrics: { tokenEstimate } };
          }
          const response = { success: false, error: stripErrorPrefix(message) };
          const tokenEstimate = Math.ceil(Buffer.byteLength(JSON.stringify(response), "utf8") / 4);
          return { ...response, metrics: { tokenEstimate } };
        }
      },
    },
    {
      name: "mysql_role_drop",
      title: "MySQL Drop Role",
      description: "Drop a role.",
      group: "roles",
      inputSchema: RoleDropSchemaBase,
      requiredScopes: ["admin"],
      annotations: { readOnlyHint: false, destructiveHint: true },
      handler: async (params: unknown, _context: RequestContext) => {
        try {
          const { name, ifExists } = RoleDropSchema.parse(params);
          if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name))
{ return formatHandlerErrorResponse(new Error("Invalid role name")); }

          // Pre-check existence for skipped indicator when ifExists is true
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
            const tokenEstimate = Math.ceil(Buffer.byteLength(JSON.stringify(response), "utf8") / 4);
            return { ...response, metrics: { tokenEstimate } };
          }

          const data = { roleName: name };
          const response = { success: true as const, data };
          const tokenEstimate = Math.ceil(Buffer.byteLength(JSON.stringify(response), "utf8") / 4);
          return { ...response, metrics: { tokenEstimate } };
        } catch (error: unknown) {
          if (error instanceof ZodError)
{ return formatHandlerErrorResponse(new Error(formatZodError(error))); }
          const message =
            error instanceof Error ? error.message : String(error);
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
            const response = { success: false,
              error: `Role '${roleName}' does not exist`,
            };
            const tokenEstimate = Math.ceil(Buffer.byteLength(JSON.stringify(response), "utf8") / 4);
            return { ...response, metrics: { tokenEstimate } };
          }
          const response = { success: false, error: stripErrorPrefix(message) };
          const tokenEstimate = Math.ceil(Buffer.byteLength(JSON.stringify(response), "utf8") / 4);
          return { ...response, metrics: { tokenEstimate } };
        }
      },
    },
    {
      name: "mysql_role_grants",
      title: "MySQL Role Grants",
      description: "List privileges granted to a role.",
      group: "roles",
      inputSchema: RoleGrantsSchemaBase,
      requiredScopes: ["read"],
      annotations: { readOnlyHint: true, idempotentHint: true },
      handler: async (params: unknown, _context: RequestContext) => {
        try {
          const { role } = RoleGrantsSchema.parse(params);

          // Validate role identifier before interpolation
          validateIdentifier(role, "role");

          // Check if role exists first (roles are locked accounts with empty auth string)
          const checkResult = await adapter.executeQuery(
            `SELECT 1 FROM mysql.user WHERE User = ? AND account_locked = 'Y' AND password_expired = 'Y' AND authentication_string = ''`,
            [role],
          );
          if (!checkResult.rows || checkResult.rows.length === 0) { return formatHandlerErrorResponse(new Error("Role does not exist")); }

          // SHOW GRANTS cannot be always prepared
          const result = await adapter.rawQuery(`SHOW GRANTS FOR '${role}'`);
          const grants = (result.rows ?? []).map((r) => Object.values(r)[0]);
          const data = { role, grants, exists: true };
          const response = { success: true as const, data };
          const tokenEstimate = Math.ceil(Buffer.byteLength(JSON.stringify(response), "utf8") / 4);
          return { ...response, metrics: { tokenEstimate } };
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
      requiredScopes: ["admin"],
      annotations: { readOnlyHint: false },
      handler: async (params: unknown, _context: RequestContext) => {
        try {
          const { role, privileges, database, table } =
            RoleGrantPrivilegeSchema.parse(params);
          if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(role))
{ return formatHandlerErrorResponse(new Error("Invalid role name")); }

          // Validate each privilege against allowlist
          for (const priv of privileges) {
            validateMySQLPrivilege(priv);
          }

          // Check if role exists first
          const checkResult = await adapter.executeQuery(
            `SELECT 1 FROM mysql.user WHERE User = ? AND account_locked = 'Y' AND password_expired = 'Y' AND authentication_string = ''`,
            [role],
          );
          if (!checkResult.rows || checkResult.rows.length === 0) { return formatHandlerErrorResponse(new Error("Role does not exist")); }

          let targetDb = database;
          let targetTable = table;

          // Handle schema-qualified table names (e.g. "db.table")
          if (targetTable.includes(".") && targetTable !== "*") {
            const [dbPart, tablePart] = targetTable.split(".");
            if (dbPart && tablePart) {
              targetDb = dbPart;
              targetTable = tablePart;
            }
          }

          // Validate database and table identifiers when not wildcards
          if (targetDb !== "*") validateIdentifier(targetDb, "database");
          if (targetTable !== "*") validateIdentifier(targetTable, "table");

          const db = targetDb === "*" ? "*" : `\`${targetDb}\``;
          const tbl = targetTable === "*" ? "*" : `\`${targetTable}\``;

          let onClause = `${db}.${tbl}`;
          if (targetDb === "*" && targetTable !== "*") {
            // Cannot use * for db with specific table (MySQL syntax error)
            // Assume current database if table is specified but db is wildcard
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
            const tokenEstimate = Math.ceil(Buffer.byteLength(JSON.stringify(response), "utf8") / 4);
            return { ...response, metrics: { tokenEstimate } };
        } catch (error: unknown) {
          if (error instanceof ZodError)
{ return formatHandlerErrorResponse(new Error(formatZodError(error))); }
          const message =
            error instanceof Error ? error.message : String(error);
          const cleanMsg = stripErrorPrefix(message);
          const parsed =
            params !== null && typeof params === "object"
              ? (params as Record<string, unknown>)
              : {};
          const pRole =
            typeof parsed["role"] === "string" ? parsed["role"] : undefined;
          if (pRole !== undefined) {
            const response = { success: false, role: pRole, error: cleanMsg };
            const tokenEstimate = Math.ceil(Buffer.byteLength(JSON.stringify(response), "utf8") / 4);
            return { ...response, metrics: { tokenEstimate } };
          }
          const response = { success: false, error: cleanMsg };
          const tokenEstimate = Math.ceil(Buffer.byteLength(JSON.stringify(response), "utf8") / 4);
          return { ...response, metrics: { tokenEstimate } };
        }
      },
    },
    {
      name: "mysql_role_assign",
      title: "MySQL Assign Role",
      description: "Assign a role to a user.",
      group: "roles",
      inputSchema: RoleAssignSchemaBase,
      requiredScopes: ["admin"],
      annotations: { readOnlyHint: false },
      handler: async (params: unknown, _context: RequestContext) => {
        try {
          const { role, user, host, withAdminOption } =
            RoleAssignSchema.parse(params);

          // Validate all interpolated identifiers
          validateIdentifier(role, "role");
          validateMySQLUserHost(user, "user");
          validateMySQLUserHost(host, "host");

          // Check if role exists first
          const checkResult = await adapter.executeQuery(
            `SELECT 1 FROM mysql.user WHERE User = ? AND account_locked = 'Y' AND password_expired = 'Y' AND authentication_string = ''`,
            [role],
          );
          if (!checkResult.rows || checkResult.rows.length === 0) { return formatHandlerErrorResponse(new Error("Role does not exist")); }

          let sql = `GRANT '${role}' TO '${user}'@'${host}'`;
          if (withAdminOption) sql += " WITH ADMIN OPTION";
          await adapter.rawQuery(sql);
          await adapter.rawQuery(
            `SET DEFAULT ROLE '${role}' TO '${user}'@'${host}'`,
          );
          const data = { role, user, host };
          const response = { success: true as const, data };
          const tokenEstimate = Math.ceil(Buffer.byteLength(JSON.stringify(response), "utf8") / 4);
          return { ...response, metrics: { tokenEstimate } };
        } catch (error: unknown) {
          if (error instanceof ZodError)
{ return formatHandlerErrorResponse(new Error(formatZodError(error))); }
          const message =
            error instanceof Error ? error.message : String(error);
          if (message.includes("Unknown authorization ID")) { return formatHandlerErrorResponse(new Error("User does not exist")); }
          const response = { success: false, error: stripErrorPrefix(message) };
          const tokenEstimate = Math.ceil(Buffer.byteLength(JSON.stringify(response), "utf8") / 4);
          return { ...response, metrics: { tokenEstimate } };
        }
      },
    },
    {
      name: "mysql_role_revoke",
      title: "MySQL Revoke Role",
      description: "Revoke a role from a user, or privileges from a role.",
      group: "roles",
      inputSchema: RoleRevokeSchemaBase,
      requiredScopes: ["admin"],
      annotations: { readOnlyHint: false },
      handler: async (params: unknown, _context: RequestContext) => {
        try {
          const { role, user, host, privileges, database, table } =
            RoleRevokeSchema.parse(params);

          // Check if role exists first
          const checkResult = await adapter.executeQuery(
            `SELECT 1 FROM mysql.user WHERE User = ? AND account_locked = 'Y' AND password_expired = 'Y' AND authentication_string = ''`,
            [role],
          );
          if (!checkResult.rows || checkResult.rows.length === 0) { return formatHandlerErrorResponse(new Error("Role does not exist")); }

          if (user) {
            // P154: Check if user exists before checking assignment
            const userCheck = await adapter.executeQuery(
              `SELECT 1 FROM mysql.user WHERE User = ? AND Host = ?`,
              [user, host],
            );
            if (!userCheck.rows || userCheck.rows.length === 0) { return formatHandlerErrorResponse(new Error("User does not exist")); }

            // Check if the role is actually assigned to this user
            const assignCheck = await adapter.executeQuery(
              `SELECT 1 FROM mysql.role_edges WHERE FROM_USER = ? AND FROM_HOST = '%' AND TO_USER = ? AND TO_HOST = ?`,
              [role, user, host],
            );
            if (!assignCheck.rows || assignCheck.rows.length === 0) { return formatHandlerErrorResponse(new Error(`Role '${role}' is not assigned to user '${user}'@'${host}'`)); }

            // Validate before interpolation (role/user/host already validated by earlier checks
            // but validate user/host explicitly for this rawQuery)
            validateIdentifier(role, "role");
            validateMySQLUserHost(user, "user");
            validateMySQLUserHost(host, "host");

            await adapter.rawQuery(`REVOKE '${role}' FROM '${user}'@'${host}'`);
            const data = { role, user, host };
            const response = { success: true as const, data };
            const tokenEstimate = Math.ceil(Buffer.byteLength(JSON.stringify(response), "utf8") / 4);
            return { ...response, metrics: { tokenEstimate } };
          } else if (privileges.length > 0) {
            // Validate each privilege against allowlist
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
            const response = { success: true as const, data };
            const tokenEstimate = Math.ceil(Buffer.byteLength(JSON.stringify(response), "utf8") / 4);
            return { ...response, metrics: { tokenEstimate } };
          } else {
            const response = { success: false,
              error:
                "Must provide 'user' to revoke role from user, or 'privileges' to revoke privileges from role",
            };
            const tokenEstimate = Math.ceil(Buffer.byteLength(JSON.stringify(response), "utf8") / 4);
            return { ...response, metrics: { tokenEstimate } };
          }
        } catch (error: unknown) {
          if (error instanceof ZodError)
{ return formatHandlerErrorResponse(new Error(formatZodError(error))); }
          const message =
            error instanceof Error ? error.message : String(error);
          if (message.includes("Unknown authorization ID")) { return formatHandlerErrorResponse(new Error("User does not exist")); }
          const cleanMsg = stripErrorPrefix(message);
          const parsed =
            params !== null && typeof params === "object"
              ? (params as Record<string, unknown>)
              : {};
          const pRole =
            typeof parsed["role"] === "string" ? parsed["role"] : undefined;
          if (pRole !== undefined) {
            const response = { success: false, role: pRole, error: cleanMsg };
            const tokenEstimate = Math.ceil(Buffer.byteLength(JSON.stringify(response), "utf8") / 4);
            return { ...response, metrics: { tokenEstimate } };
          }
          const response = { success: false, error: cleanMsg };
          const tokenEstimate = Math.ceil(Buffer.byteLength(JSON.stringify(response), "utf8") / 4);
          return { ...response, metrics: { tokenEstimate } };
        }
      },
    },
    {
      name: "mysql_user_roles",
      title: "MySQL User Roles",
      description: "List roles assigned to a user.",
      group: "roles",
      inputSchema: UserRolesSchemaBase,
      requiredScopes: ["read"],
      annotations: { readOnlyHint: true, idempotentHint: true },
      handler: async (params: unknown, _context: RequestContext) => {
        try {
          const { user, host } = UserRolesSchema.parse(params);

          // P154: Check if user exists
          const userCheck = await adapter.executeQuery(
            `SELECT 1 FROM mysql.user WHERE User = ? AND Host = ?`,
            [user, host],
          );
          if (!userCheck.rows || userCheck.rows.length === 0) { return formatHandlerErrorResponse(new Error("User does not exist")); }

          const result = await adapter.executeQuery(
            `SELECT FROM_USER as roleName, FROM_HOST as roleHost, WITH_ADMIN_OPTION as admin
                       FROM mysql.role_edges WHERE TO_USER=? AND TO_HOST=?`,
            [user, host],
          );
          const data = { user, host, roles: result.rows ?? [] };
          const response = { success: true as const, data };
          const tokenEstimate = Math.ceil(Buffer.byteLength(JSON.stringify(response), "utf8") / 4);
          return { ...response, metrics: { tokenEstimate } };
        } catch (error: unknown) {
          return formatHandlerErrorResponse(error);
        }
      },
    },
  ];
}
