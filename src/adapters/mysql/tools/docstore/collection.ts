import { z } from "zod";
import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "../core/error-helpers.js";
import type { MySQLAdapter } from "../../mysql-adapter/index.js";
import {
  type ToolDefinition,
  type RequestContext,
  ConflictError,
  ValidationError,
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

          if (schema && !IDENTIFIER_RE.test(schema)) {
            return formatHandlerErrorResponse(
              new ValidationError("Invalid schema name")
            );
          }

          if (schema) {
            const schemaCheck = await adapter.executeQuery(
              `SHOW SCHEMAS LIKE '${schema}'`
            );
            if (!schemaCheck.rows || schemaCheck.rows.length === 0) {
              return formatHandlerErrorResponse(
                new Error(`Schema '${schema}' does not exist`)
              );
            }
          }

          const showTablesQuery = schema ? `SHOW TABLE STATUS FROM \`${schema}\`` : `SHOW TABLE STATUS`;
          const tablesResult = await adapter.executeQuery(showTablesQuery);
          const tables = tablesResult.rows ?? [];
          
          const collections: Record<string, unknown>[] = [];
          for (const row of tables) {
            const tableName = row['Name'] as string;
            const tableRef = schema ? `\`${schema}\`.\`${tableName}\`` : `\`${tableName}\``;
            
            try {
              const columnsResult = await adapter.executeQuery(`SHOW COLUMNS FROM ${tableRef}`);
              let hasDoc = false;
              let hasId = false;
              if (columnsResult.rows) {
                for (const col of columnsResult.rows) {
                  const field = col['Field'];
                  const type = typeof col['Type'] === 'string' ? col['Type'].toLowerCase() : '';
                  if (field === 'doc' && type.includes('json')) hasDoc = true;
                  if (field === '_id') hasId = true;
                }
              }
              if (hasDoc && hasId) {
                collections.push({
                  name: tableName,
                  comment: row['Comment'] ?? "",
                  rowCount: Number(row['Rows'] ?? 0)
                });
              }
            } catch {
               // ignore errors (e.g. view without permissions)
            }
          }
          return withTokenEstimate({
            success: true,
            data: {
              collections,
              count: collections.length,
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
            return formatHandlerErrorResponse(
              new ValidationError("Invalid collection name")
            );
          if (schema && !IDENTIFIER_RE.test(schema))
            return formatHandlerErrorResponse(
              new ValidationError("Invalid schema name")
            );

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
            // If schema does not exist, report it even with ifNotExists
            if (check.reason === "schema") {
              return formatHandlerErrorResponse(
                new Error(`Schema '${check.name}' does not exist`)
              );
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

          const validationLevel = validation?.level ?? (validation?.schema ? "STRICT" : "OFF");
          if (validationLevel !== "OFF") {
            const schemaJson = JSON.stringify(validation?.schema ?? {});
            // Escape backslashes and single quotes for MySQL string literal
            const escapedSchemaJson = schemaJson.replace(/\\/g, '\\\\').replace(/'/g, "''");
            sql = `${createClause} ${tableRef} (
                        doc JSON,
                        _id VARBINARY(32) GENERATED ALWAYS AS (JSON_UNQUOTE(JSON_EXTRACT(doc, '$._id'))) STORED PRIMARY KEY,
                        CHECK (JSON_SCHEMA_VALID('${escapedSchemaJson}', doc))
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
            return formatHandlerErrorResponse(
              new Error(`Schema '${schema ?? "unknown"}' does not exist`)
            );
          }
          if (message.toLowerCase().includes("already exists")) {
            return formatHandlerErrorResponse(
              new ConflictError(`Collection '${name ?? "unknown"}' already exists`)
            );
          }
          return formatHandlerErrorResponse(error);
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
            return formatHandlerErrorResponse(
              new ValidationError("Invalid collection name")
            );
          if (schema && !IDENTIFIER_RE.test(schema))
            return formatHandlerErrorResponse(
              new ValidationError("Invalid schema name")
            );

          const tableRef = escapeTableRef(name, schema);

          // P154: Schema existence check when explicitly provided
          if (schema) {
            const schemaCheck = await adapter.executeQuery(
              `SHOW SCHEMAS LIKE '${schema}'`
            );
            if (!schemaCheck.rows || schemaCheck.rows.length === 0) {
              return formatHandlerErrorResponse(
                new Error(`Schema '${schema}' does not exist`)
              );
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
                  skipped: true,
                  reason: "Collection did not exist",
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
            return formatHandlerErrorResponse(
              new Error(`Collection '${name ?? "unknown"}' does not exist`)
            );
          }
          return formatHandlerErrorResponse(error);
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
            return formatHandlerErrorResponse(
              new ValidationError("Invalid collection name")
            );
          if (schema && !IDENTIFIER_RE.test(schema))
            return formatHandlerErrorResponse(
              new ValidationError("Invalid schema name")
            );

          // Pre-checks removed to prevent ProxySQL hostgroup locking (HG1 poisoning)
          // adapter will throw ER_NO_SUCH_TABLE mapped to TABLE_NOT_FOUND

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
              info: {
                rowCount,
                ...stats,
                indexes: indexInfo.rows ?? [],
              },
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
