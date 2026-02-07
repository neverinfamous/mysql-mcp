/**
 * MySQL Comparative and Advanced Statistics Tools
 *
 * Tools for advanced statistical analysis: correlation, regression, and histogram.
 * 3 tools total.
 */

import { z } from "zod";
import type { MySQLAdapter } from "../../MySQLAdapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";

// =============================================================================
// Schemas
// =============================================================================

const CorrelationSchema = z.object({
  table: z.string().describe("Table name"),
  column1: z.string().describe("First numeric column"),
  column2: z.string().describe("Second numeric column"),
  where: z.string().optional().describe("Optional WHERE clause condition"),
});

const RegressionSchema = z.object({
  table: z.string().describe("Table name"),
  xColumn: z.string().describe("Independent variable column"),
  yColumn: z.string().describe("Dependent variable column"),
  where: z.string().optional().describe("Optional WHERE clause condition"),
});

const HistogramSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Column for histogram"),
  buckets: z
    .number()
    .default(16)
    .describe("Number of histogram buckets (max 1024)"),
  update: z
    .boolean()
    .default(false)
    .describe("Whether to create/update the histogram"),
});

// =============================================================================
// Tool Creation Functions
// =============================================================================

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
    inputSchema: CorrelationSchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { table, column1, column2, where } =
        CorrelationSchema.parse(params);

      // Validate identifiers
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
        throw new Error("Invalid table name");
      }
      if (
        !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column1) ||
        !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column2)
      ) {
        throw new Error("Invalid column name");
      }

      const whereClause = where ? `WHERE ${where}` : "";

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

      try {
        const result = await adapter.executeQuery(query);
        const stats = result.rows?.[0];

        const correlation = stats?.["correlation"] as number | null;
        let interpretation = "N/A";
        if (correlation !== null) {
          const absCorr = Math.abs(correlation);
          if (absCorr >= 0.9) interpretation = "Very strong";
          else if (absCorr >= 0.7) interpretation = "Strong";
          else if (absCorr >= 0.5) interpretation = "Moderate";
          else if (absCorr >= 0.3) interpretation = "Weak";
          else interpretation = "Very weak / No correlation";
        }

        return {
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
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes("doesn't exist")) {
          return { exists: false, table };
        }
        return { success: false, error: msg };
      }
    },
  };
}

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
    inputSchema: RegressionSchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { table, xColumn, yColumn, where } = RegressionSchema.parse(params);

      // Validate identifiers
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
        throw new Error("Invalid table name");
      }
      if (
        !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(xColumn) ||
        !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(yColumn)
      ) {
        throw new Error("Invalid column name");
      }

      const whereClause = where ? `WHERE ${where}` : "";

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
                FROM \`${table}\`
                ${whereClause}
            `;

      try {
        const result = await adapter.executeQuery(statsQuery);
        const stats = result.rows?.[0];

        if (!stats || (stats["n"] as number) < 2) {
          return {
            error: "Insufficient data points for regression (need at least 2)",
            sampleSize: stats?.["n"] ?? 0,
          };
        }

        const n = stats["n"] as number;
        const sumX = stats["sum_x"] as number;
        const sumY = stats["sum_y"] as number;
        const sumXY = stats["sum_xy"] as number;
        const sumX2 = stats["sum_x2"] as number;
        const sumY2 = stats["sum_y2"] as number;

        // Calculate slope and intercept
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;

        // Calculate R-squared
        const ssTotal = sumY2 - (sumY * sumY) / n;
        const ssResidual = sumY2 - intercept * sumY - slope * sumXY;
        const rSquared = ssTotal > 0 ? 1 - ssResidual / ssTotal : 0;

        return {
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
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes("doesn't exist")) {
          return { exists: false, table };
        }
        return { success: false, error: msg };
      }
    },
  };
}

/**
 * Column histogram management
 */
export function createHistogramTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_stats_histogram",
    title: "MySQL Histogram Statistics",
    description: "View or update column histogram statistics (MySQL 8.0+).",
    group: "stats",
    inputSchema: HistogramSchema,
    requiredScopes: ["read"], // read for view, admin for update
    annotations: {
      readOnlyHint: false, // Can update histogram
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { table, column, buckets, update } = HistogramSchema.parse(params);

      // Validate identifiers
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
        throw new Error("Invalid table name");
      }
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column)) {
        throw new Error("Invalid column name");
      }

      // Check if table exists (P154)
      const tableCheck = await adapter.executeQuery(
        `SELECT TABLE_NAME FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
        [table],
      );

      if (!tableCheck.rows || tableCheck.rows.length === 0) {
        return { exists: false, table };
      }

      if (update) {
        // Create or update histogram
        const numBuckets = Math.min(buckets, 1024);
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
        return {
          exists: false,
          message: update
            ? "Histogram created but not yet visible in metadata"
            : "No histogram exists for this column",
          table,
          column,
        };
      }

      const histogramRow = result.rows[0];
      if (!histogramRow) {
        return { exists: false, table, column };
      }
      return {
        exists: true,
        ...histogramRow,
        updated: update,
      };
    },
  };
}
