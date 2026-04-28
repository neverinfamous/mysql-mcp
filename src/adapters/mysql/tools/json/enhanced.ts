/**
 * MySQL JSON Tools - Enhanced Operations
 *
 * Advanced JSON tools: merge, diff, normalize, stats, index suggestions.
 * 5 tools total.
 */

import type { MySQLAdapter } from "../../mysql-adapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import { z, ZodError } from "zod";
import {
  JsonNormalizeSchema,
  JsonNormalizeSchemaBase,
  JsonStatsSchema,
  JsonStatsSchemaBase,
  JsonIndexSuggestSchema,
  JsonIndexSuggestSchemaBase,
  JsonMergeSchemaBase,
  JsonDiffSchemaBase,
} from "../../schemas/index.js";
import { formatHandlerErrorResponse } from "../core/error-helpers.js";
import {
  validateQualifiedIdentifier,
  escapeQualifiedTable,
  validateIdentifier,
} from "../../../../utils/validators.js";

// Schemas for json_merge and json_diff (no table/column — no aliases needed)
const JsonMergeSchema = z
  .object({
    json1: z.unknown().optional().describe("First JSON document"),
    doc1: z.unknown().optional().describe("Alias for json1"),
    json2: z.unknown().optional().describe("Second JSON document"),
    doc2: z.unknown().optional().describe("Alias for json2"),
    mode: z
      .enum(["patch", "preserve"])
      .default("patch")
      .describe("Merge mode: patch (RFC 7396) or preserve (array merge)"),
  })
  .transform((data) => {
    const val1 = data.json1 !== undefined ? data.json1 : data.doc1;
    const val2 = data.json2 !== undefined ? data.json2 : data.doc2;
    return {
      json1: typeof val1 === "string" ? val1 : JSON.stringify(val1),
      json2: typeof val2 === "string" ? val2 : JSON.stringify(val2),
      mode: data.mode,
      _raw1: val1,
      _raw2: val2,
    };
  })
  .refine((data) => data._raw1 !== undefined, {
    message: "json1 (or doc1 alias) is required",
  })
  .refine((data) => data._raw2 !== undefined, {
    message: "json2 (or doc2 alias) is required",
  });

const JsonDiffSchema = z
  .object({
    json1: z.unknown().optional().describe("First JSON document"),
    doc1: z.unknown().optional().describe("Alias for json1"),
    json2: z.unknown().optional().describe("Second JSON document"),
    doc2: z.unknown().optional().describe("Alias for json2"),
  })
  .transform((data) => {
    const val1 = data.json1 !== undefined ? data.json1 : data.doc1;
    const val2 = data.json2 !== undefined ? data.json2 : data.doc2;
    return {
      json1: typeof val1 === "string" ? val1 : JSON.stringify(val1),
      json2: typeof val2 === "string" ? val2 : JSON.stringify(val2),
      _raw1: val1,
      _raw2: val2,
    };
  })
  .refine((data) => data._raw1 !== undefined, {
    message: "json1 (or doc1 alias) is required",
  })
  .refine((data) => data._raw2 !== undefined, {
    message: "json2 (or doc2 alias) is required",
  });

// =============================================================================
// Tool Creation Functions
// =============================================================================

export function createJsonMergeTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_json_merge",
    title: "MySQL JSON Merge",
    description:
      "Merge two JSON documents using JSON_MERGE_PATCH or JSON_MERGE_PRESERVE.",
    group: "json",
    inputSchema: JsonMergeSchemaBase,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { json1, json2, mode } = JsonMergeSchema.parse(params);

        const mergeFunction =
          mode === "patch" ? "JSON_MERGE_PATCH" : "JSON_MERGE_PRESERVE";
        const sql = `SELECT ${mergeFunction}(?, ?) as merged`;
        const result = await adapter.executeReadQuery(sql, [json1, json2]);

        const merged = result.rows?.[0]?.["merged"];
        return {
          success: true,
          merged:
            typeof merged === "string"
              ? (JSON.parse(merged) as Record<string, unknown>)
              : merged,
          mode,
        };
      } catch (err: unknown) {
        if (err instanceof ZodError) {
          return formatHandlerErrorResponse(err);
        }
        return formatHandlerErrorResponse(err);
      }
    },
  };
}

export function createJsonDiffTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_json_diff",
    title: "MySQL JSON Diff",
    description: "Compare two JSON documents and identify differences.",
    group: "json",
    inputSchema: JsonDiffSchemaBase,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
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

        return {
          success: true,
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
        };
      } catch (err: unknown) {
        if (err instanceof ZodError) {
          return formatHandlerErrorResponse(err);
        }
        return formatHandlerErrorResponse(err);
      }
    },
  };
}

