import { z } from "zod";
import { ShellToolBaseSchema } from "./base.js";

// --- ShellStatus ---
export const ShellStatusSchema = ShellToolBaseSchema.extend({
  extended: z
    .boolean()
    .optional()
    .default(false)
    .describe("Return extended status information including global variables"),
});

// --- ShellInfo ---
export const ShellInfoSchema = ShellToolBaseSchema.extend({
  detailed: z
    .boolean()
    .optional()
    .default(false)
    .describe("Return detailed environment information"),
});

// --- ShellVersion ---
export const ShellVersionInputSchema = ShellToolBaseSchema.extend({
  includeComponents: z
    .boolean()
    .optional()
    .default(true)
    .describe("Include component versions"),
});
