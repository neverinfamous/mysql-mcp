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
import { RegressionOutputSchema } from "../../../schemas/stats.js";
import { READ_ONLY } from "../../../../../utils/annotations.js";
import { RegressionSchemaBase, RegressionSchema } from "./schemas.js";

/**
 * Linear regression analysis
 */
export function createRegressionTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_stats_regression",
    title: "MySQL Linear Regression",
    description:
      "Perform simple linear regression analysis (y = mx + b) between two columns.",
    group: "stats",
    inputSchema: RegressionSchemaBase,
    outputSchema: RegressionOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { table, xColumn, yColumn, where } =
          RegressionSchema.parse(params);
        // Validate identifiers
        validateQualifiedIdentifier(table, "table");
        validateIdentifier(xColumn, "column");
        validateIdentifier(yColumn, "column");

        const whereClause = where ? `WHERE ${where}` : "";

        // Ensure table exists to trigger ER_NO_SUCH_TABLE for P154 object existence compliance
        await adapter.executeQuery(`SELECT 1 FROM ${escapeQualifiedTable(table)} LIMIT 1`);

        // Verify columns are numeric (P154)
        const { schema, table: parsedTableName } = parseQualifiedTable(table);

        const colCheck = await adapter.executeQuery(
          `SELECT COLUMN_NAME, DATA_TYPE FROM information_schema.COLUMNS 
           WHERE TABLE_SCHEMA = ${schema ? '?' : 'DATABASE()'} AND TABLE_NAME = ? 
           AND COLUMN_NAME IN (?, ?)`,
          schema ? [schema, parsedTableName, xColumn, yColumn] : [parsedTableName, xColumn, yColumn],
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

        const missingRegCols = [xColumn, yColumn].filter(
          (c) => !validCols.has(c),
        );
        if (missingRegCols.length > 0) {
          const notFoundReg = missingRegCols.filter(
            (c) => !(colCheck.rows ?? []).some((r) => r["COLUMN_NAME"] === c),
          );
          if (notFoundReg.length > 0) {
            throw new ValidationError(`Column(s) not found: ${notFoundReg.join(", ")}`);
          }
          throw new ValidationError(`Both columns must be numeric types. Non-numeric: ${missingRegCols.join(", ")}`);
        }

        // Simpler approach for MySQL
        const statsQuery = `
                SELECT
                    COUNT(*) as n,
                    AVG(\`${xColumn}\`) as avg_x,
                    AVG(\`${yColumn}\`) as avg_y,
                    SUM(\`${xColumn}\` * \`${xColumn}\`) as sum_x2,
                    SUM(\`${yColumn}\` * \`${yColumn}\`) as sum_y2,
                    SUM(\`${xColumn}\` * \`${yColumn}\`) as sum_xy,
                    SUM(\`${xColumn}\`) as sum_x,
                    SUM(\`${yColumn}\`) as sum_y
                FROM ${escapeQualifiedTable(table)}
                ${whereClause}
            `;

        const result = await adapter.executeQuery(statsQuery);
        const stats = result.rows?.[0];

        const nVal = stats?.["n"];
        const n = typeof nVal === "number" ? nVal : Number(nVal) || 0;
        
        if (!stats || n < 2) {
          throw new ValidationError("Insufficient data points for regression (need at least 2)");
        }

        const sumX = Number(stats["sum_x"]);
        const sumY = Number(stats["sum_y"]);
        const sumXY = Number(stats["sum_xy"]);
        const sumX2 = Number(stats["sum_x2"]);
        const sumY2 = Number(stats["sum_y2"]);

        // Calculate slope and intercept
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;

        // Calculate R-squared
        const ssTotal = sumY2 - (sumY * sumY) / n;
        const ssResidual = sumY2 - intercept * sumY - slope * sumXY;
        const rSquared = ssTotal > 0 ? 1 - ssResidual / ssTotal : 0;

        return withTokenEstimate({
          success: true,
          data: {
            xColumn,
            yColumn,
            sampleSize: n,
            slope: isNaN(slope) ? null : slope,
            intercept: isNaN(intercept) ? null : intercept,
            rSquared: isNaN(rSquared) ? null : rSquared,
            equation: isNaN(slope)
              ? null
              : `y = ${slope.toFixed(4)}x + ${intercept.toFixed(4)}`,
            interpretation:
              rSquared >= 0.7
                ? "Good fit"
                : rSquared >= 0.5
                  ? "Moderate fit"
                  : "Poor fit",
          },
        });
      } catch (error) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}
