/**
 * MySQL Statistics Tools - Outlier Detection
 *
 * Detect statistical outliers using IQR or Z-score methods.
 * 1 tool total.
 */

import { z, ZodError } from "zod";
import type { MySQLAdapter } from "../../mysql-adapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import {
  formatHandlerErrorResponse,
  formatMysqlError,
} from "../core/error-helpers.js";

// =============================================================================
// Schemas
// =============================================================================

export const StatsOutliersSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Numeric column to check for outliers"),
  method: z
    .enum(["iqr", "zscore"])
    .default("iqr")
    .describe("Detection method to use"),
  threshold: z
    .number()
    .optional()
    .describe("Multiplier threshold (default: 1.5 for IQR, 3.0 for Z-score)"),
  where: z.string().optional().describe("Filter condition"),
  limit: z
    .number()
    .max(100000)
    .default(10000)
    .describe("Maximum rows to process (default: 10000)"),
  maxOutliers: z
    .number()
    .max(1000)
    .default(50)
    .describe("Maximum number of outliers to return (default: 50)"),
});

// =============================================================================
// Tool Definition
// =============================================================================

/**
 * Outlier detection via IQR or Z-score
 */
export function createStatsOutliersTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_stats_outliers",
    description:
      "Detect statistical outliers in a numeric column using IQR (interquartile range) or Z-score method. IQR is robust against non-normal distributions.",
    group: "stats",
    inputSchema: StatsOutliersSchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const parsed = StatsOutliersSchema.parse(params);

        const { table, column, method, limit, maxOutliers, where } = parsed;

        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
          return { success: false, error: "Invalid table name" };
        }
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column)) {
          return { success: false, error: "Invalid column name" };
        }

        const whereClause = where ? `WHERE ${where}` : "";

        if (method === "zscore") {
          return await detectZScoreOutliers(
            adapter,
            { table, column, whereClause },
            parsed.threshold ?? 3,
            limit,
            maxOutliers,
          );
        }

        return await detectIqrOutliers(
          adapter,
          { table, column, whereClause },
          parsed.threshold ?? 1.5,
          limit,
          maxOutliers,
        );
      } catch (error: unknown) {
        if (error instanceof ZodError) return formatHandlerErrorResponse(error);
        const msg = formatMysqlError(error);
        if (msg.includes("doesn't exist")) {
          return {
            success: false,
            error: `Table '${((params as Record<string, unknown>)?.["table"] as string) ?? "unknown"}' doesn't exist`,
          };
        }
        return formatHandlerErrorResponse(error);
      }
    },
  };
}

// =============================================================================
// Z-Score Detection
// =============================================================================

interface QueryParts {
  table: string;
  column: string;
  whereClause: string;
}

async function detectZScoreOutliers(
  adapter: MySQLAdapter,
  parts: QueryParts,
  threshold: number,
  limit: number,
  maxOutliers: number,
): Promise<Record<string, unknown>> {
  const { table, column, whereClause } = parts;

  // Get statistics
  const statsSql = `
    SELECT
      AVG(\`${column}\`) AS mean,
      STDDEV_SAMP(\`${column}\`) AS stddev,
      COUNT(\`${column}\`) AS total_count
    FROM \`${table}\`
    ${whereClause}
  `;
  const statsResult = await adapter.executeQuery(statsSql);
  const statsRow = statsResult.rows?.[0] as
    | { mean: unknown; stddev: unknown; total_count: unknown }
    | undefined;

  if (statsRow?.mean == null || statsRow.stddev == null) {
    return {
      success: true,
      method: "zscore",
      outlierCount: 0,
      totalRows: 0,
      stats: { mean: 0, stdDev: 0, lowerBound: 0, upperBound: 0 },
    };
  }

  const mean = Number(statsRow.mean);
  const stdDev = Number(statsRow.stddev);
  const totalRows = Number(statsRow.total_count);

  if (stdDev === 0) {
    return {
      success: true,
      method: "zscore",
      stats: { mean, stdDev: 0, lowerBound: mean, upperBound: mean },
      outlierCount: 0,
      totalRows,
    };
  }

  const lowerBound = mean - threshold * stdDev;
  const upperBound = mean + threshold * stdDev;

  // Find outliers — values outside threshold standard deviations
  const outlierSql = `
    SELECT \`${column}\` AS value
    FROM \`${table}\`
    ${whereClause ? whereClause + " AND" : "WHERE"}
      ABS((\`${column}\` - ${String(mean)}) / ${String(stdDev)}) > ${String(threshold)}
    ORDER BY ABS(\`${column}\` - ${String(mean)}) DESC
    LIMIT ${String(limit)}
  `;

  const outlierResult = await adapter.executeQuery(outlierSql);
  const allOutliers = (outlierResult.rows ?? []).map((row) => ({
    value: Number((row as { value: unknown }).value),
  }));

  const truncated = allOutliers.length > maxOutliers;
  const outliers = truncated ? allOutliers.slice(0, maxOutliers) : allOutliers;

  const response: Record<string, unknown> = {
    success: true,
    method: "zscore",
    stats: { mean, stdDev, lowerBound, upperBound },
    outlierCount: outliers.length,
    totalRows,
    outliers,
  };

  if (truncated) {
    response["truncated"] = true;
    response["totalOutliers"] = allOutliers.length;
  }

  return response;
}

