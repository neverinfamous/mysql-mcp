import type { MySQLAdapter } from "../../mysql-adapter.js";
import type { ToolDefinition } from "../../../../types/index.js";

import {
  createVectorStoreTool,
  createVectorBatchStoreTool,
  createVectorDeleteTool,
  createVectorGetTool,
} from "./storage.js";

import {
  createVectorSearchTool,
  createVectorRangeSearchTool,
  createVectorHybridSearchTool,
} from "./search.js";

import {
  createVectorInfoTool,
  createVectorCreateIndexTool,
  createVectorOptimizeTool,
  createVectorStatsTool,
} from "./management.js";

export function getVectorTools(adapter: MySQLAdapter): ToolDefinition[] {
  return [
    // Storage
    createVectorStoreTool(adapter),
    createVectorBatchStoreTool(adapter),
    createVectorDeleteTool(adapter),
    createVectorGetTool(adapter),
    
    // Search
    createVectorSearchTool(adapter),
    createVectorRangeSearchTool(adapter),
    createVectorHybridSearchTool(adapter),
    
    // Management
    createVectorInfoTool(adapter),
    createVectorCreateIndexTool(adapter),
    createVectorOptimizeTool(adapter),
    createVectorStatsTool(adapter),
  ];
}
