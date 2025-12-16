/**
 * Prompt generator utilities
 * 
 * Helpers for generating tool documentation and discovery prompts.
 */
import type { ToolDefinition } from '../types/index.js';

/**
 * Generate a compact index of all tools grouped by category
 */
export function generateCompactIndex(tools: ToolDefinition[]): string {
    // Group tools by category
    const groups: Record<string, ToolDefinition[]> = {};

    for (const tool of tools) {
        const group = tool.group ?? 'other';
        groups[group] ??= [];
        groups[group].push(tool);
    }

    // Generate compact format
    const lines: string[] = [];
    for (const [group, groupTools] of Object.entries(groups)) {
        lines.push(`### ${group} (${String(groupTools.length)} tools)`);
        lines.push('');
        for (const tool of groupTools) {
            lines.push(`- **${tool.name}**: ${tool.description}`);
        }
        lines.push('');
    }

    return lines.join('\n');
}

/**
 * Generate a discovery prompt with common use cases
 */
export function generateDiscoveryPrompt(tools: ToolDefinition[]): string {
    // Find commonly used tools based on tags
    const queryTools = tools.filter(t =>
        t.name.includes('query') || t.name.includes('read') || t.name.includes('write')
    ).slice(0, 3);

    const schemaTools = tools.filter(t =>
        t.name.includes('table') || t.name.includes('schema') || t.name.includes('describe')
    ).slice(0, 3);

    const perfTools = tools.filter(t =>
        t.name.includes('explain') || t.name.includes('performance') || t.name.includes('stats')
    ).slice(0, 3);

    const lines: string[] = [
        '## Quick Start',
        '',
        '### Query Data',
    ];

    for (const tool of queryTools) {
        lines.push(`- \`${tool.name}\`: ${tool.description}`);
    }

    lines.push('', '### Explore Schema');
    for (const tool of schemaTools) {
        lines.push(`- \`${tool.name}\`: ${tool.description}`);
    }

    lines.push('', '### Analyze Performance');
    for (const tool of perfTools) {
        lines.push(`- \`${tool.name}\`: ${tool.description}`);
    }

    lines.push('');
    return lines.join('\n');
}
