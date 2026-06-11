/**
 * MySQL Introspection Tools - Index
 */

import type { MySQLAdapter } from "../../mysql-adapter/index.js";
import type { ToolDefinition } from "../../../../types/index.js";

import {
  createDependencyGraphTool,
  createTopologicalSortTool,
  createCascadeSimulatorTool,
} from "./graph/index.js";

import {
  createConstraintAnalysisTool,
  createMigrationRisksTool,
} from "./analysis.js";

import { createSchemaSnapshotTool } from "./snapshot.js";

export function getIntrospectionTools(adapter: MySQLAdapter): ToolDefinition[] {
  return [
    createDependencyGraphTool(adapter),
    createTopologicalSortTool(adapter),
    createCascadeSimulatorTool(adapter),
    createConstraintAnalysisTool(adapter),
    createMigrationRisksTool(adapter),
    createSchemaSnapshotTool(adapter),
  ];
}
