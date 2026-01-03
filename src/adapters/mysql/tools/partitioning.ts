/**
 * MySQL Partitioning Tools
 * 
 * Partition management for table partitioning.
 * 4 tools: partition_info, add_partition, drop_partition, reorganize_partition.
 */

import type { MySQLAdapter } from '../MySQLAdapter.js';
import type { ToolDefinition, RequestContext } from '../../../types/index.js';
import {
    PartitionInfoSchema,
    AddPartitionSchema,
    DropPartitionSchema,
    ReorganizePartitionSchema
} from '../types.js';

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

function createPartitionInfoTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_partition_info',
        title: 'MySQL Partition Info',
        description: 'Get partition information for a table.',
        group: 'partitioning',
        inputSchema: PartitionInfoSchema,
        requiredScopes: ['read'],
        annotations: {
            readOnlyHint: true,
            idempotentHint: true
        },
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
        title: 'MySQL Add Partition',
        description: 'Add a new partition to a partitioned table.',
        group: 'partitioning',
        inputSchema: AddPartitionSchema,
        requiredScopes: ['admin'],
        annotations: {
            readOnlyHint: false
        },
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
                default: {
                    const unexpectedType: never = partitionType;
                    throw new Error(`Unsupported partition type: ${String(unexpectedType)}`);
                }
            }

            await adapter.executeQuery(sql);
            return { success: true, table, partitionName };
        }
    };
}

function createDropPartitionTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_drop_partition',
        title: 'MySQL Drop Partition',
        description: 'Drop a partition from a partitioned table. Warning: This deletes all data in the partition!',
        group: 'partitioning',
        inputSchema: DropPartitionSchema,
        requiredScopes: ['admin'],
        annotations: {
            readOnlyHint: false,
            destructiveHint: true
        },
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
        title: 'MySQL Reorganize Partition',
        description: 'Reorganize partitions by splitting or merging them.',
        group: 'partitioning',
        inputSchema: ReorganizePartitionSchema,
        requiredScopes: ['admin'],
        annotations: {
            readOnlyHint: false
        },
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, fromPartitions, partitionType, toPartitions } = ReorganizePartitionSchema.parse(params);

            const fromList = fromPartitions.map(p => `\`${p}\``).join(', ');
            const toList = toPartitions.map(p => {
                if (partitionType === 'RANGE') {
                    return `PARTITION \`${p.name}\` VALUES LESS THAN (${p.value})`;
                } else {
                    return `PARTITION \`${p.name}\` VALUES IN (${p.value})`;
                }
            }).join(', ');

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
