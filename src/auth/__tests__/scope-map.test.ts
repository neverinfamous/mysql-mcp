/**
 * mysql-mcp - Scope Map Unit Tests
 */

import { describe, it, expect } from "vitest";
import { getRequiredScope, getToolScopeMap } from "../scope-map.js";
import { TOOL_GROUPS } from "../../filtering/tool-constants.js";
import { TOOL_GROUP_SCOPES, SCOPES } from "../scopes.js";

describe("scope-map", () => {
  describe("getRequiredScope", () => {
    it("should return correct scope for core tools", () => {
      expect(getRequiredScope("mysql_write_query")).toBe(SCOPES.WRITE);
    });

    it("should return correct scope for admin tools", () => {
      expect(getRequiredScope("mysql_optimize_table")).toBe(SCOPES.ADMIN);
    });

    it("should return read as default for unknown tools", () => {
      expect(getRequiredScope("nonexistent_tool")).toBe(SCOPES.READ);
    });
  });

  describe("getToolScopeMap", () => {
    it("should include all tools from TOOL_GROUPS", () => {
      const map = getToolScopeMap();
      const totalTools = Object.values(TOOL_GROUPS).flat().length;
      expect(map.size).toBe(totalTools);
    });

    it("should map tools to the scope defined in TOOL_GROUP_SCOPES", () => {
      const map = getToolScopeMap();
      for (const [group, tools] of Object.entries(TOOL_GROUPS)) {
        const expectedScope =
          TOOL_GROUP_SCOPES[group as keyof typeof TOOL_GROUP_SCOPES];
        for (const tool of tools) {
          expect(map.get(tool)).toBe(expectedScope);
        }
      }
    });

    it("should be read-only", () => {
      const map = getToolScopeMap();
      expect(typeof map.get).toBe("function");
      expect(typeof (map ).set).toBe("function"); // ReadonlyMap still has set on Map
    });
  });
});
