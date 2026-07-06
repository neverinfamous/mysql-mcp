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
import { validateQualifiedIdentifier, validateIdentifier, escapeQualifiedTable, parseQualifiedTable } from "../../../../../utils/validators.js";
import { DistributionOutputSchema } from "../../../schemas/stats.js";
import { READ_ONLY } from "../../../../../utils/annotations.js";
import { DistributionSchemaBase, DistributionSchema } from "./schemas.js";

/**
 * Analyze data distribution
 */
export function createDistributionTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_stats_distribution",
    title: "MySQL Distribution Analysis",
    description:
      "Analyze the distribution of values in a column with histogram buckets.",
    group: "stats",
    inputSchema: DistributionSchemaBase,
    outputSchema: DistributionOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { table, column, buckets, where } =
          DistributionSchema.parse(params);
        // Validate identifiers
        validateQualifiedIdentifier(table, "table");
        validateIdentifier(column, "column");
        if (buckets < 1) {
          throw new ValidationError("buckets must be at least 1");
        }

        const whereClause = where ? `WHERE ${where}` : "";

        // Ensure table exists to trigger ER_NO_SUCH_TABLE for P154 object existence compliance
        await adapter.executeQuery(`SELECT 1 FROM ${escapeQualifiedTable(table)} LIMIT 1`);

        // Check if column is numeric
        const { schema, table: parsedTableName } = parseQualifiedTable(table);

        const colCheck = await adapter.executeQuery(
          `SELECT DATA_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ${schema ? '?' : 'DATABASE()'} AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
          schema ? [schema, parsedTableName, column] : [parsedTableName, column],
        );
        const dataTypeVal = colCheck.rows?.[0]?.["DATA_TYPE"];
        const dataType =
          typeof dataTypeVal === "string" ? dataTypeVal.toLowerCase() : "";
        // Empty result means column does not exist; non-empty result with non-numeric type means wrong type
        if (!colCheck.rows || colCheck.rows.length === 0) {
          throw new ValidationError(`Column '${column}' not found on table ${escapeQualifiedTable(table)}`);
        }
        if (
          ![
            "tinyint",
            "smallint",
            "mediumint",
            "int",
            "bigint",
            "decimal",
            "numeric",
            "float",
            "double",
          ].includes(dataType)
        ) {
          throw new ValidationError(`Column type mismatch: '${column}' is not a numeric column (type: ${dataType})`);
        }

        // Get min/max for bucket calculation
        const rangeResult = await adapter.executeQuery(
          `SELECT MIN(\`${column}\`) as min_val, MAX(\`${column}\`) as max_val FROM ${escapeQualifiedTable(table)} ${whereClause}`,
        );

        const rangeRow = rangeResult.rows?.[0];
        const minVal = Number(rangeRow?.["min_val"]) || 0;
        const maxVal = Number(rangeRow?.["max_val"]) || 0;

        if (minVal === maxVal) {
          return withTokenEstimate({
            success: true,
            data: {
              column,
              distribution: [
                { bucket: 0, rangeStart: minVal, rangeEnd: maxVal, count: 1 },
              ],
              bucketCount: 1,
              minValue: minVal,
              maxValue: maxVal,
            },
          });
        }

        const bucketSize = (maxVal - minVal) / buckets;

        // Generate distribution query with WIDTH_BUCKET emulation
        // Clamp with LEAST to prevent max value from creating an extra bucket
        const query = `
                SELECT
                    LEAST(FLOOR((\`${column}\` - ${String(minVal)}) / ${String(bucketSize)}), ${String(buckets - 1)}) as bucket,
                    COUNT(*) as count,
                    MIN(\`${column}\`) as bucket_min,
                    MAX(\`${column}\`) as bucket_max
                FROM ${escapeQualifiedTable(table)}
                ${whereClause}
                GROUP BY bucket
                ORDER BY bucket
            `;

        const result = await adapter.executeQuery(query);

        // Format buckets with proper ranges
        const distribution = (result.rows ?? []).map((row) => {
          const r = row;
          const bucketNum = Number(r["bucket"]) || 0;
          return {
            bucket: bucketNum,
            rangeStart: minVal + bucketNum * bucketSize,
            rangeEnd: minVal + (bucketNum + 1) * bucketSize,
            count: Number(r["count"]),
            bucketMin: r["bucket_min"],
            bucketMax: r["bucket_max"],
          };
        });

        return withTokenEstimate({
          success: true,
          data: {
            column,
            distribution,
            bucketCount: buckets,
            bucketSize,
            minValue: minVal,
            maxValue: maxVal,
          },
        });
      } catch (error) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}
