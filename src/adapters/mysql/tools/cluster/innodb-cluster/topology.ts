import { z } from "zod";
import type { MySQLAdapter } from "../../../mysql-adapter/index.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../../types/index.js";
import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "../../core/error-helpers.js";
import { ClusterTopologyOutputSchema } from "../../../schemas/cluster.js";
import { READ_ONLY } from "../../../../../utils/annotations.js";

export function createClusterTopologyTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_cluster_topology",
    title: "MySQL Cluster Topology",
    description: "Get a visual representation of the cluster topology.",
    group: "cluster",
    inputSchema: z.object({}),
    outputSchema: ClusterTopologyOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (_params: unknown, _context: RequestContext) => {
      try {
        // Get all GR members
        const membersResult = await adapter.executeQuery(`
                SELECT 
                    MEMBER_ID as id,
                    MEMBER_HOST as host,
                    MEMBER_PORT as port,
                    MEMBER_STATE as state,
                    MEMBER_ROLE as role,
                    MEMBER_VERSION as version
                FROM performance_schema.replication_group_members
                ORDER BY MEMBER_ROLE DESC, MEMBER_HOST
            `);

        const members = membersResult.rows ?? [];
        const grMemberIds = new Set(
          members.map((m) => m["id"] as string).filter(Boolean),
        );

        // Cross-reference with cluster metadata for offline instances
        let metadataOffline: Record<string, unknown>[] = [];
        try {
          const metaResult = await adapter.executeQuery(`
                  SELECT 
                      mysql_server_uuid as id,
                      SUBSTRING_INDEX(address, ':', 1) as host,
                      CAST(SUBSTRING_INDEX(address, ':', -1) AS UNSIGNED) as port
                  FROM mysql_innodb_cluster_metadata.instances
              `);
          if (metaResult.rows) {
            metadataOffline = metaResult.rows
              .filter((i) => !grMemberIds.has(i["id"] as string))
              .map((i) => ({
                id: i["id"],
                host: i["host"],
                port: i["port"],
                state: "OFFLINE",
                role: "NONE",
                version: null,
                source: "metadata",
              }));
          }
        } catch {
          // Cluster metadata not available; skip
        }

        // Build topology representation
        const topology = {
          primary: members.filter((m) => m["role"] === "PRIMARY"),
          secondaries: members.filter((m) => m["role"] === "SECONDARY"),
          recovering: members.filter((m) => m["state"] === "RECOVERING"),
          offline: [
            ...members.filter(
              (m) => m["state"] !== "ONLINE" && m["state"] !== "RECOVERING",
            ),
            ...metadataOffline,
          ],
        };

        // Generate ASCII visualization
        let ascii = "=== MySQL Cluster Topology ===\n\n";

        if (topology.primary.length > 0) {
          ascii += "  PRIMARY:\n";
          for (const p of topology.primary) {
            const pm = p;
            ascii += `    ★ ${pm["host"] as string}:${String(pm["port"])} (${pm["state"] as string})\n`;
          }
        }

        if (topology.secondaries.length > 0) {
          ascii += "\n  SECONDARY:\n";
          for (const s of topology.secondaries) {
            const sm = s;
            ascii += `    ○ ${sm["host"] as string}:${String(sm["port"])} (${sm["state"] as string})\n`;
          }
        }

        if (topology.recovering.length > 0) {
          ascii += "\n  RECOVERING:\n";
          for (const r of topology.recovering) {
            const rm = r;
            ascii += `    ⟳ ${rm["host"] as string}:${String(rm["port"])}\n`;
          }
        }

        if (topology.offline.length > 0) {
          ascii += "\n  OFFLINE/ERROR:\n";
          for (const o of topology.offline) {
            const om = o;
            ascii += `    ✗ ${om["host"] as string}:${String(om["port"])} (${om["state"] as string})\n`;
          }
        }

        const allMembers = members.length + metadataOffline.length;
        const data = {
          topology,
          visualization: ascii,
          totalMembers: allMembers,
          onlineMembers: members.filter((m) => m["state"] === "ONLINE").length,
        };
        return withTokenEstimate({ success: true, data });
      } catch (error) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}
