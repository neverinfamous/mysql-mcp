/**
 * MySQL Document Store / X DevAPI Tools
 *
 * Tools for working with JSON document collections.
 * 9 tools total.
 */

import { z } from "zod";
import type { MySQLAdapter } from "../MySQLAdapter.js";
import type { ToolDefinition, RequestContext } from "../../../types/index.js";

const IDENTIFIER_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

const ListCollectionsSchema = z.object({
  schema: z.string().optional().describe("Schema name (defaults to current)"),
});

const CreateCollectionSchema = z.object({
  name: z.string().describe("Collection name"),
  schema: z.string().optional(),
  ifNotExists: z.boolean().default(false).describe("Add IF NOT EXISTS clause"),
  validation: z
    .object({
      schema: z
        .record(z.string(), z.unknown())
        .optional()
        .describe("JSON schema"),
      level: z
        .enum(["OFF", "STRICT", "MODERATE"])
        .default("OFF")
        .describe("Validation level"),
    })
    .optional()
    .describe("Validation config"),
});

const DropCollectionSchema = z.object({
  name: z.string(),
  schema: z.string().optional(),
  ifExists: z.boolean().default(true),
});

const FindSchema = z.object({
  collection: z.string(),
  filter: z.string().optional().describe("JSON path expression filter"),
  fields: z.array(z.string()).optional(),
  limit: z.number().default(100),
  offset: z.number().default(0),
});

const AddDocSchema = z.object({
  collection: z.string(),
  documents: z
    .array(z.record(z.string(), z.unknown()))
    .describe("Documents to add"),
});

const ModifyDocSchema = z.object({
  collection: z.string(),
  filter: z
    .string()
    .describe(
      "Filter: JSON path for existence ($.name) OR _id value for specific document",
    ),
  set: z.record(z.string(), z.unknown()).optional().describe("Fields to set"),
  unset: z.array(z.string()).optional(),
});

const RemoveDocSchema = z.object({
  collection: z.string(),
  filter: z
    .string()
    .describe(
      "Filter: JSON path for existence ($.name) OR _id value for specific document",
    ),
});

/**
 * Parse filter string into a WHERE clause.
 * Supports:
 * - JSON path existence: $.name, $.address.city
 * - _id match: direct _id value (32-char hex string)
 * - Field equality: name=Alice, age=30
 */
function parseDocFilter(filter: string): { where: string; params: unknown[] } {
  // Check if it's a direct _id (32-char hex)
  if (/^[a-f0-9]{32}$/i.test(filter)) {
    return { where: "_id = ?", params: [filter] };
  }

  // Check for simple field=value pattern
  const eqMatch = /^([a-zA-Z_][a-zA-Z0-9_]*)=(.+)$/.exec(filter);
  if (eqMatch) {
    const [, field, value] = eqMatch;
    // Try to parse as number
    const numVal = Number(value);
    if (!isNaN(numVal)) {
      return {
        where: `JSON_UNQUOTE(JSON_EXTRACT(doc, '$.${field}')) = ?`,
        params: [String(numVal)],
      };
    }
    return {
      where: `JSON_UNQUOTE(JSON_EXTRACT(doc, '$.${field}')) = ?`,
      params: [value],
    };
  }

  // Default: treat as JSON path existence check
  if (!filter.startsWith("$")) {
    throw new Error(
      `Invalid filter: "${filter}". Use JSON path ($.field), _id value, or field=value format.`,
    );
  }
  return { where: `JSON_EXTRACT(doc, '${filter}') IS NOT NULL`, params: [] };
}

const CreateDocIndexSchema = z.object({
  collection: z.string(),
  name: z.string(),
  fields: z.array(
    z.object({
      path: z.string(),
      type: z
        .enum(["TEXT", "INT", "DOUBLE", "DATE", "DATETIME", "GEOJSON"])
        .default("TEXT"),
      required: z.boolean().default(false),
    }),
  ),
  unique: z.boolean().default(false),
});

const CollectionInfoSchema = z.object({
  collection: z.string(),
  schema: z.string().optional(),
});

/**
 * Check if a collection (table) exists in the specified (or current) database.
 */
async function checkCollectionExists(
  adapter: MySQLAdapter,
  collection: string,
  schema?: string,
): Promise<boolean> {
  const result = await adapter.executeQuery(
    `SELECT 1 FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = COALESCE(?, DATABASE()) AND TABLE_NAME = ?`,
    [schema ?? null, collection],
  );
  return (result.rows?.length ?? 0) > 0;
}

/**
 * Build a backtick-escaped qualified table reference.
 */
