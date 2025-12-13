/**
 * mysql-mcp - Tool Filtering System
 * 
 * Parses and applies tool filter rules from environment variables.
 * Compatible with db-mcp filtering syntax.
 * 
 * Syntax:
 *   -group    → Disable all tools in a group
 *   +group    → Enable all tools in a group
 *   -tool     → Disable a specific tool
 *   +tool     → Enable a specific tool (after group disable)
 */

import type {
    ToolGroup,
    ToolFilterConfig,
    ToolDefinition
} from '../types/index.js';

/**
 * Default tool groups and their member tools.
 * This serves as the canonical mapping of tools to groups.
 */
export const TOOL_GROUPS: Record<ToolGroup, string[]> = {
    core: [
        'mysql_read_query',
        'mysql_write_query',
        'mysql_list_tables',
        'mysql_describe_table',
        'mysql_create_table',
        'mysql_drop_table',
        'mysql_create_index',
        'mysql_get_indexes'
    ],
    json: [
        'mysql_json_extract',
        'mysql_json_set',
        'mysql_json_insert',
        'mysql_json_replace',
        'mysql_json_remove',
        'mysql_json_contains',
        'mysql_json_keys',
        'mysql_json_array_append',
        'mysql_json_get',
        'mysql_json_update',
        'mysql_json_search',
        'mysql_json_validate'
    ],
    text: [
        'mysql_regexp_match',
        'mysql_like_search',
        'mysql_soundex',
        'mysql_substring',
        'mysql_concat',
        'mysql_collation_convert'
    ],
    fulltext: [
        'mysql_fulltext_create',
        'mysql_fulltext_search',
        'mysql_fulltext_boolean',
        'mysql_fulltext_expand'
    ],
    performance: [
        'mysql_explain',
        'mysql_explain_analyze',
        'mysql_slow_queries',
        'mysql_query_stats',
        'mysql_index_usage',
        'mysql_table_stats',
        'mysql_buffer_pool_stats',
        'mysql_thread_stats'
    ],
    optimization: [
        'mysql_index_recommendation',
        'mysql_query_rewrite',
        'mysql_force_index',
        'mysql_optimizer_trace'
    ],
    admin: [
        'mysql_optimize_table',
        'mysql_analyze_table',
        'mysql_check_table',
        'mysql_repair_table',
        'mysql_flush_tables',
        'mysql_kill_query'
    ],
    monitoring: [
        'mysql_show_processlist',
        'mysql_show_status',
        'mysql_show_variables',
        'mysql_innodb_status',
        'mysql_replication_status',
        'mysql_pool_stats',
        'mysql_server_health'
    ],
    backup: [
        'mysql_export_table',
        'mysql_import_data',
        'mysql_create_dump',
        'mysql_restore_dump'
    ],
    replication: [
        'mysql_master_status',
        'mysql_slave_status',
        'mysql_binlog_events',
        'mysql_gtid_status',
        'mysql_replication_lag'
    ],
    partitioning: [
        'mysql_partition_info',
        'mysql_add_partition',
        'mysql_drop_partition',
        'mysql_reorganize_partition'
    ],
    transactions: [
        'mysql_transaction_begin',
        'mysql_transaction_commit',
        'mysql_transaction_rollback',
        'mysql_transaction_savepoint',
        'mysql_transaction_release',
        'mysql_transaction_rollback_to',
        'mysql_transaction_execute'
    ],
    router: [
        'mysql_router_status',
        'mysql_router_routes',
        'mysql_router_route_status',
        'mysql_router_route_health',
        'mysql_router_route_connections',
        'mysql_router_route_destinations',
        'mysql_router_route_blocked_hosts',
        'mysql_router_metadata_status',
        'mysql_router_pool_status'
    ],
    proxysql: [
        'proxysql_status',
        'proxysql_servers',
        'proxysql_hostgroups',
        'proxysql_query_rules',
        'proxysql_query_digest',
        'proxysql_connection_pool',
        'proxysql_users',
        'proxysql_global_variables',
        'proxysql_runtime_status',
        'proxysql_memory_stats',
        'proxysql_commands',
        'proxysql_process_list'
    ],
    shell: [
        'mysqlsh_version',
        'mysqlsh_check_upgrade',
        'mysqlsh_export_table',
        'mysqlsh_import_table',
        'mysqlsh_import_json',
        'mysqlsh_dump_instance',
        'mysqlsh_dump_schemas',
        'mysqlsh_dump_tables',
        'mysqlsh_load_dump',
        'mysqlsh_run_script'
    ]
};

/**
 * Get all tool names from all groups
 */
export function getAllToolNames(): string[] {
    const groups = Object.keys(TOOL_GROUPS) as ToolGroup[];
    return groups.flatMap(group => TOOL_GROUPS[group]);
}

/**
 * Get the group for a specific tool
 */
export function getToolGroup(toolName: string): ToolGroup | undefined {
    const groups = Object.keys(TOOL_GROUPS) as ToolGroup[];
    for (const group of groups) {
        if (TOOL_GROUPS[group].includes(toolName)) {
            return group;
        }
    }
    return undefined;
}

/**
 * Check if a name is a valid tool group
 */
function isToolGroup(name: string): name is ToolGroup {
    return name in TOOL_GROUPS;
}

