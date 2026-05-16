import fs from "fs";
import path from "path";

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach((f) => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      if (f !== "__tests__") walkDir(dirPath, callback);
    } else if (f.endsWith(".ts")) {
      callback(dirPath);
    }
  });
}

let modified = 0;

walkDir(path.join("src", "adapters", "mysql", "tools"), (filePath) => {
  let content = fs.readFileSync(filePath, "utf8");
  if (!content.includes("annotations: {")) return;

  let newContent = content;
  let importsNeeded = new Set();

  newContent = newContent.replace(
    /annotations:\s*\{([^}]+)\}/g,
    (match, body) => {
      if (
        body.includes("openWorldHint: true") ||
        body.includes("openWorldHint: false")
      ) {
        return match;
      }

      if (body.includes("readOnlyHint: true")) {
        importsNeeded.add("READ_ONLY");
        return "annotations: READ_ONLY";
      }
      if (body.includes("destructiveHint: true")) {
        importsNeeded.add("DESTRUCTIVE");
        return "annotations: DESTRUCTIVE";
      }
      if (body.includes("idempotentHint: true")) {
        importsNeeded.add("IDEMPOTENT");
        return "annotations: IDEMPOTENT";
      }
      if (body.includes("readOnlyHint: false")) {
        importsNeeded.add("WRITE");
        return "annotations: WRITE";
      }

      importsNeeded.add("READ_ONLY");
      return "annotations: READ_ONLY";
    },
  );

  if (importsNeeded.size > 0 && newContent !== content) {
    let depth = filePath.split(path.sep).length;
    let up = "";
    for (let i = 0; i < depth - 2; i++) up += "../";

    let importStr = `import { ${Array.from(importsNeeded).join(", ")} } from "${up}utils/annotations.js";\n`;

    let lastImportEnd = -1;
    let importRegex = /import\s+[\s\S]*?from\s+['"][^'"]+['"];?/g;
    let matchImport;
    while ((matchImport = importRegex.exec(newContent)) !== null) {
      lastImportEnd = matchImport.index + matchImport[0].length;
    }

    if (lastImportEnd !== -1) {
      newContent =
        newContent.slice(0, lastImportEnd) +
        "\n" +
        importStr +
        newContent.slice(lastImportEnd);
    } else {
      newContent = importStr + "\n" + newContent;
    }

    fs.writeFileSync(filePath, newContent);
    console.log(`Updated ${filePath}`);
    modified++;
  }
});

console.log(`Total files modified: ${modified}`);
