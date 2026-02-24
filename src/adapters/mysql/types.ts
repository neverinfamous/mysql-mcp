/**
 * MySQL Adapter - Zod Schemas
 *
 * Input validation schemas for all MySQL tools.
 *
 * DUAL-SCHEMA PATTERN (Split Schema):
 * Base schemas (SchemaBase) are exported for MCP inputSchema visibility.
 * Transformed schemas (Schema) are exported for handler parsing with alias resolution.
 * This ensures MCP clients see all parameter names (including aliases) while
 * handlers receive normalized data with canonical parameter names.
 */

import { z } from "zod";

// =============================================================================
// Preprocess Utilities
// =============================================================================

/**
 * Convert undefined input to empty object for optional-param tools.
 * Used with z.preprocess() to handle tools called with no arguments.
 */
function defaultToEmpty(input: unknown): unknown {
  return input ?? {};
}

/**
 * Preprocess table parameters:
 * - Alias: tableName/name → table
 */
function preprocessTableParams(input: unknown): unknown {
  if (typeof input !== "object" || input === null) return input;
  const result = { ...(input as Record<string, unknown>) };
  if (result["table"] === undefined) {
    if (result["tableName"] !== undefined)
      result["table"] = result["tableName"];
    else if (result["name"] !== undefined) result["table"] = result["name"];
  }
  return result;
}

/**
 * Preprocess query parameters:
 * - Alias: sql → query
 * - Alias: tx/txId → transactionId
 */
function preprocessQueryParams(input: unknown): unknown {
  if (typeof input !== "object" || input === null) return input;
  const result = { ...(input as Record<string, unknown>) };
  if (result["query"] === undefined && result["sql"] !== undefined) {
    result["query"] = result["sql"];
  }
  if (result["transactionId"] === undefined) {
    if (result["txId"] !== undefined) result["transactionId"] = result["txId"];
    else if (result["tx"] !== undefined) result["transactionId"] = result["tx"];
  }
  return result;
}

/**
 * Preprocess transaction ID parameters:
 * - Alias: tx/txId → transactionId
 */
function preprocessTransactionIdParams(input: unknown): unknown {
  const normalized = defaultToEmpty(input) as Record<string, unknown>;
  if (normalized["transactionId"] === undefined) {
    if (normalized["txId"] !== undefined)
      normalized["transactionId"] = normalized["txId"];
    else if (normalized["tx"] !== undefined)
      normalized["transactionId"] = normalized["tx"];
  }
  return normalized;
}

/**
 * Preprocess savepoint parameters:
 * - Alias: tx/txId → transactionId
 * - Alias: name → savepoint
 */
function preprocessSavepointParams(input: unknown): unknown {
  if (typeof input !== "object" || input === null) return input;
  const result = { ...(input as Record<string, unknown>) };
  if (result["transactionId"] === undefined) {
    if (result["txId"] !== undefined) result["transactionId"] = result["txId"];
    else if (result["tx"] !== undefined) result["transactionId"] = result["tx"];
  }
  if (result["savepoint"] === undefined && result["name"] !== undefined) {
    result["savepoint"] = result["name"];
  }
  return result;
}

/**
 * Preprocess create table parameters:
 * - Alias: table/tableName → name
 */
function preprocessCreateTableParams(input: unknown): unknown {
  if (typeof input !== "object" || input === null) return input;
  const result = { ...(input as Record<string, unknown>) };
  if (result["name"] === undefined) {
    if (result["table"] !== undefined) result["name"] = result["table"];
    else if (result["tableName"] !== undefined)
      result["name"] = result["tableName"];
  }
  return result;
}

/**
 * Preprocess transaction execute parameters:
 * - Alias: queries/sqls → statements
 */
function preprocessTransactionExecuteParams(input: unknown): unknown {
  if (typeof input !== "object" || input === null) return input;
  const result = { ...(input as Record<string, unknown>) };
  if (result["statements"] === undefined) {
    if (result["queries"] !== undefined)
      result["statements"] = result["queries"];
    else if (result["sqls"] !== undefined)
      result["statements"] = result["sqls"];
  }
  return result;
}

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
    .default(true)
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

// =============================================================================
// Transaction Schemas
// =============================================================================

// --- TransactionBegin ---

export const TransactionBeginSchema = z.preprocess(
  defaultToEmpty,
  z.object({
    isolationLevel: z
      .enum([
        "READ UNCOMMITTED",
        "READ COMMITTED",
        "REPEATABLE READ",
        "SERIALIZABLE",
      ])
      .optional()
      .describe("Transaction isolation level"),
  }),
);

// --- TransactionId ---

