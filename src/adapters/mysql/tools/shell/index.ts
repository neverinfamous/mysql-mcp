/**
 * MySQL Shell Management Tools
 *
 * Tools for executing MySQL Shell (mysqlsh) commands via subprocess.
 * Provides access to util.* functions for backup, restore, migration, and scripting.
 * 10 tools total.
 *
 * MySQL Shell documentation:
 * https://dev.mysql.com/doc/mysql-shell/8.0/en/
 */

import type { ToolDefinition } from "../../../../types/index.js";
import type { MySQLAdapter } from "../../MySQLAdapter.js";

// Import all tool creation functions from submodules
import { createShellVersionTool } from "./info.js";
import { createShellCheckUpgradeTool } from "./utilities.js";
import {
  createShellExportTableTool,
  createShellImportTableTool,
  createShellImportJSONTool,
} from "./data-transfer.js";
import {
  createShellDumpInstanceTool,
  createShellDumpSchemasTool,
  createShellDumpTablesTool,
} from "./backup.js";
import {
  createShellLoadDumpTool,
  createShellRunScriptTool,
} from "./restore.js";

/**
 * Get all MySQL Shell tools
 */
export function getShellTools(_adapter: MySQLAdapter): ToolDefinition[] {
  return [
    createShellVersionTool(),
    createShellCheckUpgradeTool(),
    createShellExportTableTool(),
    createShellImportTableTool(),
    createShellImportJSONTool(),
    createShellDumpInstanceTool(),
    createShellDumpSchemasTool(),
    createShellDumpTablesTool(),
    createShellLoadDumpTool(),
    createShellRunScriptTool(),
  ];
}
