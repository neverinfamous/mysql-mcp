/**
 * Generates src/constants/instructions/*.ts from per-group markdown files.
 *
 * Reads instructions/markdown/*.md, escapes for template literals, and exports them
 * as constants in their respective .ts files.
 *
 * Usage: node scripts/generate-server-instructions.ts
 */

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const instructionsDir = resolve(projectRoot, "src/constants/instructions");
const mdDir = resolve(projectRoot, "src/constants/instructions/markdown");

/**
 * Escape content for use inside a JS/TS template literal.
 * Handles: backslashes, backticks, and template expressions (${).
 */
function escapeForTemplateLiteral(content: string): string {
  return content
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\$\{/g, "\\${");
}

// Ensure the target directory exists
try {
  readdirSync(instructionsDir);
} catch {
  // Directory might not exist or be empty, handled by existing repo structure
}

const mdFiles = readdirSync(mdDir).filter((f) => f.endsWith(".md"));

const BT = "`";

// Process base.ts separately as it contains the root instructions
const overviewContent = mdFiles.includes("overview.md")
  ? readFileSync(resolve(mdDir, "overview.md"), "utf-8").trim()
  : "";

if (overviewContent) {
  const baseTs = `export const INSTRUCTIONS = ${BT}${escapeForTemplateLiteral(overviewContent)}${BT};\n`;
  writeFileSync(resolve(instructionsDir, "base.ts"), baseTs, "utf-8");
  console.log("✅ Generated base.ts");
}

// Process other group files
for (const file of mdFiles) {
  if (file === "overview.md" || file.toLowerCase() === "readme.md") {
    continue;
  }

  const key = basename(file, ".md"); // "admin", "core", "stats", etc.
  const content = readFileSync(resolve(mdDir, file), "utf-8").trim();
  const escaped = escapeForTemplateLiteral(content);

  // e.g. "sysschema" -> "SYSSCHEMA_HELP", "gotchas" -> "GOTCHAS_HELP"
  const varName = `${key.replace(/-/g, '_').toUpperCase()}_HELP`;
  const tsContent = `export const ${varName} = ${BT}${escaped}${BT};\n`;

  writeFileSync(resolve(instructionsDir, `${key}.ts`), tsContent, "utf-8");
  console.log(`✅ Generated ${key}.ts`);
}

console.log("🎉 All instructions generated successfully.");
