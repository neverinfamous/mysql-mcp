import type { ToolDefinition } from "../../../../types/index.js";
import type { MySQLAdapter } from "../../mysql-adapter/index.js";

import {
  createProxySQLStatusTool,
  createProxySQLRuntimeStatusTool,
  createProxySQLMemoryStatsTool,
} from "./status.js";
import {
  createProxySQLServersTool,
  createProxySQLConnectionPoolTool,
} from "./servers.js";
import {
  createProxySQLQueryRulesTool,
  createProxySQLQueryDigestTool,
  createProxySQLCommandsTool,
} from "./queries.js";
import {
  createProxySQLUsersTool,
  createProxySQLGlobalVariablesTool,
  createProxySQLProcessListTool,
} from "./process.js";

export function getProxySQLTools(_adapter: MySQLAdapter): ToolDefinition[] {
  return [
    createProxySQLStatusTool(),
    createProxySQLServersTool(),
    createProxySQLQueryRulesTool(),
    createProxySQLQueryDigestTool(),
    createProxySQLConnectionPoolTool(),
    createProxySQLUsersTool(),
    createProxySQLGlobalVariablesTool(),
    createProxySQLRuntimeStatusTool(),
    createProxySQLMemoryStatsTool(),
    createProxySQLCommandsTool(),
    createProxySQLProcessListTool(),
  ];
}
