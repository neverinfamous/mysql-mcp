/**
 * MySQL Adapter - Zod Schemas
 *
 * Input validation schemas for all MySQL tools.
 */

import { z } from "zod";

// =============================================================================
// Core Tools Schemas
// =============================================================================

export const ReadQuerySchema = z.object({
  query: z.string().describe("SQL SELECT query to execute"),
  params: z
    .array(z.unknown())
    .optional()
    .describe("Query parameters for prepared statement"),
  transactionId: z
    .string()
    .optional()
    .describe("Optional transaction ID for executing within a transaction"),
});

export const WriteQuerySchema = z.object({
  query: z.string().describe("SQL INSERT/UPDATE/DELETE query"),
  params: z
    .array(z.unknown())
    .optional()
    .describe("Query parameters for prepared statement"),
  transactionId: z
    .string()
    .optional()
    .describe("Optional transaction ID for executing within a transaction"),
});

export const ListTablesSchema = z.object({
  database: z
    .string()
    .optional()
    .describe("Database name (defaults to connected database)"),
});

export const DescribeTableSchema = z.object({
  table: z.string().describe("Table name to describe"),
});

export const CreateTableSchema = z.object({
  name: z.string().describe("Table name"),
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

export const DropTableSchema = z.object({
  table: z.string().describe("Table name to drop"),
  ifExists: z
    .boolean()
    .optional()
    .default(true)
    .describe("Add IF EXISTS clause"),
});

export const CreateIndexSchema = z.object({
  name: z.string().describe("Index name"),
  table: z.string().describe("Table name"),
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

export const GetIndexesSchema = z.object({
  table: z.string().describe("Table name"),
});

// =============================================================================
// Transaction Schemas
// =============================================================================

export const TransactionBeginSchema = z.object({
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

export const TransactionIdSchema = z.object({
  transactionId: z.string().describe("Transaction ID from begin operation"),
});

export const TransactionSavepointSchema = z.object({
  transactionId: z.string().describe("Transaction ID"),
  savepoint: z.string().describe("Savepoint name"),
});

export const TransactionExecuteSchema = z.object({
  statements: z
    .array(z.string())
    .describe("SQL statements to execute atomically"),
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

// =============================================================================
// JSON Schemas
// =============================================================================

export const JsonExtractSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("JSON column name"),
  path: z.string().describe("JSON path (e.g., $.name or $[0])"),
  where: z.string().optional().describe("WHERE clause for filtering rows"),
});

export const JsonSetSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("JSON column name"),
  path: z.string().describe("JSON path to set"),
  value: z.unknown().describe("Value to set"),
  where: z.string().describe("WHERE clause to identify rows"),
});

export const JsonContainsSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("JSON column name"),
  value: z.unknown().describe("Value to search for"),
  path: z.string().optional().describe("Optional JSON path to search within"),
});

export const JsonKeysSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("JSON column name"),
  path: z.string().optional().describe("Optional JSON path (defaults to root)"),
});

export const JsonSearchSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("JSON column name"),
  searchValue: z.string().describe("String value to search for"),
  mode: z
    .enum(["one", "all"])
    .optional()
    .default("one")
    .describe("Search mode"),
});

export const JsonValidateSchema = z.object({
  value: z.string().describe("JSON string to validate"),
});

// =============================================================================
// Text Schemas
// =============================================================================

export const RegexpMatchSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Column name"),
  pattern: z.string().describe("Regular expression pattern"),
  where: z
    .string()
    .optional()
    .describe("Additional WHERE clause for filtering"),
});

export const LikeSearchSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Column name"),
  pattern: z.string().describe("LIKE pattern with % and _ wildcards"),
  where: z
    .string()
    .optional()
    .describe("Additional WHERE clause for filtering"),
});

export const SoundexSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Column name"),
  value: z.string().describe("Value to match phonetically"),
  where: z
    .string()
    .optional()
    .describe("Additional WHERE clause for filtering"),
});

export const FulltextCreateSchema = z.object({
  table: z.string().describe("Table name"),
  columns: z.array(z.string()).describe("Columns to include in index"),
  indexName: z.string().optional().describe("Optional index name"),
});

export const FulltextSearchSchema = z.object({
  table: z.string().describe("Table name"),
  columns: z.array(z.string()).describe("Columns to search"),
  query: z.string().describe("Search query"),
  mode: z
    .enum(["NATURAL", "BOOLEAN", "EXPANSION"])
    .optional()
    .default("NATURAL")
    .describe("Search mode"),
});

// =============================================================================
// Performance Schemas
// =============================================================================

export const ExplainSchema = z.object({
  query: z.string().describe("SQL query to explain"),
  format: z
    .enum(["TRADITIONAL", "JSON", "TREE"])
    .optional()
    .default("JSON")
    .describe("Output format"),
});

export const SlowQuerySchema = z.object({
  limit: z
    .number()
    .optional()
    .default(10)
    .describe("Number of slow queries to return"),
  minTime: z.number().optional().describe("Minimum query time in seconds"),
});

export const IndexUsageSchema = z.object({
  table: z.string().optional().describe("Filter by table name"),
  limit: z
    .number()
    .int()
    .positive()
    .optional()
    .default(10)
    .describe("Maximum number of indexes to return"),
});

export const TableStatsSchema = z.object({
  table: z.string().describe("Table name"),
});

// =============================================================================
// Admin Schemas
// =============================================================================

export const OptimizeTableSchema = z.object({
  tables: z.array(z.string()).describe("Table names to optimize"),
});

export const AnalyzeTableSchema = z.object({
  tables: z.array(z.string()).describe("Table names to analyze"),
});

export const CheckTableSchema = z.object({
  tables: z.array(z.string()).describe("Table names to check"),
  option: z
    .enum(["QUICK", "FAST", "MEDIUM", "EXTENDED", "CHANGED"])
    .optional()
    .describe("Check option"),
});

export const FlushTablesSchema = z.object({
  tables: z
    .array(z.string())
    .optional()
    .describe("Specific tables to flush (empty for all)"),
});

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

export const ExportTableSchema = z.object({
  table: z.string().describe("Table name"),
  format: z
    .enum(["SQL", "CSV"])
    .optional()
    .default("SQL")
    .describe("Export format"),
  where: z.string().optional().describe("WHERE clause to filter rows"),
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

export const ImportDataSchema = z.object({
  table: z.string().describe("Table name"),
  data: z
    .array(z.record(z.string(), z.unknown()))
    .describe("Array of row objects to insert"),
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

export const PartitionInfoSchema = z.object({
  table: z.string().describe("Table name"),
});

export const AddPartitionSchema = z.object({
  table: z.string().describe("Table name"),
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

export const DropPartitionSchema = z.object({
  table: z.string().describe("Table name"),
  partitionName: z.string().describe("Partition name to drop"),
});

export const ReorganizePartitionSchema = z.object({
  table: z.string().describe("Table name"),
  fromPartitions: z.array(z.string()).describe("Source partition names"),
  partitionType: z
    .enum(["RANGE", "LIST"])
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
