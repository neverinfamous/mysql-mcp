/**
 * mysql-mcp — Metrics Registry
 *
 * Central orchestrator for the observability metrics subsystem.
 * Owns all metric aggregator instances, manages SystemDb/AuditLogger
 * integration, and coordinates the historical sync + Prometheus export
 * pipeline.
 *
 * OTel integration: Records live observations using @opentelemetry/api
 * instruments obtained from the shared meter. When no MeterProvider is
 * registered (e.g., in the background exporter), all recordings are
 * automatic no-ops.
 */

import type { SystemDb } from "../system-db.js";
import type { AuditLogger } from "../../audit/logger.js";
import type { AuditEntry } from "../../audit/types.js";
import { logger } from "../../utils/logger.js";
import { TOOL_GROUPS } from "../../filtering/tool-constants.js";
import type { Histogram, Counter } from "@opentelemetry/api";

import { ToolMetric, ResourceMetric, CacheMetric, RedisMetric } from "./models.js";
import type { JsonlState, PoolStats, MetricSummary, ResourceMetricSummary } from "./types.js";
import { loadHistorical } from "./historical.js";
import { formatPrometheus } from "./prometheus.js";
import { getMeter } from "../tracing.js";

// ---------------------------------------------------------------------------
// MetricsRegistry
// ---------------------------------------------------------------------------

export class MetricsRegistry {
  private tools = new Map<string, ToolMetric>();
  private resources = new Map<string, ResourceMetric>();
  private cache = new CacheMetric();
  private lastPercentileUpdate = { value: 0 };
  private redis = new RedisMetric();
  private httpErrors: Record<string, number> = { "401": 0, "413": 0, "429": 0 };
  private jsonlState: JsonlState = {
    offset: 0,
    toolStats: new Map(),
    resourceStats: new Map(),
    poolStatsByPid: new Map(),
  };
  private systemDb: SystemDb | null = null;
  private auditLogger: AuditLogger | null = null;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private readonly startedAt = Date.now();
  private poolStatsProvider: (() => PoolStats) | null = null;

  // OTel instruments (no-op when no MeterProvider is registered)
  private otelToolDuration: Histogram | null = null;
  private otelToolCalls: Counter | null = null;
  private otelTokenUsage: Counter | null = null;

  setPoolStatsProvider(fn: () => PoolStats): void {
    this.poolStatsProvider = fn;
  }

