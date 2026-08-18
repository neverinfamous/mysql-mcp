/**
 * mysql-mcp — Prometheus Text Format Generator
 *
 * Pure function that formats the combined live/historical metrics state
 * into Prometheus exposition format for the /metrics scrape endpoint.
 *
 * Metric names are preserved exactly as-is to maintain compatibility
 * with Datadog dashboard queries and Grafana panels.
 */

import type { ToolMetric, ResourceMetric, CacheMetric, RedisMetric } from "./models.js";
import type { PoolStats } from "./types.js";

/**
 * Generates the full Prometheus metrics text output from the current
 * state of all metric aggregators.
 *
 * This is a pure formatting function — it does NOT trigger any data
 * loading. The caller (MetricsRegistry.toPrometheus()) is responsible
 * for calling loadHistorical() first.
 */
export function formatPrometheus(
  tools: Map<string, ToolMetric>,
  resources: Map<string, ResourceMetric>,
  cache: CacheMetric,
  redis: RedisMetric,
  httpErrors: Record<string, number>,
  httpRxBytes: number,
  httpTxBytes: number,
  poolStatsProvider: (() => PoolStats) | null,
  jsonlPoolStats: Map<number, PoolStats>,
  startedAt: number,
): string {
  const lines: string[] = [];

  // --- Tool metrics ---
  lines.push("# HELP mysql_mcp_tool_calls_total Total tool calls");
  lines.push("# TYPE mysql_mcp_tool_calls_total counter");
  for (const [name, metric] of tools.entries()) {
    lines.push(
      `mysql_mcp_tool_calls_total{tool="${name}"} ${metric.getSummary().calls}`,
    );
  }

  lines.push("# HELP mysql_mcp_tool_errors_total Total tool errors");
  lines.push("# TYPE mysql_mcp_tool_errors_total counter");
  for (const [name, metric] of tools.entries()) {
    const summary = metric.getSummary();
    for (const [errorType, count] of Object.entries(summary.errors)) {
      lines.push(
        `mysql_mcp_tool_errors_total{tool="${name}",error_type="${errorType}"} ${count}`,
      );
    }
  }

  lines.push(
    "# HELP mysql_mcp_tool_errors_by_category_total Tool errors by category",
  );
  lines.push("# TYPE mysql_mcp_tool_errors_by_category_total counter");
  for (const [name, metric] of tools.entries()) {
    for (const [category, count] of Object.entries(metric.errorCategories)) {
      lines.push(
        `mysql_mcp_tool_errors_by_category_total{tool="${name}",category="${category}"} ${count}`,
      );
    }
  }

  // --- Token metrics (gen_ai.* semantic conventions) ---
  lines.push(
    "# HELP gen_ai_usage_prompt_tokens_total Total tokens estimated",
  );
  lines.push("# TYPE gen_ai_usage_prompt_tokens_total counter");
  for (const [name, metric] of tools.entries()) {
    lines.push(
      `gen_ai_usage_prompt_tokens_total{tool="${name}"} ${metric.getSummary().tokens}`,
    );
  }

  lines.push(
    "# HELP gen_ai_usage_completion_tokens_total Total completion tokens estimated",
  );
  lines.push("# TYPE gen_ai_usage_completion_tokens_total counter");
  for (const [name, metric] of tools.entries()) {
    lines.push(
      `gen_ai_usage_completion_tokens_total{tool="${name}"} ${metric.getSummary().completionTokens}`,
    );
  }

  // --- DB Query Latency ---
  lines.push("# HELP mysql_mcp_db_query_latency_ms_p95 P95 DB Query Latency (ms)");
  lines.push("# TYPE mysql_mcp_db_query_latency_ms_p95 gauge");
  // Left as future extension for when we track percentiles properly per-tool


  // --- Latency percentiles ---
  lines.push("# HELP mysql_mcp_tool_latency_ms_p50 P50 Latency (ms)");
  lines.push("# TYPE mysql_mcp_tool_latency_ms_p50 gauge");
  for (const [name, metric] of tools.entries()) {
    lines.push(
      `mysql_mcp_tool_latency_ms_p50{tool="${name}"} ${metric.getSummary().p50}`,
    );
  }

  lines.push("# HELP mysql_mcp_tool_latency_ms_p95 P95 Latency (ms)");
  lines.push("# TYPE mysql_mcp_tool_latency_ms_p95 gauge");
  for (const [name, metric] of tools.entries()) {
    lines.push(
      `mysql_mcp_tool_latency_ms_p95{tool="${name}"} ${metric.getSummary().p95}`,
    );
  }

  lines.push("# HELP mysql_mcp_tool_latency_ms_p99 P99 Latency (ms)");
  lines.push("# TYPE mysql_mcp_tool_latency_ms_p99 gauge");
  for (const [name, metric] of tools.entries()) {
    lines.push(
      `mysql_mcp_tool_latency_ms_p99{tool="${name}"} ${metric.getSummary().p99}`,
    );
  }

  // --- Derived: tokens per call ---
  lines.push(
    "# HELP gen_ai_usage_prompt_tokens_per_call Average tokens per tool call",
  );
  lines.push("# TYPE gen_ai_usage_prompt_tokens_per_call gauge");
  for (const [name, metric] of tools.entries()) {
    const summary = metric.getSummary();
    const avg =
      summary.calls > 0 ? Math.round(summary.tokens / summary.calls) : 0;
    const labels = `{tool="${name}"}`;
    lines.push(`gen_ai_usage_prompt_tokens_per_call${labels} ${avg}`);
  }

  // --- Resources ---
  lines.push("# HELP mysql_mcp_resource_reads_total Total resource reads");
  lines.push("# TYPE mysql_mcp_resource_reads_total counter");
  for (const [uri, metric] of resources.entries()) {
    const summary = metric.getSummary();
    const labels = `{resource="${uri}"}`;
    lines.push(`mysql_mcp_resource_reads_total${labels} ${summary.reads}`);
  }

  lines.push("# HELP mysql_mcp_resource_read_bytes_total Total resource bytes read");
  lines.push("# TYPE mysql_mcp_resource_read_bytes_total counter");
  for (const [uri, metric] of resources.entries()) {
    const summary = metric.getSummary();
    const labels = `{resource="${uri}"}`;
    lines.push(`mysql_mcp_resource_read_bytes_total${labels} ${summary.readBytes}`);
  }

  // --- Cache ---
  const cacheSummary = cache.getSummary();
  lines.push("# HELP mysql_mcp_cache_hits_total Total schema cache hits");
  lines.push("# TYPE mysql_mcp_cache_hits_total counter");
  lines.push(`mysql_mcp_cache_hits_total ${cacheSummary.hits}`);

  lines.push("# HELP mysql_mcp_cache_misses_total Total schema cache misses");
  lines.push("# TYPE mysql_mcp_cache_misses_total counter");
  lines.push(`mysql_mcp_cache_misses_total ${cacheSummary.misses}`);

  lines.push("# HELP mysql_mcp_cache_items_total Current cache items");
  lines.push("# TYPE mysql_mcp_cache_items_total gauge");
  lines.push(`mysql_mcp_cache_items_total ${cacheSummary.items}`);

  lines.push("# HELP mysql_mcp_cache_evictions_total Total schema cache evictions");
  lines.push("# TYPE mysql_mcp_cache_evictions_total counter");
  lines.push(`mysql_mcp_cache_evictions_total ${cacheSummary.evictions}`);

  // --- Redis rate limiting ---
  const redisSummary = redis.getSummary();
  lines.push(
    "# HELP mysql_mcp_redis_rate_limit_exceeded_total Code Mode rate limit rejections",
  );
  lines.push("# TYPE mysql_mcp_redis_rate_limit_exceeded_total counter");
  lines.push(
    `mysql_mcp_redis_rate_limit_exceeded_total ${redisSummary.rateLimitExceeded}`,
  );

  lines.push(
    "# HELP mysql_mcp_redis_fallback_to_memory_total Redis fallback events to in-memory rate limiter",
  );
  lines.push("# TYPE mysql_mcp_redis_fallback_to_memory_total counter");
  lines.push(
    `mysql_mcp_redis_fallback_to_memory_total ${redisSummary.fallbackToMemory}`,
  );

  lines.push(
    "# HELP mysql_mcp_redis_connected Whether Redis is currently connected",
  );
  lines.push("# TYPE mysql_mcp_redis_connected gauge");
  lines.push(`mysql_mcp_redis_connected ${redisSummary.connected ? 1 : 0}`);

  lines.push(
    "# HELP mysql_mcp_redis_lua_eval_latency_p95_ms P95 latency of Redis Lua rate limit eval (ms)",
  );
  lines.push("# TYPE mysql_mcp_redis_lua_eval_latency_p95_ms gauge");
  lines.push(
    `mysql_mcp_redis_lua_eval_latency_p95_ms ${redisSummary.luaEvalP95}`,
  );

  // --- Pool metrics ---
  appendPoolMetrics(lines, poolStatsProvider, jsonlPoolStats);

  // --- HTTP transport errors ---
  lines.push(
    "# HELP mysql_mcp_http_errors_total HTTP-level errors before tool dispatch",
  );
  lines.push("# TYPE mysql_mcp_http_errors_total counter");
  for (const [code, count] of Object.entries(httpErrors)) {
    lines.push(
      `mysql_mcp_http_errors_total{status_code="${code}"} ${count}`,
    );
  }

  lines.push(
    "# HELP mysql_mcp_http_rx_bytes_total HTTP transport bytes received",
  );
  lines.push("# TYPE mysql_mcp_http_rx_bytes_total counter");
  lines.push(`mysql_mcp_http_rx_bytes_total ${httpRxBytes}`);

  lines.push(
    "# HELP mysql_mcp_http_tx_bytes_total HTTP transport bytes sent",
  );
  lines.push("# TYPE mysql_mcp_http_tx_bytes_total counter");
  lines.push(`mysql_mcp_http_tx_bytes_total ${httpTxBytes}`);

  // --- Node.js Runtime Health ---
  const memUsage = process.memoryUsage();
  lines.push("# HELP nodejs_heap_size_used_bytes Node.js heap used memory");
  lines.push("# TYPE nodejs_heap_size_used_bytes gauge");
  lines.push(`nodejs_heap_size_used_bytes ${memUsage.heapUsed}`);

  lines.push("# HELP nodejs_heap_size_total_bytes Node.js heap total memory");
  lines.push("# TYPE nodejs_heap_size_total_bytes gauge");
  lines.push(`nodejs_heap_size_total_bytes ${memUsage.heapTotal}`);

  lines.push("# HELP nodejs_rss_bytes Node.js RSS memory usage");
  lines.push("# TYPE nodejs_rss_bytes gauge");
  lines.push(`nodejs_rss_bytes ${memUsage.rss}`);

  const activeRequests = typeof (process as any)._getActiveRequests === "function" ? (process as any)._getActiveRequests().length : 0;
  const activeHandles = typeof (process as any)._getActiveHandles === "function" ? (process as any)._getActiveHandles().length : 0;

  lines.push("# HELP nodejs_active_requests_total Node.js active requests");
  lines.push("# TYPE nodejs_active_requests_total gauge");
  lines.push(`nodejs_active_requests_total ${activeRequests}`);

  lines.push("# HELP nodejs_active_handles_total Node.js active handles");
  lines.push("# TYPE nodejs_active_handles_total gauge");
  lines.push(`nodejs_active_handles_total ${activeHandles}`);

  // --- Server uptime ---
  lines.push("# HELP mysql_mcp_uptime_seconds Server uptime in seconds");
  lines.push("# TYPE mysql_mcp_uptime_seconds gauge");
  lines.push(
    `mysql_mcp_uptime_seconds ${Math.floor((Date.now() - startedAt) / 1000)}`,
  );

  return lines.join("\n") + "\n";
}

