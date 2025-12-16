/**
 * MySQL Resource - Replication
 * 
 * Replication status, lag monitoring, and GTID information.
 */
import type { MySQLAdapter } from '../MySQLAdapter.js';
import type { ResourceDefinition, RequestContext } from '../../../types/index.js';

export function createReplicationResource(adapter: MySQLAdapter): ResourceDefinition {
    return {
        uri: 'mysql://replication',
        name: 'Replication Status',
        title: 'MySQL Replication Status',
        description: 'Replication status, lag monitoring, and GTID information',
        mimeType: 'application/json',
        annotations: {
            audience: ['user', 'assistant'],
            priority: 0.6
        },
        handler: async (_uri: string, _context: RequestContext) => {
            // Check if this is a replica
            let replicaStatus: Record<string, unknown> | null = null;
            try {
                // Try MySQL 8.0.22+ syntax first
                const replicaResult = await adapter.executeQuery('SHOW REPLICA STATUS');
                if (replicaResult.rows && replicaResult.rows.length > 0) {
                    replicaStatus = replicaResult.rows[0] ?? null;
                }
            } catch {
                try {
                    // Fall back to older syntax
                    const slaveResult = await adapter.executeQuery('SHOW SLAVE STATUS');
                    if (slaveResult.rows && slaveResult.rows.length > 0) {
                        replicaStatus = slaveResult.rows[0] ?? null;
                    }
                } catch {
                    // Not a replica or no permissions
                }
            }

            // Check if this is a source/master
            let sourceStatus: Record<string, unknown> | null = null;
            try {
                const binlogResult = await adapter.executeQuery('SHOW BINARY LOG STATUS');
                if (binlogResult.rows && binlogResult.rows.length > 0) {
                    sourceStatus = binlogResult.rows[0] ?? null;
                }
            } catch {
                try {
                    // Fall back to older syntax
                    const masterResult = await adapter.executeQuery('SHOW MASTER STATUS');
                    if (masterResult.rows && masterResult.rows.length > 0) {
                        sourceStatus = masterResult.rows[0] ?? null;
                    }
                } catch {
                    // Binary logging may be disabled
                }
            }

            // Get GTID info if available
            const gtidInfo: Record<string, string> = {};
            try {
                const gtidResult = await adapter.executeQuery(`
                    SHOW GLOBAL VARIABLES WHERE Variable_name IN (
                        'gtid_mode', 'gtid_executed', 'gtid_purged', 'enforce_gtid_consistency'
                    )
                `);
                for (const row of gtidResult.rows ?? []) {
                    gtidInfo[row['Variable_name'] as string] = row['Value'] as string;
                }
            } catch {
                // GTID may not be available
            }

            // Get connected replicas if this is a source
            let replicas: unknown[] = [];
            try {
                const replicasResult = await adapter.executeQuery('SHOW REPLICAS');
                replicas = replicasResult.rows ?? [];
            } catch {
                try {
                    const replicasResult = await adapter.executeQuery('SHOW SLAVE HOSTS');
                    replicas = replicasResult.rows ?? [];
                } catch {
                    // May not have permission or no replicas connected
                }
            }

            // Determine role
            let role = 'standalone';
            if (replicaStatus) {
                role = sourceStatus ? 'replica-source' : 'replica';
            } else if (sourceStatus) {
                role = 'source';
            }

            return {
                role,
                source: sourceStatus ? {
                    file: sourceStatus['File'],
                    position: sourceStatus['Position'],
                    binlog_do_db: sourceStatus['Binlog_Do_DB'],
                    binlog_ignore_db: sourceStatus['Binlog_Ignore_DB']
                } : null,
                replica: replicaStatus ? {
                    source_host: replicaStatus['Source_Host'] ?? replicaStatus['Master_Host'],
                    source_port: replicaStatus['Source_Port'] ?? replicaStatus['Master_Port'],
                    io_running: replicaStatus['Replica_IO_Running'] ?? replicaStatus['Slave_IO_Running'],
                    sql_running: replicaStatus['Replica_SQL_Running'] ?? replicaStatus['Slave_SQL_Running'],
                    seconds_behind: replicaStatus['Seconds_Behind_Source'] ?? replicaStatus['Seconds_Behind_Master'],
                    last_error: replicaStatus['Last_Error'],
                    relay_log_file: replicaStatus['Relay_Log_File'],
                    relay_log_pos: replicaStatus['Relay_Log_Pos']
                } : null,
                gtid: gtidInfo,
                connected_replicas: replicas
            };
        }
    };
}
