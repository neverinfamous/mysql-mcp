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
import { format } from "mysql2";

// =============================================================================
// Helpers
// =============================================================================

// =============================================================================
// Zod Schemas
// =============================================================================

const MaskDataSchemaBase = z.object({
  value: z.unknown().optional().describe("Value to mask"),
  data: z.unknown().optional().describe("Alias for value"),
  text: z.unknown().optional().describe("Alias for value"),
  input: z.unknown().optional().describe("Alias for value"),
  type: z.unknown().optional().describe("Masking type. Note: Must be one of: 'email', 'phone', 'ssn', 'credit_card', 'partial'."),
  maskType: z.unknown().optional().describe("Alias for type"),
  keepFirst: z.unknown().optional().describe("Characters to keep from start"),
  keepLast: z.unknown().optional().describe("Characters to keep from end"),
  maskChar: z.unknown().optional().describe("Character to use for masking"),
});

const MaskDataSchema = z.preprocess(
  (val: unknown) => {
    if (typeof val !== "object" || val === null) return val;
    const obj = { ...(val as Record<string, unknown>) };
    if (!("value" in obj)) {
      if ("data" in obj) obj["value"] = obj["data"];
      else if ("text" in obj) obj["value"] = obj["text"];
      else if ("input" in obj) obj["value"] = obj["input"];
    }
    if (!("type" in obj) && "maskType" in obj) {
      obj["type"] = obj["maskType"];
    }
    if (typeof obj["type"] === "string") {
      let t = obj["type"].toLowerCase().replace(/[\s-_]/g, "");
      if (t === "cc" || t === "creditcard" || t === "card" || t === "pan") t = "credit_card";
      else if (t === "social" || t === "socialsecurity" || t === "sin" || t === "nin") t = "ssn";
      else if (t === "mail" || t === "e_mail") t = "email";
      else if (t === "telephone" || t === "cell" || t === "mobile") t = "phone";
      obj["type"] = t;
    }
    return obj;
  },
  z.object({
    value: z.union([z.string(), z.number()]).transform(String),
    type: z.enum(["email", "phone", "ssn", "credit_card", "partial"]),
    keepFirst: z.coerce.number().int().min(0).default(0),
    keepLast: z.coerce.number().int().min(0).default(0),
    maskChar: z.string().length(1, "maskChar must be a single character").default("*"),
  })
);

const UserPrivilegesSchemaBase = z.object({
  user: z.unknown().optional().describe("Filter by username. Required to prevent payload bloat."),
  userName: z.unknown().optional().describe("Alias for user"),
  username: z.unknown().optional().describe("Alias for user"),
  name: z.unknown().optional().describe("Alias for user"),
  host: z.unknown().optional().describe("Host pattern"),
  includeRoles: z.unknown().optional().describe("Include role grants"),
  summary: z.unknown().optional().describe("Return condensed summary (privilege counts) instead of raw GRANT strings"),
  format: z.unknown().optional().describe("Alias for summary: 'summary' or 'full'"),
});

const UserPrivilegesSchema = z.preprocess(
  (val: unknown) => {
    if (typeof val !== "object" || val === null) return val;
    const obj = val as Record<string, unknown>;
    let user = obj["user"];
    if (user === undefined || user === null || user === "") {
      if ("userName" in obj) user = obj["userName"];
      else if ("username" in obj) user = obj["username"];
      else if ("name" in obj) user = obj["name"];
    }
    
    if (Array.isArray(user) && user.length > 0) user = String(user[0]);
    else if (typeof user === "object" && user !== null) user = JSON.stringify(user);
    else if (typeof user === "string" && user.includes("@")) {
      const parts = user.split("@");
      user = parts[0];
      if (obj["host"] === undefined) {
        obj["host"] = parts.slice(1).join("@");
      }
    }
    
    let summary = obj["summary"];
    if (summary === undefined && "format" in obj) {
      summary = obj["format"] === "summary";
    }

    let includeRoles = obj["includeRoles"];
    if (typeof includeRoles === "string") {
      includeRoles = includeRoles.toLowerCase() === "true";
    }
    if (typeof summary === "string") {
      summary = summary.toLowerCase() === "true";
    }

    return { ...obj, user, summary, includeRoles };
  },
  z.object({
    user: z.coerce.string().default(""),
    host: z.coerce.string().default("%"),
    includeRoles: z.boolean().default(true),
    summary: z.boolean().default(false),
  })
);

const SensitiveTablesSchemaBase = z.object({
  schema: z.unknown().optional().describe("Schema to scan. Required to prevent payload bloat."),
  database: z.unknown().optional().describe("Alias for schema"),
  db: z.unknown().optional().describe("Alias for schema"),
  table: z.unknown().optional().describe("Anti-hallucination hint: This scans a schema, not a single table. Alias for schema"),
  tableName: z.unknown().optional().describe("Anti-hallucination hint: This scans a schema, not a single table. Alias for schema"),
  patterns: z.unknown().optional().describe("Column name patterns to consider sensitive"),
  limit: z.unknown().optional().describe("Maximum number of tables to return (default: 20). Set higher for full scan."),
});

