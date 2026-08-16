import fs from 'fs';
import path from 'path';
import { TOOL_GROUPS } from '../../src/filtering/tool-constants.js';
import { TEST_FILES } from './test-manifest.js';
import { DirectoryConfig, TestDirectory } from './lib/types.js';
import { toCodeModeName } from './lib/namespace-transform.js';
import { renderTestPrompt } from './lib/render-template.js';

const TEST_DIR = path.resolve('./test-server');

const DIRECTORY_CONFIGS: Record<TestDirectory, DirectoryConfig> = {
  "test-tool-groups": {
    titleType: "Tool Group Testing",
    executionMode: "Please conduct an exhaustive test of the tool group specified in the checklist below using live MCP server tool calls directly — not scripts/terminal.",
    coverageMatrixHeaders: ["Tool", "Direct Call (Happy Path)", "Domain Error", "Zod Empty Param", "Alias Acceptance"],
    commitScope: "tool-groups",
    useCodeModeNamespace: false,
  },
  "test-advanced": {
    titleType: "Advanced Stress Testing",
    executionMode: "Execute ALL tests below using ONLY code mode (`mysql_execute_code`). These are second-pass stress tests — basic checklists must pass first. Do not skip tests. Return an aggregated `failures` array.",
    coverageMatrixHeaders: ["Tool", "Code Mode (Happy Path)", "Code Mode (Domain Error/Zod Error)"],
    commitScope: "advanced",
    useCodeModeNamespace: true,
  },
  "test-usability": {
    titleType: "Usability & Hallucination Test",
    executionMode: "Organically test the tool group using ONLY code mode (`mysql_execute_code`), intentionally fuzzing the inputs to discover agent hallucinations, and permanently hardening the codebase against them.",
    coverageMatrixHeaders: ["Tool", "Fuzz Call", "Hallucination Found", "Fix Applied"],
    commitScope: "usability",
    useCodeModeNamespace: true,
  },
  "test-usability-direct": {
    titleType: "Direct Usability & Hallucination Test",
    executionMode: "Organically test the tool group using ONLY direct MCP tool calls, intentionally fuzzing the inputs to discover agent hallucinations, and permanently hardening the codebase against them.",
    coverageMatrixHeaders: ["Tool", "Fuzz Call", "Hallucination Found", "Fix Applied"],
    commitScope: "usability",
    useCodeModeNamespace: false,
  }
};

function validateSSoT() {
  const allValidTools = new Set(Object.values(TOOL_GROUPS).flat());
  
  for (const entry of TEST_FILES) {
    for (const tool of entry.tools) {
      if (!allValidTools.has(tool)) {
        throw new Error(`SSoT Validation Failed: Tool '${tool}' in file '${entry.filename}' does not exist in TOOL_GROUPS.`);
      }
    }
  }
}



function generateFiles() {
  for (const entry of TEST_FILES) {
    const dirConfig = DIRECTORY_CONFIGS[entry.directory];

    
    // Tools list
    const toolNames = dirConfig.useCodeModeNamespace
      ? entry.tools.map(t => toCodeModeName(t, entry.group))
      : entry.tools;
    
    // Schema Ref
    let schemaRef = `> See \`code-map.md\` in the \`test-server/\` directory for the complete test database schema, and \`tool-reference.md\` for the tool inventory. For strict tool input schemas, rely on the native MCP tool definitions or read \`src/adapters/mysql/schemas/\`.`;
    
    // Test Content & Tasks
    let testContent = "";
    if (entry.contentPartial) {
      const partialPath = path.join(TEST_DIR, 'scripts', 'content', entry.contentPartial);
      if (fs.existsSync(partialPath)) {
        testContent = fs.readFileSync(partialPath, 'utf-8').trim();
      } else {
        throw new Error(`Missing content partial: ${partialPath}`);
      }
    } else {
      testContent = ``;
    }

    // Add tasks
    const tasks = toolNames.map(t => `- [ ] Ensure full coverage for ${t}`).join('\n');
    if (testContent) {
        testContent += `\n\n## Tasks\n\n${tasks}\n`;
    } else {
        testContent = `## Tasks\n\n${tasks}\n`;
    }

    // Explicit Tools List
    let explicitToolsList = "";
    if (toolNames.length > 0) {
      explicitToolsList = `### Explicit Tool Coverage Requirements\n\n**CRITICAL**: You MUST rigorously test every single tool listed below in this test pass. Ensure that realistic data scenarios, edge cases, and all error paths are validated for each tool:\n\n` + toolNames.map(t => `- \`${t}\``).join("\n") + "\n";
    }

    // Execution Mode
    let executionMode = dirConfig.executionMode;
    let coverageMatrixHeaders = dirConfig.coverageMatrixHeaders;
    
    if (entry.executionModeOverride === 'sessions') {
      executionMode = "Execute the tool checklist using pure terminal HTTP endpoints (`curl` or `Invoke-RestMethod`). Do NOT use `mysql_execute_code`. Ensure the session ID works for multiple requests.";
      coverageMatrixHeaders = ["Tool", "HTTP Endpoint (Happy Path)", "HTTP Endpoint (Error)"];
    }

    // Coverage Matrix
    const emptyCols = Array(coverageMatrixHeaders.length - 1).fill("   ").join("|");
    const divider = "|" + Array(coverageMatrixHeaders.length).fill("---").join("|") + "|";
    const headerRow = "| " + coverageMatrixHeaders.join(" | ") + " |";
    const rows = toolNames.map(t => `| \`${t}\` |${emptyCols}|`);
    
    let coverageMatrix = "";
    if (toolNames.length > 0) {
      coverageMatrix = headerRow + "\n" + divider + "\n" + rows.join("\n");
    } else {
      coverageMatrix = headerRow + "\n" + divider;
    }

    // Render
    const rendered = renderTestPrompt({
      titleType: dirConfig.titleType,
      groupName: entry.group,
      executionMode,
      schemaRef,
      coverageMatrix,
      explicitToolsList,
      testContent,
      commitScope: dirConfig.commitScope,
    });

    const outPath = path.join(TEST_DIR, entry.directory, entry.filename);
    fs.writeFileSync(outPath, rendered);
  }
}

async function main() {
  validateSSoT();
  generateFiles();
  console.log("Tests generated successfully.");
}

main().catch(console.error);