// Base schema for MCP visibility
export const TransactionIdSchemaBase = z.object({
  transactionId: z
    .string()
    .optional()
    .describe("Transaction ID from begin operation"),
  txId: z.string().optional().describe("Alias for transactionId"),
  tx: z.string().optional().describe("Alias for transactionId"),
});

// Transformed schema for handler parsing
export const TransactionIdSchema = z
  .preprocess(preprocessTransactionIdParams, TransactionIdSchemaBase)
  .transform((data) => ({
    transactionId: data.transactionId ?? data.txId ?? data.tx ?? "",
  }))
  .refine((data) => data.transactionId !== "", {
    message:
      "transactionId (or txId/tx alias) is required. Get one from mysql_transaction_begin first.",
  });

// --- TransactionSavepoint ---

// Base schema for MCP visibility
export const TransactionSavepointSchemaBase = z.object({
  transactionId: z.string().optional().describe("Transaction ID"),
  txId: z.string().optional().describe("Alias for transactionId"),
  tx: z.string().optional().describe("Alias for transactionId"),
  savepoint: z.string().optional().describe("Savepoint name"),
  name: z.string().optional().describe("Alias for savepoint"),
});

// Transformed schema for handler parsing
export const TransactionSavepointSchema = z
  .preprocess(preprocessSavepointParams, TransactionSavepointSchemaBase)
  .transform((data) => ({
    transactionId: data.transactionId ?? data.txId ?? data.tx ?? "",
    savepoint: data.savepoint ?? data.name ?? "",
  }))
  .refine((data) => data.transactionId !== "" && data.savepoint !== "", {
    message:
      'Both transactionId and savepoint are required. Example: {transactionId: "...", savepoint: "sp1"}',
  });

// --- TransactionExecute ---

// Base schema for MCP visibility
export const TransactionExecuteSchemaBase = z.object({
  statements: z
    .array(z.string())
    .optional()
    .describe("SQL statements to execute atomically"),
  queries: z.array(z.string()).optional().describe("Alias for statements"),
  isolationLevel: z
    .enum([
      "READ UNCOMMITTED",
      "READ COMMITTED",
      "REPEATABLE READ",
      "SERIALIZABLE",
    ])
    .optional()
    .describe("Transaction isolation level"),
});

// Transformed schema for handler parsing
export const TransactionExecuteSchema = z
  .preprocess(preprocessTransactionExecuteParams, TransactionExecuteSchemaBase)
  .transform((data) => ({
    statements: data.statements ?? data.queries ?? [],
    isolationLevel: data.isolationLevel,
  }));

// =============================================================================
// Preprocess: JSON/Text column params (table, column, where aliases)
// =============================================================================

function preprocessJsonColumnParams(val: unknown): unknown {
  if (val == null || typeof val !== "object") return val ?? {};
  const v = val as Record<string, unknown>;
  return {
    ...v,
    table: v["table"] ?? v["tableName"] ?? v["name"],
    column: v["column"] ?? v["col"],
    where: v["where"] ?? v["filter"],
  };
}

export function preprocessQueryOnlyParams(val: unknown): unknown {
  if (val == null || typeof val !== "object") return val ?? {};
  const v = val as Record<string, unknown>;
  return {
    ...v,
    query: v["query"] ?? v["sql"],
  };
}

// =============================================================================
// JSON Schemas
// =============================================================================

// --- JsonExtract ---
export const JsonExtractSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("JSON column name"),
  col: z.string().optional().describe("Alias for column"),
  path: z.string().describe("JSON path (e.g., $.name or $[0])"),
  where: z.string().optional().describe("WHERE clause for filtering rows"),
  filter: z.string().optional().describe("Alias for where"),
});

export const JsonExtractSchema = z
  .preprocess(
    preprocessJsonColumnParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      column: z.string().optional(),
      col: z.string().optional(),
      path: z.string(),
      where: z.string().optional(),
      filter: z.string().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column ?? data.col ?? "",
    path: data.path,
    where: data.where ?? data.filter,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or col alias) is required",
  });

// --- JsonSet ---
export const JsonSetSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("JSON column name"),
  col: z.string().optional().describe("Alias for column"),
  path: z.string().describe("JSON path to set"),
  value: z.unknown().describe("Value to set"),
  where: z.string().optional().describe("WHERE clause to identify rows"),
  filter: z.string().optional().describe("Alias for where"),
});

export const JsonSetSchema = z
  .preprocess(
    preprocessJsonColumnParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      column: z.string().optional(),
      col: z.string().optional(),
      path: z.string(),
      value: z.unknown(),
      where: z.string().optional(),
      filter: z.string().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column ?? data.col ?? "",
    path: data.path,
    value: data.value,
    where: data.where ?? data.filter ?? "",
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or col alias) is required",
  })
  .refine((data) => data.where !== "", {
    message: "where (or filter alias) is required",
  });

