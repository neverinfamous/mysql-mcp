import { z } from "zod";

export const ShellCheckUpgradeInputSchemaBase = z
  .object({
    targetVersion: z
      .string()
      .optional()
      .describe(
        'Target MySQL version to check compatibility for (e.g., "8.0.40", "8.4.0")',
      ),
    outputFormat: z
      .enum(["TEXT", "JSON"])
      .optional()
      .default("JSON")
      .describe("Output format"),
  })
  .describe(
    "Check server upgrade compatibility using util.checkForServerUpgrade()",
  );

export const ShellCheckUpgradeInputSchema = z
  .object({
    targetVersion: z.unknown().optional(),
    outputFormat: z.enum(["TEXT", "JSON"]).optional().default("JSON"),
  })
  .transform((data) => ({
    targetVersion:
      data.targetVersion === undefined
        ? undefined
        : String(data.targetVersion as string | number | boolean),
    outputFormat: data.outputFormat,
  }));
