/**
 * mysql-mcp - Scope Map
 *
 * O(1) reverse lookup from tool name to required OAuth scope.
 * Built by inverting TOOL_GROUPS and TOOL_GROUP_SCOPES at module load.
 */

import { TOOL_GROUPS } from "../filtering/tool-constants.js";
import { TOOL_GROUP_SCOPES, SCOPES } from "./scopes.js";
import type { StandardScope } from "./scopes.js";
import type { ToolGroup } from "../types/index.js";

// Build reverse map: tool name → required scope
const toolScopeMap = new Map<string, StandardScope>();

for (const [group, tools] of Object.entries(TOOL_GROUPS)) {
  const scope = TOOL_GROUP_SCOPES[group as ToolGroup] ?? SCOPES.READ;
  for (const tool of tools) {
    toolScopeMap.set(tool, scope);
  }
}

/**
 * Get the required scope for a tool by name (O(1) lookup).
 * Returns 'read' as safe default for unknown tools.
 */
export function getRequiredScope(toolName: string): StandardScope {
  return toolScopeMap.get(toolName) ?? SCOPES.READ;
}

/**
 * Get the full tool-to-scope map (read-only).
 */
export function getToolScopeMap(): ReadonlyMap<string, StandardScope> {
  return toolScopeMap;
}
