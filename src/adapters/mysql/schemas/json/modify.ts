import { z } from "zod";
import { preprocessJsonColumnParams, ensureJsonPath } from "../preprocess-utils.js";

// --- JsonSet ---
export const JsonSetSchemaBase = z.object({
  table: z.unknown().optional().describe("Table name (REQUIRED. Anti-Hallucination: Pass 'table', not 'tableName')"),
  tableName: z.unknown().optional().describe("Alias for table"),
  name: z.unknown().optional().describe("Alias for table"),
  tbl: z.unknown().optional().describe("Alias for table"),
  table_name: z.unknown().optional().describe("Alias for table"),
  column: z.unknown().optional().describe("JSON column name (REQUIRED. Anti-Hallucination: Pass 'column', not 'col' or 'columnName')"),
  col: z.unknown().optional().describe("Alias for column"),
  columnName: z.unknown().optional().describe("Alias for column"),
  c: z.unknown().optional().describe("Alias for column"),
  path: z.unknown().optional().describe("JSON path to set (REQUIRED. Anti-Hallucination: Pass 'path', not 'key')"),
  key: z.unknown().optional().describe("Alias for path"),
  keys: z.unknown().optional().describe("Alias for path"),
  json_path: z.unknown().optional().describe("Alias for path"),
  jsonPath: z.unknown().optional().describe("Alias for path"),
  value: z.unknown().optional().describe("Value to set (REQUIRED. Anti-Hallucination: Pass 'value', not 'val')"),
  val: z.unknown().optional().describe("Alias for value"),
  data: z.unknown().optional().describe("Alias for value"),
  item: z.unknown().optional().describe("Alias for value"),
  element: z.unknown().optional().describe("Alias for value"),
  doc: z.unknown().optional().describe("Alias for value"),
  document: z.unknown().optional().describe("Alias for value"),
  content: z.unknown().optional().describe("Alias for value"),
  where: z.unknown().optional().describe("WHERE clause to identify rows (REQUIRED. Anti-Hallucination: Pass 'where', not 'query' or 'sql')"),
  filter: z.unknown().optional().describe("Alias for where"),
  condition: z.unknown().optional().describe("Alias for where"),
  query: z.unknown().optional().describe("Alias for where"),
  sql: z.unknown().optional().describe("Alias for where"),
  idColumn: z.unknown().optional().describe("Alias for where (used with rowId)"),
  rowId: z.unknown().optional().describe("Alias for where (used with idColumn)"),
  id: z.unknown().optional().describe("Alias for where (used with idColumn)"),
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
      path: z.string().regex(/^\$((?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)|(?:\."[^"]+")|(?:\[\s*\d+\s*\]))*$/, "Invalid JSON path expression (must start with $ and use valid path legs. Wildcards are not supported for modification)").optional(),
      value: z.unknown().optional(),
      val: z.unknown().optional(),
      data: z.unknown().optional(),
      item: z.unknown().optional(),
      element: z.unknown().optional(),
      doc: z.unknown().optional(),
      document: z.unknown().optional(),
      content: z.unknown().optional(),
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
    value: data.value !== undefined ? data.value : data.val !== undefined ? data.val : data.data !== undefined ? data.data : data.item !== undefined ? data.item : data.element !== undefined ? data.element : data.doc !== undefined ? data.doc : data.document !== undefined ? data.document : data.content,
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
  table: z.unknown().optional().describe("Table name (REQUIRED. Anti-Hallucination: Pass 'table', not 'tableName')"),
  tableName: z.unknown().optional().describe("Alias for table"),
  name: z.unknown().optional().describe("Alias for table"),
  tbl: z.unknown().optional().describe("Alias for table"),
  table_name: z.unknown().optional().describe("Alias for table"),
  column: z.unknown().optional().describe("JSON column name (REQUIRED. Anti-Hallucination: Pass 'column', not 'col' or 'columnName')"),
  col: z.unknown().optional().describe("Alias for column"),
  columnName: z.unknown().optional().describe("Alias for column"),
  c: z.unknown().optional().describe("Alias for column"),
  path: z.unknown().optional().describe("JSON path to insert at (REQUIRED. Anti-Hallucination: Pass 'path', not 'key')"),
  key: z.unknown().optional().describe("Alias for path"),
  keys: z.unknown().optional().describe("Alias for path"),
  json_path: z.unknown().optional().describe("Alias for path"),
  jsonPath: z.unknown().optional().describe("Alias for path"),
  value: z.unknown().optional().describe("Value to insert (REQUIRED. Anti-Hallucination: Pass 'value', not 'data' or 'item')"),
  val: z.unknown().optional().describe("Alias for value"),
  data: z.unknown().optional().describe("Alias for value"),
  item: z.unknown().optional().describe("Alias for value"),
  element: z.unknown().optional().describe("Alias for value"),
  doc: z.unknown().optional().describe("Alias for value"),
  document: z.unknown().optional().describe("Alias for value"),
  content: z.unknown().optional().describe("Alias for value"),
  where: z.unknown().optional().describe("WHERE clause to identify rows (REQUIRED. Anti-Hallucination: Pass 'where', not 'query' or 'sql')"),
  filter: z.unknown().optional().describe("Alias for where"),
  condition: z.unknown().optional().describe("Alias for where"),
  query: z.unknown().optional().describe("Alias for where"),
  sql: z.unknown().optional().describe("Alias for where"),
  idColumn: z.unknown().optional().describe("Alias for where (used with rowId)"),
  rowId: z.unknown().optional().describe("Alias for where (used with idColumn)"),
  id: z.unknown().optional().describe("Alias for where (used with idColumn)"),
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
      path: z.string().regex(/^\$((?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)|(?:\."[^"]+")|(?:\[\s*\d+\s*\]))*$/, "Invalid JSON path expression (must start with $ and use valid path legs. Wildcards are not supported for modification)").optional(),
      value: z.unknown().optional(),
      val: z.unknown().optional(),
      data: z.unknown().optional(),
      item: z.unknown().optional(),
      element: z.unknown().optional(),
      doc: z.unknown().optional(),
      document: z.unknown().optional(),
      content: z.unknown().optional(),
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
    value: data.value !== undefined ? data.value : data.val !== undefined ? data.val : data.data !== undefined ? data.data : data.item !== undefined ? data.item : data.element !== undefined ? data.element : data.doc !== undefined ? data.doc : data.document !== undefined ? data.document : data.content,
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
  table: z.unknown().optional().describe("Table name (REQUIRED. Anti-Hallucination: Pass 'table', not 'tableName')"),
  tableName: z.unknown().optional().describe("Alias for table"),
  name: z.unknown().optional().describe("Alias for table"),
  tbl: z.unknown().optional().describe("Alias for table"),
  table_name: z.unknown().optional().describe("Alias for table"),
  column: z.unknown().optional().describe("JSON column name (REQUIRED. Anti-Hallucination: Pass 'column', not 'col' or 'columnName')"),
  col: z.unknown().optional().describe("Alias for column"),
  columnName: z.unknown().optional().describe("Alias for column"),
  c: z.unknown().optional().describe("Alias for column"),
  path: z.unknown().optional().describe("JSON path to replace (REQUIRED. Anti-Hallucination: Pass 'path', not 'key')"),
  key: z.unknown().optional().describe("Alias for path"),
  keys: z.unknown().optional().describe("Alias for path"),
  json_path: z.unknown().optional().describe("Alias for path"),
  jsonPath: z.unknown().optional().describe("Alias for path"),
  value: z.unknown().optional().describe("Replacement value (REQUIRED. Anti-Hallucination: Pass 'value', not 'data' or 'item')"),
  val: z.unknown().optional().describe("Alias for value"),
  data: z.unknown().optional().describe("Alias for value"),
  item: z.unknown().optional().describe("Alias for value"),
  element: z.unknown().optional().describe("Alias for value"),
  doc: z.unknown().optional().describe("Alias for value"),
  document: z.unknown().optional().describe("Alias for value"),
  content: z.unknown().optional().describe("Alias for value"),
  where: z.unknown().optional().describe("WHERE clause to identify rows (REQUIRED. Anti-Hallucination: Pass 'where', not 'query' or 'sql')"),
  filter: z.unknown().optional().describe("Alias for where"),
  condition: z.unknown().optional().describe("Alias for where"),
  query: z.unknown().optional().describe("Alias for where"),
  sql: z.unknown().optional().describe("Alias for where"),
  idColumn: z.unknown().optional().describe("Alias for where (used with rowId)"),
  rowId: z.unknown().optional().describe("Alias for where (used with idColumn)"),
  id: z.unknown().optional().describe("Alias for where (used with idColumn)"),
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
      path: z.string().regex(/^\$((?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)|(?:\."[^"]+")|(?:\[\s*\d+\s*\]))*$/, "Invalid JSON path expression (must start with $ and use valid path legs. Wildcards are not supported for modification)").optional(),
      value: z.unknown().optional(),
      val: z.unknown().optional(),
      data: z.unknown().optional(),
      item: z.unknown().optional(),
      element: z.unknown().optional(),
      doc: z.unknown().optional(),
      document: z.unknown().optional(),
      content: z.unknown().optional(),
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
    value: data.value !== undefined ? data.value : data.val !== undefined ? data.val : data.data !== undefined ? data.data : data.item !== undefined ? data.item : data.element !== undefined ? data.element : data.doc !== undefined ? data.doc : data.document !== undefined ? data.document : data.content,
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
  table: z.unknown().optional().describe("Table name (Anti-Hallucination: Pass 'table', not 'tableName')"),
  tableName: z.unknown().optional().describe("Alias for table"),
  name: z.unknown().optional().describe("Alias for table"),
  tbl: z.unknown().optional().describe("Alias for table"),
  table_name: z.unknown().optional().describe("Alias for table"),
  column: z.unknown().optional().describe("JSON column name"),
  col: z.unknown().optional().describe("Alias for column"),
  columnName: z.unknown().optional().describe("Alias for column"),
  c: z.unknown().optional().describe("Alias for column"),
  paths: z.unknown().optional().describe("JSON paths to remove (Anti-Hallucination: Pass 'paths', not 'path' or 'keys')"),
  path: z.unknown().optional().describe("Alias for single path to remove"),
  keys: z.unknown().optional().describe("Alias for paths"),
  key: z.unknown().optional().describe("Alias for single path to remove"),
  where: z.unknown().optional().describe("WHERE clause to identify rows (REQUIRED. Anti-Hallucination: Pass 'where', not 'query' or 'sql')"),
  filter: z.unknown().optional().describe("Alias for where"),
  condition: z.unknown().optional().describe("Alias for where"),
  query: z.unknown().optional().describe("Alias for where"),
  sql: z.unknown().optional().describe("Alias for where"),
  idColumn: z.unknown().optional().describe("Alias for where (used with rowId)"),
  rowId: z.unknown().optional().describe("Alias for where (used with idColumn)"),
  id: z.unknown().optional().describe("Alias for where (used with idColumn)"),
});

export const JsonRemoveSchema = z
  .preprocess(
    preprocessJsonColumnParams,
    z.object({
      table: z.string().optional(),
      tableName: z.coerce.string().optional(),
      name: z.coerce.string().optional(),
      column: z.string().optional(),
      col: z.coerce.string().optional(),
      paths: z
        .union([
          z.array(
            z.string().regex(
              /^\$((?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)|(?:\."[^"]+")|(?:\[\s*\d+\s*\]))*$/,
              "Invalid JSON path expression (must start with $ and use valid path legs)",
            ),
          ),
          z.string().regex(
            /^\$((?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)|(?:\."[^"]+")|(?:\[\s*\d+\s*\]))*$/,
            "Invalid JSON path expression (must start with $ and use valid path legs)",
          ),
        ])
        .optional(),
      path: z.string().regex(/^\$((?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)|(?:\."[^"]+")|(?:\[\s*\d+\s*\]))*$/, "Invalid JSON path expression (must start with $ and use valid path legs. Wildcards are not supported for modification)").optional(),
      keys: z.union([z.array(z.string()), z.string()]).optional(),
      key: z.string().optional(),
      where: z.string().optional(),
      filter: z.coerce.string().optional(),
      condition: z.coerce.string().optional(),
      sql: z.coerce.string().optional(),
      query: z.coerce.string().optional(),
      columnName: z.coerce.string().optional(),
      id: z.unknown().optional(),
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
  table: z.unknown().optional().describe("Table name (REQUIRED. Anti-Hallucination: Pass 'table', not 'tableName')"),
  tableName: z.unknown().optional().describe("Alias for table"),
  name: z.unknown().optional().describe("Alias for table"),
  tbl: z.unknown().optional().describe("Alias for table"),
  table_name: z.unknown().optional().describe("Alias for table"),
  column: z.unknown().optional().describe("JSON column name (REQUIRED. Anti-Hallucination: Pass 'column', not 'col' or 'columnName')"),
  col: z.unknown().optional().describe("Alias for column"),
  columnName: z.unknown().optional().describe("Alias for column"),
  c: z.unknown().optional().describe("Alias for column"),
  path: z.unknown().optional().describe("JSON path to array (REQUIRED. Anti-Hallucination: Pass 'path', not 'key')"),
  key: z.unknown().optional().describe("Alias for path"),
  keys: z.unknown().optional().describe("Alias for path"),
  json_path: z.unknown().optional().describe("Alias for path"),
  jsonPath: z.unknown().optional().describe("Alias for path"),
  value: z.unknown().optional().describe("Value to append (REQUIRED. Anti-Hallucination: Pass 'value', not 'data' or 'item')"),
  val: z.unknown().optional().describe("Alias for value"),
  data: z.unknown().optional().describe("Alias for value"),
  item: z.unknown().optional().describe("Alias for value"),
  element: z.unknown().optional().describe("Alias for value"),
  document: z.unknown().optional().describe("Alias for value"),
  where: z.unknown().optional().describe("WHERE clause to identify rows (REQUIRED. Anti-Hallucination: Pass 'where', not 'query' or 'sql')"),
  filter: z.unknown().optional().describe("Alias for where"),
  condition: z.unknown().optional().describe("Alias for where"),
  query: z.unknown().optional().describe("Alias for where"),
  sql: z.unknown().optional().describe("Alias for where"),
  idColumn: z.unknown().optional().describe("Alias for where (used with rowId)"),
  rowId: z.unknown().optional().describe("Alias for where (used with idColumn)"),
  id: z.unknown().optional().describe("Alias for where (used with idColumn)"),
});

export const JsonArrayAppendSchema = z
  .preprocess(
    preprocessJsonColumnParams,
    z.object({
      table: z.string().optional(),
      tableName: z.coerce.string().optional(),
      name: z.coerce.string().optional(),
      column: z.string().optional(),
      col: z.coerce.string().optional(),
      path: z.string().regex(/^\$((?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)|(?:\."[^"]+")|(?:\[\s*\d+\s*\]))*$/, "Invalid JSON path expression (must start with $ and use valid path legs. Wildcards are not supported for modification)").optional(),
      key: z.string().optional(),
      keys: z.string().optional(),
      value: z.unknown().optional(),
      val: z.unknown().optional(),
      data: z.unknown().optional(),
      item: z.unknown().optional(),
      element: z.unknown().optional(),
      document: z.unknown().optional(),
      where: z.string().optional(),
      filter: z.coerce.string().optional(),
      condition: z.coerce.string().optional(),
      sql: z.coerce.string().optional(),
      query: z.coerce.string().optional(),
      columnName: z.coerce.string().optional(),
      id: z.unknown().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column ?? data.col ?? data.columnName ?? "",
    path: ensureJsonPath(data.path ?? data.key ?? data.keys),
    value: data.value !== undefined ? data.value : data.val !== undefined ? data.val : data.data !== undefined ? data.data : data.item !== undefined ? data.item : data.element !== undefined ? data.element : data.document,
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
  table: z.unknown().optional().describe("Table name (REQUIRED. Anti-Hallucination: Pass 'table', not 'tableName')"),
  tableName: z.unknown().optional().describe("Alias for table"),
  name: z.unknown().optional().describe("Alias for table"),
  tbl: z.unknown().optional().describe("Alias for table"),
  table_name: z.unknown().optional().describe("Alias for table"),
  column: z.unknown().optional().describe("JSON column name (REQUIRED. Anti-Hallucination: Pass 'column', not 'col' or 'columnName')"),
  col: z.unknown().optional().describe("Alias for column"),
  columnName: z.unknown().optional().describe("Alias for column"),
  c: z.unknown().optional().describe("Alias for column"),
  path: z.unknown().optional().describe("JSON path to update (REQUIRED. Anti-Hallucination: Pass 'path', not 'key')"),
  key: z.unknown().optional().describe("Alias for path"),
  keys: z.unknown().optional().describe("Alias for path"),
  json_path: z.unknown().optional().describe("Alias for path"),
  jsonPath: z.unknown().optional().describe("Alias for path"),
  value: z.unknown().optional().describe("New value (REQUIRED. Anti-Hallucination: Pass 'value', not 'val')"),
  val: z.unknown().optional().describe("Alias for value"),
  data: z.unknown().optional().describe("Alias for value"),
  item: z.unknown().optional().describe("Alias for value"),
  element: z.unknown().optional().describe("Alias for value"),
  doc: z.unknown().optional().describe("Alias for value"),
  document: z.unknown().optional().describe("Alias for value"),
  content: z.unknown().optional().describe("Alias for value"),
  where: z.unknown().optional().describe("WHERE clause to identify rows (REQUIRED. Anti-Hallucination: Pass 'where', not 'query' or 'sql')"),
  filter: z.unknown().optional().describe("Alias for where"),
  condition: z.unknown().optional().describe("Alias for where"),
  query: z.unknown().optional().describe("Alias for where"),
  sql: z.unknown().optional().describe("Alias for where"),
  idColumn: z.unknown().optional().describe("Alias for where (used with rowId)"),
  rowId: z.unknown().optional().describe("Alias for where (used with idColumn)"),
  id: z.unknown().optional().describe("Alias for where (used with idColumn)"),
});

export const JsonUpdateSchema = z
  .preprocess(
    preprocessJsonColumnParams,
    z.object({
      table: z.string().optional(),
      tableName: z.coerce.string().optional(),
      name: z.coerce.string().optional(),
      column: z.string().optional(),
      col: z.coerce.string().optional(),
      path: z.string().regex(/^\$((?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)|(?:\."[^"]+")|(?:\[\s*\d+\s*\]))*$/, "Invalid JSON path expression (must start with $ and use valid path legs. Wildcards are not supported for modification)").optional(),
      value: z.unknown().optional(),
      val: z.unknown().optional(),
      data: z.unknown().optional(),
      item: z.unknown().optional(),
      element: z.unknown().optional(),
      doc: z.unknown().optional(),
      document: z.unknown().optional(),
      content: z.unknown().optional(),
      where: z.string().optional(),
      filter: z.coerce.string().optional(),
      condition: z.coerce.string().optional(),
      sql: z.coerce.string().optional(),
      query: z.coerce.string().optional(),
      columnName: z.coerce.string().optional(),
      id: z.unknown().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column ?? data.col ?? data.columnName ?? "",
    path: ensureJsonPath(data.path),
    value: data.value !== undefined ? data.value : data.val !== undefined ? data.val : data.data !== undefined ? data.data : data.item !== undefined ? data.item : data.element !== undefined ? data.element : data.doc !== undefined ? data.doc : data.document !== undefined ? data.document : data.content,
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
