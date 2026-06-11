/**
 * MySQL Statistics Tools
 *
 * Tools for statistical analysis of data.
 * 20 tools total (5 descriptive + 3 comparative + 6 window + 2 analytical + 4 advanced).
 */

import type { MySQLAdapter } from "../../mysql-adapter/index.js";
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

import {
  createStatsRowNumberTool,
  createStatsRankTool,
  createStatsLagLeadTool,
  createStatsRunningTotalTool,
  createStatsMovingAvgTool,
  createStatsNtileTool,
} from "./window.js";

import { createStatsHypothesisTool } from "./hypothesis.js";
import { createStatsOutliersTool } from "./outlier.js";

import {
  createStatsTopNTool,
  createStatsDistinctTool,
  createStatsFrequencyTool,
  createStatsSummaryTool,
} from "./advanced.js";

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

    // Window Functions
    createStatsRowNumberTool(adapter),
    createStatsRankTool(adapter),
    createStatsLagLeadTool(adapter),
    createStatsRunningTotalTool(adapter),
    createStatsMovingAvgTool(adapter),
    createStatsNtileTool(adapter),

    // Hypothesis & Outliers
    createStatsHypothesisTool(adapter),
    createStatsOutliersTool(adapter),

    // Advanced Stats
    createStatsTopNTool(adapter),
    createStatsDistinctTool(adapter),
    createStatsFrequencyTool(adapter),
    createStatsSummaryTool(adapter),
  ];
}
