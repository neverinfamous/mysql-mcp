import { z } from "zod";
import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "../core/error-helpers.js";
import type { MySQLAdapter } from "../../mysql-adapter.js";
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
        try {
          const { collection, schema, name, fields, unique } =
            CreateDocIndexSchema.parse(params);
          if (!IDENTIFIER_RE.test(collection))
            return withTokenEstimate({
              success: false,
              error: "Invalid collection name",
            });
          if (schema && !IDENTIFIER_RE.test(schema))
            return withTokenEstimate({
              success: false,
              error: "Invalid schema name",
            });
          if (!IDENTIFIER_RE.test(name))
            return withTokenEstimate({
              success: false,
              error: "Invalid index name",
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
            const colName = `_idx_${field.path.replace(/\./g, "_")}`;
            const cast = field.type === "TEXT" ? "CHAR(255)" : field.type;
            await adapter.executeQuery(
              `ALTER TABLE ${tableRef} ADD COLUMN \`${colName}\` ${cast}
                           GENERATED ALWAYS AS (JSON_UNQUOTE(JSON_EXTRACT(doc, '$.${field.path}'))) STORED`,
            );
          }

          const cols = fields
            .map((f) => `\`_idx_${f.path.replace(/\./g, "_")}\``)
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
              error: `Index '${(params as { name?: string })?.name ?? "unknown"}' or its generated columns already exist on '${(params as { collection?: string })?.collection ?? "unknown"}'`,
            });
          }
          return withTokenEstimate({ success: false, error: message });
        }
      },
    },
  ];
}
