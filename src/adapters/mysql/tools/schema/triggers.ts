import { z } from "zod";

import { formatHandlerErrorResponse } from "../core/error-helpers.js";
import type { MySQLAdapter } from "../../mysql-adapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import { READ_ONLY } from "../../../../utils/annotations.js";


const ListTriggersSchema = z.object({
  table: z.string().optional().describe("Filter by table name"),
  schema: z
    .string()
    .optional()
    .describe("Schema name (defaults to current database)"),
  database: z.string().optional().describe("Alias for schema"),
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
    inputSchema: ListTriggersSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const parsedParams = ListTriggersSchema.parse(params);
        const targetSchema = parsedParams.schema ?? parsedParams.database;
        const table = parsedParams.table;

        // P154: Schema existence check when explicitly provided
        if (targetSchema !== undefined && targetSchema !== "") {
          const schemaCheck = await adapter.executeQuery(
            "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?",
            [targetSchema],
          );
          if (schemaCheck.rows === undefined || schemaCheck.rows.length === 0) {
            return formatHandlerErrorResponse(
              new Error(`Schema '${targetSchema}' does not exist`)
            );
          }
        }

        // P154: Table existence check when explicitly provided
        if (table !== undefined && table !== "") {
          const tableCheck = await adapter.executeQuery(
            "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = COALESCE(?, DATABASE()) AND TABLE_NAME = ?",
            [targetSchema ?? null, table],
          );
          if (tableCheck.rows === undefined || tableCheck.rows.length === 0) {
            return formatHandlerErrorResponse(
              new Error(`Table '${table}' does not exist`)
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
                WHERE TRIGGER_SCHEMA = COALESCE(?, DATABASE())
            `;

        const queryParams: unknown[] = [targetSchema ?? null];

        if (table !== undefined && table !== "") {
          query += " AND EVENT_OBJECT_TABLE = ?";
          queryParams.push(table);
        }

        query +=
          " ORDER BY EVENT_OBJECT_TABLE, ACTION_TIMING, EVENT_MANIPULATION";

        const result = await adapter.executeQuery(query, queryParams);
        const response = {
          success: true as const,
          data: {
            triggers: result.rows,
            count: result.rows?.length ?? 0,
          }
        };
        const tokenEstimate = Math.ceil(Buffer.byteLength(JSON.stringify(response), "utf8") / 4);
        return { ...response, metrics: { tokenEstimate } };
      } catch (err) {
        return formatHandlerErrorResponse(err);
      }
    },
  };
}