// --- JsonContains ---
export const JsonContainsSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("JSON column name"),
  col: z.string().optional().describe("Alias for column"),
  value: z.unknown().describe("Value to search for"),
  path: z.string().optional().describe("Optional JSON path to search within"),
});

export const JsonContainsSchema = z
  .preprocess(
    preprocessJsonColumnParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      column: z.string().optional(),
      col: z.string().optional(),
      value: z.unknown(),
      path: z.string().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column ?? data.col ?? "",
    value: data.value,
    path: data.path,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or col alias) is required",
  });

// --- JsonKeys ---
export const JsonKeysSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("JSON column name"),
  col: z.string().optional().describe("Alias for column"),
  path: z.string().optional().describe("Optional JSON path (defaults to root)"),
});

export const JsonKeysSchema = z
  .preprocess(
    preprocessJsonColumnParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      column: z.string().optional(),
      col: z.string().optional(),
      path: z.string().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column ?? data.col ?? "",
    path: data.path,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or col alias) is required",
  });

// --- JsonSearch ---
export const JsonSearchSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("JSON column name"),
  col: z.string().optional().describe("Alias for column"),
  searchValue: z.string().describe("String value to search for"),
  mode: z
    .enum(["one", "all"])
    .optional()
    .default("one")
    .describe("Search mode"),
});

export const JsonSearchSchema = z
  .preprocess(
    preprocessJsonColumnParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      column: z.string().optional(),
      col: z.string().optional(),
      searchValue: z.string(),
      mode: z.enum(["one", "all"]).optional().default("one"),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column ?? data.col ?? "",
    searchValue: data.searchValue,
    mode: data.mode,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or col alias) is required",
  });

// --- JsonInsert ---
export const JsonInsertSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("JSON column name"),
  col: z.string().optional().describe("Alias for column"),
  path: z.string().describe("JSON path to insert at"),
  value: z.unknown().describe("Value to insert"),
  where: z.string().optional().describe("WHERE clause to identify rows"),
  filter: z.string().optional().describe("Alias for where"),
});

export const JsonInsertSchema = z
  .preprocess(
    preprocessJsonColumnParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      column: z.string().optional(),
      col: z.string().optional(),
      path: z.string(),
      value: z.unknown(),
      where: z.string().optional(),
      filter: z.string().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column ?? data.col ?? "",
    path: data.path,
    value: data.value,
    where: data.where ?? data.filter ?? "",
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or col alias) is required",
  })
  .refine((data) => data.where !== "", {
    message: "where (or filter alias) is required",
  });

// --- JsonReplace ---
export const JsonReplaceSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("JSON column name"),
  col: z.string().optional().describe("Alias for column"),
  path: z.string().describe("JSON path to replace"),
  value: z.unknown().describe("Replacement value"),
  where: z.string().optional().describe("WHERE clause to identify rows"),
  filter: z.string().optional().describe("Alias for where"),
});

export const JsonReplaceSchema = z
  .preprocess(
    preprocessJsonColumnParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      column: z.string().optional(),
      col: z.string().optional(),
      path: z.string(),
      value: z.unknown(),
      where: z.string().optional(),
      filter: z.string().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column ?? data.col ?? "",
    path: data.path,
    value: data.value,
    where: data.where ?? data.filter ?? "",
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or col alias) is required",
  })
  .refine((data) => data.where !== "", {
    message: "where (or filter alias) is required",
  });

// --- JsonRemove ---
export const JsonRemoveSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("JSON column name"),
  col: z.string().optional().describe("Alias for column"),
  paths: z.array(z.string()).describe("JSON paths to remove"),
  where: z.string().optional().describe("WHERE clause to identify rows"),
  filter: z.string().optional().describe("Alias for where"),
});

export const JsonRemoveSchema = z
  .preprocess(
    preprocessJsonColumnParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      column: z.string().optional(),
      col: z.string().optional(),
      paths: z.array(z.string()),
      where: z.string().optional(),
      filter: z.string().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column ?? data.col ?? "",
    paths: data.paths,
    where: data.where ?? data.filter ?? "",
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or col alias) is required",
  })
  .refine((data) => data.where !== "", {
    message: "where (or filter alias) is required",
  });

// --- JsonArrayAppend ---
export const JsonArrayAppendSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("JSON column name"),
  col: z.string().optional().describe("Alias for column"),
  path: z.string().describe("JSON path to array"),
  value: z.unknown().describe("Value to append"),
  where: z.string().optional().describe("WHERE clause to identify rows"),
  filter: z.string().optional().describe("Alias for where"),
});

