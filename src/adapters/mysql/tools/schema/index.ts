/**
 * MySQL Schema Management Tools
 *
 * Tools for database schema introspection and management.
 */

import type { MySQLAdapter } from "../../mysql-adapter/index.js";
import type { ToolDefinition } from "../../../../types/index.js";

import {
  createListSchemasTool,
  createCreateSchemaTool,
  createDropSchemaTool,
} from "./management.js";

import {
  createListViewsTool,
  createCreateViewTool,
  createDropViewTool,
} from "./views.js";

import {
  createListStoredProceduresTool,
  createListFunctionsTool,
} from "./routines.js";

import {
  createListTriggersTool,
  createCreateTriggerTool,
  createDropTriggerTool,
} from "./triggers.js";

import { createListConstraintsTool } from "./constraints.js";


/**
 * Get all schema management tools
 */
export function getSchemaTools(adapter: MySQLAdapter): ToolDefinition[] {
  return [
    createListSchemasTool(adapter),
    createCreateSchemaTool(adapter),
    createDropSchemaTool(adapter),
    createListViewsTool(adapter),
    createCreateViewTool(adapter),
    createDropViewTool(adapter),
    createListStoredProceduresTool(adapter),
    createListFunctionsTool(adapter),
    createListTriggersTool(adapter),
    createCreateTriggerTool(adapter),
    createDropTriggerTool(adapter),
    createListConstraintsTool(adapter),
  ];
}
