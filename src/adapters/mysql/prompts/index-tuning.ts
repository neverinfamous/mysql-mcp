/**
 * MySQL Prompt - Index Tuning
 *
 * Index analysis and optimization workflow.
 */
import type { PromptDefinition, RequestContext } from "../../../types/index.js";

export function createIndexTuningPrompt(): PromptDefinition {
  return {
    name: "mysql_index_tuning",
    description: "Analyze and optimize database indexes",
    arguments: [
      {
        name: "table",
        description:
          "Specific table to analyze (optional, analyzes all if not provided)",
        required: false,
      },
    ],
    handler: (args: Record<string, string>, _context: RequestContext) => {
      const table = args["table"];

      return Promise.resolve(`# MySQL Index Tuning Workflow

${table ? `Analyze and optimize indexes for table: **${table}**` : "Analyze and optimize indexes across the database"}

## Step 1: Identify Index Issues

### Check for Unused Indexes
Use \`mysql://indexes\` resource to find indexes with zero scans.
Unused indexes:
- Waste storage space
- Slow down INSERT/UPDATE/DELETE operations
- Should be reviewed for removal

### Audit for Structural Index Issues
Use \`mysql_index_recommendation\` to perform a database-wide index audit:
- Identifies redundant/duplicate indexes (prefix matches)
- Detects missing foreign key indexes
- Flags large tables without secondary indexes
\`\`\`javascript
mysql_index_recommendation({}) // Audit entire database
// or
mysql_index_recommendation({table: "orders"}) // Audit specific table
\`\`\`

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

Use \`mysql_index_recommendation\` with the \`queries\` parameter to get AI-powered composite index suggestions:
\`\`\`javascript
mysql_index_recommendation({
  queries: [
    "SELECT * FROM orders WHERE status = 'active' AND user_id = 123",
    "SELECT * FROM users WHERE last_login > '2023-01-01' ORDER BY created_at"
  ]
})
\`\`\`
This runs EXPLAIN on the queries to detect full table scans and suggests composite indexes for the filtered columns.

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

${table ? `\nStart by analyzing indexes on table **${table}**.` : "\nStart by reviewing the `mysql://indexes` resource."}`);
    },
  };
}
