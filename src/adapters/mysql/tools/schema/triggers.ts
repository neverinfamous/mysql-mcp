import { z } from "zod";
import type { MySQLAdapter } from "../../MySQLAdapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";

const ListTriggersSchema = z.object({
  table: z.string().optional().describe("Filter by table name"),
  schema: z
    .string()
    .optional()
    .describe("Schema name (defaults to current database)"),
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
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { table, schema } = ListTriggersSchema.parse(params);

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

      // P154: Table existence check when explicitly provided
      if (table) {
        const tableCheck = await adapter.executeQuery(
          "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = COALESCE(?, DATABASE()) AND TABLE_NAME = ?",
          [schema ?? null, table],
        );
        if (!tableCheck.rows || tableCheck.rows.length === 0) {
          return { exists: false, table };
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

      const queryParams: unknown[] = [schema ?? null];

      if (table) {
        query += " AND EVENT_OBJECT_TABLE = ?";
        queryParams.push(table);
      }

      query +=
        " ORDER BY EVENT_OBJECT_TABLE, ACTION_TIMING, EVENT_MANIPULATION";

      const result = await adapter.executeQuery(query, queryParams);
      return {
        triggers: result.rows,
        count: result.rows?.length ?? 0,
      };
    },
  };
}
