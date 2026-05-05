/**
 * MySQL Migration Tools - Index
 */

import type { MySQLAdapter } from "../../mysql-adapter.js";
import type { ToolDefinition } from "../../../../types/index.js";

import {
  createMigrationInitTool,
  createMigrationRecordTool,
  createMigrationApplyTool,
} from "./migration.js";

import {
  createMigrationRollbackTool,
  createMigrationHistoryTool,
  createMigrationStatusTool,
} from "./migration-query.js";

export function getMigrationTools(adapter: MySQLAdapter): ToolDefinition[] {
  return [
    createMigrationInitTool(adapter),
    createMigrationRecordTool(adapter),
    createMigrationApplyTool(adapter),
    createMigrationRollbackTool(adapter),
    createMigrationHistoryTool(adapter),
    createMigrationStatusTool(adapter),
  ];
}
