/**
 * mysql-mcp — Historical Metrics Loader
 *
 * Bridges the split-path architecture between IDE stdio processes
 * (which write tool metrics to SQLite / mcp-audit.jsonl) and the
 * background mysql-mcp-exporter container (which reads historical
 * data to serve the Prometheus /metrics endpoint).
 *
 * The loader operates in multiple phases:
 *   Phase 1:  Snapshot baselines from metrics_snapshots
 *   Phase 2:  Live delta from audit_logs since last snapshot
 *   Phase 2.5: Percentile computation via SQLite window functions
 *   Phase 3:  Cache metrics from cache_metrics_snapshots
 *   Phase 4:  Resource metrics from resource_metrics_snapshots
 *   Fallback: JSONL file reader for Windows environments where
 *             better-sqlite3 fails to initialize
 */

import type { SystemDb } from "../system-db.js";
import { logger } from "../../utils/logger.js";
import { findSuggestion, heuristicCategorize } from "../../utils/error-suggestions.js";
import { z } from "zod";
import * as fs from "fs";

import { ToolMetric, ResourceMetric } from "./models.js";
import type { CacheMetric } from "./models.js";
import type { JsonlState } from "./types.js";
import {
  SnapshotRowSchema,
  LiveRowSchema,
  PercentileRowSchema,
  CacheSnapshotRowSchema,
  ResourceSnapshotRowSchema,
} from "./types.js";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Loads historical metrics from SQLite snapshots + audit_logs, with a
 * JSONL file fallback for environments where the DB is unavailable.
 *
 * This function is designed to be called repeatedly on a 5-second interval.
 * It is idempotent: repeated calls with the same underlying data produce
 * the same result (via `Math.max` guards on all counters).
 *
 * @param tools        Mutable map of tool name → ToolMetric
 * @param resources    Mutable map of URI → ResourceMetric
 * @param cache        Mutable CacheMetric instance
 * @param jsonlState   Mutable JSONL reader state (byte offset, accumulated stats)
 * @param systemDb     SystemDb instance (may be null if not initialized)
 * @param lastPercentileUpdate Mutable wrapper for throttling percentile queries
 */
