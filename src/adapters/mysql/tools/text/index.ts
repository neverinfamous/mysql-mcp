/**
 * MySQL Text & Fulltext Tools
 *
 * Text processing and FULLTEXT search operations.
 * 11 tools total (6 text + 5 fulltext).
 */

import type { MySQLAdapter } from "../../MySQLAdapter.js";
import type { ToolDefinition } from "../../../../types/index.js";

// Import from submodules
import {
  createRegexpMatchTool,
  createLikeSearchTool,
  createSoundexTool,
  createSubstringTool,
  createConcatTool,
  createCollationConvertTool,
} from "./processing.js";

import {
  createFulltextCreateTool,
  createFulltextDropTool,
  createFulltextSearchTool,
  createFulltextBooleanTool,
  createFulltextExpandTool,
} from "./fulltext.js";

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
    createCollationConvertTool(adapter),
  ];
}

/**
 * Get fulltext search tools
 */
export function getFulltextTools(adapter: MySQLAdapter): ToolDefinition[] {
  return [
    createFulltextCreateTool(adapter),
    createFulltextDropTool(adapter),
    createFulltextSearchTool(adapter),
    createFulltextBooleanTool(adapter),
    createFulltextExpandTool(adapter),
  ];
}
