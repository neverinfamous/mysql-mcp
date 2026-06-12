/**
 * MySQL Admin Tools - Insights
 *
 * Business insight management tool.
 * 1 tool total.
 */

import { z } from "zod";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import { insightsManager } from "../../../../utils/insights-manager.js";
import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "../core/error-helpers.js";
import { ValidationError } from "../../../../types/index.js";
import { AppendInsightOutputSchema } from "../../schemas/index.js";

// =============================================================================
// Schemas
// =============================================================================

const AppendInsightSchema = z.object({
  insight: z
    .string()
    .describe(
      "Business insight text to record (e.g., 'Sales table has 40% NULL values in email column').",
    ),
});

// =============================================================================
// Tool
// =============================================================================

export function createAppendInsightTool(): ToolDefinition {
  return {
    name: "mysql_append_insight",
    title: "Append Insight",
    description:
      "Append a business insight to the in-memory insights memo. Insights are accessible via the mysql://insights resource. Use to record key findings during database analysis.",
    group: "admin",
    inputSchema: AppendInsightSchema,
    outputSchema: AppendInsightOutputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
      sensitiveHint: false,
    },
    handler: (params: unknown, _context: RequestContext) => {
      try {
        const parsed = AppendInsightSchema.parse(params);

        if (!parsed.insight?.trim()) {
          return Promise.resolve(
            formatHandlerErrorResponse(
              new ValidationError("Insight text cannot be empty"),
            ),
          );
        }

        if (parsed.insight.length > 1000) {
          const lenStr = parsed.insight.length.toString(10);
          return Promise.resolve(
            formatHandlerErrorResponse(
              new ValidationError(
                `Insight text is too long (${lenStr} chars). Maximum allowed is 1000 characters.`,
              ),
            ),
          );
        }

        insightsManager.append(parsed.insight);

        return Promise.resolve(
          withTokenEstimate({
            success: true,
            data: {
              insightCount: insightsManager.count(),
              message: `Insight recorded (${String(insightsManager.count())} total)`,
            }
          }),
        );
      } catch (err: unknown) {
        return Promise.resolve(formatHandlerErrorResponse(err));
      }
    },
  };
}
