import { z } from "zod";
import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "../core/error-helpers.js";
import type { MySQLAdapter } from "../../mysql-adapter/index.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import {
  IDENTIFIER_RE,
  checkCollectionExists,
  escapeTableRef,
} from "./helpers.js";
import {
  CreateDocIndexSchema,
  CreateDocIndexSchemaBase,
  CreateDocIndexOutputSchema,
} from "../../schemas/index.js";
import { WRITE } from "../../../../utils/annotations.js";

export function getTools(adapter: MySQLAdapter): ToolDefinition[] {
  return [
    {
      name: "mysql_doc_create_index",
      title: "MySQL Create Doc Index",
      description: "Create an index on document fields.",
      group: "docstore",
      inputSchema: CreateDocIndexSchemaBase,
      outputSchema: CreateDocIndexOutputSchema,
      requiredScopes: ["write"],
      annotations: WRITE,
      handler: async (params: unknown, _context: RequestContext) => {
        let collection: string | undefined;
        let name: string | undefined;
        try {
          const parsed = CreateDocIndexSchema.parse(params);
          collection = parsed.collection;
          name = parsed.name;
          const { schema, fields, unique } = parsed;
          if (!IDENTIFIER_RE.test(collection))
            return withTokenEstimate({
              success: false,
              error: "Invalid collection name",
              code: "VALIDATION_ERROR",
              category: "validation",
            });
          if (schema && !IDENTIFIER_RE.test(schema))
            return withTokenEstimate({
              success: false,
              error: "Invalid schema name",
              code: "VALIDATION_ERROR",
              category: "validation",
            });
          if (!IDENTIFIER_RE.test(name))
            return withTokenEstimate({
              success: false,
              error: "Invalid index name",
              code: "VALIDATION_ERROR",
              category: "validation",
            });

          const idxCheck = await checkCollectionExists(
            adapter,
            collection,
            schema,
          );
          if (!idxCheck.exists) {
            return idxCheck.reason === "schema"
              ? withTokenEstimate({
                  success: false,
                  error: `Schema '${idxCheck.name}' does not exist`,
                  code: "SCHEMA_NOT_FOUND",
                  category: "domain",
                })
              : withTokenEstimate({
                  success: false,
                  error: `Collection '${collection}' does not exist`,
                  code: "TABLE_NOT_FOUND",
                  category: "domain",
                });
          }

          const tableRef = escapeTableRef(collection, schema);
          for (const field of fields) {
            const cleanPath = field.path.replace(/^\$\.?/, "");
            const colName = `_idx_${cleanPath.replace(/\./g, "_")}`;
            const cast = field.type === "TEXT" ? "CHAR(255)" : field.type.toUpperCase().replace(/^STRING/, "VARCHAR");
            await adapter.executeQuery(
              `ALTER TABLE ${tableRef} ADD COLUMN \`${colName}\` ${cast}
                           GENERATED ALWAYS AS (JSON_UNQUOTE(JSON_EXTRACT(doc, '$.${cleanPath}'))) STORED`,
            );
          }

          const cols = fields
            .map((f) => `\`_idx_${f.path.replace(/^\$\.?/, "").replace(/\./g, "_")}\``)
            .join(", ");
          const uniqueClause = unique ? "UNIQUE " : "";
          await adapter.executeQuery(
            `CREATE ${uniqueClause}INDEX \`${name}\` ON ${tableRef} (${cols})`,
          );

          adapter.clearSchemaCache();
          return withTokenEstimate({ success: true, data: { index: name } });
        } catch (error: unknown) {
          if (error instanceof z.ZodError) {
            return formatHandlerErrorResponse(error);
          }
          const message =
            error instanceof Error ? error.message : String(error);
          if (
            message.toLowerCase().includes("duplicate column") ||
            message.toLowerCase().includes("duplicate key")
          ) {
            return withTokenEstimate({
              success: false,
              error: `Index '${name ?? "unknown"}' or its generated columns already exist on '${collection ?? "unknown"}'`,
              code: "CONFLICT_ERROR",
              category: "domain",
            });
          }
          return withTokenEstimate({
              success: false,
              error: message,
              code: "EXECUTION_ERROR",
              category: "execution",
            });
        }
      },
    },
  ];
}
