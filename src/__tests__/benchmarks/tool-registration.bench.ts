/**
 * mysql-mcp - Tool Filtering & Registration Performance Benchmarks
 *
 * Measures filter parsing, tool registration, and definition caching.
 *
 * Run: pnpm run bench
 */

import { describe, bench, vi } from "vitest";
import { parseToolFilter } from "../../filtering/tool-filter.js";
import { TOOL_GROUPS, META_GROUPS } from "../../filtering/tool-constants.js";
import type { ToolGroup } from "../../types/index.js";

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

// ---------------------------------------------------------------------------
// 1. Filter Parsing
// ---------------------------------------------------------------------------
describe("parseToolFilter()", () => {
  bench(
    "no filter (all tools)",
    () => {
      parseToolFilter(undefined);
    },
    { iterations: 2000, warmupIterations: 20 },
  );

  bench(
    'simple meta-group ("starter")',
    () => {
      parseToolFilter("starter");
    },
    { iterations: 2000, warmupIterations: 20 },
  );

  bench(
    "complex filter expression",
    () => {
      parseToolFilter(
        "starter,+text,+spatial,-mysql_drop_table,-mysql_drop_schema",
      );
    },
    { iterations: 2000, warmupIterations: 20 },
  );

  bench(
    'codemode-only filter ("codemode")',
    () => {
      parseToolFilter("codemode");
    },
    { iterations: 2000, warmupIterations: 20 },
  );

  bench(
    "exclusion-mode filter (-cluster,-proxysql,...)",
    () => {
      parseToolFilter("-cluster,-proxysql,-router,-shell,-docstore,-spatial");
    },
    { iterations: 2000, warmupIterations: 20 },
  );
});

// ---------------------------------------------------------------------------
// 2. Lookup Operations
// ---------------------------------------------------------------------------
describe("Lookup Operations", () => {
  // Build a set of all tool names for lookup benchmarks
  const allToolNames = new Set<string>();
  for (const tools of Object.values(TOOL_GROUPS)) {
    for (const tool of tools) {
      allToolNames.add(tool);
    }
  }

  bench(
    "Set.has() tool name check",
    () => {
      allToolNames.has("mysql_read_query");
      allToolNames.has("mysql_json_extract");
      allToolNames.has("mysql_execute_code");
      allToolNames.has("mysql_nonexistent_tool");
    },
    { iterations: 5000, warmupIterations: 50 },
  );

  // Build a reverse lookup map (tool → group)
  const toolToGroup = new Map<string, string>();
  for (const [group, tools] of Object.entries(TOOL_GROUPS)) {
    for (const tool of tools) {
      toolToGroup.set(tool, group);
    }
  }

  bench(
    "Map.get() reverse lookup (tool → group) x4",
    () => {
      toolToGroup.get("mysql_read_query");
      toolToGroup.get("mysql_json_extract");
      toolToGroup.get("mysql_spatial_distance");
      toolToGroup.get("mysql_execute_code");
    },
    { iterations: 5000, warmupIterations: 50 },
  );

  bench(
    "expand meta-group to tool set",
    () => {
      const groups = META_GROUPS["starter"];
      const tools = new Set<string>();
      for (const group of groups) {
        for (const tool of TOOL_GROUPS[group]) {
          tools.add(tool);
        }
      }
      void tools.size;
    },
    { iterations: 2000, warmupIterations: 20 },
  );
});

// ---------------------------------------------------------------------------
// 3. Filter Summary & Catalog
// ---------------------------------------------------------------------------
describe("Filter Summary", () => {
  bench(
    "getToolGroupInfo() catalog (inline)",
    () => {
      Object.entries(TOOL_GROUPS).map(([group, tools]) => ({
        group: group as ToolGroup,
        count: tools.length,
        tools,
      }));
    },
    { iterations: 2000, warmupIterations: 20 },
  );

  bench(
    "total tool count (reduce)",
    () => {
      const total = Object.values(TOOL_GROUPS).reduce(
        (sum, tools) => sum + tools.length,
        0,
      );
      void total;
    },
    { iterations: 5000, warmupIterations: 50 },
  );
});
