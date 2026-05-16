import { z } from "zod";

// =============================================================================
// Replication Schemas
// =============================================================================

export const BinlogEventsSchemaBase = z.object({
  logFile: z.unknown().optional().describe("Binlog file name"),
  position: z.unknown().optional().describe("Starting position"),
  limit: z
    .unknown()
    .optional()
    .describe(
      "Maximum events to return (default: 5). Set higher for more events.",
    ),
});

export const BinlogEventsSchema = z.object({
  logFile: z
    .string()
    .min(1, "Invalid logFile: cannot be an empty string")
    .optional()
    .describe("Binlog file name"),
  position: z.number().optional().describe("Starting position"),
  limit: z
    .number()
    .nonnegative()
    .max(50, "Limit capped at 50 to prevent payload exhaustion")
    .optional()
    .default(5)
    .describe(
      "Maximum events to return (default: 5, max: 50). Set higher for more events.",
    ),
});
