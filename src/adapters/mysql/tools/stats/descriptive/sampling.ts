import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "../../core/error-helpers.js";
import type { MySQLAdapter } from "../../../mysql-adapter/index.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../../types/index.js";
import { ValidationError } from "../../../../../types/index.js";
import { validateQualifiedIdentifier, escapeQualifiedTable } from "../../../../../utils/validators.js";
import { SampleOutputSchema } from "../../../schemas/stats.js";
import { READ_ONLY } from "../../../../../utils/annotations.js";
import { SamplingSchemaBase, SamplingSchema } from "./schemas.js";

/**
 * Random sampling
 */
export function createSamplingTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_stats_sampling",
    title: "MySQL Random Sampling",
    description: "Get a random sample of rows from a table.",
    group: "stats",
    inputSchema: SamplingSchemaBase,
    outputSchema: SampleOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { table, sampleSize, columns, seed, where } =
          SamplingSchema.parse(params);

        if (sampleSize < 0) {
          throw new ValidationError("sampleSize must be >= 0");
        }

        // Validate table name
        validateQualifiedIdentifier(table, "table");

        // Validate column names if provided
        if (columns) {
          for (const c of columns) {
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(c)) {
              throw new ValidationError(`Invalid column name: ${c}`);
            }
          }
        }

        const columnList =
          columns !== undefined && columns.length > 0
            ? columns
                .map((c) => {
                  return `\`${c}\``;
                })
                .join(", ")
            : "*";

        const whereClause = where ? `WHERE ${where}` : "";

        // If seed is provided, use it for reproducibility
        let query: string;
        if (seed !== undefined) {
          query = `
                    SELECT ${columnList}
                    FROM ${escapeQualifiedTable(table)}
                    ${whereClause}
                    ORDER BY RAND(${String(seed)})
                    LIMIT ${String(sampleSize)}
                `;
        } else {
          query = `
                    SELECT ${columnList}
                    FROM ${escapeQualifiedTable(table)}
                    ${whereClause}
                    ORDER BY RAND()
                    LIMIT ${String(sampleSize)}
                `;
        }
        const result = await adapter.executeQuery(query);

        return withTokenEstimate({
          success: true,
          data: {
            sample: result.rows ?? [],
            sampleSize: result.rows?.length ?? 0,
            requestedSize: sampleSize,
            seed: seed ?? null,
          },
        });
      } catch (error) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}
