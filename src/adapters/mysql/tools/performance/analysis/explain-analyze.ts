import type { MySQLAdapter } from "../../../mysql-adapter/index.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../../types/index.js";
import {
  ExplainAnalyzeSchema,
  ExplainAnalyzeSchemaBase,
  ExplainAnalyzeOutputSchema,
} from "../../../schemas/index.js";
import { formatHandlerErrorResponse } from "../../core/error-helpers.js";
import { READ_ONLY } from "../../../../../utils/annotations.js";
import { ValidationError } from "../../../../../types/modules/errors.js";

export function createExplainAnalyzeTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_explain_analyze",
    title: "MySQL EXPLAIN ANALYZE",
    description:
      "Get query execution plan with actual timing using EXPLAIN ANALYZE (MySQL 8.0+). Only TREE format is supported.",
    group: "performance",
    inputSchema: ExplainAnalyzeSchemaBase,
    outputSchema: ExplainAnalyzeOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { query, format } = ExplainAnalyzeSchema.parse(params);

        // MySQL does not support EXPLAIN ANALYZE with FORMAT=JSON
        // (requires explain_json_format_version=2 which is not widely available).
        // Return a descriptive error for JSON format requests.
        if (format === "JSON") {
          throw new ValidationError(
            "EXPLAIN ANALYZE does not support FORMAT=JSON. Use FORMAT=TREE (default) instead."
          );
        }

        const sql = `EXPLAIN ANALYZE FORMAT=${format} ${query}`;
        const result = await adapter.executeReadQuery(sql);
        const response = { success: true, data: { analysis: result.rows } };
        const tokenEstimate = Math.ceil(
          Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
        );
        return { ...response, metrics: { tokenEstimate } };
      } catch (error) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}
