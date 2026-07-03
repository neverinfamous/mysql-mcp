import type { MySQLAdapter } from "../../adapters/mysql/mysql-adapter/index.js";
import type { ToolDefinition } from "../../types/index.js";
import type { AuditInterceptor } from "../../audit/interceptor.js";
import { METHOD_ALIASES } from "./constants/index.js";
import { normalizeParams } from "./params.js";
import { formatHandlerErrorResponse } from "../../adapters/mysql/tools/core/error-helpers.js";

import { z } from "zod";

/**
 * Dynamic API generator for tool groups.
 * Creates methods for each tool in the group.
 *
 * §1: When an auditInterceptor is provided, all handler calls are wrapped
 * with audit logging + pre-mutation snapshots. This closes the Code Mode
 * blindspot where sandbox tool calls previously bypassed the audit trail.
 * Each auditInterceptor.around() adds ~2ms latency per inner tool call.
 */
export function createGroupApi(
  adapter: MySQLAdapter,
  groupName: string,
  tools: ToolDefinition[],
  auditInterceptor?: AuditInterceptor | null,
): Record<string, (...args: unknown[]) => Promise<unknown>> {
  const api: Record<string, (...args: unknown[]) => Promise<unknown>> = {};

  for (const tool of tools) {
    // Convert tool name to method name
    // e.g., mysql_read_query -> readQuery, mysql_json_extract -> extract
    const methodName = toolNameToMethodName(tool.name, groupName);

    api[methodName] = async (...args: unknown[]) => {
      // Normalize positional arguments to object parameters
      const normalizedParams = normalizeParams(methodName, args) ?? {};
      
      // Perform Zod validation on normalized params before calling the handler
      let schema: z.ZodType;
      if (typeof (tool.inputSchema as z.ZodType).safeParse === "function") {
        schema = tool.inputSchema as z.ZodType;
      } else {
        schema = z.object(tool.inputSchema as z.ZodRawShape);
      }

      const validationResult = schema.safeParse(normalizedParams);
      if (!validationResult.success) {
        return formatHandlerErrorResponse(validationResult.error);
      }

      const context = adapter.createContext();
      context.isCodeMode = true;

      try {
        // §1: Wrap with audit interceptor when available
        if (auditInterceptor) {
          return await auditInterceptor.around(
            tool.name,
            validationResult.data,
            context.requestId,
            () => tool.handler(validationResult.data, context),
            { logAs: "mysql_execute_code" },
          );
        }
        return await tool.handler(validationResult.data, context);
      } catch (err) {
        return formatHandlerErrorResponse(err);
      }
    };
  }

  // Add method aliases for this group
  const aliases = METHOD_ALIASES[groupName];
  if (aliases !== undefined) {
    for (const [aliasName, canonicalName] of Object.entries(aliases)) {
      if (api[canonicalName] !== undefined) {
        api[aliasName] = api[canonicalName];
      }
    }
  }

  // Add help method for this group
  api["help"] = () => Promise.resolve({
    success: true,
    data: { methods: Object.keys(api) },
    metrics: { tokenEstimate: 20 },
  });

  return api;
}

/**
 * Convert tool name to camelCase method name
 * Examples:
 *   mysql_read_query (core) -> readQuery
 *   mysql_json_extract (json) -> extract
 *   mysql_fulltext_search (fulltext) -> fulltextSearch
 *   mysql_sys_schema_stats (sysschema) -> sysSchemaStats
 */
export function toolNameToMethodName(
  toolName: string,
  groupName: string,
): string {
  // Remove mysql_ prefix
  let name = toolName.replace(/^mysql_/, "");

  // Map group name to its tool name prefix
  // Some groups use different prefixes in tool names
  const groupPrefixMap: Record<string, string> = {
    sysschema: "sys_",
    fulltext: "fulltext_",
    docstore: "doc_",
    transactions: "transaction_",
    shell: "mysqlsh_",
    // Default: use groupName + "_"
  };

  const groupPrefix = groupPrefixMap[groupName] ?? groupName + "_";

  // For certain groups, keep the prefix as part of the method name
  // because the tool names use a prefix that differs from the group
  const keepPrefix = new Set([
    "fulltext",
    "sysschema",
    "docstore",
    "transactions",
    "cluster",
    "roles",
    "events",
    "replication",
    "vector",
  ]);

  if (!keepPrefix.has(groupName) && name.startsWith(groupPrefix)) {
    name = name.substring(groupPrefix.length);
  }

  // Convert snake_case to camelCase
  return name.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

// Type alias for group API record
