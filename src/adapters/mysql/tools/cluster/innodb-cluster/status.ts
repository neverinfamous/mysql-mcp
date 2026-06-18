import type { MySQLAdapter } from "../../../mysql-adapter/index.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../../types/index.js";
import { ExtensionNotAvailableError } from "../../../../../types/index.js";
import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "../../core/error-helpers.js";
import {
  SummarySchemaBase,
  ClusterStatusOutputSchema,
} from "../../../schemas/cluster.js";
import { READ_ONLY } from "../../../../../utils/annotations.js";
import { SummarySchema } from "./schemas.js";

export function createClusterStatusTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_cluster_status",
    title: "MySQL Cluster Status",
    description:
      "Get overall InnoDB Cluster status (requires mysql_innodb_cluster_metadata schema).",
    group: "cluster",
    inputSchema: SummarySchemaBase,
    outputSchema: ClusterStatusOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { summary } = SummarySchema.parse(params);
        // Check for cluster metadata schema
        const schemaCheck = await adapter.executeQuery(`
                    SELECT SCHEMA_NAME
                    FROM information_schema.SCHEMATA
                    WHERE SCHEMA_NAME = 'mysql_innodb_cluster_metadata'
                `);

        if (!schemaCheck.rows || schemaCheck.rows.length === 0) {
          return formatHandlerErrorResponse(
            new ExtensionNotAvailableError(
              "InnoDB Cluster metadata not found. No InnoDB Cluster configured.",
            ),
          );
        }

        // Get cluster info
        const clusterResult = await adapter.executeQuery(`
                    SELECT cluster_id, cluster_name, description, cluster_type, primary_mode
                    FROM mysql_innodb_cluster_metadata.clusters
                    LIMIT 1
                `);

        const clusterBasic = clusterResult.rows?.[0];

        // Get instance count
        const instanceResult = await adapter.executeQuery(`
                    SELECT COUNT(*) as count
                    FROM mysql_innodb_cluster_metadata.instances
                `);

        // Get router count
        const routerResult = await adapter.executeQuery(`
                    SELECT COUNT(*) as count
                    FROM mysql_innodb_cluster_metadata.routers
                `);

        // Compute status and topology
        const grResult = await adapter.executeQuery(`
            SELECT MEMBER_HOST as host, MEMBER_PORT as port, MEMBER_STATE as state, MEMBER_ROLE as role
            FROM performance_schema.replication_group_members
        `);
        const members = grResult.rows ?? [];
        const isOnline =
          members.length > 0 && members.some((m) => m["state"] === "ONLINE");
        const status = isOnline
          ? members.every((m) => m["state"] === "ONLINE")
            ? "OK"
            : "OK_PARTIAL"
          : "OFFLINE";
        const topology = members.reduce<Record<string, unknown>>((acc, m) => {
          acc[`${String(m["host"])}:${String(m["port"])}`] = {
            status: m["state"],
            role: m["role"],
          };
          return acc;
        }, {});

        // Summary mode: return only essential metadata
        if (summary) {
          const data = {
            isInnoDBCluster: true,
            cluster: clusterBasic ?? null,
            instanceCount: instanceResult.rows?.[0]?.["count"] ?? 0,
            routerCount: routerResult.rows?.[0]?.["count"] ?? 0,
            status,
            topology,
          };
          return withTokenEstimate({ success: true, data });
        }

        // Full mode: include all cluster metadata including options/attributes
        const fullClusterResult = await adapter.executeQuery(`
                    SELECT *
                    FROM mysql_innodb_cluster_metadata.clusters
                    LIMIT 1
                `);

        // Strip bulky Router Configuration blob from router_options to reduce payload
        const cluster = fullClusterResult.rows?.[0] ?? null;
        if (cluster?.["router_options"] != null) {
          try {
            const opts =
              typeof cluster["router_options"] === "string"
                ? (JSON.parse(cluster["router_options"]) as Record<
                    string,
                    unknown
                  >)
                : (cluster["router_options"] as Record<string, unknown>);
            delete opts["Configuration"];
            cluster["router_options"] = opts;
          } catch {
            // Keep original if parsing fails
          }
        }

        const data = {
          isInnoDBCluster: true,
          cluster,
          instanceCount: instanceResult.rows?.[0]?.["count"] ?? 0,
          routerCount: routerResult.rows?.[0]?.["count"] ?? 0,
          status,
          topology,
        };
        return withTokenEstimate({ success: true, data });
      } catch (error) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}
