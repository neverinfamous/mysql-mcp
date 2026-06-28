import { z } from "zod";
import type { MySQLAdapter } from "../../mysql-adapter/index.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";

import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "../core/error-helpers.js";
import { BaseOutputSchema } from "../../schemas/output-schemas.js";
import { READ_ONLY } from "../../../../utils/annotations.js";

const ListEventsSchemaBase = z.object({
  schema: z
    .string()
    .optional()
    .describe("Schema name (defaults to current database)"),
  database: z.string().optional().describe("Alias for schema"),
  status: z
    .enum(["ENABLED", "DISABLED", "SLAVESIDE_DISABLED"])
    .optional()
    .describe("Filter by status"),
  limit: z.number().default(50).describe("Maximum number of results to return"),
  offset: z.number().default(0).describe("Number of results to skip"),
});

const ListEventsSchema = z.preprocess(
  (val: unknown) => {
    if (typeof val === "object" && val !== null) {
      const obj = val as Record<string, unknown>;
      return {
        ...obj,
        schema: obj['schema'] ?? obj['database'],
      };
    }
    return val;
  },
  z.object({
    schema: z.string(),
    status: z
      .enum(["ENABLED", "DISABLED", "SLAVESIDE_DISABLED"])
      .optional()
      .describe("Filter by status"),
    limit: z.number().default(50),
    offset: z.number().default(0),
  })
);

const ListEventsOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    events: z.array(z.record(z.string(), z.unknown())),
    count: z.number(),
  }).optional()
});

/**
 * List scheduled events
 */
export function createListEventsTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_list_events",
    title: "MySQL List Events",
    description:
      "List all scheduled events with execution status and schedule info.",
    group: "schema",
    inputSchema: ListEventsSchemaBase,
    outputSchema: ListEventsOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const parsedParams = ListEventsSchema.parse(params);
        const targetSchema = parsedParams.schema;
        const status = parsedParams.status;

        // P154: Schema existence check when explicitly provided
        if (targetSchema !== undefined && targetSchema !== "") {
          const schemaCheck = await adapter.executeQuery(
            "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?",
            [targetSchema],
          );
          if (schemaCheck.rows === undefined || schemaCheck.rows.length === 0) {
            return formatHandlerErrorResponse(
              new Error(`Schema '${targetSchema}' does not exist`),
            );
          }
        }

        let query = `
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
                    EVENT_COMMENT as comment
                FROM information_schema.EVENTS
                WHERE EVENT_SCHEMA = COALESCE(?, DATABASE())
            `;

        const queryParams: unknown[] = [targetSchema ?? null];

        if (status !== undefined) {
          query += " AND STATUS = ?";
          queryParams.push(status);
        }

        query += ` ORDER BY EVENT_NAME LIMIT ${parsedParams.limit} OFFSET ${parsedParams.offset}`;

        const result = await adapter.executeQuery(query, queryParams);
        return withTokenEstimate({
          success: true,
          data: {
            events: result.rows,
            count: result.rows?.length ?? 0,
          },
        });
      } catch (err) {
        return formatHandlerErrorResponse(err);
      }
    },
  };
}
