import { z } from "zod";
import { booleanCoerce, ShellToolBaseSchema } from "./base.js";

// --- ShellExecute ---
export const ShellExecuteSchema = ShellToolBaseSchema.extend({
  command: z.string().describe("MySQL Shell command or SQL query to execute"),
  language: z
    .enum(["sql", "javascript", "python"])
    .optional()
    .default("sql")
    .describe("Execution language context"),
  timeout: z
    .number()
    .optional()
    .describe("Execution timeout in milliseconds"),
  database: z
    .string()
    .optional()
    .describe("Optional database to switch to before execution"),
});

// --- ShellScript ---
export const ShellScriptSchema = ShellToolBaseSchema.extend({
  path: z.string().describe("Path to script file"),
  language: z
    .enum(["sql", "javascript", "python"])
    .optional()
    .describe("Script language (inferred from extension if omitted)"),
  arguments: z
    .array(z.string())
    .optional()
    .describe("Arguments to pass to the script"),
  timeout: z
    .number()
    .optional()
    .describe("Execution timeout in milliseconds"),
  interactive: booleanCoerce
    .optional()
    .default(false)
    .describe("Run script in interactive mode"),
});
