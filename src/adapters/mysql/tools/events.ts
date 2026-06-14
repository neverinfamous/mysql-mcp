/**
 * MySQL Event Scheduler Tools
 *
 * Tools for managing MySQL's built-in Event Scheduler.
 * 6 tools total.
 */

import { ZodError } from "zod";
import { ValidationError, QueryError } from "../../../types/modules/errors.js";
import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "./core/error-helpers.js";
import {
  EventCreateSchema,
  EventAlterSchema,
  EventDropSchema,
  EventListSchema,
  EventStatusSchema,
  SchedulerStatusSchema,
  EventCreateOutputSchema,
  EventAlterOutputSchema,
  EventDropOutputSchema,
  EventListOutputSchema,
  EventStatusOutputSchema,
  SchedulerStatusOutputSchema,
} from "../schemas/events.js";
import type { MySQLAdapter } from "../mysql-adapter/index.js";
import type { ToolDefinition, RequestContext } from "../../../types/index.js";
import { WRITE, DESTRUCTIVE, READ_ONLY } from "../../../utils/annotations.js";

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
    outputSchema: EventCreateOutputSchema,
    requiredScopes: ["admin"],
    annotations: WRITE,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const {
          name,
          schedule,
          body,
          onCompletion,
          status,
          comment,
          ifNotExists,
        } = EventCreateSchema.parse(params);

        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
          return formatHandlerErrorResponse(new ValidationError("Invalid event name",));
        }

        const validOnCompletion = ["PRESERVE", "NOT PRESERVE"];
        if (!validOnCompletion.includes(onCompletion)) {
          return withTokenEstimate({
            success: false,
            error: `Invalid onCompletion: '${onCompletion}' — expected one of: ${validOnCompletion.join(", ")}`,
          });
        }

        if (ifNotExists) {
          const existsCheck = await adapter.executeQuery(
            "SELECT EVENT_NAME FROM information_schema.EVENTS WHERE EVENT_SCHEMA = DATABASE() AND EVENT_NAME = ?",
            [name],
          );
          if (existsCheck.rows && existsCheck.rows.length > 0) {
            return formatHandlerErrorResponse(new QueryError("Event already exists",));
          }
        }

        const ifNotExistsClause = ifNotExists ? "IF NOT EXISTS " : "";
        let sql = `CREATE EVENT ${ifNotExistsClause}\`${name}\`\nON SCHEDULE ${schedule}`;

        sql += `\nON COMPLETION ${onCompletion}`;
        sql += `\n${status}`;

        if (comment) {
          sql += `\nCOMMENT '${comment.replace(/'/g, "''")}'`;
        }

        sql += `\nDO ${body}`;

        await adapter.executeQuery(sql);
        return withTokenEstimate({ success: true, data: { eventName: name } });
      } catch (error: unknown) {
        if (error instanceof ZodError) {
          return formatHandlerErrorResponse(error);
        }
        const message = error instanceof Error ? error.message : String(error);
        if (message.toLowerCase().includes("already exists")) {
          return formatHandlerErrorResponse(new QueryError("Event already exists",));
        }
        return formatHandlerErrorResponse(error);
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
    outputSchema: EventAlterOutputSchema,
    requiredScopes: ["admin"],
    annotations: WRITE,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { name, newName, schedule, body, onCompletion, status, comment } =
          EventAlterSchema.parse(params);

        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
          return formatHandlerErrorResponse(new ValidationError("Invalid event name",));
        }

        // Validate enum fields at handler level
        if (onCompletion !== undefined) {
          const validOnCompletion = ["PRESERVE", "NOT PRESERVE"];
          if (!validOnCompletion.includes(onCompletion)) {
            return withTokenEstimate({
              success: false,
              error: `Invalid onCompletion: '${onCompletion}' — expected one of: ${validOnCompletion.join(", ")}`,
            });
          }
        }

        let sql = `ALTER EVENT \`${name}\``;
        const clauses: string[] = [];

        if (schedule) {
          clauses.push(`ON SCHEDULE ${schedule}`);
        }

        if (onCompletion) {
          clauses.push(`ON COMPLETION ${onCompletion}`);
        }

        if (newName) {
          if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(newName)) {
            return formatHandlerErrorResponse(new ValidationError("Invalid new event name",));
          }
          clauses.push(`RENAME TO \`${newName}\``);
        }

        if (status) {
          clauses.push(status);
        }

        if (comment !== undefined) {
          clauses.push(`COMMENT '${comment.replace(/'/g, "''")}'`);
        }

        if (body) {
          clauses.push(`DO ${body}`);
        }

        if (clauses.length === 0) {
          return formatHandlerErrorResponse(new ValidationError("No modifications specified",));
        }

        sql += "\n" + clauses.join("\n");

        await adapter.executeQuery(sql);
        return withTokenEstimate({
          success: true,
          data: { eventName: newName ?? name },
        });
      } catch (error: unknown) {
        if (error instanceof ZodError) {
          return formatHandlerErrorResponse(error);
        }
        const message = error instanceof Error ? error.message : String(error);
        if (message.toLowerCase().includes("unknown event")) {
          return formatHandlerErrorResponse(new QueryError("Event does not exist",));
        }
        return formatHandlerErrorResponse(error);
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
    outputSchema: EventDropOutputSchema,
    requiredScopes: ["admin"],
    annotations: DESTRUCTIVE,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { name, ifExists } = EventDropSchema.parse(params);

        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
          return formatHandlerErrorResponse(new ValidationError("Invalid event name",));
        }

        if (ifExists) {
          const existsCheck = await adapter.executeQuery(
            "SELECT EVENT_NAME FROM information_schema.EVENTS WHERE EVENT_SCHEMA = DATABASE() AND EVENT_NAME = ?",
            [name],
          );
          if (!existsCheck.rows || existsCheck.rows.length === 0) {
            return formatHandlerErrorResponse(new QueryError("Event does not exist",));
          }
        }

        const ifExistsClause = ifExists ? "IF EXISTS " : "";

        await adapter.executeQuery(`DROP EVENT ${ifExistsClause}\`${name}\``);
        return withTokenEstimate({ success: true, data: { eventName: name } });
      } catch (error: unknown) {
        if (error instanceof ZodError) {
          return formatHandlerErrorResponse(error);
        }
        const message = error instanceof Error ? error.message : String(error);
        if (message.toLowerCase().includes("unknown event")) {
          return formatHandlerErrorResponse(new QueryError("Event does not exist",));
        }
        return formatHandlerErrorResponse(error);
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
    outputSchema: EventListOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { schema, includeDisabled } = EventListSchema.parse(params);

        // P154: Schema existence check when explicitly provided
        if (schema) {
          const schemaCheck = await adapter.executeQuery(
            "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?",
            [schema],
          );
          if (!schemaCheck.rows || schemaCheck.rows.length === 0) {
            return formatHandlerErrorResponse(new QueryError("Schema does not exist",));
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
        return withTokenEstimate({
          success: true,
          data: {
            events: result.rows,
            count: result.rows?.length ?? 0,
          },
        });
      } catch (error: unknown) {
        if (error instanceof ZodError) {
          return formatHandlerErrorResponse(error);
        }
        return formatHandlerErrorResponse(error);
      }
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
    outputSchema: EventStatusOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { name, schema } = EventStatusSchema.parse(params);

        // P154: Schema existence check when explicitly provided
        if (schema) {
          const schemaCheck = await adapter.executeQuery(
            "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?",
            [schema],
          );
          if (!schemaCheck.rows || schemaCheck.rows.length === 0) {
            return formatHandlerErrorResponse(new QueryError("Schema does not exist",));
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

        const result = await adapter.executeQuery(query, [
          schema ?? null,
          name,
        ]);

        if (!result.rows || result.rows.length === 0) {
          return formatHandlerErrorResponse(new QueryError("Event does not exist",));
        }

        return withTokenEstimate({
          success: true,
          data: { event: result.rows[0] },
        });
      } catch (error: unknown) {
        if (error instanceof ZodError) {
          return formatHandlerErrorResponse(error);
        }
        return formatHandlerErrorResponse(error);
      }
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
    inputSchema: SchedulerStatusSchema,
    outputSchema: SchedulerStatusOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (_params: unknown, _context: RequestContext) => {
      try {
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

        return withTokenEstimate({
          success: true,
          data: {
            schedulerEnabled: schedulerStatus?.["Value"] === "ON",
            schedulerStatus: schedulerStatus?.["Value"] ?? "UNKNOWN",
            status: schedulerStatus?.["Value"] ?? "UNKNOWN",
            eventCounts: countResult.rows ?? [],
            recentlyExecuted: recentResult.rows ?? [],
          },
        });
      } catch (error: unknown) {
        if (error instanceof ZodError) {
          return formatHandlerErrorResponse(error);
        }
        return formatHandlerErrorResponse(error);
      }
    },
  };
}
