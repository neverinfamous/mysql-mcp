import { z } from "zod";
import { preprocessJsonColumnParams } from "../preprocess-utils.js";

// --- JsonSet ---
export const JsonSetSchemaBase = z.object({
  table: z.string().optional().describe("Table name (Anti-Hallucination: Pass 'table', not 'tableName')"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("JSON column name"),
  col: z.string().optional().describe("Alias for column"),
  columnName: z.string().optional().describe("Alias for column"),
  path: z.unknown().optional().describe("JSON path to set"),
  value: z.unknown().optional().describe("Value to set"),
  val: z.unknown().optional().describe("Alias for value"),
  where: z.string().optional().describe("WHERE clause to identify rows (REQUIRED. Anti-Hallucination: Pass 'where', not 'query' or 'sql')"),
  filter: z.string().optional().describe("Alias for where"),
  condition: z.string().optional().describe("Alias for where"),
  query: z.string().optional().describe("Alias for where"),
  sql: z.string().optional().describe("Alias for where"),
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
      path: z.unknown().optional(),
      value: z.unknown().optional(),
      val: z.unknown().optional(),
      where: z.string().optional(),
      filter: z.string().optional(),
      condition: z.string().optional(),
      sql: z.string().optional(),
      query: z.string().optional(),
      columnName: z.string().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column ?? data.col ?? data.columnName ?? "",
    path: data.path,
    value: data.value ?? data.val,
    where: data.where ?? data.filter ?? data.condition ?? data.query ?? data.sql ?? "",
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or col alias) is required",
  })
  .refine((data) => data.where !== "", {
    message: "where (or filter/condition alias) is required",
  })
  .refine((data) => data.path !== undefined && data.path !== "", {
    message: "path is required",
  })
  .refine((data) => data.value !== undefined && data.value !== "", {
    message: "value is required",
  });

// --- JsonInsert ---
export const JsonInsertSchemaBase = z.object({
  table: z.string().optional().describe("Table name (Anti-Hallucination: Pass 'table', not 'tableName')"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("JSON column name"),
  col: z.string().optional().describe("Alias for column"),
  columnName: z.string().optional().describe("Alias for column"),
  path: z.unknown().optional().describe("JSON path to insert at"),
  value: z.unknown().optional().describe("Value to insert"),
  val: z.unknown().optional().describe("Alias for value"),
  where: z.string().optional().describe("WHERE clause to identify rows (REQUIRED. Anti-Hallucination: Pass 'where', not 'query' or 'sql')"),
  filter: z.string().optional().describe("Alias for where"),
  condition: z.string().optional().describe("Alias for where"),
  query: z.string().optional().describe("Alias for where"),
  sql: z.string().optional().describe("Alias for where"),
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
      path: z.unknown().optional(),
      value: z.unknown().optional(),
      val: z.unknown().optional(),
      where: z.string().optional(),
      filter: z.string().optional(),
      condition: z.string().optional(),
      sql: z.string().optional(),
      query: z.string().optional(),
      columnName: z.string().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column ?? data.col ?? data.columnName ?? "",
    path: data.path,
    value: data.value ?? data.val,
    where: data.where ?? data.filter ?? data.condition ?? data.query ?? data.sql ?? "",
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or col alias) is required",
  })
  .refine((data) => data.where !== "", {
    message: "where (or filter/condition alias) is required",
  })
  .refine((data) => data.path !== undefined && data.path !== "", {
    message: "path is required",
  })
  .refine((data) => data.value !== undefined && data.value !== "", {
    message: "value is required",
  });

// --- JsonReplace ---
export const JsonReplaceSchemaBase = z.object({
  table: z.string().optional().describe("Table name (Anti-Hallucination: Pass 'table', not 'tableName')"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("JSON column name"),
  col: z.string().optional().describe("Alias for column"),
  columnName: z.string().optional().describe("Alias for column"),
  path: z.unknown().optional().describe("JSON path to replace"),
  value: z.unknown().optional().describe("Replacement value"),
  val: z.unknown().optional().describe("Alias for value"),
  where: z.string().optional().describe("WHERE clause to identify rows (REQUIRED. Anti-Hallucination: Pass 'where', not 'query' or 'sql')"),
  filter: z.string().optional().describe("Alias for where"),
  condition: z.string().optional().describe("Alias for where"),
  query: z.string().optional().describe("Alias for where"),
  sql: z.string().optional().describe("Alias for where"),
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
      path: z.unknown().optional(),
      value: z.unknown().optional(),
      val: z.unknown().optional(),
      where: z.string().optional(),
      filter: z.string().optional(),
      condition: z.string().optional(),
      sql: z.string().optional(),
      query: z.string().optional(),
      columnName: z.string().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column ?? data.col ?? data.columnName ?? "",
    path: data.path,
    value: data.value ?? data.val,
    where: data.where ?? data.filter ?? data.condition ?? data.query ?? data.sql ?? "",
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or col alias) is required",
  })
  .refine((data) => data.where !== "", {
    message: "where (or filter/condition alias) is required",
  })
  .refine((data) => data.path !== undefined && data.path !== "", {
    message: "path is required",
  })
  .refine((data) => data.value !== undefined && data.value !== "", {
    message: "value is required",
  });

