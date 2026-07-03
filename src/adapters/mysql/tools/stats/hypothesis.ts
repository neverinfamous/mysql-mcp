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
  database: z.string().optional().describe("Database name"),
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  tbl: z.string().optional().describe("Alias for table"),
  table_name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("Numeric column to test"),
  col: z.string().optional().describe("Alias for column"),
  columnName: z.string().optional().describe("Alias for column"),
  fieldName: z.string().optional().describe("Alias for column"),
  c: z.string().optional().describe("Alias for column"),
  testType: z.unknown().optional().describe("Type of test to perform"),
  hypothesizedMean: z.unknown().optional().describe("Null hypothesis mean to test against"),
  populationStdDev: z.unknown().optional().describe("Known population standard deviation (for z-test)"),
  groupBy: z.string().optional().describe("Column to group results by (for multiple one-sample tests)"),
  groupColumn: z.string().optional().describe("Column containing the two groups (for two-sample test)"),
  group1: z.unknown().optional().describe("First group value"),
  group2: z.unknown().optional().describe("Second group value"),
  where: z.string().optional().describe("Filter condition. Anti-Hallucination Hint: Pass only the condition (e.g. 'amount > 100'), NOT a full SELECT query."),
  filter: z.string().optional().describe("Alias for where"),
  condition: z.string().optional().describe("Alias for where"),
  sql: z.string().optional().describe("Alias for where"),
  query: z.string().optional().describe("Alias for where"),
});

export const StatsHypothesisSchema = z.preprocess(
  (val: unknown) => {
    if (val === null || typeof val !== "object") return val;
    const obj = val as Record<string, unknown>;
    return {
      ...obj,
      table: obj["table"] ?? obj["tableName"] ?? obj["name"] ?? obj["tbl"] ?? obj["table_name"],
      column: obj["column"] ?? obj["col"] ?? obj["columnName"] ?? obj["fieldName"] ?? obj["c"],
      where: obj["where"] ?? obj["filter"] ?? obj["condition"] ?? obj["sql"] ?? obj["query"],
    };
  },
  z.object({
    database: z.string().optional(),
    table: z.string().min(1, "table is required"),
    column: z.string().min(1, "column is required"),
    testType: z.enum(["t_test", "z_test"]).default("t_test"),
    hypothesizedMean: z.coerce.number().default(0),
    populationStdDev: z.coerce.number().optional(),
    groupBy: z.string().optional(),
    groupColumn: z.string().optional(),
    group1: z.union([z.string(), z.number()]).optional(),
    group2: z.union([z.string(), z.number()]).optional(),
    where: z.string().optional().refine(val => !val || !/^\s*SELECT\s/i.test(val), { message: "Do not pass a full SELECT query. Pass only the filter condition." }),
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
          database,
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

        if (!/^[a-zA-Z0-9_]+(\.[a-zA-Z0-9_]+)?$/.test(table)) {
          return withTokenEstimate({ success: false, code: "VALIDATION_ERROR", category: "validation", recoverable: false, error: "Invalid table name" });
        }
        
        const fullTableName = database ? `\`${database}\`.\`${table}\`` : (table.includes('.') ? table.split('.').map(p => `\`${p}\``).join('.') : `\`${table}\``);
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column)) {
          return withTokenEstimate({ success: false, code: "VALIDATION_ERROR", category: "validation", recoverable: false, error: "Invalid column name" });
        }
        if (groupBy && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(groupBy)) {
          return withTokenEstimate({ success: false, code: "VALIDATION_ERROR", category: "validation", recoverable: false, error: "Invalid groupBy column name" });
        }
        if (groupColumn && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(groupColumn)) {
          return withTokenEstimate({ success: false, code: "VALIDATION_ERROR", category: "validation", recoverable: false, error: "Invalid groupColumn name" });
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
              FROM ${fullTableName}
              ${whereClause ? whereClause + ' AND ' : 'WHERE '} \`${groupColumn}\` IN (?, ?)
              GROUP BY \`${groupColumn}\`
          `;

          const result = await adapter.executeQuery(sql, [group1, group2]);
          const rows = result.rows ?? [];

          const group1Row = rows.find((r) => String(r["group_key"]) === String(group1));
          const group2Row = rows.find((r) => String(r["group_key"]) === String(group2));

          if (!group1Row || !group2Row) {
            return withTokenEstimate({ success: false, code: "VALIDATION_ERROR", category: "validation", recoverable: false, error: "Could not find data for both groups" });
          }

          const n1 = Number(group1Row['n'] ?? 0);
          const mean1 = Number(group1Row['mean'] ?? 0);
          const stddev1 = Number(group1Row['stddev'] ?? 0);

          const n2 = Number(group2Row['n'] ?? 0);
          const mean2 = Number(group2Row['mean'] ?? 0);
          const stddev2 = Number(group2Row['stddev'] ?? 0);

          if (n1 < 2 || n2 < 2 || isNaN(stddev1) || isNaN(stddev2) || (stddev1 === 0 && stddev2 === 0)) {
            return withTokenEstimate({ success: false, code: "VALIDATION_ERROR", category: "validation", recoverable: false, error: "Insufficient data or zero variance in groups" });
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
          const sql = `SELECT \`${groupBy}\` as group_key, COUNT(\`${column}\`) as n, AVG(\`${column}\`) as mean, STDDEV_SAMP(\`${column}\`) as stddev FROM ${fullTableName} ${whereClause} GROUP BY \`${groupBy}\` ORDER BY \`${groupBy}\``;
          const result = await adapter.executeQuery(sql);
          const groups = (result.rows ?? []).map(row => ({
            groupKey: row["group_key"],
            results: calculateTestResults(Number(row["n"]), Number(row["mean"]), Number(row["stddev"]))
          }));
          return withTokenEstimate({ success: true, data: { table, column, testType, hypothesizedMean, groupBy, groups, count: groups.length } });
        }

        const sql = `SELECT COUNT(\`${column}\`) as n, AVG(\`${column}\`) as mean, STDDEV_SAMP(\`${column}\`) as stddev FROM ${fullTableName} ${whereClause}`;
        const result = await adapter.executeQuery(sql);
        const rows = result.rows ?? [];
        const row = rows[0];
        if (!row) return withTokenEstimate({ success: false, code: "VALIDATION_ERROR", category: "validation", recoverable: false, error: "No data found" });
        const resultObj = calculateTestResults(Number(row['n'] ?? 0), Number(row['mean'] ?? 0), Number(row['stddev'] ?? 0));
        return withTokenEstimate(resultObj['error'] != null ? { success: false, code: "CALCULATION_ERROR", category: "calculation", recoverable: false, error: typeof resultObj['error'] === 'string' ? resultObj['error'] : "Calculation error" } : { success: true, data: { table, column, testType, hypothesizedMean, results: resultObj } });
      } catch (error) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}
