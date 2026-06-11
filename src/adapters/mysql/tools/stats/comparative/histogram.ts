import { ZodError } from "zod";
import {
  formatMysqlError,
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "../../core/error-helpers.js";
import type { MySQLAdapter } from "../../../mysql-adapter/index.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../../types/index.js";
import { HistogramOutputSchema } from "../../../schemas/stats.js";
import { WRITE } from "../../../../../utils/annotations.js";
import { HistogramSchemaBase, HistogramSchema } from "./schemas.js";

/**
 * Column histogram management
 */
export function createHistogramTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_stats_histogram",
    title: "MySQL Histogram Statistics",
    description: "View or update column histogram statistics (MySQL 8.0+).",
    group: "stats",
    inputSchema: HistogramSchemaBase,
    outputSchema: HistogramOutputSchema,
    requiredScopes: ["read"], // read for view, admin for update
    annotations: WRITE,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { table, column, buckets, update } =
          HistogramSchema.parse(params);
        // Validate identifiers
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
          return withTokenEstimate({
            success: false,
            error: "Invalid table name",
          });
        }
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column)) {
          return withTokenEstimate({
            success: false,
            error: "Invalid column name",
          });
        }

        // Check if table exists (P154)
        const tableCheck = await adapter.executeQuery(
          `SELECT TABLE_NAME FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
          [table],
        );

        if (!tableCheck.rows || tableCheck.rows.length === 0) {
          return withTokenEstimate({
            success: false,
            error: `Table '${table}' doesn't exist`,
          });
        }

        // Check if column exists on the table
        const columnCheck = await adapter.executeQuery(
          `SELECT COLUMN_NAME FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
          [table, column],
        );

        if (!columnCheck.rows || columnCheck.rows.length === 0) {
          return withTokenEstimate({
            success: false,
            error: `Column '${column}' does not exist on table '${table}'`,
          });
        }

        let warning: string | undefined;
        if (update) {
          // Create or update histogram
          const numBuckets = Math.min(buckets, 1024);
          if (buckets > 1024) {
            warning = `Requested ${buckets} buckets; clamped to max 1024`;
          }
          await adapter.executeQuery(
            `ANALYZE TABLE \`${table}\` UPDATE HISTOGRAM ON \`${column}\` WITH ${String(numBuckets)} BUCKETS`,
          );
        }

        // Get histogram info from information_schema
        const histogramQuery = `
                SELECT
                    SCHEMA_NAME as schemaName,
                    TABLE_NAME as tableName,
                    COLUMN_NAME as columnName,
                    JSON_EXTRACT(HISTOGRAM, '$."histogram-type"') as histogramType,
                    JSON_EXTRACT(HISTOGRAM, '$."number-of-buckets-specified"') as bucketsSpecified,
                    JSON_EXTRACT(HISTOGRAM, '$."sampling-rate"') as samplingRate,
                    JSON_EXTRACT(HISTOGRAM, '$."last-updated"') as lastUpdated,
                    JSON_LENGTH(JSON_EXTRACT(HISTOGRAM, '$.buckets')) as actualBuckets
                FROM information_schema.COLUMN_STATISTICS
                WHERE TABLE_NAME = ?
                  AND COLUMN_NAME = ?
                  AND SCHEMA_NAME = DATABASE()
            `;

        const result = await adapter.executeQuery(histogramQuery, [
          table,
          column,
        ]);

        if (!result.rows || result.rows.length === 0) {
          if (update) {
            return withTokenEstimate({
              success: false,
              error: "Histogram created but not yet visible in metadata",
            });
          }
          return withTokenEstimate({
            success: true,
            data: {
              exists: false,
              table,
              column,
              updated: false,
              hint: "Histogram not found. Set 'update: true' to generate it.",
            },
          });
        }

        const histogramRow = result.rows[0];
        if (!histogramRow) {
          return withTokenEstimate({
            success: false,
            error: "Histogram data is empty",
          });
        }
        return withTokenEstimate({
          success: true,
          data: {
            exists: true,
            ...histogramRow,
            updated: update,
            ...(warning && { warning }),
          },
        });
      } catch (error) {
        if (error instanceof ZodError) {
          return formatHandlerErrorResponse(error);
        }
        const msg = formatMysqlError(error);
        if (msg.includes("doesn't exist")) {
          return withTokenEstimate({
            success: false,
            error: `Table '${((params as Record<string, unknown>)?.["table"] as string) ?? "unknown"}' doesn't exist`,
          });
        }
        return withTokenEstimate({ success: false, error: msg });
      }
    },
  };
}
