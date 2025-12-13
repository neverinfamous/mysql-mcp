/**
 * MySQL Replication & Partitioning Tools
 * 
 * Replication monitoring and partition management.
 * 9 tools total (5 replication + 4 partitioning).
 */

/* eslint-disable @typescript-eslint/strict-boolean-expressions */
/* eslint-disable @typescript-eslint/restrict-template-expressions */

import type { MySQLAdapter } from '../MySQLAdapter.js';
import type { ToolDefinition, RequestContext } from '../../../types/index.js';
import {
    BinlogEventsSchema,
    PartitionInfoSchema,
    AddPartitionSchema,
    DropPartitionSchema,
    ReorganizePartitionSchema
} from '../types.js';
import { z } from 'zod';

/**
 * Get replication tools
 */
export function getReplicationTools(adapter: MySQLAdapter): ToolDefinition[] {
    return [
        createMasterStatusTool(adapter),
        createSlaveStatusTool(adapter),
        createBinlogEventsTool(adapter),
        createGtidStatusTool(adapter),
        createReplicationLagTool(adapter)
    ];
}

/**
 * Get partitioning tools
 */
export function getPartitioningTools(adapter: MySQLAdapter): ToolDefinition[] {
    return [
        createPartitionInfoTool(adapter),
        createAddPartitionTool(adapter),
        createDropPartitionTool(adapter),
        createReorganizePartitionTool(adapter)
    ];
}

// =============================================================================
// Replication Tools
// =============================================================================

function createMasterStatusTool(adapter: MySQLAdapter): ToolDefinition {
    const schema = z.object({});

    return {
        name: 'mysql_master_status',
        description: 'Get binary log position from master/source server.',
        group: 'replication',
        inputSchema: schema,
        requiredScopes: ['read'],
        handler: async (_params: unknown, _context: RequestContext) => {
            // Try new syntax first, then old
            try {
                const result = await adapter.executeQuery('SHOW BINARY LOG STATUS');
                return { status: result.rows?.[0] };
            } catch {
                try {
                    const result = await adapter.executeQuery('SHOW MASTER STATUS');
                    return { status: result.rows?.[0] };
                } catch (e) {
                    return { error: 'Binary logging may not be enabled', details: String(e) };
                }
            }
        }
    };
}

function createSlaveStatusTool(adapter: MySQLAdapter): ToolDefinition {
    const schema = z.object({});

    return {
        name: 'mysql_slave_status',
        description: 'Get detailed replication slave/replica status.',
        group: 'replication',
        inputSchema: schema,
        requiredScopes: ['read'],
        handler: async (_params: unknown, _context: RequestContext) => {
            // Try new syntax first
            try {
                const result = await adapter.executeQuery('SHOW REPLICA STATUS');
                return { status: result.rows?.[0] };
            } catch {
                try {
                    const result = await adapter.executeQuery('SHOW SLAVE STATUS');
                    return { status: result.rows?.[0] };
                } catch {
                    return { status: null, message: 'This server is not configured as a replica' };
                }
            }
        }
    };
}

function createBinlogEventsTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_binlog_events',
        description: 'View binary log events for point-in-time recovery or replication debugging.',
        group: 'replication',
        inputSchema: BinlogEventsSchema,
        requiredScopes: ['read'],
        handler: async (params: unknown, _context: RequestContext) => {
            const { logFile, position, limit } = BinlogEventsSchema.parse(params);

            let sql = 'SHOW BINLOG EVENTS';
            const parts: string[] = [];

            if (logFile) {
                parts.push(`IN '${logFile}'`);
            }
            if (position) {
                parts.push(`FROM ${position}`);
            }
            parts.push(`LIMIT ${limit}`);

            sql += ' ' + parts.join(' ');

            const result = await adapter.executeQuery(sql);
            return { events: result.rows };
        }
    };
}

function createGtidStatusTool(adapter: MySQLAdapter): ToolDefinition {
    const schema = z.object({});

    return {
        name: 'mysql_gtid_status',
        description: 'Get Global Transaction ID (GTID) status for replication.',
        group: 'replication',
        inputSchema: schema,
        requiredScopes: ['read'],
        handler: async (_params: unknown, _context: RequestContext) => {
            // Get GTID executed
            const executedResult = await adapter.executeQuery(
                "SELECT @@global.gtid_executed as gtid_executed"
            );

            // Get GTID purged
            const purgedResult = await adapter.executeQuery(
                "SELECT @@global.gtid_purged as gtid_purged"
            );

            // Get GTID mode
            const modeResult = await adapter.executeQuery(
                "SELECT @@global.gtid_mode as gtid_mode"
            );

            return {
                gtidExecuted: executedResult.rows?.[0]?.['gtid_executed'],
                gtidPurged: purgedResult.rows?.[0]?.['gtid_purged'],
                gtidMode: modeResult.rows?.[0]?.['gtid_mode']
            };
        }
    };
}

