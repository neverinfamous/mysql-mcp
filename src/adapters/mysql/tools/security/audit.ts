/**
 * MySQL Security - Audit and Firewall Tools
 *
 * Tools for security auditing, firewall monitoring, and compliance.
 */

import { z, ZodError } from "zod";
import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "../core/error-helpers.js";
import {
  SecurityAuditOutputSchema,
  SecurityFirewallStatusOutputSchema,
  SecurityFirewallRulesOutputSchema,
} from "../../schemas/security.js";
import type { MySQLAdapter } from "../../mysql-adapter/index.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import { READ_ONLY } from "../../../../utils/annotations.js";
import { ExtensionNotAvailableError } from "../../../../types/modules/errors.js";

// =============================================================================
// Helpers
// =============================================================================

// =============================================================================
// Zod Schemas
// ============================================================================

const AuditLogSchemaBase = z.object({
  limit: z.unknown().optional().describe("Maximum number of records"),
  count: z.unknown().optional().describe("Alias for limit"),
  user: z.unknown().optional().describe("Filter by username"),
  userName: z.unknown().optional().describe("Alias for user"),
  username: z.unknown().optional().describe("Alias for user"),
  eventType: z.unknown()
    .optional()
    .describe(
      'Filter by event type (e.g., "Execute", "Ping", "begin"). Uses LIKE matching against performance_schema EVENT_NAME.',
    ),
  event: z.unknown().optional().describe("Alias for eventType"),
  startTime: z.unknown().optional().describe("Start time filter (ISO 8601)"),
  time: z.unknown().optional().describe("Alias for startTime"),
}).loose();

const AuditLogSchema = z.preprocess(
  (val: unknown) => {
    if (typeof val === "object" && val !== null) {
      const v = { ...(val as Record<string, unknown>) };
      if (v["count"] !== undefined) {
        if (v["limit"] === undefined) v["limit"] = v["count"];
        delete v["count"];
      }
      if (v["username"] !== undefined) {
        if (v["user"] === undefined) v["user"] = v["username"];
        delete v["username"];
      }
      if (v["userName"] !== undefined) {
        if (v["user"] === undefined) v["user"] = v["userName"];
        delete v["userName"];
      }
      if (v["event"] !== undefined) {
        if (v["eventType"] === undefined) v["eventType"] = v["event"];
        delete v["event"];
      }
      if (v["time"] !== undefined) {
        if (v["startTime"] === undefined) v["startTime"] = v["time"];
        delete v["time"];
      }
      return v;
    }
    return val;
  },
  z.object({
    limit: z.coerce.number().int().min(1).max(1000).default(5),
    user: z.string().optional(),
    eventType: z.string().optional(),
    startTime: z.string().refine((val) => !isNaN(Date.parse(val)), "Invalid date format").optional(),
  }).strip()
);

const FirewallRulesSchemaBase = z.object({
  limit: z.unknown().optional().describe("Maximum number of records to return"),
  count: z.unknown().optional().describe("Alias for limit"),
  user: z.unknown().optional().describe("Filter by username"),
  userName: z.unknown().optional().describe("Alias for user"),
  username: z.unknown().optional().describe("Alias for user"),
  mode: z.unknown().optional().describe("Filter by mode"),
}).loose();

const FirewallRulesSchema = z.preprocess(
  (val: unknown) => {
    if (typeof val === "object" && val !== null) {
      const v = { ...(val as Record<string, unknown>) };
      if (v["count"] !== undefined) {
        if (v["limit"] === undefined) v["limit"] = v["count"];
        delete v["count"];
      }
      if (v["username"] !== undefined) {
        if (v["user"] === undefined) v["user"] = v["username"];
        delete v["username"];
      }
      if (v["userName"] !== undefined) {
        if (v["user"] === undefined) v["user"] = v["userName"];
        delete v["userName"];
      }
      if (typeof v["mode"] === "string") {
        let m = v["mode"].toUpperCase();
        if (m === "BLOCK" || m === "DENY" || m === "ON") m = "PROTECTING";
        else if (m === "LOG" || m === "WARN" || m === "WARNING") m = "DETECTING";
        else if (m === "LEARNING" || m === "RECORD") m = "RECORDING";
        else if (m === "DISABLED" || m === "NONE") m = "OFF";
        v["mode"] = m;
      }
      return v;
    }
    return val;
  },
  z.object({
    limit: z.coerce.number().int().min(1).max(1000).default(50),
    user: z.string().optional(),
    mode: z.enum(["RECORDING", "PROTECTING", "DETECTING", "OFF"]).optional(),
  }).strip()
);

