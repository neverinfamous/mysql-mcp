import { z } from "zod";
import { BaseOutputSchema } from "./output-schemas.js";
import { preprocessBinlogEventsParams } from "./preprocess-utils.js";

// =============================================================================
// Replication Schemas
// =============================================================================

export const BinlogEventsSchemaBase = z.object({
  logFile: z.string().optional().describe("Binlog file name"),
  file: z.string().optional().describe("Alias for logFile"),
  filename: z.string().optional().describe("Alias for logFile"),
  fileName: z.string().optional().describe("Alias for logFile"),
  binlog: z.string().optional().describe("Alias for logFile"),
  log_file: z.string().optional().describe("Alias for logFile"),
  name: z.string().optional().describe("Alias for logFile"),
  position: z.unknown().optional().describe("Starting position"),
  pos: z.unknown().optional().describe("Alias for position"),
  start: z.unknown().optional().describe("Alias for position"),
  limit: z
    .unknown()
    .optional()
    .describe(
      "Maximum events to return (default: 5). Set higher for more events.",
    ),
}).strict();

export const BinlogEventsSchema = z.preprocess(
  preprocessBinlogEventsParams,
  z.object({
    logFile: z
      .string()
      .min(1, "Invalid logFile: cannot be an empty string")
      .optional()
      .describe("Binlog file name (aliases: file, filename, fileName, binlog)"),
    position: z
      .coerce
      .number()
      .int("Invalid position: must be an integer")
      .nonnegative("Invalid position: must be greater than or equal to 0")
      .optional()
      .describe("Starting position (alias: pos)"),
    limit: z
      .coerce
      .number()
      .int("Invalid limit: must be an integer")
      .nonnegative()
      .max(50, "Limit capped at 50 to prevent payload exhaustion")
      .optional()
      .default(5)
      .describe(
        "Maximum events to return (default: 5, max: 50). Set higher for more events.",
      ),
  }).strict()
);

export const MasterStatusOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    status: z.record(z.string(), z.unknown()).optional(),
  }).loose().optional(),
});

export const SlaveStatusOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    status: z.record(z.string(), z.unknown()).optional(),
    configured: z.boolean().optional(),
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
    lagSeconds: z.union([z.number(), z.null()]).optional(),
    ioRunning: z.string().nullish(),
    sqlRunning: z.string().nullish(),
    lastError: z.string().nullish(),
  }).loose().optional(),
});
