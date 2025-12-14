/**
 * Prompt-Based Tool Invocation Generator
 * 
 * Generates prompt templates that map directly to tool invocations,
 * allowing models to bypass the tool index entirely for known operations.
 */

import type { ToolDefinition, ToolGroup } from '../types/index.js';

export interface PromptTemplate {
    /** Prompt name (e.g., /mysql-query) */
    name: string;

    /** Human-readable description */
    description: string;

    /** Arguments accepted by the prompt */
    arguments: {
        name: string;
        description: string;
        required: boolean;
    }[];

    /** The tool this prompt invokes */
    targetTool: string;

    /** Example usage */
    examples?: string[];
}

/**
 * Mapping of tool groups to prompt prefixes.
 */
const GROUP_PREFIXES: Record<ToolGroup, string> = {
    core: 'mysql',
    json: 'mysql-json',
    text: 'mysql-text',
    fulltext: 'mysql-fts',
    performance: 'mysql-perf',
    optimization: 'mysql-opt',
    admin: 'mysql-admin',
    monitoring: 'mysql-mon',
    backup: 'mysql-backup',
    replication: 'mysql-repl',
    partitioning: 'mysql-part',
    transactions: 'mysql-tx',
    router: 'mysql-router',
    proxysql: 'proxysql',
    shell: 'mysqlsh'
};

/**
 * Generate a prompt name from a tool definition.
 */
function generatePromptName(tool: ToolDefinition): string {
    const prefix = GROUP_PREFIXES[tool.group];

    // Extract action from tool name (e.g., mysql_read_query -> query)
    const nameParts = tool.name.split('_').slice(1); // Remove 'mysql' prefix
    const action = nameParts.join('-');

    return `/${prefix}-${action}`;
}

/**
 * Extract argument definitions from a tool's input schema.
 */
function extractArguments(tool: ToolDefinition): PromptTemplate['arguments'] {
    const schema = tool.inputSchema as {
        shape?: Record<string, { description?: string }>;
        _def?: {
            shape?: () => Record<string, { description?: string }>;
        };
    } | undefined;

    const args: PromptTemplate['arguments'] = [];

    if (!schema) return args;

    // Try to get shape from Zod schema
    let shape = schema.shape;
    if (!shape && schema._def?.shape) {
        shape = schema._def.shape();
    }

    if (shape) {
        for (const [name, fieldSchema] of Object.entries(shape)) {
            args.push({
                name,
                description: (fieldSchema as { description?: string }).description ?? `The ${name} parameter`,
                required: true // Assume required by default
            });
        }
    }

    return args;
}

/**
 * Generate a prompt template from a tool definition.
 */
export function generatePromptTemplate(tool: ToolDefinition): PromptTemplate {
    const promptName = generatePromptName(tool);
    return {
        name: promptName,
        description: tool.description,
        arguments: extractArguments(tool),
        targetTool: tool.name,
        examples: [
            `Use ${promptName} to invoke ${tool.name} directly`
        ]
    };
}

/**
 * Generate prompt templates for all tools.
 */
export function generatePromptTemplates(tools: ToolDefinition[]): PromptTemplate[] {
    return tools.map(generatePromptTemplate);
}

/**
 * Generate a shortcut menu for frequently used tools.
 */
export function generateShortcutMenu(tools: ToolDefinition[]): Record<string, string[]> {
    const menu: Record<string, string[]> = {};

    for (const tool of tools) {
        const group = tool.group;
        menu[group] ??= [];
        menu[group].push(generatePromptName(tool));
    }

    return menu;
}

/**
 * Generate a prompt discovery message for the model.
 * This can be included in system prompts to inform models about available shortcuts.
 */
export function generateDiscoveryPrompt(tools: ToolDefinition[]): string {
    const menu = generateShortcutMenu(tools);

    let prompt = '## Available MySQL Tool Shortcuts\n\n';
    prompt += 'You can use these direct commands instead of calling tools:\n\n';

    for (const [group, prompts] of Object.entries(menu)) {
        prompt += `### ${group.charAt(0).toUpperCase() + group.slice(1)}\n`;
        for (const p of prompts.slice(0, 5)) { // Limit to 5 per group
            prompt += `- \`${p}\`\n`;
        }
        if (prompts.length > 5) {
            prompt += `- ... and ${prompts.length - 5} more\n`;
        }
        prompt += '\n';
    }

    return prompt;
}

/**
 * Generate a compact tool index for the model.
 * This is a minimal representation that can be included in system prompts.
 */
export function generateCompactIndex(tools: ToolDefinition[]): string {
    const byGroup: Record<string, string[]> = {};

    for (const tool of tools) {
        byGroup[tool.group] ??= [];
        // Format: toolName(arg1, arg2) - brief description
        const args = extractArguments(tool);
        const argStr = args.map(a => a.name).join(', ');
        const brief = tool.description.split('.')[0]; // First sentence
        byGroup[tool.group]!.push(`${tool.name}(${argStr}) - ${brief}`);
    }

    let index = '';
    for (const [group, toolList] of Object.entries(byGroup)) {
        index += `[${group}]\n`;
        for (const t of toolList) {
            index += `  ${t}\n`;
        }
    }

    return index;
}
