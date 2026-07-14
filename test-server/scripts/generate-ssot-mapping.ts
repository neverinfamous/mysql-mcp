import fs from "fs";
import path from "path";
import { TOOL_GROUPS } from "../../src/filtering/tool-constants.js";
import { TEST_FILES } from "./test-manifest.js";

const outputPath = "C:\\Users\\chris\\.gemini\\antigravity\\brain\\ebcbc660-5584-48ea-83a2-97dba69f77de\\scratch\\ssot-mapping.md";

let md = "# SSoT Mapping: Tools and Test Files\n\n";

for (const [group, tools] of Object.entries(TOOL_GROUPS)) {
  md += `## Group: ${group}\n\n`;
  md += `### Tools\n`;
  for (const tool of tools) {
    md += `- ${tool}\n`;
  }
  md += `\n### Test Manifest Entries\n`;
  const groupFiles = TEST_FILES.filter(f => f.group === group);
  for (const f of groupFiles) {
    md += `- **${f.directory}/${f.filename}**: [${f.tools.join(", ")}]\n`;
  }
  md += `\n---\n\n`;
}

fs.writeFileSync(outputPath, md, "utf-8");
console.log(`SSoT mapping generated at ${outputPath}`);
