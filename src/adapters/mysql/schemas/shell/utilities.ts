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

export const ShellCheckUpgradeInputSchema = z.preprocess(
  (val: unknown) => {
    if (val === undefined || val === null || typeof val !== "object") return val;
    const obj = val as { targetVersion?: unknown };
    return {
      ...obj,
      targetVersion:
        obj.targetVersion === undefined
          ? undefined
          : typeof obj.targetVersion === "string" || typeof obj.targetVersion === "number" || typeof obj.targetVersion === "boolean"
            ? String(obj.targetVersion)
            : obj.targetVersion,
    };
  },
  ShellCheckUpgradeInputSchemaBase
);
