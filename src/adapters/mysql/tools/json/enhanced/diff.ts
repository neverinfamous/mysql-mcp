import { ZodError } from "zod";
import type { MySQLAdapter } from "../../../mysql-adapter/index.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../../types/index.js";
import {
  JsonDiffSchemaBase,
  JsonDiffOutputSchema,
} from "../../../schemas/index.js";
import { formatHandlerErrorResponse, withTokenEstimate } from "../../core/error-helpers.js";
import { READ_ONLY } from "../../../../../utils/annotations.js";
import { JsonDiffSchema } from "./schemas.js";

export function createJsonDiffTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_json_diff",
    title: "MySQL JSON Diff",
    description: "Compare two JSON documents and identify differences.",
    group: "json",
    inputSchema: JsonDiffSchemaBase,
    outputSchema: JsonDiffOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { json1, json2 } = JsonDiffSchema.parse(params);

        // MySQL doesn't have native JSON_DIFF, so we compare key-by-key
        const sql = `
                SELECT 
                    JSON_CONTAINS(?, ?) as json1_contains_json2,
                    JSON_CONTAINS(?, ?) as json2_contains_json1,
                    CASE WHEN ? = ? THEN 1 ELSE 0 END as identical,
                    JSON_LENGTH(?) as json1_length,
                    JSON_LENGTH(?) as json2_length,
                    JSON_KEYS(?) as json1_keys,
                    JSON_KEYS(?) as json2_keys
            `;
        const result = await adapter.executeReadQuery(sql, [
          json1,
          json2,
          json2,
          json1,
          json1,
          json2,
          json1,
          json2,
          json1,
          json2,
        ]);

        const row = result.rows?.[0];
        const identical = row?.["identical"] === 1;

        const parseKeys = (raw: unknown): string[] => {
          if (typeof raw === "string") {
            return JSON.parse(raw) as string[];
          }
          return (raw as string[]) ?? [];
        };

        const json1Keys = parseKeys(row?.["json1_keys"]);
        const json2Keys = parseKeys(row?.["json2_keys"]);

        // Compute structural differences
        const json1KeySet = new Set(json1Keys);
        const json2KeySet = new Set(json2Keys);
        const addedKeys = json2Keys.filter((k) => !json1KeySet.has(k));
        const removedKeys = json1Keys.filter((k) => !json2KeySet.has(k));
        const sharedKeys = json1Keys.filter((k) => json2KeySet.has(k));

        // Compute value-level differences for shared keys
        const differences: {
          path: string;
          value1: unknown;
          value2: unknown;
        }[] = [];

        if (!identical && sharedKeys.length > 0) {
          for (const key of sharedKeys) {
            const diffSql = `SELECT JSON_EXTRACT(?, CONCAT('$.', ?)) as v1, JSON_EXTRACT(?, CONCAT('$.', ?)) as v2`;
            const diffResult = await adapter.executeReadQuery(diffSql, [
              json1,
              key,
              json2,
              key,
            ]);
            const diffRow = diffResult.rows?.[0];

            const v1Raw = diffRow?.["v1"];
            const v2Raw = diffRow?.["v2"];

            // Compare as strings (JSON canonical form)
            const v1Str =
              typeof v1Raw === "string" ? v1Raw : JSON.stringify(v1Raw);
            const v2Str =
              typeof v2Raw === "string" ? v2Raw : JSON.stringify(v2Raw);

            if (v1Str !== v2Str) {
              // Parse for cleaner output
              const parseValue = (raw: unknown): unknown => {
                if (typeof raw === "string") {
                  try {
                    return JSON.parse(raw) as unknown;
                  } catch {
                    return raw;
                  }
                }
                return raw;
              };
              differences.push({
                path: `$.${key}`,
                value1: parseValue(v1Raw),
                value2: parseValue(v2Raw),
              });
            }
          }
        }

        return withTokenEstimate({
          success: true,
          data: {
            identical,
            json1ContainsJson2: row?.["json1_contains_json2"] === 1,
            json2ContainsJson1: row?.["json2_contains_json1"] === 1,
            json1Length: row?.["json1_length"],
            json2Length: row?.["json2_length"],
            json1Keys,
            json2Keys,
            addedKeys,
            removedKeys,
            differences,
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
