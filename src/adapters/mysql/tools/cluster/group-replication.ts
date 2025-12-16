/**
 * MySQL Group Replication Tools
 * 
 * Tools for managing MySQL Group Replication.
 * 5 tools total: status, members, primary, transactions, flow control.
 */

import { z } from 'zod';
import type { MySQLAdapter } from '../../MySQLAdapter.js';
import type { ToolDefinition, RequestContext } from '../../../../types/index.js';

// =============================================================================
// Schemas
// =============================================================================

const MemberSchema = z.object({
    memberId: z.string().optional().describe('Filter by specific member UUID')
});

// =============================================================================
// Tool Creation Functions
// =============================================================================

/**
 * Get Group Replication status
 */
export function createGRStatusTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_gr_status',
        title: 'MySQL Group Replication Status',
        description: 'Get comprehensive Group Replication status including mode and member state.',
        group: 'cluster',
        inputSchema: z.object({}),
        requiredScopes: ['read'],
        annotations: {
            readOnlyHint: true,
            idempotentHint: true
        },
        handler: async (_params: unknown, _context: RequestContext) => {
            // Check if GR is running
            const pluginResult = await adapter.executeQuery("SELECT PLUGIN_STATUS FROM information_schema.PLUGINS WHERE PLUGIN_NAME = 'group_replication'");
            if ((pluginResult.rows?.[0])?.['PLUGIN_STATUS'] !== 'ACTIVE') {
                return { enabled: false, message: 'Group Replication plugin is not active' };
            }

            const statusResult = await adapter.executeQuery(`
                SELECT 
                    @@group_replication_group_name as groupName,
                    @@group_replication_single_primary_mode as singlePrimaryMode,
                    @@group_replication_local_address as localAddress,
                    @@group_replication_group_seeds as groupSeeds,
                    @@group_replication_bootstrap_group as bootstrapGroup
            `);

            const config = statusResult.rows?.[0];

            // Get member status from performance_schema
            const memberResult = await adapter.executeQuery(`
                SELECT 
                    CHANNEL_NAME,
                    MEMBER_ID,
                    MEMBER_HOST,
                    MEMBER_PORT,
                    MEMBER_STATE,
                    MEMBER_ROLE,
                    MEMBER_VERSION
                FROM performance_schema.replication_group_members
            `);

            // Get local member info
            const localResult = await adapter.executeQuery(`
                SELECT @@server_uuid as serverUuid
            `);

            const localUuid = (localResult.rows?.[0])?.['serverUuid'] as string;
            const members = memberResult.rows ?? [];
            const localMember = members.find(m => (m)['MEMBER_ID'] === localUuid);

            return {
                enabled: members.length > 0,
                groupName: config?.['groupName'] ?? null,
                singlePrimaryMode: config?.['singlePrimaryMode'] === 1,
                localAddress: config?.['localAddress'] ?? null,
                localMember: localMember ?? null,
                memberCount: members.length,
                members: members.map(m => {
                    const member = m;
                    return {
                        id: member['MEMBER_ID'],
                        host: member['MEMBER_HOST'],
                        port: member['MEMBER_PORT'],
                        state: member['MEMBER_STATE'],
                        role: member['MEMBER_ROLE'],
                        version: member['MEMBER_VERSION'],
                        isLocal: member['MEMBER_ID'] === localUuid
                    };
                })
            };
        }
    };
}

/**
 * Get Group Replication members
 */
