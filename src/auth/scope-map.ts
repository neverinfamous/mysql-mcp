/**
 * mysql-mcp - Scope Map
 *
 * O(1) reverse lookup from tool name to required OAuth scope.
 * Built by inverting TOOL_GROUPS and TOOL_GROUP_SCOPES at module load.
 */

import { TOOL_GROUPS } from "../filtering/tool-constants.js";
import { TOOL_GROUP_SCOPES, SCOPES, TOOL_SCOPE_OVERRIDES } from "./scopes.js";
import type { StandardScope } from "./scopes.js";

// Build reverse map: tool name → required scope
const toolScopeMap = new Map<string, StandardScope>();

for (const [group, tools] of Object.entries(TOOL_GROUPS)) {
  let scope: StandardScope = SCOPES.READ;
  for (const [g, s] of Object.entries(TOOL_GROUP_SCOPES)) {
    if (g === group) {
      scope = s;
      break;
    }
  }
  for (const tool of tools) {
    toolScopeMap.set(tool, scope);
  }
}

// Apply per-tool overrides (e.g., core write/destructive tools)
for (const [toolName, scope] of Object.entries(TOOL_SCOPE_OVERRIDES)) {
  if (scope) {
    toolScopeMap.set(toolName, scope);
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
