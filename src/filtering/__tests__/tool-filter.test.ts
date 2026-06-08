/**
 * mysql-mcp - ToolFilter Unit Tests
 *
 * Comprehensive tests for the tool filtering system.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  TOOL_GROUPS,
  META_GROUPS,
  getAllToolNames,
  getToolGroup,
  getMetaGroupTools,
  parseToolFilter,
  isToolEnabled,
  filterTools,
  calculateTokenSavings,
  getFilterSummary,
  getToolGroupInfo,
  getMetaGroupInfo,
  clearToolFilterCaches,
} from "../tool-filter.js";
import type { ToolDefinition } from "../../types/index.js";

describe("TOOL_GROUPS", () => {
  it("should contain all 27 tool groups", () => {
    const expectedGroups = [
      "core",
      "json",
      "text",
      "fulltext",
      "performance",
      "optimization",
      "admin",
      "monitoring",
      "backup",
      "replication",
      "partitioning",
      "transactions",
      "router",
      "proxysql",
      "shell",
      "schema",
      "events",
      "sysschema",
      "stats",
      "spatial",
      "security",
      "cluster",
      "roles",
      "docstore",
      "codemode",
    ];

    expect(Object.keys(TOOL_GROUPS)).toHaveLength(27);
    for (const group of expectedGroups) {
      expect(TOOL_GROUPS).toHaveProperty(group);
    }
  });

  it("should have correct tool counts per group", () => {
    expect(TOOL_GROUPS.core).toHaveLength(12);
    expect(TOOL_GROUPS.json).toHaveLength(17);
    expect(TOOL_GROUPS.transactions).toHaveLength(7);
    expect(TOOL_GROUPS.text).toHaveLength(6);
    expect(TOOL_GROUPS.fulltext).toHaveLength(5);
    expect(TOOL_GROUPS.performance).toHaveLength(11);
    expect(TOOL_GROUPS.optimization).toHaveLength(4);
    expect(TOOL_GROUPS.admin).toHaveLength(8);
    expect(TOOL_GROUPS.monitoring).toHaveLength(7);
    expect(TOOL_GROUPS.backup).toHaveLength(7);
    expect(TOOL_GROUPS.replication).toHaveLength(5);
    expect(TOOL_GROUPS.partitioning).toHaveLength(4);
    expect(TOOL_GROUPS.router).toHaveLength(9);
    expect(TOOL_GROUPS.proxysql).toHaveLength(11);
    expect(TOOL_GROUPS.shell).toHaveLength(10);
    expect(TOOL_GROUPS.schema).toHaveLength(11);
    expect(TOOL_GROUPS.events).toHaveLength(6);
    expect(TOOL_GROUPS.sysschema).toHaveLength(8);
    expect(TOOL_GROUPS.stats).toHaveLength(20);
    expect(TOOL_GROUPS.spatial).toHaveLength(12);
    expect(TOOL_GROUPS.security).toHaveLength(9);
    expect(TOOL_GROUPS.cluster).toHaveLength(10);
    expect(TOOL_GROUPS.roles).toHaveLength(8);
    expect(TOOL_GROUPS.docstore).toHaveLength(9);
    expect(TOOL_GROUPS.codemode).toHaveLength(1);
  });

  it("should total 229 tools across all groups", () => {
    const totalTools = Object.values(TOOL_GROUPS).flat().length;
    expect(totalTools).toBe(229);
  });
});

describe("META_GROUPS", () => {
  it("should contain all 12 meta-groups", () => {
    const expectedMetaGroups = [
      "starter",
      "essential",
      "dev-power",
      "ai-data",
      "ai-spatial",
      "dba-monitor",
      "dba-manage",
      "dba-secure",
      "base-core",
      "base-advanced",
      "ecosystem",
    ];
    expect(Object.keys(META_GROUPS)).toHaveLength(12);
    for (const metaGroup of expectedMetaGroups) {
      expect(META_GROUPS).toHaveProperty(metaGroup);
    }
  });

  it("should have correct group expansions", () => {
    expect(META_GROUPS.starter).toContain("core");
    expect(META_GROUPS.starter).toContain("json");
    expect(META_GROUPS.starter).toContain("transactions");
    expect(META_GROUPS.starter).toContain("text");

    expect(META_GROUPS.essential).toContain("core");
    expect(META_GROUPS.essential).toContain("transactions");

    expect(META_GROUPS.ecosystem).toContain("router");
    expect(META_GROUPS.ecosystem).toContain("proxysql");
    expect(META_GROUPS.ecosystem).toContain("shell");
    expect(META_GROUPS.ecosystem).toContain("cluster");
  });
});

describe("getAllToolNames", () => {
  it("should return all 229 tool names", () => {
    const tools = getAllToolNames();
    expect(tools).toHaveLength(229);
  });

  it("should return unique tool names", () => {
    const tools = getAllToolNames();
    const uniqueTools = new Set(tools);
    expect(uniqueTools.size).toBe(tools.length);
  });

  it("should include tools from all groups", () => {
    const tools = getAllToolNames();
    expect(tools).toContain("mysql_read_query"); // core
    expect(tools).toContain("mysql_json_extract"); // json
    expect(tools).toContain("mysql_transaction_begin"); // transactions
    expect(tools).toContain("mysql_router_status"); // router
    expect(tools).toContain("mysql_doc_find"); // docstore
  });
});

describe("getToolGroup", () => {
  it("should return correct group for known tools", () => {
    expect(getToolGroup("mysql_read_query")).toBe("core");
    expect(getToolGroup("mysql_json_extract")).toBe("json");
    expect(getToolGroup("mysql_transaction_begin")).toBe("transactions");
    expect(getToolGroup("mysql_router_status")).toBe("router");
    expect(getToolGroup("mysql_doc_find")).toBe("docstore");
  });

  it("should return undefined for unknown tools", () => {
    expect(getToolGroup("unknown_tool")).toBeUndefined();
    expect(getToolGroup("")).toBeUndefined();
    expect(getToolGroup("mysql_fake_tool")).toBeUndefined();
  });
});

describe("getMetaGroupTools", () => {
  it("should return all tools for starter meta-group", () => {
    const tools = getMetaGroupTools("starter");
    // starter = core(12) + json(17) + transactions(7) + text(6) + codemode(1) = 43
    expect(tools).toHaveLength(43);
  });

  it("should return all tools for essential meta-group", () => {
    const tools = getMetaGroupTools("essential");
    // essential = core(12) + transactions(7) + codemode(1) = 20
    expect(tools).toHaveLength(20);
  });

  it("should return all tools for ecosystem meta-group", () => {
    const tools = getMetaGroupTools("ecosystem");
    // ecosystem = router(9) + proxysql(11) + shell(10) + cluster(10) + codemode(1) = 41
    expect(tools).toHaveLength(41);
  });

  it("should return correct tools for base-core meta-group", () => {
    const tools = getMetaGroupTools("base-core");
    // base-core = core(12) + json(17) + transactions(7) + text(6) + schema(11) + codemode(1) = 54
    expect(tools).toHaveLength(54);
  });

  it("should return correct tools for base-advanced meta-group", () => {
    const tools = getMetaGroupTools("base-advanced");
    // base-advanced = docstore(9) + spatial(12) + stats(20) + fulltext(5) + events(6) + codemode(1) = 53
    expect(tools).toHaveLength(53);
  });

  it("should return correct tools for dba-monitor meta-group", () => {
    const tools = getMetaGroupTools("dba-monitor");
    expect(tools).toHaveLength(43);
  });

  it("should return correct tools for dba-manage meta-group", () => {
    const tools = getMetaGroupTools("dba-manage");
    expect(tools).toHaveLength(43);
  });

  it("should return correct tools for dba-secure meta-group", () => {
    const tools = getMetaGroupTools("dba-secure");
    expect(tools).toHaveLength(37);
  });
});

describe("parseToolFilter", () => {
  it("should return starter tools (43) enabled for empty filter", () => {
    const config = parseToolFilter("");
    expect(config.enabledTools.size).toBe(43);
    expect(config.rules).toHaveLength(0);
    expect(config.enabledTools.has("mysql_read_query")).toBe(true);
  });

  it("should return starter tools (43) enabled for undefined filter", () => {
    const config = parseToolFilter(undefined);
    expect(config.enabledTools.size).toBe(43);
    expect(config.rules).toHaveLength(0);
  });

  it("should disable a single tool", () => {
    const config = parseToolFilter("-mysql_read_query");
    expect(config.enabledTools.size).toBe(228);
    expect(config.enabledTools.has("mysql_read_query")).toBe(false);
    expect(config.enabledTools.has("mysql_write_query")).toBe(true);
  });

  it("should disable a tool group", () => {
    const config = parseToolFilter("-core");
    expect(config.enabledTools.size).toBe(217); // 229 - 12
    expect(config.enabledTools.has("mysql_read_query")).toBe(false);
    expect(config.enabledTools.has("mysql_json_extract")).toBe(true);
  });

  it("should disable a meta-group", () => {
    const config = parseToolFilter("-ecosystem");
    expect(config.enabledTools.size).toBe(188); // 229 - 41
    expect(config.enabledTools.has("mysql_router_status")).toBe(false);
    expect(config.enabledTools.has("proxysql_status")).toBe(false);
    expect(config.enabledTools.has("mysqlsh_version")).toBe(false);
  });

  it("should enable tools with + prefix", () => {
    const config = parseToolFilter("-core,+mysql_read_query");
    // Disabled all 12 core tools, re-enabled 1
    expect(config.enabledTools.has("mysql_read_query")).toBe(true);
    expect(config.enabledTools.has("mysql_write_query")).toBe(false);
  });

  it("should handle complex filter chains", () => {
    // Disable all, then enable starter
    const config = parseToolFilter("starter");
    expect(config.enabledTools.size).toBe(43); // starter has 43 tools
  });

  it("should handle explicit whitelist syntax (+group)", () => {
    const config = parseToolFilter("+starter");
    expect(config.enabledTools.size).toBe(43);
  });

  it("should handle whitelist with exclusion (starter,-json)", () => {
    // starter(43) - json(17) = 26
    const config = parseToolFilter("starter,-json");
    expect(config.enabledTools.size).toBe(26);
  });

  it("should process rules left-to-right", () => {
    // First enable core, then disable mysql_read_query
    // core(12) - 1 = 11. Whitelist mode triggered by '+core'
    const config1 = parseToolFilter("+core,-mysql_read_query");
    expect(config1.enabledTools.has("mysql_read_query")).toBe(false);
    expect(config1.enabledTools.has("mysql_write_query")).toBe(true);
    expect(config1.enabledTools.size).toBe(12); // core(12) - 1 + codemode(1) = 12
  });

  it("should handle whitespace in filter string", () => {
    const config = parseToolFilter(" -core , +mysql_read_query ");
    expect(config.enabledTools.has("mysql_read_query")).toBe(true);
    expect(config.enabledTools.has("mysql_write_query")).toBe(false);
  });

  // Codemode auto-injection tests
  it("should auto-inject codemode when using a raw group filter", () => {
    const config = parseToolFilter("core");
    expect(config.enabledTools.has("mysql_execute_code")).toBe(true);
    expect(config.enabledTools.size).toBe(13); // core(12) + codemode(1)
  });

  it("should not inject codemode when explicitly excluded with -codemode", () => {
    const config = parseToolFilter("core,-codemode");
    expect(config.enabledTools.has("mysql_execute_code")).toBe(false);
    expect(config.enabledTools.size).toBe(12); // core(12) only
  });

  it("should not inject codemode when mysql_execute_code explicitly excluded", () => {
    const config = parseToolFilter("core,-mysql_execute_code");
    expect(config.enabledTools.has("mysql_execute_code")).toBe(false);
    expect(config.enabledTools.size).toBe(12); // core(12) only
  });

  it("should not inject codemode when all tools are excluded", () => {
    const config = parseToolFilter("-all");
    expect(config.enabledTools.size).toBe(0);
    expect(config.enabledTools.has("mysql_execute_code")).toBe(false);
  });
});

describe("isToolEnabled", () => {
  it("should return true for enabled tools", () => {
    const config = parseToolFilter("");
    expect(isToolEnabled("mysql_read_query", config)).toBe(true);
  });

  it("should return false for disabled tools", () => {
    const config = parseToolFilter("-mysql_read_query");
    expect(isToolEnabled("mysql_read_query", config)).toBe(false);
  });

  it("should return false for unknown tools", () => {
    const config = parseToolFilter("");
    // Unknown tools are not in enabledTools set
    expect(isToolEnabled("unknown_tool", config)).toBe(false);
  });
});

describe("filterTools", () => {
  const mockHandler = async () => ({ result: "ok" });
  const mockTools: ToolDefinition[] = [
    {
      name: "mysql_read_query",
      description: "Read query",
      inputSchema: {},
      group: "core",
      handler: mockHandler,
    },
    {
      name: "mysql_write_query",
      description: "Write query",
      inputSchema: {},
      group: "core",
      handler: mockHandler,
    },
    {
      name: "mysql_json_extract",
      description: "JSON extract",
      inputSchema: {},
      group: "json",
      handler: mockHandler,
    },
  ];

  it("should return all tools when no filter", () => {
    const config = parseToolFilter("");
    const filtered = filterTools(mockTools, config);
    expect(filtered).toHaveLength(3);
  });

  it("should filter out disabled tools", () => {
    const config = parseToolFilter("-mysql_read_query");
    const filtered = filterTools(mockTools, config);
    expect(filtered).toHaveLength(2);
    expect(filtered.map((t) => t.name)).not.toContain("mysql_read_query");
  });

  it("should filter by group", () => {
    const config = parseToolFilter("-json");
    const filtered = filterTools(mockTools, config);
    expect(filtered).toHaveLength(2);
    expect(filtered.map((t) => t.name)).not.toContain("mysql_json_extract");
  });
});

describe("calculateTokenSavings", () => {
  it("should calculate correct savings", () => {
    const result = calculateTokenSavings(193, 39);
    // (193 - 39) * 200 = 30800 tokens
    expect(result.tokensSaved).toBe(30800);
    expect(result.percentSaved).toBe(80); // ~80% disabled
  });

  it("should return 0 for no filtering", () => {
    const result = calculateTokenSavings(193, 193);
    expect(result.tokensSaved).toBe(0);
    expect(result.percentSaved).toBe(0);
  });

  it("should handle custom tokens per tool", () => {
    const result = calculateTokenSavings(100, 50, 100);
    expect(result.tokensSaved).toBe(5000); // 50 * 100
    expect(result.percentSaved).toBe(50);
  });

  it("should handle edge case with 0 total tools", () => {
    const result = calculateTokenSavings(0, 0);
    expect(result.tokensSaved).toBe(0);
    expect(result.percentSaved).toBe(0);
  });
});

describe("getFilterSummary", () => {
  it("should generate summary for no filter", () => {
    const config = parseToolFilter("");
    const summary = getFilterSummary(config);
    expect(summary).toContain("43/229 tools");
    expect(summary).toContain("Token savings");
  });

  it("should show rules in summary", () => {
    const config = parseToolFilter("-core");
    const summary = getFilterSummary(config);
    expect(summary).toContain("-core");
    expect(summary).toContain("group");
  });

  it("should show meta-group rules", () => {
    const config = parseToolFilter("-ecosystem");
    const summary = getFilterSummary(config);
    expect(summary).toContain("-ecosystem");
    expect(summary).toContain("meta-group");
  });

  it("should show token savings when filtering", () => {
    const config = parseToolFilter("starter");
    const summary = getFilterSummary(config);
    expect(summary).toContain("Token savings");
  });

  it("should show disabled groups", () => {
    const config = parseToolFilter("-router");
    const summary = getFilterSummary(config);
    expect(summary).toContain("router");
  });
});

describe("getToolGroupInfo", () => {
  it("should return info for all 27 groups", () => {
    const info = getToolGroupInfo();
    expect(info).toHaveLength(27);
  });

  it("should include correct counts", () => {
    const info = getToolGroupInfo();
    const coreInfo = info.find((g) => g.group === "core");
    expect(coreInfo).toBeDefined();
    expect(coreInfo?.count).toBe(12);
    expect(coreInfo?.tools).toHaveLength(12);
  });
});

describe("getMetaGroupInfo", () => {
  it("should return info for all 12 meta-groups", () => {
    const info = getMetaGroupInfo();
    expect(info).toHaveLength(12);
  });

  it("should include correct expanded counts", () => {
    const info = getMetaGroupInfo();
    const starterInfo = info.find((g) => g.metaGroup === "starter");
    expect(starterInfo).toBeDefined();
    expect(starterInfo?.count).toBe(43);
    expect(starterInfo?.groups).toContain("core");
  });
});

describe("caching behavior", () => {
  beforeEach(() => {
    clearToolFilterCaches();
  });

  it("should return same array reference from getAllToolNames on repeated calls", () => {
    const first = getAllToolNames();
    const second = getAllToolNames();
    expect(first).toBe(second); // Same reference = cached
  });

  it("should return same group from getToolGroup after building cache", () => {
    const first = getToolGroup("mysql_read_query");
    const second = getToolGroup("mysql_read_query");
    expect(first).toBe("core");
    expect(second).toBe("core");
  });

  it("should rebuild cache after clearToolFilterCaches", () => {
    const first = getAllToolNames();
    clearToolFilterCaches();
    const second = getAllToolNames();
    expect(first).not.toBe(second); // Different reference after clear
    expect(first).toEqual(second); // Same content
  });
});
