import { McpServer as SdkMcpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ErrorCategory } from "../../types/index.js";

let isPatched = false;

/**
 * Monkey-patch McpServer to return structured JSON errors for validation failures.
 * This ensures that SDK-level Zod validation errors match the handler error format
 * expected by clients ({ success: false, error: "..." }).
 */
export function applySdkPatch(): void {
  if (isPatched) return;

  const proto = SdkMcpServer.prototype as unknown as Record<
    string,
    (
      this: SdkMcpServer,
      errorMessage: string,
    ) => {
      content: { type: string; text: string }[];
      isError: boolean;
    }
  >;

  if (typeof proto["createToolError"] === "function") {
    const originalCreateToolError = proto["createToolError"];
    const patchedFn = function (this: SdkMcpServer, errorMessage: string): { content: { type: string; text: string }[]; isError: boolean } {
      const result = originalCreateToolError.call(this, errorMessage);
      if (result.content?.[0]?.type === "text") {
        const rawError = result.content[0].text;
        // Only intercept Zod validation failures from the SDK.
        // We must ignore "Tool not found" and other raw SDK errors so they propagate properly
        // (isError: true) for WASM graceful degradation and test suite setup logic.
        if (rawError.includes("Input validation error")) {
          // Strip out the MCP error prefix to match handler validation error formatting
          const cleanError = rawError.replace(
            /^MCP error -32602: Input validation error: /,
            "Validation error: ",
          );
          const structured = {
            success: false,
            error: cleanError,
            code: "VALIDATION_ERROR",
            category: ErrorCategory.VALIDATION,
          };
          result.content[0].text = JSON.stringify(structured, null, 2);
          result.isError = true;
        }
      }
      return result;
    };
    proto["createToolError"] = patchedFn;
    isPatched = true;
  }
}
