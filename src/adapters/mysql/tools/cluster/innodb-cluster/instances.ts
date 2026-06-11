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
  LimitSchemaBase,
  ClusterInstancesOutputSchema,
} from "../../../schemas/cluster.js";
import { READ_ONLY } from "../../../../../utils/annotations.js";
import { LimitSchema } from "./schemas.js";

export function createClusterInstancesTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_cluster_instances",
    title: "MySQL Cluster Instances",
    description: "List all instances in the InnoDB Cluster.",
    group: "cluster",
    inputSchema: LimitSchemaBase,
    outputSchema: ClusterInstancesOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      let limit: number;
      try {
        ({ limit } = LimitSchema.parse(params));
      } catch (error) {
        return formatHandlerErrorResponse(error);
      }

      try {
        const result = await adapter.executeQuery(
          `SELECT 
                        i.instance_id as instanceId,
                        i.cluster_id as clusterId,
                        i.address,
                        i.mysql_server_uuid as serverUuid,
                        i.instance_name as instanceName,
                        i.description,
                        COALESCE(m.MEMBER_STATE, 'OFFLINE') as memberState,
                        COALESCE(m.MEMBER_ROLE, 'NONE') as memberRole
                    FROM mysql_innodb_cluster_metadata.instances i
                    LEFT JOIN performance_schema.replication_group_members m
                        ON i.mysql_server_uuid = m.MEMBER_ID
                    LIMIT ${String(limit)}`,
          [],
        );

        const data = {
          instances: result.rows ?? [],
          count: result.rows?.length ?? 0,
        };
        return withTokenEstimate({ success: true, data });
      } catch (primaryError) {
        // Fallback to GR members
        try {
          const grResult = await adapter.executeQuery(
            `SELECT 
                        MEMBER_ID as serverUuid,
                        CONCAT(MEMBER_HOST, ':', MEMBER_PORT) as address,
                        MEMBER_STATE as memberState,
                        MEMBER_ROLE as memberRole,
                        MEMBER_VERSION as version
                    FROM performance_schema.replication_group_members
                    LIMIT ${String(limit)}`,
            [],
          );

          const data = {
            source: "group_replication",
            instances: grResult.rows ?? [],
            count: grResult.rows?.length ?? 0,
          };
          return withTokenEstimate({ success: true, data });
        } catch (fallbackError) {
          const fallbackMsg =
            fallbackError instanceof Error
              ? fallbackError.message
              : String(fallbackError);
          const primaryMsg =
            primaryError instanceof Error
              ? primaryError.message
              : String(primaryError);
          return formatHandlerErrorResponse(
            new Error(
              `Primary Error: ${primaryMsg}. Fallback Error: ${fallbackMsg}`,
            ),
          );
        }
      }
    },
  };
}
