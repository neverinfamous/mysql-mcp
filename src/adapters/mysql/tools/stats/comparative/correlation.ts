import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "../../core/error-helpers.js";
import type { MySQLAdapter } from "../../../mysql-adapter/index.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../../types/index.js";
import { CorrelationOutputSchema } from "../../../schemas/stats.js";
import { READ_ONLY } from "../../../../../utils/annotations.js";
import { CorrelationSchemaBase, CorrelationSchema } from "./schemas.js";

/**
 * Calculate correlation coefficient
 */
export function createCorrelationTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_stats_correlation",
    title: "MySQL Correlation",
    description:
      "Calculate Pearson correlation coefficient between two numeric columns.",
    group: "stats",
    inputSchema: CorrelationSchemaBase,
    outputSchema: CorrelationOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { table, column1, column2, where } =
          CorrelationSchema.parse(params);
        // Validate identifiers
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
          return withTokenEstimate({
            success: false,
            error: "Invalid table name",
          });
        }
        if (
          !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column1) ||
          !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column2)
        ) {
          return withTokenEstimate({
            success: false,
            error: "Invalid column name",
          });
        }

        const whereClause = where ? `WHERE ${where}` : "";

        // Verify columns are numeric (P154)
        const colCheck = await adapter.executeQuery(
          `SELECT COLUMN_NAME, DATA_TYPE FROM information_schema.COLUMNS 
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? 
           AND COLUMN_NAME IN (?, ?)`,
          [table, column1, column2],
        );

        const NUMERIC_TYPES = new Set([
          "tinyint",
          "smallint",
          "mediumint",
          "int",
          "bigint",
          "decimal",
          "numeric",
          "float",
          "double",
        ]);
        const validCols = new Set<string>();
        for (const row of colCheck.rows ?? []) {
          const type =
            typeof row["DATA_TYPE"] === "string" ? row["DATA_TYPE"] : undefined;
          const colName =
            typeof row["COLUMN_NAME"] === "string"
              ? row["COLUMN_NAME"]
              : undefined;
          if (type && colName && NUMERIC_TYPES.has(type.toLowerCase())) {
            validCols.add(colName);
          }
        }

        const missingCols = [column1, column2].filter((c) => !validCols.has(c));
        if (missingCols.length > 0) {
          const notFound = missingCols.filter(
            (c) => !(colCheck.rows ?? []).some((r) => r["COLUMN_NAME"] === c),
          );
          if (notFound.length > 0) {
            return withTokenEstimate({
              success: false,
              error: `Column(s) not found: ${notFound.join(", ")}`,
            });
          }
          return withTokenEstimate({
            success: false,
            error: `Both columns must be numeric types. Non-numeric: ${missingCols.join(", ")}`,
          });
        }

        // Calculate Pearson correlation coefficient
        const query = `
                SELECT
                    (COUNT(*) * SUM(\`${column1}\` * \`${column2}\`) - SUM(\`${column1}\`) * SUM(\`${column2}\`)) /
                    (SQRT(COUNT(*) * SUM(\`${column1}\` * \`${column1}\`) - SUM(\`${column1}\`) * SUM(\`${column1}\`)) *
                     SQRT(COUNT(*) * SUM(\`${column2}\` * \`${column2}\`) - SUM(\`${column2}\`) * SUM(\`${column2}\`)))
                    as correlation,
                    COUNT(*) as sample_size,
                    AVG(\`${column1}\`) as mean_x,
                    AVG(\`${column2}\`) as mean_y,
                    STD(\`${column1}\`) as std_x,
                    STD(\`${column2}\`) as std_y
                FROM \`${table}\`
                ${whereClause}
            `;

        const result = await adapter.executeQuery(query);
        const stats = result.rows?.[0];

        const correlationVal = stats?.["correlation"];
        const correlation = typeof correlationVal === "number" ? correlationVal : null;
        let interpretation = "N/A";
        if (correlation !== null) {
          const absCorr = Math.abs(correlation);
          if (absCorr >= 0.9) interpretation = "Very strong";
          else if (absCorr >= 0.7) interpretation = "Strong";
          else if (absCorr >= 0.5) interpretation = "Moderate";
          else if (absCorr >= 0.3) interpretation = "Weak";
          else interpretation = "Very weak / No correlation";
        }

        return withTokenEstimate({
          success: true,
          data: {
            column1,
            column2,
            correlation: correlation ?? null,
            interpretation,
            sampleSize: stats?.["sample_size"] ?? 0,
            column1Stats: {
              mean: stats?.["mean_x"] ?? null,
              stddev: stats?.["std_x"] ?? null,
            },
            column2Stats: {
              mean: stats?.["mean_y"] ?? null,
              stddev: stats?.["std_y"] ?? null,
            },
          },
        });
      } catch (error) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}
