/**
 * MySQL Descriptive Statistics Tools
 *
 * Tools for basic statistical analysis: descriptive stats, percentiles,
 * distribution, time series, and sampling.
 * 5 tools total.
 */

import { z, ZodError } from "zod";
import { formatMysqlError, formatHandlerErrorResponse, withTokenEstimate } from "../core/error-helpers.js";
import type { MySQLAdapter } from "../../mysql-adapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";

// =============================================================================
// Helpers
// =============================================================================

// =============================================================================
// Schemas
// =============================================================================

const DescriptiveStatsSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  column: z.string().optional().describe("Numeric column name"),
  where: z.string().optional().describe("Optional WHERE clause condition"),
});

const DescriptiveStatsSchema = z.object({
  table: z.string().min(1, "table is required"),
  column: z.string().min(1, "column is required"),
  where: z.string().optional(),
});

const PercentilesSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  column: z.string().optional().describe("Numeric column name"),
  percentiles: z.unknown().optional().describe("Percentiles to calculate"),
  where: z.string().optional().describe("Optional WHERE clause condition"),
});

const PercentilesSchema = z.object({
  table: z.string().min(1, "table is required"),
  column: z.string().min(1, "column is required"),
  percentiles: z
    .array(z.number().min(0).max(100))
    .default([25, 50, 75, 90, 95, 99]),
  where: z.string().optional(),
});

const DistributionSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  column: z.string().optional().describe("Column to analyze"),
  buckets: z.unknown().optional().describe("Number of histogram buckets"),
  where: z.string().optional().describe("Optional WHERE clause condition"),
});

const DistributionSchema = z.object({
  table: z.string().min(1, "table is required"),
  column: z.string().min(1, "column is required"),
  buckets: z
    .number()
    .max(100)
    .default(10),
  where: z.string().optional(),
});

const TimeSeriesSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  valueColumn: z.string().optional().describe("Numeric column for values"),
  timeColumn: z.string().optional().describe("Timestamp/datetime column"),
  interval: z.string().optional().describe("Aggregation interval"),
  aggregation: z.string().optional().describe("Aggregation function"),
  where: z.string().optional().describe("Optional WHERE clause condition"),
  limit: z.unknown().optional().describe("Maximum number of data points"),
});

const TimeSeriesSchema = z.object({
  table: z.string().min(1, "table is required"),
  valueColumn: z.string().min(1, "valueColumn is required"),
  timeColumn: z.string().min(1, "timeColumn is required"),
  interval: z.string().default("day"),
  aggregation: z.string().default("avg"),
  where: z.string().optional(),
  limit: z.number().default(100),
});

const SamplingSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  sampleSize: z.unknown().optional().describe("Number of rows to sample"),
  columns: z.unknown().optional().describe("Columns to include (all if not specified)"),
  seed: z.unknown().optional().describe("Random seed for reproducibility"),
  where: z.string().optional().describe("Optional WHERE clause condition"),
});

const SamplingSchema = z.object({
  table: z.string().min(1, "table is required"),
  sampleSize: z.number().default(100),
  columns: z
    .array(z.string())
    .optional(),
  seed: z.number().optional(),
  where: z.string().optional(),
});

// =============================================================================
// Tool Creation Functions
// =============================================================================

/**
 * Calculate descriptive statistics
 */