export const JsonArrayAppendSchema = z
  .preprocess(
    preprocessJsonColumnParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      column: z.string().optional(),
      col: z.string().optional(),
      path: z.string(),
      value: z.unknown(),
      where: z.string().optional(),
      filter: z.string().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column ?? data.col ?? "",
    path: data.path,
    value: data.value,
    where: data.where ?? data.filter ?? "",
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or col alias) is required",
  })
  .refine((data) => data.where !== "", {
    message: "where (or filter alias) is required",
  });

// --- JsonGet ---
export const JsonGetSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("JSON column name"),
  col: z.string().optional().describe("Alias for column"),
  path: z.string().describe("JSON path to extract"),
  id: z.union([z.string(), z.number()]).describe("Row ID"),
  idColumn: z.string().default("id").describe("ID column name"),
});

export const JsonGetSchema = z
  .preprocess(
    preprocessJsonColumnParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      column: z.string().optional(),
      col: z.string().optional(),
      path: z.string(),
      id: z.union([z.string(), z.number()]),
      idColumn: z.string().default("id"),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column ?? data.col ?? "",
    path: data.path,
    id: data.id,
    idColumn: data.idColumn,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or col alias) is required",
  });

// --- JsonUpdate ---
export const JsonUpdateSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("JSON column name"),
  col: z.string().optional().describe("Alias for column"),
  path: z.string().describe("JSON path to update"),
  value: z.unknown().describe("New value"),
  id: z.union([z.string(), z.number()]).describe("Row ID"),
  idColumn: z.string().default("id").describe("ID column name"),
});

export const JsonUpdateSchema = z
  .preprocess(
    preprocessJsonColumnParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      column: z.string().optional(),
      col: z.string().optional(),
      path: z.string(),
      value: z.unknown(),
      id: z.union([z.string(), z.number()]),
      idColumn: z.string().default("id"),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column ?? data.col ?? "",
    path: data.path,
    value: data.value,
    id: data.id,
    idColumn: data.idColumn,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or col alias) is required",
  });

// --- JsonNormalize ---
export const JsonNormalizeSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("JSON column name"),
  col: z.string().optional().describe("Alias for column"),
  where: z.string().optional().describe("WHERE clause"),
  filter: z.string().optional().describe("Alias for where"),
  limit: z.number().default(100).describe("Maximum rows to process"),
});

export const JsonNormalizeSchema = z
  .preprocess(
    preprocessJsonColumnParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      column: z.string().optional(),
      col: z.string().optional(),
      where: z.string().optional(),
      filter: z.string().optional(),
      limit: z.number().default(100),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column ?? data.col ?? "",
    where: data.where ?? data.filter,
    limit: data.limit,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or col alias) is required",
  });

// --- JsonStats ---
export const JsonStatsSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("JSON column name"),
  col: z.string().optional().describe("Alias for column"),
  where: z.string().optional().describe("Optional WHERE clause"),
  filter: z.string().optional().describe("Alias for where"),
  sampleSize: z.number().default(1000).describe("Sample size for statistics"),
});

export const JsonStatsSchema = z
  .preprocess(
    preprocessJsonColumnParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      column: z.string().optional(),
      col: z.string().optional(),
      where: z.string().optional(),
      filter: z.string().optional(),
      sampleSize: z.number().default(1000),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column ?? data.col ?? "",
    where: data.where ?? data.filter,
    sampleSize: data.sampleSize,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or col alias) is required",
  });

// --- JsonIndexSuggest ---
export const JsonIndexSuggestSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("JSON column name"),
  col: z.string().optional().describe("Alias for column"),
  sampleSize: z.number().default(100).describe("Sample size to analyze"),
});

export const JsonIndexSuggestSchema = z
  .preprocess(
    preprocessJsonColumnParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      column: z.string().optional(),
      col: z.string().optional(),
      sampleSize: z.number().default(100),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column ?? data.col ?? "",
    sampleSize: data.sampleSize,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or col alias) is required",
  });

// --- JsonValidate (no table/column — no aliases needed) ---
export const JsonValidateSchema = z.object({
  value: z.string().describe("JSON string to validate"),
});

// =============================================================================
// Text Schemas
// =============================================================================

// --- RegexpMatch ---
export const RegexpMatchSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("Column name"),
  col: z.string().optional().describe("Alias for column"),
  pattern: z.string().describe("Regular expression pattern"),
  where: z
    .string()
    .optional()
    .describe("Additional WHERE clause for filtering"),
  filter: z.string().optional().describe("Alias for where"),
});

export const RegexpMatchSchema = z
  .preprocess(
    preprocessJsonColumnParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      column: z.string().optional(),
      col: z.string().optional(),
      pattern: z.string(),
      where: z.string().optional(),
      filter: z.string().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column ?? data.col ?? "",
    pattern: data.pattern,
    where: data.where ?? data.filter,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or col alias) is required",
  });

