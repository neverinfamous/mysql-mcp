import { z } from "zod";
import { preprocessTableParams, preprocessQueryParams, preprocessCreateTableParams } from "./preprocess-utils.js";

// =============================================================================
// Core Tools Schemas
// =============================================================================

// --- ReadQuery ---

// Base schema for MCP visibility (AI sees: query, sql, params, transactionId, txId, tx)
export const ReadQuerySchemaBase = z.object({
  query: z.string().optional().describe("SQL SELECT query to execute"),
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

// Transformed schema for handler parsing (normalizes aliases)
export const ReadQuerySchema = z
  .preprocess(
    preprocessQueryParams,
    z.object({
      query: z.string().optional().describe("SQL SELECT query to execute"),
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
    }),
  )
  .transform((data) => ({
    query: data.query ?? data.sql ?? "",
    params: data.params,
    transactionId: data.transactionId ?? data.txId ?? data.tx,
  }))
  .refine((data) => data.query !== "", {
    message: "query (or sql alias) is required",
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
  .preprocess(
    preprocessQueryParams,
    z.object({
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
    }),
  )
  .transform((data) => ({
    query: data.query ?? data.sql ?? "",
    params: data.params,
    transactionId: data.transactionId ?? data.txId ?? data.tx,
  }))
  .refine((data) => data.query !== "", {
    message: "query (or sql alias) is required",
  });

// --- ListTables ---

export const ListTablesSchema = z.object({
  database: z
    .string()
    .optional()
    .describe("Database name (defaults to connected database)"),
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
    .describe("Column definitions"),
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

// --- CreateIndex ---

// Base schema for MCP visibility
export const CreateIndexSchemaBase = z.object({
  name: z.string().describe("Index name"),
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  columns: z.array(z.string()).describe("Column names to index"),
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
  .preprocess(preprocessTableParams, CreateIndexSchemaBase)
  .transform((data) => ({
    name: data.name,
    table: data.table ?? data.tableName ?? "",
    columns: data.columns,
    unique: data.unique,
    type: data.type,
    ifNotExists: data.ifNotExists,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName alias) is required",
  });

// --- GetIndexes ---

// Base schema for MCP visibility
export const GetIndexesSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
});

// Transformed schema for handler parsing
export const GetIndexesSchema = z
  .preprocess(preprocessTableParams, GetIndexesSchemaBase)
  .transform((data) => ({
    table: data.table ?? data.tableName ?? "",
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName alias) is required",
  });

