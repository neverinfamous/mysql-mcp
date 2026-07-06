import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ErrorCategory } from "../../../types/index.js";

describe("applySdkPatch", () => {
  let originalCreateToolError: any;

  beforeEach(() => {
    // Save original if it exists
    const proto = McpServer.prototype as any;
    originalCreateToolError = proto.createToolError;
    
    // Reset patched state module variable by importing it again
    vi.resetModules();
  });

  afterEach(() => {
    const proto = McpServer.prototype as any;
    if (originalCreateToolError) {
      proto.createToolError = originalCreateToolError;
    }
  });

  it("should patch createToolError exactly once", async () => {
    const { applySdkPatch } = await import("../sdk-patch.js");
    
    const proto = McpServer.prototype as any;
    proto.createToolError = vi.fn().mockReturnValue({ content: [], isError: true });
    
    const initialFn = proto.createToolError;
    
    applySdkPatch();
    
    const patchedFn = proto.createToolError;
    expect(patchedFn).not.toBe(initialFn);
    
    // Calling again should not re-patch
    applySdkPatch();
    expect(proto.createToolError).toBe(patchedFn);
  });

  it("should format Zod validation errors to structured JSON", async () => {
    const { applySdkPatch } = await import("../sdk-patch.js");
    
    const proto = McpServer.prototype as any;
    
    const mockIssues = [
      { path: ["field1"], message: "Required" },
      { path: ["nested", "field2"], message: "Too short" }
    ];
    
    const rawError = `MCP error -32602: Input validation error: Invalid arguments for tool my_tool: ${JSON.stringify(mockIssues)}`;
    
    proto.createToolError = vi.fn().mockReturnValue({
      content: [{ type: "text", text: rawError }],
      isError: true
    });
    
    applySdkPatch();
    
    const mcpServer = new McpServer({ name: "test", version: "1.0.0" });
    const result = (mcpServer as any).createToolError(rawError);
    
    expect(result.isError).toBe(true);
    expect(result.content[0].type).toBe("text");
    
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(false);
    expect(parsed.code).toBe("VALIDATION_ERROR");
    expect(parsed.category).toBe(ErrorCategory.VALIDATION);
    expect(parsed.error).toContain("field1: Required");
    expect(parsed.error).toContain("nested.field2: Too short");
  });

  it("should handle Zod validation errors where JSON parsing fails", async () => {
    const { applySdkPatch } = await import("../sdk-patch.js");
    
    const proto = McpServer.prototype as any;
    
    const rawError = `MCP error -32602: Input validation error: Invalid arguments for tool my_tool: [invalid json`;
    
    proto.createToolError = vi.fn().mockReturnValue({
      content: [{ type: "text", text: rawError }],
      isError: true
    });
    
    applySdkPatch();
    
    const mcpServer = new McpServer({ name: "test", version: "1.0.0" });
    const result = (mcpServer as any).createToolError(rawError);
    
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toContain("Invalid arguments for tool my_tool: [invalid json");
  });

  it("should not format non-validation errors", async () => {
    const { applySdkPatch } = await import("../sdk-patch.js");
    
    const proto = McpServer.prototype as any;
    
    const rawError = `Tool not found: my_tool`;
    
    proto.createToolError = vi.fn().mockReturnValue({
      content: [{ type: "text", text: rawError }],
      isError: true
    });
    
    applySdkPatch();
    
    const mcpServer = new McpServer({ name: "test", version: "1.0.0" });
    const result = (mcpServer as any).createToolError(rawError);
    
    expect(result.content[0].text).toBe(rawError);
  });
});
