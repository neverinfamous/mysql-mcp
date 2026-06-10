import { z } from "zod";
import { ErrorResponseFields } from "./error-response-fields.js";

/** Metrics block injected by withTokenEstimate() */
export const MetricsFields = z
  .object({
    tokenEstimate: z
      .number()
      .describe("Estimated token count (~4 bytes per token)"),
  })
  .loose();

/**
 * Base output envelope — every tool output schema extends this.
 *
 * Usage:
 *   const MyToolOutputSchema = BaseOutputSchema.extend({
 *     data: z.object({ tableName: z.string() }).optional(),
 *   });
 */
export const BaseOutputSchema = z
  .object({
    success: z.boolean().describe("Whether the operation succeeded"),
    data: z.unknown().optional().describe("Operation-specific result payload"),
    error: z.string().optional().describe("Error message if operation failed"),
    metrics: MetricsFields.optional().describe("Token estimation metrics"),
  })
  .extend(ErrorResponseFields.shape);
