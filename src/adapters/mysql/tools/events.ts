/**
 * MySQL Event Scheduler Tools
 *
 * Tools for managing MySQL's built-in Event Scheduler.
 * 6 tools total.
 */

import { z } from "zod";
import type { MySQLAdapter } from "../MySQLAdapter.js";
import type { ToolDefinition, RequestContext } from "../../../types/index.js";

// =============================================================================
// Zod Schemas
// =============================================================================

const EventCreateSchema = z.object({
  name: z.string().describe("Event name"),
  schedule: z
    .object({
      type: z.enum(["ONE TIME", "RECURRING"]).describe("Event schedule type"),
      executeAt: z
        .string()
        .optional()
        .describe(
          'For ONE TIME: timestamp to execute (e.g., "2024-12-31 23:59:59")',
        ),
      interval: z.number().optional().describe("For RECURRING: interval value"),
      intervalUnit: z
        .enum([
          "YEAR",
          "QUARTER",
          "MONTH",
          "DAY",
          "HOUR",
          "MINUTE",
          "WEEK",
          "SECOND",
        ])
        .optional()
        .describe("For RECURRING: interval unit"),
      starts: z.string().optional().describe("For RECURRING: start timestamp"),
      ends: z.string().optional().describe("For RECURRING: end timestamp"),
    })
    .describe("Event schedule configuration"),
  body: z.string().describe("SQL statement(s) to execute"),
  onCompletion: z
    .enum(["PRESERVE", "NOT PRESERVE"])
    .default("NOT PRESERVE")
    .describe("What to do after event completes"),
  enabled: z.boolean().default(true).describe("Whether event is enabled"),
  comment: z.string().optional().describe("Event comment"),
  ifNotExists: z.boolean().default(false).describe("Add IF NOT EXISTS clause"),
});

const EventAlterSchema = z.object({
  name: z.string().describe("Event name"),
  newName: z.string().optional().describe("New event name (for rename)"),
  schedule: z
    .object({
      type: z.enum(["ONE TIME", "RECURRING"]).optional(),
      executeAt: z.string().optional(),
      interval: z.number().optional(),
      intervalUnit: z
        .enum([
          "YEAR",
          "QUARTER",
          "MONTH",
          "DAY",
          "HOUR",
          "MINUTE",
          "WEEK",
          "SECOND",
        ])
        .optional(),
      starts: z.string().optional(),
      ends: z.string().optional(),
    })
    .optional()
    .describe("New schedule configuration"),
  body: z.string().optional().describe("New SQL statement(s)"),
  onCompletion: z.enum(["PRESERVE", "NOT PRESERVE"]).optional(),
  enabled: z.boolean().optional().describe("Enable or disable event"),
  comment: z.string().optional(),
});

const EventDropSchema = z.object({
  name: z.string().describe("Event name to drop"),
  ifExists: z.boolean().default(true).describe("Add IF EXISTS clause"),
});

const EventListSchema = z.object({
  schema: z
    .string()
    .optional()
    .describe("Schema name (defaults to current database)"),
  includeDisabled: z
    .boolean()
    .default(true)
    .describe("Include disabled events"),
});

const EventStatusSchema = z.object({
  name: z.string().describe("Event name"),
  schema: z
    .string()
    .optional()
    .describe("Schema name (defaults to current database)"),
});

/**
 * Get all event scheduler tools
 */
export function getEventTools(adapter: MySQLAdapter): ToolDefinition[] {
  return [
    createEventCreateTool(adapter),
    createEventAlterTool(adapter),
    createEventDropTool(adapter),
    createEventListTool(adapter),
    createEventStatusTool(adapter),
    createSchedulerStatusTool(adapter),
  ];
}

/**
 * Create a scheduled event
 */
function createEventCreateTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_event_create",
    title: "MySQL Create Event",
    description:
      "Create a scheduled event (one-time or recurring) to execute SQL at specified times.",
    group: "events",
    inputSchema: EventCreateSchema,
    requiredScopes: ["admin"],
    annotations: {
      readOnlyHint: false,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const {
        name,
        schedule,
        body,
        onCompletion,
        enabled,
        comment,
        ifNotExists,
      } = EventCreateSchema.parse(params);

      // Validate event name
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
        throw new Error("Invalid event name");
      }

      const ifNotExistsClause = ifNotExists ? "IF NOT EXISTS " : "";
      let sql = `CREATE EVENT ${ifNotExistsClause}\`${name}\`\nON SCHEDULE `;

      // Build schedule clause
      if (schedule.type === "ONE TIME") {
        if (!schedule.executeAt) {
          throw new Error("executeAt is required for ONE TIME events");
        }
        sql += `AT '${schedule.executeAt}'`;
      } else {
        if (
          schedule.interval === undefined ||
          schedule.interval === null ||
          schedule.intervalUnit === undefined ||
          schedule.intervalUnit === null
        ) {
          throw new Error(
            "interval and intervalUnit are required for RECURRING events",
          );
        }
        sql += `EVERY ${String(schedule.interval)} ${schedule.intervalUnit}`;
        if (schedule.starts) {
          sql += ` STARTS '${schedule.starts}'`;
        }
        if (schedule.ends) {
          sql += ` ENDS '${schedule.ends}'`;
        }
      }

      sql += `\nON COMPLETION ${onCompletion}`;

      if (!enabled) {
        sql += "\nDISABLE";
      } else {
        sql += "\nENABLE";
      }

      if (comment) {
        sql += `\nCOMMENT '${comment.replace(/'/g, "''")}'`;
      }

      sql += `\nDO ${body}`;

      try {
        await adapter.executeQuery(sql);
        return { success: true, eventName: name };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.toLowerCase().includes("already exists")) {
          return {
            success: false,
            reason: `Event '${name}' already exists`,
          };
        }
        throw error;
      }
    },
  };
}

