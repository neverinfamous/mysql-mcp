/**
 * MySQL Performance Tools - Optimization
 *
 * Query optimization and index recommendation tools.
 * 4 tools: index_recommendation, query_rewrite, force_index, optimizer_trace.
 */

import type { PoolConnection } from "mysql2/promise";
import type { MySQLAdapter } from "../../mysql-adapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import {
  IndexRecommendationSchema,
  IndexRecommendationSchemaBase,
  ForceIndexSchema,
  ForceIndexSchemaBase,
  preprocessQueryOnlyParams,
} from "../../schemas/index.js";
import { z } from "zod";
import {
  formatMysqlError,
  formatHandlerErrorResponse,
} from "../core/error-helpers.js";
import { ValidationError } from "../../../../types/modules/errors.js";

/** Trace summary decision type */
interface TraceSummaryDecision {
  type: string;
  table?: string;
  method?: string;
  index?: string;
  accessType?: string;
  estimatedRows?: number;
  estimatedCost?: number;
}

/** Trace summary result type */
interface TraceSummaryResult {
  success?: boolean;
  query: string;
  decisions: TraceSummaryDecision[];
  error?: string;
}

/** Extract key optimization decisions from full optimizer trace for summary mode */
function extractTraceSummary(
  rows: Record<string, unknown>[] | undefined,
  query: string,
): TraceSummaryResult {
  const decisions: TraceSummaryDecision[] = [];

  if (!rows || rows.length === 0) {
    return {
      success: false,
      query,
      decisions,
      error: "No trace data available",
    };
  }

  const row = rows[0];
  if (!row) {
    return {
      success: false,
      query,
      decisions,
      error: "No trace data available",
    };
  }

  const traceStr = row["TRACE"];
  if (typeof traceStr !== "string") {
    return { success: false, query, decisions, error: "Invalid trace format" };
  }

  try {
    const trace = JSON.parse(traceStr) as {
      steps?: {
        join_optimization?: {
          select?: number;
          steps?: {
            rows_estimation?: {
              table?: string;
              range_analysis?: {
                table_scan?: { rows: number; cost: number };
                chosen_range_access_summary?: {
                  range_access_plan?: {
                    type: string;
                    index: string;
                    rows: number;
                  };
                  cost_for_plan?: number;
                  chosen?: boolean;
                };
              };
            }[];
            considered_execution_plans?: {
              table?: string;
              best_access_path?: {
                considered_access_paths?: {
                  access_type?: string;
                  index?: string;
                  rows?: number;
                  cost?: number;
                  chosen?: boolean;
                }[];
              };
            }[];
          }[];
        };
      }[];
    };

    const steps = trace.steps ?? [];
    for (const step of steps) {
      if (step.join_optimization?.steps) {
        for (const optStep of step.join_optimization.steps) {
          // Extract rows estimation decisions
          if (optStep.rows_estimation) {
            for (const est of optStep.rows_estimation) {
              const rangeAnalysis = est.range_analysis;
              if (rangeAnalysis?.chosen_range_access_summary?.chosen) {
                const plan = rangeAnalysis.chosen_range_access_summary;
                decisions.push({
                  type: "index_selection",
                  table: est.table,
                  method: plan.range_access_plan?.type,
                  index: plan.range_access_plan?.index,
                  estimatedRows: plan.range_access_plan?.rows,
                  estimatedCost: plan.cost_for_plan,
                });
              } else if (rangeAnalysis?.table_scan) {
                decisions.push({
                  type: "table_scan",
                  table: est.table,
                  estimatedRows: rangeAnalysis.table_scan.rows,
                  estimatedCost: rangeAnalysis.table_scan.cost,
                });
              }
            }
          }

          // Extract execution plan decisions
          if (optStep.considered_execution_plans) {
            for (const plan of optStep.considered_execution_plans) {
              const bestPath = plan.best_access_path;
              if (bestPath?.considered_access_paths) {
                const chosen = bestPath.considered_access_paths.find(
                  (p) => p.chosen,
                );
                if (chosen) {
                  decisions.push({
                    type: "access_path",
                    table: plan.table,
                    accessType: chosen.access_type,
                    index: chosen.index,
                    estimatedRows: chosen.rows,
                    estimatedCost: chosen.cost,
                  });
                }
              }
            }
          }
        }
      }
    }
  } catch {
    return { success: false, query, decisions, error: "Failed to parse trace" };
  }

  return { success: true, query, decisions };
}

