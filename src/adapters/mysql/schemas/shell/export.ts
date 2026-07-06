import { z } from "zod";

export const ShellExportTableInputSchemaBase = z
  .object({
    schema: z.string().optional().describe("Source schema (database) name"),
    database: z.string().optional().describe("Alias for schema"),
    table: z.string().optional().describe("Table name to export"),
    tableName: z.string().optional().describe("Alias for table"),
    name: z.string().optional().describe("Alias for table"),
    outputPath: z
      .string()
      .optional()
      .describe("Output file path (absolute path recommended)"),
    outputUrl: z.string().optional().describe("Alias for outputPath"),
    path: z.string().optional().describe("Alias for outputPath"),
    file: z.string().optional().describe("Alias for outputPath"),
    filepath: z.string().optional().describe("Alias for outputPath"),
    url: z.string().optional().describe("Alias for outputPath"),
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

export const ShellExportTableInputSchema = z.preprocess(
  (val: unknown) => {
    if (val === undefined || val === null || typeof val !== "object") return val;
    const obj = val as { schema?: unknown; database?: unknown; table?: unknown; tableName?: unknown; name?: unknown; where?: unknown; filter?: unknown; outputPath?: unknown; outputUrl?: unknown; path?: unknown; file?: unknown; filepath?: unknown; url?: unknown };
    const rawSchema = obj.schema ?? obj.database;
    const rawTable = obj.table ?? obj.tableName ?? obj.name;
    const finalWhere = obj.where ?? obj.filter;
    return {
      ...obj,
      schema:
        typeof rawSchema === "number" || typeof rawSchema === "boolean"
          ? String(rawSchema)
          : rawSchema,
      table:
        typeof rawTable === "number" || typeof rawTable === "boolean"
          ? String(rawTable)
          : rawTable,
      where: finalWhere,
      outputPath: obj.outputPath ?? obj.outputUrl ?? obj.path ?? obj.file ?? obj.filepath ?? obj.url,
    };
  },
  ShellExportTableInputSchemaBase
).refine((data) => data.table != null && data.table !== "", { message: "table is required" })
 .refine((data) => data.outputPath != null && data.outputPath !== "", { message: "outputPath is required" });
