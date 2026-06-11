import { z } from "zod";

export const ShellExportTableInputSchemaBase = z
  .object({
    schema: z.string().optional().describe("Source schema (database) name"),
    table: z.string().optional().describe("Table name to export"),
    outputPath: z
      .string()
      .optional()
      .describe("Output file path (absolute path recommended)"),
    outputUrl: z.string().optional().describe("Alias for outputPath"),
    format: z
      .enum(["csv", "tsv"])
      .optional()
      .default("csv")
      .describe("Export format (csv or tsv)"),
    where: z
      .string()
      .optional()
      .describe("WHERE clause for filtering rows (without WHERE keyword)"),
  })
  .describe("Export table to file using util.exportTable()");

export const ShellExportTableInputSchema = z
  .object({
    schema: z.unknown().optional(),
    table: z.unknown().optional(),
    outputPath: z.string().optional(),
    outputUrl: z.string().optional(),
    format: z.enum(["csv", "tsv"]).optional().default("csv"),
    where: z.string().optional(),
  })
  .transform((data) => ({
    ...data,
    schema:
      data.schema === undefined
        ? ""
        : String(data.schema as string | number | boolean),
    table:
      data.table === undefined
        ? ""
        : String(data.table as string | number | boolean),
  }))
  .refine((data) => data.schema !== "", { message: "schema must not be empty" })
  .refine((data) => data.table !== "", { message: "table must not be empty" });
