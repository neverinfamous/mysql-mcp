import { z } from "zod";
import { defaultToEmpty } from "../preprocess-utils.js";

// --- CollationConvert ---
export const CollationConvertSchemaBase = z.object({
  table: z.string().optional().describe("Table name (Note: Pass a table name, not a raw string) (Required)"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  tbl: z.string().optional().describe("Alias for table"),
  table_name: z.string().optional().describe("Alias for table"),
  column: z.union([z.array(z.string()), z.string()]).optional().describe("Column name (Note: Pass a column name, not a raw string) (Required)"),
  cols: z.union([z.array(z.string()), z.string()]).optional().describe("Alias for column"),
  columns: z.union([z.array(z.string()), z.string()]).optional().describe("Alias for column"),
  col: z.union([z.array(z.string()), z.string()]).optional().describe("Alias for column"),
  charset: z.string().optional().describe("Target character set (e.g., utf8mb4) (Required)"),
  targetCharset: z.string().optional().describe("Alias for charset"),
  collation: z.string().optional().describe("Target collation"),
  targetCollation: z.string().optional().describe("Alias for collation"),
  alias: z.string().optional().describe("Result column name (default: converted_value)"),
  as: z.string().optional().describe("Alias for alias"),
  where: z
    .string()
    .optional()
    .describe("Additional WHERE clause for filtering"),
  filter: z.string().optional().describe("Alias for where"),
  includeSourceColumn: z
    .union([z.boolean(), z.string()])
    .optional()
    .default(false)
    .describe(
      "Include source column in output (default: false). Set to true for full context.",
    ),
  limit: z.union([z.string(), z.number()]).optional().describe("Maximum number of rows to return (default: 50)"),
});

export const CollationConvertSchema = z
  .preprocess(
    (val) => {
      const v1 = defaultToEmpty(val);
      // Alias targetCharset to charset
      if (
        v1 !== null &&
        typeof v1 === "object" &&
        "targetCharset" in v1 &&
        !("charset" in v1)
      ) {
        (v1 as Record<string, unknown>)["charset"] = (
          v1 as Record<string, unknown>
        )["targetCharset"];
      }
      // Alias targetCollation to collation
      if (
        v1 !== null &&
        typeof v1 === "object" &&
        "targetCollation" in v1 &&
        !("collation" in v1)
      ) {
        (v1 as Record<string, unknown>)["collation"] = (
          v1 as Record<string, unknown>
        )["targetCollation"];
      }
      return v1;
    },
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      tbl: z.string().optional(),
      table_name: z.string().optional(),
      column: z.union([z.array(z.string()), z.string()]).transform(v => Array.isArray(v) ? (typeof v[0] === "string" && v[0].includes(",") ? (v[0].split(",")[0] || v[0]).trim() : v[0]) : (typeof v === "string" && v.includes(",") ? (v.split(",")[0] || v).trim() : v)).optional(),
      cols: z.union([z.array(z.string()), z.string()]).transform(v => Array.isArray(v) ? (typeof v[0] === "string" && v[0].includes(",") ? (v[0].split(",")[0] || v[0]).trim() : v[0]) : (typeof v === "string" && v.includes(",") ? (v.split(",")[0] || v).trim() : v)).optional(),
      columns: z.union([z.array(z.string()), z.string()]).transform(v => Array.isArray(v) ? (typeof v[0] === "string" && v[0].includes(",") ? (v[0].split(",")[0] || v[0]).trim() : v[0]) : (typeof v === "string" && v.includes(",") ? (v.split(",")[0] || v).trim() : v)).optional(),
      col: z.union([z.array(z.string()), z.string()]).transform(v => Array.isArray(v) ? (typeof v[0] === "string" && v[0].includes(",") ? (v[0].split(",")[0] || v[0]).trim() : v[0]) : (typeof v === "string" && v.includes(",") ? (v.split(",")[0] || v).trim() : v)).optional(),
      charset: z.string().optional(),
      targetCharset: z.string().optional(),
      collation: z.string().optional(),
      targetCollation: z.string().optional(),
      alias: z.string().optional(),
      as: z.string().optional(),
      where: z.string().optional(),
      filter: z.string().optional(),
      includeSourceColumn: z.union([z.boolean(), z.string()]).transform(v => v === "true" || v === true).optional().default(false),
      limit: z.coerce.number().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? data.tbl ?? data.table_name ?? "",
    column: data.column ?? data.cols ?? data.columns ?? data.col ?? "",
    charset: data.charset ?? "",
    collation: data.collation ?? data.targetCollation,
    alias: data.alias ?? data.as ?? "converted_value",
    where: data.where || data.filter || undefined,
    includeSourceColumn: data.includeSourceColumn,
    limit: data.limit,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or col alias) is required",
  })
  .refine((data) => data.charset !== "", {
    message: "charset (or targetCharset alias) is required",
  })
  .refine(
    (data) =>
      data.limit === undefined ||
      (!Number.isNaN(data.limit) && Number.isInteger(data.limit) && data.limit > 0),
    { message: "limit must be a positive integer" },
  );