// =============================================================================
// Tool Creation Functions
// =============================================================================

/**
 * Query audit log
 */
export function createSecurityAuditTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_security_audit",
    title: "MySQL Security Audit Log",
    description:
      "Query the MySQL audit log (requires Enterprise Audit or compatible plugin).",
    group: "security",
    inputSchema: AuditLogSchemaBase,
    outputSchema: SecurityAuditOutputSchema,
    requiredScopes: ["admin"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      // First check if audit log table exists
      try {
        const { limit, user, eventType, startTime } =
          AuditLogSchema.parse(params);
          
        
        const checkResult = await adapter.executeQuery(`
                    SHOW TABLES IN mysql LIKE 'audit_log'
                `);

        if (!checkResult.rows || checkResult.rows.length === 0) {
          // Try performance_schema alternative
          let query = `
                        SELECT
                            e.EVENT_NAME AS event,
                            e.OBJECT_TYPE AS objectType,
                            e.OBJECT_NAME AS objectName,
                            t.PROCESSLIST_USER AS user,
                            t.PROCESSLIST_HOST AS host,
                            e.TIMER_START AS startTime
                        FROM performance_schema.events_statements_history e
                        JOIN performance_schema.threads t
                          ON e.THREAD_ID = t.THREAD_ID
                    `;

          const conditions: string[] = [];
          const filtersApplied: string[] = [];
          const filtersIgnored: string[] = [];

          if (user) {
            // Safe: escape backslashes and single quotes in user input for LIKE clause
            const escaped = user.replace(/\\/g, "\\\\").replace(/'/g, "''");
            conditions.push(`t.PROCESSLIST_USER LIKE '%${escaped}%'`);
            filtersApplied.push("user");
          }
          if (eventType) {
            const escaped = eventType.replace(/\\/g, "\\\\").replace(/'/g, "''");
            conditions.push(`e.EVENT_NAME LIKE '%${escaped}%'`);
            filtersApplied.push("eventType");
          }
          if (startTime) {
            // TIMER_START is a picosecond counter, not an ISO timestamp —
            // this filter is best-effort and unlikely to match user intent.
            filtersIgnored.push("startTime");
          }

          if (conditions.length > 0) {
            query += " WHERE " + conditions.join(" AND ");
          }

          // limit is Zod-validated as z.number(), safe to interpolate.
          // performance_schema does not support prepared statement parameters.
          query += ` ORDER BY e.TIMER_START DESC LIMIT ${limit}`;

          const result = await adapter.executeQuery(query, []);
          const data: Record<string, unknown> = {
            source: "performance_schema",
            message: "Using performance_schema as fallback because audit_log is not available",
            events: result.rows ?? [],
            count: result.rows?.length ?? 0,
          };
          if (filtersIgnored.length > 0) {
            data["filtersIgnored"] = filtersIgnored;
            data["note"] =
              "startTime filter not applied: performance_schema uses picosecond counters, not ISO timestamps";
          }
          return withTokenEstimate({ success: true, data });
        }

        // Query actual audit log
        let query = `
                    SELECT *
                    FROM mysql.audit_log
                `;

        const conditions: string[] = [];
        const queryParams: unknown[] = [];

        if (user) {
          conditions.push("user LIKE ?");
          queryParams.push(`%${user}%`);
        }
        if (eventType) {
          conditions.push("event_type = ?");
          queryParams.push(eventType);
        }
        if (startTime) {
          conditions.push("timestamp >= ?");
          queryParams.push(startTime);
        }

        if (conditions.length > 0) {
          query += " WHERE " + conditions.join(" AND ");
        }

        query += ` ORDER BY timestamp DESC LIMIT ${limit}`;

        const result = await adapter.executeQuery(query, queryParams);
        return withTokenEstimate({
          success: true,
          data: {
            source: "mysql.audit_log",
            events: result.rows ?? [],
            count: result.rows?.length ?? 0,
          },
        });
      } catch (error: unknown) {
        if (error instanceof ZodError) {
          return formatHandlerErrorResponse(error, { module: "security", tool: "mysql_security_audit" });
        }
        if (error instanceof Error) {
          const lower = error.message.toLowerCase();
          if (
            lower.includes("does not exist") ||
            lower.includes("access denied") ||
            lower.includes("er_no_such_table") ||
            lower.includes("proxysql error")
          ) {
            return formatHandlerErrorResponse(
              new ExtensionNotAvailableError("audit_log", { plugin: "MySQL Enterprise Audit or Percona Audit plugin" }),
              { module: "security", tool: "mysql_security_audit" }
            );
          }
        }
        return formatHandlerErrorResponse(error, { module: "security", tool: "mysql_security_audit" });
      }
    },
  };
}

