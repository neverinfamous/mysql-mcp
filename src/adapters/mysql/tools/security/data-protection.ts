/**
 * MySQL Security - Data Protection Tools
 *
 * Tools for data masking, privilege management, and sensitive data identification.
 */

import { z, ZodError } from "zod";
import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "../core/error-helpers.js";
import {
  SecurityMaskDataOutputSchema,
  SecurityUserPrivilegesOutputSchema,
  SecuritySensitiveTablesOutputSchema,
} from "../../schemas/security.js";
import type { MySQLAdapter } from "../../mysql-adapter/index.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import { ValidationError } from "../../../../types/modules/errors.js";
import { READ_ONLY } from "../../../../utils/annotations.js";

// =============================================================================
// Helpers
// =============================================================================

// =============================================================================
// Zod Schemas
// =============================================================================

const MaskDataSchemaBase = z.object({
  value: z.string().describe("Value to mask"),
  data: z.string().optional().describe("Alias for value"),
  text: z.string().optional().describe("Alias for value"),
  input: z.string().optional().describe("Alias for value"),
  type: z.enum(["email", "phone", "ssn", "credit_card", "partial"]).describe("Masking type. Note: Must be one of: 'email', 'phone', 'ssn', 'credit_card', 'partial'."),
  keepFirst: z.number().optional().describe("Characters to keep from start"),
  keepLast: z.number().optional().describe("Characters to keep from end"),
  maskChar: z.string().optional().describe("Character to use for masking"),
});

const MaskDataSchema = z.preprocess(
  (val: unknown) => {
    if (typeof val !== "object" || val === null) return val;
    const obj = val as Record<string, unknown>;
    if (!("value" in obj)) {
      if ("data" in obj) return { ...obj, value: obj["data"] };
      if ("text" in obj) return { ...obj, value: obj["text"] };
      if ("input" in obj) return { ...obj, value: obj["input"] };
    }
    return val;
  },
  z.object({
    value: z.string(),
    type: z.enum(["email", "phone", "ssn", "credit_card", "partial"]),
    keepFirst: z.coerce.number().default(0),
    keepLast: z.coerce.number().default(0),
    maskChar: z.string().default("*"),
  })
);

const UserPrivilegesSchemaBase = z.object({
  user: z.string().optional().describe("Filter by username"),
  userName: z.string().optional().describe("Alias for user"),
  username: z.string().optional().describe("Alias for user"),
  host: z.string().optional().describe("Host pattern"),
  includeRoles: z.boolean().optional().describe("Include role grants"),
  summary: z
    .boolean()
    .optional()
    .describe(
      "Return condensed summary (privilege counts) instead of raw GRANT strings",
    ),
});

const UserPrivilegesSchema = z.preprocess(
  (val: unknown) => {
    if (typeof val !== "object" || val === null) return val;
    const obj = val as Record<string, unknown>;
    if (!("user" in obj)) {
      if ("userName" in obj) {
        return { ...obj, user: obj["userName"] };
      } else if ("username" in obj) {
        return { ...obj, user: obj["username"] };
      }
    }
    return val;
  },
  z.object({
    user: z.string().default(""),
    host: z.string().default("%"),
    includeRoles: z.boolean().default(true),
    summary: z.boolean().default(false),
  })
);

const SensitiveTablesSchemaBase = z.object({
  schema: z
    .string()
    .optional()
    .describe("Schema to scan (defaults to current database)"),
  database: z.string().optional().describe("Alias for schema"),
  db: z.string().optional().describe("Alias for schema"),
  table: z.string().optional().describe("Anti-hallucination hint: This scans a schema, not a single table. Alias for schema"),
  tableName: z.string().optional().describe("Anti-hallucination hint: This scans a schema, not a single table. Alias for schema"),
  patterns: z
    .array(z.string())
    .optional()
    .describe("Column name patterns to consider sensitive"),
  limit: z
    .number()
    .optional()
    .describe(
      "Maximum number of tables to return (default: 20). Set higher for full scan.",
    ),
});

