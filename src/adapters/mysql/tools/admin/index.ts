/**
 * MySQL Admin, Monitoring & Backup Tools
 *
 * Database administration, monitoring, and backup operations.
 * 17 tools total (6 admin + 7 monitoring + 4 backup).
 */

import type { MySQLAdapter } from "../../MySQLAdapter.js";
import type { ToolDefinition } from "../../../../types/index.js";

// Import from submodules
import {
  createOptimizeTableTool,
  createAnalyzeTableTool,
  createCheckTableTool,
  createRepairTableTool,
  createFlushTablesTool,
  createKillQueryTool,
} from "./maintenance.js";

import {
  createShowProcesslistTool,
  createShowStatusTool,
  createShowVariablesTool,
  createInnodbStatusTool,
  createReplicationStatusTool,
  createPoolStatsTool,
  createServerHealthTool,
} from "./monitoring.js";

import {
  createExportTableTool,
  createImportDataTool,
  createCreateDumpTool,
  createRestoreDumpTool,
} from "./backup.js";

/**
 * Get admin tools
 */
export function getAdminTools(adapter: MySQLAdapter): ToolDefinition[] {
  return [
    createOptimizeTableTool(adapter),
    createAnalyzeTableTool(adapter),
    createCheckTableTool(adapter),
    createRepairTableTool(adapter),
    createFlushTablesTool(adapter),
    createKillQueryTool(adapter),
  ];
}

/**
 * Get monitoring tools
 */
export function getMonitoringTools(adapter: MySQLAdapter): ToolDefinition[] {
  return [
    createShowProcesslistTool(adapter),
    createShowStatusTool(adapter),
    createShowVariablesTool(adapter),
    createInnodbStatusTool(adapter),
    createReplicationStatusTool(adapter),
    createPoolStatsTool(adapter),
    createServerHealthTool(adapter),
  ];
}

/**
 * Get backup tools
 */
export function getBackupTools(adapter: MySQLAdapter): ToolDefinition[] {
  return [
    createExportTableTool(adapter),
    createImportDataTool(adapter),
    createCreateDumpTool(adapter),
    createRestoreDumpTool(adapter),
  ];
}