  constructor() {
    // Pre-register known resources so they emit 0 on startup.
    // This is required for Datadog's monotonic_diff to calculate the first increment (0 -> 1).
    const knownResources = [
      "mysql://help",
      "mysql://help/core",
      "mysql://help/codemode",
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
      "mysql://insights",
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

    // Initialize OTel instruments lazily — safe to call even without a provider
    this.initOtelInstruments();
  }

  private initOtelInstruments(): void {
    const meter = getMeter();
    this.otelToolDuration = meter.createHistogram(
      "gen_ai.server.request.duration",
      {
        description: "MCP tool execution duration",
        unit: "s",
        advice: {
          explicitBucketBoundaries: [
            0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 5, 10,
          ],
        },
      },
    );
    this.otelToolCalls = meter.createCounter(
      "gen_ai.server.request.count",
      {
        description: "Total MCP tool call count",
        unit: "{call}",
      },
    );
    this.otelTokenUsage = meter.createCounter(
      "gen_ai.server.token.usage",
      {
        description: "Total token usage across MCP tool calls",
        unit: "{token}",
      },
    );
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

  setAuditLogger(auditLogger: AuditLogger): void {
    this.auditLogger = auditLogger;
  }

  private startHistoricalSync(): void {
    // Initial load
    this.runHistoricalLoad();

    // Sync continuously so the background metrics server picks up tool calls
    // made by short-lived stdio processes
    setInterval(() => {
      this.runHistoricalLoad();
    }, 5000).unref();
  }

  private runHistoricalLoad(): void {
    loadHistorical(
      this.tools,
      this.resources,
      this.cache,
      this.jsonlState,
      this.systemDb,
      this.lastPercentileUpdate,
    );
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
    // Skip writing snapshots if this process has not handled any tool calls or resource reads.
    // The exporter container reads from the shared DB but never processes calls,
    // so flushing would overwrite valid IDE-written p50/p95/p99 with zeros.
    const hasLocalCalls = [...this.tools.values()].some((m) =>
      m.hasLocalActivity(),
    );
    const hasLocalResourceReads = [...this.resources.values()].some((m) =>
      m.hasLocalActivity(),
    );
    if (!hasLocalCalls && !hasLocalResourceReads) return;
    if (this.auditLogger && this.poolStatsProvider) {
      try {
        const poolStats = this.poolStatsProvider();
        this.auditLogger.log({
          timestamp: new Date().toISOString(),
          requestId: "pool",
          tool: "mysql://pool/stats",
          category: "resource",
          scope: "read",
          durationMs: 0,
          success: true,
          status: "info",
          args: {
            pid: process.pid,
            total: poolStats.total,
            active: poolStats.active,
            idle: poolStats.idle,
            waiting: poolStats.waiting,
            totalQueries: poolStats.totalQueries,
          },
        } as unknown as AuditEntry);
      } catch (err) {
        logger.warn("Failed to log pool stats", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    try {
      const db = this.systemDb.getDb();
      const stmt = db.prepare(`
        INSERT INTO metrics_snapshots (timestamp, tool, calls, errors, p50, p95, p99, tokens, categories_json, errors_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const timestamp = new Date().toISOString();
      const transaction = db.transaction(() => {
        for (const [name, metric] of this.tools.entries()) {
          const summary = metric.getSummary();
          const totalErrors = Object.values(summary.errors).reduce(
            (sum, val) => sum + val,
            0,
          );
          stmt.run(
            timestamp,
            name,
            summary.calls,
            totalErrors,
            summary.p50,
            summary.p95,
            summary.p99,
            summary.tokens,
            JSON.stringify(metric.errorCategories),
            JSON.stringify(metric.errors),
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

  // ---------------------------------------------------------------------------
  // Recording Methods
  // ---------------------------------------------------------------------------

  recordToolCall(
    toolName: string,
    durationMs: number,
    success: boolean,
    tokens = 0,
    errorType?: string,
    errorCategory?: string,
  ): void {
    let metric = this.tools.get(toolName);
    if (!metric) {
      metric = new ToolMetric();
      this.tools.set(toolName, metric);
    }
    metric.record(durationMs, success, tokens, errorType, errorCategory);

    // OTel observations — no-ops when no MeterProvider is registered
    const attributes = { tool: toolName, success: String(success) };
    this.otelToolDuration?.record(durationMs / 1000, attributes);
    this.otelToolCalls?.add(1, attributes);
    if (tokens > 0) {
      this.otelTokenUsage?.add(tokens, { tool: toolName });
    }
  }

  recordResourceRead(uri: string): void {
    let metric = this.resources.get(uri);
    if (!metric) {
      metric = new ResourceMetric();
      this.resources.set(uri, metric);
    }
    metric.record();

    if (this.auditLogger) {
      this.auditLogger.log({
        timestamp: new Date().toISOString(),
        requestId: "resource",
        tool: uri,
        category: "resource",
        scope: "read",
        durationMs: 0,
        success: true,
        status: "info",
      } as unknown as AuditEntry);
    }
  }

  recordCacheHit(): void {
    this.cache.recordHit();
    if (this.auditLogger) {
      this.auditLogger.log({
        timestamp: new Date().toISOString(),
        requestId: "cache",
        tool: "mysql://cache/hit",
        category: "resource",
        scope: "read",
        durationMs: 0,
        success: true,
        status: "info",
      } as unknown as AuditEntry);
    }
  }

  recordCacheMiss(): void {
    this.cache.recordMiss();
    if (this.auditLogger) {
      this.auditLogger.log({
        timestamp: new Date().toISOString(),
        requestId: "cache",
        tool: "mysql://cache/miss",
        category: "resource",
        scope: "read",
        durationMs: 0,
        success: true,
        status: "info",
      } as unknown as AuditEntry);
    }
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

  // ---------------------------------------------------------------------------
  // Query Methods
  // ---------------------------------------------------------------------------

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
    // Reload from SQLite immediately before scraping to capture metrics
    // from other stdio processes
    this.runHistoricalLoad();

    return formatPrometheus(
      this.tools,
      this.resources,
      this.cache,
      this.redis,
      this.httpErrors,
      this.poolStatsProvider,
      this.jsonlState.poolStatsByPid,
      this.startedAt,
    );
  }
}

// Global singleton
export const metrics = new MetricsRegistry();
