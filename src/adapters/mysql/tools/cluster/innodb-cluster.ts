/**
 * MySQL InnoDB Cluster Tools
 *
 * Tools for managing MySQL InnoDB Cluster.
 * 5 tools total: status, instances, topology, router status, switchover.
 */

import { z, ZodError } from "zod";
import type { MySQLAdapter } from "../../MySQLAdapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";

// =============================================================================
// Schemas
// =============================================================================

const LimitSchema = z.object({
  limit: z.number().min(0).default(100).describe("Maximum number of results"),
});

const SummarySchema = z.object({
  summary: z
    .boolean()
    .optional()
    .describe("If true, return condensed output without configuration blobs"),
});

// =============================================================================
// Tool Creation Functions
// =============================================================================

/**
 * Get InnoDB Cluster status
 */
export function createClusterStatusTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_cluster_status",
    title: "MySQL Cluster Status",
    description:
      "Get overall InnoDB Cluster status (requires mysql_innodb_cluster_metadata schema).",
    group: "cluster",
    inputSchema: SummarySchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
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
          // Fall back to GR status
          const grResult = await adapter.executeQuery(`
                        SELECT COUNT(*) as memberCount
                        FROM performance_schema.replication_group_members
                        WHERE MEMBER_STATE = 'ONLINE'
                    `);

          return {
            isInnoDBCluster: false,
            message:
              "InnoDB Cluster metadata not found. Using Group Replication status.",
            onlineMembers: grResult.rows?.[0]?.["memberCount"] ?? 0,
          };
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

        // Summary mode: return only essential metadata
        if (summary) {
          return {
            isInnoDBCluster: true,
            cluster: clusterBasic ?? null,
            instanceCount: instanceResult.rows?.[0]?.["count"] ?? 0,
            routerCount: routerResult.rows?.[0]?.["count"] ?? 0,
          };
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

        return {
          isInnoDBCluster: true,
          cluster,
          instanceCount: instanceResult.rows?.[0]?.["count"] ?? 0,
          routerCount: routerResult.rows?.[0]?.["count"] ?? 0,
        };
      } catch (error) {
        return {
          isInnoDBCluster: false,
          message:
            "Unable to query cluster metadata. Ensure InnoDB Cluster is properly configured.",
          error:
            error instanceof ZodError
              ? error.issues.map((i) => i.message).join(", ")
              : error instanceof Error
                ? error.message
                : String(error),
        };
      }
    },
  };
}

/**
 * List cluster instances
 */
export function createClusterInstancesTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_cluster_instances",
    title: "MySQL Cluster Instances",
    description: "List all instances in the InnoDB Cluster.",
    group: "cluster",
    inputSchema: LimitSchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      let limit: number;
      try {
        ({ limit } = LimitSchema.parse(params));
      } catch (error) {
        return {
          instances: [],
          count: 0,
          error:
            error instanceof ZodError
              ? error.issues.map((i) => i.message).join(", ")
              : error instanceof Error
                ? error.message
                : String(error),
        };
      }

      try {
        const result = await adapter.executeQuery(`
                    SELECT 
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
                    LIMIT ${String(limit)}
                `);

        return {
          instances: result.rows ?? [],
          count: result.rows?.length ?? 0,
        };
      } catch {
        // Fallback to GR members
        try {
          const grResult = await adapter.executeQuery(`
                    SELECT 
                        MEMBER_ID as serverUuid,
                        CONCAT(MEMBER_HOST, ':', MEMBER_PORT) as address,
                        MEMBER_STATE as memberState,
                        MEMBER_ROLE as memberRole,
                        MEMBER_VERSION as version
                    FROM performance_schema.replication_group_members
                    LIMIT ${String(limit)}
                `);

          return {
            source: "group_replication",
            instances: grResult.rows ?? [],
            count: grResult.rows?.length ?? 0,
          };
        } catch (fallbackError) {
          return {
            instances: [],
            count: 0,
            error:
              fallbackError instanceof Error
                ? fallbackError.message
                : String(fallbackError),
          };
        }
      }
    },
  };
}

/**
 * Get cluster topology visualization
 */
export function createClusterTopologyTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_cluster_topology",
    title: "MySQL Cluster Topology",
    description: "Get a visual representation of the cluster topology.",
    group: "cluster",
    inputSchema: z.object({}),
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
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
        return {
          topology,
          visualization: ascii,
          totalMembers: allMembers,
          onlineMembers: members.filter((m) => m["state"] === "ONLINE").length,
        };
      } catch (error) {
        return {
          topology: {
            primary: [],
            secondaries: [],
            recovering: [],
            offline: [],
          },
          visualization: "",
          totalMembers: 0,
          onlineMembers: 0,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  };
}

/**
 * Get cluster router status
 */
export function createClusterRouterStatusTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_cluster_router_status",
    title: "MySQL Cluster Router Status",
    description: "Get status of MySQL Routers connected to the cluster.",
    group: "cluster",
    inputSchema: SummarySchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      // Compute staleness: null lastCheckIn or >1 hour old
      const computeStale = (lastCheckIn: unknown): boolean => {
        if (lastCheckIn == null) return true;
        const checkInTime = new Date(lastCheckIn as string).getTime();
        if (isNaN(checkInTime)) return true;
        return Date.now() - checkInTime > 3_600_000; // 1 hour
      };

      try {
        const { summary } = SummarySchema.parse(params);
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

          return {
            routers,
            count: routers.length,
            staleCount,
          };
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

        return {
          routers,
          count: routers.length,
          staleCount,
        };
      } catch (error) {
        return {
          available: false,
          message:
            "Router metadata not available. Ensure InnoDB Cluster is configured.",
          suggestion:
            "Use mysql_router_status tool if connecting directly to Router REST API.",
          error:
            error instanceof ZodError
              ? error.issues.map((i) => i.message).join(", ")
              : error instanceof Error
                ? error.message
                : String(error),
        };
      }
    },
  };
}

/**
 * Get switchover recommendation
 */
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
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
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
          const txQueue = (sec["txQueue"] as number) ?? 0;
          const applierQueue = (sec["applierQueue"] as number) ?? 0;
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
        return {
          currentPrimary: members.find((m) => m["role"] === "PRIMARY"),
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
      } catch (error) {
        return {
          candidates: [],
          canSwitchover: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  };
}