export function createJsonNormalizeTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_json_normalize",
    title: "MySQL JSON Normalize",
    description:
      "Normalize JSON column structure by extracting all unique keys across documents.",
    group: "json",
    inputSchema: JsonNormalizeSchemaBase,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { table, column, where, limit } =
          JsonNormalizeSchema.parse(params);

        // Validate identifiers
        validateQualifiedIdentifier(table, "table");
        validateIdentifier(column, "column");

        const whereClause = where ? `WHERE ${where}` : "";

        // Get all unique top-level keys
        const keysQuery = `
                SELECT DISTINCT jt.key_name
                FROM ${escapeQualifiedTable(table)},
                JSON_TABLE(
                    JSON_KEYS(\`${column}\`),
                    '$[*]' COLUMNS (key_name VARCHAR(255) PATH '$')
                ) as jt
                ${whereClause}
                LIMIT ${String(limit)}
            `;

        const keysResult = await adapter.executeQuery(keysQuery);
        const uniqueKeys = (keysResult.rows ?? []).map((r) => r["key_name"]);

        // Get type distribution for each key
        const keyStats: Record<string, unknown>[] = [];
        for (const key of uniqueKeys.slice(0, 20)) {
          // Limit to 20 keys
          const typeQuery = `
                    SELECT 
                        JSON_TYPE(JSON_EXTRACT(\`${column}\`, CONCAT('$.', ?))) as value_type,
                        COUNT(*) as count
                    FROM ${escapeQualifiedTable(table)}
                    ${whereClause}
                    GROUP BY value_type
                `;
          const typeResult = await adapter.executeQuery(typeQuery, [key]);
          keyStats.push({
            key,
            types: typeResult.rows ?? [],
          });
        }

        return {
          success: true,
          uniqueKeys,
          keyCount: uniqueKeys.length,
          keyStats,
          truncated: uniqueKeys.length > 20,
        };
      } catch (error: unknown) {
        if (error instanceof ZodError) {
          return formatHandlerErrorResponse(error);
        }
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes("doesn't exist")) {
          return { success: false, error: "Table or column does not exist" };
        }
        return formatHandlerErrorResponse(error);
      }
    },
  };
}

export function createJsonStatsTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_json_stats",
    title: "MySQL JSON Stats",
    description:
      "Analyze statistics for a JSON column including depth, size, and key frequency.",
    group: "json",
    inputSchema: JsonStatsSchemaBase,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { table, column, where, sampleSize } =
          JsonStatsSchema.parse(params);

        // Validate identifiers
        validateQualifiedIdentifier(table, "table");
        validateIdentifier(column, "column");

        const whereClause = where ? `WHERE ${where}` : "";

        const statsQuery = `
                SELECT 
                    COUNT(*) as total_rows,
                    SUM(CASE WHEN \`${column}\` IS NULL THEN 1 ELSE 0 END) as null_count,
                    AVG(JSON_LENGTH(\`${column}\`)) as avg_length,
                    MAX(JSON_LENGTH(\`${column}\`)) as max_length,
                    MIN(JSON_LENGTH(\`${column}\`)) as min_length,
                    AVG(JSON_DEPTH(\`${column}\`)) as avg_depth,
                    MAX(JSON_DEPTH(\`${column}\`)) as max_depth,
                    AVG(LENGTH(\`${column}\`)) as avg_size_bytes,
                    MAX(LENGTH(\`${column}\`)) as max_size_bytes
                FROM (SELECT \`${column}\` FROM ${escapeQualifiedTable(table)} ${whereClause} LIMIT ${String(sampleSize)}) as sample
            `;

        const result = await adapter.executeQuery(statsQuery);
        const row = result.rows?.[0];

        const topKeysQuery = `
            SELECT jt.key_name as key_name, COUNT(*) as count
            FROM (SELECT \`${column}\` FROM ${escapeQualifiedTable(table)} ${whereClause} LIMIT ${String(sampleSize)}) as sample,
            JSON_TABLE(JSON_KEYS(sample.\`${column}\`), '$[*]' COLUMNS (key_name VARCHAR(255) PATH '$')) as jt
            GROUP BY jt.key_name
            ORDER BY count DESC
            LIMIT 10
        `;
        let topKeys: { key: string; count: number }[] = [];
        try {
            const topKeysResult = await adapter.executeQuery(topKeysQuery);
            topKeys = (topKeysResult.rows ?? []).map(r => ({
                key: String(r["key_name"]),
                count: Number(r["count"])
            }));
        } catch (e) {
            // Ignore if JSON_TABLE is not supported or errors out
        }

        return {
          success: true,
          totalSampled: Number(row?.["total_rows"] ?? 0),
          nullCount: Number(row?.["null_count"] ?? 0),
          length: {
            avg: Number(row?.["avg_length"] ?? 0),
            max: Number(row?.["max_length"] ?? 0),
            min: Number(row?.["min_length"] ?? 0),
          },
          depth: {
            avg: Number(row?.["avg_depth"] ?? 0),
            max: Number(row?.["max_depth"] ?? 0),
          },
          sizeBytes: {
            avg: Number(row?.["avg_size_bytes"] ?? 0),
            max: Number(row?.["max_size_bytes"] ?? 0),
          },
          sampleSize,
          topKeys,
        };
      } catch (error: unknown) {
        if (error instanceof ZodError) {
          return formatHandlerErrorResponse(error);
        }
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes("doesn't exist")) {
          return { success: false, error: "Table or column does not exist" };
        }
        return formatHandlerErrorResponse(error);
      }
    },
  };
}

