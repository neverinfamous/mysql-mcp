import { z } from "zod";
import { formatHandlerErrorResponse } from "../core/error-helpers.js";
import type { MySQLAdapter } from "../../mysql-adapter.js";
import type { ToolDefinition, RequestContext } from "../../../../types/index.js";
import {
  IDENTIFIER_RE,
  JSON_PATH_RE,
  parseDocFilter,
  checkCollectionExists,
  escapeTableRef,
} from "./helpers.js";
import {
  FindSchema,
  AddDocSchema,
  ModifyDocSchema,
  RemoveDocSchema,
} from "../../schemas/index.js";

export function getTools(adapter: MySQLAdapter): ToolDefinition[] {
  return [
    {
      name: "mysql_doc_find",
      title: "MySQL Find Documents",
      description: "Query documents in a collection.",
      group: "docstore",
      inputSchema: FindSchema,
      requiredScopes: ["read"],
      annotations: { readOnlyHint: true, idempotentHint: true },
      handler: async (params: unknown, _context: RequestContext) => {
        try {
          const { collection, schema, filter, fields, limit, offset } =
            FindSchema.parse(params);
          if (!IDENTIFIER_RE.test(collection))
            return { success: false, error: "Invalid collection name" };
          if (schema && !IDENTIFIER_RE.test(schema))
            return { success: false, error: "Invalid schema name" };

          // Check if collection exists (with schema detection)
          const findCheck = await checkCollectionExists(
            adapter,
            collection,
            schema,
          );
          if (!findCheck.exists) {
            if (findCheck.reason === "schema") {
              return { exists: false, schema: findCheck.name };
            }
            return {
              exists: false,
              collection,
              documents: [],
              count: 0,
            };
          }

          let selectClause = "doc";
          if (fields && fields.length > 0) {
            // Validate all field names to prevent SQL injection
            for (const f of fields) {
              if (!IDENTIFIER_RE.test(f)) {
                return {
                  success: false,
                  error: `Invalid field name: "${f}". Field names must be valid identifiers (letters, digits, underscores).`,
                };
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
          if (filter) {
            if (!JSON_PATH_RE.test(filter)) {
              return {
                success: false,
                error: `Invalid JSON path filter: "${filter}". Use a valid JSON path like $.field or $.field.sub`,
              };
            }
            query += ` WHERE JSON_EXTRACT(doc, ?) IS NOT NULL`;
          }
          query += ` LIMIT ${String(limit)} OFFSET ${String(offset)}`;

          const queryParams: unknown[] = filter ? [filter] : [];
          const result = await adapter.executeQuery(query, queryParams);
          const docs = (result.rows ?? []).map((r) => {
            const row = r;
            const docValue = row["doc"];
            return typeof docValue === "string"
              ? (JSON.parse(docValue) as Record<string, unknown>)
              : docValue;
          });
          return { documents: docs, count: docs.length };
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
      inputSchema: AddDocSchema,
      requiredScopes: ["write"],
      annotations: { readOnlyHint: false },
      handler: async (params: unknown, _context: RequestContext) => {
        try {
          const { collection, schema, documents } = AddDocSchema.parse(params);
          if (!IDENTIFIER_RE.test(collection))
            return { success: false, error: "Invalid collection name" };
          if (schema && !IDENTIFIER_RE.test(schema))
            return { success: false, error: "Invalid schema name" };

          const addCheck = await checkCollectionExists(
            adapter,
            collection,
            schema,
          );
          if (!addCheck.exists) {
            return addCheck.reason === "schema"
              ? { exists: false, schema: addCheck.name }
              : { exists: false, collection };
          }

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
          return { success: true, inserted };
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
      inputSchema: ModifyDocSchema,
      requiredScopes: ["write"],
      annotations: { readOnlyHint: false },
      handler: async (params: unknown, _context: RequestContext) => {
        try {
          const { collection, schema, filter, set, unset } =
            ModifyDocSchema.parse(params);
          if (!IDENTIFIER_RE.test(collection))
            return { success: false, error: "Invalid collection name" };
          if (schema && !IDENTIFIER_RE.test(schema))
            return { success: false, error: "Invalid schema name" };

          const modCheck = await checkCollectionExists(
            adapter,
            collection,
            schema,
          );
          if (!modCheck.exists) {
            return modCheck.reason === "schema"
              ? { exists: false, schema: modCheck.name }
              : { exists: false, collection };
          }

          const updates: string[] = [];
          const updateParams: unknown[] = [];
          if (set) {
            for (const [path, value] of Object.entries(set)) {
              // Validate path against identifier regex to prevent injection
              if (!IDENTIFIER_RE.test(path)) {
                return {
                  success: false,
                  error: `Invalid field path: "${path}". Paths must be valid identifiers (letters, digits, underscores).`,
                };
              }
              updates.push(
                `doc = JSON_SET(doc, ?, CAST(? AS JSON))`,
              );
              updateParams.push(`$.${path}`, JSON.stringify(value));
            }
          }
          if (unset) {
            for (const path of unset) {
              // Validate path against identifier regex to prevent injection
              if (!IDENTIFIER_RE.test(path)) {
                return {
                  success: false,
                  error: `Invalid field path: "${path}". Paths must be valid identifiers (letters, digits, underscores).`,
                };
              }
              updates.push(`doc = JSON_REMOVE(doc, ?)`);
              updateParams.push(`$.${path}`);
            }
          }

          if (updates.length === 0)
            return { success: false, error: "No modifications specified" };

          const { where, params: whereParams } = parseDocFilter(filter);
          const tableRef = escapeTableRef(collection, schema);
          const query = `UPDATE ${tableRef} SET ${updates.join(", ")} WHERE ${where}`;
          const result = await adapter.executeQuery(query, [...updateParams, ...whereParams]);
          return { success: true, modified: result.rowsAffected ?? 0 };
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
      inputSchema: RemoveDocSchema,
      requiredScopes: ["write"],
      annotations: { readOnlyHint: false, destructiveHint: true },
      handler: async (params: unknown, _context: RequestContext) => {
        try {
          const { collection, schema, filter } = RemoveDocSchema.parse(params);
          if (!IDENTIFIER_RE.test(collection))
            return { success: false, error: "Invalid collection name" };
          if (schema && !IDENTIFIER_RE.test(schema))
            return { success: false, error: "Invalid schema name" };

          const rmCheck = await checkCollectionExists(
            adapter,
            collection,
            schema,
          );
          if (!rmCheck.exists) {
            return rmCheck.reason === "schema"
              ? { exists: false, schema: rmCheck.name }
              : { exists: false, collection };
          }

          const { where, params: whereParams } = parseDocFilter(filter);
          const tableRef = escapeTableRef(collection, schema);
          const query = `DELETE FROM ${tableRef} WHERE ${where}`;
          const result = await adapter.executeQuery(query, whereParams);
          return { success: true, removed: result.rowsAffected ?? 0 };
        } catch (error: unknown) {
          if (error instanceof z.ZodError) {
            return formatHandlerErrorResponse(error);
          }
          return formatHandlerErrorResponse(error);
        }
      },
    }
  ];
}
