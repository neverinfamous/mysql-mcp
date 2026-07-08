import fs from "fs";
import path from "path";

function findFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      findFiles(filePath, fileList);
    } else if (filePath.endsWith(".spec.ts")) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const files = findFiles("tests/e2e");

for (const file of files) {
  let content = fs.readFileSync(file, "utf8");

  content = content.replace(/\.data as Record<string, unknown>/g, " as Record<string, unknown>");
  content = content.replace(/\.data\?/g, "?");
  content = content.replace(/\.data\./g, ".");
  content = content.replace(/expect\(parsed\.data\)/g, "expect(parsed)");
  content = content.replace(/expect\(payload\.data\)/g, "expect(payload)");
  content = content.replace(/payload\.data as/g, "payload as");
  content = content.replace(/result\.data as/g, "result as");

  fs.writeFileSync(file, content, "utf8");
}
console.log("Replaced .data across test files");
