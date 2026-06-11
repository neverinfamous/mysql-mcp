import type { MySQLAdapter } from "../../mysql-adapter/index.js";
import type { ToolDefinition } from "../../../../types/index.js";

import { createReadQueryTool, createWriteQueryTool } from "./query.js";
import {
  createListTablesTool,
  createDescribeTableTool,
  createCreateTableTool,
  createDropTableTool,
} from "./tables.js";
import { createGetIndexesTool, createCreateIndexTool } from "./indexes.js";
import {
  createEnableVersioningTool,
  createDisableVersioningTool,
  createCheckVersionTool,
  createConditionalUpdateTool,
} from "./versioning.js";

export function getCoreTools(adapter: MySQLAdapter): ToolDefinition[] {
  return [
    createReadQueryTool(adapter),
    createWriteQueryTool(adapter),
    createListTablesTool(adapter),
    createDescribeTableTool(adapter),
    createCreateTableTool(adapter),
    createDropTableTool(adapter),
    createGetIndexesTool(adapter),
    createCreateIndexTool(adapter),
    createEnableVersioningTool(adapter),
    createDisableVersioningTool(adapter),
    createCheckVersionTool(adapter),
    createConditionalUpdateTool(adapter),
  ];
}
