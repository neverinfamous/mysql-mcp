/**
 * mysql-mcp — Observability Metrics
 *
 * In-memory streaming metrics aggregator for tools and resources.
 * Uses a zero-dependency circular buffer to estimate latency percentiles
 * (p50, p95, p99) without memory bloat.
 */

import type { SystemDb } from "./system-db.js";
import { logger } from "../utils/logger.js";
import type { PoolStats } from "../types/modules/database.js";

const MAX_SAMPLES = 1000;

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

class ToolMetric {
  public calls = 0;
  public errors: Record<string, number> = {};
  public tokens = 0;

  // Circular buffer for latency samples
  private samples: number[] = new Array<number>(MAX_SAMPLES).fill(0);
  private sampleIndex = 0;
  private sampleCount = 0;

  record(durationMs: number, success: boolean, tokens = 0, errorType?: string): void {
    this.calls++;
    if (!success) {
      const type = errorType ?? "unknown";
      this.errors[type] = (this.errors[type] ?? 0) + 1;
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

import { z } from "zod";

const SnapshotRowSchema = z.object({
  tool: z.string(),
  max_calls: z.number(),
  max_errors: z.number(),
  max_tokens: z.number(),
  p50: z.number(),
  p95: z.number(),
  p99: z.number(),
});

class ResourceMetric {
  public reads = 0;

  record(): void {
    this.reads++;
  }

  getSummary(): ResourceMetricSummary {
    return { reads: this.reads };
  }
}

class CacheMetric {
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

class RedisMetric {
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
    const active = this.samples.slice(0, this.sampleCount).sort((a, b) => a - b);
    const idx = Math.floor((active.length - 1) * 0.95);
    return active[idx] ?? 0;
  }

  getSummary(): { rateLimitExceeded: number; fallbackToMemory: number; connected: boolean; luaEvalP95: number } {
    return {
      rateLimitExceeded: this.rateLimitExceeded,
      fallbackToMemory: this.fallbackToMemory,
      connected: this.connected,
      luaEvalP95: this.getLuaEvalP95(),
    };
  }
}

export class MetricsRegistry {
  private tools = new Map<string, ToolMetric>();
  private resources = new Map<string, ResourceMetric>();
  private cache = new CacheMetric();
  private redis = new RedisMetric();
  private systemDb: SystemDb | null = null;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private readonly startedAt = Date.now();
  private poolStatsProvider: (() => PoolStats) | null = null;

  setPoolStatsProvider(fn: () => PoolStats): void {
    this.poolStatsProvider = fn;
  }

  constructor() {
    // Pre-register known resources so they emit 0 on startup.
    // This is required for Datadog's monotonic_diff to calculate the first increment (0 -> 1).
    const knownResources = [
      "mysql://help",
      "mysql://help/core",
      "mysql://help/advanced",
      "mysql://audit",
      "mysql://metrics",
      "mysql://schema",
      "mysql://tables",
      "mysql://variables",
      "mysql://status",
      "mysql://processlist",
      "mysql://pool",
      "mysql://capabilities",
      "mysql://health",
      "mysql://performance",
      "mysql://indexes",
      "mysql://replication",
      "mysql://innodb",
      "mysql://events",
      "mysql://sysschema",
      "mysql://locks",
      "mysql://cluster",
      "mysql://spatial",
      "mysql://docstore",
      "mysql://insights"
    ];
    for (const uri of knownResources) {
      this.resources.set(uri, new ResourceMetric());
    }
  }

  setSystemDb(systemDb: SystemDb): void {
    this.systemDb = systemDb;
    // Defer the historical sync to ensure the MCP handshake completes first
    // without blocking the event loop during startup.
    setTimeout(() => {
      this.startHistoricalSync();
      this.startFlushTimer();
    }, 2000).unref();
  }

  private startHistoricalSync(): void {
    // Initial load
    this.loadHistorical();
    
    // Sync continuously so the background metrics server picks up tool calls
    // made by short-lived stdio processes
    setInterval(() => {
      this.loadHistorical();
    }, 5000).unref();
  }

  private loadHistorical(): void {
    if (!this.systemDb) return;
    try {
      const db = this.systemDb.getDb();
      // Load latest snapshots for each tool to initialize counters
      const rows = db
        .prepare(
          `
        SELECT tool, calls as max_calls, errors as max_errors, tokens as max_tokens, p50, p95, p99
        FROM metrics_snapshots
        WHERE id IN (SELECT MAX(id) FROM metrics_snapshots GROUP BY tool)
      `,
        )
        .all();

      const parsedRows = z.array(SnapshotRowSchema).parse(rows);

      for (const row of parsedRows) {
        let metric = this.tools.get(row.tool);
        if (!metric) {
          metric = new ToolMetric();
          this.tools.set(row.tool, metric);
        }
        metric.calls = Math.max(metric.calls, row.max_calls);
        // Load historical errors as a special category to avoid breaking the integer DB schema
        metric.errors["historical"] = Math.max((metric.errors["historical"] ?? 0), row.max_errors);
        metric.tokens = Math.max(metric.tokens, row.max_tokens);
        // Persist the latest recorded percentiles for background export
        metric.loaded_p50 = row.p50;
        metric.loaded_p95 = row.p95;
        metric.loaded_p99 = row.p99;
      }
      logger.info(`Loaded historical metrics for ${rows.length} tools`);

      // Load historical cache metrics
      const cacheRows = db
        .prepare(
          `
        SELECT hits as max_hits, misses as max_misses
        FROM cache_metrics_snapshots
        WHERE id = (SELECT MAX(id) FROM cache_metrics_snapshots)
      `,
        )
        .all();
      
      const parsedCacheRows = z.array(z.object({
        max_hits: z.number(),
        max_misses: z.number(),
      })).parse(cacheRows);

      const firstRow = parsedCacheRows[0];
      if (firstRow) {
        this.cache.hits = Math.max(this.cache.hits, firstRow.max_hits);
        this.cache.misses = Math.max(this.cache.misses, firstRow.max_misses);
      }

      // Load historical resource metrics
      const resourceRows = db
        .prepare(
          `
        SELECT uri, reads as max_reads
        FROM resource_metrics_snapshots
        WHERE id IN (SELECT MAX(id) FROM resource_metrics_snapshots GROUP BY uri)
      `,
        )
        .all();
      
      const ResourceSnapshotRowSchema = z.object({
        uri: z.string(),
        max_reads: z.number(),
      });
      
      const parsedResourceRows = z.array(ResourceSnapshotRowSchema).parse(resourceRows);
      
      for (const row of parsedResourceRows) {
        let metric = this.resources.get(row.uri);
        if (!metric) {
          metric = new ResourceMetric();
          this.resources.set(row.uri, metric);
        }
        metric.reads = Math.max(metric.reads, row.max_reads);
      }
    } catch (err) {
      logger.warn("Failed to load historical metrics", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private startFlushTimer(): void {
    if (this.flushTimer) clearInterval(this.flushTimer);
    // Flush metrics every 5 minutes
    this.flushTimer = setInterval(
      () => {
        this.flushToDb();
      },
      5 * 60 * 1000,
    );
    this.flushTimer.unref();
  }

  private flushToDb(): void {
    if (!this.systemDb) return;
    try {
      const db = this.systemDb.getDb();
      const stmt = db.prepare(`
        INSERT INTO metrics_snapshots (timestamp, tool, calls, errors, p50, p95, p99, tokens)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const timestamp = new Date().toISOString();
      const transaction = db.transaction(() => {
        for (const [name, metric] of this.tools.entries()) {
          const summary = metric.getSummary();
          const totalErrors = Object.values(summary.errors).reduce((sum, val) => sum + val, 0);
          stmt.run(
            timestamp,
            name,
            summary.calls,
            totalErrors,
            summary.p50,
            summary.p95,
            summary.p99,
            summary.tokens,
          );
        }
        
        const cacheSummary = this.cache.getSummary();
        const cacheStmt = db.prepare(`
          INSERT INTO cache_metrics_snapshots (timestamp, hits, misses)
          VALUES (?, ?, ?)
        `);
        cacheStmt.run(timestamp, cacheSummary.hits, cacheSummary.misses);

        const resourceStmt = db.prepare(`
          INSERT INTO resource_metrics_snapshots (timestamp, uri, reads)
          VALUES (?, ?, ?)
        `);
        for (const [uri, metric] of this.resources.entries()) {
          const summary = metric.getSummary();
          resourceStmt.run(timestamp, uri, summary.reads);
        }
      });
      transaction();
    } catch (err) {
      logger.warn("Failed to flush metrics to db", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  close(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.flushToDb();
  }

  recordToolCall(
    toolName: string,
    durationMs: number,
    success: boolean,
    tokens = 0,
    errorType?: string
  ): void {
    let metric = this.tools.get(toolName);
    if (!metric) {
      metric = new ToolMetric();
      this.tools.set(toolName, metric);
    }
    metric.record(durationMs, success, tokens, errorType);
  }

  recordResourceRead(uri: string): void {
    let metric = this.resources.get(uri);
    if (!metric) {
      metric = new ResourceMetric();
      this.resources.set(uri, metric);
    }
    metric.record();
  }

  recordCacheHit(): void {
    this.cache.recordHit();
  }

  recordCacheMiss(): void {
    this.cache.recordMiss();
  }

  recordRedisRateLimitExceeded(): void {
    this.redis.recordRateLimitExceeded();
  }

  recordRedisFallback(): void {
    this.redis.recordFallback();
  }

  recordRedisLuaEvalLatency(durationMs: number): void {
    this.redis.recordLuaEvalLatency(durationMs);
  }

  setRedisConnected(state: boolean): void {
    this.redis.setConnected(state);
  }

  getSummary(): Record<string, unknown> {
    const toolsSummary: Record<string, MetricSummary> = {};
    for (const [name, metric] of this.tools.entries()) {
      toolsSummary[name] = metric.getSummary();
    }

    const resourcesSummary: Record<string, ResourceMetricSummary> = {};
    for (const [uri, metric] of this.resources.entries()) {
      resourcesSummary[uri] = metric.getSummary();
    }

    return {
      tools: toolsSummary,
      resources: resourcesSummary,
      cache: this.cache.getSummary(),
      redis: this.redis.getSummary(),
      timestamp: new Date().toISOString(),
    };
  }

  toPrometheus(): string {
    // Reload from SQLite immediately before scraping to capture metrics from other stdio processes
    this.loadHistorical();

    const lines: string[] = [];

    lines.push("# HELP mysql_mcp_tool_calls_total Total tool calls");
    lines.push("# TYPE mysql_mcp_tool_calls_total counter");
    for (const [name, metric] of this.tools.entries()) {
      lines.push(`mysql_mcp_tool_calls_total{tool="${name}"} ${metric.getSummary().calls}`);
    }

    lines.push("# HELP mysql_mcp_tool_errors_total Total tool errors");
    lines.push("# TYPE mysql_mcp_tool_errors_total counter");
    for (const [name, metric] of this.tools.entries()) {
      const summary = metric.getSummary();
      for (const [errorType, count] of Object.entries(summary.errors)) {
        lines.push(`mysql_mcp_tool_errors_total{tool="${name}",error_type="${errorType}"} ${count}`);
      }
    }

    lines.push("# HELP mysql_mcp_tool_tokens_total Total tokens estimated");
    lines.push("# TYPE mysql_mcp_tool_tokens_total counter");
    for (const [name, metric] of this.tools.entries()) {
      lines.push(`mysql_mcp_tool_tokens_total{tool="${name}"} ${metric.getSummary().tokens}`);
    }

    lines.push("# HELP mysql_mcp_tool_latency_ms_p50 P50 Latency (ms)");
    lines.push("# TYPE mysql_mcp_tool_latency_ms_p50 gauge");
    for (const [name, metric] of this.tools.entries()) {
      lines.push(`mysql_mcp_tool_latency_ms_p50{tool="${name}"} ${metric.getSummary().p50}`);
    }

    lines.push("# HELP mysql_mcp_tool_latency_ms_p95 P95 Latency (ms)");
    lines.push("# TYPE mysql_mcp_tool_latency_ms_p95 gauge");
    for (const [name, metric] of this.tools.entries()) {
      lines.push(`mysql_mcp_tool_latency_ms_p95{tool="${name}"} ${metric.getSummary().p95}`);
    }

    lines.push("# HELP mysql_mcp_tool_latency_ms_p99 P99 Latency (ms)");
    lines.push("# TYPE mysql_mcp_tool_latency_ms_p99 gauge");
    for (const [name, metric] of this.tools.entries()) {
      lines.push(`mysql_mcp_tool_latency_ms_p99{tool="${name}"} ${metric.getSummary().p99}`);
    }

    // Derived: tokens per call
    lines.push("# HELP mysql_mcp_tool_tokens_per_call Average tokens per tool call");
    lines.push("# TYPE mysql_mcp_tool_tokens_per_call gauge");

    for (const [name, metric] of this.tools.entries()) {
      const summary = metric.getSummary();
      const labels = `{tool="${name}"}`;
      const avg = summary.calls > 0 ? Math.round(summary.tokens / summary.calls) : 0;
      lines.push(`mysql_mcp_tool_tokens_per_call${labels} ${avg}`);
    }

    // Resources
    lines.push("# HELP mysql_mcp_resource_reads_total Total resource reads");
    lines.push("# TYPE mysql_mcp_resource_reads_total counter");

    for (const [uri, metric] of this.resources.entries()) {
      const summary = metric.getSummary();
      const labels = `{resource="${uri}"}`;
      lines.push(`mysql_mcp_resource_reads_total${labels} ${summary.reads}`);
    }

    // Cache
    const cacheSummary = this.cache.getSummary();
    lines.push("# HELP mysql_mcp_cache_hits_total Total schema cache hits");
    lines.push("# TYPE mysql_mcp_cache_hits_total counter");
    lines.push(`mysql_mcp_cache_hits_total ${cacheSummary.hits}`);
    
    lines.push("# HELP mysql_mcp_cache_misses_total Total schema cache misses");
    lines.push("# TYPE mysql_mcp_cache_misses_total counter");
    lines.push(`mysql_mcp_cache_misses_total ${cacheSummary.misses}`);

    // Redis rate limiting
    const redisSummary = this.redis.getSummary();
    lines.push("# HELP mysql_mcp_redis_rate_limit_exceeded_total Code Mode rate limit rejections");
    lines.push("# TYPE mysql_mcp_redis_rate_limit_exceeded_total counter");
    lines.push(`mysql_mcp_redis_rate_limit_exceeded_total ${redisSummary.rateLimitExceeded}`);

    lines.push("# HELP mysql_mcp_redis_fallback_to_memory_total Redis fallback events to in-memory rate limiter");
    lines.push("# TYPE mysql_mcp_redis_fallback_to_memory_total counter");
    lines.push(`mysql_mcp_redis_fallback_to_memory_total ${redisSummary.fallbackToMemory}`);

    lines.push("# HELP mysql_mcp_redis_connected Whether Redis is currently connected");
    lines.push("# TYPE mysql_mcp_redis_connected gauge");
    lines.push(`mysql_mcp_redis_connected ${redisSummary.connected ? 1 : 0}`);

    lines.push("# HELP mysql_mcp_redis_lua_eval_latency_p95_ms P95 latency of Redis Lua rate limit eval (ms)");
    lines.push("# TYPE mysql_mcp_redis_lua_eval_latency_p95_ms gauge");
    lines.push(`mysql_mcp_redis_lua_eval_latency_p95_ms ${redisSummary.luaEvalP95}`);

    // Pool metrics
    if (this.poolStatsProvider) {
      const poolStats = this.poolStatsProvider();
      
      lines.push("# HELP mysql_mcp_pool_connections_total Total connection slots in pool");
      lines.push("# TYPE mysql_mcp_pool_connections_total gauge");
      lines.push(`mysql_mcp_pool_connections_total ${poolStats.total}`);
      
      lines.push("# HELP mysql_mcp_pool_connections_active Currently in-use connections");
      lines.push("# TYPE mysql_mcp_pool_connections_active gauge");
      lines.push(`mysql_mcp_pool_connections_active ${poolStats.active}`);
      
      lines.push("# HELP mysql_mcp_pool_connections_idle Available idle connections");
      lines.push("# TYPE mysql_mcp_pool_connections_idle gauge");
      lines.push(`mysql_mcp_pool_connections_idle ${poolStats.idle}`);
      
      lines.push("# HELP mysql_mcp_pool_queries_total Cumulative queries through pool");
      lines.push("# TYPE mysql_mcp_pool_queries_total counter");
      lines.push(`mysql_mcp_pool_queries_total ${poolStats.totalQueries}`);
    }

    // Server uptime
    lines.push("# HELP mysql_mcp_uptime_seconds Server uptime in seconds");
    lines.push("# TYPE mysql_mcp_uptime_seconds gauge");
    lines.push(`mysql_mcp_uptime_seconds ${Math.floor((Date.now() - this.startedAt) / 1000)}`);

    return lines.join("\n") + "\n";
  }
}

// Global singleton
export const metrics = new MetricsRegistry();
