/**
 * mysql-mcp — Metric Model Classes
 *
 * In-memory streaming aggregators for tools, resources, cache, and Redis.
 * Uses a zero-dependency circular buffer to estimate latency percentiles
 * (p50, p95, p99) without memory bloat.
 *
 * These models are OTel-free — OpenTelemetry recording is handled by the
 * MetricsRegistry orchestrator, keeping these classes as pure data aggregators.
 */

import { MAX_SAMPLES } from "./types.js";
import type { MetricSummary, ResourceMetricSummary } from "./types.js";

// ---------------------------------------------------------------------------
// ToolMetric
// ---------------------------------------------------------------------------

export class ToolMetric {
  public calls = 0;
  public errors: Record<string, number> = {};
  public errorCategories: Record<string, number> = {};
  public tokens = 0;

  // Circular buffer for latency samples
  private samples: number[] = new Array<number>(MAX_SAMPLES).fill(0);
  private sampleIndex = 0;
  private sampleCount = 0;

  /** True if this process has recorded at least one tool call into the buffer. */
  hasLocalActivity(): boolean {
    return this.sampleCount > 0;
  }

  record(
    durationMs: number,
    success: boolean,
    tokens = 0,
    errorType?: string,
    errorCategory?: string,
  ): void {
    this.calls++;
    if (!success) {
      const type = errorType ?? "unknown";
      this.errors[type] = (this.errors[type] ?? 0) + 1;
      const cat = errorCategory ?? "unknown";
      this.errorCategories[cat] = (this.errorCategories[cat] ?? 0) + 1;
    }
    this.tokens += tokens;

    this.samples[this.sampleIndex] = durationMs;
    this.sampleIndex = (this.sampleIndex + 1) % MAX_SAMPLES;
    if (this.sampleCount < MAX_SAMPLES) {
      this.sampleCount++;
    }
  }

  // Historical loaded percentiles for stdio-based background export
  public loaded_p50 = 0;
  public loaded_p95 = 0;
  public loaded_p99 = 0;

  getSummary(): MetricSummary {
    if (this.sampleCount === 0) {
      return {
        calls: this.calls,
        errors: this.errors,
        tokens: this.tokens,
        p50: this.loaded_p50,
        p95: this.loaded_p95,
        p99: this.loaded_p99,
      };
    }

    // Sort active samples to calculate percentiles
    const activeSamples = this.samples
      .slice(0, this.sampleCount)
      .sort((a, b) => a - b);

    return {
      calls: this.calls,
      errors: this.errors,
      tokens: this.tokens,
      p50: this.getPercentile(activeSamples, 0.5),
      p95: this.getPercentile(activeSamples, 0.95),
      p99: this.getPercentile(activeSamples, 0.99),
    };
  }

  private getPercentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const idx = (sorted.length - 1) * p;
    const base = Math.floor(idx);
    const rest = idx - base;
    const v0 = sorted[base] ?? 0;
    const v1 = sorted[base + 1];

    if (v1 !== undefined) {
      return Math.round(v0 + rest * (v1 - v0));
    } else {
      return v0;
    }
  }
}

// ---------------------------------------------------------------------------
// ResourceMetric
// ---------------------------------------------------------------------------

export class ResourceMetric {
  public reads = 0;
  private localReads = 0;

  record(): void {
    this.reads++;
    this.localReads++;
  }

  hasLocalActivity(): boolean {
    return this.localReads > 0;
  }

  getSummary(): ResourceMetricSummary {
    return { reads: this.reads };
  }
}

// ---------------------------------------------------------------------------
// CacheMetric
// ---------------------------------------------------------------------------

export class CacheMetric {
  public hits = 0;
  public misses = 0;

  recordHit(): void {
    this.hits++;
  }

  recordMiss(): void {
    this.misses++;
  }

  getSummary(): { hits: number; misses: number } {
    return { hits: this.hits, misses: this.misses };
  }
}

// ---------------------------------------------------------------------------
// RedisMetric
// ---------------------------------------------------------------------------

export class RedisMetric {
  public rateLimitExceeded = 0;
  public fallbackToMemory = 0;
  public connected = false;

  // Circular buffer for Lua eval latency samples
  private samples: number[] = new Array<number>(MAX_SAMPLES).fill(0);
  private sampleIndex = 0;
  private sampleCount = 0;

  recordRateLimitExceeded(): void {
    this.rateLimitExceeded++;
  }

  recordFallback(): void {
    this.fallbackToMemory++;
  }

  recordLuaEvalLatency(durationMs: number): void {
    this.samples[this.sampleIndex] = durationMs;
    this.sampleIndex = (this.sampleIndex + 1) % MAX_SAMPLES;
    if (this.sampleCount < MAX_SAMPLES) {
      this.sampleCount++;
    }
  }

  setConnected(state: boolean): void {
    this.connected = state;
  }

  getLuaEvalP95(): number {
    if (this.sampleCount === 0) return 0;
    const active = this.samples
      .slice(0, this.sampleCount)
      .sort((a, b) => a - b);
    const idx = Math.floor((active.length - 1) * 0.95);
    return active[idx] ?? 0;
  }

  getSummary(): {
    rateLimitExceeded: number;
    fallbackToMemory: number;
    connected: boolean;
    luaEvalP95: number;
  } {
    return {
      rateLimitExceeded: this.rateLimitExceeded,
      fallbackToMemory: this.fallbackToMemory,
      connected: this.connected,
      luaEvalP95: this.getLuaEvalP95(),
    };
  }
}
