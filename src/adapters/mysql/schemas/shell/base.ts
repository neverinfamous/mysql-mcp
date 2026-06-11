import { z } from "zod";

/**
 * Coerce string booleans to boolean type for MCP compatibility
 */
export const booleanCoerce = z
  .union([z.boolean(), z.string()])
  .transform((val) => {
    if (typeof val === "boolean") return val;
    return val.toLowerCase() === "true" || val === "1";
  });

/**
 * Base parameters common to shell tools
 */
export const ShellToolBaseSchema = z.object({
  format: z
    .enum(["text", "json", "table", "csv", "tsv", "vertical"])
    .optional()
    .default("text")
    .describe("Output format"),
});