/**
 * Parse a tool filter string into structured rules
 * 
 * @param filterString - The filter string (e.g., "-replication,-partitioning,+mysql_master_status")
 * @returns Parsed filter configuration
 */
export function parseToolFilter(filterString: string | undefined): ToolFilterConfig {
    const allTools = getAllToolNames();
    const enabledTools = new Set<string>(allTools);

    if (!filterString || filterString.trim() === '') {
        return {
            raw: '',
            rules: [],
            enabledTools
        };
    }

    const rules: ToolFilterConfig['rules'] = [];
    const parts = filterString.split(',').map(p => p.trim()).filter(p => p);

    for (const part of parts) {
        if (part.startsWith('-')) {
            const target = part.slice(1);
            const isGroup = isToolGroup(target);

            rules.push({
                type: 'exclude',
                target,
                isGroup
            });

            // Apply exclusion
            if (isGroup) {
                for (const tool of TOOL_GROUPS[target]) {
                    enabledTools.delete(tool);
                }
            } else {
                enabledTools.delete(target);
            }
        } else if (part.startsWith('+')) {
            const target = part.slice(1);
            const isGroup = isToolGroup(target);

            rules.push({
                type: 'include',
                target,
                isGroup
            });

            // Apply inclusion
            if (isGroup) {
                for (const tool of TOOL_GROUPS[target]) {
                    enabledTools.add(tool);
                }
            } else {
                enabledTools.add(target);
            }
        } else {
            // Bare name without prefix - treat as exclusion for safety
            const target = part;
            const isGroup = isToolGroup(target);

            rules.push({
                type: 'exclude',
                target,
                isGroup
            });

            if (isGroup) {
                for (const tool of TOOL_GROUPS[target]) {
                    enabledTools.delete(tool);
                }
            } else {
                enabledTools.delete(target);
            }
        }
    }

    return {
        raw: filterString,
        rules,
        enabledTools
    };
}

/**
 * Check if a tool is enabled based on filter configuration
 */
export function isToolEnabled(toolName: string, config: ToolFilterConfig): boolean {
    return config.enabledTools.has(toolName);
}

/**
 * Filter a list of tool definitions based on filter configuration
 */
export function filterTools(
    tools: ToolDefinition[],
    config: ToolFilterConfig
): ToolDefinition[] {
    return tools.filter(tool => config.enabledTools.has(tool.name));
}

/**
 * Get the tool filter from environment variable
 */
export function getToolFilterFromEnv(): ToolFilterConfig {
    const filterString = process.env['MYSQL_MCP_TOOL_FILTER'] ??
        process.env['TOOL_FILTER'] ??
        '';
    return parseToolFilter(filterString);
}

/**
 * Calculate token savings from tool filtering
 * Assumes ~200 tokens per tool definition (description + parameters)
 */
export function calculateTokenSavings(
    totalTools: number,
    enabledTools: number,
    tokensPerTool = 200
): { tokensSaved: number; percentSaved: number } {
    const disabledTools = totalTools - enabledTools;
    const tokensSaved = disabledTools * tokensPerTool;
    const percentSaved = totalTools > 0
        ? Math.round((disabledTools / totalTools) * 100)
        : 0;

    return { tokensSaved, percentSaved };
}

/**
 * Generate a summary of the current filter configuration
 */
export function getFilterSummary(config: ToolFilterConfig): string {
    const allTools = getAllToolNames();
    const enabledCount = config.enabledTools.size;
    const totalCount = allTools.length;

    const lines: string[] = [
        `Tool Filter Summary:`,
        `  Enabled: ${enabledCount}/${totalCount} tools`
    ];

    if (config.rules.length > 0) {
        lines.push(`  Rules applied:`);
        for (const rule of config.rules) {
            const prefix = rule.type === 'include' ? '+' : '-';
            const suffix = rule.isGroup ? ' (group)' : '';
            lines.push(`    ${prefix}${rule.target}${suffix}`);
        }
    }

    // Show disabled groups
    const disabledGroups: string[] = [];
    const partialGroups: string[] = [];

    const groups = Object.keys(TOOL_GROUPS) as ToolGroup[];
    for (const group of groups) {
        const groupTools = TOOL_GROUPS[group];
        const enabledInGroup = groupTools.filter(t => config.enabledTools.has(t)).length;

        if (enabledInGroup === 0) {
            disabledGroups.push(group);
        } else if (enabledInGroup < groupTools.length) {
            partialGroups.push(`${group} (${enabledInGroup}/${groupTools.length})`);
        }
    }

    if (disabledGroups.length > 0) {
        lines.push(`  Disabled groups: ${disabledGroups.join(', ')}`);
    }

    if (partialGroups.length > 0) {
        lines.push(`  Partial groups: ${partialGroups.join(', ')}`);
    }

    const { tokensSaved, percentSaved } = calculateTokenSavings(totalCount, enabledCount);
    if (tokensSaved > 0) {
        lines.push(`  Token savings: ~${tokensSaved} tokens (${percentSaved}%)`);
    }

    return lines.join('\n');
}

/**
 * Get a list of all tool groups with their tool counts
 */
export function getToolGroupInfo(): { group: ToolGroup; count: number; tools: string[] }[] {
    const groups = Object.keys(TOOL_GROUPS) as ToolGroup[];
    return groups.map(group => ({
        group,
        count: TOOL_GROUPS[group].length,
        tools: [...TOOL_GROUPS[group]]
    }));
}
