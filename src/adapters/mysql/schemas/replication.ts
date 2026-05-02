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
      "Maximum events to return (default: 10). Set higher for more events.",
    ),
});

export const BinlogEventsSchema = z.object({
  logFile: z.string().optional().describe("Binlog file name"),
  position: z.number().optional().describe("Starting position"),
  limit: z
    .number()
    .nonnegative()
    .optional()
    .default(10)
    .describe(
      "Maximum events to return (default: 10). Set higher for more events.",
    ),
});