// --- LikeSearch ---
export const LikeSearchSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("Column name"),
  col: z.string().optional().describe("Alias for column"),
  pattern: z.string().describe("LIKE pattern with % and _ wildcards"),
  where: z
    .string()
    .optional()
    .describe("Additional WHERE clause for filtering"),
  filter: z.string().optional().describe("Alias for where"),
});

export const LikeSearchSchema = z
  .preprocess(
    preprocessJsonColumnParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      column: z.string().optional(),
      col: z.string().optional(),
      pattern: z.string(),
      where: z.string().optional(),
      filter: z.string().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column ?? data.col ?? "",
    pattern: data.pattern,
    where: data.where ?? data.filter,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or col alias) is required",
  });

// --- Soundex ---
export const SoundexSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("Column name"),
  col: z.string().optional().describe("Alias for column"),
  value: z.string().describe("Value to match phonetically"),
  where: z
    .string()
    .optional()
    .describe("Additional WHERE clause for filtering"),
  filter: z.string().optional().describe("Alias for where"),
});

export const SoundexSchema = z
  .preprocess(
    preprocessJsonColumnParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      column: z.string().optional(),
      col: z.string().optional(),
      value: z.string(),
      where: z.string().optional(),
      filter: z.string().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column ?? data.col ?? "",
    value: data.value,
    where: data.where ?? data.filter,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or col alias) is required",
  });

// --- Substring ---
export const SubstringSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z.string().describe("Column name"),
  start: z.number().describe("Starting position (1-indexed)"),
  length: z.number().optional().describe("Number of characters"),
  where: z
    .string()
    .optional()
    .describe("Additional WHERE clause for filtering"),
  filter: z.string().optional().describe("Alias for where"),
});

export const SubstringSchema = z
  .preprocess(
    preprocessJsonColumnParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      column: z.string(),
      start: z.number(),
      length: z.number().optional(),
      where: z.string().optional(),
      filter: z.string().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column,
    start: data.start,
    length: data.length,
    where: data.where ?? data.filter,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  });

// --- Concat ---
export const ConcatSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  columns: z.array(z.string()).describe("Columns to concatenate"),
  separator: z
    .string()
    .optional()
    .default(" ")
    .describe("Separator between values"),
  alias: z
    .string()
    .optional()
    .default("concatenated")
    .describe("Result column name"),
  where: z
    .string()
    .optional()
    .describe("Additional WHERE clause for filtering"),
  filter: z.string().optional().describe("Alias for where"),
  includeSourceColumns: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      "Include individual source columns in output (default: true). Set to false for minimal payload.",
    ),
});

export const ConcatSchema = z
  .preprocess(
    preprocessJsonColumnParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      columns: z.array(z.string()),
      separator: z.string().optional().default(" "),
      alias: z.string().optional().default("concatenated"),
      where: z.string().optional(),
      filter: z.string().optional(),
      includeSourceColumns: z.boolean().optional().default(true),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    columns: data.columns,
    separator: data.separator,
    alias: data.alias,
    where: data.where ?? data.filter,
    includeSourceColumns: data.includeSourceColumns,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  });

// --- CollationConvert ---
export const CollationConvertSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("Column name"),
  col: z.string().optional().describe("Alias for column"),
  charset: z.string().describe("Target character set (e.g., utf8mb4)"),
  collation: z.string().optional().describe("Target collation"),
  where: z
    .string()
    .optional()
    .describe("Additional WHERE clause for filtering"),
  filter: z.string().optional().describe("Alias for where"),
});

export const CollationConvertSchema = z
  .preprocess(
    preprocessJsonColumnParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      column: z.string().optional(),
      col: z.string().optional(),
      charset: z.string(),
      collation: z.string().optional(),
      where: z.string().optional(),
      filter: z.string().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column ?? data.col ?? "",
    charset: data.charset,
    collation: data.collation,
    where: data.where ?? data.filter,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or col alias) is required",
  });

// --- FulltextCreate ---
export const FulltextCreateSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  columns: z
    .array(z.string())
    .optional()
    .describe("Columns to include in index"),
  indexName: z.string().optional().describe("Optional index name"),
});

export const FulltextCreateSchema = z
  .preprocess(
    preprocessTableParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      columns: z.array(z.string()).optional(),
      indexName: z.string().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    columns: data.columns ?? [],
    indexName: data.indexName,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.columns.length > 0, {
    message: "columns is required",
  });

// --- FulltextSearch ---
export const FulltextSearchSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  columns: z.array(z.string()).optional().describe("Columns to search"),
  query: z.string().optional().describe("Search query"),
  sql: z.string().optional().describe("Alias for query"),
  mode: z
    .enum(["NATURAL", "BOOLEAN", "EXPANSION"])
    .optional()
    .default("NATURAL")
    .describe("Search mode"),
});

