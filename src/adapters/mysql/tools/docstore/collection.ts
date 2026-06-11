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
  ListCollectionsSchema,
  ListCollectionsSchemaBase,
  CreateCollectionSchema,
  CreateCollectionSchemaBase,
  DropCollectionSchema,
  DropCollectionSchemaBase,
  CollectionInfoSchema,
  CollectionInfoSchemaBase,
  ListCollectionsOutputSchema,
  CreateCollectionOutputSchema,
  DropCollectionOutputSchema,
  CollectionInfoOutputSchema,
} from "../../schemas/index.js";
import {
  READ_ONLY,
  WRITE,
  DESTRUCTIVE,
} from "../../../../utils/annotations.js";

export function getTools(adapter: MySQLAdapter): ToolDefinition[] {
  return [
    {
      name: "mysql_doc_list_collections",
      title: "MySQL List Collections",
      description: "List JSON document collections in a schema.",
      group: "docstore",
      inputSchema: ListCollectionsSchemaBase,
      outputSchema: ListCollectionsOutputSchema,
      requiredScopes: ["read"],
      annotations: READ_ONLY,
      handler: async (params: unknown, _context: RequestContext) => {
        try {
          const { schema } = ListCollectionsSchema.parse(params);

          if (schema) {
            const schemaCheck = await adapter.executeQuery(
              "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?",
              [schema],
            );
            if (!schemaCheck.rows || schemaCheck.rows.length === 0) {
              return withTokenEstimate({
                success: false,
                error: `Schema '${schema}' does not exist`,
                code: "SCHEMA_NOT_FOUND",
                category: "domain",
              });
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
          return withTokenEstimate({
            success: true,
            data: {
              collections: result.rows ?? [],
              count: result.rows?.length ?? 0,
            },
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
      name: "mysql_doc_create_collection",
      title: "MySQL Create Collection",
      description: "Create a new JSON document collection.",
      group: "docstore",
      inputSchema: CreateCollectionSchemaBase,
      outputSchema: CreateCollectionOutputSchema,
      requiredScopes: ["write"],
      annotations: WRITE,
      handler: async (params: unknown, _context: RequestContext) => {
        let name: string | undefined;
        let schema: string | undefined;
        try {
          const parsed = CreateCollectionSchema.parse(params);
          name = parsed.name;
          schema = parsed.schema;
          const { ifNotExists, validation } = parsed;
          if (!IDENTIFIER_RE.test(name))
            return withTokenEstimate({
              success: false,
              error: "Invalid collection name",
            });
          if (schema && !IDENTIFIER_RE.test(schema))
            return withTokenEstimate({
              success: false,
              error: "Invalid schema name",
            });

          const tableRef = escapeTableRef(name, schema);

          // Pre-check existence when ifNotExists is true so we can report accurately
          if (ifNotExists) {
            const check = await checkCollectionExists(adapter, name, schema);
            if (check.exists) {
              return withTokenEstimate({
                success: true,
                data: {
                  skipped: true,
                  collection: name,
                  reason: "Collection already exists",
                },
              });
            }
            // If schema doesn't exist, report it even with ifNotExists
            if (check.reason === "schema") {
              return withTokenEstimate({
                success: false,
                error: `Schema '${check.name}' does not exist`,
                code: "SCHEMA_NOT_FOUND",
                category: "domain",
              });
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
          return withTokenEstimate({
            success: true,
            data: { collection: name },
          });
        } catch (error: unknown) {
          if (error instanceof z.ZodError) {
            return formatHandlerErrorResponse(error);
          }
          const message =
            error instanceof Error ? error.message : String(error);
          if (message.toLowerCase().includes("unknown database")) {
            return withTokenEstimate({
              success: false,
              error: `Schema '${schema ?? "unknown"}' does not exist`,
              code: "SCHEMA_NOT_FOUND",
              category: "domain",
            });
          }
          if (message.toLowerCase().includes("already exists")) {
            return withTokenEstimate({
              success: false,
              error: `Collection '${name ?? "unknown"}' already exists`,
            });
          }
          return withTokenEstimate({ success: false, error: message });
        }
      },
    },
    {
      name: "mysql_doc_drop_collection",
      title: "MySQL Drop Collection",
      description: "Drop a document collection.",
      group: "docstore",
      inputSchema: DropCollectionSchemaBase,
      outputSchema: DropCollectionOutputSchema,
      requiredScopes: ["admin"],
      annotations: DESTRUCTIVE,
      handler: async (params: unknown, _context: RequestContext) => {
        let name: string | undefined;
        let schema: string | undefined;
        try {
          const parsed = DropCollectionSchema.parse(params);
          name = parsed.name;
          schema = parsed.schema;
          const { ifExists } = parsed;
          if (!IDENTIFIER_RE.test(name))
            return withTokenEstimate({
              success: false,
              error: "Invalid collection name",
            });
          if (schema && !IDENTIFIER_RE.test(schema))
            return withTokenEstimate({
              success: false,
              error: "Invalid schema name",
            });

          const tableRef = escapeTableRef(name, schema);

          // P154: Schema existence check when explicitly provided
          if (schema) {
            const schemaCheck = await adapter.executeQuery(
              "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?",
              [schema],
            );
            if (!schemaCheck.rows || schemaCheck.rows.length === 0) {
              return withTokenEstimate({
                success: false,
                error: `Schema '${schema}' does not exist`,
                code: "SCHEMA_NOT_FOUND",
                category: "domain",
              });
            }
          }

          // Pre-check existence when ifExists is true so we can report accurately
          if (ifExists) {
            const check = await checkCollectionExists(adapter, name, schema);
            if (!check.exists) {
              return withTokenEstimate({
                success: true,
                data: {
                  collection: name,
                  message: "Collection did not exist",
                },
              });
            }
          }

          await adapter.executeQuery(
            `DROP TABLE ${ifExists ? "IF EXISTS " : ""}${tableRef}`,
          );
          adapter.clearSchemaCache();
          return withTokenEstimate({
            success: true,
            data: { collection: name },
          });
        } catch (error: unknown) {
          if (error instanceof z.ZodError) {
            return formatHandlerErrorResponse(error);
          }
          const message =
            error instanceof Error ? error.message : String(error);
          if (message.toLowerCase().includes("unknown table")) {
            return withTokenEstimate({
              success: false,
              error: `Collection '${name ?? "unknown"}' does not exist`,
            });
          }
          return withTokenEstimate({ success: false, error: message });
        }
      },
    },
    {
      name: "mysql_doc_collection_info",
      title: "MySQL Collection Info",
      description: "Get collection statistics.",
      group: "docstore",
      inputSchema: CollectionInfoSchemaBase,
      outputSchema: CollectionInfoOutputSchema,
      requiredScopes: ["read"],
      annotations: READ_ONLY,
      handler: async (params: unknown, _context: RequestContext) => {
        try {
          const { collection, schema } = CollectionInfoSchema.parse(params);
          if (!IDENTIFIER_RE.test(collection))
            return withTokenEstimate({
              success: false,
              error: "Invalid collection name",
            });

          // Check collection existence (with schema detection)
          const infoCheck = await checkCollectionExists(
            adapter,
            collection,
            schema,
          );
          if (!infoCheck.exists) {
            return infoCheck.reason === "schema"
              ? withTokenEstimate({
                  success: false,
                  error: `Schema '${infoCheck.name}' does not exist`,
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

          // Get accurate row count using COUNT(*) instead of INFORMATION_SCHEMA estimate
          const schemaClause = schema
            ? `\`${schema}\`.\`${collection}\``
            : `\`${collection}\``;
          const countResult = await adapter.executeQuery(
            `SELECT COUNT(*) as rowCount FROM ${schemaClause}`,
          );
          const countFirstRow = countResult.rows?.[0];
          const rowCount =
            countFirstRow && typeof countFirstRow === "object" && "rowCount" in countFirstRow
              ? Number(countFirstRow["rowCount"])
              : 0;

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
          return withTokenEstimate({
            success: true,
            data: {
              collection,
              stats: { rowCount, ...stats },
              indexes: indexInfo.rows ?? [],
            },
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