export function createDescriptiveStatsTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_stats_descriptive",
    title: "MySQL Descriptive Statistics",
    description:
      "Calculate descriptive statistics (mean, median, stddev, min, max, count) for a numeric column.",
    group: "stats",
    inputSchema: DescriptiveStatsSchemaBase,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { table, column, where } = DescriptiveStatsSchema.parse(params);
        // Validate identifiers
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
          return withTokenEstimate({ success: false, error: "Invalid table name" });
        }
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column)) {
          return withTokenEstimate({ success: false, error: "Invalid column name" });
        }

        const whereClause = where ? `WHERE ${where}` : "";

        // Get basic count for median calculation
        const countResult = await adapter.executeQuery(
          `SELECT COUNT(*) as count FROM \`${table}\` ${whereClause}`,
        );
        const totalCount = (countResult.rows?.[0]?.["count"] as number) ?? 0;

        if (totalCount === 0) {
          return withTokenEstimate({
            success: true,
            data: {
              column,
              count: 0,
              mean: null,
              median: null,
              stddev: null,
              variance: null,
              min: null,
              max: null,
              range: null,
              sum: null,
            }
          });
        }

        // Calculate median offset/limit
        const limit = 2 - (totalCount % 2);
        const offset = Math.floor((totalCount - 1) / 2);

        const medianQuery = `
                SELECT AVG(val) as median
                FROM (
                    SELECT \`${column}\` as val
                    FROM \`${table}\`
                    ${whereClause}
                    ORDER BY \`${column}\`
                    LIMIT ${String(limit)}
                    OFFSET ${String(offset)}
                ) as median_calc
            `;

        const query = `
                SELECT
                    COUNT(\`${column}\`) as count,
                    AVG(\`${column}\`) as mean,
                    STD(\`${column}\`) as stddev,
                    VAR_POP(\`${column}\`) as variance,
                    MIN(\`${column}\`) as min,
                    MAX(\`${column}\`) as max,
                    MAX(\`${column}\`) - MIN(\`${column}\`) as \`range\`,
                    SUM(\`${column}\`) as sum
                FROM \`${table}\`
                ${whereClause}
            `;

        const [statsResult, medianResult] = await Promise.all([
          adapter.executeQuery(query),
          adapter.executeQuery(medianQuery),
        ]);

        const stats = statsResult.rows?.[0];
        const medianRow = medianResult.rows?.[0];

        return withTokenEstimate({
          success: true,
          data: {
            column,
            count: stats?.["count"] ?? 0,
            mean: stats?.["mean"] ?? null,
            median: medianRow?.["median"] ?? null,
            stddev: stats?.["stddev"] ?? null,
            variance: stats?.["variance"] ?? null,
            min: stats?.["min"] ?? null,
            max: stats?.["max"] ?? null,
            range: stats?.["range"] ?? null,
            sum: stats?.["sum"] ?? null,
          }
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

/**
 * Calculate percentiles
 */
export function createPercentilesTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_stats_percentiles",
    title: "MySQL Percentiles",
    description: "Calculate percentile values for a numeric column.",
    group: "stats",
    inputSchema: PercentilesSchemaBase,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { table, column, percentiles, where } =
          PercentilesSchema.parse(params);
        // Validate identifiers
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
          return withTokenEstimate({ success: false, error: "Invalid table name" });
        }
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column)) {
          return withTokenEstimate({ success: false, error: "Invalid column name" });
        }

        const whereClause = where ? `WHERE ${where}` : "";

        // Check if column is numeric
        const colCheck = await adapter.executeQuery(
          `SELECT DATA_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
          [table, column],
        );
        const dataTypeVal = colCheck.rows?.[0]?.["DATA_TYPE"];
        const dataType =
          typeof dataTypeVal === "string" ? dataTypeVal.toLowerCase() : "";
        // Empty result means column doesn't exist; non-empty result with non-numeric type means wrong type
        if (!colCheck.rows || colCheck.rows.length === 0) {
          return withTokenEstimate({
            success: false,
            error: `Column '${column}' not found on table '${table}'`,
          });
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
          return withTokenEstimate({
            success: false,
            error: `Column type mismatch: '${column}' is not a numeric column (type: ${dataType})`,
          });
        }

        // Get total count
        const countResult = await adapter.executeQuery(
          `SELECT COUNT(*) as cnt FROM \`${table}\` ${whereClause}`,
        );
        const totalCount = (countResult.rows?.[0]?.["cnt"] as number) ?? 0;

        if (totalCount === 0) {
          return withTokenEstimate({
            success: true,
            data: {
              column,
              totalCount: 0,
              percentiles: {},
            }
          });
        }

        // Calculate each percentile
        const percentileResults: Record<string, unknown> = {};

        for (const p of percentiles) {
          const offset = Math.floor((p / 100) * (totalCount - 1));
          const query = `
                    SELECT \`${column}\` as value
                    FROM \`${table}\`
                    ${whereClause}
                    ORDER BY \`${column}\`
                    LIMIT 1 OFFSET ${String(offset)}
                `;

          const result = await adapter.executeQuery(query);
          const valueRow = result.rows?.[0];
          percentileResults[`p${String(p)}`] = valueRow?.["value"] ?? null;
        }

        return withTokenEstimate({
          success: true,
          data: {
            column,
            totalCount,
            percentiles: percentileResults,
          }
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
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { table, column, buckets, where } =
          DistributionSchema.parse(params);
        // Validate identifiers
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
          return withTokenEstimate({ success: false, error: "Invalid table name" });
        }
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column)) {
          return withTokenEstimate({ success: false, error: "Invalid column name" });
        }
        if (buckets < 1) {
          return withTokenEstimate({ success: false, error: "buckets must be at least 1" });
        }

        const whereClause = where ? `WHERE ${where}` : "";

        // Get min/max for bucket calculation
        const rangeResult = await adapter.executeQuery(
          `SELECT MIN(\`${column}\`) as min_val, MAX(\`${column}\`) as max_val FROM \`${table}\` ${whereClause}`,
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
            }
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
                FROM \`${table}\`
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
          }
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

/**
 * Time series analysis with moving averages
 */
export function createTimeSeriesToolStats(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_stats_time_series",
    title: "MySQL Time Series Analysis",
    description:
      "Aggregate and analyze time series data with specified intervals.",
    group: "stats",
    inputSchema: TimeSeriesSchemaBase,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const {
          table,
          valueColumn,
          timeColumn,
          interval,
          aggregation,
          where,
          limit,
        } = TimeSeriesSchema.parse(params);

        // Validate identifiers
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
          return withTokenEstimate({ success: false, error: "Invalid table name" });
        }
        if (
          !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(valueColumn) ||
          !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(timeColumn)
        ) {
          return withTokenEstimate({ success: false, error: "Invalid column name" });
        }

        const validIntervals = ["minute", "hour", "day", "week", "month"];
        if (!validIntervals.includes(interval)) {
          return withTokenEstimate({
            success: false,
            error: `Invalid interval: '${interval}' — expected one of: ${validIntervals.join(", ")}`,
          });
        }
        const validAggregations = ["avg", "sum", "count", "min", "max"];
        if (!validAggregations.includes(aggregation)) {
          return withTokenEstimate({
            success: false,
            error: `Invalid aggregation: '${aggregation}' — expected one of: ${validAggregations.join(", ")}`,
          });
        }

        let dateFormat: string;
        switch (interval) {
          case "minute":
            dateFormat = "%Y-%m-%d %H:%i:00";
            break;
          case "hour":
            dateFormat = "%Y-%m-%d %H:00:00";
            break;
          case "day":
            dateFormat = "%Y-%m-%d";
            break;
          case "week":
            dateFormat = "%x-W%v";
            break;
          case "month":
            dateFormat = "%Y-%m";
            break;
          default:
            dateFormat = "%Y-%m-%d";
        }

        const whereClause = where ? `WHERE ${where}` : "";
        const aggFunc = aggregation.toUpperCase();

        const query = `
                SELECT
                    DATE_FORMAT(\`${timeColumn}\`, '${dateFormat}') as period,
                    ${aggFunc}(\`${valueColumn}\`) as value,
                    COUNT(*) as data_points,
                    MIN(\`${valueColumn}\`) as period_min,
                    MAX(\`${valueColumn}\`) as period_max
                FROM \`${table}\`
                ${whereClause}
                GROUP BY period
                ORDER BY period DESC
                LIMIT ${String(limit)}
            `;
        const result = await adapter.executeQuery(query);

        return withTokenEstimate({
          success: true,
          data: {
            interval,
            aggregation,
            valueColumn,
            timeColumn,
            dataPoints: result.rows ?? [],
            count: result.rows?.length ?? 0,
          }
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

/**
 * Random sampling
 */
export function createSamplingTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_stats_sampling",
    title: "MySQL Random Sampling",
    description: "Get a random sample of rows from a table.",
    group: "stats",
    inputSchema: SamplingSchemaBase,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: false, // Random results
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { table, sampleSize, columns, seed, where } =
          SamplingSchema.parse(params);

        if (sampleSize < 0) {
          return withTokenEstimate({ success: false, error: "sampleSize must be >= 0" });
        }

        // Validate table name
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
          return withTokenEstimate({ success: false, error: "Invalid table name" });
        }

        // Validate column names if provided
        if (columns) {
          for (const c of columns) {
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(c)) {
              return withTokenEstimate({ success: false, error: `Invalid column name: ${c}` });
            }
          }
        }

        const columnList =
          columns !== undefined && columns.length > 0
            ? columns
                .map((c) => {
                  return `\`${c}\``;
                })
                .join(", ")
            : "*";

        const whereClause = where ? `WHERE ${where}` : "";

        // If seed is provided, use it for reproducibility
        let query: string;
        if (seed !== undefined) {
          query = `
                    SELECT ${columnList}
                    FROM \`${table}\`
                    ${whereClause}
                    ORDER BY RAND(${String(seed)})
                    LIMIT ${String(sampleSize)}
                `;
        } else {
          query = `
                    SELECT ${columnList}
                    FROM \`${table}\`
                    ${whereClause}
                    ORDER BY RAND()
                    LIMIT ${String(sampleSize)}
                `;
        }
        const result = await adapter.executeQuery(query);

        return withTokenEstimate({
          success: true,
          data: {
            sample: result.rows ?? [],
            sampleSize: result.rows?.length ?? 0,
            requestedSize: sampleSize,
            seed: seed ?? null,
          }
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