export function loadHistorical(
  tools: Map<string, ToolMetric>,
  resources: Map<string, ResourceMetric>,
  cache: CacheMetric,
  jsonlState: JsonlState,
  systemDb: SystemDb | null,
  lastPercentileUpdate: { value: number },
): void {
  if (!systemDb) return;

  let db = null;
  try {
    db = systemDb.getDb();
  } catch {
    // If DB fails to initialize, db remains null
  }

  let parsedLiveRows: {
    tool: string;
    live_calls: number;
    live_errors: number;
    live_tokens: number;
    live_completion_tokens: number;
    durations?: number[];
  }[] = [];
  let parsedLiveCategoryRows: {
    tool: string;
    category: string;
    cat_errors: number;
    type: string;
  }[] = [];
  const snapshotCallBaselines = new Map<string, number>();
  const snapshotTokenBaselines = new Map<string, number>();
  const snapshotCompletionTokenBaselines = new Map<string, number>();
  const snapshotCategoryBaselines = new Map<string, Record<string, number>>();
  const snapshotErrorBaselines = new Map<string, Record<string, number>>();
  let since = "1970-01-01T00:00:00.000Z";

  if (db) {
    try {
      // --- Phase 1: Snapshot baselines (max persisted value per tool) ---
      const rows = db
        .prepare(
          `
        SELECT tool, calls as max_calls, errors as max_errors, tokens as max_tokens, completion_tokens as max_completion_tokens, p50, p95, p99, categories_json, errors_json
        FROM metrics_snapshots
        WHERE id IN (SELECT MAX(id) FROM metrics_snapshots GROUP BY tool)
      `,
        )
        .all();

      const parsedRows = z.array(SnapshotRowSchema).parse(rows);

      // Track per-tool snapshot baselines for live delta calculation in Phase 2.
      for (const row of parsedRows) {
        let metric = tools.get(row.tool);
        if (!metric) {
          metric = new ToolMetric();
          tools.set(row.tool, metric);
        }
        metric.calls = Math.max(metric.calls, row.max_calls);
        // Load historical errors as a special category to avoid breaking the integer DB schema
        metric.errors["historical"] = Math.max(
          metric.errors["historical"] ?? 0,
          row.max_errors,
        );
        metric.tokens = Math.max(metric.tokens, row.max_tokens);
        metric.completionTokens = Math.max(metric.completionTokens ?? 0, row.max_completion_tokens);
        // Persist the latest recorded percentiles for background export
        metric.loaded_p50 = row.p50;
        metric.loaded_p95 = row.p95;
        metric.loaded_p99 = row.p99;
        snapshotCallBaselines.set(row.tool, row.max_calls);
        snapshotTokenBaselines.set(row.tool, row.max_tokens);
        snapshotCompletionTokenBaselines.set(row.tool, row.max_completion_tokens);

        // Restore specific categories and error types if they were saved in the snapshot!
        if (row.categories_json) {
          try {
            const categories = JSON.parse(row.categories_json) as Record<
              string,
              number
            >;
            snapshotCategoryBaselines.set(row.tool, categories);
            for (const [cat, count] of Object.entries(categories)) {
              metric.errorCategories[cat] = Math.max(
                metric.errorCategories[cat] ?? 0,
                count,
              );
            }
          } catch {
            // Ignore parse errors
          }
        }

        if (row.errors_json) {
          try {
            const errorTypes = JSON.parse(row.errors_json) as Record<
              string,
              number
            >;
            snapshotErrorBaselines.set(row.tool, errorTypes);
            for (const [type, count] of Object.entries(errorTypes)) {
              metric.errors[type] = Math.max(
                metric.errors[type] ?? 0,
                count,
              );
            }
          } catch {
            // Ignore parse errors
          }
        }
      }

      // --- Phase 2: Live delta from audit_logs since the last snapshot ---
      // This closes the 5-minute flush gap on the exporter container, which
      // reads a DB written by IDE stdio processes but never flushes itself.
      // The combined total (snapshotBaseline + liveDelta) is computed each
      // call and compared via Math.max, keeping the result idempotent.
      const lastSnapshotResult = db
        .prepare(`SELECT MAX(timestamp) as last_ts FROM metrics_snapshots`)
        .get() as { last_ts: string | null };
      since = lastSnapshotResult?.last_ts ?? "1970-01-01T00:00:00.000Z";

      const liveRows = db
        .prepare(
          `
        SELECT tool,
               COUNT(*) as live_calls,
               SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as live_errors,
               SUM(COALESCE(tokenEstimate, 0)) as live_tokens,
               SUM(COALESCE(completionTokens, 0)) as live_completion_tokens
        FROM audit_logs
        WHERE timestamp > ?
        GROUP BY tool
      `,
        )
        .all(since);

      parsedLiveRows = z.array(LiveRowSchema).parse(liveRows);

      const liveErrorRows = db
        .prepare(
          `
        SELECT tool, error
        FROM audit_logs
        WHERE timestamp > ? AND success = 0
      `,
        )
        .all(since) as { tool: string; error: string | null }[];

      // Re-derive errorType and errorCategory from the raw error strings
      for (const row of liveErrorRows) {
        if (!row.error) continue;
        const errStr = row.error;
        let errorType: string | undefined;
        let errorCategory: string | undefined;

        const match = findSuggestion(errStr);
        if (match) {
          errorType = match.code;
          errorCategory = match.category;
        }
        if (!errorType || !errorCategory) {
          const fallback = heuristicCategorize(errStr);
          errorType = errorType ?? fallback.type;
          errorCategory = errorCategory ?? fallback.category;
        }

        parsedLiveCategoryRows.push({
          tool: row.tool,
          category: errorCategory ?? "unknown",
          cat_errors: 1,
          type: errorType ?? "unknown",
        });
      }
    } catch (err) {
      logger.warn("Failed to load historical metrics from SQLite", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // 🛠️ AUTONOMOUS HEALING: Fallback to reading the JSONL file if SQLite audit_logs is empty
  // This is crucial for IDEs on Windows that fail to initialize SystemDb (due to native bindings)
  // but successfully write to mcp-audit.jsonl. The dockerized exporter can read the JSONL to bridge the gap.
  const isMemoryDb = systemDb?.isMemoryDb ?? false;
  if (parsedLiveRows.length === 0 && (db === null || isMemoryDb)) {
    try {
      const auditLogArgIndex = process.argv.indexOf("--audit-log");
      // Prefer AUDIT_LOG_PATH env var (explicit read-only source for metrics aggregation)
      // over --audit-log (which is the AuditLogger's write target).
      // This allows the exporter container to read the IDE's live audit JSONL
      // via a separate read-only mount without conflicting with its own AuditLogger.
      const jsonlPath =
        process.env["AUDIT_LOG_PATH"] ??
        (auditLogArgIndex !== -1
          ? process.argv[auditLogArgIndex + 1]
          : undefined);

      if (jsonlPath !== undefined && jsonlPath !== "") {
        parseJsonlFile(jsonlPath, jsonlState, since);

        parsedLiveRows = Array.from(jsonlState.toolStats.entries()).map(
          ([tool, stats]) => ({
            tool,
            live_calls: stats.calls,
            live_errors: stats.errors,
            live_tokens: stats.tokens,
            live_completion_tokens: stats.completionTokens,
            durations: stats.durations,
          }),
        );

        // Reconstruct parsedLiveCategoryRows from jsonl stats
        parsedLiveCategoryRows = [];
        for (const [tool, stats] of jsonlState.toolStats.entries()) {
          for (const [type, count] of Object.entries(stats.errorTypes)) {
            parsedLiveCategoryRows.push({
              tool,
              category: "unknown",
              cat_errors: count,
              type,
            });
          }
          for (const [cat, count] of Object.entries(stats.errorCategories)) {
            parsedLiveCategoryRows.push({
              tool,
              category: cat,
              cat_errors: count,
              type: "unknown",
            });
          }
        }

        applyJsonlResourceStats(jsonlState, resources, cache);
      }
    } catch {
      // Ignore fallback errors
    }
  }

  applyLiveDeltas(
    parsedLiveRows,
    tools,
    snapshotCallBaselines,
    snapshotTokenBaselines,
    snapshotCompletionTokenBaselines
  );

  if (db) {
    // We re-derived categories from audit_logs in Phase 2
    // First reset the live categories/types to the snapshot baseline!
    for (const [toolName, metric] of tools.entries()) {
      const catBaseline = snapshotCategoryBaselines.get(toolName) ?? {};
      metric.errorCategories = { ...catBaseline };

      const errBaseline = snapshotErrorBaselines.get(toolName) ?? {};
      // preserve 'historical' which is updated differently
      const historical = metric.errors["historical"] ?? 0;
      metric.errors = { ...errBaseline, historical };
    }

    for (const row of parsedLiveCategoryRows) {
      const metric = tools.get(row.tool);
      if (metric) {
        if (row.category !== "unknown") {
          metric.errorCategories[row.category] =
            (metric.errorCategories[row.category] ?? 0) + row.cat_errors;
        }
        if (row.type !== "unknown") {
          metric.errors[row.type] =
            (metric.errors[row.type] ?? 0) + row.cat_errors;
        }
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
      const now = Date.now();
      if (now - lastPercentileUpdate.value > 15_000) {
        lastPercentileUpdate.value = now;
        const percentileRows = db
          .prepare(
            `
          WITH ranked AS (
            SELECT
              tool,
              durationMs,
              ROW_NUMBER() OVER (PARTITION BY tool ORDER BY durationMs) AS rn,
              COUNT(*) OVER (PARTITION BY tool) AS cnt
            FROM (SELECT tool, durationMs FROM audit_logs ORDER BY id DESC LIMIT 10000)
          )
          SELECT
            tool,
            MAX(CASE WHEN rn = MAX(1, CAST(cnt * 0.50 AS INTEGER)) THEN CAST(durationMs AS INTEGER) END) AS p50,
            MAX(CASE WHEN rn = MAX(1, CAST(cnt * 0.95 AS INTEGER)) THEN CAST(durationMs AS INTEGER) END) AS p95,
            MAX(CASE WHEN rn = MAX(1, CAST(cnt * 0.99 AS INTEGER)) THEN CAST(durationMs AS INTEGER) END) AS p99
          FROM ranked
          GROUP BY tool
        `,
          )
          .all();

        const parsedPercentileRows = z
          .array(PercentileRowSchema)
          .parse(percentileRows);
        for (const row of parsedPercentileRows) {
          const metric = tools.get(row.tool);
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
      }

      logger.info(
        `Loaded historical metrics for ${snapshotCallBaselines.size} tools` +
          (parsedLiveRows.length > 0
            ? `, ${parsedLiveRows.length} with live audit data since ${since}`
            : ``),
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

      const parsedCacheRows = z.array(CacheSnapshotRowSchema).parse(cacheRows);

      const firstRow = parsedCacheRows[0];
      if (firstRow) {
        cache.hits = Math.max(cache.hits, firstRow.max_hits);
        cache.misses = Math.max(cache.misses, firstRow.max_misses);
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

      const parsedResourceRows = z
        .array(ResourceSnapshotRowSchema)
        .parse(resourceRows);

      for (const row of parsedResourceRows) {
        let metric = resources.get(row.uri);
        if (!metric) {
          metric = new ResourceMetric();
          resources.set(row.uri, metric);
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

// ---------------------------------------------------------------------------
// Private Helpers
// ---------------------------------------------------------------------------

/**
 * Incrementally parses the JSONL audit log file starting from the last
 * known byte offset. This is the fallback path for environments where
 * SQLite's native bindings fail (e.g., Windows without build tools).
 */
function parseJsonlFile(
  jsonlPath: string,
  jsonlState: JsonlState,
  since: string,
): void {
  let fd: number | undefined;
  try {
    fd = fs.openSync(jsonlPath, "r");
    const stat = fs.fstatSync(fd);
    if (stat.size < jsonlState.offset) {
      jsonlState.offset = 0;
      // We intentionally DO NOT clear toolStats/resourceStats on log rotation.
      // This is because the exporter has no persistent DB (isMemoryDb = true)
      // and relies entirely on jsonlState for its lifetime cumulative metrics.
      // IDE processes (which use persistent DBs) skip this fallback entirely
      // via the isMemoryDb check above, so they won't double count.
    }

    if (stat.size > jsonlState.offset) {
      const length = stat.size - jsonlState.offset;
      const buffer = Buffer.alloc(length);
      fs.readSync(fd, buffer, 0, length, jsonlState.offset);
      fs.closeSync(fd);
      fd = undefined;
      jsonlState.offset = stat.size;

      const content = buffer.toString("utf8");
      const lines = content.split("\n").filter((l: string) => l !== "");

      for (const line of lines) {
        try {
          const entry = JSON.parse(line) as Record<string, unknown>;
          processJsonlEntry(entry, jsonlState, since);
        } catch {
          // Ignore parse errors for individual lines
        }
      }
    }
  } catch (e: unknown) {
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      e.code !== "ENOENT"
    )
      throw e;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

/**
 * Processes a single parsed JSONL audit entry, accumulating stats into
 * the jsonlState maps.
 */
function processJsonlEntry(
  entry: Record<string, unknown>,
  jsonlState: JsonlState,
  since: string,
): void {
  const category =
    typeof entry["category"] === "string" ? entry["category"] : undefined;
  const entryType =
    typeof entry["type"] === "string" ? entry["type"] : undefined;
  const errorCategory =
    typeof entry["errorCategory"] === "string"
      ? entry["errorCategory"]
      : undefined;
  const errorType =
    typeof entry["errorType"] === "string" ? entry["errorType"] : undefined;

  const entryTool =
    typeof entry["tool"] === "string" ? entry["tool"] : undefined;
  const entryName =
    typeof entry["name"] === "string" ? entry["name"] : undefined;
  const toolName = entryTool ?? entryName;

  if (entryType === "tool" || toolName !== undefined) {
    if (toolName === undefined || toolName === "") return;

    const entryTimestamp =
      typeof entry["timestamp"] === "string" ? entry["timestamp"] : undefined;
    // Note: 'since' is essentially 1970 for the exporter, so this skip is a no-op,
    // but we include it for correctness if this code path is ever used with a valid 'since'.
    if (entryTimestamp !== undefined && entryTimestamp <= since) {
      return;
    }

    if (category === "resource") {
      processResourceEntry(entry, toolName, jsonlState);
      return;
    }

    const stats = jsonlState.toolStats.get(toolName) ?? {
      calls: 0,
      errors: 0,
      tokens: 0,
      completionTokens: 0,
      durations: [],
      errorTypes: {},
      errorCategories: {},
    };

    const entryDuration =
      typeof entry["durationMs"] === "number" ? entry["durationMs"] : undefined;
    if (entryDuration !== undefined) {
      stats.durations.push(entryDuration);
      // Prevent memory leak for long-running exporters
      if (stats.durations.length > 10000) stats.durations.shift();
    }

    jsonlState.toolStats.set(toolName, stats);

    stats.calls++;
    if (entry["success"] === false) {
      stats.errors++;
      const errStr =
        typeof entry["error"] === "string" ? entry["error"] : "unknown error";
      let eType: string | undefined = errorType;
      let eCat: string | undefined = errorCategory;

      if (!eType || !eCat) {
        const match = findSuggestion(errStr);
        if (match) {
          eType = eType ?? match.code;
          eCat = eCat ?? match.category;
        }
      }
      if (!eType || !eCat) {
        const fallback = heuristicCategorize(errStr);
        eType = eType ?? fallback.type;
        eCat = eCat ?? fallback.category;
      }
      const tKey = eType ?? "unknown";
      const cKey = eCat ?? "unknown";
      stats.errorTypes[tKey] = (stats.errorTypes[tKey] ?? 0) + 1;
      stats.errorCategories[cKey] = (stats.errorCategories[cKey] ?? 0) + 1;
    }

    const entryTokenEstimate =
      typeof entry["tokenEstimate"] === "number"
        ? entry["tokenEstimate"]
        : undefined;
    if (entryTokenEstimate !== undefined) stats.tokens += entryTokenEstimate;

    const entryCompletionTokens =
      typeof entry["completionTokens"] === "number"
        ? entry["completionTokens"]
        : undefined;
    if (entryCompletionTokens !== undefined) stats.completionTokens += entryCompletionTokens;
  }
}

/**
 * Processes a resource-category JSONL entry (pool stats or resource reads).
 */
function processResourceEntry(
  entry: Record<string, unknown>,
  toolName: string,
  jsonlState: JsonlState,
): void {
  if (toolName === "mysql://pool/stats" && entry["args"] !== undefined) {
    const args = entry["args"] as Record<string, number>;
    const pid = args["pid"] ?? 0;
    const current = jsonlState.poolStatsByPid.get(pid) ?? {
      total: 0,
      active: 0,
      idle: 0,
      waiting: 0,
      totalQueries: 0,
    };
    jsonlState.poolStatsByPid.set(pid, {
      total: args["total"] ?? current.total,
      active: args["active"] ?? current.active,
      idle: args["idle"] ?? current.idle,
      waiting: args["waiting"] ?? current.waiting,
      totalQueries: Math.max(
        current.totalQueries,
        args["totalQueries"] ?? 0,
      ),
    });
    return;
  }

  const stat = jsonlState.resourceStats.get(toolName) ?? { reads: 0 };
  stat.reads++;
  jsonlState.resourceStats.set(toolName, stat);
}

/**
 * Applies accumulated JSONL resource stats to the ResourceMetric and
 * CacheMetric instances.
 */
function applyJsonlResourceStats(
  jsonlState: JsonlState,
  resources: Map<string, ResourceMetric>,
  cache: CacheMetric,
): void {
  for (const [uri, stat] of jsonlState.resourceStats.entries()) {
    if (uri === "mysql://cache/hit") {
      cache.hits = Math.max(cache.hits, stat.reads);
      continue;
    }
    if (uri === "mysql://cache/miss") {
      cache.misses = Math.max(cache.misses, stat.reads);
      continue;
    }
    if (uri === "mysql://pool/stats") {
      continue;
    }

    let metric = resources.get(uri);
    if (!metric) {
      metric = new ResourceMetric();
      resources.set(uri, metric);
    }
    metric.reads = Math.max(metric.reads, stat.reads);
  }
}

/**
 * Merges live audit_logs deltas with snapshot baselines into the tool
 * metrics map.
 */
function applyLiveDeltas(
  parsedLiveRows: {
    tool: string;
    live_calls: number;
    live_errors: number;
    live_tokens: number;
    live_completion_tokens: number;
    durations?: number[];
  }[],
  tools: Map<string, ToolMetric>,
  snapshotCallBaselines: Map<string, number>,
  snapshotTokenBaselines: Map<string, number>,
  snapshotCompletionTokenBaselines: Map<string, number>,
): void {
  for (const row of parsedLiveRows) {
    let metric = tools.get(row.tool);
    if (!metric) {
      metric = new ToolMetric();
      tools.set(row.tool, metric);
    }
    // Combine snapshot baseline with live delta for the true running total.
    // Using Math.max keeps this idempotent across repeated sync intervals.
    const callsBaseline = snapshotCallBaselines.get(row.tool) ?? 0;
    const tokensBaseline = snapshotTokenBaselines.get(row.tool) ?? 0;
    const completionTokensBaseline = snapshotCompletionTokenBaselines.get(row.tool) ?? 0;
    metric.calls = Math.max(metric.calls, callsBaseline + row.live_calls);
    // Rename "live" bucket to "historical" for the total count to match Datadog filtering
    // We don't overwrite types, they are populated from parsedLiveCategoryRows
    metric.errors["historical"] = Math.max(
      metric.errors["historical"] ?? 0,
      row.live_errors,
    );
    metric.tokens = Math.max(
      metric.tokens,
      tokensBaseline + row.live_tokens,
    );
    metric.completionTokens = Math.max(
      metric.completionTokens,
      completionTokensBaseline + row.live_completion_tokens,
    );

    const durations = row.durations;
    if (!metric.hasLocalActivity() && durations && durations.length > 0) {
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
}
