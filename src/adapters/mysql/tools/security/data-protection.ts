/**
 * MySQL Security - Data Protection Tools
 * 
 * Tools for data masking, privilege management, and sensitive data identification.
 */

import { z } from 'zod';
import type { MySQLAdapter } from '../../MySQLAdapter.js';
import type { ToolDefinition, RequestContext } from '../../../../types/index.js';

// =============================================================================
// Zod Schemas
// =============================================================================

const MaskDataSchema = z.object({
    value: z.string().describe('Value to mask'),
    type: z.enum(['email', 'phone', 'ssn', 'credit_card', 'partial']).describe('Masking type'),
    keepFirst: z.number().default(0).describe('Characters to keep from start'),
    keepLast: z.number().default(0).describe('Characters to keep from end'),
    maskChar: z.string().default('*').describe('Character to use for masking')
});

const UserPrivilegesSchema = z.object({
    user: z.string().optional().describe('Filter by username'),
    host: z.string().default('%').describe('Host pattern'),
    includeRoles: z.boolean().default(true).describe('Include role grants')
});

const SensitiveTablesSchema = z.object({
    schema: z.string().optional().describe('Schema to scan (defaults to current database)'),
    patterns: z.array(z.string()).default([
        'password', 'secret', 'token', 'key', 'ssn', 'credit', 'card',
        'phone', 'email', 'address', 'salary', 'medical', 'health'
    ]).describe('Column name patterns to consider sensitive')
});

// =============================================================================
// Tool Creation Functions
// =============================================================================

/**
 * Mask sensitive data
 */
export function createSecurityMaskDataTool(_adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_security_mask_data',
        title: 'MySQL Data Masking',
        description: 'Apply data masking to sensitive values (implementation for Community Edition).',
        group: 'security',
        inputSchema: MaskDataSchema,
        requiredScopes: ['read'],
        annotations: {
            readOnlyHint: true,
            idempotentHint: true
        },
        handler: (params: unknown, _context: RequestContext): Promise<unknown> => {
            const { value, type, keepFirst, keepLast, maskChar } = MaskDataSchema.parse(params);

            let maskedValue: string;

            switch (type) {
                case 'email': {
                    const atIndex = value.indexOf('@');
                    if (atIndex > 0) {
                        const localPart = value.substring(0, atIndex);
                        const domain = value.substring(atIndex);
                        const maskedLocal = localPart.length > 2
                            ? localPart[0] + maskChar.repeat(localPart.length - 2) + localPart[localPart.length - 1]
                            : maskChar.repeat(localPart.length);
                        maskedValue = maskedLocal + domain;
                    } else {
                        maskedValue = maskChar.repeat(value.length);
                    }
                    break;
                }
                case 'phone': {
                    // Keep last 4 digits, mask rest
                    const digits = value.replace(/\D/g, '');
                    maskedValue = maskChar.repeat(Math.max(0, digits.length - 4)) + digits.slice(-4);
                    break;
                }
                case 'ssn': {
                    // Show only last 4
                    const ssnDigits = value.replace(/\D/g, '');
                    maskedValue = `${maskChar}${maskChar}${maskChar}-${maskChar}${maskChar}-${ssnDigits.slice(-4)}`;
                    break;
                }
                case 'credit_card': {
                    // Show first 4 and last 4
                    const ccDigits = value.replace(/\D/g, '');
                    maskedValue = ccDigits.slice(0, 4) + maskChar.repeat(Math.max(0, ccDigits.length - 8)) + ccDigits.slice(-4);
                    break;
                }
                case 'partial': {
                    const maskLength = Math.max(0, value.length - keepFirst - keepLast);
                    maskedValue = value.slice(0, keepFirst) +
                        maskChar.repeat(maskLength) +
                        (keepLast > 0 ? value.slice(-keepLast) : '');
                    break;
                }
                default:
                    maskedValue = maskChar.repeat(value.length);
            }

            return Promise.resolve({ original: value, masked: maskedValue, type });
        }
    };
}

/**
 * Get comprehensive user privileges
 */
export function createSecurityUserPrivilegesTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_security_user_privileges',
        title: 'MySQL User Privileges',
        description: 'Get comprehensive privilege report for users.',
        group: 'security',
        inputSchema: UserPrivilegesSchema,
        requiredScopes: ['admin'],
        annotations: {
            readOnlyHint: true,
            idempotentHint: true
        },
        handler: async (params: unknown, _context: RequestContext) => {
            const { user, host, includeRoles } = UserPrivilegesSchema.parse(params);

            // Get users
            let usersQuery = `
                SELECT User, Host, 
                       plugin as authPlugin,
                       account_locked as accountLocked,
                       password_expired as passwordExpired,
                       password_lifetime as passwordLifetime,
                       max_connections as maxConnections,
                       max_user_connections as maxUserConnections
                FROM mysql.user
            `;

            const conditions: string[] = [];
            const queryParams: unknown[] = [];

            if (user) {
                conditions.push('User = ?');
                queryParams.push(user);
            }
            if (host !== '%') {
                conditions.push('Host = ?');
                queryParams.push(host);
            }

            if (conditions.length > 0) {
                usersQuery += ' WHERE ' + conditions.join(' AND ');
            }

            const usersResult = await adapter.executeQuery(usersQuery, queryParams);

            // For each user, get their grants
            const userPrivileges = [];
            for (const userRow of (usersResult.rows ?? [])) {
                const u = userRow;
                const userName = u['User'] as string;
                const userHost = u['Host'] as string;

                const grantsResult = await adapter.executeQuery(
                    `SHOW GRANTS FOR '${userName}'@'${userHost}'`
                );

                const grants = (grantsResult.rows ?? []).map(r => {
                    const values = Object.values(r);
                    return values[0] as string;
                });

                let roles: string[] = [];
                if (includeRoles) {
                    try {
                        const rolesResult = await adapter.executeQuery(`
                            SELECT FROM_USER, FROM_HOST
                            FROM mysql.role_edges
                            WHERE TO_USER = ? AND TO_HOST = ?
                        `, [userName, userHost]);

                        roles = (rolesResult.rows ?? []).map(r => {
                            const role = r;
                            return `${role['FROM_USER'] as string}@${role['FROM_HOST'] as string}`;
                        });
                    } catch {
                        // Role edges table might not exist in older versions
                    }
                }

                userPrivileges.push({
                    user: userName,
                    host: userHost,
                    authPlugin: u['authPlugin'],
                    accountLocked: u['accountLocked'] === 'Y',
                    passwordExpired: u['passwordExpired'] === 'Y',
                    grants,
                    roles
                });
            }

            return {
                users: userPrivileges,
                count: userPrivileges.length
            };
        }
    };
}

/**
 * Identify tables with potentially sensitive data
 */
export function createSecuritySensitiveTablesTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_security_sensitive_tables',
        title: 'MySQL Sensitive Tables',
        description: 'Identify tables and columns that may contain sensitive data.',
        group: 'security',
        inputSchema: SensitiveTablesSchema,
        requiredScopes: ['read'],
        annotations: {
            readOnlyHint: true,
            idempotentHint: true
        },
        handler: async (params: unknown, _context: RequestContext) => {
            const { schema, patterns } = SensitiveTablesSchema.parse(params);

            // Build pattern conditions
            const patternConditions = patterns.map(() => 'COLUMN_NAME LIKE ?').join(' OR ');
            const patternParams = patterns.map(p => `%${p}%`);

            const query = `
                SELECT 
                    TABLE_NAME as tableName,
                    COLUMN_NAME as columnName,
                    DATA_TYPE as dataType,
                    COLUMN_TYPE as columnType,
                    IS_NULLABLE as nullable,
                    COLUMN_COMMENT as comment
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = COALESCE(?, DATABASE())
                  AND (${patternConditions})
                ORDER BY TABLE_NAME, COLUMN_NAME
            `;

            const result = await adapter.executeQuery(query, [schema ?? null, ...patternParams]);

            // Group by table
            const tableMap = new Map<string, Record<string, unknown>[]>();
            for (const row of (result.rows ?? [])) {
                const r = row;
                const tableName = r['tableName'] as string;
                if (!tableMap.has(tableName)) {
                    tableMap.set(tableName, []);
                }
                tableMap.get(tableName)?.push(r);
            }

            const sensitiveItems = Array.from(tableMap.entries()).map(([table, columns]) => ({
                table,
                sensitiveColumns: columns,
                columnCount: columns.length
            }));

            return {
                sensitiveTables: sensitiveItems,
                tableCount: sensitiveItems.length,
                totalSensitiveColumns: result.rows?.length ?? 0,
                patternsUsed: patterns
            };
        }
    };
}
