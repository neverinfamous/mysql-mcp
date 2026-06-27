import { z } from "zod";
import { booleanCoerce } from "./base.js";

export const ShellRunScriptInputSchemaBase = z
  .object({
    script: z.string().optional().describe("Script content to execute"),
    scriptPath: z.string().optional().describe("Path to script file to execute"),
    path: z.string().optional().describe("Alias for scriptPath"),
    language: z
      .enum(["js", "py", "sql", "javascript", "python"])
      .optional()
      .default("js")
      .describe("Script language (JavaScript, Python, or SQL)"),
    dryRun: booleanCoerce.optional().describe("If true, perform a dry run without executing"),
    timeout: z
      .number()
      .int()
      .min(1000)
      .max(3600000)
      .optional()
      .default(60000)
      .describe("Timeout in milliseconds (default: 60 seconds)"),
  })
  .describe("Execute JavaScript, Python, or SQL script via MySQL Shell");

export const ShellRunScriptInputSchema = z
  .object({
    script: z.unknown().optional(),
    scriptPath: z.string().optional(),
    path: z.string().optional(), // alias
    language: z
      .enum(["js", "py", "sql", "javascript", "python"])
      .optional()
      .default("js"),
    dryRun: booleanCoerce.optional(),
    timeout: z.number().int().optional().default(60000),
  })
  .transform((data) => ({
    script:
      data.script === undefined
        ? ""
        : String(data.script as string | number | boolean),
    scriptPath: data.scriptPath ?? data.path ?? "",
    language: data.language,
    dryRun: data.dryRun ?? false,
    timeout: data.timeout,
  }))
  .refine((data) => data.script !== "" || data.scriptPath !== "", {
    message: "Either script content or scriptPath must be provided",
  });
