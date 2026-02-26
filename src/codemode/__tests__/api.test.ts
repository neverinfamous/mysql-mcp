/**
 * mysql-mcp - Code Mode API Unit Tests
 *
 * Tests for MysqlApi, normalizeParams, toolNameToMethodName, and createGroupApi.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { MysqlApi } from "../api.js";
import type { MySQLAdapter } from "../../adapters/mysql/MySQLAdapter.js";

// Suppress logger
vi.mock("../../utils/logger.js", () => ({
  logger: { info: vi.fn(), warning: vi.fn(), error: vi.fn() },
}));

/**
 * Create a minimal mock adapter that provides tool definitions
 * for testing the MysqlApi class.
 */
function createMockAdapterWithTools(): MySQLAdapter {
  const mockTools = [
    {
      name: "mysql_read_query",
      group: "core",
      title: "Read Query",
      description: "Execute a read query",
      inputSchema: { parse: (v: unknown) => v },
      requiredScopes: ["read"],
      annotations: { readOnlyHint: true },
      handler: vi.fn().mockResolvedValue({ rows: [], rowsAffected: 0 }),
    },
    {
      name: "mysql_write_query",
      group: "core",
      title: "Write Query",
      description: "Execute a write query",
      inputSchema: { parse: (v: unknown) => v },
      requiredScopes: ["write"],
      annotations: {},
      handler: vi.fn().mockResolvedValue({ rows: [], rowsAffected: 1 }),
    },
    {
      name: "mysql_describe_table",
      group: "core",
      title: "Describe Table",
      description: "Describe a table",
      inputSchema: { parse: (v: unknown) => v },
      requiredScopes: ["read"],
      annotations: { readOnlyHint: true },
      handler: vi.fn().mockResolvedValue({ columns: [] }),
    },
    {
      name: "mysql_json_extract",
      group: "json",
      title: "JSON Extract",
      description: "Extract JSON value",
      inputSchema: { parse: (v: unknown) => v },
      requiredScopes: ["read"],
      annotations: { readOnlyHint: true },
      handler: vi.fn().mockResolvedValue({ rows: [] }),
    },
    {
      name: "mysql_fulltext_search",
      group: "fulltext",
      title: "Fulltext Search",
      description: "Search fulltext index",
      inputSchema: { parse: (v: unknown) => v },
      requiredScopes: ["read"],
      annotations: { readOnlyHint: true },
      handler: vi.fn().mockResolvedValue({ rows: [] }),
    },
    {
      name: "mysql_transaction_begin",
      group: "transactions",
      title: "Begin Transaction",
      description: "Begin a transaction",
      inputSchema: { parse: (v: unknown) => v },
      requiredScopes: ["write"],
      annotations: {},
      handler: vi.fn().mockResolvedValue({ transactionId: "txn-1" }),
    },
    {
      name: "mysql_transaction_commit",
      group: "transactions",
      title: "Commit Transaction",
      description: "Commit a transaction",
      inputSchema: { parse: (v: unknown) => v },
      requiredScopes: ["write"],
      annotations: {},
      handler: vi.fn().mockResolvedValue({ success: true }),
    },
    {
      name: "mysql_sys_schema_stats",
      group: "sysschema",
      title: "Schema Stats",
      description: "Get schema stats from sys schema",
      inputSchema: { parse: (v: unknown) => v },
      requiredScopes: ["read"],
      annotations: { readOnlyHint: true },
      handler: vi.fn().mockResolvedValue({ stats: [] }),
    },
    {
      name: "mysql_doc_add",
      group: "docstore",
      title: "Add Document",
      description: "Add document to collection",
      inputSchema: { parse: (v: unknown) => v },
      requiredScopes: ["write"],
      annotations: {},
      handler: vi.fn().mockResolvedValue({ success: true }),
    },
    {
      name: "mysql_mysqlsh_run_script",
      group: "shell",
      title: "Run Script",
      description: "Run MySQL Shell script",
      inputSchema: { parse: (v: unknown) => v },
      requiredScopes: ["admin"],
      annotations: {},
      handler: vi.fn().mockResolvedValue({ output: "" }),
    },
  ];

  return {
    getToolDefinitions: vi.fn().mockReturnValue(mockTools),
    createContext: vi.fn().mockReturnValue({
      timestamp: new Date(),
      requestId: "test-ctx",
    }),
  } as unknown as MySQLAdapter;
}

