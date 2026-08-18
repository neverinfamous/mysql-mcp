/**
 * mysql-mcp — Metrics Module Barrel
 *
 * Re-exports the public API surface of the metrics subsystem.
 * Consumers import from this barrel to maintain backward compatibility
 * with the previous monolithic metrics.ts import path.
 */

export { MetricsRegistry, metrics } from "./registry.js";
export type { MetricSummary, ResourceMetricSummary } from "./types.js";
