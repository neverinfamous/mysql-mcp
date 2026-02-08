/**
 * MySQL Resource - Cluster
 */
import type { MySQLAdapter } from "../MySQLAdapter.js";
import type {
  ResourceDefinition,
  RequestContext,
} from "../../../types/index.js";

export function createClusterResource(
  adapter: MySQLAdapter,
): ResourceDefinition {
  return {
    uri: "mysql://cluster",
    name: "Cluster Status",
    title: "MySQL Group Replication / InnoDB Cluster",
    description: "Group Replication and InnoDB Cluster status overview",
    mimeType: "application/json",
    annotations: {
      audience: ["user", "assistant"],
      priority: 0.7,
    },
    handler: async (_uri: string, _context: RequestContext) => {
      try {
        // Check if Group Replication is enabled
        const grStatusResult = await adapter.executeQuery(
          "SHOW VARIABLES LIKE 'group_replication_group_name'",
        );
        const grRow = grStatusResult.rows?.[0];
        const groupNameVal = grRow?.["Value"];
        const groupName =
          typeof groupNameVal === "string" ? groupNameVal : null;

        if (groupName === null || groupName === "") {
          return {
            groupReplicationEnabled: false,
            message: "Group Replication is not configured",
          };
        }

        // Get members
        const membersResult = await adapter.executeQuery(`
                    SELECT 
                        MEMBER_ID as id,
                        MEMBER_HOST as host,
                        MEMBER_PORT as port,
                        MEMBER_STATE as state,
                        MEMBER_ROLE as role,
                        MEMBER_VERSION as version
                    FROM performance_schema.replication_group_members
                `);

        // Get primary
        const primaryResult = await adapter.executeQuery(`
                    SELECT MEMBER_HOST as host, MEMBER_PORT as port
                    FROM performance_schema.replication_group_members
                    WHERE MEMBER_ROLE = 'PRIMARY'
                `);
        const primaryRow = primaryResult.rows?.[0];

        return {
          groupReplicationEnabled: true,
          groupName,
          memberCount: membersResult.rows?.length ?? 0,
          members: membersResult.rows ?? [],
          primary: primaryRow
            ? `${String(primaryRow["host"])}:${String(primaryRow["port"])}`
            : null,
        };
      } catch {
        return {
          groupReplicationEnabled: false,
          message: "Unable to retrieve cluster information",
          suggestion:
            "Group Replication may not be configured or insufficient privileges",
        };
      }
    },
  };
}
