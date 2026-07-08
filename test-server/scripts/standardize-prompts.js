import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const directories = ["test-codemode", "test-advanced", "test-tool-groups"];

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
    const filePath = path.join(dirPath, file);
    let content = fs.readFileSync(filePath, "utf-8");

    // Extract group name
    const titleMatch = content.match(/# mysql[- ]mcp .*: \[(.*?)\]/i);
    if (!titleMatch) {
      console.warn(`Could not find group name in ${file}`);
      continue;
    }
    const groupName = titleMatch[1];

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
    }

    let explicitToolsList = "";
    if (dirName === "test-advanced" && toolMap[file] && toolMap[file].length > 0) {
        const tools = toolMap[file];
        explicitToolsList = `### Explicit Tool Coverage Requirements\n\n**CRITICAL**: You MUST rigorously test every single tool listed below in this test pass. Ensure that realistic data scenarios, edge cases, and all error paths are validated for each tool:\n\n`;
        explicitToolsList += tools.map(t => `- \`${t}\``).join("\n") + "\n";
        
        // Append rows to the coverage matrix!
        const rows = tools.map(t => `| \`${t}\` | | |`);
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

    let postTestIdx = lines.findIndex((l, i) => i > testStartIdx && (l.startsWith("## Post-Test") || l.startsWith("## Execute Post-Test")));
    let contentEndIdx = lines.length;

    // Handle already standardized files (content is between --- blocks before Post-Test)
    if (testStartIdx === -1 && postTestIdx !== -1) {
        let lastDashes = -1;
        for (let i = postTestIdx - 1; i >= 0; i--) {
            if (lines[i].trim() === "---") {
                lastDashes = i;
                break;
            }
        }
        if (lastDashes !== -1) {
            let firstDashes = -1;
            for (let i = lastDashes - 1; i >= 0; i--) {
                if (lines[i].trim() === "---") {
                    firstDashes = i;
                    break;
                }
            }
            if (firstDashes !== -1) {
                testStartIdx = firstDashes + 1;
                contentEndIdx = lastDashes;
            }
        }
    }

    if (testStartIdx === -1) {
      console.warn(`Could not find test content start boundary in ${file}`);
      continue;
    }

    if (contentEndIdx === lines.length && postTestIdx !== -1) {
        // Find the `---` before postTestIdx
        for (let i = postTestIdx - 1; i > testStartIdx; i--) {
            if (lines[i].trim() === "---") {
                contentEndIdx = i;
                break;
            }
        }
        if (contentEndIdx === lines.length) {
            contentEndIdx = postTestIdx;
        }
    }

    let testContent = lines.slice(testStartIdx, contentEndIdx).join("\n");

    // Extract and preserve existing explicit tool coverage block if we didn't generate one
    if (!explicitToolsList) {
        const match = content.match(/### Explicit Tool Coverage Requirements[\s\S]*?(?=## Tasks|## Category|## Post-Test|## Execute Post-Test|$)/i);
        if (match) {
            explicitToolsList = match[0].trim();
        }
    }

    // Always remove existing explicit tool coverage block from testContent (it will be injected via template)
    testContent = testContent.replace(/### Explicit Tool Coverage Requirements[\s\S]*?(?=## Tasks|## Category|## Post-Test|## Execute Post-Test|$)/i, "");

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
