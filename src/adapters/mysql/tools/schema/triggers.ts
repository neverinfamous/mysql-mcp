import { z } from "zod";

import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "../core/error-helpers.js";
import { BaseOutputSchema } from "../../schemas/output-schemas.js";
import type { MySQLAdapter } from "../../mysql-adapter/index.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import { ValidationError } from "../../../../types/modules/errors.js";
import { READ_ONLY } from "../../../../utils/annotations.js";

const ListTriggersSchemaBase = z.object({
  table: z.string().optional().describe("Filter by table name"),
  schema: z
    .string()
    .optional()
    .describe("Schema name to list triggers for"),
  database: z.string().optional().describe("Alias for schema"),
  limit: z.number().default(50).describe("Maximum number of results to return"),
  offset: z.number().default(0).describe("Number of results to skip"),
});

const ListTriggersSchema = z.preprocess(
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
    table: z.string().optional(),
    schema: z.string().default(""),
    limit: z.number().default(50),
    offset: z.number().default(0),
  })
);

const ListTriggersOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    triggers: z.array(z.record(z.string(), z.unknown())),
    count: z.number(),
  }).optional()
});

/**
 * List triggers
 */
export function createListTriggersTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_list_triggers",
    title: "MySQL List Triggers",
    description: "List all triggers with event timing, action, and definition.",
    group: "schema",
    inputSchema: ListTriggersSchemaBase,
    outputSchema: ListTriggersOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const parsedParams = ListTriggersSchema.parse(params);
        const targetSchema = parsedParams.schema;
        const table = parsedParams.table;

        if (!targetSchema) {
          return formatHandlerErrorResponse(
            new ValidationError("Schema parameter is required (use 'schema' or 'database')")
          );
        }

        // P154: Schema existence check
        const schemaCheck = await adapter.executeQuery(
          "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?",
          [targetSchema],
        );
        if (schemaCheck.rows === undefined || schemaCheck.rows.length === 0) {
          return formatHandlerErrorResponse(
            new Error(`Schema '${targetSchema}' does not exist`),
          );
        }

        // P154: Table existence check when explicitly provided
        if (table !== undefined && table !== "") {
          const tableCheck = await adapter.executeQuery(
            "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?",
            [targetSchema, table],
          );
          if (tableCheck.rows === undefined || tableCheck.rows.length === 0) {
            return formatHandlerErrorResponse(
              new Error(`Table '${table}' does not exist`),
            );
          }
        }

        let query = `
                SELECT
                    TRIGGER_NAME as name,
                    EVENT_OBJECT_TABLE as tableName,
                    EVENT_MANIPULATION as event,
                    ACTION_TIMING as timing,
                    ACTION_STATEMENT as statement,
                    DEFINER as definer,
                    CREATED as created
                FROM information_schema.TRIGGERS
                WHERE TRIGGER_SCHEMA = ?
            `;

        const queryParams: unknown[] = [targetSchema];

        if (table !== undefined && table !== "") {
          query += " AND EVENT_OBJECT_TABLE = ?";
          queryParams.push(table);
        }

        query +=
          ` ORDER BY EVENT_OBJECT_TABLE, ACTION_TIMING, EVENT_MANIPULATION LIMIT ${parsedParams.limit} OFFSET ${parsedParams.offset}`;
        
        const result = await adapter.executeQuery(query, queryParams);
        return withTokenEstimate({
          success: true,
          data: {
            triggers: result.rows,
            count: result.rows?.length ?? 0,
          },
        });
      } catch (err) {
        return formatHandlerErrorResponse(err);
      }
    },
  };
}

