/**
 * MySQL Security Tools
 * 
 * Tools for security auditing and monitoring.
 * 9 tools total.
 */

import type { MySQLAdapter } from '../../MySQLAdapter.js';
import type { ToolDefinition } from '../../../../types/index.js';

// Import from submodules
import {
    createSecurityAuditTool,
    createSecurityFirewallStatusTool,
    createSecurityFirewallRulesTool
} from './audit.js';

import {
    createSecuritySSLStatusTool,
    createSecurityEncryptionStatusTool,
    createSecurityPasswordValidateTool
} from './encryption.js';

import {
    createSecurityMaskDataTool,
    createSecurityUserPrivilegesTool,
    createSecuritySensitiveTablesTool
} from './data-protection.js';

/**
 * Get all security tools
 */
export function getSecurityTools(adapter: MySQLAdapter): ToolDefinition[] {
    return [
        createSecurityAuditTool(adapter),
        createSecurityFirewallStatusTool(adapter),
        createSecurityFirewallRulesTool(adapter),
        createSecurityMaskDataTool(adapter),
        createSecurityPasswordValidateTool(adapter),
        createSecuritySSLStatusTool(adapter),
        createSecurityUserPrivilegesTool(adapter),
        createSecuritySensitiveTablesTool(adapter),
        createSecurityEncryptionStatusTool(adapter)
    ];
}