const SensitiveTablesSchema = z
  .preprocess(
    (val: unknown) => {
      if (typeof val !== "object" || val === null) return val;
      const obj = val as Record<string, unknown>;
      if (!("schema" in obj)) {
        if ("database" in obj) {
          return { ...obj, schema: obj["database"] };
        } else if ("db" in obj) {
          return { ...obj, schema: obj["db"] };
        } else if ("table" in obj) {
          return { ...obj, schema: obj["table"] };
        } else if ("tableName" in obj) {
          return { ...obj, schema: obj["tableName"] };
        }
      }
      return val;
    },
    z.object({
      schema: z.string().default(""),
      database: z.string().default(""),
      patterns: z
        .array(z.string())
        .default([
          "password",
          "secret",
          "token",
          "key",
          "ssn",
          "credit",
          "card",
          "phone",
          "email",
          "address",
          "salary",
          "medical",
          "health",
        ]),
      limit: z.number().int().positive().optional().default(20),
    }),
  )
  .transform((data) => ({
    schema: data.schema ?? data.database,
    patterns: data.patterns,
    limit: data.limit,
  }));

// =============================================================================
// Tool Creation Functions
// =============================================================================

/**
 * Mask sensitive data
 */
export function createSecurityMaskDataTool(
  _adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_security_mask_data",
    title: "MySQL Data Masking",
    description:
      "Apply data masking to sensitive values (implementation for Community Edition).",
    group: "security",
    inputSchema: MaskDataSchemaBase,
    outputSchema: SecurityMaskDataOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: (params: unknown, _context: RequestContext): Promise<unknown> => {
      try {
        const { value, type, keepFirst, keepLast, maskChar } =
          MaskDataSchema.parse(params);

        let maskedValue: string;

        switch (type) {
          case "email": {
            const atIndex = value.indexOf("@");
            if (atIndex > 0) {
              const localPart = value.substring(0, atIndex);
              const domain = value.substring(atIndex);
              const maskedLocal =
                localPart.length > 2
                  ? localPart[0] +
                    maskChar.repeat(localPart.length - 2) +
                    localPart[localPart.length - 1]
                  : maskChar.repeat(localPart.length);
              maskedValue = maskedLocal + domain;
            } else {
              maskedValue = maskChar.repeat(value.length);
            }
            break;
          }
          case "phone": {
            // Keep last 4 digits, mask rest
            const digits = value.replace(/\D/g, "");
            maskedValue =
              maskChar.repeat(Math.max(0, digits.length - 4)) +
              digits.slice(-4);
            break;
          }
          case "ssn": {
            // Show only last 4
            const ssnDigits = value.replace(/\D/g, "");
            maskedValue = `${maskChar}${maskChar}${maskChar}-${maskChar}${maskChar}-${ssnDigits.slice(-4)}`;
            break;
          }
          case "credit_card": {
            // Show first 4 and last 4
            const ccDigits = value.replace(/\D/g, "");
            if (ccDigits.length <= 8) {
              return Promise.resolve(
                withTokenEstimate({
                  success: true,
                  data: {
                    original: value,
                    masked: maskChar.repeat(value.length),
                    type,
                    warning:
                      "Value too short for credit_card format (expected more than 8 digits); fully masked instead",
                  },
                }),
              );
            }
            maskedValue =
              ccDigits.slice(0, 4) +
              maskChar.repeat(Math.max(0, ccDigits.length - 8)) +
              ccDigits.slice(-4);
            break;
          }
          case "partial": {
            // When keepFirst + keepLast covers the entire value, return unchanged with warning
            if (keepFirst + keepLast >= value.length) {
              return Promise.resolve(
                withTokenEstimate({
                  success: true,
                  data: {
                    original: value,
                    masked: value,
                    type,
                    warning:
                      "Masking ineffective: keepFirst + keepLast covers entire value length; returned unchanged",
                  },
                }),
              );
            } else {
              const maskLength = value.length - keepFirst - keepLast;
              maskedValue =
                value.slice(0, keepFirst) +
                maskChar.repeat(maskLength) +
                (keepLast > 0 ? value.slice(-keepLast) : "");
            }
            break;
          }
          default:
            maskedValue = maskChar.repeat(value.length);
        }

        return Promise.resolve(
          withTokenEstimate({
            success: true,
            data: {
              original: value,
              masked: maskedValue,
              type,
            },
          }),
        );
      } catch (error) {
        if (error instanceof ZodError) {
          return Promise.resolve(formatHandlerErrorResponse(error));
        }
        return Promise.resolve(formatHandlerErrorResponse(error));
      }
    },
  };
}