/**
 * Get firewall status
 */
export function createSecurityFirewallStatusTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_security_firewall_status",
    title: "MySQL Firewall Status",
    description: "Get MySQL Enterprise Firewall plugin status.",
    group: "security",
    inputSchema: z.object({}).loose(),
    outputSchema: SecurityFirewallStatusOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        z.object({}).strip().parse(params);

        // Check if firewall plugin is installed
        const pluginResult = await adapter.executeQuery(
          "SELECT PLUGIN_NAME as Name, PLUGIN_STATUS as Status FROM information_schema.PLUGINS WHERE PLUGIN_NAME LIKE ?",
          ["%firewall%"]
        );

        const plugins = (pluginResult.rows ?? []).filter(row => {
          const r = row;
          return typeof r['Name'] === 'string' && !!r['Name'] && r['Name'].toLowerCase().includes('firewall');
        });

        if (plugins.length === 0) {
          return withTokenEstimate({
            success: true,
            data: {
              installed: false,
              message: "MySQL Enterprise Firewall is not installed",
              suggestion:
                'Install with: INSTALL PLUGIN mysql_firewall SONAME "firewall.so"',
            },
          });
        }

        // Get firewall variables
        const varsResult = await adapter.executeQuery(
          "SHOW VARIABLES LIKE 'mysql_firewall%'",
        );

        const variables: Record<string, unknown> = Object.fromEntries(
          (varsResult.rows ?? []).map((row) => {
            const r = row;
            const varName =
              typeof r["Variable_name"] === "string" ? r["Variable_name"] : "";
            return [varName, r["Value"]];
          }),
        );

        return withTokenEstimate({
          success: true,
          data: {
            installed: true,
            plugins: pluginResult.rows,
            configuration: variables,
          },
        });
      } catch (error) {
        if (error instanceof ZodError) {
          return formatHandlerErrorResponse(error, { module: "security", tool: "mysql_security_firewall_status" });
        }
        if (
          error !== null &&
          typeof error === "object" &&
          "message" in error &&
          typeof (error).message === "string"
        ) {
          const messageStr = (error as { message: string }).message;
          const lower = messageStr.toLowerCase();
          if (
            lower.includes("does not exist") ||
            lower.includes("access denied") ||
            lower.includes("er_no_such_table") ||
            lower.includes("proxysql error")
          ) {
            return formatHandlerErrorResponse(
              new ExtensionNotAvailableError("firewall", { plugin: "MySQL Enterprise Firewall" }),
              { module: "security", tool: "mysql_security_firewall_status" }
            );
          }
        }
        return formatHandlerErrorResponse(error, { module: "security", tool: "mysql_security_firewall_status" });
      }
    },
  };
}

