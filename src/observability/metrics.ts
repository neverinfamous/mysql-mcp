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
import { TOOL_GROUPS } from "../filtering/tool-constants.js";
import * as fs from "fs";

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

  record(durationMs: number, success: boolean, tokens = 0, errorType?: string, errorCategory?: string): void {
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

// Live aggregation from audit_logs rows newer than the last snapshot.
// Used by loadHistorical() to close the 5-minute flush gap on the exporter.
const LiveRowSchema = z.object({
  tool: z.string(),
  live_calls: z.number(),
  live_errors: z.number(),
  live_tokens: z.number(),
});

// Percentile results computed directly from audit_logs.durationMs via SQL
// window functions. Nullable because MAX() on an empty partition returns NULL.
const PercentileRowSchema = z.object({
  tool: z.string(),
  p50: z.number().nullable(),
  p95: z.number().nullable(),
  p99: z.number().nullable(),
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
  private httpErrors: Record<string, number> = { "401": 0, "413": 0, "429": 0 };
  private jsonlState = { offset: 0, toolStats: new Map<string, { calls: number; errors: number; tokens: number; durations: number[] }>() };
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

    // Pre-register all known tools so they emit 0 on startup.
    // Required for Datadog's monotonic_diff to calculate the first increment (0 -> 1).
    const knownTools = Object.values(TOOL_GROUPS).flat();
    for (const toolName of knownTools) {
      this.tools.set(toolName, new ToolMetric());
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
    
    let db = null;
    try {
      db = this.systemDb.getDb();
    } catch {
      // If DB fails to initialize, db remains null
    }

    let parsedLiveRows: { tool: string; live_calls: number; live_errors: number; live_tokens: number; durations?: number[] }[] = [];
    let parsedLiveCategoryRows: { tool: string; category: string; cat_errors: number }[] = [];
    const snapshotCallBaselines = new Map<string, number>();
    const snapshotTokenBaselines = new Map<string, number>();
    const since = "1970-01-01T00:00:00.000Z";

    if (db) {
      try {

      // --- Phase 1: Snapshot baselines (max persisted value per tool) ---
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

      // Track per-tool snapshot baselines for live delta calculation in Phase 2.
      const snapshotCallBaselines = new Map<string, number>();
      const snapshotTokenBaselines = new Map<string, number>();

      for (const row of parsedRows) {
        let metric = this.tools.get(row.tool);
        if (!metric) {
          metric = new ToolMetric();
          this.tools.set(row.tool, metric);
        }
        metric.calls = Math.max(metric.calls, row.max_calls);
        // Load historical errors as a special category to avoid breaking the integer DB schema
        metric.errors["historical"] = Math.max((metric.errors["historical"] ?? 0), row.max_errors);
        metric.errorCategories["historical"] = Math.max((metric.errorCategories["historical"] ?? 0), row.max_errors);
        metric.tokens = Math.max(metric.tokens, row.max_tokens);
        // Persist the latest recorded percentiles for background export
        metric.loaded_p50 = row.p50;
        metric.loaded_p95 = row.p95;
        metric.loaded_p99 = row.p99;
        snapshotCallBaselines.set(row.tool, row.max_calls);
        snapshotTokenBaselines.set(row.tool, row.max_tokens);
      }

      // --- Phase 2: Live delta from audit_logs since the last snapshot ---
      // This closes the 5-minute flush gap on the exporter container, which
      // reads a DB written by IDE stdio processes but never flushes itself.
      // The combined total (snapshotBaseline + liveDelta) is computed each
      // call and compared via Math.max, keeping the result idempotent.
      const lastSnapshotResult = db
        .prepare(`SELECT MAX(timestamp) as last_ts FROM metrics_snapshots`)
        .get() as { last_ts: string | null };
      const since = lastSnapshotResult?.last_ts ?? "1970-01-01T00:00:00.000Z";

      const liveRows = db
        .prepare(
          `
        SELECT tool,
               COUNT(*) as live_calls,
               SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as live_errors,
               SUM(COALESCE(tokenEstimate, 0)) as live_tokens
        FROM audit_logs
        WHERE timestamp > ?
        GROUP BY tool
      `,
        )
        .all(since);

      parsedLiveRows = z.array(LiveRowSchema).parse(liveRows);

      const liveCategoryRows = db
        .prepare(
          `
        SELECT tool, category, COUNT(*) as cat_errors
        FROM audit_logs
        WHERE timestamp > ? AND success = 0
        GROUP BY tool, category
      `,
        )
        .all(since);

      parsedLiveCategoryRows = z.array(z.object({
        tool: z.string(),
        category: z.string(),
        cat_errors: z.number(),
      })).parse(liveCategoryRows);

      } catch (err) {
        logger.warn("Failed to load historical metrics from SQLite", { error: err instanceof Error ? err.message : String(err) });
      }
    }

    // 🛠️ AUTONOMOUS HEALING: Fallback to reading the JSONL file if SQLite audit_logs is empty
      // This is crucial for IDEs on Windows that fail to initialize SystemDb (due to native bindings)
      // but successfully write to mcp-audit.jsonl. The dockerized exporter can read the JSONL to bridge the gap.
      if (parsedLiveRows.length === 0) {
        try {
          const auditLogArgIndex = process.argv.indexOf('--audit-log');
          const jsonlPath = auditLogArgIndex !== -1 ? process.argv[auditLogArgIndex + 1] : process.env['AUDIT_LOG_PATH'];
          
          if (jsonlPath !== undefined && jsonlPath !== "" && fs.existsSync(jsonlPath)) {
            const stat = fs.statSync(jsonlPath);
            if (stat.size < this.jsonlState.offset) {
              this.jsonlState.offset = 0;
              this.jsonlState.toolStats.clear();
            }
            
            if (stat.size > this.jsonlState.offset) {
              const fd = fs.openSync(jsonlPath, 'r');
              const length = stat.size - this.jsonlState.offset;
              const buffer = Buffer.alloc(length);
              fs.readSync(fd, buffer, 0, length, this.jsonlState.offset);
              fs.closeSync(fd);
              this.jsonlState.offset = stat.size;
              
              const content = buffer.toString('utf8');
              const lines = content.split('\n').filter((l: string) => l !== "");
              
              for (const line of lines) {
                try {
                  const entry = JSON.parse(line) as Record<string, unknown>;
                  const entryType = typeof entry['type'] === 'string' ? entry['type'] : undefined;
                  const entryTool = typeof entry['tool'] === 'string' ? entry['tool'] : undefined;
                  const entryName = typeof entry['name'] === 'string' ? entry['name'] : undefined;
                  const toolName = entryTool ?? entryName;
                  
                  if (entryType === 'tool' || toolName !== undefined) {
                    if (toolName === undefined || toolName === "") continue;
                    const stats = this.jsonlState.toolStats.get(toolName) ?? { calls: 0, errors: 0, tokens: 0, durations: [] };
                    
                    const entryDuration = typeof entry['durationMs'] === 'number' ? entry['durationMs'] : undefined;
                    if (entryDuration !== undefined) stats.durations.push(entryDuration);
                    
                    // Only count entries after the last snapshot (to avoid double counting)
                    const entryTimestamp = typeof entry['timestamp'] === 'string' ? entry['timestamp'] : undefined;
                    if (entryTimestamp !== undefined && entryTimestamp <= since) {
                      this.jsonlState.toolStats.set(toolName, stats);
                      continue;
                    }
                    
                    stats.calls++;
                    if (entry['success'] === false) stats.errors++;
                    
                    const entryTokenEstimate = typeof entry['tokenEstimate'] === 'number' ? entry['tokenEstimate'] : undefined;
                    if (entryTokenEstimate !== undefined) stats.tokens += entryTokenEstimate;
                    
                    this.jsonlState.toolStats.set(toolName, stats);
                  }
                } catch {
                  // Ignore parse errors for individual lines
                }
              }
            }
            
            parsedLiveRows = Array.from(this.jsonlState.toolStats.entries()).map(([tool, stats]) => ({
              tool,
              live_calls: stats.calls,
              live_errors: stats.errors,
              live_tokens: stats.tokens,
              durations: stats.durations
            }));
          }
        } catch {
          // Ignore fallback errors
        }
      }

      for (const row of parsedLiveRows) {
        let metric = this.tools.get(row.tool);
        if (!metric) {
          metric = new ToolMetric();
          this.tools.set(row.tool, metric);
        }
        // Combine snapshot baseline with live delta for the true running total.
        // Using Math.max keeps this idempotent across repeated sync intervals.
        const callsBaseline = snapshotCallBaselines.get(row.tool) ?? 0;
        const tokensBaseline = snapshotTokenBaselines.get(row.tool) ?? 0;
        metric.calls = Math.max(metric.calls, callsBaseline + row.live_calls);
        metric.errors["live"] = Math.max(metric.errors["live"] ?? 0, row.live_errors);
        metric.tokens = Math.max(metric.tokens, tokensBaseline + row.live_tokens);
        
        const durations = row.durations;
        if (!db && !metric.hasLocalActivity() && durations && durations.length > 0) {
          durations.sort((a, b) => a - b);
          const getP = (p: number): number => {
            const idx = Math.floor((durations.length - 1) * p);
            return durations[idx] ?? 0;
          };
          metric.loaded_p50 = getP(0.5);
          metric.loaded_p95 = getP(0.95);
          metric.loaded_p99 = getP(0.99);
        }
      }

      if (db) {
        // Merge real error categories from audit_logs
        // We do this dynamically via parsedLiveCategoryRows from Phase 2
        for (const row of parsedLiveCategoryRows) {
          const metric = this.tools.get(row.tool);
          if (metric) {
            metric.errorCategories[row.category] = Math.max(
              metric.errorCategories[row.category] ?? 0,
              row.cat_errors
            );
          }
        }
      }


    if (db) {
      try {
      // --- Phase 2.5: Compute latency percentiles directly from audit_logs ---
      // audit_logs stores durationMs for every call, giving us the raw distribution
      // needed for accurate percentiles — independent of the 5-minute flush cycle.
      // This fills the gap when metrics_snapshots has p50=0 (fresh start or new tools).
      // Uses SQLite window functions available since SQLite 3.25 (2018).
      const percentileRows = db.prepare(`
        WITH ranked AS (
          SELECT
            tool,
            durationMs,
            ROW_NUMBER() OVER (PARTITION BY tool ORDER BY durationMs) AS rn,
            COUNT(*) OVER (PARTITION BY tool) AS cnt
          FROM audit_logs
        )
        SELECT
          tool,
          MAX(CASE WHEN rn = MAX(1, CAST(cnt * 0.50 AS INTEGER)) THEN CAST(durationMs AS INTEGER) END) AS p50,
          MAX(CASE WHEN rn = MAX(1, CAST(cnt * 0.95 AS INTEGER)) THEN CAST(durationMs AS INTEGER) END) AS p95,
          MAX(CASE WHEN rn = MAX(1, CAST(cnt * 0.99 AS INTEGER)) THEN CAST(durationMs AS INTEGER) END) AS p99
        FROM ranked
        GROUP BY tool
      `).all();

      const parsedPercentileRows = z.array(PercentileRowSchema).parse(percentileRows);
      for (const row of parsedPercentileRows) {
        const metric = this.tools.get(row.tool);
        if (!metric) continue;
        // Only override with DB-computed percentiles when the in-memory sample buffer
        // is empty (i.e., the exporter, which reads the shared DB but never handles
        // tool calls itself). IDE processes use their own live circular buffer instead.
        if (!metric.hasLocalActivity()) {
          metric.loaded_p50 = row.p50 ?? 0;
          metric.loaded_p95 = row.p95 ?? 0;
          metric.loaded_p99 = row.p99 ?? 0;
        }
      }

      logger.info(
        `Loaded historical metrics for ${snapshotCallBaselines.size} tools` +
        (parsedLiveRows.length > 0 ? `, ${parsedLiveRows.length} with live audit data since ${since}` : ``),
      );

      // --- Phase 3: Cache metrics ---
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

      // --- Phase 4: Resource metrics ---
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
        logger.warn("Failed to load historical percentiles/cache metrics", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  private startFlushTimer(): void {
    if (this.flushTimer) clearInterval(this.flushTimer);
    // Flush metrics every 15 seconds to match Datadog scrape interval
    this.flushTimer = setInterval(
      () => {
        this.flushToDb();
      },
      15 * 1000,
    );
    this.flushTimer.unref();
  }

  private flushToDb(): void {
    if (!this.systemDb) return;
    // Skip writing snapshots if this process has not handled any tool calls.
    // The exporter container reads from the shared DB but never processes calls,
    // so flushing would overwrite valid IDE-written p50/p95/p99 with zeros.
    const hasLocalCalls = [...this.tools.values()].some(m => m.hasLocalActivity());
    if (!hasLocalCalls) return;
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
    errorType?: string,
    errorCategory?: string
  ): void {
    let metric = this.tools.get(toolName);
    if (!metric) {
      metric = new ToolMetric();
      this.tools.set(toolName, metric);
    }
    metric.record(durationMs, success, tokens, errorType, errorCategory);
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

  recordHttpError(statusCode: number): void {
    const key = String(statusCode);
    this.httpErrors[key] = (this.httpErrors[key] ?? 0) + 1;
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

    lines.push("# HELP mysql_mcp_tool_errors_by_category_total Tool errors by category");
    lines.push("# TYPE mysql_mcp_tool_errors_by_category_total counter");
    for (const [name, metric] of this.tools.entries()) {
      for (const [category, count] of Object.entries(metric.errorCategories)) {
        lines.push(`mysql_mcp_tool_errors_by_category_total{tool="${name}",category="${category}"} ${count}`);
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

    // HTTP transport errors
    lines.push("# HELP mysql_mcp_http_errors_total HTTP-level errors before tool dispatch");
    lines.push("# TYPE mysql_mcp_http_errors_total counter");
    for (const [code, count] of Object.entries(this.httpErrors)) {
      lines.push(`mysql_mcp_http_errors_total{status_code="${code}"} ${count}`);
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
