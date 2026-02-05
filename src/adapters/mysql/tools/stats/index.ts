/**
 * MySQL Statistics Tools
 *
 * Tools for statistical analysis of data.
 * 8 tools total (5 descriptive + 3 comparative).
 */

import type { MySQLAdapter } from "../../MySQLAdapter.js";
import type { ToolDefinition } from "../../../../types/index.js";

// Import from submodules
import {
  createDescriptiveStatsTool,
  createPercentilesTool,
  createDistributionTool,
  createTimeSeriesToolStats,
  createSamplingTool,
} from "./descriptive.js";

import {
  createCorrelationTool,
  createRegressionTool,
  createHistogramTool,
} from "./comparative.js";

/**
 * Get all statistics tools
 */
export function getStatsTools(adapter: MySQLAdapter): ToolDefinition[] {
  return [
    createDescriptiveStatsTool(adapter),
    createPercentilesTool(adapter),
    createCorrelationTool(adapter),
    createDistributionTool(adapter),
    createTimeSeriesToolStats(adapter),
    createRegressionTool(adapter),
    createSamplingTool(adapter),
    createHistogramTool(adapter),
  ];
}