export function createGRMembersTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_gr_members',
        title: 'MySQL GR Members',
        description: 'List all Group Replication members with detailed state information.',
        group: 'cluster',
        inputSchema: MemberSchema,
        requiredScopes: ['read'],
        annotations: {
            readOnlyHint: true,
            idempotentHint: true
        },
        handler: async (params: unknown, _context: RequestContext) => {
            const { memberId } = MemberSchema.parse(params);

            // Check if GR is running
            const pluginResult = await adapter.executeQuery("SELECT PLUGIN_STATUS FROM information_schema.PLUGINS WHERE PLUGIN_NAME = 'group_replication'");
            if ((pluginResult.rows?.[0])?.['PLUGIN_STATUS'] !== 'ACTIVE') {
                return { members: [], count: 0, message: 'Group Replication not active' };
            }

            let query = `
                SELECT 
                    m.MEMBER_ID as memberId,
                    m.MEMBER_HOST as host,
                    m.MEMBER_PORT as port,
                    m.MEMBER_STATE as state,
                    m.MEMBER_ROLE as role,
                    m.MEMBER_VERSION as version,
                    s.COUNT_TRANSACTIONS_IN_QUEUE as txInQueue,
                    s.COUNT_TRANSACTIONS_CHECKED as txChecked,
                    s.COUNT_CONFLICTS_DETECTED as conflictsDetected,
                    s.COUNT_TRANSACTIONS_VALIDATING as txValidating,
                    s.COUNT_TRANSACTIONS_ROWS_VALIDATING as rowsValidating
                FROM performance_schema.replication_group_members m
                LEFT JOIN performance_schema.replication_group_member_stats s
                    ON m.MEMBER_ID = s.MEMBER_ID
            `;

            const queryParams: unknown[] = [];
            if (memberId) {
                query += ' WHERE m.MEMBER_ID = ?';
                queryParams.push(memberId);
            }

            const result = await adapter.executeQuery(query, queryParams);
            return {
                members: result.rows ?? [],
                count: result.rows?.length ?? 0
            };
        }
    };
}

/**
 * Identify current primary
 */
export function createGRPrimaryTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_gr_primary',
        title: 'MySQL GR Primary',
        description: 'Identify the current primary member in a single-primary GR cluster.',
        group: 'cluster',
        inputSchema: z.object({}),
        requiredScopes: ['read'],
        annotations: {
            readOnlyHint: true,
            idempotentHint: true
        },
        handler: async (_params: unknown, _context: RequestContext) => {
            const result = await adapter.executeQuery(`
                SELECT 
                    MEMBER_ID as memberId,
                    MEMBER_HOST as host,
                    MEMBER_PORT as port,
                    MEMBER_STATE as state,
                    MEMBER_VERSION as version
                FROM performance_schema.replication_group_members
                WHERE MEMBER_ROLE = 'PRIMARY'
            `);

            const primary = result.rows?.[0];

            // Check if we are the primary
            const localResult = await adapter.executeQuery(
                'SELECT @@server_uuid as serverUuid'
            );
            const localUuid = (localResult.rows?.[0])?.['serverUuid'];

            return {
                primary: primary ?? null,
                hasPrimary: !!primary,
                isLocalPrimary: primary?.['memberId'] === localUuid
            };
        }
    };
}

/**
 * Get transaction status
 */
