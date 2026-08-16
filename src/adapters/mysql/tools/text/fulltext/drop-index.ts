import { ZodError } from "zod";
import type { MySQLAdapter } from "../../../mysql-adapter/index.js";
import {
  type ToolDefinition,
  type RequestContext,
  ValidationError,
} from "../../../../../types/index.js";
import {
  FulltextDropSchema,
  FulltextDropSchemaBase,
  FulltextDropOutputSchema,
} from "../../../schemas/index.js";
import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "../../core/error-helpers.js";
import {
  validateIdentifier,
  validateQualifiedIdentifier,
  escapeQualifiedTable,
} from "../../../../../utils/validators.js";
import { DESTRUCTIVE } from "../../../../../utils/annotations.js";
import { isCantDropKeyError } from "./helpers.js";

export function createFulltextDropTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_fulltext_drop",
    title: "MySQL Drop FULLTEXT Index",
    description: "Drop a FULLTEXT index from a table.",
    group: "fulltext",
    inputSchema: FulltextDropSchemaBase,
    outputSchema: FulltextDropOutputSchema,
    requiredScopes: ["write"],
    annotations: DESTRUCTIVE,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { table, indexName } = FulltextDropSchema.parse(params);

        // Validate inputs
        validateQualifiedIdentifier(table, "table");
        validateIdentifier(indexName, "index");

        try {
          // Verify table and index exist, and index is FULLTEXT
          const indexes = await adapter.getTableIndexes(table);
          const index = indexes.find((i) => i.name === indexName);
          
          if (!index) {
            return formatHandlerErrorResponse(
              new Error(`Index '${indexName}' does not exist on table '${table}'`),
            );
          }
          
          if (index.type !== "FULLTEXT") {
            return formatHandlerErrorResponse(
              new ValidationError(`Index '${indexName}' on table '${table}' is not a FULLTEXT index (type: ${index.type})`),
            );
          }

          const sql = `DROP INDEX \`${indexName}\` ON ${escapeQualifiedTable(table)}`;
          await adapter.executeQuery(sql);
        } catch (err: unknown) {
          if (isCantDropKeyError(err)) {
            return formatHandlerErrorResponse(
              new Error(
                `Index '${indexName}' does not exist on table '${table}'`,
              ),
            );
          }
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes("does not exist") || msg.includes("doesn't exist")) {
            return formatHandlerErrorResponse(
              new Error(`Table '${table}' does not exist`),
            );
          }
          return formatHandlerErrorResponse(err);
        }

        adapter.clearSchemaCache();
        return withTokenEstimate({
          success: true,
          data: { indexName, table },
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
