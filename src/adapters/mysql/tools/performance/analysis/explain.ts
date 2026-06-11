import type { MySQLAdapter } from "../../../mysql-adapter/index.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../../types/index.js";
import {
  ExplainSchema,
  ExplainSchemaBase,
  ExplainOutputSchema,
} from "../../../schemas/index.js";
import { formatHandlerErrorResponse } from "../../core/error-helpers.js";
import { READ_ONLY } from "../../../../../utils/annotations.js";
import { optimizeExplainJson } from "./helpers.js";

export function createExplainTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_explain",
    title: "MySQL EXPLAIN",
    description: "Get query execution plan using EXPLAIN.",
    group: "performance",
    inputSchema: ExplainSchemaBase,
    outputSchema: ExplainOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { query, format } = ExplainSchema.parse(params);
        const sql = `EXPLAIN FORMAT=${format} ${query}`;
        const result = await adapter.executeReadQuery(sql);

        if (format === "JSON" && result.rows?.[0] !== undefined) {
          const explainRow = result.rows[0];
          const jsonStr = explainRow["EXPLAIN"];
          if (typeof jsonStr === "string") {
            const parsed: unknown = JSON.parse(jsonStr);
            const optimizedPlan = optimizeExplainJson(parsed);
            const response = { success: true, data: { plan: optimizedPlan } };
            const tokenEstimate = Math.ceil(
              Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
            );
            return { ...response, metrics: { tokenEstimate } };
          }
        }

        const response = { success: true, data: { plan: result.rows } };
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