function escapeTableRef(name: string, schema?: string): string {
  return schema ? `\`${schema}\`.\`${name}\`` : `\`${name}\``;
}

/**
 * Format a ZodError into a human-readable string.
 */
function formatZodError(err: z.ZodError): string {
  return err.issues.map((i) => i.message).join("; ");
}

export function getDocStoreTools(adapter: MySQLAdapter): ToolDefinition[] {
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
                          SELECT TABLE_NAME FROM information_schema.COLUMNS
                          WHERE COLUMN_NAME = 'doc' AND DATA_TYPE = 'json'
                            AND TABLE_SCHEMA = COALESCE(?, DATABASE())
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
            return { success: false, error: formatZodError(error) };
          }
          const message =
            error instanceof Error ? error.message : String(error);
          return { success: false, error: message };
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
            const alreadyExists = await checkCollectionExists(
              adapter,
              name,
              schema,
            );
            if (alreadyExists) {
              return {
                success: true,
                skipped: true,
                collection: name,
                reason: "Collection already exists",
              };
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
          return { success: true, collection: name };
        } catch (error: unknown) {
          if (error instanceof z.ZodError) {
            return { success: false, error: formatZodError(error) };
          }
          const message =
            error instanceof Error ? error.message : String(error);
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

          // Pre-check existence when ifExists is true so we can report accurately
          if (ifExists) {
            const exists = await checkCollectionExists(adapter, name, schema);
            if (!exists) {
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
          return { success: true, collection: name };
        } catch (error: unknown) {
          if (error instanceof z.ZodError) {
            return { success: false, error: formatZodError(error) };
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
      name: "mysql_doc_find",
      title: "MySQL Find Documents",
      description: "Query documents in a collection.",
      group: "docstore",
      inputSchema: FindSchema,
      requiredScopes: ["read"],
      annotations: { readOnlyHint: true, idempotentHint: true },
      handler: async (params: unknown, _context: RequestContext) => {
        try {
          const { collection, filter, fields, limit, offset } =
            FindSchema.parse(params);
          if (!IDENTIFIER_RE.test(collection))
            return { success: false, error: "Invalid collection name" };

          // Check if collection exists
          const tableCheck = await adapter.executeQuery(
            `SELECT 1 FROM information_schema.TABLES 
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
            [collection],
          );
          if (!tableCheck.rows || tableCheck.rows.length === 0) {
            return {
              exists: false,
              collection,
              documents: [],
              count: 0,
            };
          }

          let selectClause = "doc";
          if (fields && fields.length > 0) {
            selectClause =
              "JSON_OBJECT(" +
              fields
                .map((f) => `'${f}', JSON_EXTRACT(doc, '$.${f}')`)
                .join(", ") +
              ") as doc";
          }

          let query = `SELECT ${selectClause} FROM \`${collection}\``;
          if (filter)
            query += ` WHERE JSON_EXTRACT(doc, '${filter}') IS NOT NULL`;
          query += ` LIMIT ${String(limit)} OFFSET ${String(offset)}`;

          const result = await adapter.executeQuery(query);
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
            return { success: false, error: formatZodError(error) };
          }
          const message =
            error instanceof Error ? error.message : String(error);
          return { success: false, error: message };
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
          const { collection, documents } = AddDocSchema.parse(params);
          if (!IDENTIFIER_RE.test(collection))
            return { success: false, error: "Invalid collection name" };

          if (!(await checkCollectionExists(adapter, collection))) {
            return { exists: false, collection };
          }

          let inserted = 0;
          for (const doc of documents) {
            doc["_id"] ??= crypto.randomUUID().replace(/-/g, "");
            await adapter.executeQuery(
              `INSERT INTO \`${collection}\` (doc) VALUES (?)`,
              [JSON.stringify(doc)],
            );
            inserted++;
          }
          return { success: true, inserted };
        } catch (error: unknown) {
          if (error instanceof z.ZodError) {
            return { success: false, error: formatZodError(error) };
          }
          const message =
            error instanceof Error ? error.message : String(error);
          return { success: false, error: message };
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
          const { collection, filter, set, unset } =
            ModifyDocSchema.parse(params);
          if (!IDENTIFIER_RE.test(collection))
            return { success: false, error: "Invalid collection name" };

          if (!(await checkCollectionExists(adapter, collection))) {
            return { exists: false, collection };
          }

          const updates: string[] = [];
          if (set) {
            for (const [path, value] of Object.entries(set)) {
              updates.push(
                `doc = JSON_SET(doc, '$.${path}', CAST('${JSON.stringify(value)}' AS JSON))`,
              );
            }
          }
          if (unset) {
            for (const path of unset) {
              updates.push(`doc = JSON_REMOVE(doc, '$.${path}')`);
            }
          }

          if (updates.length === 0)
            return { success: false, error: "No modifications specified" };

          const { where, params: whereParams } = parseDocFilter(filter);
          const query = `UPDATE \`${collection}\` SET ${updates.join(", ")} WHERE ${where}`;
          const result = await adapter.executeQuery(query, whereParams);
          return { success: true, modified: result.rowsAffected ?? 0 };
        } catch (error: unknown) {
          if (error instanceof z.ZodError) {
            return { success: false, error: formatZodError(error) };
          }
          const message =
            error instanceof Error ? error.message : String(error);
          return { success: false, error: message };
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
          const { collection, filter } = RemoveDocSchema.parse(params);
          if (!IDENTIFIER_RE.test(collection))
            return { success: false, error: "Invalid collection name" };

          if (!(await checkCollectionExists(adapter, collection))) {
            return { exists: false, collection };
          }

          const { where, params: whereParams } = parseDocFilter(filter);
          const query = `DELETE FROM \`${collection}\` WHERE ${where}`;
          const result = await adapter.executeQuery(query, whereParams);
          return { success: true, removed: result.rowsAffected ?? 0 };
        } catch (error: unknown) {
          if (error instanceof z.ZodError) {
            return { success: false, error: formatZodError(error) };
          }
          const message =
            error instanceof Error ? error.message : String(error);
          return { success: false, error: message };
        }
      },
    },
    {
      name: "mysql_doc_create_index",
      title: "MySQL Create Doc Index",
      description: "Create an index on document fields.",
      group: "docstore",
      inputSchema: CreateDocIndexSchema,
      requiredScopes: ["write"],
      annotations: { readOnlyHint: false },
      handler: async (params: unknown, _context: RequestContext) => {
        try {
          const { collection, name, fields, unique } =
            CreateDocIndexSchema.parse(params);
          if (!IDENTIFIER_RE.test(collection))
            return { success: false, error: "Invalid collection name" };
          if (!IDENTIFIER_RE.test(name))
            return { success: false, error: "Invalid index name" };

          if (!(await checkCollectionExists(adapter, collection))) {
            return { exists: false, collection };
          }

          for (const field of fields) {
            const colName = `_idx_${field.path.replace(/\./g, "_")}`;
            const cast = field.type === "TEXT" ? "CHAR(255)" : field.type;
            await adapter.executeQuery(
              `ALTER TABLE \`${collection}\` ADD COLUMN \`${colName}\` ${cast} 
                           GENERATED ALWAYS AS (JSON_UNQUOTE(JSON_EXTRACT(doc, '$.${field.path}'))) STORED`,
            );
          }

          const cols = fields
            .map((f) => `\`_idx_${f.path.replace(/\./g, "_")}\``)
            .join(", ");
          const uniqueClause = unique ? "UNIQUE " : "";
          await adapter.executeQuery(
            `CREATE ${uniqueClause}INDEX \`${name}\` ON \`${collection}\` (${cols})`,
          );

          return { success: true, index: name };
        } catch (error: unknown) {
          if (error instanceof z.ZodError) {
            return { success: false, error: formatZodError(error) };
          }
          const message =
            error instanceof Error ? error.message : String(error);
          if (
            message.toLowerCase().includes("duplicate column") ||
            message.toLowerCase().includes("duplicate key")
          ) {
            return {
              success: false,
              error: `Index '${(params as { name?: string })?.name ?? "unknown"}' or its generated columns already exist on '${(params as { collection?: string })?.collection ?? "unknown"}'`,
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

          // Pre-check schema existence when explicitly provided
          if (schema) {
            const schemaCheck = await adapter.executeQuery(
              "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?",
              [schema],
            );
            if (!schemaCheck.rows || schemaCheck.rows.length === 0) {
              return { exists: false, schema };
            }
          }

          // Check if collection exists
          const existsCheck = await adapter.executeQuery(
            `SELECT 1 FROM information_schema.TABLES
           WHERE TABLE_SCHEMA = COALESCE(?, DATABASE()) AND TABLE_NAME = ?`,
            [schema ?? null, collection],
          );
          if (!existsCheck.rows || existsCheck.rows.length === 0) {
            return { exists: false, collection };
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
            return { success: false, error: formatZodError(error) };
          }
          const message =
            error instanceof Error ? error.message : String(error);
          return { success: false, error: message };
        }
      },
    },
  ];
}
