import { z } from "zod";
import { BaseOutputSchema } from "./output-schemas.js";

// =============================================================================
// Replication Schemas
// =============================================================================

export const BinlogEventsSchemaBase = z.object({
  logFile: z.string().optional().describe("Binlog file name"),
  position: z.number().optional().describe("Starting position"),
  limit: z
    .number()
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

export const MasterStatusOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    status: z.record(z.string(), z.unknown()).optional(),
  }).loose().optional(),
});

export const SlaveStatusOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    status: z.record(z.string(), z.unknown()).optional(),
  }).loose().optional(),
});

export const BinlogEventsOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    events: z.array(z.record(z.string(), z.unknown())),
  }).loose().optional(),
});

export const GtidStatusOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    gtidExecuted: z.unknown(),
    gtidPurged: z.unknown(),
    gtidMode: z.unknown(),
  }).loose().optional(),
});

export const ReplicationLagOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    lagSeconds: z.unknown(),
    ioRunning: z.unknown(),
    sqlRunning: z.unknown(),
    lastError: z.unknown(),
  }).loose().optional(),
});
