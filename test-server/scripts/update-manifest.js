const fs = require('fs');

const p = 'C:/Users/chris/Desktop/mysql-mcp/test-server/scripts/test-manifest.ts';
let content = fs.readFileSync(p, 'utf8');

const newFiles = [
  { filename: "test-usability-admin-part1.md", directory: "test-usability", group: "admin", tools: ["mysql_optimize_table", "mysql_analyze_table", "mysql_check_table"] },
  { filename: "test-usability-admin-part2.md", directory: "test-usability", group: "admin", tools: ["mysql_repair_table", "mysql_flush_tables", "mysql_kill_query"] },
  { filename: "test-usability-admin-part3.md", directory: "test-usability", group: "admin", tools: ["mysql_append_insight", "mysql_server_config", "mysql_audit_search"] },
  
  { filename: "test-usability-events-part1.md", directory: "test-usability", group: "events", tools: ["mysql_event_create", "mysql_event_alter", "mysql_event_drop"] },
  { filename: "test-usability-events-part2.md", directory: "test-usability", group: "events", tools: ["mysql_event_list", "mysql_event_status", "mysql_scheduler_status"] },
  
  { filename: "test-usability-introspection-part1.md", directory: "test-usability", group: "introspection", tools: ["mysql_dependency_graph", "mysql_topological_sort", "mysql_cascade_simulator"] },
  { filename: "test-usability-introspection-part2.md", directory: "test-usability", group: "introspection", tools: ["mysql_schema_snapshot", "mysql_constraint_analysis", "mysql_migration_risks"] },
  
  { filename: "test-usability-migration-part1.md", directory: "test-usability", group: "migration", tools: ["mysql_migration_init", "mysql_migration_record", "mysql_migration_apply"] },
  { filename: "test-usability-migration-part2.md", directory: "test-usability", group: "migration", tools: ["mysql_migration_rollback", "mysql_migration_history", "mysql_migration_status"] },
  
  { filename: "test-usability-text-part1.md", directory: "test-usability", group: "text", tools: ["mysql_regexp_match", "mysql_like_search", "mysql_soundex"] },
  { filename: "test-usability-text-part2.md", directory: "test-usability", group: "text", tools: ["mysql_substring", "mysql_concat", "mysql_collation_convert"] },
];

let items = newFiles.map(f => JSON.stringify(f, null, 4)).join(',\\n');
// We need to inject this into the array. It doesn't have to be sorted since generate-tests.ts doesn't require sorting.
// Let's just put it at the top of the array
content = content.replace(
  'export const TEST_FILES: TestFileEntry[] = [',
  'export const TEST_FILES: TestFileEntry[] = [\\n' + items + ','
);

fs.writeFileSync(p, content, 'utf8');
console.log("Updated test-manifest.ts via prepend successfully.");
