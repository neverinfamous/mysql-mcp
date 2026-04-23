/**
 * mysql-mcp - Resource & Prompt Generation Performance Benchmarks
 *
 * Measures resource URI matching, prompt generation, and the
 * overhead of compact tool index / discovery prompt assembly.
 *
 * Run: pnpm run bench
 */

import { describe, bench, vi } from "vitest";

// Suppress logger output
vi.mock("../../utils/logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    notice: vi.fn(),
    critical: vi.fn(),
    alert: vi.fn(),
    emergency: vi.fn(),
    setLevel: vi.fn(),
    setMcpServer: vi.fn(),
  },
}));

// Resource URI templates (same pattern as mysql-mcp)
const resourceTemplates = [
  { uriTemplate: "mysql://schema", name: "Database Schema" },
  { uriTemplate: "mysql://tables", name: "Table List" },
  { uriTemplate: "mysql://variables", name: "Server Variables" },
  { uriTemplate: "mysql://status", name: "Server Status" },
  { uriTemplate: "mysql://processlist", name: "Process List" },
  { uriTemplate: "mysql://pool", name: "Connection Pool" },
  { uriTemplate: "mysql://capabilities", name: "Capabilities" },
  { uriTemplate: "mysql://health", name: "Health Check" },
  { uriTemplate: "mysql://performance", name: "Performance Stats" },
  { uriTemplate: "mysql://indexes", name: "Indexes" },
  { uriTemplate: "mysql://replication", name: "Replication Status" },
  { uriTemplate: "mysql://innodb", name: "InnoDB Metrics" },
  { uriTemplate: "mysql://events", name: "Events" },
  { uriTemplate: "mysql://sysschema", name: "Sys Schema" },
  { uriTemplate: "mysql://locks", name: "Active Locks" },
  { uriTemplate: "mysql://cluster", name: "Cluster Status" },
  { uriTemplate: "mysql://spatial", name: "Spatial Metadata" },
  { uriTemplate: "mysql://docstore", name: "Document Store" },
  { uriTemplate: "mysql://insights", name: "Business Insights" },
];

// ---------------------------------------------------------------------------
// 1. Resource URI Matching
// ---------------------------------------------------------------------------
describe("Resource URI Matching", () => {
  const resourceMap = new Map<string, (typeof resourceTemplates)[0]>();
  for (const template of resourceTemplates) {
    resourceMap.set(template.uriTemplate, template);
  }

  bench(
    "Map.get() single URI match",
    () => {
      resourceMap.get("mysql://schema");
    },
    { iterations: 50000, warmupIterations: 500 },
  );

  bench(
    "Map.get() miss (unknown URI)",
    () => {
      resourceMap.get("mysql://nonexistent");
    },
    { iterations: 50000, warmupIterations: 500 },
  );

  bench(
    "scan all resource templates (Array.find())",
    () => {
      const targetUri = "mysql://docstore";
      resourceTemplates.find((t) => t.uriTemplate === targetUri);
    },
    { iterations: 30000, warmupIterations: 300 },
  );

  bench(
    "list all resources (Array.map → URIs)",
    () => {
      const uris = resourceTemplates.map((t) => t.uriTemplate);
      void uris.length;
    },
    { iterations: 10000, warmupIterations: 100 },
  );
});

// ---------------------------------------------------------------------------
// 2. Prompt Message Assembly
// ---------------------------------------------------------------------------
describe("Prompt Message Assembly", () => {
  bench(
    "build prompt messages array (3 messages)",
    () => {
      const messages = [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: "How do I set up replication in MySQL?",
          },
        },
        {
          role: "assistant" as const,
          content: {
            type: "text" as const,
            text: "To set up MySQL replication, first configure the source...",
          },
        },
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: "What about GTID-based replication?",
          },
        },
      ];
      void JSON.stringify(messages);
    },
    { iterations: 5000, warmupIterations: 50 },
  );

  bench(
    "prompt argument schema parse (simple)",
    () => {
      // Simulate what prompt handlers do: validate arguments
      const args: Record<string, string | undefined> = {
        topic: "replication",
        feature: "gtid",
      };
      const validated: Record<string, string> = {};
      for (const [key, value] of Object.entries(args)) {
        if (typeof value === "string" && value.length > 0) {
          validated[key] = value;
        }
      }
      void validated;
    },
    { iterations: 10000, warmupIterations: 100 },
  );
});
