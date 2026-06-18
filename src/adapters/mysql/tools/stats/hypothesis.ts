/**
 * MySQL Statistics Tools - Hypothesis Testing
 *
 * Perform one-sample t-test or z-test against a hypothesized mean.
 */

import { z } from "zod";
import type { MySQLAdapter } from "../../mysql-adapter/index.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "../core/error-helpers.js";
import { calculateTTestPValue, calculateZTestPValue } from "./math-utils.js";
import { TTestOutputSchema } from "../../schemas/stats.js";
import { READ_ONLY } from "../../../../utils/annotations.js";

// =============================================================================
// Schemas
// =============================================================================

export const StatsHypothesisSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  column: z.string().optional().describe("Numeric column to test"),
  testType: z.unknown().optional().describe("Type of test to perform"),
  hypothesizedMean: z.unknown().optional().describe("Null hypothesis mean to test against"),
  populationStdDev: z.unknown().optional().describe("Known population standard deviation (for z-test)"),
  groupBy: z.string().optional().describe("Column to group results by (for multiple one-sample tests)"),
  groupColumn: z.string().optional().describe("Column containing the two groups (for two-sample test)"),
  group1: z.unknown().optional().describe("First group value"),
  group2: z.unknown().optional().describe("Second group value"),
  where: z.string().optional().describe("Filter condition"),
});

