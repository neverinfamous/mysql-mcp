/**
 * Insights Resource
 *
 * Exposes the business insights memo via the mysql://insights URI.
 * Insights are collected via the mysql_append_insight tool.
 */

import type {
  ResourceDefinition,
  RequestContext,
} from "../../../types/index.js";
import { insightsManager } from "../../../utils/insights-manager.js";

export function createInsightsResource(): ResourceDefinition {
  return {
    uri: "mysql://insights",
    name: "Business Insights Memo",
    description:
      "Synthesized memo of business insights discovered during database analysis. Populated via mysql_append_insight tool.",
    mimeType: "text/plain",
    handler: async (_uri: string, _context: RequestContext) => {
      const memo = await Promise.resolve(insightsManager.synthesizeMemo());
      return memo;
    },
  };
}
