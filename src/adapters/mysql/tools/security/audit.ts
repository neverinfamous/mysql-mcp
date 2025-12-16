/**
 * MySQL Security - Audit and Firewall Tools  
 * 
 * Tools for security auditing, firewall monitoring, and compliance.
 */

import { z } from 'zod';
import type { MySQLAdapter } from '../../MySQLAdapter.js';
import type { ToolDefinition, RequestContext } from '../../../../types/index.js';

// =============================================================================
// Zod Schemas
// ============================================================================

const AuditLogSchema = z.object({
    limit: z.number().default(100).describe('Maximum number of records'),
    user: z.string().optional().describe('Filter by username'),
    eventType: z.string().optional().describe('Filter by event type (e.g., "CONNECT", "QUERY")'),
    startTime: z.string().optional().describe('Start time filter (ISO 8601)')
});

const FirewallRulesSchema = z.object({
    user: z.string().optional().describe('Filter by username'),
    mode: z.enum(['RECORDING', 'PROTECTING', 'DETECTING', 'OFF']).optional().describe('Filter by mode')
});

// =============================================================================
// Tool Creation Functions
// =============================================================================

/**
 * Query audit log
 */
export function createSecurityAuditTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_security_audit',
        title: 'MySQL Security Audit Log',
        description: 'Query the MySQL audit log (requires Enterprise Audit or compatible plugin).',
        group: 'security',
        inputSchema: AuditLogSchema,
        requiredScopes: ['admin'],
        annotations: {
            readOnlyHint: true,
            idempotentHint: true
        },
        handler: async (params: unknown, _context: RequestContext) => {
            const { limit, user, eventType, startTime } = AuditLogSchema.parse(params);

            // First check if audit log table exists
            try {
                const checkResult = await adapter.executeQuery(`
                    SELECT TABLE_NAME 
                    FROM information_schema.TABLES 
                    WHERE TABLE_SCHEMA = 'mysql' 
                      AND TABLE_NAME = 'audit_log'
                `);

                if (!checkResult.rows || checkResult.rows.length === 0) {
                    // Try performance_schema alternative
                    let query = `
                        SELECT 
                            EVENT_NAME as event,
                            OBJECT_TYPE as objectType,
                            OBJECT_NAME as objectName,
                            CURRENT_USER as user,
                            HOST as host,
                            TIMER_START as startTime
                        FROM performance_schema.events_statements_history
                    `;

                    const conditions: string[] = [];
                    const queryParams: unknown[] = [];

                    if (user) {
                        conditions.push('CURRENT_USER LIKE ?');
                        queryParams.push(`%${user}%`);
                    }

                    if (conditions.length > 0) {
                        query += ' WHERE ' + conditions.join(' AND ');
                    }

                    query += ` ORDER BY TIMER_START DESC LIMIT ${String(limit)}`;

                    const result = await adapter.executeQuery(query, queryParams);
                    return {
                        source: 'performance_schema',
                        message: 'Using performance_schema as audit log is not available',
                        events: result.rows ?? [],
                        count: result.rows?.length ?? 0
                    };
                }

                // Query actual audit log
                let query = `
                    SELECT *
                    FROM mysql.audit_log
                `;

                const conditions: string[] = [];
                const queryParams: unknown[] = [];

                if (user) {
                    conditions.push('user LIKE ?');
                    queryParams.push(`%${user}%`);
                }
                if (eventType) {
                    conditions.push('event_type = ?');
                    queryParams.push(eventType);
                }
                if (startTime) {
                    conditions.push('timestamp >= ?');
                    queryParams.push(startTime);
                }

                if (conditions.length > 0) {
                    query += ' WHERE ' + conditions.join(' AND ');
                }

                query += ` ORDER BY timestamp DESC LIMIT ${String(limit)}`;

                const result = await adapter.executeQuery(query, queryParams);
                return {
                    source: 'mysql.audit_log',
                    events: result.rows ?? [],
                    count: result.rows?.length ?? 0
                };
            } catch {
                return {
                    available: false,
                    message: 'Audit logging is not enabled. Install MySQL Enterprise Audit or Percona Audit plugin.',
                    suggestion: 'Install audit plugin with: INSTALL PLUGIN audit_log SONAME "audit_log.so"'
                };
            }
        }
    };
}