/**
 * Appends connection pool metrics from both the live provider and
 * JSONL-loaded per-PID stats.
 */
function appendPoolMetrics(
  lines: string[],
  poolStatsProvider: (() => PoolStats) | null,
  jsonlPoolStats: Map<number, PoolStats>,
): void {
  let totalSlots = 0;
  let active = 0;
  let idle = 0;
  let waiting = 0;
  let totalQueries = 0;
  let connectionErrors = 0;

  if (poolStatsProvider) {
    const poolStats = poolStatsProvider();
    totalSlots += poolStats.total;
    active += poolStats.active;
    idle += poolStats.idle;
    waiting += poolStats.waiting;
    totalQueries += poolStats.totalQueries;
    if ("connectionErrors" in poolStats && typeof poolStats.connectionErrors === "number") {
      connectionErrors += poolStats.connectionErrors;
    }
  }

  for (const stats of jsonlPoolStats.values()) {
    totalSlots += stats.total;
    active += stats.active;
    idle += stats.idle;
    waiting += stats.waiting;
    totalQueries += stats.totalQueries;
    if ("connectionErrors" in stats && typeof stats.connectionErrors === "number") {
      connectionErrors += stats.connectionErrors;
    }
  }

  if (totalSlots > 0 || totalQueries > 0) {
    lines.push(
      "# HELP mysql_mcp_pool_connections_total Total connection slots in pool",
    );
    lines.push("# TYPE mysql_mcp_pool_connections_total gauge");
    lines.push(`mysql_mcp_pool_connections_total ${totalSlots}`);

    lines.push(
      "# HELP mysql_mcp_pool_utilization_ratio Connection pool utilization percentage (0.0 to 1.0)",
    );
    lines.push("# TYPE mysql_mcp_pool_utilization_ratio gauge");
    const utilization = totalSlots > 0 ? active / totalSlots : 0;
    lines.push(`mysql_mcp_pool_utilization_ratio ${utilization}`);

    lines.push(
      "# HELP mysql_mcp_pool_connections_active Currently in-use connections",
    );
    lines.push("# TYPE mysql_mcp_pool_connections_active gauge");
    lines.push(`mysql_mcp_pool_connections_active ${active}`);

    lines.push(
      "# HELP mysql_mcp_pool_connections_idle Available idle connections",
    );
    lines.push("# TYPE mysql_mcp_pool_connections_idle gauge");
    lines.push(`mysql_mcp_pool_connections_idle ${idle}`);

    lines.push(
      "# HELP mysql_mcp_pool_connections_waiting Queries waiting for connection",
    );
    lines.push("# TYPE mysql_mcp_pool_connections_waiting gauge");
    lines.push(`mysql_mcp_pool_connections_waiting ${waiting}`);

    lines.push(
      "# HELP mysql_mcp_pool_queries_total Cumulative queries through pool",
    );
    lines.push("# TYPE mysql_mcp_pool_queries_total counter");
    lines.push(`mysql_mcp_pool_queries_total ${totalQueries}`);

    lines.push(
      "# HELP mysql_mcp_pool_connection_errors_total Cumulative connection errors",
    );
    lines.push("# TYPE mysql_mcp_pool_connection_errors_total counter");
    lines.push(`mysql_mcp_pool_connection_errors_total ${connectionErrors}`);
  }
}