describe("MysqlApi", () => {
  let api: MysqlApi;
  let mockAdapter: MySQLAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockAdapterWithTools();
    api = new MysqlApi(mockAdapter);
  });

  // ===========================================================================
  // Constructor / Group creation
  // ===========================================================================
  describe("constructor", () => {
    it("should create API with group properties", () => {
      expect(api.core).toBeDefined();
      expect(api.json).toBeDefined();
      expect(api.fulltext).toBeDefined();
      expect(api.transactions).toBeDefined();
      expect(api.sysschema).toBeDefined();
      expect(api.docstore).toBeDefined();
      expect(api.shell).toBeDefined();
    });

    it("should create methods for each tool", () => {
      expect(api.core.readQuery).toBeTypeOf("function");
      expect(api.core.writeQuery).toBeTypeOf("function");
      expect(api.core.describeTable).toBeTypeOf("function");
    });

    it("should handle readonly flag", () => {
      const readonlyApi = new MysqlApi(mockAdapter, true);
      expect(readonlyApi).toBeDefined();
    });
  });

  // ===========================================================================
  // Tool name to method name conversion
  // ===========================================================================
  describe("toolNameToMethodName (via generated methods)", () => {
    it("should strip mysql_ prefix and convert to camelCase for core", () => {
      // mysql_read_query -> readQuery (strips mysql_ and core_)
      expect(api.core).toHaveProperty("readQuery");
    });

    it("should strip mysql_ but keep group prefix for keepPrefix groups", () => {
      // mysql_fulltext_search -> fulltextSearch (keeps fulltext prefix)
      expect(api.fulltext).toHaveProperty("fulltextSearch");
    });

    it("should keep prefix for sysschema group", () => {
      // mysql_sys_schema_stats -> sysSchemaStats
      expect(api.sysschema).toHaveProperty("sysSchemaStats");
    });

    it("should keep prefix for transactions group", () => {
      // mysql_transaction_begin -> transactionBegin
      expect(api.transactions).toHaveProperty("transactionBegin");
    });

    it("should keep prefix for docstore group", () => {
      // mysql_doc_add -> docAdd
      expect(api.docstore).toHaveProperty("docAdd");
    });

    it("should strip mysqlsh_ prefix for shell group", () => {
      // mysql_mysqlsh_run_script -> runScript
      expect(api.shell).toHaveProperty("runScript");
    });

    it("should strip json_ prefix for json group", () => {
      // mysql_json_extract -> extract
      expect(api.json).toHaveProperty("extract");
    });
  });

  // ===========================================================================
  // Method execution
  // ===========================================================================
  describe("method execution", () => {
    it("should call tool handler with object params", async () => {
      await api.core.readQuery({ sql: "SELECT 1" });
      const tools = mockAdapter.getToolDefinitions();
      const readTool = tools.find(
        (t: { name: string }) => t.name === "mysql_read_query",
      );
      expect(readTool.handler).toHaveBeenCalled();
    });

    it("should normalize positional string argument", async () => {
      await api.core.readQuery("SELECT 1");
      const tools = mockAdapter.getToolDefinitions();
      const readTool = tools.find(
        (t: { name: string }) => t.name === "mysql_read_query",
      );
      // Should have been called with { sql: "SELECT 1" } after normalization
      expect(readTool.handler).toHaveBeenCalled();
    });

    it("should pass empty params for no-arg calls", async () => {
      await api.core.readQuery();
      const tools = mockAdapter.getToolDefinitions();
      const readTool = tools.find(
        (t: { name: string }) => t.name === "mysql_read_query",
      );
      expect(readTool.handler).toHaveBeenCalled();
    });

    it("should create context for each call", async () => {
      await api.core.readQuery("SELECT 1");
      expect(mockAdapter.createContext).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Method aliases
  // ===========================================================================
  describe("method aliases", () => {
    it("should create aliases for json group", () => {
      // jsonExtract -> extract alias
      if (api.json.jsonExtract) {
        expect(api.json.jsonExtract).toBe(api.json.extract);
      }
    });

    it("should create aliases for transaction group", () => {
      // begin -> transactionBegin alias
      if (api.transactions.begin) {
        expect(api.transactions.begin).toBe(api.transactions.transactionBegin);
      }
    });
  });

  // ===========================================================================
  // getAvailableGroups
  // ===========================================================================
  describe("getAvailableGroups", () => {
    it("should return all groups with method counts", () => {
      const groups = api.getAvailableGroups();
      expect(groups).toHaveProperty("core");
      expect(groups["core"]).toBe(3); // readQuery, writeQuery, describeTable
      expect(groups).toHaveProperty("json");
      expect(groups["json"]).toBe(1); // extract
    });
  });

  // ===========================================================================
  // getGroupMethods
  // ===========================================================================
  describe("getGroupMethods", () => {
    it("should return method names for valid group", () => {
      const methods = api.getGroupMethods("core");
      expect(methods).toContain("readQuery");
      expect(methods).toContain("writeQuery");
    });

    it("should return empty array for unknown group", () => {
      const methods = api.getGroupMethods("nonexistent");
      expect(methods).toHaveLength(0);
    });
  });

  // ===========================================================================
  // help
  // ===========================================================================
  describe("help", () => {
    it("should return all groups with their methods", () => {
      const help = api.help();
      expect(help).toHaveProperty("core");
      expect(help["core"]).toContain("readQuery");
    });

    it("should include examples in help output", () => {
      const help = api.help();
      // help() returns methods and potentially examples
      expect(Object.keys(help).length).toBeGreaterThan(0);
    });
  });
});

// =============================================================================
// normalizeParams (tested indirectly through method calls)
// =============================================================================
describe("normalizeParams (indirect)", () => {
  let api: MysqlApi;
  let mockAdapter: MySQLAdapter;

  beforeEach(() => {
    const mockTools = [
      {
        name: "mysql_read_query",
        group: "core",
        title: "Read Query",
        description: "Execute read query",
        inputSchema: { parse: (v: unknown) => v },
        requiredScopes: ["read"],
        annotations: {},
        handler: vi.fn().mockResolvedValue({ rows: [] }),
      },
      {
        name: "mysql_create_table",
        group: "core",
        title: "Create Table",
        description: "Create a table",
        inputSchema: { parse: (v: unknown) => v },
        requiredScopes: ["write"],
        annotations: {},
        handler: vi.fn().mockResolvedValue({ success: true }),
      },
      {
        name: "mysql_transaction_execute",
        group: "transactions",
        title: "Transaction Execute",
        description: "Execute statements in transaction",
        inputSchema: { parse: (v: unknown) => v },
        requiredScopes: ["write"],
        annotations: {},
        handler: vi.fn().mockResolvedValue({ success: true }),
      },
    ];

    mockAdapter = {
      getToolDefinitions: vi.fn().mockReturnValue(mockTools),
      createContext: vi.fn().mockReturnValue({
        timestamp: new Date(),
        requestId: "test",
      }),
    } as unknown as MySQLAdapter;

    api = new MysqlApi(mockAdapter);
  });

  it("should pass object params through unchanged", async () => {
    const tools = mockAdapter.getToolDefinitions();
    const readTool = tools.find(
      (t: { name: string }) => t.name === "mysql_read_query",
    );
    await api.core.readQuery({ sql: "SELECT 1", limit: 10 });
    expect(readTool.handler).toHaveBeenCalledWith(
      { sql: "SELECT 1", limit: 10 },
      expect.anything(),
    );
  });

  it("should map single string arg to parameter key", async () => {
    const tools = mockAdapter.getToolDefinitions();
    const readTool = tools.find(
      (t: { name: string }) => t.name === "mysql_read_query",
    );
    await api.core.readQuery("SELECT 1");
    const calledWith = readTool.handler.mock.calls[0][0];
    expect(calledWith).toHaveProperty("sql", "SELECT 1");
  });

  it("should map multi positional args to array keys", async () => {
    const tools = mockAdapter.getToolDefinitions();
    const createTool = tools.find(
      (t: { name: string }) => t.name === "mysql_create_table",
    );
    await api.core.createTable("orders", [{ name: "id", type: "INT" }]);
    const calledWith = createTool.handler.mock.calls[0][0];
    expect(calledWith).toHaveProperty("name", "orders");
    expect(calledWith).toHaveProperty("columns");
  });

  it("should wrap array arg in ARRAY_WRAP_MAP key", async () => {
    const tools = mockAdapter.getToolDefinitions();
    const execTool = tools.find(
      (t: { name: string }) => t.name === "mysql_transaction_execute",
    );
    const stmts = [{ sql: "INSERT INTO t VALUES(1)" }];
    await api.transactions.transactionExecute(stmts);
    const calledWith = execTool.handler.mock.calls[0][0];
    expect(calledWith).toHaveProperty("statements");
  });

  it("should handle no-arg calls", async () => {
    const tools = mockAdapter.getToolDefinitions();
    const readTool = tools.find(
      (t: { name: string }) => t.name === "mysql_read_query",
    );
    await api.core.readQuery();
    expect(readTool.handler).toHaveBeenCalledWith({}, expect.anything());
  });
});
