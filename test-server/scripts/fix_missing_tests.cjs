const fs = require('fs');
const path = require('path');

const baseDir = path.resolve(__dirname, '..');

// 1. Fix Admin tests
const adminFiles = [
  path.join(baseDir, 'test-tool-groups', 'test-admin.md'),
  path.join(baseDir, 'test-codemode', 'test-codemode-admin.md'),
  path.join(baseDir, 'test-advanced', 'test-codemode-advanced-admin.md')
];

for (const file of adminFiles) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    
    // Add to tool count if needed (not needed for advanced but good to be safe)
    content = content.replace(/admin Tool Group \(7 tools \+1 for code mode\):/, 'admin Tool Group (9 tools +1 for code mode):');
    content = content.replace(/admin Tool Group \(7 tools \+1 code mode\):/, 'admin Tool Group (9 tools +1 code mode):');
    
    // Check if tools are missing from the list (1-10)
    if (!content.includes("'mysql_repair_table'") && file.includes('test-tool-groups')) {
      // Actually they are in the list: 1-9 but the tests are missing
    }

    if (file.includes('test-tool-groups')) {
        let replacement = `7. \`mysql_server_config({action: "set", setting: "logLevel", value: "info"})\` → \`{success: true, message: ...}\`
8. \`mysql_repair_table({table: "test_products"})\` → verify InnoDB not supported message
9. \`mysql_flush_tables({tables: ["test_products"]})\` → verify success
10. \`mysql_append_insight({insight: "Test insight"})\` → verify success
11. \`mysql_audit_search({})\` → \`{success: true, entries: [...]}\`
12. \`mysql_audit_search({limit: 5, offset: 1})\` → verify pagination
13. \`mysql_audit_search({tool: "mysql_write_query"})\` → verify tool filtering
14. \`mysql_audit_search({success: false})\` → verify outcome filtering

**Domain error paths (🔴):**

15. 🔴 \`mysql_analyze_table({table: "nonexistent_table_xyz"})\` → \`{success: false, error: "..."}\` handler error
16. 🔴 \`mysql_server_config({action: "set", setting: "logLevel", value: "invalid_level"})\` → \`{success: false, error: "Invalid log level..."}\`
17. 🔴 \`mysql_server_config({action: "set"})\` → \`{success: false, error: "Missing setting or value..."}\`

**Zod validation error paths (🔴):**

18. 🔴 \`mysql_analyze_table({})\` → \`{success: false, error: "..."}\` (Zod validation)
19. 🔴 \`mysql_server_config({})\` → \`{success: false, error: "..."}\` (Zod validation)
20. 🔴 \`mysql_server_config({action: "invalid"})\` → \`{success: false, error: "..."}\` (Zod validation)
21. 🔴 \`mysql_audit_search({limit: "abc"})\` → \`{success: false, error: "..."}\` (Zod validation, wrong type)
22. 🔴 \`mysql_flush_tables({tables: "not_array"})\` → \`{success: false, error: "..."}\` (Zod validation)

**Wrong-type numeric param coercion (🔴):**

23. 🔴 \`mysql_kill_query({id: "abc"})\` → must NOT return raw MCP error`;

        content = content.replace(/7\. `mysql_server_config.*?\n[\s\S]*?19\. 🔴 `mysql_kill_query.*?\n/m, replacement + '\n');
    }
    
    if (file.includes('test-codemode-admin') && !file.includes('advanced')) {
        let replacement = `7. \`mysql.admin.serverConfig({action: "set", setting: "logLevel", value: "info"})\` → success
8. \`mysql.admin.repairTable({table: "test_products"})\` → verify InnoDB not supported message
9. \`mysql.admin.flushTables({tables: ["test_products"]})\` → verify success
10. \`mysql.admin.appendInsight({insight: "Test insight"})\` → verify success
11. \`mysql.admin.auditSearch({})\` → success
12. \`mysql.admin.auditSearch({limit: 5, offset: 1})\` → verify pagination
13. \`mysql.admin.auditSearch({tool: "mysql_write_query"})\` → verify filtering
14. \`mysql.admin.auditSearch({success: false})\` → verify filtering

**Domain error paths (🔴):**

15. 🔴 \`mysql.admin.analyzeTable({table: "nonexistent_table_xyz"})\` → \`{success: false}\`
16. 🔴 \`mysql.admin.serverConfig({action: "set", setting: "logLevel", value: "invalid_level"})\` → \`{success: false}\`
17. 🔴 \`mysql.admin.serverConfig({action: "set"})\` → \`{success: false}\`

**Zod validation error paths (🔴):**

18. 🔴 \`mysql.admin.analyzeTable({})\` → \`{success: false}\`
19. 🔴 \`mysql.admin.serverConfig({})\` → \`{success: false}\`
20. 🔴 \`mysql.admin.serverConfig({action: "invalid"})\` → \`{success: false}\`
21. 🔴 \`mysql.admin.auditSearch({limit: "abc"})\` → \`{success: false}\`
22. 🔴 \`mysql.admin.flushTables({tables: "not_array"})\` → \`{success: false}\``;

        content = content.replace(/7\. `mysql\.admin\.serverConfig.*?\n[\s\S]*?18\. 🔴 `mysql\.admin\.auditSearch.*?\n/m, replacement + '\n');
    }

    fs.writeFileSync(file, content);
  }
}

// 2. Fix Monitoring tests
const monitoringFiles = [
  path.join(baseDir, 'test-tool-groups', 'test-monitoring.md'),
  path.join(baseDir, 'test-codemode', 'test-codemode-monitoring.md')
];

for (const file of monitoringFiles) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');

    if (file.includes('test-tool-groups')) {
        let replacement = `7. \`mysql_server_health()\` → verify \`{status: "..."}\` with health assessment
8. \`mysql_replication_status()\` → verify replica status or configured: false

**Domain error paths (🔴):**

9. 🔴 \`mysql_show_status({like: "nonexistent_var_xyz"})\` → empty results or structured error — not raw MCP error

**Wrong-type numeric param coercion (🔴):**

10. 🔴 \`mysql_show_variables({limit: "abc"})\` → must NOT return raw MCP error`;

        content = content.replace(/7\. `mysql_server_health.*?\n[\s\S]*?9\. 🔴 `mysql_show_variables.*?\n/m, replacement + '\n');
    }
    
    if (file.includes('test-codemode-monitoring')) {
        let replacement = `7. \`mysql.monitoring.serverHealth()\` → verify \`{status: "..."}\`
8. \`mysql.monitoring.replicationStatus()\` → verify replica status

**Domain error paths (🔴):**

9. 🔴 \`mysql.monitoring.showStatus({like: "nonexistent_var_xyz"})\` → empty results

**Zod validation error paths (🔴):**

10. 🔴 \`mysql.monitoring.showVariables({limit: "abc"})\` → \`{success: false}\``;

        content = content.replace(/7\. `mysql\.monitoring\.serverHealth.*?\n[\s\S]*?10\. 🔴 `mysql\.monitoring\.showVariables.*?\n/m, replacement + '\n');
    }

    fs.writeFileSync(file, content);
  }
}

console.log("Done fixing tests");
