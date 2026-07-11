import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { TOOL_GROUPS } from "../../src/filtering/tool-constants.js";

const directories = ["test-codemode", "test-advanced", "test-tool-groups", "test-usability"];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const basePath = path.join(__dirname, "..");
const templatePath = path.join(__dirname, "prompt-template.md");

if (!fs.existsSync(templatePath)) {
  console.error("Missing template file: " + templatePath);
  process.exit(1);
}

const templateStr = fs.readFileSync(templatePath, "utf-8");

const toolMapPath = path.join(__dirname, "tool-map.json");
let toolMap = {};
if (fs.existsSync(toolMapPath)) {
  toolMap = JSON.parse(fs.readFileSync(toolMapPath, "utf-8"));
}

const getTemplate = (
  titleType,
  groupName,
  schemaRef,
  testContent,
  executionMode,
  coverageMatrix,
  explicitToolsList
) => {
  return templateStr
    .replace("{{TITLE_TYPE}}", () => titleType)
    .replace("{{GROUP_NAME}}", () => groupName)
    .replace("{{SCHEMA_REF}}", () => schemaRef.trim())
    .replace("{{EXECUTION_MODE}}", () => executionMode)
    .replace("{{COVERAGE_MATRIX}}", () => coverageMatrix)
    .replace("{{EXPLICIT_TOOLS}}", () => explicitToolsList || "")
    .replace("{{TEST_CONTENT}}", () => testContent.trim());
};