/**
 * Get comprehensive user privileges
 */
export function createSecurityUserPrivilegesTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_security_user_privileges",
    title: "MySQL User Privileges",
    description: "Get comprehensive privilege report for users.",
    group: "security",
    inputSchema: UserPrivilegesSchemaBase,
    outputSchema: SecurityUserPrivilegesOutputSchema,
    requiredScopes: ["admin"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { user, host, includeRoles, summary } =
          UserPrivilegesSchema.parse(params);

        if (!user) {
          return formatHandlerErrorResponse(
            new ValidationError("Parameter 'user' (or 'userName') is required to prevent payload bloat.")
          );
        }
        // P154: User existence check when explicitly provided
        if (user) {
          const userCheck = await adapter.executeQuery(
            "SELECT User FROM mysql.user WHERE User = ? LIMIT 1",
            [user],
          );
          if (!userCheck.rows || userCheck.rows.length === 0) {
            return formatHandlerErrorResponse(
              new ValidationError(`User '${user}' does not exist.`),
            );
          }
        }

        // Get users
        let usersQuery = `
                SELECT User, Host,
                       plugin AS authPlugin,
                       account_locked AS accountLocked,
                       password_expired AS passwordExpired,
                       password_lifetime AS passwordLifetime,
                       max_connections AS maxConnections,
                       max_user_connections AS maxUserConnections
                FROM mysql.user
            `;

        const conditions: string[] = [];
        const queryParams: unknown[] = [];

        if (user) {
          conditions.push("User = ?");
          queryParams.push(user);
        }
        if (host !== "%") {
          conditions.push("Host = ?");
          queryParams.push(host);
        }

        if (conditions.length > 0) {
          usersQuery += " WHERE " + conditions.join(" AND ");
        }

        const usersResult = await adapter.executeQuery(usersQuery, queryParams);

        // For each user, get their grants
        const userPrivileges = [];
        for (const userRow of usersResult.rows ?? []) {
          const u = userRow;
          const userName = typeof u["User"] === "string" ? u["User"] : String(u["User"]);
          const userHost = typeof u["Host"] === "string" ? u["Host"] : String(u["Host"]);

          const grantsResult = await adapter.executeQuery(
            `SHOW GRANTS FOR \`${userName}\`@\`${userHost}\``,
          );

          const grants = (grantsResult.rows ?? []).map((r) => {
            const values = Object.values(r);
            return typeof values[0] === "string" ? values[0] : String(values[0]);
          });

          let roles: string[] = [];
          if (includeRoles) {
            try {
              const rolesResult = await adapter.executeQuery(
                `
                            SELECT FROM_USER, FROM_HOST
                            FROM mysql.role_edges
                            WHERE TO_USER = ? AND TO_HOST = ?
                        `,
                [userName, userHost],
              );

              roles = (rolesResult.rows ?? []).map((r) => {
                const fromUser = typeof r["FROM_USER"] === "string" ? r["FROM_USER"] : String(r["FROM_USER"]);
                const fromHost = typeof r["FROM_HOST"] === "string" ? r["FROM_HOST"] : String(r["FROM_HOST"]);
                return `${fromUser}@${fromHost}`;
              });
            } catch {
              // Role edges table might not exist in older versions
            }
          }

          if (summary) {
            // Extract global privileges from GRANT statements
            const globalPrivileges: string[] = [];
            let hasAllPrivileges = false;
            let hasWithGrantOption = false;

            for (const grant of grants) {
              // Check for ALL PRIVILEGES
              if (grant.includes("ALL PRIVILEGES")) {
                hasAllPrivileges = true;
              }
              // Check for WITH GRANT OPTION
              if (grant.includes("WITH GRANT OPTION")) {
                hasWithGrantOption = true;
              }
              // Extract specific privileges from global grants (ON *.*)
              const globalPattern = /GRANT\s+(.+?)\s+ON\s+\*\.\*\s+TO/i;
              const globalMatch = globalPattern.exec(grant);
              if (globalMatch?.[1]) {
                const privs = globalMatch[1].split(",").map((p) => p.trim());
                globalPrivileges.push(...privs);
              }
            }

            const deduped = [...new Set(globalPrivileges)];
            userPrivileges.push({
              user: userName,
              host: userHost,
              authPlugin: u["authPlugin"],
              accountLocked: u["accountLocked"] === "Y",
              passwordExpired: u["passwordExpired"] === "Y",
              grantCount: grants.length,
              roleCount: roles.length,
              hasAllPrivileges,
              hasWithGrantOption,
              globalPrivileges: deduped.slice(0, 10),
              totalGlobalPrivileges: deduped.length,
            });
          } else {
            userPrivileges.push({
              user: userName,
              host: userHost,
              authPlugin: u["authPlugin"],
              accountLocked: u["accountLocked"] === "Y",
              passwordExpired: u["passwordExpired"] === "Y",
              grants,
              roles,
            });
          }
        }

        return withTokenEstimate({
          success: true,
          data: {
            users: userPrivileges,
            count: userPrivileges.length,
            summary,
          },
        });
      } catch (err) {
        return formatHandlerErrorResponse(err);
      }
    },
  };
}

