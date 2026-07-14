import fs from "fs";
import path from "path";
import { TEST_FILES } from "./test-manifest.js";

const manifestPath = path.join(process.cwd(), "test-server", "scripts", "test-manifest.ts");
const contentDir = path.join(process.cwd(), "test-server", "scripts", "content");

// 1. Filter out test-advanced entries that have NO contentPartial
const cleanedFiles = TEST_FILES.filter(f => {
  if (f.directory === "test-advanced" && !f.contentPartial) {
    console.log(`Removing hallucinated boilerplate: ${f.filename}`);
    return false;
  }
  return true;
});

// 2. Populate empty tool arrays for test-advanced entries with contentPartials
for (const f of cleanedFiles) {
  if (f.directory === "test-advanced" && f.contentPartial) { // Always repopulate
    const partialPath = path.join(contentDir, f.contentPartial);
    if (fs.existsSync(partialPath)) {
      const content = fs.readFileSync(partialPath, "utf-8");
      // Extract all mysql_ tools mentioned in the partial (FIXED REGEX)
      const toolMatches = content.match(/mysql_[a-z0-9_]+/gi) || [];
      const uniqueTools = Array.from(new Set(toolMatches));
      
      // Filter out invalid names that might have been matched
      const validTools = uniqueTools.filter(t => !t.endsWith('_') && t !== 'mysql_execute_code');
      
      f.tools = [...validTools, "mysql_execute_code"];
      console.log(`Populated tools for ${f.filename}:`, f.tools);
    }
  }
}

// 3. Write back to test-manifest.ts
let outputContent = `import type { TestDirectory } from "./lib/types.js";

export interface TestFileEntry {
  filename: string;
  directory: TestDirectory;
  group: string;
  tools: string[];
  contentPartial?: string;
  executionModeOverride?: string;
}

export const TEST_FILES: TestFileEntry[] = ${JSON.stringify(cleanedFiles, null, 2)};
`;

fs.writeFileSync(manifestPath, outputContent, "utf-8");
console.log("Successfully applied audit fixes to test-manifest.ts!");
