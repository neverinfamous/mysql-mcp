const fs = require('fs');
const path = require('path');

const file = 'C:/Users/chris/Desktop/mysql-mcp/test-server/test-codemode/test-codemode-backup.md';
const content = fs.readFileSync(file, 'utf8');

const baseContent = content.split('## Group Focus: backup')[0];
const postTestProcedures = '## Post-Test Procedures\n' + content.split('## Post-Test Procedures')[1];

const dataPart = `## Group Focus: backup-data

backup Tool Group (Data) (4 tools +1 code mode):

1. \`mysql_export_table\`
2. \`mysql_import_data\`
3. \`mysql_create_dump\`
4. \`mysql_restore_dump\`

> **Instructions**: Use \`mysql.backup.*\` namespace, push deviations to \`failures\` array.

1. \`mysql.backup.help()\` -> verify method listing
2. \`mysql.backup.exportTable({ table: "test_products", format: "csv" })\` -> verify success
3. \`mysql.backup.importData({ table: "test_products", data: [{ id: 999, name: "Test Item", price: 10.0, category: "electronics" }] })\` -> verify success (clean up the row afterward)
4. \`mysql.backup.createDump({ database: "testdb" })\` -> verify success
5. \`mysql.backup.restoreDump({ filename: "/tmp/backup_dump.sql", database: "testdb" })\` -> verify success

**Domain error paths (🔴):**

6. 🔴 \`mysql.backup.exportTable({ table: "nonexistent_xyz" })\` -> \`{success: false}\`

**Zod validation error paths (🔴):**

7. 🔴 \`mysql.backup.exportTable({})\` -> \`{success: false, error: "Validation error: ..."}\`

**Alias acceptance (🟢):**

8. 🟢 Verify any parameter aliases are accepted for applicable tools.

---

`;

const auditPart = `## Group Focus: backup-audit

backup Tool Group (Audit) (3 tools +1 code mode):

1. \`mysql_audit_list_backups\`
2. \`mysql_audit_restore_backup\`
3. \`mysql_audit_diff_backup\`

> **Instructions**: Use \`mysql.backup.*\` namespace, push deviations to \`failures\` array.

1. \`mysql.backup.help()\` -> verify method listing
2. \`mysql.backup.auditListBackups({ limit: 5 })\` -> verify success
3. \`mysql.backup.auditRestoreBackup({ filename: "some-backup-file.json", dryRun: true })\` -> verify success (or \`{success: false}\` with NOT_FOUND_ERROR)
4. \`mysql.backup.auditDiffBackup({ filename: "some-backup-file.json" })\` -> verify success (or \`{success: false}\` with NOT_FOUND_ERROR)

**Domain error paths (🔴):**

5. 🔴 \`mysql.backup.auditRestoreBackup({ filename: "nonexistent-file.json" })\` -> \`{success: false}\`

---

`;

fs.writeFileSync(path.join(path.dirname(file), 'test-codemode-backup-data.md'), baseContent.replace('[backup]', '[backup-data]') + dataPart + postTestProcedures.replace('test-codemode-backup.md', 'test-codemode-backup-data.md'));
fs.writeFileSync(path.join(path.dirname(file), 'test-codemode-backup-audit.md'), baseContent.replace('[backup]', '[backup-audit]') + auditPart + postTestProcedures.replace('test-codemode-backup.md', 'test-codemode-backup-audit.md'));
fs.unlinkSync(file);
console.log('Split successful');
