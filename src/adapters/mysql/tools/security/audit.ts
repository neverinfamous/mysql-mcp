/**
 * MySQL Security - Audit and Firewall Tools
 *
 * Tools for security auditing, firewall monitoring, and compliance.
 */

import { z, ZodError } from "zod";
import {
  stripErrorPrefix,
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

// =============================================================================
// Helpers
// =============================================================================

// =============================================================================
// Zod Schemas
// ============================================================================

const AuditLogSchema = z.object({
  limit: z.number().default(10).describe("Maximum number of records"),
  user: z.string().optional().describe("Filter by username"),
  eventType: z
    .string()
    .optional()
    .describe(
      'Filter by event type (e.g., "Execute", "Ping", "begin"). Uses LIKE matching against performance_schema EVENT_NAME.',
    ),
  startTime: z.string().optional().describe("Start time filter (ISO 8601)"),
});

const FirewallRulesSchema = z.object({
  user: z.string().optional().describe("Filter by username"),
  mode: z.string().optional().describe("Filter by mode"),
});

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
    inputSchema: AuditLogSchema,
    outputSchema: SecurityAuditOutputSchema,
    requiredScopes: ["admin"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      // First check if audit log table exists
      try {
        const { limit, user, eventType, startTime } =
          AuditLogSchema.parse(params);
        const checkResult = await adapter.executeQuery(`
                    SELECT TABLE_NAME
                    FROM information_schema.TABLES
                    WHERE TABLE_SCHEMA = 'mysql'
                      AND TABLE_NAME = 'audit_log'
                `);

        if (!checkResult.rows || checkResult.rows.length === 0) {
          // Try performance_schema alternative
          let query = `
                        SELECT
                            e.EVENT_NAME as event,
                            e.OBJECT_TYPE as objectType,
                            e.OBJECT_NAME as objectName,
                            t.PROCESSLIST_USER as user,
                            t.PROCESSLIST_HOST as host,
                            e.TIMER_START as startTime
                        FROM performance_schema.events_statements_history e
                        JOIN performance_schema.threads t
                          ON e.THREAD_ID = t.THREAD_ID
                    `;

          const conditions: string[] = [];
          const filtersApplied: string[] = [];
          const filtersIgnored: string[] = [];

          if (user) {
            // Safe: escape single quotes in user input for LIKE clause
            const escaped = user.replace(/'/g, "''");
            conditions.push(`t.PROCESSLIST_USER LIKE '%${escaped}%'`);
            filtersApplied.push("user");
          }
          if (eventType) {
            const escaped = eventType.replace(/'/g, "''");
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
            message: "Using performance_schema as audit log is not available",
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

        query += " ORDER BY timestamp DESC LIMIT ?";
        queryParams.push(limit);

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
          return formatHandlerErrorResponse(error);
        }
        const msg = error instanceof Error ? error.message : String(error);
        const stripped = stripErrorPrefix(msg);
        const lower = stripped.toLowerCase();
        if (
          lower.includes("doesn't exist") ||
          lower.includes("does not exist") ||
          lower.includes("access denied")
        ) {
          return formatHandlerErrorResponse(
            new Error(
              "Audit logging is not enabled. Install MySQL Enterprise Audit or Percona Audit plugin.",
            ),
          );
        }
        return formatHandlerErrorResponse(new Error(stripped));
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
    inputSchema: z.object({}),
    outputSchema: SecurityFirewallStatusOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (_params: unknown, _context: RequestContext) => {
      try {
        // Check if firewall plugin is installed
        const pluginResult = await adapter.executeQuery(`
                    SELECT PLUGIN_NAME, PLUGIN_STATUS
                    FROM information_schema.PLUGINS
                    WHERE PLUGIN_NAME LIKE '%firewall%'
                `);

        if (!pluginResult.rows || pluginResult.rows.length === 0) {
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
          return formatHandlerErrorResponse(error);
        }
        const message = error instanceof Error ? error.message : String(error);
        return formatHandlerErrorResponse(
          new Error(
            `Firewall plugin check failed: ${stripErrorPrefix(message)}`,
          ),
        );
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
    inputSchema: FirewallRulesSchema,
    outputSchema: SecurityFirewallRulesOutputSchema,
    requiredScopes: ["admin"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { user, mode } = FirewallRulesSchema.parse(params);

        const validModes = [
          "RECORDING",
          "PROTECTING",
          "DETECTING",
          "OFF",
        ] as const;
        if (mode && !validModes.includes(mode as (typeof validModes)[number])) {
          return formatHandlerErrorResponse(
            new Error(
              `Invalid mode: '${mode}' — expected one of: ${validModes.join(", ")}`,
            ),
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

        const usersResult = await adapter.executeQuery(usersQuery, queryParams);

        // Get firewall whitelist
        let rulesQuery = `
                    SELECT USERHOST, RULE
                    FROM mysql.firewall_whitelist
                `;

        if (user) {
          rulesQuery += " WHERE USERHOST LIKE ?";
        }

        const rulesResult = await adapter.executeQuery(
          rulesQuery,
          user ? [`%${user}%`] : [],
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
          return formatHandlerErrorResponse(error);
        }
        return formatHandlerErrorResponse(
          new Error(
            "Firewall tables not accessible. Ensure MySQL Enterprise Firewall is installed and you have appropriate privileges.",
          ),
        );
      }
    },
  };
}
