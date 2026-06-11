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
import { ClusterSwitchoverOutputSchema } from "../../../schemas/cluster.js";
import { READ_ONLY } from "../../../../../utils/annotations.js";

export function createClusterSwitchoverTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_cluster_switchover",
    title: "MySQL Cluster Switchover Analysis",
    description:
      "Analyze cluster state and provide switchover recommendations.",
    group: "cluster",
    inputSchema: z.object({}),
    outputSchema: ClusterSwitchoverOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (_params: unknown, _context: RequestContext) => {
      try {
        // Get current members status
        const membersResult = await adapter.executeQuery(`
                SELECT 
                    m.MEMBER_ID as memberId,
                    m.MEMBER_HOST as host,
                    m.MEMBER_PORT as port,
                    m.MEMBER_STATE as state,
                    m.MEMBER_ROLE as role,
                    m.MEMBER_VERSION as version,
                    s.COUNT_TRANSACTIONS_IN_QUEUE as txQueue,
                    s.COUNT_TRANSACTIONS_REMOTE_IN_APPLIER_QUEUE as applierQueue
                FROM performance_schema.replication_group_members m
                LEFT JOIN performance_schema.replication_group_member_stats s
                    ON m.MEMBER_ID = s.MEMBER_ID
            `);

        const members = membersResult.rows ?? [];
        const onlineSecondaries = members.filter((m) => {
          const member = m;
          return member["state"] === "ONLINE" && member["role"] === "SECONDARY";
        });

        // Analyze each secondary for switchover suitability
        const candidates = onlineSecondaries.map((s) => {
          const sec = s;
          const txQueue = Number(sec["txQueue"] ?? 0);
          const applierQueue = Number(sec["applierQueue"] ?? 0);
          const totalQueue = txQueue + applierQueue;

          let suitability: "GOOD" | "ACCEPTABLE" | "NOT_RECOMMENDED";
          let reason: string;

          if (totalQueue === 0) {
            suitability = "GOOD";
            reason = "Fully synchronized";
          } else if (totalQueue < 100) {
            suitability = "ACCEPTABLE";
            reason = `Minor lag: ${String(totalQueue)} transactions pending`;
          } else {
            suitability = "NOT_RECOMMENDED";
            reason = `Significant lag: ${String(totalQueue)} transactions pending`;
          }

          return {
            memberId: sec["memberId"],
            host: sec["host"],
            port: sec["port"],
            version: sec["version"],
            txQueue,
            applierQueue,
            suitability,
            reason,
          };
        });

        // Sort by suitability
        candidates.sort((a, b) => {
          const order = { GOOD: 0, ACCEPTABLE: 1, NOT_RECOMMENDED: 2 };
          return order[a.suitability] - order[b.suitability];
        });

        const firstCandidate = candidates[0];
        const data = {
          currentPrimary: members.find((m) => m["role"] === "PRIMARY") ?? null,
          candidates,
          recommendedTarget:
            candidates.length > 0 &&
            firstCandidate &&
            firstCandidate.suitability !== "NOT_RECOMMENDED"
              ? firstCandidate
              : null,
          canSwitchover: candidates.some(
            (c) => c.suitability !== "NOT_RECOMMENDED",
          ),
          warning:
            onlineSecondaries.length === 0
              ? "No online secondaries available for switchover."
              : candidates.every((c) => c.suitability === "NOT_RECOMMENDED")
                ? "All secondaries have significant replication lag. Switchover not recommended."
                : undefined,
        };
        return withTokenEstimate({ success: true, data });
      } catch (error) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}
