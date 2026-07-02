import { z } from "zod";
import { ShellToolBaseSchema } from "./base.js";

// --- ShellStatus ---
export const ShellStatusSchemaBase = ShellToolBaseSchema.extend({
  extended: z
    .boolean()
    .optional()
    .default(false)
    .describe("Return extended status information including global variables"),
});

export const ShellStatusSchema = z.preprocess(
  (val: unknown) => {
    if (val === undefined || val === null || typeof val !== "object") return val;
    return val;
  },
  ShellStatusSchemaBase
);

// --- ShellInfo ---
export const ShellInfoSchemaBase = ShellToolBaseSchema.extend({
  detailed: z
    .boolean()
    .optional()
    .default(false)
    .describe("Return detailed environment information"),
});

export const ShellInfoSchema = z.preprocess(
  (val: unknown) => {
    if (val === undefined || val === null || typeof val !== "object") return val;
    return val;
  },
  ShellInfoSchemaBase
);

// --- ShellVersion ---
export const ShellVersionInputSchemaBase = ShellToolBaseSchema.extend({
  includeComponents: z
    .boolean()
    .optional()
    .default(true)
    .describe("Include component versions"),
});

export const ShellVersionInputSchema = z.preprocess(
  (val: unknown) => {
    if (val === undefined || val === null) return {};
    if (typeof val === "boolean") return { includeComponents: val };
    if (typeof val === "string") return { includeComponents: val === "true" || val === "1" };
    if (typeof val !== "object") return {};
    const obj = { ...(val as Record<string, unknown>) };
    if (typeof obj['includeComponents'] === "string") {
      obj['includeComponents'] = obj['includeComponents'] === "true" || obj['includeComponents'] === "1";
    }
    return obj;
  },
  ShellVersionInputSchemaBase
);
