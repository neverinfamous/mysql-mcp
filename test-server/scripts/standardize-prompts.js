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

const getTemplate = (
  titleType,
  groupName,
  schemaRef,
  fileCleanup,
  testContent,
  executionMode,
  coverageMatrix
) => {
  return templateStr
    .replace("{{TITLE_TYPE}}", () => titleType)
    .replace("{{GROUP_NAME}}", () => groupName)
    .replace("{{SCHEMA_REF}}", () => schemaRef.trim())
    .replace("{{FILE_CLEANUP}}", () => fileCleanup)
    .replace("{{EXECUTION_MODE}}", () => executionMode)
    .replace("{{COVERAGE_MATRIX}}", () => coverageMatrix)
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
    const titleMatch = content.match(/# mysql-mcp .*: \[(.*?)\]/);
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
      executionMode = "Execute ALL tests below using ONLY code mode (`mysql_execute_code`). These are second-pass stress tests — basic checklists must pass first. Do not skip tests. Return an aggregated `failures` array.";
      coverageMatrix = "| Tool | Focus Area | Code Mode Validation |";
    } else if (dirName === "test-codemode") {
      titleType = "Code Mode Testing";
      executionMode = "Conduct an exhaustive test of the tool group listed below using ONLY code mode (`mysql_execute_code`). Ensure your validation script returns an aggregated array of failures if any exist. Group multiple tests into a single script to save context window tokens.";
      coverageMatrix = "| Tool | Code Mode (Happy Path) | Code Mode (Domain Error/Zod Error) |";
    }

    // Extract Schema Reference
    const schemaMatch = content.match(
      /## Test Database Schema([\s\S]*?)## (Testing Requirements|Structured Error|Reporting Format|Pre-requisites)/
    );
    let schemaRef =
      "> See `code-map.md` in the `test-server/` directory for the complete test database schema.";
    if (schemaMatch) {
      schemaRef = schemaMatch[1].trim();
    }

    const lines = content.split("\n");
    let testStartIdx = lines.findIndex(l => l.startsWith("## Group Focus:") || l.startsWith("## Category 1:"));
    
    if (testStartIdx === -1) {
        // Fallback for some files that might use different headers
        testStartIdx = lines.findIndex(l => l.startsWith("### " + groupName + " Group-Specific Testing") || l.startsWith("## Tests:"));
    }

    if (testStartIdx === -1) {
      console.warn(`Could not find test content start boundary in ${file}`);
      continue;
    }

    let postTestIdx = lines.findIndex(l => l.startsWith("## Post-Test"));
    let contentEndIdx = lines.length;

    if (postTestIdx !== -1) {
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

    const testContent = lines.slice(testStartIdx, contentEndIdx).join("\n");

    let fileCleanup = "";
    if (file.includes("admin") || file.includes("backup")) {
      fileCleanup = `- **Temporary files**: Delete any export/dump/backup artifacts from \`C:\\\\Users\\\\chris\\\\Desktop\\\\mysql-mcp\\\\tmp\``;
    }

    const newContent = getTemplate(
      titleType,
      groupName,
      schemaRef,
      fileCleanup,
      testContent,
      executionMode,
      coverageMatrix
    );
    fs.writeFileSync(filePath, newContent, "utf-8");
    console.log(`Standardized ${file} (${titleType})`);
  }
}

directories.forEach(processDirectory);
console.log("Standardization complete.");
