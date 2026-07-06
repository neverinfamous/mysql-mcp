import { z } from "zod";
import { preprocessJsonColumnParams } from "../preprocess-utils.js";

// --- JsonExtract ---
export const JsonExtractSchemaBase = z.object({
  table: z.string().optional().describe("Table name (Anti-Hallucination: Pass 'table', not 'tableName')"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("JSON column name"),
  col: z.string().optional().describe("Alias for column"),
  columnName: z.string().optional().describe("Alias for column"),
  path: z.unknown().optional().describe("JSON path (e.g., $.name or $[0])"),
  where: z.string().optional().describe("WHERE clause for filtering rows"),
  filter: z.string().optional().describe("Alias for where"),
  query: z.string().optional().describe("Alias for where"),
  sql: z.string().optional().describe("Alias for where"),
  limit: z.unknown().optional().describe("Maximum rows to return"),
  idColumn: z.string().optional().describe("Alias for where (used with rowId)"),
  rowId: z.unknown().optional().describe("Alias for where (used with idColumn)"),
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
      columnName: z.string().optional(),
      path: z.unknown().optional(),
      where: z.string().optional(),
      filter: z.string().optional(),
      query: z.string().optional(),
      sql: z.string().optional(),
      limit: z.coerce.number().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column ?? data.col ?? data.columnName ?? "",
    path: data.path,
    where: data.where ?? data.filter ?? data.query ?? data.sql,
    limit: data.limit,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or col alias) is required",
  })
  .refine((data) => data.path !== undefined && data.path !== "", {
    message: "path is required",
  });

// --- JsonGet ---
export const JsonGetSchemaBase = z.object({
  table: z.string().optional().describe("Table name (Anti-Hallucination: Pass 'table', not 'tableName')"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("JSON column name"),
  col: z.string().optional().describe("Alias for column"),
  columnName: z.string().optional().describe("Alias for column"),
  path: z.unknown().optional().describe("JSON path to extract"),
  where: z.string().optional().describe("WHERE clause to identify rows (REQUIRED. Anti-Hallucination: Pass 'where', not 'query' or 'sql')"),
  filter: z.string().optional().describe("Alias for where"),
  query: z.string().optional().describe("Alias for where"),
  sql: z.string().optional().describe("Alias for where"),
  idColumn: z.string().optional().describe("Alias for where (used with rowId)"),
  rowId: z.unknown().optional().describe("Alias for where (used with idColumn)"),
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
      columnName: z.string().optional(),
      path: z.unknown().optional(),
      where: z.string().optional(),
      filter: z.string().optional(),
      query: z.string().optional(),
      sql: z.string().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column ?? data.col ?? data.columnName ?? "",
    path: data.path,
    where: data.where ?? data.filter ?? data.query ?? data.sql ?? "",
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or col alias) is required",
  })
  .refine((data) => data.path !== undefined && data.path !== "", {
    message: "path is required",
  })
  .refine((data) => data.where !== "", {
    message: "where (or filter alias) is required",
  });

// --- JsonKeys ---
export const JsonKeysSchemaBase = z.object({
  table: z.string().optional().describe("Table name (Anti-Hallucination: Pass 'table', not 'tableName')"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("JSON column name"),
  col: z.string().optional().describe("Alias for column"),
  columnName: z.string().optional().describe("Alias for column"),
  path: z.string().optional().describe("Optional JSON path (defaults to root)"),
  where: z.string().optional().describe("Optional WHERE clause"),
  filter: z.string().optional().describe("Alias for where"),
  query: z.string().optional().describe("Alias for where"),
  sql: z.string().optional().describe("Alias for where"),
  limit: z.unknown().optional().describe("Maximum rows to return"),
  idColumn: z.string().optional().describe("Alias for where (used with rowId)"),
  rowId: z.unknown().optional().describe("Alias for where (used with idColumn)"),
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
      columnName: z.string().optional(),
      path: z.string().optional(),
      where: z.string().optional(),
      filter: z.string().optional(),
      query: z.string().optional(),
      sql: z.string().optional(),
      limit: z.coerce.number().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column ?? data.col ?? data.columnName ?? "",
    path: data.path,
    where: data.where ?? data.filter ?? data.query ?? data.sql,
    limit: data.limit,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or col alias) is required",
  });
