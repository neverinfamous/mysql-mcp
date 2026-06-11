import type { ToolDefinition, RequestContext } from "../../../../types/index.js";
import { formatHandlerErrorResponse, withTokenEstimate } from "../core/error-helpers.js";
import {
  MetadataNameInputSchema,
  MetadataNameInputSchemaBase,
  RouterMetadataStatusOutputSchema,
} from "../../schemas/router.js";
import { safeRouterFetch } from "./utils.js";

export function createRouterMetadataStatusTool(): ToolDefinition {
  return {
    name: "mysql_router_metadata_status",
    title: "MySQL Router Metadata Status",
    description:
      "Get InnoDB Cluster metadata cache status including refresh statistics and last refresh host.",
    group: "router",
    inputSchema: MetadataNameInputSchemaBase,
    outputSchema: RouterMetadataStatusOutputSchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { metadataName } = MetadataNameInputSchema.parse(params);
        const result = await safeRouterFetch<unknown>(
          `/metadata/${encodeURIComponent(metadataName)}/status`,
        );
        if (!result.success) {
          return result.response;
        }
        return withTokenEstimate({
          success: true,
          data: {
            metadataName,
            status: result.data,
          },
        });
      } catch (err) {
        return formatHandlerErrorResponse(err);
      }
    },
  };
}
