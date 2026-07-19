import { z } from "zod";
import { preprocessJsonColumnParams, ensureJsonPath } from "../preprocess-utils.js";

// --- JsonSet ---
export const JsonSetSchemaBase = z.object({
  table: z.string().optional().describe("Table name (Anti-Hallucination: Pass 'table', not 'tableName')"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("JSON column name"),
  col: z.string().optional().describe("Alias for column"),
  columnName: z.string().optional().describe("Alias for column"),
  path: z.string().optional().describe("JSON path to set (Anti-Hallucination: Pass 'path', not 'key')"),
  key: z.string().optional().describe("Alias for path"),
  keys: z.string().optional().describe("Alias for path"),
  value: z.unknown().optional().describe("Value to set"),
  val: z.unknown().optional().describe("Alias for value"),
  where: z.unknown().optional().describe("WHERE clause to identify rows (REQUIRED. Anti-Hallucination: Pass 'where', not 'query' or 'sql')"),
  filter: z.string().optional().describe("Alias for where"),
  condition: z.string().optional().describe("Alias for where"),
  query: z.string().optional().describe("Alias for where"),
  sql: z.string().optional().describe("Alias for where"),
  idColumn: z.string().optional().describe("Alias for where (used with rowId)"),
  rowId: z.unknown().optional().describe("Alias for where (used with idColumn)"),
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
      path: z.string().optional(),
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
    path: ensureJsonPath(data.path),
    value: data.value !== undefined ? data.value : data.val,
    where: (data.where ?? data.filter ?? data.condition ?? data.query ?? data.sql ?? "").trim(),
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
  .refine((data) => data.value !== undefined, {
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
  path: z.string().optional().describe("JSON path to insert at (Anti-Hallucination: Pass 'path', not 'key')"),
  key: z.string().optional().describe("Alias for path"),
  keys: z.string().optional().describe("Alias for path"),
  value: z.unknown().optional().describe("Value to insert"),
  val: z.unknown().optional().describe("Alias for value"),
  where: z.unknown().optional().describe("WHERE clause to identify rows (REQUIRED. Anti-Hallucination: Pass 'where', not 'query' or 'sql')"),
  filter: z.string().optional().describe("Alias for where"),
  condition: z.string().optional().describe("Alias for where"),
  query: z.string().optional().describe("Alias for where"),
  sql: z.string().optional().describe("Alias for where"),
  idColumn: z.string().optional().describe("Alias for where (used with rowId)"),
  rowId: z.unknown().optional().describe("Alias for where (used with idColumn)"),
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
      path: z.string().optional(),
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
    path: ensureJsonPath(data.path),
    value: data.value !== undefined ? data.value : data.val,
    where: (data.where ?? data.filter ?? data.condition ?? data.query ?? data.sql ?? "").trim(),
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
  .refine((data) => data.value !== undefined, {
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
  path: z.string().optional().describe("JSON path to replace (Anti-Hallucination: Pass 'path', not 'key')"),
  key: z.string().optional().describe("Alias for path"),
  keys: z.string().optional().describe("Alias for path"),
  value: z.unknown().optional().describe("Replacement value"),
  val: z.unknown().optional().describe("Alias for value"),
  where: z.unknown().optional().describe("WHERE clause to identify rows (REQUIRED. Anti-Hallucination: Pass 'where', not 'query' or 'sql')"),
  filter: z.string().optional().describe("Alias for where"),
  condition: z.string().optional().describe("Alias for where"),
  query: z.string().optional().describe("Alias for where"),
  sql: z.string().optional().describe("Alias for where"),
  idColumn: z.string().optional().describe("Alias for where (used with rowId)"),
  rowId: z.unknown().optional().describe("Alias for where (used with idColumn)"),
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
      path: z.string().optional(),
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
    path: ensureJsonPath(data.path),
    value: data.value !== undefined ? data.value : data.val,
    where: (data.where ?? data.filter ?? data.condition ?? data.query ?? data.sql ?? "").trim(),
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
  .refine((data) => data.value !== undefined, {
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
  paths: z.unknown().optional().describe("JSON paths to remove (Anti-Hallucination: Pass 'paths', not 'path' or 'keys')"),
  path: z.string().optional().describe("Alias for single path to remove"),
  keys: z.union([z.array(z.string()), z.string()]).optional().describe("Alias for paths"),
  key: z.string().optional().describe("Alias for single path to remove"),
  where: z.unknown().optional().describe("WHERE clause to identify rows (REQUIRED. Anti-Hallucination: Pass 'where', not 'query' or 'sql')"),
  filter: z.string().optional().describe("Alias for where"),
  condition: z.string().optional().describe("Alias for where"),
  query: z.string().optional().describe("Alias for where"),
  sql: z.string().optional().describe("Alias for where"),
  idColumn: z.string().optional().describe("Alias for where (used with rowId)"),
  rowId: z.unknown().optional().describe("Alias for where (used with idColumn)"),
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
      paths: z.union([z.array(z.string()), z.string()]).optional(),
      path: z.string().optional(),
      keys: z.union([z.array(z.string()), z.string()]).optional(),
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
    paths: ((Array.isArray(data.paths) ? data.paths : data.paths ? [data.paths] : null)
      ?? (Array.isArray(data.keys) ? data.keys : data.keys ? [data.keys] : null)
      ?? (data.path ? [data.path] : data.key ? [data.key] : [])).map(p => ensureJsonPath(p ?? "") ?? ""),
    where: (data.where ?? data.filter ?? data.condition ?? data.query ?? data.sql ?? "").trim(),
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
  column: z.string().optional().describe("JSON column name (Anti-Hallucination: Pass 'column', not 'col' or 'columnName')"),
  col: z.string().optional().describe("Alias for column"),
  columnName: z.string().optional().describe("Alias for column"),
  path: z.string().optional().describe("JSON path to array (Anti-Hallucination: Pass 'path', not 'key')"),
  value: z.unknown().optional().describe("Value to append (Anti-Hallucination: Pass 'value', not 'data' or 'item')"),
  val: z.unknown().optional().describe("Alias for value"),
  data: z.unknown().optional().describe("Alias for value"),
  item: z.unknown().optional().describe("Alias for value"),
  element: z.unknown().optional().describe("Alias for value"),
  where: z.unknown().optional().describe("WHERE clause to identify rows (REQUIRED. Anti-Hallucination: Pass 'where', not 'query' or 'sql')"),
  filter: z.string().optional().describe("Alias for where"),
  condition: z.string().optional().describe("Alias for where"),
  query: z.string().optional().describe("Alias for where"),
  sql: z.string().optional().describe("Alias for where"),
  idColumn: z.string().optional().describe("Alias for where (used with rowId)"),
  rowId: z.unknown().optional().describe("Alias for where (used with idColumn)"),
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
      path: z.string().optional(),
      value: z.unknown().optional(),
      val: z.unknown().optional(),
      data: z.unknown().optional(),
      item: z.unknown().optional(),
      element: z.unknown().optional(),
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
    path: ensureJsonPath(data.path),
    value: data.value !== undefined ? data.value : data.val !== undefined ? data.val : data.data !== undefined ? data.data : data.item !== undefined ? data.item : data.element,
    where: (data.where ?? data.filter ?? data.condition ?? data.query ?? data.sql ?? "").trim(),
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
  .refine((data) => data.value !== undefined, {
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
  path: z.string().optional().describe("JSON path to update (Anti-Hallucination: Pass 'path', not 'key')"),
  key: z.string().optional().describe("Alias for path"),
  keys: z.string().optional().describe("Alias for path"),
  value: z.unknown().optional().describe("New value"),
  val: z.unknown().optional().describe("Alias for value"),
  where: z.unknown().optional().describe("WHERE clause to identify rows (REQUIRED. Anti-Hallucination: Pass 'where', not 'query' or 'sql')"),
  filter: z.string().optional().describe("Alias for where"),
  condition: z.string().optional().describe("Alias for where"),
  query: z.string().optional().describe("Alias for where"),
  sql: z.string().optional().describe("Alias for where"),
  idColumn: z.string().optional().describe("Alias for where (used with rowId)"),
  rowId: z.unknown().optional().describe("Alias for where (used with idColumn)"),
  id: z.unknown().optional().describe("Alias for where (used with idColumn)"),
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
      path: z.string().optional(),
      value: z.unknown().optional(),
      val: z.unknown().optional(),
      where: z.string().optional(),
      filter: z.string().optional(),
      condition: z.string().optional(),
      sql: z.string().optional(),
      query: z.string().optional(),
      columnName: z.string().optional(),
      id: z.unknown().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column ?? data.col ?? data.columnName ?? "",
    path: ensureJsonPath(data.path),
    value: data.value !== undefined ? data.value : data.val,
    where: (data.where ?? data.filter ?? data.condition ?? data.query ?? data.sql ?? "").trim(),
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
  .refine((data) => data.value !== undefined, {
    message: "value is required",
  })
  .refine((data) => data.where !== "", {
    message: "where (or filter/condition alias) is required",
  });