// --- JsonRemove ---
export const JsonRemoveSchemaBase = z.object({
  table: z.string().optional().describe("Table name (Anti-Hallucination: Pass 'table', not 'tableName')"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("JSON column name"),
  col: z.string().optional().describe("Alias for column"),
  columnName: z.string().optional().describe("Alias for column"),
  paths: z.array(z.string()).optional().describe("JSON paths to remove (Anti-Hallucination: Pass 'paths', not 'path' or 'keys')"),
  path: z.string().optional().describe("Alias for single path to remove"),
  keys: z.array(z.string()).optional().describe("Alias for paths"),
  key: z.string().optional().describe("Alias for single path to remove"),
  where: z.string().optional().describe("WHERE clause to identify rows (REQUIRED. Anti-Hallucination: Pass 'where', not 'query' or 'sql')"),
  filter: z.string().optional().describe("Alias for where"),
  condition: z.string().optional().describe("Alias for where"),
  query: z.string().optional().describe("Alias for where"),
  sql: z.string().optional().describe("Alias for where"),
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
      paths: z.array(z.string()).optional(),
      path: z.string().optional(),
      keys: z.array(z.string()).optional(),
      key: z.string().optional(),
      where: z.string().optional(),
      filter: z.string().optional(),
      condition: z.string().optional(),
      sql: z.string().optional(),
      query: z.string().optional(),
      columnName: z.string().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column ?? data.col ?? data.columnName ?? "",
    paths: data.paths ?? data.keys ?? (data.path ? [data.path] : data.key ? [data.key] : []),
    where: data.where ?? data.filter ?? data.condition ?? data.query ?? data.sql ?? "",
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or col alias) is required",
  })
  .refine((data) => data.paths.length > 0, {
    message:
      "paths (or path alias) is required and must contain at least one element",
  })
  .refine((data) => data.where !== "", {
    message: "where (or filter/condition alias) is required",
  });

// --- JsonArrayAppend ---
export const JsonArrayAppendSchemaBase = z.object({
  table: z.string().optional().describe("Table name (Anti-Hallucination: Pass 'table', not 'tableName')"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("JSON column name"),
  col: z.string().optional().describe("Alias for column"),
  columnName: z.string().optional().describe("Alias for column"),
  path: z.unknown().optional().describe("JSON path to array"),
  value: z.unknown().optional().describe("Value to append"),
  val: z.unknown().optional().describe("Alias for value"),
  where: z.string().optional().describe("WHERE clause to identify rows (REQUIRED. Anti-Hallucination: Pass 'where', not 'query' or 'sql')"),
  filter: z.string().optional().describe("Alias for where"),
  condition: z.string().optional().describe("Alias for where"),
  query: z.string().optional().describe("Alias for where"),
  sql: z.string().optional().describe("Alias for where"),
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
      path: z.unknown().optional(),
      value: z.unknown().optional(),
      val: z.unknown().optional(),
      where: z.string().optional(),
      filter: z.string().optional(),
      condition: z.string().optional(),
      sql: z.string().optional(),
      query: z.string().optional(),
      columnName: z.string().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column ?? data.col ?? data.columnName ?? "",
    path: data.path,
    value: data.value ?? data.val,
    where: data.where ?? data.filter ?? data.condition ?? data.query ?? data.sql ?? "",
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or col alias) is required",
  })
  .refine((data) => data.where !== "", {
    message: "where (or filter/condition alias) is required",
  })
  .refine((data) => data.path !== undefined && data.path !== "", {
    message: "path is required",
  })
  .refine((data) => data.value !== undefined && data.value !== "", {
    message: "value is required",
  });

// --- JsonUpdate ---
export const JsonUpdateSchemaBase = z.object({
  table: z.string().optional().describe("Table name (Anti-Hallucination: Pass 'table', not 'tableName')"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("JSON column name"),
  col: z.string().optional().describe("Alias for column"),
  columnName: z.string().optional().describe("Alias for column"),
  path: z.unknown().optional().describe("JSON path to update"),
  value: z.unknown().optional().describe("New value"),
  val: z.unknown().optional().describe("Alias for value"),
  where: z.string().optional().describe("WHERE clause to identify rows (REQUIRED. Anti-Hallucination: Pass 'where', not 'query' or 'sql')"),
  filter: z.string().optional().describe("Alias for where"),
  condition: z.string().optional().describe("Alias for where"),
  query: z.string().optional().describe("Alias for where"),
  sql: z.string().optional().describe("Alias for where"),
  idColumn: z.string().optional().describe("Alias for where (used with rowId)"),
  rowId: z.unknown().optional().describe("Alias for where (used with idColumn)"),
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
      path: z.unknown().optional(),
      value: z.unknown().optional(),
      val: z.unknown().optional(),
      where: z.string().optional(),
      filter: z.string().optional(),
      condition: z.string().optional(),
      sql: z.string().optional(),
      query: z.string().optional(),
      columnName: z.string().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column ?? data.col ?? data.columnName ?? "",
    path: data.path,
    value: data.value ?? data.val,
    where: data.where ?? data.filter ?? data.condition ?? data.query ?? data.sql ?? "",
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
  .refine((data) => data.value !== undefined && data.value !== "", {
    message: "value is required",
  })
  .refine((data) => data.where !== "", {
    message: "where (or filter/condition alias) is required",
  });
