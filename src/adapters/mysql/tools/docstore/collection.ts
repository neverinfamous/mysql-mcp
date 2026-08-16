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
          
          // Optimize: single query to find tables with doc JSON and _id columns
          const schemaClause = schema ? `TABLE_SCHEMA = '${schema.replace(/'/g, "''")}'` : `TABLE_SCHEMA = DATABASE()`;
          const infoQuery = `SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE FROM information_schema.columns WHERE ${schemaClause} AND COLUMN_NAME IN ('doc', '_id')`;
          
          let validCollections = new Set<string>();
          try {
            const infoResult = await adapter.executeQuery(infoQuery);
            const tableCols = new Map<string, Set<string>>();
            for (const row of (infoResult.rows ?? [])) {
              const tName = row['TABLE_NAME'] as string;
              const cName = row['COLUMN_NAME'] as string;
              const dType = typeof row['DATA_TYPE'] === 'string' ? row['DATA_TYPE'].toLowerCase() : '';
              
              if (!tableCols.has(tName)) tableCols.set(tName, new Set());
              const cols = tableCols.get(tName);
              if (cols) {
                if (cName === 'doc' && dType === 'json') {
                  cols.add('doc');
                }
                if (cName === '_id') {
                  cols.add('_id');
                }
              }
            }
            validCollections = new Set(
              Array.from(tableCols.entries())
                   .filter(([, cols]) => cols.has('doc') && cols.has('_id'))
                   .map(([tName]) => tName)
            );
          } catch {
             // Fallback to empty if information_schema fails
          }
          
          const collections: Record<string, unknown>[] = [];
          for (const row of tables) {
            const tableName = row['Name'] as string;
            if (!tableName) continue;
            
            if (validCollections.has(tableName)) {
              collections.push({
                name: tableName,
                comment: row['Comment'] ?? "",
                rowCount: Number(row['Rows'] ?? 0)
              });
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
            if (check.reason === "not_a_collection") {
              return formatHandlerErrorResponse(
                new ValidationError(`Table '${check.name}' already exists but is not a valid document collection`)
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
            
            // PRE-CHECK: Validate JSON Schema definition against MySQL engine
            try {
              await adapter.executeQuery(`SELECT JSON_SCHEMA_VALID('${escapedSchemaJson}', '{}')`);
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : String(err);
              return formatHandlerErrorResponse(
                new ValidationError(`Invalid JSON Schema definition: ${msg.replace(/^.*: /, '')}`)
              );
            }

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
              new ConflictError(`Collection '${name ?? "unknown"}' already exists`, undefined, {
                suggestion: "Collection already exists. Use ifNotExists: true to skip creation or choose a different name.",
              })
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

          // Always check existence to prevent dropping non-docstore relational tables
          const check = await checkCollectionExists(adapter, name, schema);
          if (!check.exists) {
            if (check.reason === "not_a_collection") {
              return formatHandlerErrorResponse(
                new ValidationError(`Table '${name}' exists but is not a valid document collection`)
              );
            }
            if (ifExists) {
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

          // Ensure it is a valid document collection
          const check = await checkCollectionExists(adapter, collection, schema);
          if (!check.exists) {
            if (check.reason === "schema") {
              throw new Error(`Schema '${check.name}' does not exist`);
            }
            if (check.reason === "not_a_collection") {
              throw new ValidationError(`Table '${check.name}' exists but is not a valid document collection`);
            }
            throw new Error(`Collection '${check.name}' does not exist`);
          }

          // We use SHOW statements to avoid ProxySQL hostgroup locking that can happen with information_schema
          // Get accurate row count using COUNT(*) can also fail if the connection is locked, so we use SHOW TABLE STATUS

          const schemaPrefix = schema ? `FROM \`${schema}\` ` : '';
          const tableStatus = await adapter.executeQuery(
            `SHOW TABLE STATUS ${schemaPrefix}WHERE Name = '${collection}'`
          );

          if (!tableStatus.rows || tableStatus.rows.length === 0) {
            throw new Error(`Collection '${collection}' does not exist`);
          }

          const stats = tableStatus.rows[0];
          const rowCount = stats && typeof stats === 'object' && 'Rows' in stats ? Number(stats['Rows']) : 0;
          const dataSize = stats && typeof stats === 'object' && 'Data_length' in stats ? Number(stats['Data_length']) : 0;
          const indexSize = stats && typeof stats === 'object' && 'Index_length' in stats ? Number(stats['Index_length']) : 0;

          const tableRef = escapeTableRef(collection, schema);
          const keysResult = await adapter.executeQuery(
            `SHOW KEYS FROM ${tableRef}`
          );

          const indexes = (keysResult.rows ?? []).map(row => {
            const r = row;
            return {
              INDEX_NAME: r['Key_name'],
              COLUMN_NAME: r['Column_name'],
              SEQ_IN_INDEX: r['Seq_in_index'],
              NON_UNIQUE: r['Non_unique']
            };
          });

          return withTokenEstimate({
            success: true,
            data: {
              collection,
              info: {
                rowCount,
                dataSize,
                indexSize,
                indexes,
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
