import { ZodError } from "zod";
import type { MySQLAdapter } from "../../../mysql-adapter/index.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../../types/index.js";
import {
  JsonDiffSchemaBase,
  JsonDiffOutputSchema,
  JsonDiffSchema,
} from "../../../schemas/index.js";
import { formatHandlerErrorResponse, withTokenEstimate } from "../../core/error-helpers.js";
import { READ_ONLY } from "../../../../../utils/annotations.js";

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
                    CASE WHEN CAST(? AS JSON) = CAST(? AS JSON) THEN 1 ELSE 0 END as identical,
                    JSON_LENGTH(?) as json1_length,
                    JSON_LENGTH(?) as json2_length,
                    JSON_KEYS(?) as json1_keys,
                    JSON_KEYS(?) as json2_keys,
                    JSON_TYPE(?) as json1_type,
                    JSON_TYPE(?) as json2_type
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
          json1,
          json2,
        ]);

        const row = result.rows?.[0];
        const identical = row?.["identical"] === 1;
        const type1 = row?.["json1_type"];
        const type2 = row?.["json2_type"];

        const parseKeys = (raw: unknown): string[] => {
          if (typeof raw === "string") {
            const parsed: unknown = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed.map(String) : [];
          }
          return Array.isArray(raw) ? raw.map(String) : [];
        };

        const json1Keys = parseKeys(row?.["json1_keys"]);
        const json2Keys = parseKeys(row?.["json2_keys"]);

        // Compute structural differences
        const json1KeySet = new Set(json1Keys);
        const json2KeySet = new Set(json2Keys);
        const addedKeys = json2Keys.filter((k) => !json1KeySet.has(k));
        const removedKeys = json1Keys.filter((k) => !json2KeySet.has(k));
        const sharedKeys = json1Keys.filter((k) => json2KeySet.has(k));

        let truncated = false;
        const MAX_KEYS = 50;
        
        if (json1Keys.length > MAX_KEYS) { json1Keys.length = MAX_KEYS; truncated = true; }
        if (json2Keys.length > MAX_KEYS) { json2Keys.length = MAX_KEYS; truncated = true; }
        if (addedKeys.length > MAX_KEYS) { addedKeys.length = MAX_KEYS; truncated = true; }
        if (removedKeys.length > MAX_KEYS) { removedKeys.length = MAX_KEYS; truncated = true; }
        if (sharedKeys.length > MAX_KEYS) { sharedKeys.length = MAX_KEYS; truncated = true; }

        // Compute value-level differences for shared keys
        const differences: {
          path: string;
          value1: unknown;
          value2: unknown;
        }[] = [];

        const MAX_STRING_LEN = 1000;
        const parseValue = (raw: unknown): unknown => {
          let parsed: unknown = raw;
          if (typeof raw === "string") {
            try {
              parsed = JSON.parse(raw);
            } catch {
              parsed = raw;
            }
          }
          
          const str = typeof parsed === "string" ? parsed : JSON.stringify(parsed);
          if (str && str.length > MAX_STRING_LEN) {
            return str.substring(0, MAX_STRING_LEN) + "... (truncated)";
          }
          return parsed;
        };

        if (!identical) {
          if (type1 !== "OBJECT" || type2 !== "OBJECT") {
             differences.push({
               path: "$",
               value1: parseValue(json1),
               value2: parseValue(json2),
             });
          } else if (sharedKeys.length > 0) {
            // Batch process keys to avoid N+1 queries and placeholder limits
            const BATCH_SIZE = 500;
            for (let i = 0; i < sharedKeys.length; i += BATCH_SIZE) {
              const batchKeys = sharedKeys.slice(i, i + BATCH_SIZE);
              
              const selectParts: string[] = [];
              const params: unknown[] = [];

              batchKeys.forEach((key, index) => {
                selectParts.push(
                  `JSON_EXTRACT(j1, CONCAT('$."', ?, '"')) as v1_${index}`,
                  `JSON_EXTRACT(j2, CONCAT('$."', ?, '"')) as v2_${index}`
                );
                const escapedKey = key.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
                params.push(escapedKey, escapedKey);
              });

              const diffSql = `SELECT ${selectParts.join(', ')} FROM (SELECT CAST(? AS JSON) as j1, CAST(? AS JSON) as j2) as t`;
              params.push(json1, json2);

              const diffResult = await adapter.executeReadQuery(diffSql, params);
              const diffRow = diffResult.rows?.[0];

              batchKeys.forEach((key, index) => {
                const v1Raw = diffRow?.[`v1_${index}`];
                const v2Raw = diffRow?.[`v2_${index}`];

                // Compare as strings (JSON canonical form)
                const v1Str = JSON.stringify(v1Raw);
                const v2Str = JSON.stringify(v2Raw);

                if (v1Str !== v2Str) {
                  differences.push({
                    path: `$.${key}`,
                    value1: parseValue(v1Raw),
                    value2: parseValue(v2Raw),
                  });
                }
              });
              
              if (differences.length >= MAX_KEYS) {
                differences.length = MAX_KEYS;
                truncated = true;
                break;
              }
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
            ...(truncated ? { truncated: true } : {}),
          },
        });
      } catch (err: unknown) {
        if (err instanceof ZodError) {
          return formatHandlerErrorResponse(err, { module: "json", tool: "mysql_json_diff" });
        }
        return formatHandlerErrorResponse(err, { module: "json", tool: "mysql_json_diff" });
      }
    },
  };
}