export function createIndexRecommendationTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_index_recommendation",
    title: "MySQL Index Recommendation",
    description:
      "Analyze table and suggest potentially missing indexes based on query patterns.",
    group: "optimization",
    inputSchema: IndexRecommendationSchemaBase,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { table } = IndexRecommendationSchema.parse(params);

        // Get columns
        const columns = await adapter.describeTable(table);

        // Graceful handling for non-existent tables (P154)
        if (!columns.columns || columns.columns.length === 0) {
          throw new ValidationError(`Table '${table}' does not exist`);
        }

        // Get existing indexes
        const indexes = await adapter.getTableIndexes(table);
        const indexedColumns = new Set(indexes.flatMap((i) => i.columns));

        // Analyze which columns might benefit from indexing
        const recommendations: { column: string; reason: string }[] = [];

        for (const col of columns.columns) {
          if (indexedColumns.has(col.name)) continue;

          // Suggest indexes for common patterns
          if (col.name.endsWith("_id") || col.name === "id") {
            recommendations.push({
              column: col.name,
              reason: "Foreign key or ID column often benefits from indexing",
            });
          } else if (
            ["created_at", "updated_at", "date", "timestamp"].some((s) =>
              col.name.includes(s),
            )
          ) {
            recommendations.push({
              column: col.name,
              reason: "Timestamp columns often used in range queries",
            });
          } else if (
            col.name === "status" ||
            col.name === "type" ||
            col.name === "category"
          ) {
            recommendations.push({
              column: col.name,
              reason: "Status/type columns often used in filtering",
            });
          }
        }

        const response = {
          success: true,
          exists: true,
          table,
          existingIndexes: indexes.map((i) => ({
            name: i.name,
            columns: i.columns,
          })),
          recommendations,
        };
        const tokenEstimate = Math.ceil(
          Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
        );
        return { ...response, metrics: { tokenEstimate } };
      } catch (err) {
        return formatHandlerErrorResponse(err);
      }
    },
  };
}

export function createQueryRewriteTool(adapter: MySQLAdapter): ToolDefinition {
  const schemaBase = z.object({
    query: z
      .string()
      .optional()
      .describe("SQL query to analyze for optimization"),
    sql: z.string().optional().describe("Alias for query"),
  });

  const schema = z
    .preprocess(
      preprocessQueryOnlyParams,
      z.object({
        query: z.string().optional(),
        sql: z.string().optional(),
      }),
    )
    .transform((data) => ({
      query: data.query ?? data.sql ?? "",
    }))
    .refine((data) => data.query !== "", {
      message: "query (or sql alias) is required",
    });

  return {
    name: "mysql_query_rewrite",
    title: "MySQL Query Rewrite",
    description: "Analyze a query and suggest optimizations.",
    group: "optimization",
    inputSchema: schemaBase,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { query } = schema.parse(params);

        const suggestions: string[] = [];
        const upperQuery = query.toUpperCase();

        // Basic query analysis
        if (upperQuery.includes("SELECT *")) {
          suggestions.push(
            "Consider selecting only needed columns instead of SELECT *",
          );
        }

        if (!upperQuery.includes("LIMIT") && upperQuery.includes("SELECT")) {
          suggestions.push(
            "Consider adding LIMIT to prevent large result sets",
          );
        }

        if (upperQuery.includes("LIKE") && query.includes("%")) {
          if (query.includes("LIKE '%")) {
            suggestions.push(
              "Leading wildcard in LIKE prevents index usage; consider FULLTEXT search",
            );
          }
        }

        // Check for OR in WHERE clause (not ORDER BY, FOR, etc.)
        const wherePattern = /WHERE\s+(.+?)(?:ORDER BY|GROUP BY|LIMIT|$)/is;
        const whereMatch = wherePattern.exec(upperQuery);
        const whereClause = whereMatch?.[1];
        if (whereClause && /\bOR\b/i.test(whereClause)) {
          suggestions.push(
            "OR conditions may prevent index usage; consider UNION instead",
          );
        }

        if (upperQuery.includes("ORDER BY") && !upperQuery.includes("LIMIT")) {
          suggestions.push("ORDER BY without LIMIT may cause full table sort");
        }

        if (
          upperQuery.includes("NOT IN") ||
          upperQuery.includes("NOT EXISTS")
        ) {
          suggestions.push(
            "NOT IN/NOT EXISTS can be slow; consider LEFT JOIN with NULL check",
          );
        }

        // Get EXPLAIN for the query
        let explainResult: unknown = null;
        let explainError: string | undefined;
        try {
          const explainSql = `EXPLAIN FORMAT=JSON ${query}`;
          const result = await adapter.executeReadQuery(explainSql);
          if (result.rows?.[0]) {
            const explainStr = result.rows[0]["EXPLAIN"];
            if (typeof explainStr === "string") {
              explainResult = JSON.parse(explainStr) as unknown;
            }
          }
        } catch (err: unknown) {
          explainError = formatMysqlError(err);
        }

        const response: Record<string, unknown> = {
          success: true,
          originalQuery: query,
          rewrittenQuery: query,
          suggestions,
          explainPlan: explainResult,
        };

        if (explainError) {
          response["success"] = false;
          response["error"] = explainError;
          response["explainError"] = explainError;
        }

        const tokenEstimate = Math.ceil(
          Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
        );
        return { ...response, metrics: { tokenEstimate } };
      } catch (err) {
        return formatHandlerErrorResponse(err);
      }
    },
  };
}

