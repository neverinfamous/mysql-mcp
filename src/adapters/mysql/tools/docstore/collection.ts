import { z } from "zod";
import { formatHandlerErrorResponse } from "../core/error-helpers.js";
import type { MySQLAdapter } from "../../mysql-adapter.js";
import type { ToolDefinition, RequestContext } from "../../../../types/index.js";
import {
  IDENTIFIER_RE,
  checkCollectionExists,
  escapeTableRef,
} from "./helpers.js";
import {
  ListCollectionsSchema,
  CreateCollectionSchema,
  DropCollectionSchema,
  CollectionInfoSchema,
} from "../../schemas/index.js";

export function getTools(adapter: MySQLAdapter): ToolDefinition[] {
  return [
    {
      name: "mysql_doc_list_collections",
      title: "MySQL List Collections",
      description: "List JSON document collections in a schema.",
      group: "docstore",
      inputSchema: ListCollectionsSchema,
      requiredScopes: ["read"],
      annotations: { readOnlyHint: true, idempotentHint: true },
      handler: async (params: unknown, _context: RequestContext) => {
        try {
          const { schema } = ListCollectionsSchema.parse(params);

          // P154: Schema existence check when explicitly provided
          if (schema) {
            const schemaCheck = await adapter.executeQuery(
              "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?",
              [schema],
            );
            if (!schemaCheck.rows || schemaCheck.rows.length === 0) {
              return { exists: false, schema };
            }
          }

          const query = `
                    SELECT TABLE_NAME as name, TABLE_COMMENT as comment, TABLE_ROWS as rowCount
                    FROM information_schema.TABLES
                    WHERE TABLE_SCHEMA = COALESCE(?, DATABASE())
                      AND TABLE_NAME IN (
                          SELECT c1.TABLE_NAME FROM information_schema.COLUMNS c1
                          JOIN information_schema.COLUMNS c2
                            ON c1.TABLE_SCHEMA = c2.TABLE_SCHEMA AND c1.TABLE_NAME = c2.TABLE_NAME
                          WHERE c1.COLUMN_NAME = 'doc' AND c1.DATA_TYPE = 'json'
                            AND c2.COLUMN_NAME = '_id'
                            AND c1.TABLE_SCHEMA = COALESCE(?, DATABASE())
                      )`;
          const result = await adapter.executeQuery(query, [
            schema ?? null,
            schema ?? null,
          ]);
          return {
            collections: result.rows ?? [],
            count: result.rows?.length ?? 0,
          };
        } catch (error: unknown) {
          if (error instanceof z.ZodError) {
            return formatHandlerErrorResponse(error);
          }
          return formatHandlerErrorResponse(error);
        }
      },
    },
    {
      name: "mysql_doc_create_collection",
      title: "MySQL Create Collection",
      description: "Create a new JSON document collection.",
      group: "docstore",
      inputSchema: CreateCollectionSchema,
      requiredScopes: ["write"],
      annotations: { readOnlyHint: false },
      handler: async (params: unknown, _context: RequestContext) => {
        try {
          const { name, schema, ifNotExists, validation } =
            CreateCollectionSchema.parse(params);
          if (!IDENTIFIER_RE.test(name))
            return { success: false, error: "Invalid collection name" };
          if (schema && !IDENTIFIER_RE.test(schema))
            return { success: false, error: "Invalid schema name" };

          const tableRef = escapeTableRef(name, schema);

          // Pre-check existence when ifNotExists is true so we can report accurately
          if (ifNotExists) {
            const check = await checkCollectionExists(adapter, name, schema);
            if (check.exists) {
              return {
                success: true,
                skipped: true,
                collection: name,
                reason: "Collection already exists",
              };
            }
            // If schema doesn't exist, report it even with ifNotExists
            if (check.reason === "schema") {
              return { exists: false, schema: check.name };
            }
          }

          const createClause = ifNotExists
            ? "CREATE TABLE IF NOT EXISTS"
            : "CREATE TABLE";

          let sql = `${createClause} ${tableRef} (
                    doc JSON,
                    _id VARBINARY(32) GENERATED ALWAYS AS (JSON_UNQUOTE(JSON_EXTRACT(doc, '$._id'))) STORED PRIMARY KEY,
                    _json_schema JSON GENERATED ALWAYS AS ('{}') VIRTUAL
                ) ENGINE=InnoDB`;

          if (validation?.level && validation.level !== "OFF") {
            const schemaJson = JSON.stringify(validation.schema ?? {});
            sql = `${createClause} ${tableRef} (
                        doc JSON,
                        _id VARBINARY(32) GENERATED ALWAYS AS (JSON_UNQUOTE(JSON_EXTRACT(doc, '$._id'))) STORED PRIMARY KEY,
                        CONSTRAINT chk_schema CHECK (JSON_SCHEMA_VALID('${schemaJson}', doc))
                    ) ENGINE=InnoDB`;
          }

          await adapter.executeQuery(sql);
          adapter.clearSchemaCache();
          return { success: true, collection: name };
        } catch (error: unknown) {
          if (error instanceof z.ZodError) {
            return formatHandlerErrorResponse(error);
          }
          const message =
            error instanceof Error ? error.message : String(error);
          if (message.toLowerCase().includes("unknown database")) {
            return {
              exists: false,
              schema: (params as { schema?: string })?.schema ?? "unknown",
            };
          }
          if (message.toLowerCase().includes("already exists")) {
            return {
              success: false,
              error: `Collection '${(params as { name?: string })?.name ?? "unknown"}' already exists`,
            };
          }
          return { success: false, error: message };
        }
      },
    },
    {
      name: "mysql_doc_drop_collection",
      title: "MySQL Drop Collection",
      description: "Drop a document collection.",
      group: "docstore",
      inputSchema: DropCollectionSchema,
      requiredScopes: ["admin"],
      annotations: { readOnlyHint: false, destructiveHint: true },
      handler: async (params: unknown, _context: RequestContext) => {
        try {
          const { name, schema, ifExists } = DropCollectionSchema.parse(params);
          if (!IDENTIFIER_RE.test(name))
            return { success: false, error: "Invalid collection name" };
          if (schema && !IDENTIFIER_RE.test(schema))
            return { success: false, error: "Invalid schema name" };

          const tableRef = escapeTableRef(name, schema);

          // P154: Schema existence check when explicitly provided
          if (schema) {
            const schemaCheck = await adapter.executeQuery(
              "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?",
              [schema],
            );
            if (!schemaCheck.rows || schemaCheck.rows.length === 0) {
              return { exists: false, schema };
            }
          }

          // Pre-check existence when ifExists is true so we can report accurately
          if (ifExists) {
            const check = await checkCollectionExists(adapter, name, schema);
            if (!check.exists) {
              return {
                success: true,
                collection: name,
                message: "Collection did not exist",
              };
            }
          }

          await adapter.executeQuery(
            `DROP TABLE ${ifExists ? "IF EXISTS " : ""}${tableRef}`,
          );
          adapter.clearSchemaCache();
          return { success: true, collection: name };
        } catch (error: unknown) {
          if (error instanceof z.ZodError) {
            return formatHandlerErrorResponse(error);
          }
          const message =
            error instanceof Error ? error.message : String(error);
          if (message.toLowerCase().includes("unknown table")) {
            return {
              success: false,
              error: `Collection '${(params as { name?: string })?.name ?? "unknown"}' does not exist`,
            };
          }
          return { success: false, error: message };
        }
      },
    },
    {
      name: "mysql_doc_collection_info",
      title: "MySQL Collection Info",
      description: "Get collection statistics.",
      group: "docstore",
      inputSchema: CollectionInfoSchema,
      requiredScopes: ["read"],
      annotations: { readOnlyHint: true, idempotentHint: true },
      handler: async (params: unknown, _context: RequestContext) => {
        try {
          const { collection, schema } = CollectionInfoSchema.parse(params);
          if (!IDENTIFIER_RE.test(collection))
            return { success: false, error: "Invalid collection name" };

          // Check collection existence (with schema detection)
          const infoCheck = await checkCollectionExists(
            adapter,
            collection,
            schema,
          );
          if (!infoCheck.exists) {
            return infoCheck.reason === "schema"
              ? { exists: false, schema: infoCheck.name }
              : { exists: false, collection };
          }

          // Get accurate row count using COUNT(*) instead of INFORMATION_SCHEMA estimate
          const schemaClause = schema
            ? `\`${schema}\`.\`${collection}\``
            : `\`${collection}\``;
          const countResult = await adapter.executeQuery(
            `SELECT COUNT(*) as rowCount FROM ${schemaClause}`,
          );
          const rowCount =
            (countResult.rows?.[0] as { rowCount: number })?.rowCount ?? 0;

          const tableInfo = await adapter.executeQuery(
            `
                    SELECT DATA_LENGTH as dataSize, INDEX_LENGTH as indexSize
                    FROM information_schema.TABLES
                    WHERE TABLE_SCHEMA = COALESCE(?, DATABASE()) AND TABLE_NAME = ?
                `,
            [schema ?? null, collection],
          );

          const indexInfo = await adapter.executeQuery(
            `
                    SELECT INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX, NON_UNIQUE
                    FROM information_schema.STATISTICS
                    WHERE TABLE_SCHEMA = COALESCE(?, DATABASE()) AND TABLE_NAME = ?
                `,
            [schema ?? null, collection],
          );

          const stats = tableInfo.rows?.[0] ?? {};
          return {
            collection,
            stats: { rowCount, ...stats },
            indexes: indexInfo.rows ?? [],
          };
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
