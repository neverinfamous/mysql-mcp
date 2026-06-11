/**
 * MySQL Performance Tools - Optimization
 *
 * Query optimization and index tools.
 * 3 tools: query_rewrite, force_index, optimizer_trace.
 */

import type { PoolConnection } from "mysql2/promise";
import type { MySQLAdapter } from "../../mysql-adapter/index.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import {
  ForceIndexSchema,
  ForceIndexSchemaBase,
  preprocessQueryOnlyParams,
  QueryRewriteOutputSchema,
  ForceIndexOutputSchema,
  OptimizerTraceOutputSchema,
} from "../../schemas/index.js";
import { z } from "zod";
import {
  formatMysqlError,
  formatHandlerErrorResponse,
} from "../core/error-helpers.js";
import { ValidationError } from "../../../../types/modules/errors.js";
import { READ_ONLY } from "../../../../utils/annotations.js";

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
  data?: {
    query: string;
    decisions: TraceSummaryDecision[];
  };
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
      error: "No trace data available",
      data: { query, decisions },
    };
  }

  const row = rows[0];
  if (!row) {
    return {
      success: false,
      error: "No trace data available",
      data: { query, decisions },
    };
  }

  const traceStr = row["TRACE"];
  if (typeof traceStr !== "string") {
    return {
      success: false,
      error: "Invalid trace format",
      data: { query, decisions },
    };
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
    return {
      success: false,
      error: "Failed to parse trace",
      data: { query, decisions },
    };
  }

  return { success: true, data: { query, decisions } };
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
    outputSchema: QueryRewriteOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
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
          data: {
            originalQuery: query,
            rewrittenQuery: query,
            suggestions,
            explainPlan: explainResult,
          },
        };

        if (explainError) {
          response["success"] = false;
          response["error"] = explainError;
          (response["data"] as Record<string, unknown>)["explainError"] =
            explainError;
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
    outputSchema: ForceIndexOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
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
          data: {
            originalQuery: query,
            rewrittenQuery: rewritten,
            hint: `FORCE INDEX (\`${indexName}\`)`,
          },
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
    outputSchema: OptimizerTraceOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
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
            const response = {
              success: false,
              error: errorMsg,
              data: { query, decisions: [] },
            };
            const tokenEstimate = Math.ceil(
              Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
            );
            return { ...response, metrics: { tokenEstimate } };
          }
          const response = {
            success: false,
            error: errorMsg,
            data: { query, trace: null },
          };
          const tokenEstimate = Math.ceil(
            Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
          );
          return { ...response, metrics: { tokenEstimate } };
        }

        // Get the trace
        const [rows] = await connection.query(
          "SELECT * FROM information_schema.OPTIMIZER_TRACE",
        );

        if (summary) {
          // Extract key decisions from the trace
          const response = extractTraceSummary(
            rows as Record<string, unknown>[],
            query,
          );
          const tokenEstimate = Math.ceil(
            Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
          );
          return { ...response, metrics: { tokenEstimate } };
        }

        const response = { success: true, data: { trace: rows } };
        const tokenEstimate = Math.ceil(
          Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
        );
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
