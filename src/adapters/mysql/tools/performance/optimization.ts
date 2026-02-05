/**
 * MySQL Performance Tools - Optimization
 *
 * Query optimization and index recommendation tools.
 * 4 tools: index_recommendation, query_rewrite, force_index, optimizer_trace.
 */

import type { MySQLAdapter } from "../../MySQLAdapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import { z } from "zod";

export function createIndexRecommendationTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  const schema = z.object({
    table: z.string().describe("Table to analyze for missing indexes"),
  });

  return {
    name: "mysql_index_recommendation",
    title: "MySQL Index Recommendation",
    description:
      "Analyze table and suggest potentially missing indexes based on query patterns.",
    group: "optimization",
    inputSchema: schema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { table } = schema.parse(params);

      // Get columns
      const columns = await adapter.describeTable(table);

      // Get existing indexes
      const indexes = await adapter.getTableIndexes(table);
      const indexedColumns = new Set(indexes.flatMap((i) => i.columns));

      // Analyze which columns might benefit from indexing
      const recommendations: { column: string; reason: string }[] = [];

      for (const col of columns.columns ?? []) {
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

      return {
        table,
        existingIndexes: indexes.map((i) => ({
          name: i.name,
          columns: i.columns,
        })),
        recommendations,
      };
    },
  };
}

export function createQueryRewriteTool(adapter: MySQLAdapter): ToolDefinition {
  const schema = z.object({
    query: z.string().describe("SQL query to analyze for optimization"),
  });

  return {
    name: "mysql_query_rewrite",
    title: "MySQL Query Rewrite",
    description: "Analyze a query and suggest optimizations.",
    group: "optimization",
    inputSchema: schema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
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
        suggestions.push("Consider adding LIMIT to prevent large result sets");
      }

      if (upperQuery.includes("LIKE") && query.includes("%")) {
        if (query.includes("LIKE '%")) {
          suggestions.push(
            "Leading wildcard in LIKE prevents index usage; consider FULLTEXT search",
          );
        }
      }

      if (upperQuery.includes("OR")) {
        suggestions.push(
          "OR conditions may prevent index usage; consider UNION instead",
        );
      }

      if (upperQuery.includes("ORDER BY") && !upperQuery.includes("LIMIT")) {
        suggestions.push("ORDER BY without LIMIT may cause full table sort");
      }

      if (upperQuery.includes("NOT IN") || upperQuery.includes("NOT EXISTS")) {
        suggestions.push(
          "NOT IN/NOT EXISTS can be slow; consider LEFT JOIN with NULL check",
        );
      }

      // Get EXPLAIN for the query
      let explainResult: unknown;
      try {
        const explainSql = `EXPLAIN FORMAT=JSON ${query}`;
        const result = await adapter.executeReadQuery(explainSql);
        if (result.rows?.[0]) {
          const explainStr = result.rows[0]["EXPLAIN"];
          if (typeof explainStr === "string") {
            explainResult = JSON.parse(explainStr) as unknown;
          }
        }
      } catch {
        // Ignore explain errors
      }

      return {
        originalQuery: query,
        suggestions,
        explainPlan: explainResult,
      };
    },
  };
}

export function createForceIndexTool(_adapter: MySQLAdapter): ToolDefinition {
  const schema = z.object({
    table: z.string(),
    query: z.string().describe("Original query"),
    indexName: z.string().describe("Index name to force"),
  });

  return {
    name: "mysql_force_index",
    title: "MySQL Force Index",
    description: "Generate a query with FORCE INDEX hint.",
    group: "optimization",
    inputSchema: schema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: (params: unknown, _context: RequestContext) => {
      const { table, query, indexName } = schema.parse(params);

      // Simple replacement - insert FORCE INDEX after table name
      const rewritten = query.replace(
        new RegExp(`FROM\\s+\`?${table}\`?`, "i"),
        `FROM \`${table}\` FORCE INDEX (\`${indexName}\`)`,
      );

      return Promise.resolve({
        originalQuery: query,
        rewrittenQuery: rewritten,
        hint: `FORCE INDEX (\`${indexName}\`)`,
      });
    },
  };
}

export function createOptimizerTraceTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  const schema = z.object({
    query: z.string().describe("Query to trace"),
  });

  return {
    name: "mysql_optimizer_trace",
    title: "MySQL Optimizer Trace",
    description: "Get detailed optimizer trace for a query.",
    group: "optimization",
    inputSchema: schema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { query } = schema.parse(params);

      // Enable optimizer trace
      await adapter.executeQuery('SET optimizer_trace="enabled=on"');

      try {
        // Execute the query
        await adapter.executeReadQuery(query);

        // Get the trace
        const traceResult = await adapter.executeReadQuery(
          "SELECT * FROM information_schema.OPTIMIZER_TRACE",
        );

        return { trace: traceResult.rows };
      } finally {
        // Disable optimizer trace
        await adapter.executeQuery('SET optimizer_trace="enabled=off"');
      }
    },
  };
}