export function createForceIndexTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_force_index",
    title: "MySQL Force Index",
    description: "Generate a query with FORCE INDEX hint.",
    group: "optimization",
    inputSchema: ForceIndexSchemaBase,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { table, query, indexName } = ForceIndexSchema.parse(params);

        // P154: Check table existence first
        const tableInfo = await adapter.describeTable(table);
        if (!tableInfo.columns || tableInfo.columns.length === 0) {
          throw new ValidationError(`Table '${table}' does not exist`);
        }

        // Validate index existence
        const indexes = await adapter.getTableIndexes(table);
        if (!indexes.some((idx) => idx.name === indexName)) {
          throw new ValidationError(
            `Index '${indexName}' not found on table '${table}'`,
          );
        }

        // Simple replacement - insert FORCE INDEX after table name
        const regex = new RegExp(`FROM\\s+\`?${table}\`?(?=\\s|,|$)`, "i");
        if (!regex.test(query)) {
          throw new ValidationError(
            `Table '${table}' not found in query FROM clause`,
          );
        }

        const rewritten = query.replace(
          regex,
          `FROM \`${table}\` FORCE INDEX (\`${indexName}\`)`,
        );

        const response = {
          success: true,
          originalQuery: query,
          rewrittenQuery: rewritten,
          hint: `FORCE INDEX (\`${indexName}\`)`,
        };
        const tokenEstimate = Math.ceil(
          Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
        );
        return { ...response, metrics: { tokenEstimate } };
      } catch (err) {
        return formatHandlerErrorResponse(err);
      }
    },
  };
}

export function createOptimizerTraceTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  const schemaBase = z.object({
    query: z.string().optional().describe("Query to trace"),
    sql: z.string().optional().describe("Alias for query"),
    summary: z
      .boolean()
      .optional()
      .describe(
        "If true (default), returns only key optimization decisions to save tokens. Set to false for the full trace.",
      ),
  });

  const schema = z
    .preprocess(
      preprocessQueryOnlyParams,
      z.object({
        query: z.string().optional(),
        sql: z.string().optional(),
        summary: z.boolean().optional(),
      }),
    )
    .transform((data) => ({
      query: data.query ?? data.sql ?? "",
      summary: data.summary ?? true,
    }))
    .refine((data) => data.query !== "", {
      message: "query (or sql alias) is required",
    });

  return {
    name: "mysql_optimizer_trace",
    title: "MySQL Optimizer Trace",
    description: "Get detailed optimizer trace for a query.",
    group: "optimization",
    inputSchema: schemaBase,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      let tracingEnabled = false;
      let connection: PoolConnection | null = null;
      try {
        const { query, summary } = schema.parse(params);

        const pool = adapter.getPool();
        if (!pool) {
          throw new Error("Not connected to database");
        }
        
        connection = await pool.getConnection();

        // Enable optimizer trace
        await connection.query('SET optimizer_trace="enabled=on"');
        tracingEnabled = true;

        // Execute the query (may fail for nonexistent tables, etc.)
        try {
          await connection.query(query);
        } catch (err: unknown) {
          const errorMsg = formatMysqlError(err);
          if (summary) {
            const response = { success: false, error: errorMsg, query, decisions: [] };
            const tokenEstimate = Math.ceil(Buffer.byteLength(JSON.stringify(response), "utf8") / 4);
            return { ...response, metrics: { tokenEstimate } };
          }
          const response = { success: false, error: errorMsg, query, trace: null };
          const tokenEstimate = Math.ceil(Buffer.byteLength(JSON.stringify(response), "utf8") / 4);
          return { ...response, metrics: { tokenEstimate } };
        }

        // Get the trace
        const [rows] = await connection.query(
          "SELECT * FROM information_schema.OPTIMIZER_TRACE",
        );

        if (summary) {
          // Extract key decisions from the trace
          const response = extractTraceSummary(rows as Record<string, unknown>[], query);
          const tokenEstimate = Math.ceil(Buffer.byteLength(JSON.stringify(response), "utf8") / 4);
          return { ...response, metrics: { tokenEstimate } };
        }

        const response = { success: true, trace: rows };
        const tokenEstimate = Math.ceil(Buffer.byteLength(JSON.stringify(response), "utf8") / 4);
        return { ...response, metrics: { tokenEstimate } };
      } catch (err) {
        return formatHandlerErrorResponse(err);
      } finally {
        if (connection !== null && tracingEnabled) {
          // Disable optimizer trace
          try {
            await connection.query('SET optimizer_trace="enabled=off"');
          } catch {
            // ignore
          }
        }
        if (connection !== null) {
          const pool = adapter.getPool();
          if (pool) pool.releaseConnection(connection);
        }
      }
    },
  };
}
