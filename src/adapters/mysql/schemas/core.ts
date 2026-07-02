import { z } from "zod";
import { BaseOutputSchema } from "./output-schemas.js";
import {
  preprocessTableParams,
  preprocessQueryParams,
  preprocessCreateTableParams,
  preprocessConditionalUpdateParams,
  preprocessIndexParams,
  preprocessCheckVersionParams,
} from "./preprocess-utils.js";

// =============================================================================
// Core Tools Schemas
// =============================================================================

// --- ReadQuery ---

// Base schema for MCP visibility (AI sees: query, sql, params, transactionId, txId, tx)
export const ReadQuerySchemaBase = z.object({
  query: z.string().optional().describe("SQL SELECT query to execute. Anti-Hallucination Hint: Must be a valid SQL query (e.g. 'SELECT * FROM users'), not just a table name."),
  sql: z.string().optional().describe("Alias for query"),
  params: z
    .array(z.unknown())
    .optional()
    .describe("Query parameters for prepared statement"),
  cursor: z
    .string()
    .optional()
    .describe("Opaque cursor for pagination (use nextCursor from previous response)"),
  transactionId: z
    .string()
    .optional()
    .describe("Optional transaction ID for executing within a transaction"),
  txId: z.string().optional().describe("Alias for transactionId"),
  tx: z.string().optional().describe("Alias for transactionId"),
  stream: z
    .boolean()
    .optional()
    .describe("Stream results via progress notifications instead of returning them all at once (requires client support)"),
  chunkSize: z
    .number()
    .optional()
    .describe("Number of rows per chunk when streaming (default: 10)"),
});

// Transformed schema for handler parsing (normalizes aliases)
export const ReadQuerySchema = z
  .preprocess(preprocessQueryParams, ReadQuerySchemaBase)
  .transform((data) => ({
    query: data.query ?? data.sql ?? "",
    params: data.params,
    cursor: data.cursor,
    transactionId: data.transactionId ?? data.txId ?? data.tx,
    stream: data.stream,
    chunkSize: data.chunkSize,
  }))
  .refine((data) => data.query !== "", {
    message: "query (or sql alias) is required",
  });

export const ReadQueryOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    rows: z.array(z.record(z.string(), z.unknown())).optional(),
    rowCount: z.number(),
    nextCursor: z.string().optional(),
    executionTimeMs: z.number().optional(),
    streamed: z.boolean().optional(),
    chunksEmitted: z.number().optional(),
  }).loose().optional(),
});

// --- WriteQuery ---

// Base schema for MCP visibility
export const WriteQuerySchemaBase = z.object({
  query: z
    .string()
    .optional()
    .describe("SQL INSERT/UPDATE/DELETE query to execute"),
  sql: z.string().optional().describe("Alias for query"),
  params: z
    .array(z.unknown())
    .optional()
    .describe("Query parameters for prepared statement"),
  transactionId: z
    .string()
    .optional()
    .describe("Optional transaction ID for executing within a transaction"),
  txId: z.string().optional().describe("Alias for transactionId"),
  tx: z.string().optional().describe("Alias for transactionId"),
});

// Transformed schema for handler parsing
export const WriteQuerySchema = z
  .preprocess(preprocessQueryParams, WriteQuerySchemaBase)
  .transform((data) => ({
    query: data.query ?? data.sql ?? "",
    params: data.params,
    transactionId: data.transactionId ?? data.txId ?? data.tx,
  }))
  .refine((data) => data.query !== "", {
    message: "query (or sql alias) is required",
  });

export const WriteQueryOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    rowsAffected: z.number().optional(),
    lastInsertId: z.string().optional(),
    executionTimeMs: z.number().optional(),
  }).loose().optional(),
});

// --- ListTables ---

// Base schema for MCP visibility
export const ListTablesSchemaBase = z.object({
  database: z
    .string()
    .optional()
    .describe("Database name (defaults to connected database)"),
  limit: z
    .number()
    .optional()
    .describe("Maximum number of tables to return (default: 50). Anti-Hallucination Hint: To get details for a specific table, use describeTable instead."),
});

// Transformed schema for handler parsing
export const ListTablesSchema = ListTablesSchemaBase
  .transform((data) => ({
    database: data.database,
    limit: data.limit ?? 50,
  }))
  .refine(
    (data) =>
      data.limit === undefined || (!Number.isNaN(data.limit) && data.limit > 0),
    { message: "limit must be a positive number" },
  );

