import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const directories = ["test-codemode", "test-advanced", "test-tool-groups", "test-usability"];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const basePath = path.join(__dirname, "..", "test-server");
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
      if (groupName === "sessions") {
        executionMode = "Execute ALL tests below using terminal scripts (via pwsh/curl/node) to test the HTTP endpoints directly. Do NOT use code mode, as `fetch` and network access are blocked by the Sandbox Security Manager. Return an aggregated `failures` array.";
        coverageMatrix = "| Endpoint | Focus Area | HTTP Validation |";
      } else {
        executionMode = "Execute ALL tests below using ONLY code mode (`mysql_execute_code`). These are second-pass stress tests — basic checklists must pass first. Do not skip tests. Return an aggregated `failures` array.";
        coverageMatrix = "| Tool | Focus Area | Code Mode Validation |";
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
    if ((dirName === "test-advanced" || dirName === "test-tool-groups" || dirName === "test-usability") && toolMap[file] && toolMap[file].length > 0) {
        const tools = toolMap[file];
        explicitToolsList = `### Explicit Tool Coverage Requirements\n\n**CRITICAL**: You MUST rigorously test every single tool listed below in this test pass. Ensure that realistic data scenarios, edge cases, and all error paths are validated for each tool:\n\n`;
        explicitToolsList += tools.map(t => `- \`${t}\``).join("\n") + "\n";
        
        // Append rows to the coverage matrix!
        const colCount = coverageMatrix.split("|").length - 2;
        const emptyCols = Array(colCount - 1).fill(" ").join("|");
        const rows = tools.map(t => `| \`${t}\` |${emptyCols}|`);
        coverageMatrix += "\n" + rows.join("\n");
    }

    // Extract Schema Reference
    const schemaMatch = content.match(
      /## Test Database Schema([\s\S]*?)## (Testing Requirements|Structured Error|Reporting Format|Pre-requisites)/
    ) || content.match(
      /### Test Schema Reference([\s\S]*?)## (Testing Requirements|Structured Error|Reporting Format|Pre-requisites)/
    );
    let schemaRef = "> See `code-map.md` in the `test-server/` directory for the complete test database schema.\n";
    
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
        // Fallback for files with no specific test content other than the explicit tools block
        testStartIdx = lines.findIndex(l => l.startsWith("### Explicit Tool Coverage"));
    }

    if (testStartIdx === -1) {
        // Fallback for test-usability
        testStartIdx = lines.findIndex(l => l.startsWith("**Instructions:**") || l.startsWith("## 1. Fuzz Phase"));
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

    // Extract and preserve existing explicit tool coverage block if we didn't generate one
    if (!explicitToolsList) {
        const match = content.match(/### Explicit Tool Coverage Requirements[\s\S]*?(?=## Group Focus:|## Tasks|## Category|## Post-Test|## Execute Post-Test|---|$)/i);
        if (match) {
            explicitToolsList = match[0].trim();
        }
    }

    // Always remove existing explicit tool coverage block from testContent (it will be injected via template)
    testContent = testContent.replace(/### Explicit Tool Coverage Requirements[\s\S]*?(?=## Group Focus:|## Tasks|## Category|## Post-Test|## Execute Post-Test|---|$)/ig, "");

    // Apply specific corrections for parameter drift and nested namespaces dynamically
    testContent = testContent
      // Fix nested namespaces in test-advanced
      .replace(/mysql\.events\./g, "mysql.event_")
      .replace(/mysql\.partitioning\./g, "mysql.partition_")
      .replace(/mysql\.replication\.masterStatus/g, "mysql.master_status")
      .replace(/mysql\.replication\.slaveStatus/g, "mysql.slave_status")
      .replace(/mysql\.replication\.lag/g, "mysql.replication_lag")
      .replace(/mysql\.shell\./g, "mysqlsh_")
      .replace(/mysql\.stats\./g, "mysql.stats_")
      // Fix fulltext parameters in test-codemode
      .replace(/mysql\.fulltext\.search\(\{(.*?)\}\)/g, (match, p1) => {
          if (!p1.includes("maxLength")) return `mysql.fulltext.search({${p1}, maxLength: 200})`;
          return match;
      })
      .replace(/mysql\.fulltext\.boolean\(\{(.*?)\}\)/g, (match, p1) => {
          if (!p1.includes("maxLength")) return `mysql.fulltext.boolean({${p1}, maxLength: 200})`;
          return match;
      })
      .replace(/mysql\.fulltext\.expand\(\{(.*?)\}\)/g, (match, p1) => {
          if (!p1.includes("maxLength")) return `mysql.fulltext.expand({${p1}, maxLength: 200})`;
          return match;
      })
      // Fix optimization parameters
      .replace(/mysql\.optimization\.indexRecommendation\(\{table: "([^"]+)"\}\)/g, 'mysql.optimization.indexRecommendation({table: "$1", includeRedundant: true, includeUnindexed: true})')
      .replace(/mysql\.optimization\.indexRecommendation\(\{queries: \[([^\]]+)\]\}\)/g, 'mysql.optimization.indexRecommendation({queries: [$1], includeRedundant: true, includeUnindexed: true})')
      // Fix vector parameters
      .replace(/mysql\.vector\.hybridSearch\(\{\.\.\.\}\)/g, 'mysql.vector.hybridSearch({table: "test_articles", column: "vector", matchColumn: "body", queryVector: [0.1, 0.2], matchQuery: "test", metric: "L2", rrfK: 60, select: ["id"], filter: {}})');

    if (file === "test-codemode-versioning.md" && !testContent.includes("mysql.versioning.enable")) {
        testContent = testContent.replace(
            "**Checklist:**\n",
            "**Checklist:**\n\n1. ✅ `mysql.versioning.enable({table: \"test_articles\"})` → happy path\n2. ✅ `mysql.versioning.disable({table: \"test_articles\"})` → happy path\n3. ✅ `mysql.versioning.check({table: \"test_articles\", id: 1})` → happy path\n4. ✅ `mysql.versioning.conditionalUpdate({table: \"test_articles\", id: 1, version: 1, data: {title: \"New Title\"}, conditions: {}})` → happy path\n\n**Domain error paths (🔴):**\n\n5. ✅ `mysql.versioning.enable({table: \"nonexistent_xyz\"})` → domain error (TABLE_NOT_FOUND)\n6. ✅ `mysql.versioning.check({table: \"test_articles\", id: 99999})` → domain error\n\n**Zod validation error paths (🔴):**\n\n7. ✅ `mysql.versioning.enable({})` → validation error\n8. ✅ `mysql.versioning.conditionalUpdate({})` → validation error\n"
        );
    }

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
