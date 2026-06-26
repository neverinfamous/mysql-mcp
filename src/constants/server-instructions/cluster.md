# Cluster Tools (Group Replication + InnoDB Cluster)

## Group Replication (`mysql_gr_*`)

- **Tools available**: `mysql_gr_status`, `mysql_gr_members`, `mysql_gr_primary`, `mysql_gr_transactions`, `mysql_gr_flow_control`.
- Tools check for `group_replication` plugin status and return `{ enabled: false }` if the plugin is not active.
- **Error handling**: All 5 GR tools return structured error responses (with `error` field) on query failure instead of throwing raw exceptions. `mysql_gr_members` with a nonexistent `memberId` filter returns `{ members: [], count: 0 }` (empty results, not an error).

## InnoDB Cluster (`mysql_cluster_*`)

- **Prerequisites**: Requires InnoDB Cluster infrastructure. Connect to a cluster node (typically via MySQL Router or directly). Cluster metadata schema (mysql_innodb_cluster_metadata) must exist.
- **Cluster status**: `mysql_cluster_status` returns cluster metadata. Use `summary: true` for condensed output without Router configuration schemas. Returns `isInnoDBCluster: false` if not in a cluster.
- **Instance list**: `mysql_cluster_instances` lists all configured instances with their current member state and role. Includes offline node reporting. Accepts `limit` parameter (default: 100, must be a non-negative integer). Falls back from InnoDB Cluster metadata to Group Replication member data when metadata is unavailable (response includes `source: "group_replication"` in fallback mode).
- **Topology**: `mysql_cluster_topology` returns a structured `topology` object (with `primary`, `secondaries`, `recovering`, `offline` arrays) and a `visualization` string grouping members by role.
- **Router status**: `mysql_cluster_router_status` lists registered routers from cluster metadata. Use `summary: true` to return routerId, routerName, address, version, lastCheckIn, roPort, rwPort, and localCluster. Each router includes `isStale` (true if lastCheckIn is null or >1 hour old). The response includes `staleCount` for quick filtering.
- **Switchover analysis**: `mysql_cluster_switchover` evaluates replication lag on secondaries and rates each as GOOD (fully synced), ACCEPTABLE (<100 pending), or NOT_RECOMMENDED (>=100 pending). Response includes `currentPrimary` field (`null` when no primary exists, never absent). Returns `canSwitchover: false` with a `warning` field if no viable candidates exist.
