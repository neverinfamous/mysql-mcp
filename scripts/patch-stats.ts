import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATS_DIR = path.join(__dirname, "../src/adapters/mysql/tools/stats");

function processFile(filePath: string) {
  let content = fs.readFileSync(filePath, "utf-8");

  // import validators if needed
  if (content.includes("throw new ValidationError") && !content.includes("validateQualifiedIdentifier")) {
    let importDepth = "../../../../../";
    if (filePath.includes("window") || filePath.includes("descriptive") || filePath.includes("comparative")) {
      importDepth = "../../../../../";
    } else {
      importDepth = "../../../../";
    }
    
    // Add imports to the top of the file.
    content = content.replace(
      /import { ValidationError } from "(.*?)";/,
      `import { ValidationError } from "$1";\nimport { validateQualifiedIdentifier, validateIdentifier, escapeQualifiedTable } from "${importDepth}utils/validators.js";`
    );

    // Update table validation
    content = content.replace(
      /if \(!\/\^\[a-zA-Z_\]\[a-zA-Z0-9_\]\*\$\/.test\(table\)\) {\s*throw new ValidationError\("Invalid table name"\);\s*}/g,
      `validateQualifiedIdentifier(table, "table");`
    );
    // Update the other variant in advanced.ts / outlier.ts / hypothesis.ts
    content = content.replace(
      /if \(!\/\^\[a-zA-Z0-9_\]\+\(\\\\.\[a-zA-Z0-9_\]\+\)\?\$\/.test\(table\)\) {\s*throw new ValidationError\("Invalid table name"\);\s*}/g,
      `validateQualifiedIdentifier(table, "table");`
    );

    // Update column validations
    content = content.replace(
      /if \(!\/\^\[a-zA-Z_\]\[a-zA-Z0-9_\]\*\$\/.test\(column\)\) {\s*throw new ValidationError\("Invalid column name"\);\s*}/g,
      `validateIdentifier(column, "column");`
    );
    content = content.replace(
      /if \(\s*!\/\^\[a-zA-Z_\]\[a-zA-Z0-9_\]\*\$\/.test\(column1\) \|\|\s*!\/\^\[a-zA-Z_\]\[a-zA-Z0-9_\]\*\$\/.test\(column2\)\s*\) {\s*throw new ValidationError\("Invalid column name"\);\s*}/g,
      `validateIdentifier(column1, "column");\n        validateIdentifier(column2, "column");`
    );
    content = content.replace(
      /if \(\s*!\/\^\[a-zA-Z_\]\[a-zA-Z0-9_\]\*\$\/.test\(valueColumn\) \|\|\s*!\/\^\[a-zA-Z_\]\[a-zA-Z0-9_\]\*\$\/.test\(timeColumn\)\s*\) {\s*throw new ValidationError\("Invalid column name"\);\s*}/g,
      `validateIdentifier(valueColumn, "column");\n        validateIdentifier(timeColumn, "column");`
    );
    content = content.replace(
      /if \(!\/\^\[a-zA-Z_\]\[a-zA-Z0-9_\]\*\$\/.test\(timeColumn\)\) {\s*throw new ValidationError\("Invalid column name"\);\s*}/g,
      `validateIdentifier(timeColumn, "column");`
    );

    // Update `table` everywhere to escapeQualifiedTable(table)
    content = content.replace(/\\\`\$\{table\}\\\`/g, '${escapeQualifiedTable(table)}');
    content = content.replace(/'\$\{table\}'/g, '${escapeQualifiedTable(table)}');
    
    fs.writeFileSync(filePath, content, "utf-8");
  }
}

function traverse(dir: string) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "__tests__") continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      traverse(fullPath);
    } else if (entry.isFile() && fullPath.endsWith(".ts")) {
      processFile(fullPath);
    }
  }
}

traverse(STATS_DIR);
console.log("Stats tools patched.");