function processDirectory(dirName) {
  const dirPath = path.join(basePath, dirName);
  if (!fs.existsSync(dirPath)) return;

  const files = fs
    .readdirSync(dirPath)
    .filter(
      (f) =>
        f.endsWith(".md") && f !== "README.md" && f !== "prompt-template.md"
    );

  for (const file of files) {
    if (file === "coordinator-workflow.md" || !file.endsWith(".md")) continue;
    const filePath = path.join(dirPath, file);
    let content = fs.readFileSync(filePath, "utf-8");

    // Extract group name
    let titleMatch = content.match(/# mysql[- ]mcp .*: \[(.*?)\]/i);
    if (!titleMatch) {
      // Fallback for test-usability files: e.g. # mysql-mcp Usability & Hallucination Test: Core (Part 1)
      const match2 = content.match(/# mysql[- ]mcp .*: ([^\(\n\r]+)/i);
      if (match2) {
        titleMatch = [match2[0], match2[1].trim()];
      }
    }
    if (!titleMatch) {
      console.warn(`Could not find group name in ${file}`);
      continue;
    }
    const groupName = titleMatch[1].trim().toLowerCase();

    let titleType = "Tool Group Testing";
    let executionMode = "Please conduct an exhaustive test of the tool group specified in the checklist below using live MCP server tool calls directly — not scripts/terminal.";
    let coverageMatrix = "| Tool | Direct Call (Happy Path) | Domain Error | Zod Empty Param | Alias Acceptance |";

    if (dirName === "test-advanced") {
      titleType = "Advanced Stress Testing";
      if (groupName.startsWith("sessions")) {
        executionMode = "Execute ALL tests below using terminal scripts (via pwsh/curl/node) to test the HTTP endpoints directly. Do NOT use code mode, as `fetch` and network access are blocked by the Sandbox Security Manager. Return an aggregated `failures` array.";
        coverageMatrix = "| Endpoint | Focus Area | HTTP Validation |";
      } else {
        executionMode = "Execute ALL tests below using ONLY code mode (`mysql_execute_code`). These are second-pass stress tests — basic checklists must pass first. Do not skip tests. Return an aggregated `failures` array.";
        if (toolMap[file] && toolMap[file].length === 0) {
          coverageMatrix = "| Scenario | Focus Area | Code Mode Validation |";
        } else {
          coverageMatrix = "| Tool | Focus Area | Code Mode Validation |";
        }
      }
    } else if (dirName === "test-codemode") {
      titleType = "Code Mode Testing";
      executionMode = "Conduct an exhaustive test of the tool group listed below using ONLY code mode (`mysql_execute_code`). Ensure your validation script returns an aggregated array of failures if any exist. Group multiple tests into a single script to save context window tokens.";
      coverageMatrix = "| Tool | Code Mode (Happy Path) | Code Mode (Domain Error/Zod Error) |";
    } else if (dirName === "test-usability") {
      titleType = "Usability & Hallucination Test";
      executionMode = "Organically test the tool group using Code Mode (`mysql_execute_code`), intentionally fuzzing the inputs to discover agent hallucinations, and permanently hardening the codebase against them.";
      coverageMatrix = "| Tool | Fuzz Call | Hallucination Found | Fix Applied |";
    }

    let explicitToolsList = "";
    const colCount = coverageMatrix.split("|").length - 2;
    const divider = "|" + Array(colCount).fill("---").join("|") + "|";

    if ((dirName === "test-codemode" || dirName === "test-advanced" || dirName === "test-tool-groups" || dirName === "test-usability") && toolMap[file] && toolMap[file].length > 0) {
        const tools = toolMap[file];
        explicitToolsList = `### Explicit Tool Coverage Requirements\n\n**CRITICAL**: You MUST rigorously test every single tool listed below in this test pass. Ensure that realistic data scenarios, edge cases, and all error paths are validated for each tool:\n\n`;
        explicitToolsList += tools.map(t => `- \`${t}\``).join("\n") + "\n";
        
        // Append rows to the coverage matrix!
        const emptyCols = Array(colCount - 1).fill("   ").join("|");
        const rows = tools.map(t => `| \`${t}\` |${emptyCols}|`);
        coverageMatrix += "\n" + divider + "\n" + rows.join("\n");
    } else {
        // Just add the divider so the table is valid markdown
        coverageMatrix += "\n" + divider + "\n";
    }

    // Extract Schema Reference
    const schemaMatch = content.match(
      /## Test Database Schema([\s\S]*?)## (Testing Requirements|Structured Error|Reporting Format|Pre-requisites)/
    ) || content.match(
      /### Test Schema Reference([\s\S]*?)## (Testing Requirements|Structured Error|Reporting Format|Pre-requisites)/
    );
    let schemaRef = "> See `code-map.md` in the `test-server/` directory for the complete test database schema, and `tool-reference.md` for strict tool input schemas.\n";
    
    if (schemaMatch && schemaMatch[1]) {
        schemaRef = schemaMatch[1].trim();
    }

    const lines = content.split("\n");
    let testStartIdx = lines.findIndex(l => l.startsWith("## Group Focus:") || l.startsWith("## Category 1:"));
    
    if (testStartIdx === -1) {
        // Fallback for some files that might use different headers
        testStartIdx = lines.findIndex(l => l.startsWith("### " + groupName + " Group-Specific Testing") || l.startsWith("## Tests:") || l.startsWith("## Tasks"));
    }

    if (testStartIdx === -1) {
        // Fallback for test-usability
        testStartIdx = lines.findIndex(l => l.startsWith("**Instructions:**") || l.startsWith("## 1. Fuzz Phase"));
    }

    if (testStartIdx === -1) {
        // Fallback for files with no specific test content other than the explicit tools block
        testStartIdx = lines.findIndex(l => l.startsWith("### Explicit Tool Coverage"));
    }

    // Properly find the FIRST post-test section to avoid capturing duplicates
    let postTestIdx = lines.findIndex((l, i) => i > testStartIdx && (l.startsWith("## Post-Test") || l.startsWith("## Execute Post-Test") || l.startsWith("## 3. Local Verification")));
    let contentEndIdx = lines.length;

    // We only want the first block, so if there is a '---' before the first post-test, we cut it there
    if (testStartIdx !== -1 && postTestIdx !== -1) {
        for (let i = testStartIdx + 1; i < postTestIdx; i++) {
            if (lines[i].trim() === "---") {
                contentEndIdx = i;
                break; // Stop at the first '---' to prevent capturing duplicates
            }
        }
        if (contentEndIdx === lines.length) {
            contentEndIdx = postTestIdx;
        }
    }

    if (testStartIdx === -1) {
      console.warn(`Could not find test content start boundary in ${file}`);
      continue;
    }

    let testContent = lines.slice(testStartIdx, contentEndIdx).join("\n");

    let baseGroup = groupName.replace(/-part\d+[a-z]?$/, '');
    if (baseGroup.startsWith('sys-') || baseGroup === 'sys') baseGroup = 'sysschema';
    if (baseGroup === 'partitioning-part1' || baseGroup === 'partitioning-part2') baseGroup = 'partitioning';
    if (baseGroup.startsWith('core-part3')) baseGroup = 'core';
    if (baseGroup.startsWith('json-')) baseGroup = 'json';
    if (baseGroup.startsWith('performance-')) baseGroup = 'performance';
    if (baseGroup.startsWith('stats-')) baseGroup = 'stats';
    if (baseGroup.startsWith('docstore-')) baseGroup = 'docstore';
    if (baseGroup.startsWith('backup-')) baseGroup = 'backup';
    if (baseGroup.startsWith('cluster-')) baseGroup = 'cluster';
    if (baseGroup.startsWith('schema-')) baseGroup = 'schema';
    if (baseGroup.startsWith('spatial-')) baseGroup = 'spatial';
    if (baseGroup.startsWith('vector-')) baseGroup = 'vector';
    if (baseGroup.startsWith('admin-')) baseGroup = 'admin';
    if (baseGroup.startsWith('monitoring-')) baseGroup = 'monitoring';
    if (baseGroup.startsWith('proxysql-')) baseGroup = 'proxysql';
    if (baseGroup.startsWith('roles-')) baseGroup = 'roles';
    if (baseGroup.startsWith('router-')) baseGroup = 'router';
    if (baseGroup.startsWith('security-')) baseGroup = 'security';
    if (baseGroup.startsWith('shell-')) baseGroup = 'shell';
    if (baseGroup.startsWith('text-')) baseGroup = 'text';
    if (baseGroup.startsWith('transactions-')) baseGroup = 'transactions';
    if (baseGroup.startsWith('fulltext-')) baseGroup = 'fulltext';

    const actualToolCount = TOOL_GROUPS[baseGroup] ? TOOL_GROUPS[baseGroup].length : 0;

    testContent = testContent.replace(/## Group Focus: .*/g, `## Group Focus: ${baseGroup}`);
    testContent = testContent.replace(/### .*? Group-Specific Testing/g, `### ${baseGroup} Group-Specific Testing`);
    testContent = testContent.replace(/.*? Tool Group \(\d+ tools.*?\):/g, `${baseGroup} Tool Group (${actualToolCount} tools +1 for code mode):`);

    // Extract and preserve existing explicit tool coverage block if we didn't generate one
    if (!explicitToolsList) {
        const match = content.match(/### Explicit Tool Coverage Requirements[\s\S]*?(?=## Group Focus:|## Tasks|## Category|## Post-Test|## Execute Post-Test|---|$)/i);
        if (match) {
            if (toolMap[file] && toolMap[file].length === 0) {
                // If it's explicitly empty in toolMap, we intentionally don't want specific tool constraints.
                explicitToolsList = "";
            } else {
                explicitToolsList = match[0].trim();
            }
        }
    }

    // Always remove existing explicit tool coverage block from testContent (it will be injected via template)
    testContent = testContent.replace(/### Explicit Tool Coverage Requirements[\s\S]*?(?=## Group Focus:|## Tasks|## Category|## Post-Test|## Execute Post-Test|---|$)/ig, "");

    // Apply specific corrections for parameter drift and nested namespaces dynamically
    testContent = testContent
      // Fix nested namespaces in test-advanced by enforcing correct Code Mode API namespaces
      .replace(/mysql\.event_create/g, "mysql.events.create")
      .replace(/mysql\.event_alter/g, "mysql.events.alter")
      .replace(/mysql\.event_drop/g, "mysql.events.drop")
      .replace(/mysql\.event_list/g, "mysql.events.list")
      .replace(/mysql\.event_status/g, "mysql.events.status")
      .replace(/mysql\.event_schedulerStatus/g, "mysql.events.schedulerStatus")
      .replace(/mysql\.partition_partitionInfo/g, "mysql.partitioning.partitionInfo")
      .replace(/mysql\.partition_addPartition/g, "mysql.partitioning.addPartition")
      .replace(/mysql\.partition_dropPartition/g, "mysql.partitioning.dropPartition")
      .replace(/mysql\.partition_reorganizePartition/g, "mysql.partitioning.reorganizePartition")
      .replace(/mysql\.master_status/g, "mysql.replication.masterStatus")
      .replace(/mysql\.slave_status/g, "mysql.replication.slaveStatus")
      .replace(/mysql\.replication_lag/g, "mysql.replication.replicationLag")
      .replace(/mysqlsh_version/g, "mysql.shell.version")
      .replace(/mysqlsh_check_upgrade/g, "mysql.shell.checkUpgrade")
      .replace(/mysqlsh_export_table/g, "mysql.shell.exportTable")
      .replace(/mysqlsh_import_table/g, "mysql.shell.importTable")
      .replace(/mysqlsh_import_json/g, "mysql.shell.importJson")
      .replace(/mysqlsh_dump_instance/g, "mysql.shell.dumpInstance")
      .replace(/mysqlsh_dump_schemas/g, "mysql.shell.dumpSchemas")
      .replace(/mysqlsh_dump_tables/g, "mysql.shell.dumpTables")
      .replace(/mysqlsh_load_dump/g, "mysql.shell.loadDump")
      .replace(/mysqlsh_run_script/g, "mysql.shell.runScript")
      .replace(/mysqlsh_help/g, "mysql.shell.help")
      .replace(/mysqlsh_dumpSchemas/g, "mysql.shell.dumpSchemas")
      .replace(/mysqlsh_dumpTables/g, "mysql.shell.dumpTables")
      .replace(/mysqlsh_loadDump/g, "mysql.shell.loadDump")
      .replace(/mysqlsh_exportTable/g, "mysql.shell.exportTable")
      .replace(/mysqlsh_importTable/g, "mysql.shell.importTable")
      .replace(/mysqlsh_importJson/g, "mysql.shell.importJson")
      .replace(/mysqlsh_dumpInstance/g, "mysql.shell.dumpInstance")
      .replace(/mysqlsh_runScript/g, "mysql.shell.runScript")
      .replace(/mysql\.stats_descriptive/g, "mysql.stats.descriptive")
      .replace(/mysql\.stats_percentiles/g, "mysql.stats.percentiles")
      .replace(/mysql\.stats_correlation/g, "mysql.stats.correlation")
      .replace(/mysql\.stats_distribution/g, "mysql.stats.distribution")
      .replace(/mysql\.stats_time_series/g, "mysql.stats.timeSeries")
      .replace(/mysql\.stats_regression/g, "mysql.stats.regression")
      .replace(/mysql\.stats_sampling/g, "mysql.stats.sampling")
      .replace(/mysql\.stats_histogram/g, "mysql.stats.histogram")
      .replace(/mysql\.stats_row_number/g, "mysql.stats.rowNumber")
      .replace(/mysql\.stats_rank/g, "mysql.stats.rank")
      .replace(/mysql\.stats_lag_lead/g, "mysql.stats.lagLead")
      .replace(/mysql\.stats_running_total/g, "mysql.stats.runningTotal")
      .replace(/mysql\.stats_moving_avg/g, "mysql.stats.movingAvg")
      .replace(/mysql\.stats_ntile/g, "mysql.stats.ntile")
      .replace(/mysql\.stats_hypothesis/g, "mysql.stats.hypothesis")
      .replace(/mysql\.stats_outliers/g, "mysql.stats.outliers")
      .replace(/mysql\.stats_top_n/g, "mysql.stats.topN")
      .replace(/mysql\.stats_distinct/g, "mysql.stats.distinct")
      .replace(/mysql\.stats_frequency/g, "mysql.stats.frequency")
      .replace(/mysql\.stats_summary/g, "mysql.stats.summary")
      .replace(/mysql\.stats_help/g, "mysql.stats.help")
      .replace(/mysql\.stats_topN/g, "mysql.stats.topN")
      .replace(/mysql\.executeCode/g, "mysql_execute_code")
      .replace(/mysql\.sys\.sys([A-Z])/g, (match, p1) => "mysql.sysschema." + p1.toLowerCase())
      .replace(/mysql\.sysschema\.([A-Z])/g, (match, p1) => "mysql.sysschema." + p1.toLowerCase())
      // Fix optimization parameters
      .replace(/mysql_index_recommendation/g, "mysql.optimization.indexRecommendation")
      .replace(/mysql_query_rewrite/g, "mysql.optimization.queryRewrite")
      .replace(/mysql_force_index/g, "mysql.optimization.forceIndex")
      .replace(/mysql_optimizer_trace/g, "mysql.optimization.optimizerTrace")
      .replace(/3\\. Verify summary token estimate/g, "1. Verify summary token estimate")
      .replace(/5\\. \`mysql\\.optimization\\.indexRecommendation/g, "2. `mysql.optimization.indexRecommendation")
      // Fix vector parameters
      .replace(/mysql_vector_search/g, "mysql.vector.search")
      .replace(/mysql_vector_range_search/g, "mysql.vector.rangeSearch")
      .replace(/mysql_vector_hybrid_search/g, "mysql.vector.hybridSearch")
      .replace(/mysql_vector_store/g, "mysql.vector.store")
      .replace(/mysql_vector_batch_store/g, "mysql.vector.batchStore")
      .replace(/mysql_vector_delete/g, "mysql.vector.delete")
      .replace(/mysql_vector_get/g, "mysql.vector.get")
      .replace(/mysql_vector_create_index/g, "mysql.vector.createIndex")
      .replace(/mysql_vector_optimize/g, "mysql.vector.optimize")
      .replace(/mysql_vector_stats/g, "mysql.vector.stats")
      .replace(/mysql_vector_info/g, "mysql.vector.info")
      .replace(/mysql_enable_versioning/g, "mysql.core.enableVersioning")
      .replace(/mysql_disable_versioning/g, "mysql.core.disableVersioning")
      .replace(/mysql_check_version/g, "mysql.core.checkVersion")
      .replace(/mysql_conditional_update/g, "mysql.core.conditionalUpdate")
      // Fix optimization parameters
      .replace(/queries: "SELECT 1"/g, 'queries: ["SELECT 1"]')
      // Fix vector parameters
      .replace(/column: "vector", matchColumn: "body", queryVector:/g, 'vectorColumn: "vector", textColumn: "body", queryVector:')
      .replace(/matchQuery:/g, 'queryText:')
      // Fix sys-metrics numbering gaps
      .replace(/10\\. 🔴 `mysql\\.sysschema\\.userSummary/g, "6. 🔴 `mysql.sysschema.userSummary")
      .replace(/11\\. 🔴 `mysql\\.sysschema\\.ioSummary/g, "7. 🔴 `mysql.sysschema.ioSummary")
      .replace(/12\\. 🟢 Verify/g, "8. 🟢 Verify")
      // Fix sys-analysis numbering gaps and Zod error
      .replace(/10\\. 🔴 `mysql\\.sysschema\\.schemaStats/g, "6. 🔴 `mysql.sysschema.schemaStats")
      .replace(/11\\. 🔴 `mysql\\.sysschema\\.statementSummary\(\{ limit: "abc" \}\)/g, "7. 🔴 `mysql.sysschema.statementSummary({ orderBy: 123 })")
      .replace(/11\\. 🔴 `mysql\\.sysschema\\.statementSummary/g, "7. 🔴 `mysql.sysschema.statementSummary");

    const newContent = getTemplate(
      titleType,
      groupName,
      schemaRef,
      testContent,
      executionMode,
      coverageMatrix,
      explicitToolsList
    );
    fs.writeFileSync(filePath, newContent, "utf-8");
    console.log(`Standardized ${file} (${titleType})`);
  }
}

directories.forEach(processDirectory);
console.log("Standardization complete.");
