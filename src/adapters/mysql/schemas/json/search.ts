import { z } from "zod";
import { preprocessJsonColumnParams } from "../preprocess-utils.js";

// --- JsonContains ---
export const JsonContainsSchemaBase = z.object({
  table: z.string().optional().describe("Table name (Anti-Hallucination: Pass 'table', not 'tableName')"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("JSON column name (Anti-Hallucination: Pass 'column', not 'col')"),
  col: z.string().optional().describe("Alias for column"),
  value: z.unknown().optional().describe("Value to search for (Anti-Hallucination: Pass 'value', not 'candidate')"),
  contains: z.unknown().optional().describe("Alias for value"),
  candidate: z.unknown().optional().describe("Alias for value"),
  target: z.unknown().optional().describe("Alias for value"),
  path: z.string().optional().describe("Optional JSON path to search within"),
  where: z.string().optional().describe("Optional WHERE clause (Anti-Hallucination: Pass 'where', not 'query' or 'sql')"),
  filter: z.string().optional().describe("Alias for where"),
  limit: z.unknown().optional().describe("Maximum rows to return"),
  sql: z.string().optional().describe("Alias for where"),
  query: z.string().optional().describe("Alias for where"),
  condition: z.string().optional().describe("Alias for where"),
  columnName: z.string().optional().describe("Alias for column"),
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
      value: z.unknown().optional(),
      contains: z.unknown().optional(),
      candidate: z.unknown().optional(),
      target: z.unknown().optional(),
      path: z.string().optional(),
      where: z.string().optional(),
      filter: z.string().optional(),
      limit: z.coerce.number().optional(),
      sql: z.string().optional(),
      query: z.string().optional(),
      condition: z.string().optional(),
      columnName: z.string().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column ?? data.col ?? data.columnName ?? "",
    value: data.value ?? data.contains ?? data.candidate ?? data.target,
    path: data.path,
    where: data.where ?? data.filter ?? data.query ?? data.sql ?? data.condition ?? "",
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
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("JSON column name"),
  col: z.string().optional().describe("Alias for column"),
  searchValue: z.unknown().optional().describe("String value to search for"),
  searchString: z.unknown().optional().describe("Alias for searchValue"),
  searchStr: z.unknown().optional().describe("Alias for searchValue"),
  value: z.unknown().optional().describe("Alias for searchValue"),
  val: z.unknown().optional().describe("Alias for searchValue"),
  mode: z
    .enum(["one", "all"])
    .optional()
    .default("one")
    .describe("Search mode"),
  limit: z.unknown().optional().describe("Maximum rows to return"),
  path: z.string().optional().describe("Optional JSON path to search within"),
  escapeChar: z.string().optional().describe("Optional escape character"),
  where: z.string().optional().describe("Optional WHERE clause to filter rows"),
  filter: z.string().optional().describe("Alias for where"),
  sql: z.string().optional().describe("Alias for where"),
  query: z.string().optional().describe("Alias for where"),
  condition: z.string().optional().describe("Alias for where"),
  columnName: z.string().optional().describe("Alias for column"),
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
      searchValue: z.unknown().optional(),
      searchString: z.unknown().optional(),
      searchStr: z.unknown().optional(),
      value: z.unknown().optional(),
      val: z.unknown().optional(),
      mode: z.enum(["one", "all"]).optional().default("one"),
      limit: z.coerce.number().optional(),
      path: z.string().optional(),
      escapeChar: z.string().optional(),
      where: z.string().optional(),
      filter: z.string().optional(),
      sql: z.string().optional(),
      query: z.string().optional(),
      condition: z.string().optional(),
      columnName: z.string().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column ?? data.col ?? data.columnName ?? "",
    searchValue: data.searchValue ?? data.searchString ?? data.searchStr ?? data.value ?? data.val,
    mode: data.mode,
    limit: data.limit,
    path: data.path,
    escapeChar: data.escapeChar,
    where: data.where ?? data.filter ?? data.query ?? data.sql ?? data.condition,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or col alias) is required",
  })
  .refine((data) => data.searchValue !== undefined && data.searchValue !== "", {
    message: "searchValue is required",
  });
