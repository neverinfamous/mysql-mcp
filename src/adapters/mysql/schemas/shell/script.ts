import { z } from "zod";

export const ShellRunScriptInputSchemaBase = z
  .object({
    script: z.string().optional().describe("Script content to execute"),
    language: z
      .enum(["js", "py", "sql", "javascript", "python"])
      .optional()
      .default("js")
      .describe("Script language (JavaScript, Python, or SQL)"),
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
    language: z
      .enum(["js", "py", "sql", "javascript", "python"])
      .optional()
      .default("js"),
    timeout: z.number().int().optional().default(60000),
  })
  .transform((data) => ({
    script:
      data.script === undefined
        ? ""
        : String(data.script as string | number | boolean),
    language: data.language,
    timeout: data.timeout,
  }))
  .refine((data) => data.script !== "", {
    message: "Script content cannot be empty",
  });
