/**
 * mysql-mcp - Prompts Unit Tests
 *
 * Tests for prompt definitions using centralized mocks.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { getMySQLPrompts } from "../index.js";
import type { MySQLAdapter } from "../../MySQLAdapter.js";
import {
  createMockMySQLAdapter,
  createMockRequestContext,
} from "../../../../__tests__/mocks/index.js";

describe("getMySQLPrompts", () => {
  let prompts: ReturnType<typeof getMySQLPrompts>;
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    prompts = getMySQLPrompts(mockAdapter as unknown as MySQLAdapter);
  });

  it("should return 19 prompts", () => {
    expect(prompts).toHaveLength(19);
  });

  it("should have handler functions for all prompts", () => {
    for (const prompt of prompts) {
      expect(typeof prompt.handler).toBe("function");
    }
  });

  it("should have descriptions for all prompts", () => {
    for (const prompt of prompts) {
      expect(prompt.description).toBeDefined();
      expect(prompt.description.length).toBeGreaterThan(0);
    }
  });

  it("should have unique names for all prompts", () => {
    const names = prompts.map((p) => p.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });
});

describe("Prompt Handler Execution", () => {
  let prompts: ReturnType<typeof getMySQLPrompts>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    const mockAdapter = createMockMySQLAdapter();
    prompts = getMySQLPrompts(mockAdapter as unknown as MySQLAdapter);
    mockContext = createMockRequestContext();
  });

  const findPrompt = (name: string) => prompts.find((p) => p.name === name);

  describe("mysql_query_builder", () => {
    it("should return message with query guidance", async () => {
      const prompt = findPrompt("mysql_query_builder");
      expect(prompt).toBeDefined();

      const result = (await prompt!.handler(
        { query_type: "SELECT", table: "users" },
        mockContext,
      )) as string;
      expect(typeof result).toBe("string");
      expect(result).toContain("query");
      expect(result).toContain("table");
    });
  });

  describe("mysql_tool_index", () => {
    it("should return tool index content", async () => {
      const prompt = findPrompt("mysql_tool_index");
      expect(prompt).toBeDefined();

      const result = (await prompt!.handler({}, mockContext)) as string;
      expect(typeof result).toBe("string");
      expect(result).toContain("tool");
    });
  });

  describe("mysql_quick_query", () => {
    it("should return read query guidance by default", async () => {
      const prompt = findPrompt("mysql_quick_query");
      const result = (await prompt!.handler(
        { query: "SELECT * FROM users" },
        mockContext,
      )) as string;
      expect(result).toContain("mysql_read_query");
    });

    it("should return write query guidance when type is write", async () => {
      const prompt = findPrompt("mysql_quick_query");
      const result = (await prompt!.handler(
        { sql: "INSERT INTO users...", type: "write" },
        mockContext,
      )) as string;
      expect(result).toContain("mysql_write_query");
    });
  });

  describe("mysql_schema_design", () => {
    it("should return schema design guidance", async () => {
      const prompt = findPrompt("mysql_schema_design");
      const result = (await prompt!.handler(
        { entity: "User" },
        mockContext,
      )) as string;
      expect(result).toContain("CREATE TABLE");
    });

    it("should include specific requirements if provided", async () => {
      const prompt = findPrompt("mysql_schema_design");
      const result = (await prompt!.handler(
        { entity: "User", requirements: "Must include email indexing" },
        mockContext,
      )) as string;
      expect(result).toContain("Must include email indexing");
    });
  });

  describe("mysql_performance_analysis", () => {
    it("should return performance analysis guidance", async () => {
      const prompt = findPrompt("mysql_performance_analysis");
      const result = (await prompt!.handler(
        { query: "SELECT * FROM slow_table" },
        mockContext,
      )) as string;
      expect(result).toContain("EXPLAIN");
    });

    it("should include context if provided", async () => {
      const prompt = findPrompt("mysql_performance_analysis");
      const result = (await prompt!.handler(
        { query: "SELECT * FROM slow_table", context: "Table has 1M rows" },
        mockContext,
      )) as string;
      expect(result).toContain("Table has 1M rows");
    });
  });

  describe("mysql_migration", () => {
    it("should return migration guidance", async () => {
      const prompt = findPrompt("mysql_migration");
      expect(prompt).toBeDefined();

      const result = (await prompt!.handler(
        { change: "Add column", table: "users" },
        mockContext,
      )) as string;
      expect(typeof result).toBe("string");
      expect(result).toContain("migration");
    });
  });

  describe("mysql_database_health_check", () => {
    it("should return health check guidance", async () => {
      const prompt = findPrompt("mysql_database_health_check");
      expect(prompt).toBeDefined();

      const result = await prompt!.handler({}, mockContext);
      expect(typeof result).toBe("string");
      expect(result).toContain("health");
    });

    it("should include focus area if provided", async () => {
      const prompt = findPrompt("mysql_database_health_check");
      const result = (await prompt!.handler(
        { focus: "security" },
        mockContext,
      )) as string;
      expect(result).toContain("**Focus area:** security");
    });
  });

  describe("mysql_backup_strategy", () => {
    it("should return backup strategy guidance", async () => {
      const prompt = findPrompt("mysql_backup_strategy");
      expect(prompt).toBeDefined();

      const result = await prompt!.handler(
        { rto: "1 hour", rpo: "15 minutes" },
        mockContext,
      );
      expect(typeof result).toBe("string");
      expect(result).toContain("backup");
    });

    it("should handle missing arguments with defaults", async () => {
      const prompt = findPrompt("mysql_backup_strategy");
      const result = (await prompt!.handler({}, mockContext)) as string;
      expect(result).toContain("to be determined");
      expect(result).toContain("unknown");
    });
  });

  describe("mysql_quick_schema", () => {
    it("should return schema exploration guidance (list tables) when no table specified", async () => {
      const prompt = findPrompt("mysql_quick_schema");
      const result = (await prompt!.handler({}, mockContext)) as string;
      expect(result).toContain("mysql_list_tables");
    });

    it("should return describe table guidance when table is specified", async () => {
      const prompt = findPrompt("mysql_quick_schema");
      const result = (await prompt!.handler(
        { table: "users" },
        mockContext,
      )) as string;
      expect(result).toContain("mysql_describe_table");
      expect(result).toContain("users");
    });
  });

  describe("mysql_index_tuning", () => {
    it("should return index tuning guidance", async () => {
      const prompt = findPrompt("mysql_index_tuning");
      expect(prompt).toBeDefined();

      const result = await prompt!.handler({ table: "orders" }, mockContext);
      expect(typeof result).toBe("string");
      expect(result).toContain("orders");
    });
  });

  describe("mysql_setup_router", () => {
    it("should return router setup guidance", async () => {
      const prompt = findPrompt("mysql_setup_router");
      expect(prompt).toBeDefined();

      const result = await prompt!.handler({}, mockContext);
      expect(typeof result).toBe("string");
      expect(result).toContain("Router");
    });
  });

  describe("mysql_setup_proxysql", () => {
    it("should return proxysql setup guidance", async () => {
      const prompt = findPrompt("mysql_setup_proxysql");
      expect(prompt).toBeDefined();

      const result = await prompt!.handler({}, mockContext);
      expect(typeof result).toBe("string");
      expect(result).toContain("ProxySQL");
    });
  });

  describe("mysql_setup_replication", () => {
    it("should return replication setup guidance", async () => {
      const prompt = findPrompt("mysql_setup_replication");
      expect(prompt).toBeDefined();

      const result = await prompt!.handler({}, mockContext);
      expect(typeof result).toBe("string");
      expect(result).toContain("replication");
    });

    it("should return semisync configuration when requested", async () => {
      const prompt = findPrompt("mysql_setup_replication");
      const result = (await prompt!.handler(
        { type: "semisync" },
        mockContext,
      )) as string;
      expect(result).toContain("rpl_semi_sync_replica_enabled");
    });
  });

  describe("mysql_setup_shell", () => {
    it("should return shell setup guidance", async () => {
      const prompt = findPrompt("mysql_setup_shell");
      expect(prompt).toBeDefined();

      const result = await prompt!.handler({}, mockContext);
      expect(typeof result).toBe("string");
      expect(result).toContain("MySQL Shell");
    });
  });

  describe("mysql_setup_events", () => {
    it("should return event scheduler guidance", async () => {
      const prompt = findPrompt("mysql_setup_events");
      expect(prompt).toBeDefined();

      const result = await prompt!.handler({}, mockContext);
      expect(typeof result).toBe("string");
      expect(result).toContain("event");
    });
  });

  describe("mysql_sys_schema_guide", () => {
    it("should return sys schema guidance", async () => {
      const prompt = findPrompt("mysql_sys_schema_guide");
      expect(prompt).toBeDefined();

      const result = await prompt!.handler({}, mockContext);
      expect(typeof result).toBe("string");
      expect(result).toContain("sys");
    });
  });

  describe("mysql_setup_spatial", () => {
    it("should return spatial setup guidance", async () => {
      const prompt = findPrompt("mysql_setup_spatial");
      expect(prompt).toBeDefined();

      const result = await prompt!.handler({}, mockContext);
      expect(typeof result).toBe("string");
      expect(result).toContain("spatial");
    });
  });

  describe("mysql_setup_cluster", () => {
    it("should return cluster setup guidance", async () => {
      const prompt = findPrompt("mysql_setup_cluster");
      expect(prompt).toBeDefined();

      const result = await prompt!.handler({}, mockContext);
      expect(typeof result).toBe("string");
      expect(result).toContain("cluster");
    });
  });

  describe("mysql_setup_docstore", () => {
    it("should return docstore setup guidance", async () => {
      const prompt = findPrompt("mysql_setup_docstore");
      expect(prompt).toBeDefined();

      const result = await prompt!.handler({}, mockContext);
      expect(typeof result).toBe("string");
      expect(result).toContain("document");
    });
  });
});
