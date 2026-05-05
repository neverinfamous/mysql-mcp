/**
 * MySQL Prompt - Replication Setup
 *
 * MySQL replication configuration guide.
 */
import type { PromptDefinition, RequestContext } from "../../../types/index.js";

export function createSetupReplicationPrompt(): PromptDefinition {
  return {
    name: "mysql_setup_replication",
    description: "MySQL replication setup and configuration guide",
    arguments: [
      {
        name: "type",
        description: "Replication type: async, semisync, group",
        required: false,
      },
    ],
    handler: (args: Record<string, string>, _context: RequestContext) => {
      const replicationType = args["type"] ?? "async";

      return Promise.resolve(`# MySQL Replication Setup Guide

Configure MySQL replication for high availability and read scaling.

**Replication Type:** ${replicationType}

## Step 1: Check Current Replication Status

Use \`mysql://replication\` resource to check:
- Current role (source/replica/standalone)
- Binary log configuration
- GTID status

## Step 2: Prepare Source Server

### Enable Binary Logging
\`\`\`ini
# my.cnf on source
[mysqld]
server-id = 1
log_bin = mysql-bin
binlog_format = ROW
gtid_mode = ON
enforce_gtid_consistency = ON
\`\`\`

### Create Replication User
\`\`\`sql
CREATE USER 'repl'@'%' IDENTIFIED BY 'replication_password';
GRANT REPLICATION SLAVE ON *.* TO 'repl'@'%';
\`\`\`

## Step 3: Prepare Replica Server

### Configure Replica
\`\`\`ini
# my.cnf on replica
[mysqld]
server-id = 2
log_bin = mysql-bin
relay_log = relay-bin
gtid_mode = ON
enforce_gtid_consistency = ON
read_only = ON
super_read_only = ON
${
  replicationType === "semisync"
    ? `
# Semi-synchronous replication
rpl_semi_sync_replica_enabled = 1`
    : ""
}
\`\`\`

## Step 4: Initialize Replica

### Option A: GTID-based (Recommended)
\`\`\`sql
CHANGE REPLICATION SOURCE TO
    SOURCE_HOST = 'source-host',
    SOURCE_PORT = 3306,
    SOURCE_USER = 'repl',
    SOURCE_PASSWORD = 'replication_password',
    SOURCE_AUTO_POSITION = 1;

START REPLICA;
\`\`\`

### Option B: Binary Log Position
\`\`\`sql
-- Get position from source
SHOW BINARY LOG STATUS;

-- On replica
CHANGE REPLICATION SOURCE TO
    SOURCE_HOST = 'source-host',
    SOURCE_PORT = 3306,
    SOURCE_USER = 'repl',
    SOURCE_PASSWORD = 'replication_password',
    SOURCE_LOG_FILE = 'mysql-bin.000001',
    SOURCE_LOG_POS = 123456;

START REPLICA;
\`\`\`

## Step 5: Verify Replication

Use these tools to verify:
- \`mysql_replication_status\` - Detailed status
- \`mysql_replication_lag\` - Check replication delay
- \`mysql://replication\` - Overall status

\`\`\`sql
SHOW REPLICA STATUS\\G
\`\`\`

Key things to check:
- Replica_IO_Running: Yes
- Replica_SQL_Running: Yes
- Seconds_Behind_Source: 0 (or low)

## Semi-Synchronous Replication

For reduced data loss risk:
\`\`\`sql
-- On source
INSTALL PLUGIN rpl_semi_sync_source SONAME 'semisync_source.so';
SET GLOBAL rpl_semi_sync_source_enabled = 1;

-- On replica
INSTALL PLUGIN rpl_semi_sync_replica SONAME 'semisync_replica.so';
SET GLOBAL rpl_semi_sync_replica_enabled = 1;
\`\`\`

## Monitoring

Regular monitoring should include:
- Replication lag trends
- Binary log volume
- Error log for replication errors
- GTID gaps

## Failover Procedure

1. Verify replica is caught up
2. Stop replication on replica
3. Promote replica: \`SET GLOBAL read_only = OFF;\`
4. Update application connection strings
5. Re-point other replicas to new source

Start by checking current replication status with \`mysql://replication\`.`);
    },
  };
}
