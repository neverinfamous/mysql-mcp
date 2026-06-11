import { ZodError } from "zod";
import type { MySQLAdapter } from "../../../mysql-adapter/index.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../../types/index.js";
import {
  FulltextCreateSchema,
  FulltextCreateSchemaBase,
  FulltextCreateOutputSchema,
} from "../../../schemas/index.js";
import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "../../core/error-helpers.js";
import { WRITE } from "../../../../../utils/annotations.js";
import { isDuplicateKeyError } from "./helpers.js";

export function createFulltextCreateTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_fulltext_create",
    title: "MySQL Create FULLTEXT Index",
    description:
      "Create a FULLTEXT index on specified columns for fast text search.",
    group: "fulltext",
    inputSchema: FulltextCreateSchemaBase,
    outputSchema: FulltextCreateOutputSchema,
    requiredScopes: ["write"],
    annotations: WRITE,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { table, columns, indexName } =
          FulltextCreateSchema.parse(params);

        const name = indexName ?? `ft_${table}_${columns.join("_")}`;
        const columnList = columns.map((c) => `\`${c}\``).join(", ");

        const sql = `CREATE FULLTEXT INDEX \`${name}\` ON \`${table}\` (${columnList})`;

        try {
          await adapter.executeQuery(sql);
        } catch (err: unknown) {
          if (isDuplicateKeyError(err)) {
            return formatHandlerErrorResponse(
              new Error(`Index '${name}' already exists on table '${table}'`),
            );
          }
          const msg = err instanceof Error ? err.message : String(err);
          // Distinguish column-not-found (errno 1072) from table-not-found
          if (
            (err as Error & { errno?: number }).errno === 1072 ||
            msg.includes("Key column") ||
            msg.includes("Column '")
          ) {
            return formatHandlerErrorResponse(new Error(msg));
          }
          if (msg.includes("doesn't exist")) {
            return formatHandlerErrorResponse(
              new Error(`Table '${table}' does not exist`),
            );
          }
          return formatHandlerErrorResponse(err);
        }

        adapter.clearSchemaCache();
        return withTokenEstimate({
          success: true,
          data: { indexName: name, columns },
        });
      } catch (error: unknown) {
        if (error instanceof ZodError) {
          return formatHandlerErrorResponse(error);
        }
        return formatHandlerErrorResponse(error);
      }
    },
  };
}