export function createGRTransactionsTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_gr_transactions',
        title: 'MySQL GR Transactions',
        description: 'Get Group Replication transaction statistics and pending transactions.',
        group: 'cluster',
        inputSchema: z.object({}),
        requiredScopes: ['read'],
        annotations: {
            readOnlyHint: true,
            idempotentHint: true
        },
        handler: async (_params: unknown, _context: RequestContext) => {
            // Check if GR is running
            const pluginResult = await adapter.executeQuery("SELECT PLUGIN_STATUS FROM information_schema.PLUGINS WHERE PLUGIN_NAME = 'group_replication'");
            if ((pluginResult.rows?.[0])?.['PLUGIN_STATUS'] !== 'ACTIVE') {
                return { memberStats: [], gtid: { executed: '', purged: '' }, message: 'Group Replication not active' };
            }

            // Get transaction statistics
            const statsResult = await adapter.executeQuery(`
                SELECT 
                    MEMBER_ID as memberId,
                    COUNT_TRANSACTIONS_IN_QUEUE as txInQueue,
                    COUNT_TRANSACTIONS_CHECKED as txChecked,
                    COUNT_CONFLICTS_DETECTED as conflictsDetected,
                    COUNT_TRANSACTIONS_VALIDATING as txValidating,
                    COUNT_TRANSACTIONS_CERTIFIED as txCertified,
                    COUNT_TRANSACTIONS_REMOTE_IN_APPLIER_QUEUE as remoteInApplierQueue,
                    COUNT_TRANSACTIONS_REMOTE_APPLIED as remoteApplied,
                    COUNT_TRANSACTIONS_LOCAL_PROPOSED as localProposed,
                    COUNT_TRANSACTIONS_LOCAL_ROLLBACK as localRollback
                FROM performance_schema.replication_group_member_stats
            `);

            // Get GTID info
            const gtidResult = await adapter.executeQuery(`
                SELECT 
                    @@gtid_executed as gtidExecuted,
                    @@gtid_purged as gtidPurged
            `);

            const gtid = gtidResult.rows?.[0];

            return {
                memberStats: statsResult.rows ?? [],
                gtid: {
                    executed: gtid?.['gtidExecuted'] ?? '',
                    purged: gtid?.['gtidPurged'] ?? ''
                }
            };
        }
    };
}

/**
 * Get flow control statistics
 */
export function createGRFlowControlTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_gr_flow_control',
        title: 'MySQL GR Flow Control',
        description: 'Get Group Replication flow control statistics and throttling info.',
        group: 'cluster',
        inputSchema: z.object({}),
        requiredScopes: ['read'],
        annotations: {
            readOnlyHint: true,
            idempotentHint: true
        },
        handler: async (_params: unknown, _context: RequestContext) => {
            // Check if GR is running
            const pluginResult = await adapter.executeQuery("SELECT PLUGIN_STATUS FROM information_schema.PLUGINS WHERE PLUGIN_NAME = 'group_replication'");
            if ((pluginResult.rows?.[0])?.['PLUGIN_STATUS'] !== 'ACTIVE') {
                return { configuration: {}, memberQueues: [], isThrottling: false, message: 'Group Replication not active' };
            }

            // Get flow control configuration
            const configResult = await adapter.executeQuery(`
                SELECT 
                    @@group_replication_flow_control_mode as flowControlMode,
                    @@group_replication_flow_control_certifier_threshold as certifierThreshold,
                    @@group_replication_flow_control_applier_threshold as applierThreshold,
                    @@group_replication_flow_control_min_quota as minQuota,
                    @@group_replication_flow_control_min_recovery_quota as minRecoveryQuota,
                    @@group_replication_flow_control_max_quota as maxQuota
            `);

            const config = configResult.rows?.[0];

            // Get current queue depths
            const queueResult = await adapter.executeQuery(`
                SELECT 
                    MEMBER_ID as memberId,
                    COUNT_TRANSACTIONS_IN_QUEUE as certifyQueue,
                    COUNT_TRANSACTIONS_REMOTE_IN_APPLIER_QUEUE as applierQueue
                FROM performance_schema.replication_group_member_stats
            `);

            // Determine if flow control is active
            const isThrottling = (queueResult.rows ?? []).some(row => {
                const r = row;
                const certQueue = r['certifyQueue'] as number;
                const appQueue = r['applierQueue'] as number;
                const certThreshold = config?.['certifierThreshold'] as number ?? 25000;
                const appThreshold = config?.['applierThreshold'] as number ?? 25000;
                return certQueue > certThreshold || appQueue > appThreshold;
            });

            return {
                configuration: config ?? {},
                memberQueues: queueResult.rows ?? [],
                isThrottling,
                recommendation: isThrottling
                    ? 'Flow control is active. Consider investigating slow members or adjusting thresholds.'
                    : 'Flow control is not currently throttling.'
            };
        }
    };
}
