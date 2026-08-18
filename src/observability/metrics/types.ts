/**
 * mysql-mcp — Observability Types & Schemas
 *
 * Shared type definitions, Zod validation schemas, and constants
 * used across the metrics subsystem modules.
 */

import { z } from "zod";
import type { PoolStats } from "../../types/modules/database.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum number of latency samples retained in the circular buffer. */
export const MAX_SAMPLES = 1000;

// ---------------------------------------------------------------------------
// Summary Interfaces
// ---------------------------------------------------------------------------

export interface MetricSummary {
  calls: number;
  errors: Record<string, number>;
  tokens: number;
  p50: number;
  p95: number;
  p99: number;
}

export interface ResourceMetricSummary {
  reads: number;
}

// ---------------------------------------------------------------------------
// JSONL Fallback State
// ---------------------------------------------------------------------------

export interface JsonlToolStats {
  calls: number;
  errors: number;
  tokens: number;
  durations: number[];
  errorTypes: Record<string, number>;
  errorCategories: Record<string, number>;
}

export interface JsonlState {
  offset: number;
  toolStats: Map<string, JsonlToolStats>;
  resourceStats: Map<string, { reads: number }>;
  poolStatsByPid: Map<number, PoolStats>;
}

// ---------------------------------------------------------------------------
// Zod Schemas — DB Row Validation
// ---------------------------------------------------------------------------

export const SnapshotRowSchema = z.object({
  tool: z.string(),
  max_calls: z.number(),
  max_errors: z.number(),
  max_tokens: z.number(),
  p50: z.number(),
  p95: z.number(),
  p99: z.number(),
  categories_json: z.string().nullable().optional(),
  errors_json: z.string().nullable().optional(),
});

/** Live aggregation from audit_logs rows newer than the last snapshot. */
export const LiveRowSchema = z.object({
  tool: z.string(),
  live_calls: z.number(),
  live_errors: z.number(),
  live_tokens: z.number(),
});

/**
 * Percentile results computed directly from audit_logs.durationMs via SQL
 * window functions. Nullable because MAX() on an empty partition returns NULL.
 */
export const PercentileRowSchema = z.object({
  tool: z.string(),
  p50: z.number().nullable(),
  p95: z.number().nullable(),
  p99: z.number().nullable(),
});

/** Cache metrics snapshot row. */
export const CacheSnapshotRowSchema = z.object({
  max_hits: z.number(),
  max_misses: z.number(),
});

/** Resource metrics snapshot row. */
export const ResourceSnapshotRowSchema = z.object({
  uri: z.string(),
  max_reads: z.number(),
});

// Re-export PoolStats for convenience
export type { PoolStats };
