/**
 * MySQL Prompt - Index Tuning
 * 
 * Index analysis and optimization workflow.
 */
import type { PromptDefinition, RequestContext } from '../../../types/index.js';

export function createIndexTuningPrompt(): PromptDefinition {
    return {
        name: 'mysql_index_tuning',
        description: 'Analyze and optimize database indexes',
        arguments: [
            { name: 'table', description: 'Specific table to analyze (optional, analyzes all if not provided)', required: false }
        ],
        handler: (args: Record<string, string>, _context: RequestContext) => {
            const table = args['table'];

            return Promise.resolve(`# MySQL Index Tuning Workflow

${table ? `Analyze and optimize indexes for table: **${table}**` : 'Analyze and optimize indexes across the database'}

## Step 1: Identify Index Issues

### Check for Unused Indexes
Use \`mysql://indexes\` resource to find indexes with zero scans.
Unused indexes:
- Waste storage space
- Slow down INSERT/UPDATE/DELETE operations
- Should be reviewed for removal

### Check for Missing Indexes
Use \`mysql_index_usage\` or \`mysql_explain_analyze\` on slow queries:
- Look for full table scans (type = ALL)
- Look for range scans that could use indexes (type = range without index)
- Check for filesort and temporary table usage

### Check for Duplicate Indexes
The \`mysql://indexes\` resource identifies potential duplicates:
- Indexes with same leading columns
- Redundant indexes (e.g., INDEX(a) when INDEX(a,b) exists)

## Step 2: Analyze Query Patterns

### Find Slow Queries
Use \`mysql://performance\` resource or \`mysql_slow_queries\` tool:
- Identify top queries by execution time
- Look for queries without appropriate indexes

### EXPLAIN Analysis
For each slow query, use \`mysql_explain_analyze\`:
\`\`\`
Key things to look for:
- type: ALL (full table scan - bad)
- type: index (full index scan - often bad)
- type: range, ref, eq_ref (good)
- Extra: Using filesort (may need index)
- Extra: Using temporary (may need index)
\`\`\`

## Step 3: Index Recommendations

Use \`mysql_index_recommendation\` tool for AI-powered suggestions:
- Composite index recommendations
- Covering index opportunities
- Index order optimization

## Step 4: Implement Changes

### Adding Indexes
\`\`\`sql
CREATE INDEX idx_name ON table_name (column1, column2);
-- Or for large tables, use pt-online-schema-change
\`\`\`

### Removing Unused Indexes
\`\`\`sql
-- First verify the index is truly unused
DROP INDEX idx_name ON table_name;
\`\`\`

## Step 5: Verify Improvements
After changes:
1. Re-run EXPLAIN on problematic queries
2. Compare query execution times
3. Monitor \`mysql://performance\` for improvements

${table ? `\nStart by analyzing indexes on table **${table}**.` : '\nStart by reviewing the `mysql://indexes` resource.'}`);
        }
    };
}