export const FulltextSearchSchema = z
  .preprocess(
    (val) => {
      const v1 = preprocessTableParams(val);
      return preprocessQueryOnlyParams(v1);
    },
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      columns: z.array(z.string()).optional(),
      query: z.string().optional(),
      sql: z.string().optional(),
      mode: z
        .enum(["NATURAL", "BOOLEAN", "EXPANSION"])
        .optional()
        .default("NATURAL"),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    columns: data.columns ?? [],
    query: data.query ?? data.sql ?? "",
    mode: data.mode,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.columns.length > 0, { message: "columns is required" })
  .refine((data) => data.query !== "", {
    message: "query (or sql alias) is required",
  });

// --- FulltextDrop ---
export const FulltextDropSchemaBase = z.object({
  table: z.string().optional().describe("Table containing the index"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  indexName: z
    .string()
    .optional()
    .describe("Name of the FULLTEXT index to drop"),
});

export const FulltextDropSchema = z
  .preprocess(
    preprocessTableParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      indexName: z.string().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    indexName: data.indexName ?? "",
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.indexName !== "", {
    message: "indexName is required",
  });

// --- FulltextBoolean ---
export const FulltextBooleanSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  columns: z.array(z.string()).optional().describe("Columns to search"),
  query: z
    .string()
    .optional()
    .describe("Boolean search query with +, -, *, etc."),
  maxLength: z
    .number()
    .optional()
    .describe(
      "Optional max characters per text column in results. Truncates with '...' if exceeded.",
    ),
});

export const FulltextBooleanSchema = z
  .preprocess(
    preprocessTableParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      columns: z.array(z.string()).optional(),
      query: z.string().optional(),
      maxLength: z.number().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    columns: data.columns ?? [],
    query: data.query ?? "",
    maxLength: data.maxLength,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.columns.length > 0, { message: "columns is required" })
  .refine((data) => data.query !== "", { message: "query is required" });

// --- FulltextExpand ---
export const FulltextExpandSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  columns: z.array(z.string()).optional().describe("Columns to search"),
  query: z.string().optional().describe("Search query to expand"),
  maxLength: z
    .number()
    .optional()
    .describe(
      "Optional max characters per text column in results. Truncates with '...' if exceeded.",
    ),
});

export const FulltextExpandSchema = z
  .preprocess(
    preprocessTableParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      columns: z.array(z.string()).optional(),
      query: z.string().optional(),
      maxLength: z.number().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    columns: data.columns ?? [],
    query: data.query ?? "",
    maxLength: data.maxLength,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.columns.length > 0, { message: "columns is required" })
  .refine((data) => data.query !== "", { message: "query is required" });

// =============================================================================
// Performance Schemas
// =============================================================================

// --- Explain ---
export const ExplainSchemaBase = z.object({
  query: z.string().optional().describe("SQL query to explain"),
  sql: z.string().optional().describe("Alias for query"),
  format: z
    .enum(["TRADITIONAL", "JSON", "TREE"])
    .optional()
    .default("JSON")
    .describe("Output format"),
});

export const ExplainSchema = z
  .preprocess(
    preprocessQueryOnlyParams,
    z.object({
      query: z.string().optional(),
      sql: z.string().optional(),
      format: z
        .enum(["TRADITIONAL", "JSON", "TREE"])
        .optional()
        .default("JSON"),
    }),
  )
  .transform((data) => ({
    query: data.query ?? data.sql ?? "",
    format: data.format,
  }))
  .refine((data) => data.query !== "", {
    message: "query (or sql alias) is required",
  });

// --- ExplainAnalyze ---
export const ExplainAnalyzeSchemaBase = z.object({
  query: z.string().optional().describe("SQL query to analyze"),
  sql: z.string().optional().describe("Alias for query"),
  format: z
    .enum(["JSON", "TREE"])
    .optional()
    .default("TREE")
    .describe("Output format"),
});

export const ExplainAnalyzeSchema = z
  .preprocess(
    preprocessQueryOnlyParams,
    z.object({
      query: z.string().optional(),
      sql: z.string().optional(),
      format: z.enum(["JSON", "TREE"]).optional().default("TREE"),
    }),
  )
  .transform((data) => ({
    query: data.query ?? data.sql ?? "",
    format: data.format,
  }))
  .refine((data) => data.query !== "", {
    message: "query (or sql alias) is required",
  });

// --- SlowQuery (no table/query aliases — simple passthrough) ---
export const SlowQuerySchema = z.object({
  limit: z
    .number()
    .optional()
    .default(10)
    .describe("Number of slow queries to return"),
  minTime: z.number().optional().describe("Minimum query time in seconds"),
});

