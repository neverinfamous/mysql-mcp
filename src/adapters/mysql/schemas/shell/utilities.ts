import { z } from "zod";

export const ShellCheckUpgradeInputSchemaBase = z
  .object({
    targetVersion: z
      .string()
      .regex(/^\d+\.\d+\.\d+$/, "Target version must be a valid version string like '8.0.40'")
      .optional()
      .describe(
        'Target MySQL version to check compatibility for (e.g., "8.0.40", "8.4.0")',
      ),
    outputFormat: z.preprocess(
      (val) => (typeof val === "string" ? val.toUpperCase() : val),
      z.enum(["TEXT", "JSON"])
    )
      .optional()
      .default("JSON")
      .describe("Output format"),
  }).strict()
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
        typeof obj.targetVersion === "string" || typeof obj.targetVersion === "number"
          ? String(obj.targetVersion)
          : obj.targetVersion,
    };
  },
  ShellCheckUpgradeInputSchemaBase
);
