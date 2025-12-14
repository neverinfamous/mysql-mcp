/**
 * MySQL Adapter - MCP Prompts
 * 
 * Pre-built prompts for common MySQL operations and lazy hydration discovery.
 */

import type { MySQLAdapter } from '../MySQLAdapter.js';
import type { PromptDefinition, RequestContext } from '../../../types/index.js';
import { generateCompactIndex, generateDiscoveryPrompt } from '../../../utils/promptGenerator.js';

/**
 * Get all MySQL prompts
 */
export function getMySQLPrompts(adapter: MySQLAdapter): PromptDefinition[] {
    // Get tool definitions for generating indexes
    const toolDefs = adapter.getToolDefinitions();

    return [
        // Lazy hydration prompts
        createToolIndexPrompt(toolDefs),
        createQuickQueryPrompt(adapter),
        createQuickSchemaPrompt(adapter),
        // Original prompts
        createQueryBuilderPrompt(adapter),
        createSchemaDesignPrompt(adapter),
        createPerformanceAnalysisPrompt(adapter),
        createMigrationPrompt(adapter)
    ];
}

function createQueryBuilderPrompt(_adapter: MySQLAdapter): PromptDefinition {
    return {
        name: 'mysql_query_builder',
        description: 'Help build SQL queries for common operations',
        arguments: [
            { name: 'operation', description: 'Type of query (SELECT, INSERT, UPDATE, DELETE)', required: true },
            { name: 'table', description: 'Target table name', required: true },
            { name: 'description', description: 'What you want to accomplish', required: true }
        ],
        handler: (args: Record<string, string>, _context: RequestContext): Promise<string> => {
            return Promise.resolve(`
You are a MySQL query expert. Help build a ${args['operation']} query for the table "${args['table']}".

User's goal: ${args['description']}

Please provide:
1. The complete SQL query with proper escaping
2. Explanation of what the query does
3. Any indexes that would improve performance
4. Security considerations (parameterization, input validation)

Use MySQL best practices:
- Use backticks for identifiers
- Use prepared statement placeholders (?)
- Include appropriate WHERE clauses
- Consider using LIMIT for large result sets
`);
        }
    };
}

// =============================================================================
// Lazy Hydration Prompts
// =============================================================================

/**
 * Tool index prompt - shows all available tools in a compact format
 */
function createToolIndexPrompt(toolDefs: import('../../../types/index.js').ToolDefinition[]): PromptDefinition {
    const compactIndex = generateCompactIndex(toolDefs);
    const discovery = generateDiscoveryPrompt(toolDefs);

    return {
        name: 'mysql_tool_index',
        description: 'Show all available MySQL tools organized by category',
        arguments: [],
        // eslint-disable-next-line @typescript-eslint/require-await
        handler: async (_args: Record<string, string>, _context: RequestContext) => {
            return `
# MySQL MCP Tool Index

This server provides ${toolDefs.length} MySQL tools for database operations.

${discovery}
## Complete Tool List

${compactIndex}

**Usage**: Call any tool by name with the required arguments. Use \`mysql_read_query\` for SELECT queries and \`mysql_write_query\` for INSERT/UPDATE/DELETE.
`;
        }
    };
}

/**
 * Quick query prompt - shortcut for running queries
 */
function createQuickQueryPrompt(_adapter: MySQLAdapter): PromptDefinition {
    return {
        name: 'mysql_quick_query',
        description: 'Quickly run a SQL query - shortcut for mysql_read_query or mysql_write_query',
        arguments: [
            { name: 'sql', description: 'SQL query to execute', required: true },
            { name: 'type', description: 'Query type: read or write (default: read)', required: false }
        ],
        // eslint-disable-next-line @typescript-eslint/require-await
        handler: async (args: Record<string, string>, _context: RequestContext) => {
            const queryType = args['type']?.toLowerCase() === 'write' ? 'write' : 'read';
            const toolName = queryType === 'write' ? 'mysql_write_query' : 'mysql_read_query';

            return `
Execute this ${queryType} query using the \`${toolName}\` tool:

\`\`\`sql
${args['sql']}
\`\`\`

**Tool to use**: \`${toolName}\`
**Arguments**: \`{ "query": "${(args['sql'] ?? '').replace(/"/g, '\\"')}" }\`
`;
        }
    };
}

/**
 * Quick schema prompt - shortcut for exploring database schema
 */
