/**
 * mysql-mcp — Audit Interceptor
 *
 * Wraps tool execution to produce audit entries for all tool
 * invocations. Write/admin tools are always logged; read-scoped
 * tools are logged only when `--audit-reads` is enabled.
 *
 * Each entry includes a `tokenEstimate` (~4 bytes per token)
 * computed from the serialized result size.
 *
 * When a BackupManager is provided, captures pre-mutation
 * snapshots of target objects before destructive tool execution.
 *
 * The interceptor is injected into `DatabaseAdapter.registerTool()`
 * so that all tool handlers are audited without per-handler changes.
 */

import { performance } from "node:perf_hooks";
import type { AuditLogger } from "./logger.js";
import type { BackupManager, SnapshotQueryAdapter } from "./backup-manager/index.js";
import type { AuditCategory } from "./types.js";
import { getAuthContext } from "../auth/auth-context.js";
import { getRequiredScope } from "../auth/scope-map.js";
import { estimateTokens, estimateObjectTokens } from "../utils/tokens.js";
import { metrics } from "../observability/metrics.js";
import { findSuggestion, heuristicCategorize } from "../utils/error-suggestions.js";

/**
 * Audit interceptor interface — used by `DatabaseAdapter.registerTool()`.
 */
export interface AuditInterceptor {
  /**
   * Wrap a tool invocation with audit logging.
   * Returns the tool result unchanged; re-throws any errors.
   *
   * @param toolName  MCP tool name
   * @param args      Tool input arguments
   * @param requestId Request ID from RequestContext
   * @param fn        The actual tool handler to execute
   * @param options   Optional configuration, such as overriding the recorded tool name
   */
  around<T>(
    toolName: string,
    args: unknown,
    requestId: string,
    fn: () => Promise<T>,
    options?: { logAs?: string },
  ): Promise<T>;
}

/**
 * Write/admin scopes are always audited.
 * Read scope is audited only when `auditReads` is enabled.
 */
const ALWAYS_AUDITED_SCOPES = new Set(["write", "admin"]);

/**
 * Map a scope string to an AuditCategory.
 */
function scopeToCategory(scope: string): AuditCategory {
  if (scope === "admin") return "admin";
  if (scope === "read") return "read";
  return "write";
}



/**
 * Create an audit interceptor bound to the given logger.
 *
 * @param auditLogger  The JSONL audit logger
 * @param backupManager Optional backup manager for pre-mutation snapshots
 * @param queryAdapter  Optional query adapter for snapshot DDL capture
 */
