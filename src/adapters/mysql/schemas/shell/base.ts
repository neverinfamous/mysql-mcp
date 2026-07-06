import { z } from "zod";

/**
 * Coerce string booleans to boolean type for MCP compatibility
 */
export const booleanCoerce = z.preprocess((val: unknown) => {
  if (typeof val === "string") {
    const lower = val.toLowerCase();
    if (lower === "true" || lower === "1") return true;
    if (lower === "false" || lower === "0") return false;
  }
  return val;
}, z.boolean());

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
