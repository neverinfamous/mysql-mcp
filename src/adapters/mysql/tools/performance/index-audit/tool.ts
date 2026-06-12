import type { MySQLAdapter } from "../../../mysql-adapter/index.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../../types/index.js";
import {
  IndexRecommendationSchema,
  IndexRecommendationSchemaBase,
  IndexRecommendationOutputSchema,
} from "../../../schemas/index.js";
import { formatHandlerErrorResponse } from "../../core/error-helpers.js";
import { READ_ONLY } from "../../../../../utils/annotations.js";
import type { IndexFinding } from "./types.js";
import {
  validateTable,
  getAllUserIndexes,
  detectRedundantIndexes,
  detectMissingFkIndexes,
  detectUnindexedTables,
  analyzeQueriesWithExplain,
  heuristicColumnRecommendations,
} from "./helpers.js";

export function createIndexRecommendationTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_index_recommendation",
    title: "MySQL Index Recommendation",
    description:
      "Analyze table and suggest potentially missing indexes based on query patterns. Run an index audit for redundant/duplicate indexes, missing foreign key indexes, and unindexed large tables.",
    group: "optimization",
    inputSchema: IndexRecommendationSchemaBase,
    outputSchema: IndexRecommendationOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { table, queries, includeRedundant, includeUnindexed } =
          IndexRecommendationSchema.parse(params);

        if (table) {
          // P154: Validate table exists before proceeding
          try {
            await validateTable(adapter, table);
          } catch (err: unknown) {
            return formatHandlerErrorResponse(err);
          }
        }

        const indexesByTable = await getAllUserIndexes(adapter, table);
        const findings: IndexFinding[] = [];

        // Run Check 1: Redundant Indexes
        if (includeRedundant !== false) {
          findings.push(...detectRedundantIndexes(indexesByTable));
        }

        // Run Check 2: Missing FKs
        findings.push(...(await detectMissingFkIndexes(adapter, indexesByTable, table)));

        // Run Check 3: Unindexed large tables
        if (includeUnindexed !== false) {
          findings.push(...(await detectUnindexedTables(adapter, indexesByTable, table)));
        }

        // Run Check 4: Query Analysis via EXPLAIN
        if (queries && queries.length > 0) {
          findings.push(...(await analyzeQueriesWithExplain(adapter, queries, _context.progressToken)));
        } else {
          // Fallback Check 5: Heuristic column names (only if no queries provided)
          findings.push(
            ...(await heuristicColumnRecommendations(
              adapter,
              indexesByTable,
              table,
            )),
          );
        }

        // Build flat existing indexes array
        const existingIndexes = Array.from(indexesByTable.values())
          .flat()
          .map((i) => ({
            name: i.name,
            columns: i.columns,
            unique: i.unique,
            type: i.type,
          }));

        // Build legacy recommendations array for backwards compatibility
        const legacyRecommendations: { column: string; reason: string }[] = [];
        for (const f of findings) {
          if (f.column != null && f.type === "heuristic") {
            legacyRecommendations.push({
              column: f.column,
              reason: f.rationale,
            });
          }
        }

        const response = {
          success: true,
          data: {
            table,
            existingIndexes,
            findings,
            summary: {
              redundant: findings.filter((f) => f.type === "redundant").length,
              missingFk: findings.filter((f) => f.type === "missing_fk_index").length,
              unindexedLarge: findings.filter((f) => f.type === "unindexed_large_table").length,
              composite: findings.filter((f) => f.type === "composite").length,
              heuristic: findings.filter((f) => f.type === "heuristic").length,
              total: findings.length,
            },
            recommendations: legacyRecommendations,
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
