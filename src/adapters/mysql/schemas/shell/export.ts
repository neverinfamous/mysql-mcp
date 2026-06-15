import { z } from "zod";

export const ShellExportTableInputSchemaBase = z
  .object({
    schema: z.string().optional().describe("Source schema (database) name"),
    table: z.string().optional().describe("Table name to export"),
    tableName: z.string().optional().describe("Alias for table"),
    name: z.string().optional().describe("Alias for table"),
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
    filter: z.string().optional().describe("Alias for where"),
  })
  .describe("Export table to file using util.exportTable()");

export const ShellExportTableInputSchema = z
  .object({
    schema: z.unknown().optional(),
    table: z.unknown().optional(),
    tableName: z.unknown().optional(),
    name: z.unknown().optional(),
    outputPath: z.string().optional(),
    outputUrl: z.string().optional(),
    format: z.enum(["csv", "tsv"]).optional().default("csv"),
    where: z.string().optional(),
    filter: z.string().optional(),
  })
  .transform((data) => {
    const rawTable = data.table ?? data.tableName ?? data.name;
    const finalWhere = data.where ?? data.filter;
    return {
      ...data,
      schema:
        typeof data.schema === "string"
          ? data.schema
          : typeof data.schema === "number" || typeof data.schema === "boolean"
            ? String(data.schema)
            : "",
      table:
        typeof rawTable === "string"
          ? rawTable
          : typeof rawTable === "number" || typeof rawTable === "boolean"
            ? String(rawTable)
            : "",
      where: finalWhere,
    };
  })
  .refine((data) => data.schema !== "", { message: "schema must not be empty" })
  .refine((data) => data.table !== "", { message: "table must not be empty" });
