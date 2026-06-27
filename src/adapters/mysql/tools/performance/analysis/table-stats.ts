import type { MySQLAdapter } from "../../../mysql-adapter/index.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../../types/index.js";
import {
  TableStatsSchema,
  TableStatsSchemaBase,
  TableStatsOutputSchema,
} from "../../../schemas/index.js";
import { formatHandlerErrorResponse } from "../../core/error-helpers.js";
import { READ_ONLY } from "../../../../../utils/annotations.js";

export function createTableStatsTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_table_stats",
    title: "MySQL Table Stats",
    description:
      "Get detailed table statistics including size, rows, and engine info.",
    group: "performance",
    inputSchema: TableStatsSchemaBase,
    outputSchema: TableStatsOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { table } = TableStatsSchema.parse(params);

        const sql = `
                SELECT 
                    TABLE_NAME as table_name,
                    ENGINE as engine,
                    ROW_FORMAT as row_format,
                    TABLE_ROWS as estimated_rows,
                    AVG_ROW_LENGTH as avg_row_length,
                    DATA_LENGTH as data_size_bytes,
                    INDEX_LENGTH as index_size_bytes,
                    DATA_FREE as free_space_bytes,
                    AUTO_INCREMENT as auto_increment,
                    CREATE_TIME as create_time,
                    UPDATE_TIME as update_time,
                    TABLE_COLLATION as collation
                FROM information_schema.TABLES
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = ?
            `;

        const result = await adapter.executeReadQuery(sql, [table]);

        if (!result.rows || result.rows.length === 0) {
          const response = {
            success: false,
            error: `Table '${table}' does not exist`,
            code: "NOT_FOUND",
            category: "resource",
            suggestion: "Verify the table name exists in the target database.",
            recoverable: true,
          };
          const tokenEstimate = Math.ceil(
            Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
          );
          return { ...response, metrics: { tokenEstimate } };
        }

        const response = { success: true, data: { stats: result.rows[0] } };
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
