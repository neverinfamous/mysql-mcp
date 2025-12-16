/**
 * MySQL Performance & Optimization Tools
 * 
 * Query analysis, EXPLAIN, and optimization tools.
 * 12 tools total (8 performance + 4 optimization).
 */

import type { MySQLAdapter } from '../../MySQLAdapter.js';
import type { ToolDefinition } from '../../../../types/index.js';

// Import from submodules
import {
    createExplainTool,
    createExplainAnalyzeTool,
    createSlowQueriesTool,
    createQueryStatsTool,
    createIndexUsageTool,
    createTableStatsTool,
    createBufferPoolStatsTool,
    createThreadStatsTool
} from './analysis.js';

import {
    createIndexRecommendationTool,
    createQueryRewriteTool,
    createForceIndexTool,
    createOptimizerTraceTool
} from './optimization.js';

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
        createThreadStatsTool(adapter)
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
        createOptimizerTraceTool(adapter)
    ];
}
