import { McpServer as SdkMcpServer } from "@modelcontextprotocol/server";
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
          let cleanError = rawError.replace(
            /^MCP error -32602: Input validation error: /,
            "",
          );

          // The SDK error in v2 is already a nice string: "Invalid arguments for tool ...: [message] at path [path]"
          // Or just "Input validation error: [message] at path [path]"
          // We can just keep the raw cleanError.
          
          cleanError = "Validation error: " + cleanError;
          const structured = {
            success: false,
            error: cleanError,
            code: "VALIDATION_ERROR",
            category: ErrorCategory.VALIDATION,
            recoverable: false,
            metrics: { tokenEstimate: 0 },
          };
          
          const enriched = JSON.stringify({
            ...structured,
            _meta: { tokenEstimate: 0 }
          });
          const tokenEstimate = Math.ceil(Buffer.byteLength(enriched, "utf8") / 4);
          
          structured.metrics.tokenEstimate = tokenEstimate;
          const finalObj = { ...structured, _meta: { tokenEstimate } };
          result.content[0].text = JSON.stringify(finalObj, null, 2);
          result.isError = true;
        }
      }
      return result;
    };
    proto["createToolError"] = patchedFn;
    isPatched = true;
  }
}
