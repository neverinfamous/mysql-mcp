/**
 * mysql-mcp - DatabaseAdapter Unit Tests
 *
 * Tests for the abstract DatabaseAdapter base class methods.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { DatabaseAdapter } from "../DatabaseAdapter.js";
import type {
  DatabaseConfig,
  QueryResult,
  HealthStatus,
  SchemaInfo,
  TableInfo,
  AdapterCapabilities,
  ToolDefinition,
  ResourceDefinition,
  PromptDefinition,
  ToolGroup,
} from "../../types/index.js";

// Create a concrete implementation for testing
class TestAdapter extends DatabaseAdapter {
  readonly type = "mysql" as const;
  readonly name = "Test Adapter";
  readonly version = "1.0.0";

  private mockQueryResult: QueryResult = { rows: [], rowsAffected: 0 };
  private mockHealth: HealthStatus = { connected: true, latencyMs: 5 };

  async connect(_config: DatabaseConfig): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async getHealth(): Promise<HealthStatus> {
    return this.mockHealth;
  }

  async executeReadQuery(
    _sql: string,
    _params?: unknown[],
  ): Promise<QueryResult> {
    return this.mockQueryResult;
  }

  async executeWriteQuery(
    _sql: string,
    _params?: unknown[],
  ): Promise<QueryResult> {
    return this.mockQueryResult;
  }

  async executeQuery(_sql: string, _params?: unknown[]): Promise<QueryResult> {
    return this.mockQueryResult;
  }

  async getSchema(): Promise<SchemaInfo> {
    return { tables: [], views: [], indexes: [] };
  }

  async listTables(): Promise<TableInfo[]> {
    return [];
  }

  async describeTable(_tableName: string): Promise<TableInfo> {
    return { name: "test", type: "table", columns: [] };
  }

  async listSchemas(): Promise<string[]> {
    return ["test"];
  }

  getCapabilities(): AdapterCapabilities {
    return {
      json: true,
      fullTextSearch: true,
      vector: false,
      geospatial: true,
      transactions: true,
      preparedStatements: true,
      connectionPooling: true,
      partitioning: true,
      replication: true,
    };
  }

  getSupportedToolGroups(): ToolGroup[] {
    return ["core", "transactions"];
  }

  getToolDefinitions(): ToolDefinition[] {
    return [
      {
        name: "test_tool",
        title: "Test Tool",
        description: "A test tool",
        group: "core",
        inputSchema: {},
        handler: async () => ({ result: "ok" }),
      },
    ];
  }

  getResourceDefinitions(): ResourceDefinition[] {
    return [
      {
        uri: "mysql://test",
        name: "Test Resource",
        description: "A test resource",
        handler: async () => ({ data: "test" }),
      },
    ];
  }

  getPromptDefinitions(): PromptDefinition[] {
    return [
      {
        name: "test_prompt",
        description: "A test prompt",
        handler: async () => "Test prompt output",
      },
    ];
  }

  setQueryResult(result: QueryResult): void {
    this.mockQueryResult = result;
  }
}

describe("DatabaseAdapter", () => {
  let adapter: TestAdapter;

  beforeEach(() => {
    adapter = new TestAdapter();
  });

  describe("connection state", () => {
    it("should start disconnected", () => {
      expect(adapter.isConnected()).toBe(false);
    });

    it("should be connected after connect()", async () => {
      await adapter.connect({
        type: "mysql",
        host: "localhost",
        port: 3306,
        database: "test",
        username: "root",
        password: "",
      });
      expect(adapter.isConnected()).toBe(true);
    });

    it("should be disconnected after disconnect()", async () => {
      await adapter.connect({
        type: "mysql",
        host: "localhost",
        port: 3306,
        database: "test",
        username: "root",
        password: "",
      });
      await adapter.disconnect();
      expect(adapter.isConnected()).toBe(false);
    });
  });

  describe("adapter info", () => {
    it("should return correct type", () => {
      expect(adapter.type).toBe("mysql");
    });

    it("should return correct name", () => {
      expect(adapter.name).toBe("Test Adapter");
    });

    it("should return correct version", () => {
      expect(adapter.version).toBe("1.0.0");
    });

    it("should return adapter info object", () => {
      const info = adapter.getInfo();
      expect(info["type"]).toBe("mysql");
      expect(info["name"]).toBe("Test Adapter");
      expect(info["version"]).toBe("1.0.0");
      expect(info["connected"]).toBe(false);
    });
  });

  describe("capabilities", () => {
    it("should return capabilities", () => {
      const caps = adapter.getCapabilities();
      expect(caps.json).toBe(true);
      expect(caps.fullTextSearch).toBe(true);
      expect(caps.transactions).toBe(true);
    });

    it("should return supported tool groups", () => {
      const groups = adapter.getSupportedToolGroups();
      expect(groups).toContain("core");
      expect(groups).toContain("transactions");
    });
  });

  describe("definitions", () => {
    it("should return tool definitions", () => {
      const tools = adapter.getToolDefinitions();
      expect(tools.length).toBeGreaterThan(0);
      expect(tools[0]?.name).toBe("test_tool");
    });

    it("should return resource definitions", () => {
      const resources = adapter.getResourceDefinitions();
      expect(resources.length).toBeGreaterThan(0);
      expect(resources[0]?.uri).toBe("mysql://test");
    });

    it("should return prompt definitions", () => {
      const prompts = adapter.getPromptDefinitions();
      expect(prompts.length).toBeGreaterThan(0);
      expect(prompts[0]?.name).toBe("test_prompt");
    });
  });

  describe("request context", () => {
    it("should create context with default request id", () => {
      const context = adapter.createContext();
      expect(context.requestId).toBeTruthy();
    });

    it("should create context with specified request id", () => {
      const context = adapter.createContext("test-request-123");
      expect(context.requestId).toBe("test-request-123");
    });
  });

  describe("query validation", () => {
    it("should allow SELECT queries in read-only mode", () => {
      expect(() =>
        adapter.validateQuery("SELECT * FROM users", true),
      ).not.toThrow();
    });

    it("should reject INSERT in read-only mode", () => {
      expect(() =>
        adapter.validateQuery("INSERT INTO users VALUES (1)", true),
      ).toThrow();
    });

    it("should reject UPDATE in read-only mode", () => {
      expect(() =>
        adapter.validateQuery('UPDATE users SET name = "test"', true),
      ).toThrow();
    });

    it("should reject DELETE in read-only mode", () => {
      expect(() =>
        adapter.validateQuery("DELETE FROM users WHERE id = 1", true),
      ).toThrow();
    });

    it("should reject DROP in read-only mode", () => {
      expect(() => adapter.validateQuery("DROP TABLE users", true)).toThrow();
    });

    it("should allow write queries in non-read-only mode", () => {
      expect(() =>
        adapter.validateQuery("INSERT INTO users VALUES (1)", false),
      ).not.toThrow();
    });

    it("should reject dangerous patterns", () => {
      expect(() =>
        adapter.validateQuery("SELECT * FROM users; DROP TABLE users", false),
      ).toThrow();
    });

    it("should reject CREATE in read-only mode", () => {
      expect(() =>
        adapter.validateQuery("CREATE TABLE test (id INT)", true),
      ).toThrow();
    });

    it("should reject ALTER in read-only mode", () => {
      expect(() =>
        adapter.validateQuery(
          "ALTER TABLE users ADD column email VARCHAR(255)",
          true,
        ),
      ).toThrow();
    });

    it("should reject TRUNCATE in read-only mode", () => {
      expect(() =>
        adapter.validateQuery("TRUNCATE TABLE users", true),
      ).toThrow();
    });

    it("should reject REPLACE in read-only mode", () => {
      expect(() =>
        adapter.validateQuery('REPLACE INTO users VALUES (1, "test")', true),
      ).toThrow();
    });

    it("should reject GRANT in read-only mode", () => {
      expect(() =>
        adapter.validateQuery("GRANT SELECT ON users TO user1", true),
      ).toThrow();
    });

    it("should reject REVOKE in read-only mode", () => {
      expect(() =>
        adapter.validateQuery("REVOKE SELECT ON users FROM user1", true),
      ).toThrow();
    });

    it("should reject empty query", () => {
      expect(() => adapter.validateQuery("", true)).toThrow(
        "Query must be a non-empty string",
      );
    });

    it("should reject non-string query", () => {
      expect(() => adapter.validateQuery(null as never, true)).toThrow();
    });

    it("should reject SQL comment injection patterns", () => {
      expect(() =>
        adapter.validateQuery("SELECT * FROM users --", false),
      ).toThrow();
    });

    it("should reject dangerous DELETE pattern", () => {
      expect(() =>
        adapter.validateQuery("SELECT 1; DELETE FROM users", false),
      ).toThrow();
    });

    it("should reject dangerous TRUNCATE pattern", () => {
      expect(() =>
        adapter.validateQuery("SELECT 1; TRUNCATE users", false),
      ).toThrow();
    });

    it("should reject dangerous INSERT pattern", () => {
      expect(() =>
        adapter.validateQuery("SELECT 1; INSERT INTO logs VALUES (1)", false),
      ).toThrow();
    });

    it("should reject dangerous UPDATE pattern", () => {
      expect(() =>
        adapter.validateQuery("SELECT 1; UPDATE users SET x=1", false),
      ).toThrow();
    });
  });

  describe("MCP registration", () => {
    let mockServer: {
      registerTool: ReturnType<typeof vi.fn>;
      registerResource: ReturnType<typeof vi.fn>;
      registerPrompt: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
      mockServer = {
        registerTool: vi.fn(),
        registerResource: vi.fn(),
        // Return a RegisteredPrompt-like object so `registered.argsSchema`
        // is accessible for schema patching in DatabaseAdapter.registerPrompt()
        registerPrompt: vi.fn().mockImplementation((_name, config, _cb) => {
          // Mimic SDK: if argsSchema is provided, create a z.object() from it.
          // Use a mock with _zod.run so the patching code doesn't crash.
          let argsSchema: unknown = undefined;
          if (config?.argsSchema) {
            argsSchema = {
              _zod: {
                def: { type: "object", shape: config.argsSchema },
                run: vi.fn((ctx: { value: unknown }) => ctx),
              },
            };
          }
          return { argsSchema };
        }),
      };
    });

    describe("registerTools", () => {
      it("should register enabled tools with server", () => {
        const enabledTools = new Set(["test_tool"]);
        adapter.registerTools(mockServer as never, enabledTools);
        expect(mockServer.registerTool).toHaveBeenCalled();
      });

      it("should not register tools not in enabled set", () => {
        const enabledTools = new Set(["other_tool"]);
        adapter.registerTools(mockServer as never, enabledTools);
        expect(mockServer.registerTool).not.toHaveBeenCalled();
      });

      it("should pass tool name and options to server", () => {
        const enabledTools = new Set(["test_tool"]);
        adapter.registerTools(mockServer as never, enabledTools);

        expect(mockServer.registerTool).toHaveBeenCalledWith(
          "test_tool",
          expect.objectContaining({
            description: "A test tool",
            title: "Test Tool",
          }),
          expect.any(Function),
        );
      });
    });

    describe("registerResources", () => {
      it("should register all resources with server", () => {
        adapter.registerResources(mockServer as never);
        expect(mockServer.registerResource).toHaveBeenCalled();
      });

      it("should pass resource name and uri to server", () => {
        adapter.registerResources(mockServer as never);

        expect(mockServer.registerResource).toHaveBeenCalledWith(
          "Test Resource",
          "mysql://test",
          expect.anything(),
          expect.any(Function),
        );
      });
    });

    describe("registerPrompts", () => {
      it("should register all prompts with server", () => {
        adapter.registerPrompts(mockServer as never);
        expect(mockServer.registerPrompt).toHaveBeenCalled();
      });

      it("should pass prompt name and description to server", () => {
        adapter.registerPrompts(mockServer as never);

        expect(mockServer.registerPrompt).toHaveBeenCalledWith(
          "test_prompt",
          expect.objectContaining({
            description: "A test prompt",
          }),
          expect.any(Function),
        );
      });

      it("should pass argsSchema for prompts with arguments so SDK advertises them", () => {
        const promptWithArgs: PromptDefinition = {
          name: "arg_prompt",
          description: "desc",
          arguments: [
            { name: "required_arg", description: "req", required: true },
            { name: "optional_arg", description: "opt", required: false },
          ],
          handler: async () => "result",
        };

        vi.spyOn(adapter, "getPromptDefinitions").mockReturnValue([
          promptWithArgs,
        ]);
        adapter.registerPrompts(mockServer as never);

        // argsSchema must be a Zod raw shape so the SDK can:
        // 1. Advertise arguments in prompts/list
        // 2. Validate arguments in prompts/get
        const calledConfig = mockServer.registerPrompt.mock.calls[0][1];
        expect(calledConfig.argsSchema).toBeDefined();
        expect(calledConfig.argsSchema).toHaveProperty("required_arg");
        expect(calledConfig.argsSchema).toHaveProperty("optional_arg");
      });

      it("should not pass argsSchema for prompts without arguments", () => {
        adapter.registerPrompts(mockServer as never);

        expect(mockServer.registerPrompt).toHaveBeenCalledWith(
          "test_prompt",
          expect.objectContaining({
            description: "A test prompt",
            argsSchema: undefined,
          }),
          expect.any(Function),
        );
      });

      it("should pass argsSchema for prompts with all-optional arguments", () => {
        const allOptionalPrompt: PromptDefinition = {
          name: "all_optional_prompt",
          description: "All optional args",
          arguments: [
            { name: "opt_a", description: "optional a", required: false },
            { name: "opt_b", description: "optional b", required: false },
          ],
          handler: async () => "result",
        };

        vi.spyOn(adapter, "getPromptDefinitions").mockReturnValue([
          allOptionalPrompt,
        ]);
        adapter.registerPrompts(mockServer as never);

        // argsSchema must be a Zod raw shape (even when all optional)
        // so the SDK advertises arguments in prompts/list
        const calledConfig = mockServer.registerPrompt.mock.calls[0][1];
        expect(calledConfig.argsSchema).toBeDefined();
        expect(calledConfig.argsSchema).toHaveProperty("opt_a");
        expect(calledConfig.argsSchema).toHaveProperty("opt_b");
      });

      it("should return guide message when required args are missing", async () => {
        const promptWithRequired: PromptDefinition = {
          name: "required_prompt",
          description: "Needs args",
          arguments: [
            { name: "operation", description: "The operation", required: true },
            { name: "note", description: "A note", required: false },
          ],
          handler: async () => "should not reach",
        };

        vi.spyOn(adapter, "getPromptDefinitions").mockReturnValue([
          promptWithRequired,
        ]);
        adapter.registerPrompts(mockServer as never);

        // Call handler with no args (simulates MCP client sending undefined)
        const handler = mockServer.registerPrompt.mock.calls[0][2] as (
          args: Record<string, string>,
        ) => Promise<{
          messages: { role: string; content: { text: string } }[];
        }>;
        const result = await handler({});

        // Should return a guide message, not the handler output
        expect(result.messages[0].content.text).toContain("required_prompt");
        expect(result.messages[0].content.text).toContain(
          "**operation** (required)",
        );
        expect(result.messages[0].content.text).toContain(
          "**note** (optional)",
        );
        expect(result.messages[0].content.text).toContain(
          "Please provide the required arguments",
        );
      });
    });

    describe("handler execution", () => {
      it("should execute tool handler when called", async () => {
        adapter.registerTools(mockServer as never, new Set(["test_tool"]));
        // registerTool now takes 3 args: name, options, handler
        const handler = mockServer.registerTool.mock.calls[0][2] as (
          args: Record<string, unknown>,
        ) => Promise<unknown>;

        const result = await handler({});
        expect(result).toEqual({
          content: [
            { type: "text", text: JSON.stringify({ result: "ok" }, null, 2) },
          ],
        });
      });

      it("should execute resource handler when called", async () => {
        adapter.registerResources(mockServer as never);
        const handler = mockServer.registerResource.mock.calls[0][3] as (
          uri: URL,
        ) => Promise<unknown>;

        const result = await handler(new URL("mysql://test"));
        expect(result).toEqual({
          contents: [
            {
              uri: "mysql://test",
              mimeType: "application/json",
              text: JSON.stringify({ data: "test" }, null, 2),
            },
          ],
        });
      });

      it("should execute prompt handler when called", async () => {
        adapter.registerPrompts(mockServer as never);
        // registerPrompt takes 3 args: name, options, handler
        const handler = mockServer.registerPrompt.mock.calls[0][2] as (
          args: Record<string, string>,
        ) => Promise<{
          messages: { role: string; content: { type: string; text: string } }[];
        }>;

        const result = await handler({});
        expect(result).toEqual({
          messages: [
            {
              role: "user",
              content: { type: "text", text: "Test prompt output" },
            },
          ],
        });
      });
    });
  });
});
