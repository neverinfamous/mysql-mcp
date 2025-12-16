/**
 * MySQL JSON Tools
 * 
 * JSON operations using MySQL's native JSON functions (5.7+).
 * 13 tools total (8 core + 4 helpers + 5 enhanced).
 */

import type { MySQLAdapter } from '../../MySQLAdapter.js';
import type { ToolDefinition } from '../../../../types/index.js';

// Import from submodules
import {
    createJsonExtractTool,
    createJsonSetTool,
    createJsonInsertTool,
    createJsonReplaceTool,
    createJsonRemoveTool,
    createJsonContainsTool,
    createJsonKeysTool,
    createJsonArrayAppendTool
} from './core.js';

import {
    createJsonGetTool,
    createJsonUpdateTool,
    createJsonSearchTool,
    createJsonValidateTool
} from './helpers.js';

import {
    createJsonMergeTool,
    createJsonDiffTool,
    createJsonNormalizeTool,
    createJsonStatsTool,
    createJsonIndexSuggestTool
} from './enhanced.js';

/**
 * Get JSON operation tools
 */
export function getJsonTools(adapter: MySQLAdapter): ToolDefinition[] {
    return [
        createJsonExtractTool(adapter),
        createJsonSetTool(adapter),
        createJsonInsertTool(adapter),
        createJsonReplaceTool(adapter),
        createJsonRemoveTool(adapter),
        createJsonContainsTool(adapter),
        createJsonKeysTool(adapter),
        createJsonArrayAppendTool(adapter)
    ];
}

/**
 * Get JSON helper tools
 */
export function getJsonHelperTools(adapter: MySQLAdapter): ToolDefinition[] {
    return [
        createJsonGetTool(adapter),
        createJsonUpdateTool(adapter),
        createJsonSearchTool(adapter),
        createJsonValidateTool(adapter)
    ];
}

/**
 * Get enhanced JSON tools
 */
export function getJsonEnhancedTools(adapter: MySQLAdapter): ToolDefinition[] {
    return [
        createJsonMergeTool(adapter),
        createJsonDiffTool(adapter),
        createJsonNormalizeTool(adapter),
        createJsonStatsTool(adapter),
        createJsonIndexSuggestTool(adapter)
    ];
}
