import { z } from "zod";
import { preprocessJsonColumnParams, ensureJsonPath } from "../preprocess-utils.js";

// --- JsonContains ---
export const JsonContainsSchemaBase = z.object({
  table: z.unknown().optional().describe("Table name (Anti-Hallucination: Pass 'table', not 'tableName')"),
  tableName: z.unknown().optional().describe("Alias for table"),
  name: z.unknown().optional().describe("Alias for table"),
  column: z.unknown().optional().describe("JSON column name (Anti-Hallucination: Pass 'column', not 'col')"),
  col: z.unknown().optional().describe("Alias for column"),
  value: z.unknown().optional().describe("Value to search for (Anti-Hallucination: Pass 'value', not 'candidate')"),
  contains: z.unknown().optional().describe("Alias for value"),
  candidate: z.unknown().optional().describe("Alias for value"),
  target: z.unknown().optional().describe("Alias for value"),
  path: z.unknown().optional().describe("Optional JSON path to search within"),
  where: z.unknown().optional().describe("Optional WHERE clause (Anti-Hallucination: Pass 'where', not 'query' or 'sql')"),
  filter: z.unknown().optional().describe("Alias for where"),
  limit: z.unknown().optional().describe("Maximum rows to return"),
  sql: z.unknown().optional().describe("Alias for where"),
  query: z.unknown().optional().describe("Alias for where"),
  condition: z.unknown().optional().describe("Alias for where"),
  columnName: z.unknown().optional().describe("Alias for column"),
  idColumn: z.unknown().optional().describe("Alias for where (used with rowId)"),
  rowId: z.unknown().optional().describe("Alias for where (used with idColumn)"),
});

