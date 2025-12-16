/**
 * MySQL Text & Fulltext Tools
 * 
 * Text processing and FULLTEXT search operations.
 * 10 tools total (6 text + 4 fulltext).
 */

import type { MySQLAdapter } from '../../MySQLAdapter.js';
import type { ToolDefinition } from '../../../../types/index.js';

// Import from submodules
import {
    createRegexpMatchTool,
    createLikeSearchTool,
    createSoundexTool,
    createSubstringTool,
    createConcatTool,
    createCollationConvertTool
} from './processing.js';

import {
    createFulltextCreateTool,
    createFulltextSearchTool,
    createFulltextBooleanTool,
    createFulltextExpandTool
} from './fulltext.js';

/**
 * Get text processing tools
 */
export function getTextTools(adapter: MySQLAdapter): ToolDefinition[] {
    return [
        createRegexpMatchTool(adapter),
        createLikeSearchTool(adapter),
        createSoundexTool(adapter),
        createSubstringTool(adapter),
        createConcatTool(adapter),
        createCollationConvertTool(adapter)
    ];
}

/**
 * Get fulltext search tools
 */
export function getFulltextTools(adapter: MySQLAdapter): ToolDefinition[] {
    return [
        createFulltextCreateTool(adapter),
        createFulltextSearchTool(adapter),
        createFulltextBooleanTool(adapter),
        createFulltextExpandTool(adapter)
    ];
}
