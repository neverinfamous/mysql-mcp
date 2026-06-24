import type { MySQLAdapter } from "../../../mysql-adapter/index.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../../types/index.js";
import {
  IndexUsageSchema,
  IndexUsageSchemaBase,
  IndexUsageOutputSchema,
} from "../../../schemas/index.js";
import { formatHandlerErrorResponse } from "../../core/error-helpers.js";
import { READ_ONLY } from "../../../../../utils/annotations.js";

export function createIndexUsageTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_index_usage",
    title: "MySQL Index Usage",
    description: "Get index usage statistics from performance_schema.",
    group: "performance",
    inputSchema: IndexUsageSchemaBase,
    outputSchema: IndexUsageOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { table, limit } = IndexUsageSchema.parse(params);

        // P154: Check table existence when a specific table is requested
        if (table) {
          const check = await adapter.executeReadQuery(
            `SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
            [table],
          );
          if (!check.rows || check.rows.length === 0) {
            const response = {
              success: false,
              error: `Table '${table}' does not exist`,
              code: "NOT_FOUND",
              category: "database",
              suggestion:
                "Verify the table name exists in the target database.",
              recoverable: true,
            };
            const tokenEstimate = Math.ceil(
              Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
            );
            return { ...response, metrics: { tokenEstimate } };
          }
        }

        // Always filter to current database to avoid returning thousands of
        // MySQL internal indexes with zero counts
        let sql = `
                SELECT 
                    object_schema as database_name,
                    object_name as table_name,
                    index_name,
                    count_read,
                    count_write,
                    count_fetch,
                    count_insert,
                    count_update,
                    count_delete
                FROM performance_schema.table_io_waits_summary_by_index_usage
                WHERE index_name IS NOT NULL
                  AND object_schema = DATABASE()
            `;

        if (table) {
          sql += ` AND object_name = ?`;
        }

        sql += ` ORDER BY count_read + count_write DESC LIMIT ${Math.min(limit, 100)}`;

        const result = await adapter.executeReadQuery(
          sql,
          table ? [table] : [],
        );
        const response = { success: true, data: { indexUsage: result.rows } };
        const tokenEstimate = Math.ceil(
          Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
        );
        return { ...response, metrics: { tokenEstimate } };
      } catch (err) {
        return formatHandlerErrorResponse(err);
      }
    },
  };
}