// =============================================================================
// IQR Detection
// =============================================================================

async function detectIqrOutliers(
  adapter: MySQLAdapter,
  parts: QueryParts,
  multiplier: number,
  limit: number,
  maxOutliers: number,
): Promise<Record<string, unknown>> {
  const { table, column, whereClause } = parts;

  // Get count to calculate offsets for Q1 (25th percentile) and Q3 (75th percentile)
  const countSql = `
    SELECT COUNT(\`${column}\`) AS total_count
    FROM \`${table}\`
    ${whereClause}
  `;
  const countResult = await adapter.executeQuery(countSql);
  const countRow = countResult.rows?.[0] as
    | { total_count: unknown }
    | undefined;

  const totalRows = Number(countRow?.total_count ?? 0);

  if (totalRows === 0) {
    return {
      success: true,
      method: "iqr",
      outlierCount: 0,
      totalRows: 0,
      stats: { q1: 0, q3: 0, iqr: 0, lowerBound: 0, upperBound: 0 },
    };
  }

  const getPercentile = async (p: number): Promise<number> => {
    const offset = Math.floor((p / 100) * (totalRows - 1));
    const query = `
      SELECT \`${column}\` as value
      FROM \`${table}\`
      ${whereClause}
      ORDER BY \`${column}\`
      LIMIT 1 OFFSET ${String(offset)}
    `;
    const result = await adapter.executeQuery(query);
    return Number(result.rows?.[0]?.["value"] ?? 0);
  };

  const q1 = await getPercentile(25);
  const q3 = await getPercentile(75);

  const iqr = q3 - q1;

  const lowerBound = q1 - multiplier * iqr;
  const upperBound = q3 + multiplier * iqr;

  // Find outliers — values outside IQR fences
  const outlierSql = `
    SELECT \`${column}\` AS value
    FROM \`${table}\`
    ${whereClause ? whereClause + " AND" : "WHERE"}
      (\`${column}\` < ${String(lowerBound)} OR \`${column}\` > ${String(upperBound)})
    ORDER BY ABS(\`${column}\` - ${String((q1 + q3) / 2)}) DESC
    LIMIT ${String(limit)}
  `;

  const outlierResult = await adapter.executeQuery(outlierSql);
  const allOutliers = (outlierResult.rows ?? []).map((row) => ({
    value: Number((row as { value: unknown }).value),
  }));

  const truncated = allOutliers.length > maxOutliers;
  const outliers = truncated ? allOutliers.slice(0, maxOutliers) : allOutliers;

  const response: Record<string, unknown> = {
    success: true,
    method: "iqr",
    stats: { q1, q3, iqr, lowerBound, upperBound },
    outlierCount: outliers.length,
    totalRows,
    outliers,
  };

  if (truncated) {
    response["truncated"] = true;
    response["totalOutliers"] = allOutliers.length;
  }

  return response;
}
