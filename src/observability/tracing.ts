/**
 * mysql-mcp — OpenTelemetry Instrumentation Factories
 *
 * Provides lazy-cached access to the OTel Meter and Tracer.
 * Uses only `@opentelemetry/api` (the no-op-by-default interface package).
 *
 * When no MeterProvider or TracerProvider is registered by the host
 * application, all instruments are automatic no-ops — zero overhead.
 * Consumers who want full export can bring their own SDK and register
 * providers externally.
 */

import { metrics as otelMetrics, trace } from "@opentelemetry/api";
import type { Meter, Tracer } from "@opentelemetry/api";

const INSTRUMENTATION_SCOPE = "mysql-mcp";
const INSTRUMENTATION_VERSION = "5.0.0";

let _meter: Meter | null = null;
let _tracer: Tracer | null = null;

/**
 * Returns the shared OTel Meter for recording metrics.
 * The meter is created once and cached for the lifetime of the process.
 */
export function getMeter(): Meter {
  return (_meter ??= otelMetrics.getMeter(
    INSTRUMENTATION_SCOPE,
    INSTRUMENTATION_VERSION,
  ));
}

/**
 * Returns the shared OTel Tracer for creating spans.
 * The tracer is created once and cached for the lifetime of the process.
 */
export function getTracer(): Tracer {
  return (_tracer ??= trace.getTracer(
    INSTRUMENTATION_SCOPE,
    INSTRUMENTATION_VERSION,
  ));
}