function createReplicationLagTool(adapter: MySQLAdapter): ToolDefinition {
    const schema = z.object({});

    return {
        name: 'mysql_replication_lag',
        description: 'Calculate replication lag in seconds.',
        group: 'replication',
        inputSchema: schema,
        requiredScopes: ['read'],
        handler: async (_params: unknown, _context: RequestContext) => {
            // Try to get Seconds_Behind_Master from replica status
            try {
                const result = await adapter.executeQuery('SHOW REPLICA STATUS');
                const status = result.rows?.[0];

                if (status) {
                    return {
                        lagSeconds: status['Seconds_Behind_Source'] ?? status['Seconds_Behind_Master'],
                        ioRunning: status['Replica_IO_Running'] ?? status['Slave_IO_Running'],
                        sqlRunning: status['Replica_SQL_Running'] ?? status['Slave_SQL_Running'],
                        lastError: status['Last_Error']
                    };
                }
            } catch {
                try {
                    const result = await adapter.executeQuery('SHOW SLAVE STATUS');
                    const status = result.rows?.[0];

                    if (status) {
                        return {
                            lagSeconds: status['Seconds_Behind_Master'],
                            ioRunning: status['Slave_IO_Running'],
                            sqlRunning: status['Slave_SQL_Running'],
                            lastError: status['Last_Error']
                        };
                    }
                } catch {
                    // Not a replica
                }
            }

            return {
                lagSeconds: null,
                message: 'This server is not configured as a replica'
            };
        }
    };
}

// =============================================================================
// Partitioning Tools
// =============================================================================

function createPartitionInfoTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_partition_info',
        description: 'Get partition information for a table.',
        group: 'partitioning',
        inputSchema: PartitionInfoSchema,
        requiredScopes: ['read'],
        handler: async (params: unknown, _context: RequestContext) => {
            const { table } = PartitionInfoSchema.parse(params);

            const result = await adapter.executeQuery(`
                SELECT 
                    PARTITION_NAME,
                    PARTITION_ORDINAL_POSITION,
                    PARTITION_METHOD,
                    PARTITION_EXPRESSION,
                    PARTITION_DESCRIPTION,
                    TABLE_ROWS,
                    AVG_ROW_LENGTH,
                    DATA_LENGTH,
                    INDEX_LENGTH,
                    CREATE_TIME,
                    UPDATE_TIME
                FROM information_schema.PARTITIONS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = ?
                ORDER BY PARTITION_ORDINAL_POSITION
            `, [table]);

            // Check if table is partitioned
            const firstRow = result.rows?.[0];
            if (!firstRow || firstRow['PARTITION_NAME'] === null) {
                return {
                    partitioned: false,
                    message: 'Table is not partitioned'
                };
            }

            return {
                partitioned: true,
                method: firstRow['PARTITION_METHOD'],
                expression: firstRow['PARTITION_EXPRESSION'],
                partitions: result.rows
            };
        }
    };
}

function createAddPartitionTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_add_partition',
        description: 'Add a new partition to a partitioned table.',
        group: 'partitioning',
        inputSchema: AddPartitionSchema,
        requiredScopes: ['admin'],
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, partitionName, partitionType, value } = AddPartitionSchema.parse(params);

            let sql: string;

            switch (partitionType) {
                case 'RANGE':
                    sql = `ALTER TABLE \`${table}\` ADD PARTITION (PARTITION \`${partitionName}\` VALUES LESS THAN (${value}))`;
                    break;
                case 'LIST':
                    sql = `ALTER TABLE \`${table}\` ADD PARTITION (PARTITION \`${partitionName}\` VALUES IN (${value}))`;
                    break;
                case 'HASH':
                case 'KEY':
                    sql = `ALTER TABLE \`${table}\` ADD PARTITION PARTITIONS ${value}`;
                    break;
                default:
                    throw new Error(`Unsupported partition type: ${partitionType}`);
            }

            await adapter.executeQuery(sql);
            return { success: true, table, partitionName };
        }
    };
}

function createDropPartitionTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_drop_partition',
        description: 'Drop a partition from a partitioned table. Warning: This deletes all data in the partition!',
        group: 'partitioning',
        inputSchema: DropPartitionSchema,
        requiredScopes: ['admin'],
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, partitionName } = DropPartitionSchema.parse(params);

            await adapter.executeQuery(
                `ALTER TABLE \`${table}\` DROP PARTITION \`${partitionName}\``
            );

            return {
                success: true,
                table,
                partitionName,
                warning: 'All data in this partition has been deleted'
            };
        }
    };
}

function createReorganizePartitionTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_reorganize_partition',
        description: 'Reorganize partitions by splitting or merging them.',
        group: 'partitioning',
        inputSchema: ReorganizePartitionSchema,
        requiredScopes: ['admin'],
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, fromPartitions, toPartitions } = ReorganizePartitionSchema.parse(params);

            const fromList = fromPartitions.map(p => `\`${p}\``).join(', ');
            const toList = toPartitions.map(p =>
                `PARTITION \`${p.name}\` VALUES LESS THAN (${p.value})`
            ).join(', ');

            const sql = `ALTER TABLE \`${table}\` REORGANIZE PARTITION ${fromList} INTO (${toList})`;

            await adapter.executeQuery(sql);
            return {
                success: true,
                table,
                fromPartitions,
                toPartitions: toPartitions.map(p => p.name)
            };
        }
    };
}
