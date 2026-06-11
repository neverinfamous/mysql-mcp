import { ZodError } from "zod";
import type { MySQLAdapter } from "../../../mysql-adapter/index.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../../types/index.js";
import {
  JsonMergeSchemaBase,
  JsonMergeOutputSchema,
} from "../../../schemas/index.js";
import { formatHandlerErrorResponse, withTokenEstimate } from "../../core/error-helpers.js";
import { READ_ONLY } from "../../../../../utils/annotations.js";
import { JsonMergeSchema } from "./schemas.js";

export function createJsonMergeTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_json_merge",
    title: "MySQL JSON Merge",
    description:
      "Merge two JSON documents using JSON_MERGE_PATCH or JSON_MERGE_PRESERVE.",
    group: "json",
    inputSchema: JsonMergeSchemaBase,
    outputSchema: JsonMergeOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { json1, json2, mode } = JsonMergeSchema.parse(params);

        const mergeFunction =
          mode === "patch" ? "JSON_MERGE_PATCH" : "JSON_MERGE_PRESERVE";
        const sql = `SELECT ${mergeFunction}(?, ?) as merged`;
        const result = await adapter.executeReadQuery(sql, [json1, json2]);

        const merged = result.rows?.[0]?.["merged"];
        return withTokenEstimate({
          success: true,
          data: {
            merged:
              typeof merged === "string"
                ? (() => {
                    const parsed: unknown = JSON.parse(merged);
                    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
                      return Object.fromEntries(Object.entries(parsed));
                    }
                    return {};
                  })()
                : merged,
            mode,
          },
        });
      } catch (err: unknown) {
        if (err instanceof ZodError) {
          return formatHandlerErrorResponse(err);
        }
        return formatHandlerErrorResponse(err);
      }
    },
  };
}
