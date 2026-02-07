/**
 * MySQL Roles Tools - 8 tools for role management
 */

import { z } from "zod";
import type { MySQLAdapter } from "../MySQLAdapter.js";
import type { ToolDefinition, RequestContext } from "../../../types/index.js";

const RoleListSchema = z.object({
  pattern: z.string().optional().describe("Filter pattern (LIKE syntax)"),
});

const RoleCreateSchema = z.object({
  name: z.string().describe("Role name"),
  ifNotExists: z.boolean().default(true),
});

const RoleDropSchema = z.object({
  name: z.string().describe("Role name"),
  ifExists: z.boolean().default(true),
});

const RoleGrantsSchema = z.object({ role: z.string() });

const RoleGrantPrivilegeSchema = z.object({
  role: z.string(),
  privileges: z.array(z.string()),
  database: z.string().default("*"),
  table: z.string().default("*"),
});

const RoleAssignSchema = z.object({
  role: z.string(),
  user: z.string(),
  host: z.string().default("%"),
  withAdminOption: z.boolean().default(false),
});

const RoleRevokeSchema = z.object({
  role: z.string(),
  user: z.string(),
  host: z.string().default("%"),
});

const UserRolesSchema = z.object({
  user: z.string(),
  host: z.string().default("%"),
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
        const { pattern } = RoleListSchema.parse(params);
        let query = `SELECT u.User as roleName, u.Host FROM mysql.user u
                    WHERE u.account_locked='Y' AND u.password_expired='Y' AND u.authentication_string=''`;
        if (pattern) query += ` AND u.User LIKE '${pattern}'`;
        const result = await adapter.executeQuery(query);
        return { roles: result.rows ?? [], count: result.rows?.length ?? 0 };
      },
    },
    {
      name: "mysql_role_create",
      title: "MySQL Create Role",
      description: "Create a new role.",
      group: "roles",
      inputSchema: RoleCreateSchema,
      requiredScopes: ["admin"],
      annotations: { readOnlyHint: false },
      handler: async (params: unknown, _context: RequestContext) => {
        const { name, ifNotExists } = RoleCreateSchema.parse(params);
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name))
          throw new Error("Invalid role name");
        const clause = ifNotExists ? "IF NOT EXISTS " : "";
        try {
          await adapter.executeQuery(`CREATE ROLE ${clause}'${name}'`);
          return { success: true, roleName: name };
        } catch (error: unknown) {
          const message =
            error instanceof Error ? error.message : String(error);
          if (message.includes("Operation CREATE ROLE failed")) {
            return {
              success: false,
              reason: `Role '${name}' already exists`,
            };
          }
          throw error;
        }
      },
    },
    {
      name: "mysql_role_drop",
      title: "MySQL Drop Role",
      description: "Drop a role.",
      group: "roles",
      inputSchema: RoleDropSchema,
      requiredScopes: ["admin"],
      annotations: { readOnlyHint: false, destructiveHint: true },
      handler: async (params: unknown, _context: RequestContext) => {
        const { name, ifExists } = RoleDropSchema.parse(params);
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name))
          throw new Error("Invalid role name");
        try {
          await adapter.executeQuery(
            `DROP ROLE ${ifExists ? "IF EXISTS " : ""}'${name}'`,
          );
          return { success: true, roleName: name };
        } catch (error: unknown) {
          const message =
            error instanceof Error ? error.message : String(error);
          if (message.includes("Operation DROP ROLE failed")) {
            return {
              success: false,
              reason: `Role '${name}' does not exist`,
            };
          }
          throw error;
        }
      },
    },
    {
      name: "mysql_role_grants",
      title: "MySQL Role Grants",
      description: "List privileges granted to a role.",
      group: "roles",
      inputSchema: RoleGrantsSchema,
      requiredScopes: ["read"],
      annotations: { readOnlyHint: true, idempotentHint: true },
      handler: async (params: unknown, _context: RequestContext) => {
        const { role } = RoleGrantsSchema.parse(params);

        // Check if role exists first (roles are locked accounts with empty auth string)
        const checkResult = await adapter.executeQuery(
          `SELECT 1 FROM mysql.user WHERE User = ? AND account_locked = 'Y' AND password_expired = 'Y' AND authentication_string = ''`,
          [role],
        );
        if (!checkResult.rows || checkResult.rows.length === 0) {
          return { role, grants: [], exists: false };
        }

        // SHOW GRANTS cannot be always prepared
        const result = await adapter.rawQuery(`SHOW GRANTS FOR '${role}'`);
        const grants = (result.rows ?? []).map((r) => Object.values(r)[0]);
        return { role, grants, exists: true };
      },
    },
    {
      name: "mysql_role_grant",
      title: "MySQL Grant to Role",
      description: "Grant privileges to a role.",
      group: "roles",
      inputSchema: RoleGrantPrivilegeSchema,
      requiredScopes: ["admin"],
      annotations: { readOnlyHint: false },
      handler: async (params: unknown, _context: RequestContext) => {
        const { role, privileges, database, table } =
          RoleGrantPrivilegeSchema.parse(params);
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(role))
          throw new Error("Invalid role name");

        // Check if role exists first
        const checkResult = await adapter.executeQuery(
          `SELECT 1 FROM mysql.user WHERE User = ? AND account_locked = 'Y' AND password_expired = 'Y' AND authentication_string = ''`,
          [role],
        );
        if (!checkResult.rows || checkResult.rows.length === 0) {
          return {
            success: false,
            role,
            exists: false,
            error: "Role does not exist",
          };
        }

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

        const db = targetDb === "*" ? "*" : `\`${targetDb}\``;
        const tbl = targetTable === "*" ? "*" : `\`${targetTable}\``;

        let onClause = `${db}.${tbl}`;
        if (targetDb === "*" && targetTable !== "*") {
          // Cannot use * for db with specific table (MySQL syntax error)
          // Assume current database if table is specified but db is wildcard
          onClause = tbl;
        }

        try {
          await adapter.rawQuery(
            `GRANT ${privileges.join(", ")} ON ${onClause} TO '${role}'`,
          );
          return {
            success: true,
            role,
            privileges,
            database: targetDb,
            table: targetTable,
          };
        } catch (error: unknown) {
          const rawMessage =
            error instanceof Error ? error.message : String(error);
          if (rawMessage.includes("doesn't exist")) {
            // Strip adapter prefix (e.g. "Raw query failed: Query failed: ") for clean output
            const cleanMessage = rawMessage
              .replace(/^Raw query failed:\s*/i, "")
              .replace(/^Query failed:\s*/i, "");
            return {
              success: false,
              role,
              error: cleanMessage,
            };
          }
          throw error;
        }
      },
    },
    {
      name: "mysql_role_assign",
      title: "MySQL Assign Role",
      description: "Assign a role to a user.",
      group: "roles",
      inputSchema: RoleAssignSchema,
      requiredScopes: ["admin"],
      annotations: { readOnlyHint: false },
      handler: async (params: unknown, _context: RequestContext) => {
        const { role, user, host, withAdminOption } =
          RoleAssignSchema.parse(params);

        // Check if role exists first
        const checkResult = await adapter.executeQuery(
          `SELECT 1 FROM mysql.user WHERE User = ? AND account_locked = 'Y' AND password_expired = 'Y' AND authentication_string = ''`,
          [role],
        );
        if (!checkResult.rows || checkResult.rows.length === 0) {
          return {
            success: false,
            role,
            user,
            host,
            exists: false,
            error: "Role does not exist",
          };
        }

        let sql = `GRANT '${role}' TO '${user}'@'${host}'`;
        if (withAdminOption) sql += " WITH ADMIN OPTION";
        try {
          await adapter.rawQuery(sql);
          await adapter.rawQuery(
            `SET DEFAULT ROLE '${role}' TO '${user}'@'${host}'`,
          );
          return { success: true, role, user, host };
        } catch (error: unknown) {
          const message =
            error instanceof Error ? error.message : String(error);
          if (message.includes("Unknown authorization ID")) {
            return {
              success: false,
              role,
              user,
              host,
              error: "User does not exist",
            };
          }
          throw error;
        }
      },
    },
    {
      name: "mysql_role_revoke",
      title: "MySQL Revoke Role",
      description: "Revoke a role from a user.",
      group: "roles",
      inputSchema: RoleRevokeSchema,
      requiredScopes: ["admin"],
      annotations: { readOnlyHint: false },
      handler: async (params: unknown, _context: RequestContext) => {
        const { role, user, host } = RoleRevokeSchema.parse(params);

        // Check if role exists first
        const checkResult = await adapter.executeQuery(
          `SELECT 1 FROM mysql.user WHERE User = ? AND account_locked = 'Y' AND password_expired = 'Y' AND authentication_string = ''`,
          [role],
        );
        if (!checkResult.rows || checkResult.rows.length === 0) {
          return {
            success: false,
            role,
            user,
            host,
            exists: false,
            error: "Role does not exist",
          };
        }

        // Check if the role is actually assigned to this user
        const assignCheck = await adapter.executeQuery(
          `SELECT 1 FROM mysql.role_edges WHERE FROM_USER = ? AND FROM_HOST = '%' AND TO_USER = ? AND TO_HOST = ?`,
          [role, user, host],
        );
        if (!assignCheck.rows || assignCheck.rows.length === 0) {
          return {
            success: false,
            role,
            user,
            host,
            reason: `Role '${role}' is not assigned to user '${user}'@'${host}'`,
          };
        }

        try {
          await adapter.rawQuery(`REVOKE '${role}' FROM '${user}'@'${host}'`);
          return { success: true, role, user, host };
        } catch (error: unknown) {
          const message =
            error instanceof Error ? error.message : String(error);
          if (message.includes("Unknown authorization ID")) {
            return {
              success: false,
              role,
              user,
              host,
              error: "User does not exist",
            };
          }
          throw error;
        }
      },
    },
    {
      name: "mysql_user_roles",
      title: "MySQL User Roles",
      description: "List roles assigned to a user.",
      group: "roles",
      inputSchema: UserRolesSchema,
      requiredScopes: ["read"],
      annotations: { readOnlyHint: true, idempotentHint: true },
      handler: async (params: unknown, _context: RequestContext) => {
        const { user, host } = UserRolesSchema.parse(params);

        // P154: Check if user exists
        const userCheck = await adapter.executeQuery(
          `SELECT 1 FROM mysql.user WHERE User = ? AND Host = ?`,
          [user, host],
        );
        if (!userCheck.rows || userCheck.rows.length === 0) {
          return { user, host, exists: false };
        }

        const result = await adapter.executeQuery(
          `SELECT FROM_USER as roleName, FROM_HOST as roleHost, WITH_ADMIN_OPTION as admin
                     FROM mysql.role_edges WHERE TO_USER=? AND TO_HOST=?`,
          [user, host],
        );
        return { user, host, roles: result.rows ?? [] };
      },
    },
  ];
}