export const ListTablesOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    tables: z.array(z.object({
      name: z.string(),
      type: z.string(),
      engine: z.string().optional(),
      rowCount: z.number().optional(),
      comment: z.string().optional(),
    })),
    count: z.number(),
    truncated: z.boolean().optional(),
  }).loose().optional(),
});

// --- DescribeTable ---

// Base schema for MCP visibility
export const DescribeTableSchemaBase = z.object({
  table: z.string().optional().describe("Table name to describe"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
});

// Transformed schema for handler parsing
export const DescribeTableSchema = z
  .preprocess(preprocessTableParams, DescribeTableSchemaBase)
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  });

export const DescribeTableOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    name: z.string(),
    exists: z.boolean(),
    columns: z.array(z.record(z.string(), z.unknown())).optional(),
    indexes: z.array(z.record(z.string(), z.unknown())).optional(),
    foreignKeys: z.array(z.record(z.string(), z.unknown())).optional(),
    comment: z.string().optional(),
    collation: z.string().optional(),
  }).loose().optional(),
});

// --- CreateTable ---

// Base schema for MCP visibility
export const CreateTableSchemaBase = z.object({
  name: z.string().optional().describe("Table name"),
  table: z.string().optional().describe("Alias for name"),
  tableName: z.string().optional().describe("Alias for name"),
  columns: z
    .array(
      z.object({
        name: z.string().describe("Column name"),
        type: z
          .string()
          .describe("MySQL data type (e.g., INT, VARCHAR(255), JSON)"),
        nullable: z
          .boolean()
          .optional()
          .default(true)
          .describe("Allow NULL values"),
        primaryKey: z.boolean().optional().describe("Is primary key"),
        autoIncrement: z.boolean().optional().describe("Auto-increment column"),
        default: z.unknown().optional().describe("Default value"),
        unique: z.boolean().optional().describe("Unique constraint"),
        comment: z.string().optional().describe("Column comment"),
      }),
    )
    .optional()
    .describe("Column definitions. Anti-Hallucination Hint: Must be an array of objects (e.g. [{name: 'id', type: 'INT'}]), not a key-value object."),
  engine: z
    .enum(["InnoDB", "MyISAM", "MEMORY", "CSV", "ARCHIVE"])
    .optional()
    .default("InnoDB")
    .describe("Storage engine"),
  charset: z.string().optional().default("utf8mb4").describe("Character set"),
  collate: z
    .string()
    .optional()
    .default("utf8mb4_unicode_ci")
    .describe("Collation"),
  comment: z.string().optional().describe("Table comment"),
  ifNotExists: z
    .boolean()
    .optional()
    .default(false)
    .describe("Add IF NOT EXISTS clause"),
});

// Transformed schema for handler parsing
export const CreateTableSchema = z
  .preprocess(preprocessCreateTableParams, CreateTableSchemaBase)
  .transform((data) => ({
    name: data.name ?? data.table ?? data.tableName ?? "",
    columns: data.columns,
    engine: data.engine,
    charset: data.charset,
    collate: data.collate,
    comment: data.comment,
    ifNotExists: data.ifNotExists,
  }))
  .refine((data) => data.name !== "", {
    message: "name (or table/tableName alias) is required",
  })
  .refine((data) => data.columns !== undefined && data.columns.length > 0, {
    message: "columns array is required and must not be empty",
  });

export const CreateTableOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    tableName: z.string(),
    skipped: z.boolean().optional(),
    reason: z.string().optional(),
  }).loose().optional(),
});

// --- DropTable ---

// Base schema for MCP visibility
export const DropTableSchemaBase = z.object({
  table: z.string().optional().describe("Table name to drop"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  ifExists: z
    .boolean()
    .optional()
    .default(false)
    .describe("Add IF EXISTS clause"),
});

// Transformed schema for handler parsing
export const DropTableSchema = z
  .preprocess(preprocessTableParams, DropTableSchemaBase)
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    ifExists: data.ifExists,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  });

export const DropTableOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    tableName: z.string(),
    skipped: z.boolean().optional(),
    reason: z.string().optional(),
  }).loose().optional(),
});

// --- CreateIndex ---

// Base schema for MCP visibility
export const CreateIndexSchemaBase = z.object({
  name: z.string().optional().describe("Index name"),
  indexName: z.string().optional().describe("Alias for name"),
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  columns: z.array(z.string()).optional().describe("Columns to index. Anti-Hallucination Hint: Must be an array of strings (e.g. ['id', 'status']), not a single string or an array of objects."),
  unique: z.boolean().optional().default(false).describe("Create unique index"),
  type: z
    .enum(["BTREE", "HASH", "FULLTEXT", "SPATIAL"])
    .optional()
    .describe("Index type"),
  ifNotExists: z
    .boolean()
    .optional()
    .default(false)
    .describe("Add IF NOT EXISTS clause"),
});