const SensitiveTablesSchema = z
  .preprocess(
    (val: unknown) => {
      if (typeof val !== "object" || val === null) return val;
      const obj = val as Record<string, unknown>;
      let schema = obj["schema"];
      if (!("schema" in obj)) {
        if ("database" in obj) {
          schema = obj["database"];
        } else if ("db" in obj) {
          schema = obj["db"];
        } else if ("table" in obj) {
          schema = obj["table"];
        } else if ("tableName" in obj) {
          schema = obj["tableName"];
        }
      }
      
      if (Array.isArray(schema) && schema.length > 0) schema = String(schema[0]);
      else if (typeof schema === "object" && schema !== null) schema = JSON.stringify(schema);
      
      let patterns = obj["patterns"];
      if (typeof patterns === "string") {
        patterns = [patterns];
      }
      
      return { ...obj, schema, patterns };
    },
    z.object({
      schema: z.coerce.string().default(""),
      database: z.coerce.string().default(""),
      patterns: z
        .array(z.coerce.string().min(2, "Pattern must be at least 2 characters long"))
        .min(1, "At least one pattern must be provided")
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
      limit: z.coerce.number().int().positive().max(100).optional().default(20),
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
            if (digits.length <= 4) {
              return Promise.resolve(
                withTokenEstimate({
                  success: true,
                  data: {
                    original: value,
                    masked: maskChar.repeat(value.length),
                    type,
                    warning:
                      "Value too short for phone format (expected more than 4 digits); fully masked instead",
                  },
                }),
              );
            }
            let digitsToMask = digits.length - 4;
            maskedValue = value.replace(/\d/g, (match) => {
              if (digitsToMask > 0) {
                digitsToMask--;
                return maskChar;
              }
              return match;
            });
            break;
          }
          case "ssn": {
            // Show only last 4
            const ssnDigits = value.replace(/\D/g, "");
            if (ssnDigits.length < 9) {
              return Promise.resolve(
                withTokenEstimate({
                  success: true,
                  data: {
                    original: value,
                    masked: maskChar.repeat(value.length),
                    type,
                    warning:
                      "Value too short for ssn format (expected at least 9 digits); fully masked instead",
                  },
                }),
              );
            }
            let digitsToMask = ssnDigits.length - 4;
            maskedValue = value.replace(/\d/g, (match) => {
              if (digitsToMask > 0) {
                digitsToMask--;
                return maskChar;
              }
              return match;
            });
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
            let firstKept = 0;
            let digitsToMask = ccDigits.length - 8;
            maskedValue = value.replace(/\d/g, (match) => {
              if (firstKept < 4) {
                firstKept++;
                return match;
              }
              if (digitsToMask > 0) {
                digitsToMask--;
                return maskChar;
              }
              return match;
            });
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
          return Promise.resolve(formatHandlerErrorResponse(error, { module: "security", tool: "mysql_security_mask_data" }));
        }
        return Promise.resolve(formatHandlerErrorResponse(error, { module: "security", tool: "mysql_security_mask_data" }));
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
            new ValidationError("Parameter 'user' (or 'userName') is required to prevent payload bloat."),
            { module: "security", tool: "mysql_security_user_privileges" }
          );
        }
        // P154: User existence check when explicitly provided
        const userCheck = await adapter.rawQuery(
          format("/* mcp-force-write */ SELECT User FROM mysql.user WHERE User = ? LIMIT 1", [user])
        );
          if (!userCheck.rows || userCheck.rows.length === 0) {
            return formatHandlerErrorResponse(
              new ValidationError(`User '${user}' does not exist.`),
              { module: "security", tool: "mysql_security_user_privileges" }
            );
          }

          // Get users
          let usersQuery = `
                  /* mcp-force-write */ SELECT User, Host,
                         plugin AS authPlugin,
                         account_locked AS accountLocked,
                         password_expired AS passwordExpired,
                         password_lifetime AS passwordLifetime,
                         max_connections AS maxConnections,
                         max_user_connections AS maxUserConnections
                  FROM mysql.user
              `;

          const conditions: string[] = [];
          const queryParams: string[] = [];

          conditions.push("User = ?");
          queryParams.push(user);
          
          if (host !== "%") {
            conditions.push("Host = ?");
            queryParams.push(host);
          }

          if (conditions.length > 0) {
            usersQuery += " WHERE " + conditions.join(" AND ");
          }

          const usersResult = await adapter.rawQuery(format(usersQuery, queryParams));

          // For each user, get their grants (executed in batches to avoid N+1 bottleneck)
          const userPrivileges: Record<string, unknown>[] = [];
          const userRows = usersResult.rows ?? [];
          const BATCH_SIZE = 10;
          
          for (let i = 0; i < userRows.length; i += BATCH_SIZE) {
            const chunk = userRows.slice(i, i + BATCH_SIZE);
            
            // Pre-fetch roles for the chunk to avoid N+1 queries
            const roleMap = new Map<string, string[]>();
            if (includeRoles && chunk.length > 0) {
              try {
                const roleConditions: string[] = [];
                const roleParams: string[] = [];
                
                for (const u of chunk) {
                  const userName = typeof u["User"] === "string" ? u["User"] : String(u["User"]);
                  const userHost = typeof u["Host"] === "string" ? u["Host"] : String(u["Host"]);
                  roleConditions.push("(TO_USER = ? AND TO_HOST = ?)");
                  roleParams.push(userName, userHost);
                }
                
                const rolesResult = await adapter.rawQuery(
                  format(`
                    /* mcp-force-write */ SELECT TO_USER, TO_HOST, FROM_USER, FROM_HOST
                    FROM mysql.role_edges
                    WHERE ${roleConditions.join(" OR ")}
                  `,
                  roleParams)
                );
                
                for (const r of rolesResult.rows ?? []) {
                  const toUser = typeof r["TO_USER"] === "string" ? r["TO_USER"] : String(r["TO_USER"]);
                  const toHost = typeof r["TO_HOST"] === "string" ? r["TO_HOST"] : String(r["TO_HOST"]);
                  const fromUser = typeof r["FROM_USER"] === "string" ? r["FROM_USER"] : String(r["FROM_USER"]);
                  const fromHost = typeof r["FROM_HOST"] === "string" ? r["FROM_HOST"] : String(r["FROM_HOST"]);
                  
                  const key = `${toUser}@${toHost}`;
                  const roleList = roleMap.get(key) ?? [];
                  roleList.push(`${fromUser}@${fromHost}`);
                  roleMap.set(key, roleList);
                }
              } catch {
                // Role edges table might not exist in older versions
              }
            }
            
            const chunkResults = await Promise.all(chunk.map(async (userRow) => {
              const u = userRow;
              const userName = typeof u["User"] === "string" ? u["User"] : String(u["User"]);
              const userHost = typeof u["Host"] === "string" ? u["Host"] : String(u["Host"]);
              const escapedUserName = userName.replace(/`/g, '``');
              const escapedUserHost = userHost.replace(/`/g, '``');
    
              const grantsResult = await adapter.rawQuery(
                `SHOW GRANTS FOR \`${escapedUserName}\`@\`${escapedUserHost}\``
              );
    
              const grants = (grantsResult.rows ?? []).map((r) => {
                const values = Object.values(r);
                return typeof values[0] === "string" ? values[0] : String(values[0]);
              });
    
              let roles: string[] = [];
              if (includeRoles) {
                roles = roleMap.get(`${userName}@${userHost}`) ?? [];
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
              return {
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
              };
            } else {
              return {
                user: userName,
                host: userHost,
                authPlugin: u["authPlugin"],
                accountLocked: u["accountLocked"] === "Y",
                passwordExpired: u["passwordExpired"] === "Y",
                grants,
                roles,
              };
            }
          }));
          
          userPrivileges.push(...chunkResults);
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
        return formatHandlerErrorResponse(err, { module: "security", tool: "mysql_security_user_privileges" });
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
            new ValidationError("Parameter 'schema' (or 'database') is required to prevent payload bloat."),
            { module: "security", tool: "mysql_security_sensitive_tables" }
          );
        }
        const schemaCheck = await adapter.rawQuery(
          format("/* mcp-force-write */ SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?", [schema])
        );
          if (!schemaCheck.rows || schemaCheck.rows.length === 0) {
            return formatHandlerErrorResponse(
              new ValidationError(`Schema '${schema}' does not exist.`),
              { module: "security", tool: "mysql_security_sensitive_tables" }
            );
          }

        // Build pattern conditions
        const patternConditions = patterns
          .map(() => "COLUMN_NAME LIKE ?")
          .join(" OR ");
        const patternParams = patterns.map((p) => `%${p}%`);

        // Build schema condition - use explicit schema if provided
        const schemaCondition = "TABLE_SCHEMA = ?";
        const schemaParams = [schema];

        const query = `
                /* mcp-force-write */ SELECT
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

        const result = await adapter.rawQuery(format(query, [
          ...schemaParams,
          ...patternParams,
        ]));

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

        const tokenResult = withTokenEstimate({
          success: true,
          data: {
            sensitiveTables: sensitiveItems,
            tableCount: sensitiveItems.length,
            totalSensitiveColumns: result.rows?.length ?? 0,
            patternsUsed: patterns,
            ...(limited ? { limited: true, totalAvailable } : {}),
          },
        });
        return tokenResult;
      } catch (err) {
        return formatHandlerErrorResponse(err, { module: "security", tool: "mysql_security_sensitive_tables" });
      }
    },
  };
}