function createQuickSchemaPrompt(_adapter: MySQLAdapter): PromptDefinition {
    return {
        name: 'mysql_quick_schema',
        description: 'Quickly explore database schema - lists tables or describes a specific table',
        arguments: [
            { name: 'table', description: 'Table name to describe (leave empty to list all tables)', required: false }
        ],
        // eslint-disable-next-line @typescript-eslint/require-await
        handler: async (args: Record<string, string>, _context: RequestContext) => {
            if (args['table']) {
                return `
Describe the structure of table **${args['table']}** using the \`mysql_describe_table\` tool:

**Tool to use**: \`mysql_describe_table\`
**Arguments**: \`{ "table": "${args['table']}" }\`

This will show columns, types, indexes, and constraints.
`;
            }

            return `
List all tables in the database using the \`mysql_list_tables\` tool:

**Tool to use**: \`mysql_list_tables\`
**Arguments**: \`{}\`

This will show all tables with their row counts and metadata.
`;
        }
    };
}

function createSchemaDesignPrompt(_adapter: MySQLAdapter): PromptDefinition {
    return {
        name: 'mysql_schema_design',
        description: 'Help design table schemas',
        arguments: [
            { name: 'entity', description: 'What entity/data you want to store', required: true },
            { name: 'requirements', description: 'Any specific requirements', required: false }
        ],
        // eslint-disable-next-line @typescript-eslint/require-await
        handler: async (args: Record<string, string>, _context: RequestContext) => {
            return `
You are a MySQL database architect. Design a schema for: ${args['entity']}

${args['requirements'] ? `Requirements: ${args['requirements']}` : ''}

Please provide:
1. CREATE TABLE statement with:
   - Appropriate data types
   - Primary key
   - Indexes for common queries
   - Foreign key relationships if applicable
   - Engine: InnoDB (for transactions)
   - Charset: utf8mb4 (for full Unicode support)

2. Explanation of design choices

3. Sample INSERT statements

4. Common SELECT queries with indexes

Best practices to follow:
- Use underscore_case for column names
- Include created_at and updated_at timestamps
- Use UNSIGNED for positive-only integers
- Consider JSON columns for flexible data
- Add appropriate indexes based on query patterns
`;
        }
    };
}

function createPerformanceAnalysisPrompt(_adapter: MySQLAdapter): PromptDefinition {
    return {
        name: 'mysql_performance_analysis',
        description: 'Analyze and optimize slow queries',
        arguments: [
            { name: 'query', description: 'The slow query to analyze', required: true },
            { name: 'context', description: 'Table structure and data volume', required: false }
        ],
        // eslint-disable-next-line @typescript-eslint/require-await
        handler: async (args: Record<string, string>, _context: RequestContext) => {
            return `
You are a MySQL performance expert. Analyze this query:

\`\`\`sql
${args['query']}
\`\`\`

${args['context'] ? `Context: ${args['context']}` : ''}

Please provide:
1. Run EXPLAIN on the query and interpret results
2. Identify performance bottlenecks:
   - Full table scans
   - Missing indexes
   - Suboptimal join order
   - Unnecessary columns in SELECT
   
3. Recommended optimizations:
   - Index recommendations
   - Query rewrites
   - Schema changes if needed
   
4. Estimated improvement

Use these MySQL tools to analyze:
- mysql_explain for execution plan
- mysql_explain_analyze for actual timing
- mysql_index_usage to check index utilization
- mysql_table_stats for data volume
`;
        }
    };
}

function createMigrationPrompt(_adapter: MySQLAdapter): PromptDefinition {
    return {
        name: 'mysql_migration',
        description: 'Generate migration scripts for schema changes',
        arguments: [
            { name: 'change', description: 'What schema change you need', required: true },
            { name: 'table', description: 'Target table name', required: true }
        ],
        // eslint-disable-next-line @typescript-eslint/require-await
        handler: async (args: Record<string, string>, _context: RequestContext) => {
            return `
You are a MySQL migration expert. Create a migration for: ${args['change']}

Target table: ${args['table']}

Please provide:
1. UP migration (apply the change):
   - ALTER TABLE statements
   - Create any new indexes
   - Update any constraints
   
2. DOWN migration (rollback):
   - Reverse all changes
   - Handle data safely
   
3. Safety considerations:
   - Impact on running queries
   - Lock time estimates
   - Data preservation
   
4. For large tables, provide online migration options:
   - pt-online-schema-change approach
   - gh-ost compatibility
   - Rolling deployment strategy

Best practices:
- Test on staging first
- Backup before migration
- Run during low-traffic periods
- Monitor for lock contention
`;
        }
    };
}