// Transformed schema for handler parsing
export const CreateIndexSchema = z
  .preprocess(preprocessIndexParams, CreateIndexSchemaBase)
  .transform((data) => ({
    name: data.name ?? data.indexName,
    table: data.table ?? data.tableName ?? "",
    columns: data.columns,
    unique: data.unique,
    type: data.type,
    ifNotExists: data.ifNotExists,
  }))
  .refine((data) => data.name !== undefined && data.name !== "", {
    message: "name (or indexName alias) is required",
  })
  .refine((data) => data.table !== "", {
    message: "table (or tableName alias) is required",
  })
  .refine((data) => data.columns !== undefined && data.columns.length > 0, {
    message: "columns array is required and must not be empty",
  });

export const CreateIndexOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    indexName: z.string(),
    skipped: z.boolean().optional(),
    reason: z.string().optional(),
    warning: z.string().optional(),
  }).loose().optional(),
});

// --- GetIndexes ---

// Base schema for MCP visibility
export const GetIndexesSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
});

// Transformed schema for handler parsing
export const GetIndexesSchema = z
  .preprocess(preprocessTableParams, GetIndexesSchemaBase)
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  });

export const GetIndexesOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    exists: z.boolean(),
    indexes: z.array(z.record(z.string(), z.unknown())),
  }).loose().optional(),
});

// --- Versioning (Optimistic Concurrency Control) ---

export const EnableVersioningSchemaBase = z.object({
  table: z.string().optional().describe("Table to enable OCC on"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
});

export const EnableVersioningSchema = z
  .preprocess(preprocessTableParams, EnableVersioningSchemaBase)
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  });

export const EnableVersioningOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    message: z.string(),
    alreadyEnabled: z.boolean().optional(),
  }).loose().optional(),
});

export const DisableVersioningSchemaBase = z.object({
  table: z.string().optional().describe("Table to disable OCC on"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  ifExists: z.boolean().optional().default(false).describe("If true, do not error if table does not exist"),
});

export const DisableVersioningSchema = z
  .preprocess(preprocessTableParams, DisableVersioningSchemaBase)
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    ifExists: data.ifExists,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  });

export const DisableVersioningOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    message: z.string(),
  }).loose().optional(),
});

export const CheckVersionSchemaBase = z.object({
  table: z.string().optional().describe("Table containing the row"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  idColumn: z.string().optional().describe("Primary key column name. Defaults to 'id' if not provided."),
  rowId: z.union([z.string(), z.number()]).optional().describe("Primary key value of the row"),
  id: z.union([z.string(), z.number()]).optional().describe("Alias for rowId"),
});

export const CheckVersionSchema = z
  .preprocess(preprocessCheckVersionParams, CheckVersionSchemaBase)
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    idColumn: data.idColumn,
    rowId: data.rowId ?? data.id,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.rowId !== undefined, {
    message: "rowId (or id alias) is required",
  });

export const CheckVersionOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    version: z.number().optional(),
    row: z.record(z.string(), z.unknown()).optional(),
  }).loose().optional(),
});

export const ConditionalUpdateSchemaBase = z.object({
  table: z.string().optional().describe("Table to update"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  data: z.record(z.string(), z.unknown()).describe("Column-value pairs to update"),
  conditions: z.array(
    z.object({
      column: z.string(),
      operator: z.string().optional(),
      value: z.unknown(),
    })
  ).describe("Conditions identifying the row (e.g. primary key). Anti-Hallucination Hint: Must be an array of objects (e.g. [{column: 'id', value: 1}]), not a string."),
  expectedVersion: z.number().optional().describe("The _version value currently expected. Update fails if this does not match."),
  version: z.number().optional().describe("Alias for expectedVersion"),
});

export const ConditionalUpdateSchema = z
  .preprocess(preprocessConditionalUpdateParams, ConditionalUpdateSchemaBase)
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    data: data.data,
    conditions: data.conditions,
    expectedVersion: data.expectedVersion ?? data.version,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.expectedVersion !== undefined, {
    message: "expectedVersion (or version alias) is required",
  });

export const ConditionalUpdateOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    rowsAffected: z.number().optional(),
    currentVersion: z.number().optional(),
  }).loose().optional(),
});