// --- QueryStats (no table/query aliases — simple passthrough) ---
export const QueryStatsSchema = z.object({
  orderBy: z
    .enum(["total_time", "avg_time", "executions"])
    .optional()
    .default("total_time")
    .describe("Order results by metric"),
  limit: z
    .number()
    .optional()
    .default(10)
    .describe("Maximum number of queries to return"),
});

// --- IndexUsage ---
export const IndexUsageSchemaBase = z.object({
  table: z.string().optional().describe("Filter by table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  limit: z
    .number()
    .int()
    .positive()
    .optional()
    .default(10)
    .describe("Maximum number of indexes to return"),
});

export const IndexUsageSchema = z
  .preprocess(
    preprocessTableParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      limit: z.number().int().positive().optional().default(10),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name,
    limit: data.limit,
  }));

// --- TableStats ---
export const TableStatsSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
});

export const TableStatsSchema = z
  .preprocess(
    preprocessTableParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  });

// =============================================================================
// Preprocess: Admin table params (normalizes singular 'table' to 'tables' array)
// =============================================================================

function preprocessAdminTableParams(val: unknown): unknown {
  if (val == null || typeof val !== "object") return val ?? {};
  const v = val as Record<string, unknown>;
  // If 'table' is passed as a string and 'tables' is not set, wrap it into an array
  if (typeof v["table"] === "string" && !Array.isArray(v["tables"])) {
    return { ...v, tables: [v["table"]] };
  }
  // Also support tableName/name aliases → tables
  if (typeof v["tableName"] === "string" && !Array.isArray(v["tables"])) {
    return { ...v, tables: [v["tableName"]] };
  }
  if (typeof v["name"] === "string" && !Array.isArray(v["tables"])) {
    return { ...v, tables: [v["name"]] };
  }
  return v;
}

// =============================================================================
// Admin Schemas
// =============================================================================

// --- OptimizeTable ---
export const OptimizeTableSchemaBase = z.object({
  tables: z.array(z.string()).optional().describe("Table names to optimize"),
  table: z.string().optional().describe("Single table name (alias for tables)"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
});

export const OptimizeTableSchema = z
  .preprocess(
    preprocessAdminTableParams,
    z.object({
      tables: z.array(z.string()).optional(),
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
    }),
  )
  .transform((data) => ({
    tables: data.tables ?? [],
  }))
  .refine((data) => data.tables.length > 0, {
    message: "tables (or table/tableName/name alias) is required",
  });

// --- AnalyzeTable ---
export const AnalyzeTableSchemaBase = z.object({
  tables: z.array(z.string()).optional().describe("Table names to analyze"),
  table: z.string().optional().describe("Single table name (alias for tables)"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
});

export const AnalyzeTableSchema = z
  .preprocess(
    preprocessAdminTableParams,
    z.object({
      tables: z.array(z.string()).optional(),
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
    }),
  )
  .transform((data) => ({
    tables: data.tables ?? [],
  }))
  .refine((data) => data.tables.length > 0, {
    message: "tables (or table/tableName/name alias) is required",
  });

// --- CheckTable ---
export const CheckTableSchemaBase = z.object({
  tables: z.array(z.string()).optional().describe("Table names to check"),
  table: z.string().optional().describe("Single table name (alias for tables)"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  option: z
    .enum(["QUICK", "FAST", "MEDIUM", "EXTENDED", "CHANGED"])
    .optional()
    .describe("Check option"),
});

export const CheckTableSchema = z
  .preprocess(
    preprocessAdminTableParams,
    z.object({
      tables: z.array(z.string()).optional(),
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      option: z
        .enum(["QUICK", "FAST", "MEDIUM", "EXTENDED", "CHANGED"])
        .optional(),
    }),
  )
  .transform((data) => ({
    tables: data.tables ?? [],
    option: data.option,
  }))
  .refine((data) => data.tables.length > 0, {
    message: "tables (or table/tableName/name alias) is required",
  });

// --- FlushTables ---
export const FlushTablesSchemaBase = z.object({
  tables: z
    .array(z.string())
    .optional()
    .describe("Specific tables to flush (empty for all)"),
  table: z.string().optional().describe("Single table name (alias for tables)"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
});

export const FlushTablesSchema = z
  .preprocess(
    preprocessAdminTableParams,
    z.object({
      tables: z.array(z.string()).optional(),
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
    }),
  )
  .transform((data) => ({
    tables: data.tables,
  }));

export const KillQuerySchema = z.object({
  processId: z.number().describe("Process ID to kill"),
  connection: z
    .boolean()
    .optional()
    .default(false)
    .describe("Kill connection instead of query"),
});

export const ShowProcesslistSchema = z.object({
  full: z.boolean().optional().default(false).describe("Show full query text"),
});

export const ShowStatusSchema = z.object({
  like: z.string().optional().describe("Filter variables by LIKE pattern"),
  global: z.boolean().optional().default(true).describe("Show global status"),
  limit: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "Maximum number of variables to return (default: 100). Set higher to see all.",
    ),
});

export const ShowVariablesSchema = z.object({
  like: z.string().optional().describe("Filter variables by LIKE pattern"),
  global: z
    .boolean()
    .optional()
    .default(true)
    .describe("Show global variables"),
  limit: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "Maximum number of variables to return (default: 100). Set higher to see all.",
    ),
});

// =============================================================================
// Backup Schemas
// =============================================================================

// --- ExportTable ---
export const ExportTableSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  format: z
    .enum(["SQL", "CSV"])
    .optional()
    .default("SQL")
    .describe("Export format"),
  where: z.string().optional().describe("WHERE clause to filter rows"),
  filter: z.string().optional().describe("Alias for where"),
  limit: z
    .number()
    .int()
    .positive()
    .optional()
    .default(100)
    .describe(
      "Maximum number of rows to export (default: 100). Set higher to export more rows.",
    ),
});