/**
 * List firewall rules
 */
export function createSecurityFirewallRulesTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_security_firewall_rules",
    title: "MySQL Firewall Rules",
    description: "List MySQL Enterprise Firewall allowlist rules.",
    group: "security",
    inputSchema: FirewallRulesSchemaBase,
    outputSchema: SecurityFirewallRulesOutputSchema,
    requiredScopes: ["admin"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { limit, user, mode } = FirewallRulesSchema.parse(params);

        // Check if firewall plugin is installed
        const pluginResult = await adapter.executeQuery(
          "SELECT PLUGIN_NAME as Name, PLUGIN_STATUS as Status FROM information_schema.PLUGINS WHERE PLUGIN_NAME LIKE ?",
          ["%firewall%"]
        );

        const plugins = (pluginResult.rows ?? []).filter(row => {
          const r = row;
          return typeof r['Name'] === 'string' && !!r['Name'] && r['Name'].toLowerCase().includes('firewall');
        });

        if (plugins.length === 0) {
          return formatHandlerErrorResponse(
            new ExtensionNotAvailableError("firewall", { plugin: "MySQL Enterprise Firewall" }),
            { module: "security", tool: "mysql_security_firewall_rules" }
          );
        }

        // Get firewall users
        let usersQuery = `
                    SELECT USERHOST, MODE
                    FROM mysql.firewall_users
                `;

        const conditions: string[] = [];
        const queryParams: unknown[] = [];

        if (user) {
          conditions.push("USERHOST LIKE ?");
          queryParams.push(`%${user}%`);
        }
        if (mode) {
          conditions.push("MODE = ?");
          queryParams.push(mode);
        }

        if (conditions.length > 0) {
          usersQuery += " WHERE " + conditions.join(" AND ");
        }
        
        usersQuery += ` LIMIT ${limit}`;

        const usersResult = await adapter.executeQuery(usersQuery, queryParams);

        // Get firewall whitelist
        let rulesQuery = `
                    SELECT w.USERHOST, w.RULE
                    FROM mysql.firewall_whitelist w
                `;

        const rulesParams: unknown[] = [];
        const rulesConditions: string[] = [];

        if (mode) {
          rulesQuery += " JOIN mysql.firewall_users u ON w.USERHOST = u.USERHOST";
          rulesConditions.push("u.MODE = ?");
          rulesParams.push(mode);
        }

        if (user) {
          rulesConditions.push("w.USERHOST LIKE ?");
          rulesParams.push(`%${user}%`);
        }

        if (rulesConditions.length > 0) {
          rulesQuery += " WHERE " + rulesConditions.join(" AND ");
        }
        
        rulesQuery += ` LIMIT ${limit}`;

        const rulesResult = await adapter.executeQuery(
          rulesQuery,
          rulesParams,
        );

        return withTokenEstimate({
          success: true,
          data: {
            users: usersResult.rows ?? [],
            rules: rulesResult.rows ?? [],
            userCount: usersResult.rows?.length ?? 0,
            ruleCount: rulesResult.rows?.length ?? 0,
          },
        });
        } catch (error) {
          if (error instanceof ZodError) {
            return formatHandlerErrorResponse(error, { module: "security", tool: "mysql_security_firewall_rules" });
          }
          if (
            error !== null &&
            typeof error === "object" &&
            "message" in error &&
            typeof (error).message === "string"
          ) {
            const messageStr = (error as { message: string }).message;
            const lower = messageStr.toLowerCase();
            if (
              lower.includes("does not exist") ||
              lower.includes("access denied") ||
              lower.includes("er_no_such_table") ||
              lower.includes("proxysql error")
            ) {
              return formatHandlerErrorResponse(
                new ExtensionNotAvailableError("firewall", { plugin: "MySQL Enterprise Firewall" }),
                { module: "security", tool: "mysql_security_firewall_rules" }
              );
            }
          }
          return formatHandlerErrorResponse(error, { module: "security", tool: "mysql_security_firewall_rules" });
        }
    },
  };
}
