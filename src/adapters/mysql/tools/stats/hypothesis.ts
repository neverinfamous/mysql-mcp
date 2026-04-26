/**
 * MySQL Statistics Tools - Hypothesis Testing
 *
 * Perform one-sample t-test or z-test against a hypothesized mean.
 */

import { z, ZodError } from "zod";
import type { MySQLAdapter } from "../../mysql-adapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import { formatHandlerErrorResponse, formatMysqlError } from "../core/error-helpers.js";
import {
  calculateTTestPValue,
  calculateZTestPValue,
} from "./math-utils.js";

// =============================================================================
// Schemas
// =============================================================================

export const StatsHypothesisSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Numeric column to test"),
  testType: z.enum(["t_test", "z_test"]).describe("Type of test to perform"),
  hypothesizedMean: z.number().describe("Null hypothesis mean to test against"),
  populationStdDev: z.number().optional().describe("Known population standard deviation (for z-test)"),
  groupBy: z.string().optional().describe("Column to group results by"),
  where: z.string().optional().describe("Filter condition"),
});

// =============================================================================
// Tool Definition
// =============================================================================

/**
 * Hypothesis testing (t-test or z-test)
 */
export function createStatsHypothesisTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_stats_hypothesis",
    description:
      "Perform one-sample t-test or z-test against a hypothesized mean. For z-test, provide populationStdDev (sigma) for accurate results. Use groupBy to test each group separately.",
    group: "stats",
    inputSchema: StatsHypothesisSchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const {
          table,
          column,
          testType,
          hypothesizedMean,
          populationStdDev,
          where,
          groupBy,
        } = StatsHypothesisSchema.parse(params);

        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
          return { success: false, error: "Invalid table name" };
        }
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column)) {
          return { success: false, error: "Invalid column name" };
        }
        if (groupBy && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(groupBy)) {
          return { success: false, error: "Invalid groupBy column name" };
        }

        const whereClause = where ? `WHERE ${where}` : "";

        // Helper to calculate test results from row stats
        const calculateTestResults = (
          n: number,
          sampleMean: number,
          sampleStdDev: number,
        ):
          | {
              sampleSize: number;
              sampleMean: number;
              sampleStdDev: number;
              populationStdDev: number | null;
              standardError: number;
              testStatistic: number;
              pValue: number;
              degreesOfFreedom: number | null;
              interpretation: string;
              note: string;
            }
          | { error: string; sampleSize: number } => {
          if (n < 2 || isNaN(sampleStdDev) || sampleStdDev === 0) {
            return {
              error: "Insufficient data or zero variance",
              sampleSize: n,
            };
          }

          let stddevUsed: number;
          let stddevNote: string | undefined;

          if (testType === "z_test") {
            if (populationStdDev !== undefined) {
              stddevUsed = populationStdDev;
            } else {
              stddevUsed = sampleStdDev;
              stddevNote =
                "No populationStdDev provided; using sample stddev (less accurate for z-test)";
            }
          } else {
            stddevUsed = sampleStdDev;
          }

          const standardError = stddevUsed / Math.sqrt(n);
          const testStatistic = (sampleMean - hypothesizedMean) / standardError;
          const degreesOfFreedom = n - 1;

          // Calculate p-value based on test type
          const pValue =
            testType === "z_test"
              ? calculateZTestPValue(testStatistic)
              : calculateTTestPValue(testStatistic, degreesOfFreedom);

          // Round p-value to 6 decimal places for cleaner output
          const pValueRounded = Math.round(pValue * 1e6) / 1e6;

          // Determine significance based on p-value
          let interpretation: string;
          if (pValueRounded < 0.001) {
            interpretation =
              "Highly significant (p < 0.001): Strong evidence against the null hypothesis";
          } else if (pValueRounded < 0.01) {
            interpretation =
              "Very significant (p < 0.01): Strong evidence against the null hypothesis";
          } else if (pValueRounded < 0.05) {
            interpretation =
              "Significant (p < 0.05): Evidence against the null hypothesis at α=0.05 level";
          } else if (pValueRounded < 0.1) {
            interpretation =
              "Marginally significant (p < 0.1): Weak evidence against the null hypothesis";
          } else {
            interpretation =
              "Not significant (p >= 0.1): Insufficient evidence to reject the null hypothesis";
          }

          // Build note with warnings
          let noteText =
            stddevNote ??
            "Two-tailed p-value calculated using numerical approximation";
          if (n < 30) {
            noteText =
              `Small sample size (n=${String(n)}): results may be less reliable. ` +
              noteText;
          }

          return {
            sampleSize: n,
            sampleMean,
            sampleStdDev,
            populationStdDev:
              testType === "z_test" ? (populationStdDev ?? null) : null,
            standardError,
            testStatistic,
            pValue: pValueRounded,
            degreesOfFreedom: testType === "t_test" ? degreesOfFreedom : null,
            interpretation,
            note: noteText,
          };
        };

        if (groupBy !== undefined) {
          // Grouped hypothesis tests
          const sql = `
                    SELECT
                        \`${groupBy}\` as group_key,
                        COUNT(\`${column}\`) as n,
                        AVG(\`${column}\`) as mean,
                        STDDEV_SAMP(\`${column}\`) as stddev
                    FROM \`${table}\`
                    ${whereClause}
                    GROUP BY \`${groupBy}\`
                    ORDER BY \`${groupBy}\`
                `;

          const result = await adapter.executeQuery(sql);
          const rows = result.rows ?? [];

          const groups = rows.map((row) => {
            const n = Number(row["n"]);
            const sampleMean = Number(row["mean"]);
            const sampleStdDev = Number(row["stddev"]);
            return {
              groupKey: row["group_key"],
              results: calculateTestResults(n, sampleMean, sampleStdDev),
            };
          });

          return {
            success: true,
            table,
            column,
            testType,
            hypothesizedMean,
            groupBy,
            groups,
            count: groups.length,
          };
        }

        // Ungrouped hypothesis test
        const sql = `
                SELECT
                    COUNT(\`${column}\`) as n,
                    AVG(\`${column}\`) as mean,
                    STDDEV_SAMP(\`${column}\`) as stddev
                FROM \`${table}\`
                ${whereClause}
            `;

        const result = await adapter.executeQuery(sql);
        const row = result.rows?.[0] as
          | {
              n: string | number;
              mean: string | number;
              stddev: string | number;
            }
          | undefined;
          
        if (!row) return { success: false, error: "No data found" };

        const n = Number(row.n);
        const sampleMean = Number(row.mean);
        const sampleStdDev = Number(row.stddev);

        const testResults = calculateTestResults(n, sampleMean, sampleStdDev);

        // If error, return at top level (not nested in results)
        if ("error" in testResults) {
          return { success: false, error: testResults.error };
        }

        return {
          success: true,
          table,
          column,
          testType,
          hypothesizedMean,
          results: testResults,
        };
      } catch (error: unknown) {
        if (error instanceof ZodError) return formatHandlerErrorResponse(error);
        const msg = formatMysqlError(error);
        if (msg.includes("doesn't exist")) {
           return { success: false, error: `Table '${((params as Record<string, unknown>)?.["table"] as string) ?? "unknown"}' doesn't exist` };
        }
        return formatHandlerErrorResponse(error);
      }
    },
  };
}
