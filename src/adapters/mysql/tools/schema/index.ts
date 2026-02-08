/**
 * MySQL Schema Management Tools
 *
 * Tools for database schema introspection and management.
 */

import type { MySQLAdapter } from "../../MySQLAdapter.js";
import type { ToolDefinition } from "../../../../types/index.js";

import {
  createListSchemasTool,
  createCreateSchemaTool,
  createDropSchemaTool,
} from "./management.js";

import { createListViewsTool, createCreateViewTool } from "./views.js";

import {
  createListStoredProceduresTool,
  createListFunctionsTool,
} from "./routines.js";

import { createListTriggersTool } from "./triggers.js";

import { createListConstraintsTool } from "./constraints.js";

import { createListEventsTool } from "./scheduled_events.js";

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
    createListStoredProceduresTool(adapter),
    createListFunctionsTool(adapter),
    createListTriggersTool(adapter),
    createListConstraintsTool(adapter),
    createListEventsTool(adapter),
  ];
}
