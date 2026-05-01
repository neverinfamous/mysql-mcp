/**
 * MySQL Performance Tools - Anomaly Detection
 *
 * Lightweight anomaly detectors that compare current state against
 * norms using MySQL system views. Returns risk scores, trend analysis,
 * and actionable recommendations.
 *
 * Tools:
 *   - mysql_detect_query_anomalies: variance analysis via events_statements_summary_by_digest
 *   - mysql_detect_bloat_risk: multi-factor bloat/fragmentation risk scoring
 *
 * Shared helpers (exported for connection-analysis.ts):
 *   - toNum, toStr, safeNum, riskFromScore, RiskLevel
 */

import { z, ZodError } from "zod";
import type { MySQLAdapter } from "../../mysql-adapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import { formatHandlerErrorResponse } from "../core/error-helpers.js";

// =============================================================================
// Shared Helpers (exported for connection-analysis.ts)
// =============================================================================

export type RiskLevel = "low" | "moderate" | "high" | "critical";

export const toNum = (val: unknown): number =>
  val === null || val === undefined ? 0 : Number(val);

export const toStr = (val: unknown, fallback = ""): string =>
  typeof val === "string" ? val : fallback;

export function riskFromScore(score: number): RiskLevel {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 40) return "moderate";
  return "low";
}

// =============================================================================
// Schemas
// =============================================================================

export const DetectQueryAnomaliesSchemaBase = z.object({
  threshold: z.unknown().optional().describe("Max/Avg variance multiplier threshold (default: 10.0)"),
  stdDevThreshold: z.unknown().optional().describe("Alias for threshold"),
  minCalls: z.unknown().optional().describe("Minimum call count to filter noise (default: 50)"),
  minExecutions: z.unknown().optional().describe("Alias for minCalls"),
});

export const DetectQueryAnomaliesSchema = z.object({
  threshold: z
    .number()
    .optional()
    .describe("Max/Avg variance multiplier threshold (default: 10.0)"),
  stdDevThreshold: z.number().optional().describe("Alias for threshold"),
  minCalls: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe("Minimum call count to filter noise (default: 50)"),
  minExecutions: z.number().int().min(1).optional().describe("Alias for minCalls"),
});

export const DetectBloatRiskSchemaBase = z.object({
  schema: z.unknown().optional().describe("Filter to a specific database schema"),
  minSizeMb: z.unknown().optional().describe("Minimum table size in MB to include (default: 10)"),
});

export const DetectBloatRiskSchema = z.object({
  schema: z
    .string()
    .optional()
    .describe("Filter to a specific database schema"),
  minSizeMb: z
    .number()
    .optional()
    .describe("Minimum table size in MB to include (default: 10)"),
});


// =============================================================================
// 1. mysql_detect_query_anomalies
// =============================================================================

export function createDetectQueryAnomaliesTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_detect_query_anomalies",
    description:
      "Detects queries deviating from their historical execution time norms using MAX/AVG variance analysis. Requires performance_schema.",
    inputSchema: DetectQueryAnomaliesSchemaBase,
    group: "performance",
    requiredScopes: ["read"],
    annotations: { readOnlyHint: true },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const parsed = DetectQueryAnomaliesSchema.parse(params);

        const threshold = parsed.stdDevThreshold ?? parsed.threshold ?? 10.0;
        const minCalls = parsed.minExecutions ?? parsed.minCalls ?? 50;

        if (threshold < 2 || threshold > 10000) {
          const response = {
            success: false,
            error: "threshold (or stdDevThreshold) must be between 2 and 10000",
          };
          const tokenEstimate = Math.ceil(Buffer.byteLength(JSON.stringify(response), "utf8") / 4);
          return { ...response, metrics: { tokenEstimate } };
        }
        if (minCalls < 1 || minCalls > 100000) {
          const response = {
            success: false,
            error: "minCalls (or minExecutions) must be between 1 and 100000",
          };
          const tokenEstimate = Math.ceil(Buffer.byteLength(JSON.stringify(response), "utf8") / 4);
          return { ...response, metrics: { tokenEstimate } };
        }

        // Check if performance_schema is available
        try {
          await adapter.executeQuery(
            `SELECT 1 FROM performance_schema.events_statements_summary_by_digest LIMIT 1`,
          );
        } catch {
          const response = {
            success: false,
            error: "performance_schema is disabled or inaccessible.",
          };
          const tokenEstimate = Math.ceil(Buffer.byteLength(JSON.stringify(response), "utf8") / 4);
          return { ...response, metrics: { tokenEstimate } };
        }

        const countResult = await adapter.executeQuery(
          `SELECT COUNT(*) AS total FROM performance_schema.events_statements_summary_by_digest WHERE COUNT_STAR >= ${String(minCalls)}`,
        );
        const totalAnalyzed = toNum(countResult.rows?.[0]?.["total"]);

        // PICO_TO_MS = 1,000,000,000
        const result = await adapter.executeQuery(`
          SELECT
            DIGEST_TEXT AS query_preview,
            SCHEMA_NAME AS db_schema,
            COUNT_STAR AS calls,
            ROUND(AVG_TIMER_WAIT / 1000000000, 3) AS avg_exec_time_ms,
            ROUND(MAX_TIMER_WAIT / 1000000000, 3) AS max_exec_time_ms,
            ROUND(MAX_TIMER_WAIT / NULLIF(AVG_TIMER_WAIT, 0), 2) AS variance_ratio,
            ROUND(SUM_TIMER_WAIT / 1000000000, 2) AS total_exec_time_ms
          FROM performance_schema.events_statements_summary_by_digest
          WHERE COUNT_STAR >= ${String(minCalls)}
            AND AVG_TIMER_WAIT > 0
            AND (MAX_TIMER_WAIT / AVG_TIMER_WAIT) > ${String(threshold)}
          ORDER BY (MAX_TIMER_WAIT / AVG_TIMER_WAIT) DESC
          LIMIT 20
        `);

        const anomalies = (result.rows ?? []).map((row) => ({
          queryPreview: toStr(row["query_preview"]),
          schema: toStr(row["db_schema"]),
          calls: toNum(row["calls"]),
          avgExecTimeMs: toNum(row["avg_exec_time_ms"]),
          maxExecTimeMs: toNum(row["max_exec_time_ms"]),
          varianceRatio: toNum(row["variance_ratio"]),
          totalExecTimeMs: toNum(row["total_exec_time_ms"]),
        }));

        const anomalyCount = anomalies.length;
        const maxVariance =
          anomalies.length > 0 ? (anomalies[0]?.varianceRatio ?? 0) : 0;

        let riskScore = 0;
        if (anomalyCount >= 10) riskScore += 40;
        else if (anomalyCount >= 5) riskScore += 25;
        else if (anomalyCount >= 1) riskScore += 10;

        if (maxVariance >= 100) riskScore += 50;
        else if (maxVariance >= 50) riskScore += 30;
        else if (maxVariance >= 20) riskScore += 15;

        const riskLevel = riskFromScore(riskScore);
        const summary =
          anomalyCount === 0
            ? `No query anomalies detected (analyzed ${String(totalAnalyzed)} queries with variance threshold ${String(threshold)}x)`
            : `${String(anomalyCount)} anomalous queries detected out of ${String(totalAnalyzed)} analyzed (threshold: ${String(threshold)}x, max variance: ${String(maxVariance)}x)`;

        const response = {
          success: true,
          anomalies,
          riskLevel,
          totalAnalyzed,
          anomalyCount,
          summary,
        };
          const tokenEstimate = Math.ceil(Buffer.byteLength(JSON.stringify(response), "utf8") / 4);
          return { ...response, metrics: { tokenEstimate } };
      } catch (error: unknown) {
        if (error instanceof ZodError) return formatHandlerErrorResponse(error);
        return formatHandlerErrorResponse(error);
      }
    },
  };
}

// =============================================================================
// 2. mysql_detect_bloat_risk
// =============================================================================