/**
 * Get firewall status
 */
export function createSecurityFirewallStatusTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_security_firewall_status',
        title: 'MySQL Firewall Status',
        description: 'Get MySQL Enterprise Firewall plugin status.',
        group: 'security',
        inputSchema: z.object({}),
        requiredScopes: ['read'],
        annotations: {
            readOnlyHint: true,
            idempotentHint: true
        },
        handler: async (_params: unknown, _context: RequestContext) => {
            try {
                // Check if firewall plugin is installed
                const pluginResult = await adapter.executeQuery(`
                    SELECT PLUGIN_NAME, PLUGIN_STATUS
                    FROM information_schema.PLUGINS
                    WHERE PLUGIN_NAME LIKE '%firewall%'
                `);

                if (!pluginResult.rows || pluginResult.rows.length === 0) {
                    return {
                        installed: false,
                        message: 'MySQL Enterprise Firewall is not installed',
                        suggestion: 'Install with: INSTALL PLUGIN mysql_firewall SONAME "firewall.so"'
                    };
                }

                // Get firewall variables
                const varsResult = await adapter.executeQuery(
                    "SHOW VARIABLES LIKE 'mysql_firewall%'"
                );

                const variables: Record<string, unknown> = Object.fromEntries(
                    (varsResult.rows ?? []).map(row => {
                        const r = row;
                        const varName = typeof r['Variable_name'] === 'string' ? r['Variable_name'] : '';
                        return [varName, r['Value']];
                    })
                );

                return {
                    installed: true,
                    plugins: pluginResult.rows,
                    configuration: variables
                };
            } catch {
                return {
                    installed: false,
                    message: 'Firewall plugin check failed',
                    suggestion: 'Ensure you have privileges to view plugin information'
                };
            }
        }
    };
}

/**
 * List firewall rules
 */
export function createSecurityFirewallRulesTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_security_firewall_rules',
        title: 'MySQL Firewall Rules',
        description: 'List MySQL Enterprise Firewall allowlist rules.',
        group: 'security',
        inputSchema: FirewallRulesSchema,
        requiredScopes: ['admin'],
        annotations: {
            readOnlyHint: true,
            idempotentHint: true
        },
        handler: async (params: unknown, _context: RequestContext) => {
            const { user, mode } = FirewallRulesSchema.parse(params);

            try {
                // Get firewall users
                let usersQuery = `
                    SELECT USERHOST, MODE
                    FROM mysql.firewall_users
                `;

                const conditions: string[] = [];
                const queryParams: unknown[] = [];

                if (user) {
                    conditions.push('USERHOST LIKE ?');
                    queryParams.push(`%${user}%`);
                }
                if (mode) {
                    conditions.push('MODE = ?');
                    queryParams.push(mode);
                }

                if (conditions.length > 0) {
                    usersQuery += ' WHERE ' + conditions.join(' AND ');
                }

                const usersResult = await adapter.executeQuery(usersQuery, queryParams);

                // Get firewall whitelist
                let rulesQuery = `
                    SELECT USERHOST, RULE
                    FROM mysql.firewall_whitelist
                `;

                if (user) {
                    rulesQuery += ' WHERE USERHOST LIKE ?';
                }

                const rulesResult = await adapter.executeQuery(
                    rulesQuery,
                    user ? [`%${user}%`] : []
                );

                return {
                    users: usersResult.rows ?? [],
                    rules: rulesResult.rows ?? [],
                    userCount: usersResult.rows?.length ?? 0,
                    ruleCount: rulesResult.rows?.length ?? 0
                };
            } catch {
                return {
                    available: false,
                    message: 'Firewall tables not accessible. Ensure MySQL Enterprise Firewall is installed and you have appropriate privileges.'
                };
            }
        }
    };
}