export const StatsHypothesisSchema = z.preprocess(
  (val: unknown) => {
    if (val === null || typeof val !== "object") return val;
    const obj = val as Record<string, unknown>;
    return {
      ...obj,
      table: obj["table"] ?? obj["tableName"] ?? obj["name"],
      column: obj["column"] ?? obj["col"],
    };
  },
  z.object({
    table: z.string().min(1, "table is required"),
    column: z.string().min(1, "column is required"),
    testType: z.enum(["t_test", "z_test"]).default("t_test"),
    hypothesizedMean: z.number().default(0),
    populationStdDev: z.number().optional(),
    groupBy: z.string().optional(),
    groupColumn: z.string().optional(),
    group1: z.union([z.string(), z.number()]).optional(),
    group2: z.union([z.string(), z.number()]).optional(),
    where: z.string().optional(),
  })
);

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
    title: "Stats Hypothesis",
    description:
      "Perform one-sample t-test or z-test against a hypothesized mean. For z-test, provide populationStdDev (sigma) for accurate results. Use groupBy to test each group separately.",
    group: "stats",
    inputSchema: StatsHypothesisSchemaBase,
    outputSchema: TTestOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
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
          groupColumn,
          group1,
          group2,
        } = StatsHypothesisSchema.parse(params);

        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
          return withTokenEstimate({ success: false, code: "VALIDATION_ERROR", error: "Invalid table name" });
        }
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column)) {
          return withTokenEstimate({ success: false, code: "VALIDATION_ERROR", error: "Invalid column name" });
        }
        if (groupBy && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(groupBy)) {
          return withTokenEstimate({ success: false, code: "VALIDATION_ERROR", error: "Invalid groupBy column name" });
        }
        if (groupColumn && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(groupColumn)) {
          return withTokenEstimate({ success: false, code: "VALIDATION_ERROR", error: "Invalid groupColumn name" });
        }

        const whereClause = where ? `WHERE ${where}` : "";

        const formatInterpretation = (pValueRounded: number): string => {
          if (pValueRounded < 0.001) return "Highly significant (p < 0.001): Strong evidence against the null hypothesis";
          if (pValueRounded < 0.01) return "Very significant (p < 0.01): Strong evidence against the null hypothesis";
          if (pValueRounded < 0.05) return "Significant (p < 0.05): Evidence against the null hypothesis at α=0.05 level";
          if (pValueRounded < 0.1) return "Marginally significant (p < 0.1): Weak evidence against the null hypothesis";
          return "Not significant (p >= 0.1): Insufficient evidence to reject the null hypothesis";
        };

        // Two-sample test
        if (groupColumn && group1 !== undefined && group2 !== undefined) {
          const sql = `
              SELECT
                  \`${groupColumn}\` as group_key,
                  COUNT(\`${column}\`) as n,
                  AVG(\`${column}\`) as mean,
                  STDDEV_SAMP(\`${column}\`) as stddev
              FROM \`${table}\`
              ${whereClause ? whereClause + ' AND ' : 'WHERE '} \`${groupColumn}\` IN (?, ?)
              GROUP BY \`${groupColumn}\`
          `;

          const result = await adapter.executeQuery(sql, [group1, group2]);
          const rows = result.rows ?? [];

          const group1Row = rows.find((r) => String(r["group_key"]) === String(group1));
          const group2Row = rows.find((r) => String(r["group_key"]) === String(group2));

          if (!group1Row || !group2Row) {
            return withTokenEstimate({ success: false, code: "VALIDATION_ERROR", error: "Could not find data for both groups" });
          }

          const n1 = Number(group1Row['n'] ?? 0);
          const mean1 = Number(group1Row['mean'] ?? 0);
          const stddev1 = Number(group1Row['stddev'] ?? 0);

          const n2 = Number(group2Row['n'] ?? 0);
          const mean2 = Number(group2Row['mean'] ?? 0);
          const stddev2 = Number(group2Row['stddev'] ?? 0);

          if (n1 < 2 || n2 < 2 || isNaN(stddev1) || isNaN(stddev2) || (stddev1 === 0 && stddev2 === 0)) {
            return withTokenEstimate({ success: false, code: "VALIDATION_ERROR", error: "Insufficient data or zero variance in groups" });
          }

          const var1 = stddev1 * stddev1;
          const var2 = stddev2 * stddev2;

          const standardError = Math.sqrt(var1 / n1 + var2 / n2);
          const hypMeanNum = hypothesizedMean;
          const testStatistic = (mean1 - mean2 - hypMeanNum) / standardError;

          const degreesOfFreedom = Math.pow(var1 / n1 + var2 / n2, 2) / (Math.pow(var1 / n1, 2) / (n1 - 1) + Math.pow(var2 / n2, 2) / (n2 - 1));

          const pValue = testType === "z_test"
            ? calculateZTestPValue(testStatistic)
            : calculateTTestPValue(testStatistic, degreesOfFreedom);

          const pValueRounded = Math.round(pValue * 1e6) / 1e6;

          return withTokenEstimate({
            success: true,
            data: {
              column,
              groupColumn,
              group1,
              group2,
              testType,
              tStat: testStatistic,
              degreesOfFreedom: testType === "t_test" ? degreesOfFreedom : null,
              pValue: pValueRounded,
              isSignificant: pValueRounded < 0.05,
              results: {
                interpretation: formatInterpretation(pValueRounded),
                n1, mean1, stddev1,
                n2, mean2, stddev2,
                meanDifference: mean1 - mean2
              }
            }
          });
        }

        // Helper for one-sample
        const calculateTestResults = (n: number, sampleMean: number, sampleStdDev: number): Record<string, unknown> => {
          if (n < 2 || isNaN(sampleStdDev) || sampleStdDev === 0) return { error: "Insufficient data or zero variance", sampleSize: n };
          const stddevUsed = testType === "z_test" && populationStdDev !== undefined ? populationStdDev : sampleStdDev;
          const standardError = stddevUsed / Math.sqrt(n);
          const hypMeanNum = hypothesizedMean;
          const testStatistic = (sampleMean - hypMeanNum) / standardError;
          const degreesOfFreedom = n - 1;
          const pValue = testType === "z_test" ? calculateZTestPValue(testStatistic) : calculateTTestPValue(testStatistic, degreesOfFreedom);
          const pValueRounded = Math.round(pValue * 1e6) / 1e6;
          return {
            sampleSize: n, sampleMean, sampleStdDev,
            populationStdDev: testType === "z_test" ? (populationStdDev ?? null) : null,
            standardError, testStatistic, pValue: pValueRounded,
            degreesOfFreedom: testType === "t_test" ? degreesOfFreedom : null,
            interpretation: formatInterpretation(pValueRounded)
          };
        };

        if (groupBy !== undefined) {
          const sql = `SELECT \`${groupBy}\` as group_key, COUNT(\`${column}\`) as n, AVG(\`${column}\`) as mean, STDDEV_SAMP(\`${column}\`) as stddev FROM \`${table}\` ${whereClause} GROUP BY \`${groupBy}\` ORDER BY \`${groupBy}\``;
          const result = await adapter.executeQuery(sql);
          const groups = (result.rows ?? []).map(row => ({
            groupKey: row["group_key"],
            results: calculateTestResults(Number(row["n"]), Number(row["mean"]), Number(row["stddev"]))
          }));
          return withTokenEstimate({ success: true, data: { table, column, testType, hypothesizedMean, groupBy, groups, count: groups.length } });
        }

        const sql = `SELECT COUNT(\`${column}\`) as n, AVG(\`${column}\`) as mean, STDDEV_SAMP(\`${column}\`) as stddev FROM \`${table}\` ${whereClause}`;
        const result = await adapter.executeQuery(sql);
        const rows = result.rows ?? [];
        const row = rows[0];
        if (!row) return withTokenEstimate({ success: false, code: "VALIDATION_ERROR", error: "No data found" });
        const resultObj = calculateTestResults(Number(row['n'] ?? 0), Number(row['mean'] ?? 0), Number(row['stddev'] ?? 0));
        return withTokenEstimate(resultObj['error'] != null ? { success: false, code: "CALCULATION_ERROR", error: typeof resultObj['error'] === 'string' ? resultObj['error'] : "Calculation error" } : { success: true, data: { table, column, testType, hypothesizedMean, results: resultObj } });
      } catch (error) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}
