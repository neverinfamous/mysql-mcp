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
} from "../../../../types/index.js";
import {
  IDENTIFIER_RE,
  JSON_PATH_RE,
  parseDocFilter,
  escapeTableRef,
} from "./helpers.js";
import {
  FindSchema,
  FindSchemaBase,
  AddDocSchema,
  AddDocSchemaBase,
  ModifyDocSchema,
  ModifyDocSchemaBase,
  RemoveDocSchema,
  RemoveDocSchemaBase,
  FindDocOutputSchema,
  AddDocOutputSchema,
  ModifyDocOutputSchema,
  RemoveDocOutputSchema,
} from "../../schemas/index.js";
import {
  READ_ONLY,
  WRITE,
  DESTRUCTIVE,
} from "../../../../utils/annotations.js";

export function getTools(adapter: MySQLAdapter): ToolDefinition[] {
  return [
    {
      name: "mysql_doc_find",
      title: "MySQL Find Documents",
      description: "Query documents in a collection.",
      group: "docstore",
      inputSchema: FindSchemaBase,
      outputSchema: FindDocOutputSchema,
      requiredScopes: ["read"],
      annotations: READ_ONLY,
      handler: async (params: unknown, _context: RequestContext) => {
        try {
          const { collection, schema, filter, fields, limit, offset } =
            FindSchema.parse(params);
          if (!IDENTIFIER_RE.test(collection))
            throw new ValidationError("Invalid collection name");
          if (schema && !IDENTIFIER_RE.test(schema))
            throw new ValidationError("Invalid schema name");

          // Pre-checks removed to prevent ProxySQL hostgroup locking (HG1 poisoning)
          // adapter will throw ER_NO_SUCH_TABLE mapped to TABLE_NOT_FOUND

          let selectClause = "_id, doc";
          if (fields && fields.length > 0) {
            // Validate all field names to prevent SQL injection
            for (const f of fields) {
              if (!IDENTIFIER_RE.test(f)) {
                throw new ValidationError(`Invalid field name: "${f}". Field names must be valid identifiers (letters, digits, underscores).`);
              }
            }
            selectClause =
              "JSON_OBJECT(" +
              fields
                .map((f) => `'${f}', JSON_EXTRACT(doc, '$.${f}')`)
                .join(", ") +
              ") as doc";
          }

          const tableRef = escapeTableRef(collection, schema);
          let query = `SELECT ${selectClause} FROM ${tableRef}`;
          let queryParams: unknown[] = [];

          if (filter) {
            const { where, params: whereParams } = parseDocFilter(filter);
            query += ` WHERE ${where}`;
            queryParams = whereParams;
          }

          query += ` LIMIT ${String(limit)} OFFSET ${String(offset)}`;

          const result = await adapter.executeQuery(query, queryParams);
          const docs = (result.rows ?? []).map((r) => {
            const row = r;
            const docValue = row["doc"];
            const idValue = row["_id"];
            const parsed: unknown =
              typeof docValue === "string"
                ? JSON.parse(docValue)
                : docValue;

            if (
              idValue !== undefined &&
              parsed !== null &&
              typeof parsed === "object" &&
              !Array.isArray(parsed)
            ) {
              if (!("_id" in parsed)) {
                Object.assign(parsed, { _id: idValue });
              }
            }
            return parsed;
          });
          return withTokenEstimate({
            success: true,
            data: { documents: docs, count: docs.length },
          });
        } catch (error: unknown) {
          if (error instanceof z.ZodError) {
            return formatHandlerErrorResponse(error);
          }
          return formatHandlerErrorResponse(error);
        }
      },
    },
    {
      name: "mysql_doc_add",
      title: "MySQL Add Documents",
      description: "Add documents to a collection.",
      group: "docstore",
      inputSchema: AddDocSchemaBase,
      outputSchema: AddDocOutputSchema,
      requiredScopes: ["write"],
      annotations: WRITE,
      handler: async (params: unknown, _context: RequestContext) => {
        try {
          const { collection, schema, documents } = AddDocSchema.parse(params);
          if (!IDENTIFIER_RE.test(collection))
            throw new ValidationError("Invalid collection name");
          if (schema && !IDENTIFIER_RE.test(schema))
            throw new ValidationError("Invalid schema name");

          // Pre-checks removed to prevent ProxySQL hostgroup locking (HG1 poisoning)
          // adapter will throw ER_NO_SUCH_TABLE mapped to TABLE_NOT_FOUND

          const tableRef = escapeTableRef(collection, schema);
          let inserted = 0;
          for (const doc of documents) {
            doc["_id"] ??= crypto.randomUUID().replace(/-/g, "");
            await adapter.executeQuery(
              `INSERT INTO ${tableRef} (doc) VALUES (?)`,
              [JSON.stringify(doc)],
            );
            inserted++;
          }
          return withTokenEstimate({ success: true, data: { inserted } });
        } catch (error: unknown) {
          if (error instanceof z.ZodError) {
            return formatHandlerErrorResponse(error);
          }
          return formatHandlerErrorResponse(error);
        }
      },
    },
    {
      name: "mysql_doc_modify",
      title: "MySQL Modify Documents",
      description: "Update documents in a collection.",
      group: "docstore",
      inputSchema: ModifyDocSchemaBase,
      outputSchema: ModifyDocOutputSchema,
      requiredScopes: ["write"],
      annotations: WRITE,
      handler: async (params: unknown, _context: RequestContext) => {
        try {
          const { collection, schema, filter, set, unset } =
            ModifyDocSchema.parse(params);
          if (!IDENTIFIER_RE.test(collection))
            throw new ValidationError("Invalid collection name");
          if (schema && !IDENTIFIER_RE.test(schema))
            throw new ValidationError("Invalid schema name");

          // Pre-checks removed to prevent ProxySQL hostgroup locking (HG1 poisoning)
          // adapter will throw ER_NO_SUCH_TABLE mapped to TABLE_NOT_FOUND

          const updates: string[] = [];
          const updateParams: unknown[] = [];
          if (set) {
            for (const [rawPath, value] of Object.entries(set)) {
              let formattedPath = rawPath;
              if (!formattedPath.startsWith("$")) {
                formattedPath = formattedPath.startsWith("[") ? "$" + formattedPath : "$." + formattedPath;
              }
              if (!JSON_PATH_RE.test(formattedPath)) {
                throw new ValidationError(`Invalid field path: "${rawPath}". Paths must be valid JSON paths.`);
              }
              updates.push(`doc = JSON_SET(doc, ?, CAST(CONVERT(? USING utf8mb4) AS JSON))`);
              updateParams.push(formattedPath, JSON.stringify(value));
            }
          }
          if (unset) {
            for (const rawPath of unset) {
              let formattedPath = rawPath;
              if (!formattedPath.startsWith("$")) {
                formattedPath = formattedPath.startsWith("[") ? "$" + formattedPath : "$." + formattedPath;
              }
              if (!JSON_PATH_RE.test(formattedPath)) {
                throw new ValidationError(`Invalid field path: "${rawPath}". Paths must be valid JSON paths.`);
              }
              updates.push(`doc = JSON_REMOVE(doc, ?)`);
              updateParams.push(formattedPath);
            }
          }

          if (updates.length === 0)
            throw new ValidationError("No modifications specified");

          const { where, params: whereParams } = parseDocFilter(filter);
          const tableRef = escapeTableRef(collection, schema);
          const query = `UPDATE ${tableRef} SET ${updates.join(", ")} WHERE ${where}`;
          const result = await adapter.executeQuery(query, [
            ...updateParams,
            ...whereParams,
          ]);
          return withTokenEstimate({
            success: true,
            data: { modified: result.rowsAffected ?? 0 },
          });
        } catch (error: unknown) {
          if (error instanceof z.ZodError) {
            return formatHandlerErrorResponse(error);
          }
          return formatHandlerErrorResponse(error);
        }
      },
    },
    {
      name: "mysql_doc_remove",
      title: "MySQL Remove Documents",
      description: "Remove documents from a collection.",
      group: "docstore",
      inputSchema: RemoveDocSchemaBase,
      outputSchema: RemoveDocOutputSchema,
      requiredScopes: ["write"],
      annotations: DESTRUCTIVE,
      handler: async (params: unknown, _context: RequestContext) => {
        try {
          const { collection, schema, filter } = RemoveDocSchema.parse(params);
          if (!IDENTIFIER_RE.test(collection))
            throw new ValidationError("Invalid collection name");
          if (schema && !IDENTIFIER_RE.test(schema))
            throw new ValidationError("Invalid schema name");

          // Pre-checks removed to prevent ProxySQL hostgroup locking (HG1 poisoning)
          // adapter will throw ER_NO_SUCH_TABLE mapped to TABLE_NOT_FOUND

          const { where, params: whereParams } = parseDocFilter(filter);
          const tableRef = escapeTableRef(collection, schema);
          const query = `DELETE FROM ${tableRef} WHERE ${where}`;
          const result = await adapter.executeQuery(query, whereParams);
          return withTokenEstimate({
            success: true,
            data: { removed: result.rowsAffected ?? 0 },
          });
        } catch (error: unknown) {
          if (error instanceof z.ZodError) {
            return formatHandlerErrorResponse(error);
          }
          return formatHandlerErrorResponse(error);
        }
      },
    },
  ];
}
