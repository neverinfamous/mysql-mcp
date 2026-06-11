import { z } from "zod";
import { preprocessJsonColumnParams } from "../preprocess-utils.js";

// --- CollationConvert ---
export const CollationConvertSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("Column name"),
  col: z.string().optional().describe("Alias for column"),
  charset: z.string().describe("Target character set (e.g., utf8mb4)"),
  targetCharset: z.string().optional().describe("Alias for charset"),
  collation: z.string().optional().describe("Target collation"),
  where: z
    .string()
    .optional()
    .describe("Additional WHERE clause for filtering"),
  filter: z.string().optional().describe("Alias for where"),
  limit: z.unknown().optional().describe("Maximum number of rows to return"),
});

export const CollationConvertSchema = z
  .preprocess(
    (val) => {
      const v1 = preprocessJsonColumnParams(val);
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
      return v1;
    },
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
      limit: z.coerce.number().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column ?? data.col ?? "",
    charset: data.charset,
    collation: data.collation,
    where: data.where ?? data.filter,
    limit: data.limit,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or col alias) is required",
  })
  .refine(
    (data) =>
      data.limit === undefined || (!Number.isNaN(data.limit) && data.limit > 0),
    { message: "Validation error: limit must be a positive number" },
  );
