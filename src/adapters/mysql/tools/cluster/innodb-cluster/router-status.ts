
import type { MySQLAdapter } from "../../../mysql-adapter/index.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../../types/index.js";
import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "../../core/error-helpers.js";
import {
  SummarySchemaBase,
  ClusterRouterStatusOutputSchema,
} from "../../../schemas/cluster.js";
import { READ_ONLY } from "../../../../../utils/annotations.js";
import { SummarySchema } from "./schemas.js";

export function createClusterRouterStatusTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_cluster_router_status",
    title: "MySQL Cluster Router Status",
    description: "Get status of MySQL Routers connected to the cluster.",
    group: "cluster",
    inputSchema: SummarySchemaBase,
    outputSchema: ClusterRouterStatusOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      // Compute staleness: null lastCheckIn or >1 hour old
      const computeStale = (lastCheckIn: unknown): boolean => {
        if (lastCheckIn == null) return true;
        const checkInTime = new Date(typeof lastCheckIn === "string" || typeof lastCheckIn === "number" ? lastCheckIn : 0).getTime();
        if (isNaN(checkInTime)) return true;
        return Date.now() - checkInTime > 3_600_000; // 1 hour
      };

      let summary: boolean | undefined;
      try {
        ({ summary } = SummarySchema.parse(params));
      } catch (error) {
        return formatHandlerErrorResponse(error);
      }

      try {
        // Summary mode: return only essential router info
        if (summary) {
          const result = await adapter.executeQuery(`
                      SELECT 
                          router_id as routerId,
                          router_name as routerName,
                          address,
                          version,
                          last_check_in as lastCheckIn,
                          JSON_UNQUOTE(JSON_EXTRACT(attributes, '$.ROEndpoint')) as roPort,
                          JSON_UNQUOTE(JSON_EXTRACT(attributes, '$.RWEndpoint')) as rwPort,
                          JSON_UNQUOTE(JSON_EXTRACT(attributes, '$.LocalCluster')) as localCluster
                      FROM mysql_innodb_cluster_metadata.routers
                  `);

          const routers = (result.rows ?? []).map((r) => ({
            ...r,
            isStale: computeStale(r["lastCheckIn"]),
          }));
          const staleCount = routers.filter((r) => r.isStale).length;

          const data = {
            routers,
            count: routers.length,
            staleCount,
          };
          return withTokenEstimate({ success: true, data });
        }

        // Full mode: include attributes but strip bulky Configuration blob
        const result = await adapter.executeQuery(`
                    SELECT 
                        router_id as routerId,
                        router_name as routerName,
                        address,
                        version,
                        last_check_in as lastCheckIn,
                        attributes
                    FROM mysql_innodb_cluster_metadata.routers
                `);

        const routers = (result.rows ?? []).map((r) => {
          let processed = r;
          if (r["attributes"] != null) {
            try {
              const attrs =
                typeof r["attributes"] === "string"
                  ? (JSON.parse(r["attributes"]) as Record<string, unknown>)
                  : (r["attributes"] as Record<string, unknown>);
              delete attrs["Configuration"];
              processed = { ...r, attributes: attrs };
            } catch {
              // Keep original if parsing fails
            }
          }
          return {
            ...processed,
            isStale: computeStale(processed["lastCheckIn"]),
          };
        });
        const staleCount = routers.filter((r) => r.isStale).length;

        const data = {
          routers,
          count: routers.length,
          staleCount,
        };
        return withTokenEstimate({ success: true, data });
      } catch (error) {
        const baseError =
          error instanceof Error
            ? error.message
            : String(error);
        return formatHandlerErrorResponse(
          new Error(
            `Router metadata not available (${baseError}). Use mysql_router_status tool if connecting directly to Router REST API.`,
          ),
        );
      }
    },
  };
}