/**
 * Alter a scheduled event
 */
function createEventAlterTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_event_alter",
    title: "MySQL Alter Event",
    description:
      "Modify an existing scheduled event schedule, body, or status.",
    group: "events",
    inputSchema: EventAlterSchema,
    requiredScopes: ["admin"],
    annotations: {
      readOnlyHint: false,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { name, newName, schedule, body, onCompletion, enabled, comment } =
        EventAlterSchema.parse(params);

      // Validate event name
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
        throw new Error("Invalid event name");
      }

      let sql = `ALTER EVENT \`${name}\``;
      const clauses: string[] = [];

      // Build schedule clause if provided
      if (schedule?.type) {
        let scheduleClause = "ON SCHEDULE ";
        if (schedule.type === "ONE TIME") {
          if (!schedule.executeAt) {
            throw new Error("executeAt is required for ONE TIME events");
          }
          scheduleClause += `AT '${schedule.executeAt}'`;
        } else {
          if (
            schedule.interval === undefined ||
            schedule.interval === null ||
            schedule.intervalUnit === undefined ||
            schedule.intervalUnit === null
          ) {
            throw new Error(
              "interval and intervalUnit are required for RECURRING events",
            );
          }
          scheduleClause += `EVERY ${String(schedule.interval)} ${schedule.intervalUnit}`;
          if (schedule.starts) {
            scheduleClause += ` STARTS '${schedule.starts}'`;
          }
          if (schedule.ends) {
            scheduleClause += ` ENDS '${schedule.ends}'`;
          }
        }
        clauses.push(scheduleClause);
      }

      if (onCompletion) {
        clauses.push(`ON COMPLETION ${onCompletion}`);
      }

      if (enabled !== undefined) {
        clauses.push(enabled ? "ENABLE" : "DISABLE");
      }

      if (comment !== undefined) {
        clauses.push(`COMMENT '${comment.replace(/'/g, "''")}'`);
      }

      if (body) {
        clauses.push(`DO ${body}`);
      }

      if (newName) {
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(newName)) {
          throw new Error("Invalid new event name");
        }
        clauses.push(`RENAME TO \`${newName}\``);
      }

      if (clauses.length === 0) {
        throw new Error("No modifications specified");
      }

      sql += "\n" + clauses.join("\n");

      try {
        await adapter.executeQuery(sql);
        return { success: true, eventName: newName ?? name };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.toLowerCase().includes("unknown event")) {
          return {
            success: false,
            reason: `Event '${name}' does not exist`,
          };
        }
        throw error;
      }
    },
  };
}

/**
 * Drop a scheduled event
 */
function createEventDropTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_event_drop",
    title: "MySQL Drop Event",
    description: "Remove a scheduled event.",
    group: "events",
    inputSchema: EventDropSchema,
    requiredScopes: ["admin"],
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { name, ifExists } = EventDropSchema.parse(params);

      // Validate event name
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
        throw new Error("Invalid event name");
      }

      // Pre-check event existence for informative messaging
      if (ifExists) {
        const existsCheck = await adapter.executeQuery(
          "SELECT EVENT_NAME FROM information_schema.EVENTS WHERE EVENT_SCHEMA = DATABASE() AND EVENT_NAME = ?",
          [name],
        );
        if (!existsCheck.rows || existsCheck.rows.length === 0) {
          return {
            success: true,
            skipped: true,
            reason: "Event did not exist",
            eventName: name,
          };
        }
      }

      const ifExistsClause = ifExists ? "IF EXISTS " : "";

      try {
        await adapter.executeQuery(`DROP EVENT ${ifExistsClause}\`${name}\``);
        return { success: true, eventName: name };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.toLowerCase().includes("unknown event")) {
          return {
            success: false,
            reason: `Event '${name}' does not exist`,
          };
        }
        throw error;
      }
    },
  };
}

