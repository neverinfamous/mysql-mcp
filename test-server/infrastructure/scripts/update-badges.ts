import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "../../..");

// Hoist strict mode check
const isStrict = Boolean(process.env.CI) || process.argv.includes("--strict");

function getBadgeColor(percentage: number): string {
  if (percentage >= 95) return "brightgreen";
  if (percentage >= 85) return "green";
  if (percentage >= 75) return "yellowgreen";
  if (percentage >= 65) return "yellow";
  if (percentage >= 50) return "orange";
  return "red";
}

function updateBadges() {
  const summaryPath = path.join(ROOT_DIR, ".test-output/coverage/coverage-summary.json");
  const playwrightPath = path.join(ROOT_DIR, ".test-output/playwright-results.json");

  let linesPct = 0;
  let coverageColor = "red";
  let hasCoverage = false;

  try {
    const summary = JSON.parse(fs.readFileSync(summaryPath, "utf-8"));
    linesPct = summary.total.lines.pct;
    coverageColor = getBadgeColor(linesPct);
    hasCoverage = true;
  } catch (err: any) {
    if (err.code === "ENOENT") {
      console.warn(`Coverage summary not found at ${summaryPath}`);
      if (isStrict) {
        console.error("Strict mode active: Failing because coverage summary is missing.");
        process.exit(1);
      }
    } else {
      throw err;
    }
  }

  let e2ePassing = 0;
  let e2eSkipped = 0;
  let hasE2e = false;

  try {
    const pw = JSON.parse(fs.readFileSync(playwrightPath, "utf-8"));
    e2ePassing = pw.stats.expected || 0;
    e2eSkipped = pw.stats.skipped || 0;
    hasE2e = true;
  } catch (err: any) {
    if (err.code === "ENOENT") {
      console.warn(`Playwright results not found at ${playwrightPath}`);
    } else {
      throw err;
    }
  }

  const covRegex = /!\[Coverage\]\(https:\/\/img\.shields\.io\/badge\/Coverage-[0-9.]+.*?\.svg\)/g;
  const newCovBadge = `![Coverage](https://img.shields.io/badge/Coverage-${linesPct}%25-${coverageColor}.svg)`;
  
  const e2eRegex = /!\[E2E\]\(https:\/\/img\.shields\.io\/badge\/E2E-[^)]+\)/g;
  const newE2eBadge = `![E2E](https://img.shields.io/badge/E2E-${e2ePassing}%20passing%20%C2%B7%20${e2eSkipped}%20skipped-blue.svg)`;

  const licenseRegex = /(\[!\[License: MIT\].*?\))/;
  const combinedBadge = `${newCovBadge} ${newE2eBadge}`;

  const filesToUpdate = ["README.md", "DOCKER_README.md"];
  const updatedFiles: string[] = [];

  for (const file of filesToUpdate) {
    const filePath = path.join(ROOT_DIR, file);
    
    let rawContent: string;
    try {
      rawContent = fs.readFileSync(filePath, "utf-8");
    } catch (err: any) {
      if (err.code === "ENOENT") {
        continue;
      }
      console.warn(`Skipped updating ${file}: File unreadable.`);
      continue;
    }

    // Normalize once at the beginning
    const originalNormalized = rawContent.replace(/\r\n/g, "\n");
    let content = originalNormalized;

    if (hasCoverage) {
      const replaced = content.replace(covRegex, newCovBadge);
      if (replaced !== content) {
        content = replaced;
        console.log(`Updated coverage badge in ${file} to ${linesPct}%`);
      } else {
        const withLicense = content.replace(licenseRegex, `$1 ${newCovBadge}`);
        if (withLicense !== content) {
          content = withLicense;
          console.log(`Inserted coverage badge in ${file} to ${linesPct}%`);
        } else {
          console.warn(`Could not find anchor to insert coverage badge in ${file}`);
          if (isStrict) {
            process.exit(1);
          }
        }
      }
    }

    if (hasE2e) {
      const replaced = content.replace(e2eRegex, newE2eBadge);
      if (replaced !== content) {
        content = replaced;
        console.log(`Updated E2E badge in ${file} to ${e2ePassing} passing, ${e2eSkipped} skipped`);
      } else {
        const replacedCombined = content.replace(newCovBadge, combinedBadge);
        if (replacedCombined !== content) {
          content = replacedCombined;
          console.log(`Inserted E2E badge in ${file}`);
        } else {
          const withLicense = content.replace(licenseRegex, `$1 ${newE2eBadge}`);
          if (withLicense !== content) {
            content = withLicense;
            console.log(`Inserted E2E badge in ${file}`);
          }
        }
      }
    }

    if (content !== originalNormalized) {
      fs.writeFileSync(filePath, content, "utf-8");
      updatedFiles.push(file);
    } else {
      console.log(`Badges in ${file} are already up-to-date or no changes were made.`);
    }
  }

  if (updatedFiles.length > 0) {
    console.log(`\nAuto-committing badge updates for: ${updatedFiles.join(", ")}`);
    const commitScript = path.join(ROOT_DIR, ".agents", "scripts", "commit.ts");
    const addArgs = [];
    for (const f of updatedFiles) {
      addArgs.push("--add");
      addArgs.push(f);
    }
    const args = [
      commitScript,
      "--msg", "chore(docs): update test badges",
      "--impact", "0.1",
      "--confidence", "1.0",
      "--validation", "none",
      "--no-history",
      ...addArgs
    ];
    
    try {
      execFileSync("bun", args, { stdio: "inherit", cwd: ROOT_DIR });
      console.log("Successfully auto-committed badge updates.");
    } catch (err: any) {
      console.error("Failed to auto-commit badge updates:", err.message || err);
      process.exit(1);
    }
  }
}

updateBadges();
