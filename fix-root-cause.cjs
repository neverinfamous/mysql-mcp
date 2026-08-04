const fs = require('fs');
const path = require('path');

const dirs = [
  "src/adapters/mysql/tools/performance",
  "src/adapters/mysql/tools/schema",
  "src/adapters/mysql/tools/security",
  "src/adapters/mysql/tools/shell",
  "src/adapters/mysql/tools/spatial",
  "src/adapters/mysql/tools/stats",
  "src/adapters/mysql/tools/sysschema",
  "src/adapters/mysql/tools/text",
  "src/adapters/mysql/tools/__tests__"
];

function getTestFiles(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    if (!fs.existsSync(filePath)) continue;
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getTestFiles(filePath));
    } else if (file.endsWith('.ts')) {
      results.push(filePath);
    }
  }
  return results;
}

const files = dirs.flatMap(getTestFiles);

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  // Remove the eslint-disable header we added
  if (content.startsWith("/* eslint-disable")) {
    content = content.replace(/\/\* eslint-disable.*?\*\/\n?/s, "");
    changed = true;
  }
  
  // Fix the empty import
  if (content.includes('import type {} from "../../mysql-adapter/index.js";')) {
    content = content.replace('import type {} from "../../mysql-adapter/index.js";', 'import type { MySQLAdapter } from "../../mysql-adapter/index.js";');
    changed = true;
  }
  
  if (content.match(/import type\s*\{\s*\}\s*from\s*"[^"]*mysql-adapter\/index\.js";/)) {
    content = content.replace(/(import type\s*\{)(\s*)(\}\s*from\s*"[^"]*mysql-adapter\/index\.js";)/g, "$1 MySQLAdapter $3");
    changed = true;
  }

  // Replace `const tool = tools.find(...)!` with `if (!tool) throw`
  const toolFindRegex = /(const\s+(\w+)\s*=\s*(?:await\s*)?.*?\.find\(.*?\))!/g;
  if (toolFindRegex.test(content)) {
    content = content.replace(toolFindRegex, "$1;\n      if (!$2) throw new Error('Tool not found');");
    changed = true;
  }
  
  if (content.includes("/* auto-fixed */")) {
    content = content.replace(/:\s*ReturnType<typeof createMockMySQLAdapter>; \/\* auto-fixed \*\//g, ": ReturnType<typeof createMockMySQLAdapter>;");
    changed = true;
  }
  
  if (content.includes("as unknown as any")) {
    content = content.replace(/as unknown as any/g, "as unknown");
    changed = true;
  }
  
  // For `let mockAdapter: any;` that was not fixed
  if (content.includes("let mockAdapter: any;")) {
    content = content.replace(/let mockAdapter: any;/g, "let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;");
    changed = true;
  }

  // For any `mockContext: any;`
  if (content.includes("let mockContext: any;")) {
    content = content.replace(/let mockContext: any;/g, "let mockContext: ReturnType<typeof createMockRequestContext>;");
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(file, content);
  }
}
console.log("Done fixing root cause");
