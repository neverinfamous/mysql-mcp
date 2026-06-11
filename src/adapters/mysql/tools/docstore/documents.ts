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
  parseDocFilter,
  checkCollectionExists,
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
            return withTokenEstimate({
              success: false,
              error: "Invalid collection name",
            });
          if (schema && !IDENTIFIER_RE.test(schema))
            return withTokenEstimate({
              success: false,
              error: "Invalid schema name",
            });

          // Check if collection exists (with schema detection)
          const findCheck = await checkCollectionExists(
            adapter,
            collection,
            schema,
          );
          if (!findCheck.exists) {
            return findCheck.reason === "schema"
              ? withTokenEstimate({
                  success: false,
                  error: `Schema '${findCheck.name}' does not exist`,
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

          let selectClause = "_id, doc";
          if (fields && fields.length > 0) {
            // Validate all field names to prevent SQL injection
            for (const f of fields) {
              if (!IDENTIFIER_RE.test(f)) {
                return withTokenEstimate({
                  success: false,
                  error: `Invalid field name: "${f}". Field names must be valid identifiers (letters, digits, underscores).`,
                });
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
            const parsed =
              typeof docValue === "string"
                ? (JSON.parse(docValue) as Record<string, unknown>)
                : docValue;

            if (
              idValue !== undefined &&
              parsed !== null &&
              typeof parsed === "object" &&
              !Array.isArray(parsed)
            ) {
              if (!("_id" in (parsed as Record<string, unknown>))) {
                (parsed as Record<string, unknown>)["_id"] = idValue;
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
            return withTokenEstimate({
              success: false,
              error: "Invalid collection name",
            });
          if (schema && !IDENTIFIER_RE.test(schema))
            return withTokenEstimate({
              success: false,
              error: "Invalid schema name",
            });

          const addCheck = await checkCollectionExists(
            adapter,
            collection,
            schema,
          );
          if (!addCheck.exists) {
            return addCheck.reason === "schema"
              ? withTokenEstimate({
                  success: false,
                  error: `Schema '${addCheck.name}' does not exist`,
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
            return withTokenEstimate({
              success: false,
              error: "Invalid collection name",
            });
          if (schema && !IDENTIFIER_RE.test(schema))
            return withTokenEstimate({
              success: false,
              error: "Invalid schema name",
            });

          const modCheck = await checkCollectionExists(
            adapter,
            collection,
            schema,
          );
          if (!modCheck.exists) {
            return modCheck.reason === "schema"
              ? withTokenEstimate({
                  success: false,
                  error: `Schema '${modCheck.name}' does not exist`,
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

          const updates: string[] = [];
          const updateParams: unknown[] = [];
          if (set) {
            for (const [path, value] of Object.entries(set)) {
              // Validate path against identifier regex to prevent injection
              if (!IDENTIFIER_RE.test(path)) {
                return withTokenEstimate({
                  success: false,
                  error: `Invalid field path: "${path}". Paths must be valid identifiers (letters, digits, underscores).`,
                });
              }
              updates.push(`doc = JSON_SET(doc, ?, CAST(? AS JSON))`);
              updateParams.push(`$.${path}`, JSON.stringify(value));
            }
          }
          if (unset) {
            for (const path of unset) {
              // Validate path against identifier regex to prevent injection
              if (!IDENTIFIER_RE.test(path)) {
                return withTokenEstimate({
                  success: false,
                  error: `Invalid field path: "${path}". Paths must be valid identifiers (letters, digits, underscores).`,
                });
              }
              updates.push(`doc = JSON_REMOVE(doc, ?)`);
              updateParams.push(`$.${path}`);
            }
          }

          if (updates.length === 0)
            return withTokenEstimate({
              success: false,
              error: "No modifications specified",
            });

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
            return withTokenEstimate({
              success: false,
              error: "Invalid collection name",
            });
          if (schema && !IDENTIFIER_RE.test(schema))
            return withTokenEstimate({
              success: false,
              error: "Invalid schema name",
            });

          const rmCheck = await checkCollectionExists(
            adapter,
            collection,
            schema,
          );
          if (!rmCheck.exists) {
            return rmCheck.reason === "schema"
              ? withTokenEstimate({
                  success: false,
                  error: `Schema '${rmCheck.name}' does not exist`,
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
