/**
 * MySQL Prompt - InnoDB Cluster Setup
 *
 * Complete InnoDB Cluster and Group Replication setup guide.
 */
import type { PromptDefinition, RequestContext } from "../../../types/index.js";

export function createSetupClusterPrompt(): PromptDefinition {
  return {
    name: "mysql_setup_cluster",
    description:
      "Complete MySQL InnoDB Cluster and Group Replication setup guide",
    arguments: [],
    handler: (_args: Record<string, string>, _context: RequestContext) => {
      return Promise.resolve(`# MySQL InnoDB Cluster Setup Guide

InnoDB Cluster provides a complete high availability solution using Group Replication, MySQL Shell, and MySQL Router.

## Prerequisites

1. **MySQL 8.0+** (required for InnoDB Cluster)
2. **MySQL Shell** installed
3. **At least 3 servers** for fault tolerance
4. **Network connectivity** between all nodes

## Architecture

\`\`\`
┌─────────────────┐
│  MySQL Router   │  ← Applications connect here
└────────┬────────┘
         │
┌────────┴────────┐
│  InnoDB Cluster │
├─────────────────┤
│ Primary (R/W)   │
│ Secondary (R/O) │
│ Secondary (R/O) │
└─────────────────┘
\`\`\`

## Step 1: Configure Instances

On each MySQL server, add to my.cnf:
\`\`\`ini
[mysqld]
server_id = 1  # Unique per server
gtid_mode = ON
enforce_gtid_consistency = ON
binlog_checksum = NONE
\`\`\`

## Step 2: Create Cluster (MySQL Shell)

\`\`\`javascript
// Connect to primary
\\connect admin@primary-host:3306

// Configure instance
dba.configureInstance('admin@primary-host:3306');

// Create cluster
var cluster = dba.createCluster('myCluster');

// Add instances
cluster.addInstance('admin@secondary1:3306');
cluster.addInstance('admin@secondary2:3306');
\`\`\`

## Step 3: Check Cluster Status

\`\`\`javascript
cluster.status()
\`\`\`

## Step 4: Bootstrap Router

\`\`\`bash
mysqlrouter --bootstrap admin@primary-host:3306 --user=mysqlrouter
\`\`\`

## Available MCP Tools

| Tool | Description |
|------|-------------|
| \`mysql_gr_status\` | Group Replication status |
| \`mysql_gr_members\` | List group members |
| \`mysql_gr_primary\` | Identify current primary |
| \`mysql_gr_transactions\` | Pending/applied transactions |
| \`mysql_gr_flow_control\` | Flow control stats |
| \`mysql_cluster_status\` | InnoDB Cluster status |
| \`mysql_cluster_instances\` | List cluster instances |
| \`mysql_cluster_topology\` | Cluster topology |
| \`mysql_cluster_router_status\` | Router integration |
| \`mysql_cluster_switchover\` | Switchover recommendation |

## Failover Handling

Automatic failover happens when:
1. Primary becomes unreachable
2. Majority of nodes agree (quorum)
3. New primary is elected

Manual failover:
\`\`\`javascript
cluster.setPrimaryInstance('admin@new-primary:3306')
\`\`\`

## Best Practices

1. **Use odd number of nodes** (3, 5, 7) for quorum
2. **Deploy Router on app servers** for low latency
3. **Monitor replication lag** with flow control
4. **Test failover regularly** in staging

Start by checking cluster status with \`mysql_cluster_status\`.`);
    },
  };
}