/**
 * List all events
 */
function createEventListTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_event_list",
    title: "MySQL List Events",
    description:
      "List all scheduled events with status, schedule, and execution info.",
    group: "events",
    inputSchema: EventListSchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { schema, includeDisabled } = EventListSchema.parse(params);

      // P154: Schema existence check when explicitly provided
      if (schema) {
        const schemaCheck = await adapter.executeQuery(
          "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?",
          [schema],
        );
        if (!schemaCheck.rows || schemaCheck.rows.length === 0) {
          return { exists: false, schema };
        }
      }

      let query = `
                SELECT 
                    EVENT_NAME as name,
                    EVENT_SCHEMA as schemaName,
                    DEFINER as definer,
                    EVENT_TYPE as eventType,
                    EXECUTE_AT as executeAt,
                    INTERVAL_VALUE as intervalValue,
                    INTERVAL_FIELD as intervalField,
                    STARTS as starts,
                    ENDS as ends,
                    STATUS as status,
                    ON_COMPLETION as onCompletion,
                    LAST_EXECUTED as lastExecuted,
                    EVENT_COMMENT as comment
                FROM information_schema.EVENTS
                WHERE EVENT_SCHEMA = COALESCE(?, DATABASE())
            `;

      const queryParams: unknown[] = [schema ?? null];

      if (!includeDisabled) {
        query += " AND STATUS = 'ENABLED'";
      }

      query += " ORDER BY EVENT_NAME";

      const result = await adapter.executeQuery(query, queryParams);
      return {
        events: result.rows,
        count: result.rows?.length ?? 0,
      };
    },
  };
}

/**
 * Get detailed event status
 */
function createEventStatusTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_event_status",
    title: "MySQL Event Status",
    description:
      "Get detailed status and execution history for a specific event.",
    group: "events",
    inputSchema: EventStatusSchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { name, schema } = EventStatusSchema.parse(params);

      // P154: Schema existence check when explicitly provided
      if (schema) {
        const schemaCheck = await adapter.executeQuery(
          "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?",
          [schema],
        );
        if (!schemaCheck.rows || schemaCheck.rows.length === 0) {
          return { exists: false, schema };
        }
      }

      const query = `
                SELECT 
                    EVENT_NAME as name,
                    EVENT_SCHEMA as schemaName,
                    DEFINER as definer,
                    TIME_ZONE as timeZone,
                    EVENT_TYPE as eventType,
                    EXECUTE_AT as executeAt,
                    INTERVAL_VALUE as intervalValue,
                    INTERVAL_FIELD as intervalField,
                    STARTS as starts,
                    ENDS as ends,
                    STATUS as status,
                    ON_COMPLETION as onCompletion,
                    CREATED as created,
                    LAST_ALTERED as lastAltered,
                    LAST_EXECUTED as lastExecuted,
                    EVENT_COMMENT as comment,
                    EVENT_DEFINITION as definition
                FROM information_schema.EVENTS
                WHERE EVENT_SCHEMA = COALESCE(?, DATABASE())
                  AND EVENT_NAME = ?
            `;

      const result = await adapter.executeQuery(query, [schema ?? null, name]);

      if (!result.rows || result.rows.length === 0) {
        return { exists: false, name };
      }

      return result.rows[0];
    },
  };
}

/**
 * Get Event Scheduler global status
 */
function createSchedulerStatusTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_scheduler_status",
    title: "MySQL Scheduler Status",
    description: "Get the global Event Scheduler status and event statistics.",
    group: "events",
    inputSchema: z.object({}),
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (_params: unknown, _context: RequestContext) => {
      // Get scheduler status
      const statusResult = await adapter.executeQuery(
        "SHOW VARIABLES LIKE 'event_scheduler'",
      );

      // Get event counts by status
      const countResult = await adapter.executeQuery(`
                SELECT 
                    STATUS as status,
                    COUNT(*) as count
                FROM information_schema.EVENTS
                GROUP BY STATUS
            `);

      // Get recently executed events
      const recentResult = await adapter.executeQuery(`
                SELECT 
                    EVENT_NAME as name,
                    EVENT_SCHEMA as schemaName,
                    LAST_EXECUTED as lastExecuted
                FROM information_schema.EVENTS
                WHERE LAST_EXECUTED IS NOT NULL
                ORDER BY LAST_EXECUTED DESC
                LIMIT 10
            `);

      const schedulerStatus = statusResult.rows?.[0];

      return {
        schedulerEnabled: schedulerStatus?.["Value"] === "ON",
        schedulerStatus: schedulerStatus?.["Value"] ?? "UNKNOWN",
        eventCounts: countResult.rows ?? [],
        recentlyExecuted: recentResult.rows ?? [],
      };
    },
  };
}
