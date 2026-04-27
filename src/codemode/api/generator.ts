import type { MySQLAdapter } from "../../adapters/mysql/mysql-adapter.js";
import type { ToolDefinition } from "../../types/index.js";
import { METHOD_ALIASES } from "./constants.js";
import { normalizeParams } from "./params.js";

/**
 * Dynamic API generator for tool groups
 * Creates methods for each tool in the group
 */
export function createGroupApi(
  adapter: MySQLAdapter,
  groupName: string,
  tools: ToolDefinition[],
): Record<string, (...args: unknown[]) => Promise<unknown>> {
  const api: Record<string, (...args: unknown[]) => Promise<unknown>> = {};

  for (const tool of tools) {
    // Convert tool name to method name
    // e.g., mysql_read_query -> readQuery, mysql_json_extract -> extract
    const methodName = toolNameToMethodName(tool.name, groupName);

    api[methodName] = async (...args: unknown[]) => {
      // Normalize positional arguments to object parameters
      const normalizedParams = normalizeParams(methodName, args) ?? {};
      const context = adapter.createContext();
      return tool.handler(normalizedParams, context);
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
  ]);

  if (!keepPrefix.has(groupName) && name.startsWith(groupPrefix)) {
    name = name.substring(groupPrefix.length);
  }

  // Convert snake_case to camelCase
  return name.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

// Type alias for group API record
