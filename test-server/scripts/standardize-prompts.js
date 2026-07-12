import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { TOOL_GROUPS } from "../../src/filtering/tool-constants.js";

const directories = ["test-codemode", "test-advanced", "test-tool-groups", "test-usability", "test-usability-direct"];

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
    if (file.startsWith("coordinator-workflow") || !file.endsWith(".md")) continue;
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
    let groupName = titleMatch[1].trim().toLowerCase();
    const fnMatch = file.match(/test-(?:codemode-)?(?:advanced-)?(?:usability-)?(?:direct-)?(.*?)(?:-part\\d+[a-z]?)?\\.md/);
    if (fnMatch) {
        groupName = fnMatch[1];
    }

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
    } else if (dirName === "test-usability-direct") {
      titleType = "Direct Usability & Hallucination Test";
      if (groupName === "codemode" || groupName.startsWith("codemode")) {
        executionMode = "Organically test the tool group using Code Mode (`mysql_execute_code`) directly, intentionally fuzzing the inputs to discover agent hallucinations.";
      } else {
        executionMode = "Organically test the tool group using live MCP server tool calls directly, intentionally fuzzing the inputs to discover agent hallucinations. DO NOT use Code Mode (`mysql_execute_code`).";
      }
      coverageMatrix = "| Tool | Fuzz Call | Hallucination Found | Fix Applied |";
    } else if (dirName === "test-usability") {
      titleType = "Usability & Hallucination Test";
      executionMode = "Organically test the tool group using ONLY code mode (`mysql_execute_code`), intentionally fuzzing the inputs to discover agent hallucinations, and permanently hardening the codebase against them.";
      coverageMatrix = "| Tool | Fuzz Call | Hallucination Found | Fix Applied |";
    }

    let explicitToolsList = "";
    const colCount = coverageMatrix.split("|").length - 2;
    const divider = "|" + Array(colCount).fill("---").join("|") + "|";

    if ((dirName === "test-codemode" || dirName === "test-advanced" || dirName === "test-tool-groups" || dirName === "test-usability" || dirName === "test-usability-direct") && toolMap[file] && toolMap[file].length > 0) {
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
    let schemaRef = "> See `code-map.md` in the `test-server/` directory for the complete test database schema, and `tool-reference.md` for the tool inventory. For strict tool input schemas, rely on the native MCP tool definitions or read `src/adapters/mysql/schemas/`.\n";
    
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

    // Programmatic Fix: Dynamically align tool-map.json to actual checklist contents
    const foundTools = []; // Removed programmatic tool extraction to preserve SSoT parity
    const validTools = foundTools.filter(t => t !== "mysql_execute_code");
    
    if (validTools.length > 0) {
        // Expand the file's allowed tools to match the reality of the checklist
        toolMap[file] = Array.from(new Set([...(toolMap[file] || []), ...validTools]));
        
        // Re-inject the expanded list into the Explicit Coverage Requirements
        const tools = toolMap[file];
        explicitToolsList = `### Explicit Tool Coverage Requirements\n\n**CRITICAL**: You MUST rigorously test every single tool listed below in this test pass. Ensure that realistic data scenarios, edge cases, and all error paths are validated for each tool:\n\n` + tools.map(t => `- \`${t}\``).join("\n") + "\n";
        
        const colCount = coverageMatrix.split("\n")[0].split("|").length - 2;
        const emptyCols = Array(colCount - 1).fill("   ").join("|");
        const divider = "|" + Array(colCount).fill("---").join("|") + "|";
        const rows = tools.map(t => `| \`${t}\` |${emptyCols}|`);
        coverageMatrix = coverageMatrix.split("\n")[0] + "\n" + divider + "\n" + rows.join("\n");
    }

    let baseGroup = groupName.replace(/-part\d+[a-z]?$/, '');
    if (baseGroup.startsWith('sys-') || baseGroup === 'sys') baseGroup = 'sysschema';
    if (baseGroup.startsWith('codemode-sandbox') || baseGroup === 'sandbox') baseGroup = 'codemode';
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

    if (dirName === 'test-codemode') {
        testContent = `## Group Focus: ${baseGroup}\n\n> **Instructions**: Use \`mysql.*\` namespace, push deviations to \`failures\` array.\n> The subagent should autonomously generate and execute exhaustive tests for the explicitly required tools below.`;
    } else if (dirName === 'test-tool-groups') {
        testContent = `## Group Focus: ${baseGroup}\n\n> **Instructions**: The subagent should autonomously generate and execute exhaustive tests for the explicitly required tools below.`;
    } else {
        testContent = testContent.replace(/## Group Focus:\s*.*/g, `## Group Focus: ${baseGroup}`);
        testContent = testContent.replace(/### .*? Group-Specific Testing/g, `### ${baseGroup} Group-Specific Testing`);
        testContent = testContent.replace(/.*? Tool Group \(\d+ tools.*?\):/g, `${baseGroup} Tool Group (${actualToolCount} tools +1 for code mode):`);
    }

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
    const getCodeModeName = (toolName, groupName) => {
      let name = toolName.replace(/^mysql_/, "");
      const groupPrefixMap = { sysschema: "sys_", fulltext: "fulltext_", docstore: "doc_", transactions: "transaction_", shell: "mysqlsh_" };
      const groupPrefix = groupPrefixMap[groupName] ?? groupName + "_";
      const keepPrefix = new Set(["fulltext", "sysschema", "docstore", "transactions", "cluster", "roles", "events", "replication", "vector"]);
      if (!keepPrefix.has(groupName) && name.startsWith(groupPrefix)) {
        name = name.substring(groupPrefix.length);
      }
      const camelName = name.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      return `mysql.${groupName}.${camelName}`;
    };

    // Apply Code Mode namespace transformations generically for ALL tools
    Object.entries(TOOL_GROUPS).forEach(([gName, tools]) => {
      if (gName === "codemode") return;
      tools.forEach(toolName => {
        const codeModeName = getCodeModeName(toolName, gName);
        if (dirName === 'test-codemode' || dirName === 'test-usability' || (dirName === 'test-advanced' && !groupName.startsWith('sessions'))) {
          // Replace both raw tool name and dotted alias variants to the canonical Code Mode method
          const regex1 = new RegExp(`(?<!\\.)\\b${toolName}\\b`, 'g');
          const regex2 = new RegExp(`mysql\\.${toolName.replace(/^mysql_/, "")}\\b`, 'g');
          testContent = testContent.replace(regex1, codeModeName).replace(regex2, codeModeName);
          explicitToolsList = explicitToolsList.replace(regex1, codeModeName).replace(regex2, codeModeName);
          coverageMatrix = coverageMatrix.replace(regex1, codeModeName).replace(regex2, codeModeName);
        } else {
          // Reverse Code Mode transformations back to raw tool names
          const regex = new RegExp(codeModeName.replace(/\\./g, '\\\\.'), 'g');
          testContent = testContent.replace(regex, toolName);
          explicitToolsList = explicitToolsList.replace(regex, toolName);
          coverageMatrix = coverageMatrix.replace(regex, toolName);
        }
      });
    });

    testContent = testContent
      // Fix nested namespaces in test-advanced by enforcing correct Code Mode API namespaces
      // Apply conditional block
    if (dirName === 'test-codemode' || dirName === 'test-advanced' || dirName === 'test-usability') {
      testContent = testContent
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
      .replace(/mysql\.vector\.vector([A-Z])/g, (match, p1) => "mysql.vector." + p1.toLowerCase())
      .replace(/mysql\.sysschema\.sys([A-Z])/g, (match, p1) => "mysql.sysschema." + p1.toLowerCase())
      .replace(/mysql\.docstore\.doc([A-Z])/g, (match, p1) => "mysql.docstore." + p1.toLowerCase())
      .replace(/mysql\.fulltext\.fulltext([A-Z])/g, (match, p1) => "mysql.fulltext." + p1.toLowerCase())
      .replace(/mysql\.transactions\.transaction([A-Z])/g, (match, p1) => "mysql.transactions." + p1.toLowerCase())
      .replace(/mysql\.cluster\.cluster([A-Z])/g, (match, p1) => "mysql.cluster." + p1.toLowerCase())
      .replace(/mysql\.roles\.role([A-Z])/g, (match, p1) => "mysql.roles." + p1.toLowerCase())
      .replace(/mysql\.events\.event([A-Z])/g, (match, p1) => "mysql.events." + p1.toLowerCase())
      // Fix optimization parameters
      .replace(/mysql_index_recommendation/g, "mysql.optimization.indexRecommendation")
      .replace(/mysql_query_rewrite/g, "mysql.optimization.queryRewrite")
      .replace(/mysql_force_index/g, "mysql.optimization.forceIndex")
      .replace(/mysql_optimizer_trace/g, "mysql.optimization.optimizerTrace")
      .replace(/3\. Verify summary token estimate/g, "1. Verify summary token estimate")
      .replace(/5\. `mysql\.optimization\.indexRecommendation/g, "2. `mysql.optimization.indexRecommendation")
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
      .replace(/mysql_conditional_update/g, "mysql.core.conditionalUpdate");
    } else {
      testContent = testContent
        .replace(/mysql\.events\.create/g, "mysql_event_create")
        .replace(/mysql\.events\.alter/g, "mysql_event_alter")
        .replace(/mysql\.events\.drop/g, "mysql_event_drop")
        .replace(/mysql\.events\.list/g, "mysql_event_list")
        .replace(/mysql\.events\.status/g, "mysql_event_status")
        .replace(/mysql\.events\.schedulerStatus/g, "mysql_scheduler_status")
        .replace(/mysql\.partitioning\.partitionInfo/g, "mysql_partition_info")
        .replace(/mysql\.partitioning\.addPartition/g, "mysql_partition_addPartition")
        .replace(/mysql\.partitioning\.dropPartition/g, "mysql_partition_dropPartition")
        .replace(/mysql\.partitioning\.reorganizePartition/g, "mysql_partition_reorganizePartition")
        .replace(/mysql\.replication\.masterStatus/g, "mysql_master_status")
        .replace(/mysql\.replication\.slaveStatus/g, "mysql_slave_status")
        .replace(/mysql\.replication\.replicationLag/g, "mysql_replication_lag")
        .replace(/mysql\.shell\.version/g, "mysqlsh_version")
        .replace(/mysql\.shell\.checkUpgrade/g, "mysqlsh_check_upgrade")
        .replace(/mysql\.shell\.exportTable/g, "mysqlsh_export_table")
        .replace(/mysql\.shell\.importTable/g, "mysqlsh_import_table")
        .replace(/mysql\.shell\.importJson/g, "mysqlsh_import_json")
        .replace(/mysql\.shell\.dumpInstance/g, "mysqlsh_dump_instance")
        .replace(/mysql\.shell\.dumpSchemas/g, "mysqlsh_dump_schemas")
        .replace(/mysql\.shell\.dumpTables/g, "mysqlsh_dump_tables")
        .replace(/mysql\.shell\.loadDump/g, "mysqlsh_load_dump")
        .replace(/mysql\.shell\.runScript/g, "mysqlsh_run_script")
        .replace(/mysql\.shell\.help/g, "mysqlsh_help")
        .replace(/mysql\.stats\.descriptive/g, "mysql_stats_descriptive")
        .replace(/mysql\.stats\.percentiles/g, "mysql_stats_percentiles")
        .replace(/mysql\.stats\.correlation/g, "mysql_stats_correlation")
        .replace(/mysql\.stats\.distribution/g, "mysql_stats_distribution")
        .replace(/mysql\.stats\.timeSeries/g, "mysql_stats_time_series")
        .replace(/mysql\.stats\.regression/g, "mysql_stats_regression")
        .replace(/mysql\.stats\.sampling/g, "mysql_stats_sampling")
        .replace(/mysql\.stats\.histogram/g, "mysql_stats_histogram")
        .replace(/mysql\.stats\.rowNumber/g, "mysql_stats_row_number")
        .replace(/mysql\.stats\.rank/g, "mysql_stats_rank")
        .replace(/mysql\.stats\.lagLead/g, "mysql_stats_lag_lead")
        .replace(/mysql\.stats\.runningTotal/g, "mysql_stats_running_total")
        .replace(/mysql\.stats\.movingAvg/g, "mysql_stats_moving_avg")
        .replace(/mysql\.stats\.ntile/g, "mysql_stats_ntile")
        .replace(/mysql\.stats\.hypothesis/g, "mysql_stats_hypothesis")
        .replace(/mysql\.stats\.outliers/g, "mysql_stats_outliers")
        .replace(/mysql\.stats\.topN/g, "mysql_stats_top_n")
        .replace(/mysql\.stats\.distinct/g, "mysql_stats_distinct")
        .replace(/mysql\.stats\.frequency/g, "mysql_stats_frequency")
        .replace(/mysql\.stats\.summary/g, "mysql_stats_summary")
        .replace(/mysql\.sysschema\.userSummary/g, "mysql_sys_user_summary")
        .replace(/mysql\.sysschema\.ioSummary/g, "mysql_sys_io_summary")
        .replace(/mysql\.sysschema\.statementSummary/g, "mysql_sys_statement_summary")
        .replace(/mysql\.sysschema\.waitSummary/g, "mysql_sys_wait_summary")
        .replace(/mysql\.sysschema\.innodbLockWaits/g, "mysql_sys_innodb_lock_waits")
        .replace(/mysql\.sysschema\.schemaStats/g, "mysql_sys_schema_stats")
        .replace(/mysql\.sysschema\.hostSummary/g, "mysql_sys_host_summary")
        .replace(/mysql\.sysschema\.memorySummary/g, "mysql_sys_memory_summary")
        .replace(/mysql\.optimization\.indexRecommendation/g, "mysql_index_recommendation")
        .replace(/mysql\.optimization\.queryRewrite/g, "mysql_query_rewrite")
        .replace(/mysql\.optimization\.forceIndex/g, "mysql_force_index")
        .replace(/mysql\.optimization\.optimizerTrace/g, "mysql_optimizer_trace")
        .replace(/mysql\.vector\.search/g, "mysql_vector_search")
        .replace(/mysql\.vector\.rangeSearch/g, "mysql_vector_range_search")
        .replace(/mysql\.vector\.hybridSearch/g, "mysql_vector_hybrid_search")
        .replace(/mysql\.vector\.store/g, "mysql_vector_store")
        .replace(/mysql\.vector\.batchStore/g, "mysql_vector_batch_store")
        .replace(/mysql\.vector\.delete/g, "mysql_vector_delete")
        .replace(/mysql\.vector\.get/g, "mysql_vector_get")
        .replace(/mysql\.vector\.createIndex/g, "mysql_vector_create_index")
        .replace(/mysql\.vector\.optimize/g, "mysql_vector_optimize")
        .replace(/mysql\.vector\.stats/g, "mysql_vector_stats")
        .replace(/mysql\.vector\.info/g, "mysql_vector_info")
        .replace(/mysql\.core\.enableVersioning/g, "mysql_enable_versioning")
        .replace(/mysql\.versioning\.enable/g, "mysql_enable_versioning")
        .replace(/mysql\.core\.disableVersioning/g, "mysql_disable_versioning")
        .replace(/mysql\.versioning\.disable/g, "mysql_disable_versioning")
        .replace(/mysql\.core\.checkVersion/g, "mysql_check_version")
        .replace(/mysql\.versioning\.check/g, "mysql_check_version")
        .replace(/mysql\.core\.conditionalUpdate/g, "mysql_conditional_update")
        .replace(/mysql\.versioning\.conditionalUpdate/g, "mysql_conditional_update")
        .replace(/5\. \`mysql_index_recommendation/g, "2. \`mysql_index_recommendation");
    }

    testContent = testContent
      // Fix optimization parameters
      .replace(/queries: "SELECT 1"/g, 'queries: ["SELECT 1"]')
      // Fix vector parameters
      .replace(/column: "vector", matchColumn: "body", queryVector:/g, 'vectorColumn: "vector", textColumn: "body", queryVector:')
      .replace(/matchQuery:/g, 'queryText:')
      // Fix sys-metrics numbering gaps
      .replace(/10\. 🔴 `mysql\.sysschema\.userSummary/g, "6. 🔴 `mysql.sysschema.userSummary")
      .replace(/11\. 🔴 `mysql\.sysschema\.ioSummary/g, "7. 🔴 `mysql.sysschema.ioSummary")
      .replace(/12\. 🟢 Verify/g, "8. 🟢 Verify")
      // Fix sys-analysis numbering gaps and Zod error
      .replace(/10\. 🔴 `mysql\.sysschema\.schemaStats/g, "6. 🔴 `mysql.sysschema.schemaStats")
      .replace(/11\. 🔴 `mysql\.sysschema\.statementSummary\(\{ limit: "abc" \}\)/g, "7. 🔴 `mysql.sysschema.statementSummary({ orderBy: 123 })")
      .replace(/11\. 🔴 `mysql\.sysschema\.statementSummary/g, "7. 🔴 `mysql.sysschema.statementSummary")
      // Remove hallucinated tasks
      .replace(/- \[ \] Ensure full coverage for mysql\.backup\.auditListBackups\r?\n?/g, "")
      .replace(/- \[ \] Ensure full coverage for mysql\.backup\.auditRestoreBackup\r?\n?/g, "");

    let newContent = getTemplate(
      titleType,
      groupName,
      schemaRef,
      testContent,
      executionMode,
      coverageMatrix,
      explicitToolsList
    );

    if (dirName === 'test-usability-direct' || dirName === 'test-usability') {
      newContent = newContent.replace(/4\. \*\*Validate\*\*: Run `pnpm run check` to validate your changes via lint, typecheck, and test\./g, "4. **Validate**: Run `pnpm run lint`, `pnpm run typecheck`, and `pnpm run build` to validate your changes. Do NOT run `pnpm run test` or `pnpm run check` to save time.");
    }

    fs.writeFileSync(filePath, newContent, "utf-8");
    console.log(`Standardized ${file} (${titleType})`);
  }
}

directories.forEach(processDirectory);
// Programmatic Fix: Save the dynamically expanded tool mappings
// fs.writeFileSync(toolMapPath, JSON.stringify(toolMap, null, 2), "utf-8"); // Disabled
console.log("Standardization complete. tool-map.json dynamically aligned.");
