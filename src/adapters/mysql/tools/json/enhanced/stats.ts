import { ZodError } from "zod";
import type { MySQLAdapter } from "../../../mysql-adapter/index.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../../types/index.js";
import {
  JsonStatsSchema,
  JsonStatsSchemaBase,
  JsonStatsOutputSchema,
} from "../../../schemas/index.js";
import { formatHandlerErrorResponse, withTokenEstimate } from "../../core/error-helpers.js";
import {
  validateQualifiedIdentifier,
  escapeQualifiedTable,
  validateIdentifier,
} from "../../../../../utils/validators.js";
import { READ_ONLY } from "../../../../../utils/annotations.js";

export function createJsonStatsTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_json_stats",
    title: "MySQL JSON Stats",
    description:
      "Analyze statistics for a JSON column including depth, size, and key frequency.",
    group: "json",
    inputSchema: JsonStatsSchemaBase,
    outputSchema: JsonStatsOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
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
          topKeys = (topKeysResult.rows ?? []).map((r) => ({
            key: String(r["key_name"]),
            count: Number(r["count"]),
          }));
        } catch {
          // Ignore if JSON_TABLE is not supported or errors out
        }

        return withTokenEstimate({
          success: true,
          data: {
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
          },
        });
      } catch (error: unknown) {
        if (error instanceof ZodError) {
          return formatHandlerErrorResponse(error);
        }
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes("doesn't exist")) {
          return formatHandlerErrorResponse(
            new Error("Table or column does not exist"),
          );
        }
        return formatHandlerErrorResponse(error);
      }
    },
  };
}
