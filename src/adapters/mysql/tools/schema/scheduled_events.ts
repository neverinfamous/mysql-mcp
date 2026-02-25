import { z, ZodError } from "zod";
import type { MySQLAdapter } from "../../MySQLAdapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";

/** Extract human-readable messages from a ZodError instead of raw JSON array */
function formatZodError(error: ZodError): string {
  return error.issues.map((i) => i.message).join("; ");
}

const ListEventsSchemaBase = z.object({
  schema: z
    .string()
    .optional()
    .describe("Schema name (defaults to current database)"),
  status: z.string().optional().describe("Filter by status"),
});

const ListEventsSchema = z.object({
  schema: z
    .string()
    .optional()
    .describe("Schema name (defaults to current database)"),
  status: z
    .enum(["ENABLED", "DISABLED", "SLAVESIDE_DISABLED"])
    .optional()
    .describe("Filter by status"),
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
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      let parsed;
      try {
        parsed = ListEventsSchema.parse(params);
      } catch (error: unknown) {
        if (error instanceof ZodError) {
          return { success: false, error: formatZodError(error) };
        }
        throw error;
      }
      const { schema, status } = parsed;

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

      const queryParams: unknown[] = [schema ?? null];

      if (status) {
        query += " AND STATUS = ?";
        queryParams.push(status);
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