export function createAuditInterceptor(
  auditLogger: AuditLogger,
  backupManager?: BackupManager,
  queryAdapter?: SnapshotQueryAdapter,
): AuditInterceptor {
  const auditReads = auditLogger.config.auditReads;

  return {
    async around<T>(
      toolName: string,
      args: unknown,
      requestId: string,
      fn: () => Promise<T>,
      options?: { logAs?: string },
    ): Promise<T> {
      const scope = getRequiredScope(toolName);
      const isReadScope = scope === "read";
      
      // Read-scoped tools are only audited when --audit-reads is enabled
      const shouldAudit = ALWAYS_AUDITED_SCOPES.has(scope) || auditReads;

      const authCtx = getAuthContext();
      const start = performance.now();
      let success = true;
      let error: string | undefined;
      let errorType: string | undefined;
      let errorCategory: string | undefined;
      let backupRef: string | undefined;
      let tokenEstimate: number | undefined;

      // Pre-mutation snapshot (before tool executes)
      if (
        backupManager &&
        queryAdapter &&
        backupManager.shouldSnapshot(toolName)
      ) {
        try {
          backupRef = await backupManager.createSnapshot(
            toolName,
            (args ?? {}) as Record<string, unknown>,
            requestId,
            queryAdapter,
            options?.logAs,
          );
        } catch {
          // Snapshot failure must not block tool execution
        }
      }

      try {
        const result = await fn();

        // Extract success/error from structured handler responses (or CallToolResult)
        if (typeof result === "object" && result !== null) {
          // If it's a CallToolResult (which the new execFn returns)
          if ("isError" in result && result.isError === true) {
            success = false;
            
            // Try to extract from structuredContent if it exists
            if ("structuredContent" in result && typeof result.structuredContent === "object" && result.structuredContent !== null) {
              const sc = result.structuredContent as Record<string, unknown>;
              if ("error" in sc) {
                error = typeof sc["error"] === "string" ? sc["error"] : String(sc["error"]);
              }
            } 
            // Otherwise extract from standard MCP content array
            else if ("content" in result && Array.isArray(result.content) && result.content.length > 0) {
              const first: unknown = result.content[0];
              if (first !== undefined && first !== null && typeof first === "object" && "text" in first) {
                error = String((first).text);
              }
            }
            
            if (!error) {
              error = "Tool call failed (isError: true)";
            }

            const match = findSuggestion(error);
            errorType = match?.code;
            errorCategory = match?.category;
            
            // Heuristic fallback if findSuggestion misses
            if (!errorType || !errorCategory) {
              const fallback = heuristicCategorize(error);
              errorType = errorType ?? fallback.type;
              errorCategory = errorCategory ?? fallback.category;
            }
          }
          // Legacy check in case we ever wrap the handler directly again
          else if ("success" in result && result.success === false) {
            success = false;
            if ("error" in result) {
              error = typeof result.error === "string" ? result.error : String(result.error);
              const match = findSuggestion(error);
              errorType = match?.code;
              errorCategory = match?.category;
              if (!errorType || !errorCategory) {
                const fallback = heuristicCategorize(error);
                errorType = errorType ?? fallback.type;
                errorCategory = errorCategory ?? fallback.category;
              }
            }
          }
        }

        // Compute token estimate from result
        if (typeof result === "object" && result !== null) {
          try {
            // Avoid spreading result into a mockPayload to prevent GC pressure
            // on the hot-path. 12 tokens roughly covers the _meta wrapper.
            tokenEstimate = estimateObjectTokens(result) + 12;
          } catch {
            // Serialization failure must not block tool execution
          }
        } else if (typeof result === "string") {
          const isSql = /^\s*(?:SELECT|INSERT|UPDATE|DELETE|WITH|CREATE|ALTER|DROP|PRAGMA)\b/i.test(result);
          tokenEstimate = estimateTokens(result, isSql ? "sql" : "text");
        }

        return result;
      } catch (err) {
        success = false;
        error = err instanceof Error ? err.message : String(err);

        const match = findSuggestion(error);
        errorType = match?.code;
        errorCategory = match?.category;
        
        if (!errorType || !errorCategory) {
          if (err instanceof Error && err.name === "ZodError") {
            errorType = "VALIDATION_ERROR";
            errorCategory = "validation";
          } else {
            const fallback = heuristicCategorize(error);
            errorType = errorType ?? fallback.type;
            errorCategory = errorCategory ?? fallback.category;
          }
        }

        // Match mcp-registry.ts raw exception fallback token calculation
        const errorResult = {
          success: false,
          error: error,
          code: "INTERNAL_ERROR",
          category: "internal",
          recoverable: false,
        };
        
        // Avoid spreading result into a mockPayload to prevent GC pressure
        tokenEstimate = estimateObjectTokens(errorResult) + 12; // 12 tokens roughly covers the _meta wrapper

        throw err; // Re-throw — don't swallow
      } finally {
        const durationMs = Math.round(performance.now() - start);

        metrics.recordToolCall(
          options?.logAs ?? toolName,
          durationMs,
          success,
          tokenEstimate ?? 0,
          errorType,
          errorCategory
        );

        if (shouldAudit) {
          if (isReadScope) {
            // Compact read entries — omit args, user, scopes for ~100 byte entries
            auditLogger.log({
              timestamp: new Date().toISOString(),
              requestId,
              tool: options?.logAs ?? toolName,
              category: "read",
              scope,
              durationMs,
              success,
              status: success ? "info" : "error",
              error,
              tokenEstimate,
            } as Parameters<typeof auditLogger.log>[0]);
          } else {
            auditLogger.log({
              timestamp: new Date().toISOString(),
              requestId,
              tool: options?.logAs ?? toolName,
              category: scopeToCategory(scope),
              scope,
              user: authCtx?.claims?.sub ?? null,
              durationMs,
              success,
              status: success ? "info" : "error",
              error,
              args: auditLogger.config.redact
                ? undefined
                : (args as Record<string, unknown>),
              scopes: authCtx?.scopes ?? [],
              backup: backupRef,
              tokenEstimate,
            });
          }
        }
      }
    },
  };
}
