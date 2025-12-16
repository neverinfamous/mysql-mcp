/**
 * MySQL sys Schema Tools
 * 
 * Tools for leveraging MySQL's built-in sys schema for diagnostics.
 * 8 tools total (2 activity + 3 performance + 3 resources).
 */

import type { MySQLAdapter } from '../../MySQLAdapter.js';
import type { ToolDefinition } from '../../../../types/index.js';

// Import from submodules
import {
    createSysUserSummaryTool,
    createSysHostSummaryTool
} from './activity.js';

import {
    createSysStatementSummaryTool,
    createSysWaitSummaryTool,
    createSysIOSummaryTool
} from './performance.js';

import {
    createSysSchemaStatsTool,
    createSysInnoDBLockWaitsTool,
    createSysMemorySummaryTool
} from './resources.js';

/**
 * Get all sys schema tools
 */
export function getSysSchemaTools(adapter: MySQLAdapter): ToolDefinition[] {
    return [
        createSysUserSummaryTool(adapter),
        createSysIOSummaryTool(adapter),
        createSysStatementSummaryTool(adapter),
        createSysWaitSummaryTool(adapter),
        createSysInnoDBLockWaitsTool(adapter),
        createSysSchemaStatsTool(adapter),
        createSysHostSummaryTool(adapter),
        createSysMemorySummaryTool(adapter)
    ];
}