export const JsonContainsSchema = z
  .preprocess(
    preprocessJsonColumnParams,
    z.object({
      table: z.string().optional(),
      tableName: z.coerce.string().optional(),
      name: z.coerce.string().optional(),
      column: z.string().optional(),
      col: z.coerce.string().optional(),
      value: z.unknown().optional(),
      contains: z.unknown().optional(),
      candidate: z.unknown().optional(),
      target: z.unknown().optional(),
      path: z.string().regex(/^\$((?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)|(?:\."[^"]+")|(?:\[\s*\d+\s*\]))*$/, "Invalid JSON path expression (must start with $ and use valid path legs. Wildcards are not supported for JSON_CONTAINS)").optional(),
      where: z.string().optional(),
      filter: z.coerce.string().optional(),
      limit: z.coerce.number().int().positive().max(100).optional(),
      sql: z.coerce.string().optional(),
      query: z.coerce.string().optional(),
      condition: z.coerce.string().optional(),
      columnName: z.coerce.string().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column ?? data.col ?? data.columnName ?? "",
    value: data.value ?? data.contains ?? data.candidate ?? data.target,
    path: ensureJsonPath(data.path),
    where: (data.where ?? data.filter ?? data.query ?? data.sql ?? data.condition ?? "").trim(),
    limit: data.limit,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or col alias) is required",
  })
  .refine((data) => data.value !== undefined, {
    message: "value (or contains alias) is required",
  });

// --- JsonSearch ---
export const JsonSearchSchemaBase = z.object({
  table: z.unknown().optional().describe("Table name (Anti-Hallucination: Pass 'table', not 'tableName')"),
  tableName: z.unknown().optional().describe("Alias for table"),
  name: z.unknown().optional().describe("Alias for table"),
  column: z.unknown().optional().describe("JSON column name (Anti-Hallucination: Pass 'column', not 'col')"),
  col: z.unknown().optional().describe("Alias for column"),
  searchValue: z.unknown().optional().describe("String value to search for (Anti-Hallucination: Pass 'searchValue', not 'searchString' or 'value')"),
  searchString: z.unknown().optional().describe("Alias for searchValue"),
  searchStr: z.unknown().optional().describe("Alias for searchValue"),
  value: z.unknown().optional().describe("Alias for searchValue"),
  val: z.unknown().optional().describe("Alias for searchValue"),
  search: z.unknown().optional().describe("Alias for searchValue"),
  text: z.unknown().optional().describe("Alias for searchValue"),
  content: z.unknown().optional().describe("Alias for searchValue"),
  keyword: z.unknown().optional().describe("Alias for searchValue"),
  mode: z.unknown().optional().describe("Search mode: one or all"),
  searchMode: z.unknown().optional().describe("Alias for mode"),
  limit: z.unknown().optional().describe("Maximum rows to return"),
  path: z.unknown().optional().describe("Optional JSON path to search within"),
  jsonPath: z.unknown().optional().describe("Alias for path"),
  json_path: z.unknown().optional().describe("Alias for path"),
  key: z.unknown().optional().describe("Alias for path"),
  escapeChar: z.unknown().optional().describe("Optional escape character"),
  select: z.unknown().optional().describe("Comma-separated columns to select (defaults to '*')"),
  where: z.unknown().optional().describe("Optional WHERE clause to filter rows (Anti-Hallucination: Pass 'where', not 'filter' or 'query')"),
  filter: z.unknown().optional().describe("Alias for where"),
  sql: z.unknown().optional().describe("Alias for where"),
  query: z.unknown().optional().describe("Alias for where"),
  condition: z.unknown().optional().describe("Alias for where"),
  columnName: z.unknown().optional().describe("Alias for column"),
  idColumn: z.unknown().optional().describe("Alias for where (used with rowId)"),
  rowId: z.unknown().optional().describe("Alias for where (used with idColumn)"),
});

export const JsonSearchSchema = z
  .preprocess(
    preprocessJsonColumnParams,
    z.object({
      table: z.string().optional(),
      tableName: z.coerce.string().optional(),
      name: z.coerce.string().optional(),
      column: z.string().optional(),
      col: z.coerce.string().optional(),
      searchValue: z.string().optional(),
      searchString: z.coerce.string().optional(),
      searchStr: z.coerce.string().optional(),
      value: z.coerce.string().optional(),
      val: z.coerce.string().optional(),
      search: z.coerce.string().optional(),
      text: z.coerce.string().optional(),
      content: z.coerce.string().optional(),
      keyword: z.coerce.string().optional(),
      mode: z.coerce.string().optional(),
      searchMode: z.coerce.string().optional(),
      limit: z.coerce.number().int().positive().max(100).optional(),
      path: z.string().regex(/^\$((?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)|(?:\."[^"]+")|(?:\[\s*\d+\s*\])|(?:\.\*)|(?:\[\s*\*\s*\])|(?:\*\*))*$/, "Invalid JSON path expression (must start with $ and use valid path legs)").optional(),
      jsonPath: z.string().regex(/^\$((?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)|(?:\."[^"]+")|(?:\[\s*\d+\s*\])|(?:\.\*)|(?:\[\s*\*\s*\])|(?:\*\*))*$/, "Invalid JSON path expression (must start with $ and use valid path legs)").optional(),
      json_path: z.string().regex(/^\$((?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)|(?:\."[^"]+")|(?:\[\s*\d+\s*\])|(?:\.\*)|(?:\[\s*\*\s*\])|(?:\*\*))*$/, "Invalid JSON path expression (must start with $ and use valid path legs)").optional(),
      key: z.string().regex(/^\$((?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)|(?:\."[^"]+")|(?:\[\s*\d+\s*\])|(?:\.\*)|(?:\[\s*\*\s*\])|(?:\*\*))*$/, "Invalid JSON path expression (must start with $ and use valid path legs)").optional(),
      escapeChar: z.coerce.string().optional(),
      select: z.coerce.string().optional(),
      where: z.string().optional(),
      filter: z.coerce.string().optional(),
      sql: z.coerce.string().optional(),
      query: z.coerce.string().optional(),
      condition: z.coerce.string().optional(),
      columnName: z.coerce.string().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column ?? data.col ?? data.columnName ?? "",
    searchValue: data.searchValue ?? data.searchString ?? data.searchStr ?? data.value ?? data.val ?? data.search ?? data.text ?? data.content ?? data.keyword,
    mode: data.mode ?? data.searchMode ?? "one",
    limit: data.limit,
    path: ensureJsonPath(data.path ?? data.jsonPath ?? data.json_path ?? data.key),
    escapeChar: data.escapeChar,
    select: data.select,
    where: (data.where ?? data.filter ?? data.query ?? data.sql ?? data.condition)?.trim(),
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or col alias) is required",
  })
  .refine((data) => data.searchValue !== undefined && data.searchValue !== "", {
    message: "searchValue is required",
  })
  .refine((data) => data.mode === "one" || data.mode === "all", {
    message: "mode (or searchMode) must be 'one' or 'all'",
  })
  .refine((data) => data.escapeChar === undefined || data.escapeChar.length <= 1, {
    message: "escapeChar must be empty or one character",
  });
