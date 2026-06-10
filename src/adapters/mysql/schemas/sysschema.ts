/**
 * MySQL sys Schema Schemas
 */

import { z } from "zod";
import { BaseOutputSchema } from "./output-schemas.js";

// =============================================================================
// Output Schemas
// =============================================================================

export const SysRowsOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    rows: z.array(z.record(z.string(), z.unknown())),
    count: z.number(),
  }).loose().optional(),
});

// We can alias the same structure for clarity
export const SysUserSummaryOutputSchema = SysRowsOutputSchema;
export const SysHostSummaryOutputSchema = SysRowsOutputSchema;
export const SysStatementSummaryOutputSchema = SysRowsOutputSchema;
export const SysWaitSummaryOutputSchema = SysRowsOutputSchema;
export const SysIoSummaryOutputSchema = SysRowsOutputSchema;

export const SysSchemaStatsOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    tableStatistics: z.array(z.record(z.string(), z.unknown())),
    indexStatistics: z.array(z.record(z.string(), z.unknown())),
    autoIncrementStatus: z.array(z.record(z.string(), z.unknown())),
    tableStatisticsCount: z.number(),
    indexStatisticsCount: z.number(),
    autoIncrementStatusCount: z.number(),
    schemaName: z.string(),
  }).loose().optional(),
});

export const SysInnoDBLockWaitsOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    rows: z.array(z.record(z.string(), z.unknown())).optional(),
    count: z.number(),
    hasContention: z.boolean(),
  }).loose().optional(),
});

export const SysMemorySummaryOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    globalMemory: z.array(z.record(z.string(), z.unknown())),
    memoryByUser: z.array(z.record(z.string(), z.unknown())),
    globalMemoryCount: z.number(),
    memoryByUserCount: z.number(),
  }).loose().optional(),
});
