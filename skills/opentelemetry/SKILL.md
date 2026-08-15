---
name: opentelemetry
version: 1.0.0
tags:
  - "agent-skill"
description: |
  Observability standards using OpenTelemetry. Use when instrumenting applications for distributed tracing, metrics, and structured logging. NOT for performance optimization - use adversarial-performance or web-perf. SECURITY: Ensure sensitive PII/secrets are scrubbed before logging.
  Triggers on: "OpenTelemetry", "OTel", "distributed tracing", "metrics", "structured logging", "OTLP", "telemetry".
---

# OpenTelemetry (OTel)

Production standards for instrumenting applications to achieve high-fidelity observability.

## 1. Distributed Tracing

- **Auto-Instrumentation & eBPF**: Rely heavily on auto-instrumentation and "OTel Blueprints." Manual spans are reserved specifically for complex business logic.
- **Trace Context Propagation**: Always propagate the `traceparent` and `tracestate` headers across HTTP and RPC boundaries (using W3C Trace Context).
- **Span Granularity**: Create spans for logical units of work. Avoid creating spans for every single function call (which causes overhead). Focus on:
  - Incoming HTTP requests
  - Database queries
  - GenAI Observability (tracking LLM calls, token exchanges, tool invocations)
  - Background task executions
- **Semantic Conventions**: Use standardized span attributes (e.g., `http.method`, `http.status_code`, `db.system`). Do not invent custom attribute names when standard ones exist.
- **GenAI Semantic Conventions**: When tracing LLM interactions, agent orchestration, or Model Context Protocol (MCP) tool calls, you MUST use the official `gen_ai.*` semantic conventions (e.g., `gen_ai.system`, `gen_ai.request.model`, `gen_ai.usage.prompt_tokens`). This ensures observability vendors (like Datadog) can properly map and analyze AI token usage and latency.

## 2. Span Implementation Guidelines

- **Status and Errors**: explicitly set the span status to `Error` when an exception occurs, and record the exception object on the span.
- **Payloads**: Avoid logging sensitive PII or massive payloads in span attributes. Log structural identifiers (e.g., `user.id`, `tenant.id`).

```typescript
// Example: Creating a Span in Node.js
tracer.startActiveSpan('database.query', (span) => {
  try {
    span.setAttribute('db.statement', queryText)
    const result = db.execute(queryText)
    span.setStatus({ code: SpanStatusCode.OK })
    return result
  } catch (error) {
    span.recordException(error)
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message })
    throw error
  } finally {
    span.end()
  }
})
```

## 3. Metrics

- **RED Metrics**: Focus on Rate (requests/sec), Errors (error rate), and Duration (latency distribution).
- **Histograms over Summaries**: Use Histograms for latency measurements to allow accurate percentile aggregations across distributed instances.

## 4. Exporters and Infrastructure

- **OTLP Exporters**: Always export telemetry using the OpenTelemetry Protocol (OTLP) via gRPC or HTTP to an OpenTelemetry Collector, rather than exporting directly to backend vendors (Datadog, Honeycomb) from the application.
- **Data Transport**: The ecosystem is adopting the OpenTelemetry Arrow Protocol (OTAP) for highly performant, columnar data transport.
- **Batching**: Use batch span processors (`BatchSpanProcessor`) in production to minimize performance overhead. Only use `SimpleSpanProcessor` for local debugging.

## 5. Cloudflare Workers Integration

- **Trace Exporters**: When running on Cloudflare Workers, standard OTLP exporters may fail due to runtime constraints. Use `@microlabs/otel-cf-workers` or specifically tailored fetch-based HTTP exporters for compatibility.
- **Context Preservation**: Always wrap the Worker's `fetch` handler or Scheduled handler using the telemetry wrapper to ensure trace context flows correctly through the V8 isolate.

## 6. Structured Logging

- **Native OTel Logs SDK**: The OpenTelemetry Logs signal is now stable. Prefer using the native OTel Logs SDK (or an OTel-native appender) to emit logs directly as OTLP rather than wrapping legacy, unstructured loggers.
- **Correlated Logs**: Ensure all log lines emit the current `trace_id` and `span_id`. This allows bridging between logs and traces. (The native OTel Logs SDK handles this automatically via Context).
- **JSON Format**: Output logs in JSON format in production. Avoid unstructured string logging.

## 7. Security Gates

- **PII / Secrets Scrubbing**: Ensure sensitive PII, API keys, and secrets are scrubbed before logging attributes to spans or metrics. Never include passwords or tokens in trace attributes.
