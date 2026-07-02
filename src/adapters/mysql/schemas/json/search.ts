import { z } from "zod";
import { preprocessJsonColumnParams } from "../preprocess-utils.js";

// --- JsonContains ---
export const JsonContainsSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("JSON column name"),
  col: z.string().optional().describe("Alias for column"),
  value: z.unknown().optional().describe("Value to search for"),
  contains: z.unknown().optional().describe("Alias for value"),
  path: z.string().optional().describe("Optional JSON path to search within"),
  where: z.string().optional().describe("Optional WHERE clause"),
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
      path: z.string().optional(),
      where: z.string().optional(),
      filter: z.string().optional(),
      limit: z.number().optional(),
      sql: z.string().optional(),
      query: z.string().optional(),
      condition: z.string().optional(),
      columnName: z.string().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column ?? data.col ?? "",
    value: data.value ?? data.contains,
    path: data.path,
    where: data.where ?? data.filter,
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
  mode: z
    .enum(["one", "all"])
    .optional()
    .default("one")
    .describe("Search mode"),
  limit: z.unknown().optional().describe("Maximum rows to return"),
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
      mode: z.enum(["one", "all"]).optional().default("one"),
      limit: z.number().optional(),
      sql: z.string().optional(),
      query: z.string().optional(),
      condition: z.string().optional(),
      columnName: z.string().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column ?? data.col ?? "",
    searchValue: data.searchValue,
    mode: data.mode,
    limit: data.limit,
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
