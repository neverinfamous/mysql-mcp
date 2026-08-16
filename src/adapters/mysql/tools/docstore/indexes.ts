import { z } from "zod";
import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "../core/error-helpers.js";
import type { MySQLAdapter } from "../../mysql-adapter/index.js";
import {
  type ToolDefinition,
  type RequestContext,
  ValidationError,
  MySQLMcpError,
  ErrorCategory,
} from "../../../../types/index.js";
import {
  IDENTIFIER_RE,
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
            throw new ValidationError("Invalid collection name");
          if (schema && !IDENTIFIER_RE.test(schema))
            throw new ValidationError("Invalid schema name");
          if (!IDENTIFIER_RE.test(name))
            throw new ValidationError("Invalid index name");

          // Pre-checks removed to prevent ProxySQL hostgroup locking (HG1 poisoning)
          // adapter will throw ER_NO_SUCH_TABLE mapped to TABLE_NOT_FOUND

          const tableRef = escapeTableRef(collection, schema);
          for (const field of fields) {
            const cleanPath = field.path.replace(/^\$\.?/, "");
            if (!/^[a-zA-Z0-9_.]+$/.test(cleanPath)) {
              throw new ValidationError(`Invalid field path: "${field.path}". Paths must contain only letters, digits, underscores, and dots.`);
            }
            if (!/^[a-zA-Z0-9_(), ]+$/.test(field.type)) {
              throw new ValidationError(`Invalid field type format: "${field.type}". Type must contain only alphanumeric characters, parentheses, spaces, and underscores.`);
            }
            const baseType = field.type.toUpperCase().replace(/\(.*$/, "");
            const validTypes = ["INT", "BIGINT", "TINYINT", "SMALLINT", "MEDIUMINT", "FLOAT", "DOUBLE", "DECIMAL", "DATE", "DATETIME", "TIMESTAMP", "TIME", "YEAR", "CHAR", "VARCHAR", "TEXT", "STRING", "BOOLEAN", "JSON"];
            if (!validTypes.includes(baseType)) {
              throw new ValidationError(`Invalid field type: "${field.type}". Type must be a valid MySQL data type.`);
            }
            const colName = `_idx_${cleanPath.replace(/\./g, "_")}`;
            const typeUpper = field.type.toUpperCase();
            const cast = (typeUpper === "TEXT" || typeUpper === "STRING" || typeUpper === "VARCHAR") 
              ? "VARCHAR(255)" 
              : typeUpper.replace(/^(TEXT|STRING)\(/, "VARCHAR(");
            try {
              await adapter.executeQuery(
                `ALTER TABLE ${tableRef} ADD COLUMN \`${colName}\` ${cast}
                             GENERATED ALWAYS AS (JSON_UNQUOTE(JSON_EXTRACT(doc, '$.${cleanPath}'))) STORED`,
              );
            } catch (colError: unknown) {
              const colMessage = colError instanceof Error ? colError.message : String(colError);
              if (!colMessage.toLowerCase().includes("duplicate column")) {
                throw colError;
              }
              // Ignore duplicate column and reuse the existing one
            }
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
            return formatHandlerErrorResponse(
              new MySQLMcpError(
                `Index '${name ?? "unknown"}' or its generated columns already exist on '${collection ?? "unknown"}'`,
                "ALREADY_EXISTS",
                ErrorCategory.RESOURCE,
                { suggestion: "The index or column already exists. Use a different name or drop the existing index first." }
              )
            );
          }
          return formatHandlerErrorResponse(error);
        }
      },
    },
  ];
}