export const ExportTableSchema = z
  .preprocess(
    preprocessTableParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      format: z.enum(["SQL", "CSV"]).optional().default("SQL"),
      where: z.string().optional(),
      filter: z.string().optional(),
      limit: z.number().int().positive().optional().default(100),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    format: data.format,
    where: data.where ?? data.filter,
    limit: data.limit,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  });

// --- ImportData ---
export const ImportDataSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  data: z
    .array(z.record(z.string(), z.unknown()))
    .describe("Array of row objects to insert"),
});

export const ImportDataSchema = z
  .preprocess(
    preprocessTableParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      data: z.array(z.record(z.string(), z.unknown())),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    data: data.data,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  });

// =============================================================================
// Replication Schemas
// =============================================================================

export const BinlogEventsSchema = z.object({
  logFile: z.string().optional().describe("Binlog file name"),
  position: z.number().optional().describe("Starting position"),
  limit: z
    .number()
    .optional()
    .default(20)
    .describe(
      "Maximum events to return (default: 20). Set higher for more events.",
    ),
});

// =============================================================================
// Partitioning Schemas
// =============================================================================

// --- PartitionInfo ---
export const PartitionInfoSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
});

export const PartitionInfoSchema = z
  .preprocess(
    preprocessTableParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  });

// --- AddPartition ---
export const AddPartitionSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  partitionName: z.string().describe("New partition name"),
  partitionType: z
    .enum(["RANGE", "LIST", "HASH", "KEY"])
    .describe("Partition type"),
  value: z
    .string()
    .describe(
      'Partition boundary value only - e.g., "2024" for RANGE, "1,2,3" for LIST, "4" for HASH/KEY partitions count. Do NOT include "LESS THAN" or "VALUES IN" keywords.',
    ),
});

export const AddPartitionSchema = z
  .preprocess(
    preprocessTableParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      partitionName: z.string(),
      partitionType: z.enum(["RANGE", "LIST", "HASH", "KEY"]),
      value: z.string(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    partitionName: data.partitionName,
    partitionType: data.partitionType,
    value: data.value,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  });

// --- DropPartition ---
export const DropPartitionSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  partitionName: z.string().describe("Partition name to drop"),
});

export const DropPartitionSchema = z
  .preprocess(
    preprocessTableParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      partitionName: z.string(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    partitionName: data.partitionName,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  });

// --- ReorganizePartition ---
export const ReorganizePartitionSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  fromPartitions: z.array(z.string()).describe("Source partition names"),
  partitionType: z
    .enum(["RANGE", "LIST", "HASH", "KEY"])
    .describe(
      "Partition type (RANGE or LIST). HASH/KEY partitions cannot be reorganized.",
    ),
  toPartitions: z
    .array(
      z.object({
        name: z.string().describe("New partition name"),
        value: z
          .string()
          .describe(
            'Partition boundary value only - e.g., "2024" for RANGE, "1,2,3" for LIST. Do NOT include "LESS THAN" or "VALUES IN" keywords.',
          ),
      }),
    )
    .describe("New partition definitions"),
});

export const ReorganizePartitionSchema = z
  .preprocess(
    preprocessTableParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      fromPartitions: z.array(z.string()),
      partitionType: z.enum(["RANGE", "LIST"]),
      toPartitions: z.array(
        z.object({
          name: z.string(),
          value: z.string(),
        }),
      ),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    fromPartitions: data.fromPartitions,
    partitionType: data.partitionType,
    toPartitions: data.toPartitions,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  });