/**
 * Identify tables with potentially sensitive data
 */
export function createSecuritySensitiveTablesTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_security_sensitive_tables",
    title: "MySQL Sensitive Tables",
    description: "Identify tables and columns that may contain sensitive data.",
    group: "security",
    inputSchema: SensitiveTablesSchemaBase,
    outputSchema: SecuritySensitiveTablesOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { schema, patterns, limit } = SensitiveTablesSchema.parse(params);

        if (!schema) {
          return formatHandlerErrorResponse(
            new ValidationError("Parameter 'schema' (or 'database') is required to prevent payload bloat.")
          );
        }
        // P154: Schema existence check when explicitly provided
        if (schema) {
          const schemaCheck = await adapter.executeQuery(
            "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?",
            [schema],
          );
          if (!schemaCheck.rows || schemaCheck.rows.length === 0) {
            return formatHandlerErrorResponse(
              new ValidationError(`Schema '${schema}' does not exist.`),
            );
          }
        }

        // Build pattern conditions
        const patternConditions = patterns
          .map(() => "COLUMN_NAME LIKE ?")
          .join(" OR ");
        const patternParams = patterns.map((p) => `%${p}%`);

        // Build schema condition - use explicit schema if provided, otherwise DATABASE()
        const schemaCondition = schema
          ? "TABLE_SCHEMA = ?"
          : "TABLE_SCHEMA = DATABASE()";
        const schemaParams = schema ? [schema] : [];

        const query = `
                SELECT
                    TABLE_NAME AS tableName,
                    COLUMN_NAME AS columnName,
                    DATA_TYPE AS dataType,
                    COLUMN_TYPE AS columnType,
                    IS_NULLABLE AS nullable,
                    COLUMN_COMMENT AS comment
                FROM information_schema.COLUMNS
                WHERE ${schemaCondition}
                  AND (${patternConditions})
                ORDER BY TABLE_NAME, COLUMN_NAME
            `;

        const result = await adapter.executeQuery(query, [
          ...schemaParams,
          ...patternParams,
        ]);

        // Group by table
        const tableMap = new Map<string, Record<string, unknown>[]>();
        for (const row of result.rows ?? []) {
          const r = row;
          const tableName = typeof r["tableName"] === "string" ? r["tableName"] : String(r["tableName"]);
          if (!tableMap.has(tableName)) {
            tableMap.set(tableName, []);
          }
          tableMap.get(tableName)?.push(r);
        }

        const allItems = Array.from(tableMap.entries()).map(
          ([table, columns]) => ({
            table,
            sensitiveColumns: columns,
            columnCount: columns.length,
          }),
        );

        const totalAvailable = allItems.length;
        const limited = totalAvailable > limit;
        const sensitiveItems = limited ? allItems.slice(0, limit) : allItems;

        return withTokenEstimate({
          success: true,
          data: {
            sensitiveTables: sensitiveItems,
            tableCount: sensitiveItems.length,
            totalSensitiveColumns: result.rows?.length ?? 0,
            patternsUsed: patterns,
            ...(limited ? { limited: true, totalAvailable } : {}),
          },
        });
      } catch (err) {
        return formatHandlerErrorResponse(err);
      }
    },
  };
}