export function createDetectBloatRiskTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_detect_bloat_risk",
    description:
      "Scores tables by bloat/fragmentation risk using information_schema DATA_FREE vs DATA_LENGTH metrics. Returns per-table risk scores (0-100) with recommendations.",
    inputSchema: DetectBloatRiskSchemaBase,
    group: "performance",
    requiredScopes: ["read"],
    annotations: { readOnlyHint: true },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const parsed = DetectBloatRiskSchema.parse(params);

        const minSizeMb = parsed.minSizeMb ?? 10;
        const schema = parsed.schema;

        let schemaFilter = `TABLE_SCHEMA NOT IN ('information_schema', 'performance_schema', 'sys', 'mysql')`;
        if (schema) {
          if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schema)) {
            const response = { success: false, error: "Invalid schema name" };
          const tokenEstimate = Math.ceil(Buffer.byteLength(JSON.stringify(response), "utf8") / 4);
          return { ...response, metrics: { tokenEstimate } };
          }
          schemaFilter = `TABLE_SCHEMA = '${schema}'`;
        }

        const minBytes = minSizeMb * 1024 * 1024;

        const result = await adapter.executeQuery(`
          SELECT
            TABLE_SCHEMA AS db_schema,
            TABLE_NAME AS table_name,
            ENGINE AS engine,
            TABLE_ROWS AS row_count,
            DATA_LENGTH AS data_bytes,
            INDEX_LENGTH AS index_bytes,
            DATA_FREE AS free_bytes,
            (DATA_LENGTH + INDEX_LENGTH) AS total_used_bytes,
            CASE WHEN (DATA_LENGTH + INDEX_LENGTH + DATA_FREE) > 0
              THEN ROUND((DATA_FREE / (DATA_LENGTH + INDEX_LENGTH + DATA_FREE)) * 100, 2)
              ELSE 0
            END AS fragmentation_pct
          FROM information_schema.TABLES
          WHERE TABLE_TYPE = 'BASE TABLE'
            AND (DATA_LENGTH + INDEX_LENGTH) >= ${String(minBytes)}
            AND ${schemaFilter}
          ORDER BY DATA_FREE DESC
          LIMIT 50
        `);

        const rows = result.rows ?? [];

        const tables = rows.map((row) => {
          const dataBytes = toNum(row["data_bytes"]);
          const indexBytes = toNum(row["index_bytes"]);
          const freeBytes = toNum(row["free_bytes"]);
          const fragmentationPct = toNum(row["fragmentation_pct"]);
          const rowCount = toNum(row["row_count"]);

          // Risk scoring (0-100)
          let fragmentationScore = 0;
          if (fragmentationPct >= 50) fragmentationScore = 100;
          else if (fragmentationPct >= 30) fragmentationScore = 80;
          else if (fragmentationPct >= 10) fragmentationScore = 50;
          else if (fragmentationPct >= 5) fragmentationScore = 25;

          let sizeScore = 0;
          const freeMb = freeBytes / (1024 * 1024);
          if (freeMb >= 1000)
            sizeScore = 100; // > 1GB wasted
          else if (freeMb >= 500) sizeScore = 70;
          else if (freeMb >= 100) sizeScore = 40;

          const riskScore = Math.round(
            fragmentationScore * 0.6 + sizeScore * 0.4,
          );

          const recommendations: string[] = [];
          if (riskScore >= 60) {
            recommendations.push(
              `High fragmentation. Consider running OPTIMIZE TABLE \`${toStr(row["db_schema"])}\`.\`${toStr(row["table_name"])}\``,
            );
          }

          return {
            schema: toStr(row["db_schema"]),
            tableName: toStr(row["table_name"]),
            engine: toStr(row["engine"]),
            rowCount,
            dataMb: Math.round(dataBytes / 1024 / 1024),
            indexMb: Math.round(indexBytes / 1024 / 1024),
            freeMb: Math.round(freeBytes / 1024 / 1024),
            fragmentationPct,
            riskScore,
            riskLevel: riskFromScore(riskScore),
            recommendations,
          };
        });

        tables.sort((a, b) => b.riskScore - a.riskScore);

        const highRiskCount = tables.filter((t) => t.riskScore >= 60).length;

        const summary =
          highRiskCount === 0
            ? `No high-risk table bloat detected across ${String(tables.length)} tables`
            : `${String(highRiskCount)} table(s) at high fragmentation risk out of ${String(tables.length)} analyzed`;

        const response = {
          success: true,
          tables,
          highRiskCount,
          totalAnalyzed: tables.length,
          summary,
        };
          const tokenEstimate = Math.ceil(Buffer.byteLength(JSON.stringify(response), "utf8") / 4);
          return { ...response, metrics: { tokenEstimate } };
      } catch (error: unknown) {
        if (error instanceof ZodError) return formatHandlerErrorResponse(error);
        return formatHandlerErrorResponse(error);
      }
    },
  };
}
