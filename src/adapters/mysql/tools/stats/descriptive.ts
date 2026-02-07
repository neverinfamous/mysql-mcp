/**
 * MySQL Descriptive Statistics Tools
 *
 * Tools for basic statistical analysis: descriptive stats, percentiles,
 * distribution, time series, and sampling.
 * 5 tools total.
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

const DescriptiveStatsSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Numeric column name"),
  where: z.string().optional().describe("Optional WHERE clause condition"),
});

const PercentilesSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Numeric column name"),
  percentiles: z
    .array(z.number().min(0).max(100))
    .default([25, 50, 75, 90, 95, 99])
    .describe("Percentiles to calculate"),
  where: z.string().optional().describe("Optional WHERE clause condition"),
});

const DistributionSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Column to analyze"),
  buckets: z.number().default(10).describe("Number of histogram buckets"),
  where: z.string().optional().describe("Optional WHERE clause condition"),
});

const TimeSeriesSchema = z.object({
  table: z.string().describe("Table name"),
  valueColumn: z.string().describe("Numeric column for values"),
  timeColumn: z.string().describe("Timestamp/datetime column"),
  interval: z
    .enum(["minute", "hour", "day", "week", "month"])
    .default("day")
    .describe("Aggregation interval"),
  aggregation: z
    .enum(["avg", "sum", "count", "min", "max"])
    .default("avg")
    .describe("Aggregation function"),
  where: z.string().optional().describe("Optional WHERE clause condition"),
  limit: z.number().default(100).describe("Maximum number of data points"),
});

const SamplingSchema = z.object({
  table: z.string().describe("Table name"),
  sampleSize: z.number().default(100).describe("Number of rows to sample"),
  columns: z
    .array(z.string())
    .optional()
    .describe("Columns to include (all if not specified)"),
  seed: z.number().optional().describe("Random seed for reproducibility"),
  where: z.string().optional().describe("Optional WHERE clause condition"),
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
    inputSchema: DescriptiveStatsSchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { table, column, where } = DescriptiveStatsSchema.parse(params);

      // Validate identifiers
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
        throw new Error("Invalid table name");
      }
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column)) {
        throw new Error("Invalid column name");
      }

      const whereClause = where ? `WHERE ${where}` : "";

      try {
        // Get basic count for median calculation
        const countResult = await adapter.executeQuery(
          `SELECT COUNT(*) as count FROM \`${table}\` ${whereClause}`,
        );
        const totalCount = (countResult.rows?.[0]?.["count"] as number) ?? 0;

        if (totalCount === 0) {
          return {
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
          };
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

        return {
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
 * Calculate percentiles
 */
export function createPercentilesTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_stats_percentiles",
    title: "MySQL Percentiles",
    description: "Calculate percentile values for a numeric column.",
    group: "stats",
    inputSchema: PercentilesSchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { table, column, percentiles, where } =
        PercentilesSchema.parse(params);

      // Validate identifiers
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
        throw new Error("Invalid table name");
      }
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column)) {
        throw new Error("Invalid column name");
      }

      const whereClause = where ? `WHERE ${where}` : "";

      try {
        // Get total count
        const countResult = await adapter.executeQuery(
          `SELECT COUNT(*) as cnt FROM \`${table}\` ${whereClause}`,
        );
        const totalCount = (countResult.rows?.[0]?.["cnt"] as number) ?? 0;

        if (totalCount === 0) {
          return {
            column,
            totalCount: 0,
            percentiles: {},
          };
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

        return {
          column,
          totalCount,
          percentiles: percentileResults,
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
 * Analyze data distribution
 */
export function createDistributionTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_stats_distribution",
    title: "MySQL Distribution Analysis",
    description:
      "Analyze the distribution of values in a column with histogram buckets.",
    group: "stats",
    inputSchema: DistributionSchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { table, column, buckets, where } =
        DistributionSchema.parse(params);

      // Validate identifiers
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
        throw new Error("Invalid table name");
      }
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column)) {
        throw new Error("Invalid column name");
      }

      const whereClause = where ? `WHERE ${where}` : "";

      try {
        // Get min/max for bucket calculation
        const rangeResult = await adapter.executeQuery(
          `SELECT MIN(\`${column}\`) as min_val, MAX(\`${column}\`) as max_val FROM \`${table}\` ${whereClause}`,
        );

        const rangeRow = rangeResult.rows?.[0];
        const minVal = Number(rangeRow?.["min_val"]) || 0;
        const maxVal = Number(rangeRow?.["max_val"]) || 0;

        if (minVal === maxVal) {
          return {
            column,
            distribution: [
              { bucket: 0, rangeStart: minVal, rangeEnd: maxVal, count: 1 },
            ],
            bucketCount: 1,
            minValue: minVal,
            maxValue: maxVal,
          };
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
            count: r["count"] as number,
            bucketMin: r["bucket_min"],
            bucketMax: r["bucket_max"],
          };
        });

        return {
          column,
          distribution,
          bucketCount: buckets,
          bucketSize,
          minValue: minVal,
          maxValue: maxVal,
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
    inputSchema: TimeSeriesSchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
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
        throw new Error("Invalid table name");
      }
      if (
        !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(valueColumn) ||
        !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(timeColumn)
      ) {
        throw new Error("Invalid column name");
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

      try {
        const result = await adapter.executeQuery(query);

        return {
          interval,
          aggregation,
          valueColumn,
          timeColumn,
          dataPoints: result.rows ?? [],
          count: result.rows?.length ?? 0,
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
 * Random sampling
 */
export function createSamplingTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_stats_sampling",
    title: "MySQL Random Sampling",
    description: "Get a random sample of rows from a table.",
    group: "stats",
    inputSchema: SamplingSchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: false, // Random results
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { table, sampleSize, columns, seed, where } =
        SamplingSchema.parse(params);

      // Validate table name
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
        throw new Error("Invalid table name");
      }

      // Validate column names if provided
      const columnList =
        columns !== undefined && columns.length > 0
          ? columns
              .map((c) => {
                if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(c)) {
                  throw new Error(`Invalid column name: ${c}`);
                }
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

      try {
        const result = await adapter.executeQuery(query);

        return {
          sample: result.rows ?? [],
          sampleSize: result.rows?.length ?? 0,
          requestedSize: sampleSize,
          seed: seed ?? null,
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