export function createJsonIndexSuggestTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_json_index_suggest",
    title: "MySQL JSON Index Suggest",
    description:
      "Suggest functional indexes for frequently accessed JSON paths.",
    group: "json",
    inputSchema: JsonIndexSuggestSchemaBase,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { table, column, sampleSize } =
          JsonIndexSuggestSchema.parse(params);

        // Validate identifiers
        validateQualifiedIdentifier(table, "table");
        validateIdentifier(column, "column");

        // Get top-level keys and their types
        const keysQuery = `
                SELECT DISTINCT jt.key_name
                FROM ${escapeQualifiedTable(table)},
                JSON_TABLE(
                    JSON_KEYS(\`${column}\`),
                    '$[*]' COLUMNS (key_name VARCHAR(255) PATH '$')
                ) as jt
                LIMIT ${String(sampleSize)}
            `;

        const keysResult = await adapter.executeQuery(keysQuery);
        const keys = (keysResult.rows ?? []).map(
          (r) => r["key_name"] as string,
        );

        // Check cardinality and suggest indexes
        const suggestions: {
          path: string;
          type: string;
          cardinality: number;
          indexDdl: string;
        }[] = [];

        for (const key of keys.slice(0, 10)) {
          // Analyze top 10 keys
          // Use standard SQL structure for strict FULL_GROUP_BY compliance
          const cardQuery = `
                    SELECT 
                        t.value_type,
                        COUNT(DISTINCT t.val) as cardinality
                    FROM (
                        SELECT 
                            JSON_TYPE(JSON_EXTRACT(\`sub\`.\`${column}\`, CONCAT('$.', ?))) as value_type,
                            JSON_EXTRACT(\`sub\`.\`${column}\`, CONCAT('$.', ?)) as val
                        FROM (
                            SELECT \`${column}\` 
                            FROM ${escapeQualifiedTable(table)} 
                            LIMIT ${String(sampleSize)}
                        ) as sub
                        WHERE JSON_EXTRACT(\`sub\`.\`${column}\`, CONCAT('$.', ?)) IS NOT NULL
                    ) as t
                    GROUP BY t.value_type
                    ORDER BY cardinality DESC
                    LIMIT 1
                `;
          const cardResult = await adapter.executeQuery(cardQuery, [
            key,
            key,
            key,
          ]);
          const cardRow = cardResult.rows?.[0];

          const valueType = cardRow?.["value_type"] as string | undefined;
          const cardinality = Number(cardRow?.["cardinality"] ?? 0);

          if (cardinality > 1) {
            let dataType = "VARCHAR(255)";
            if (valueType === "INTEGER") dataType = "BIGINT";
            else if (valueType === "DOUBLE") dataType = "DOUBLE";
            else if (valueType === "BOOLEAN") dataType = "TINYINT(1)";

            suggestions.push({
              path: `$.${key}`,
              type: valueType ?? "UNKNOWN",
              cardinality,
              indexDdl: `ALTER TABLE ${escapeQualifiedTable(table)} ADD INDEX idx_${table.split(".").pop()}_${key} ((CAST(JSON_EXTRACT(\`${column}\`, '$.${key}') AS ${dataType})));`,
            });
          }
        }

        // Sort by cardinality (higher is better for indexing)
        suggestions.sort((a, b) => b.cardinality - a.cardinality);

        return {
          success: true,
          table,
          column,
          suggestions: suggestions.slice(0, 5), // Top 5 suggestions
          suggestion:
            "Indexes on high-cardinality paths provide the most benefit. Consider query patterns when creating indexes.",
        };
      } catch (error: unknown) {
        if (error instanceof ZodError) {
          return formatHandlerErrorResponse(error);
        }
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes("doesn't exist")) {
          return { success: false, error: "Table or column does not exist" };
        }
        return formatHandlerErrorResponse(error);
      }
    },
  };
}
