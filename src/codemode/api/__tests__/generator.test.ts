import { describe, it, expect, vi, beforeEach } from "vitest";
import { createGroupApi, toolNameToMethodName } from "../generator.js";
import { z } from "zod";

vi.mock("../../adapters/mysql/tools/core/error-helpers.js", () => ({
  formatHandlerErrorResponse: vi.fn((err) => ({ success: false, error: err.message || err })),
}));

describe("generator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("toolNameToMethodName", () => {
    it("should remove mysql_ prefix and convert to camelCase", () => {
      expect(toolNameToMethodName("mysql_read_query", "core")).toBe("readQuery");
      expect(toolNameToMethodName("mysql_json_extract", "json")).toBe("extract");
      expect(toolNameToMethodName("mysql_admin_config", "admin")).toBe("config");
    });

    it("should keep prefix for certain groups", () => {
      expect(toolNameToMethodName("mysql_fulltext_search", "fulltext")).toBe("fulltextSearch");
      expect(toolNameToMethodName("mysql_sys_schema_stats", "sysschema")).toBe("sysSchemaStats");
      expect(toolNameToMethodName("mysql_doc_find", "docstore")).toBe("docFind");
      expect(toolNameToMethodName("mysql_transaction_commit", "transactions")).toBe("transactionCommit");
    });
  });

  describe("createGroupApi", () => {
    let mockAdapter: any;
    
    beforeEach(() => {
      mockAdapter = {
        createContext: vi.fn().mockReturnValue({ requestId: "req-1" }),
      };
    });

    it("should generate methods for tools and aliases", async () => {
      const mockHandler = vi.fn().mockResolvedValue({ success: true, data: "result" });
      const tools = [
        {
          name: "mysql_read_query",
          inputSchema: z.object({ query: z.string() }),
          handler: mockHandler,
        }
      ] as any;

      const api = createGroupApi(mockAdapter, "core", tools);
      
      expect(api).toHaveProperty("readQuery");
      // 'query' might be an alias for 'readQuery' depending on constants. 
      // But we just test the generated one.
      
      const result = await api.readQuery({ query: "SELECT 1" });
      expect(result).toEqual({ success: true, data: "result" });
      expect(mockAdapter.createContext).toHaveBeenCalled();
      
      // Test the context injection
      expect(mockHandler).toHaveBeenCalledWith(
        { query: "SELECT 1" }, 
        expect.objectContaining({ isCodeMode: true, requestId: "req-1" })
      );
    });

    it("should validate params and return error if invalid", async () => {
      const mockHandler = vi.fn();
      const tools = [
        {
          name: "mysql_test_tool",
          inputSchema: z.object({ id: z.number() }),
          handler: mockHandler,
        }
      ] as any;

      const api = createGroupApi(mockAdapter, "test", tools);
      
      const result: any = await api.tool({ id: "not-a-number" });
      expect(result.success).toBe(false);
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it("should handle thrown errors in handler", async () => {
      const mockHandler = vi.fn().mockRejectedValue(new Error("Handler error"));
      const tools = [
        {
          name: "mysql_test_tool",
          inputSchema: z.object({}),
          handler: mockHandler,
        }
      ] as any;

      const api = createGroupApi(mockAdapter, "test", tools);
      
      const result: any = await api.tool({});
      expect(result.success).toBe(false);
      expect(result.error).toBe("Handler error");
    });

    it("should use audit interceptor if provided", async () => {
      const mockHandler = vi.fn().mockResolvedValue({ success: true });
      const tools = [
        {
          name: "mysql_test_tool",
          inputSchema: z.object({}),
          handler: mockHandler,
        }
      ] as any;

      const mockInterceptor = {
        around: vi.fn().mockImplementation(async (name, data, reqId, cb) => cb())
      };

      const api = createGroupApi(mockAdapter, "test", tools, mockInterceptor as any);
      
      await api.tool({});
      
      expect(mockInterceptor.around).toHaveBeenCalledWith(
        "mysql_test_tool",
        {},
        "req-1",
        expect.any(Function),
        { logAs: "mysql_execute_code" }
      );
      expect(mockHandler).toHaveBeenCalled();
    });

    it("should parse raw ZodShape object if safeParse is not available", async () => {
      const mockHandler = vi.fn().mockResolvedValue({ success: true });
      const tools = [
        {
          name: "mysql_test_tool",
          // Object shape instead of ZodObject
          inputSchema: { id: z.number() },
          handler: mockHandler,
        }
      ] as any;

      const api = createGroupApi(mockAdapter, "test", tools);
      
      const result: any = await api.tool({ id: 1 });
      expect(result.success).toBe(true);
      expect(mockHandler).toHaveBeenCalledWith({ id: 1 }, expect.any(Object));
    });

    it("should expose a help method", async () => {
      const api = createGroupApi(mockAdapter, "test", []);
      expect(api).toHaveProperty("help");
      const result = await api.help();
      expect(result).toEqual({
        success: true,
        data: { methods: ["help"] },
        metrics: { tokenEstimate: 20 },
      });
    });
  });
});
