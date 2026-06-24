import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "../../core/error-helpers.js";
import type { MySQLAdapter } from "../../../mysql-adapter/index.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../../types/index.js";
import { ValidationError } from "../../../../../types/index.js";
import { validateQualifiedIdentifier, validateIdentifier, escapeQualifiedTable } from "../../../../../utils/validators.js";
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
        validateQualifiedIdentifier(table, "table");
        validateIdentifier(column, "column");

        // Ensure table and column exist to trigger ER_NO_SUCH_TABLE or ER_BAD_FIELD_ERROR for P154 compliance
        await adapter.executeQuery(`SELECT \`${column}\` FROM ${escapeQualifiedTable(table)} LIMIT 1`);

        let warning: string | undefined;
        if (update) {
          // Create or update histogram
          const numBuckets = Math.min(buckets, 1024);
          if (buckets > 1024) {
            warning = `Requested ${buckets} buckets; clamped to max 1024`;
          }
          await adapter.executeQuery(
            `ANALYZE TABLE ${escapeQualifiedTable(table)} UPDATE HISTOGRAM ON \`${column}\` WITH ${String(numBuckets)} BUCKETS`,
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
            throw new ValidationError("Histogram created but not yet visible in metadata");
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
          throw new ValidationError("Histogram data is empty");
        }
        return withTokenEstimate({
          success: true,
          data: {
            exists: true,
            table,
            column,
            ...histogramRow,
            updated: update,
            ...(warning && { warning }),
          },
        });
      } catch (error) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}
