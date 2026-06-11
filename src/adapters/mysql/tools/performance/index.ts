/**
 * MySQL Performance & Optimization Tools
 *
 * Query analysis, EXPLAIN, and optimization tools.
 * 15 tools total (8 performance + 4 optimization + 3 anomaly).
 */

import type { MySQLAdapter } from "../../mysql-adapter/index.js";
import type { ToolDefinition } from "../../../../types/index.js";

// Import from submodules
import {
  createExplainTool,
  createExplainAnalyzeTool,
  createSlowQueriesTool,
  createQueryStatsTool,
  createIndexUsageTool,
  createTableStatsTool,
  createBufferPoolStatsTool,
  createThreadStatsTool,
} from "./analysis/index.js";

import { createIndexRecommendationTool } from "./index-audit/index.js";

import {
  createQueryRewriteTool,
  createForceIndexTool,
  createOptimizerTraceTool,
} from "./optimization.js";

import {
  createDetectQueryAnomaliesTool,
  createDetectBloatRiskTool,
} from "./anomaly-detection.js";

import { createDetectConnectionSpikeTool } from "./connection-analysis.js";

/**
 * Get performance analysis tools
 */
export function getPerformanceTools(adapter: MySQLAdapter): ToolDefinition[] {
  return [
    createExplainTool(adapter),
    createExplainAnalyzeTool(adapter),
    createSlowQueriesTool(adapter),
    createQueryStatsTool(adapter),
    createIndexUsageTool(adapter),
    createTableStatsTool(adapter),
    createBufferPoolStatsTool(adapter),
    createThreadStatsTool(adapter),

    // Anomaly Detection
    createDetectQueryAnomaliesTool(adapter),
    createDetectBloatRiskTool(adapter),
    createDetectConnectionSpikeTool(adapter),
  ];
}

/**
 * Get optimization tools
 */
export function getOptimizationTools(adapter: MySQLAdapter): ToolDefinition[] {
  return [
    createIndexRecommendationTool(adapter),
    createQueryRewriteTool(adapter),
    createForceIndexTool(adapter),
    createOptimizerTraceTool(adapter),
  ];
}
