import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "../../..");

const CONFIG = {
  coverageSummaryPath: path.join(ROOT_DIR, ".test-output/coverage/coverage-summary.json"),
  playwrightPath: path.join(ROOT_DIR, ".test-output/playwright-results.json"),
  filesToUpdate: ["README.md", "DOCKER_README.md"],
  licenseLineRegex: /^(.*(?:\[)?!\[License: MIT\].*?\)(?:\]\(.*?\))?).*$/m,
  defaultColor: "red" as const,
  commit: {
    msg: "chore(docs): update test badges",
    impact: "0.1",
    confidence: "1.0",
    validation: "none"
  }
};

const isStrict = Boolean(process.env.CI) || process.argv.includes("--strict");

function getBadgeColor(percentage: number): string {
  if (percentage >= 95) return "brightgreen";
  if (percentage >= 85) return "green";
  if (percentage >= 75) return "yellowgreen";
  if (percentage >= 65) return "yellow";
  if (percentage >= 50) return "orange";
  return CONFIG.defaultColor;
}

interface CoverageSummary {
  total?: { lines?: { pct?: number } };
}

interface PlaywrightSummary {
  stats?: { expected?: number; skipped?: number };
}

function readJsonFileSafe<T>(filePath: string): T | null {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && (error as any).code === "ENOENT") {
      console.warn(`File not found at ${filePath}`);
      return null;
    }
    throw error;
  }
}

function autoCommit(updatedFiles: string[]) {
  if (updatedFiles.length === 0) return;
  
  if (isStrict) {
    throw new Error(`Strict mode active: Failing because badges are out of date in the following files: ${updatedFiles.join(", ")}. Please run 'pnpm run check' locally and commit the updated badges.`);
  }

  console.log(`\nAuto-committing badge updates for: ${updatedFiles.join(", ")}`);
  const commitScript = path.join(ROOT_DIR, ".agents", "scripts", "commit.ts");
  const addArgs = updatedFiles.flatMap(f => ["--add", f]);
  const args = [
    commitScript,
    "--msg", CONFIG.commit.msg,
    "--impact", CONFIG.commit.impact,
    "--confidence", CONFIG.commit.confidence,
    "--validation", CONFIG.commit.validation,
    "--no-history",
    ...addArgs
  ];
  
  execFileSync("bun", args, { stdio: "inherit", cwd: ROOT_DIR });
  console.log("Successfully auto-committed badge updates.");
}

function updateBadges(): string[] {
  let linesPct = 0;
  let coverageColor = CONFIG.defaultColor;
  let hasCoverage = false;

  const summary = readJsonFileSafe<CoverageSummary>(CONFIG.coverageSummaryPath);
  if (summary) {
    if (typeof summary.total?.lines?.pct === 'number') {
      linesPct = summary.total.lines.pct;
      coverageColor = getBadgeColor(linesPct);
      hasCoverage = true;
    } else {
      console.warn("Coverage summary has invalid schema.");
    }
  } else if (isStrict) {
      throw new Error("Strict mode active: Failing because coverage summary is missing.");
  }

  let e2ePassing = 0;
  let e2eSkipped = 0;
  let hasE2e = false;

  const pw = readJsonFileSafe<PlaywrightSummary>(CONFIG.playwrightPath);
  if (pw) {
    if (pw.stats) {
      e2ePassing = pw.stats.expected || 0;
      e2eSkipped = pw.stats.skipped || 0;
      hasE2e = true;
    } else {
      console.warn("Playwright results have invalid schema.");
    }
  }

    const newCovBadge = `![Coverage](https://img.shields.io/badge/Coverage-${linesPct}%25-${coverageColor}.svg)`;
    const newE2eBadge = hasE2e ? `![E2E](https://img.shields.io/badge/E2E-${e2ePassing}%20passing%20%C2%B7%20${e2eSkipped}%20skipped-blue.svg)` : "";

    const updatedFiles: string[] = [];

    for (const file of CONFIG.filesToUpdate) {
      const filePath = path.join(ROOT_DIR, file);
      
      let rawContent: string;
      try {
        rawContent = fs.readFileSync(filePath, "utf-8");
      } catch (error: unknown) {
        if (error instanceof Error && 'code' in error && (error as any).code === "ENOENT") {
          console.warn(`Skipped updating ${file}: File unreadable (ENOENT).`);
          continue;
        }
        throw error;
      }

      const originalNormalized = rawContent.replace(/\r\n/g, "\n");
      
      let fileHasE2e = hasE2e;
      let fileE2eBadge = newE2eBadge;

      // If Playwright results are missing, preserve the existing E2E badge in the file
      if (!fileHasE2e) {
        const e2eMatch = originalNormalized.match(/!\[E2E\]\(https:\/\/img\.shields\.io\/badge\/E2E-[^)]+\)/);
        if (e2eMatch) {
          fileHasE2e = true;
          fileE2eBadge = e2eMatch[0];
        }
      }

      const newBadges: string[] = [];
      if (hasCoverage) newBadges.push(newCovBadge);
      if (fileHasE2e) newBadges.push(fileE2eBadge);
      const badgeString = newBadges.join(" ");

      let content = originalNormalized;
    
    if (badgeString.length > 0) {
       if (CONFIG.licenseLineRegex.test(content)) {
         const replaced = content.replace(CONFIG.licenseLineRegex, `$1 ${badgeString}`);
         if (replaced !== content) {
           content = replaced;
           console.log(`Successfully updated badges in ${file}`);
         } else {
           console.log(`Badges in ${file} are already up-to-date.`);
         }
       } else {
         console.warn(`Could not find anchor line to update badges in ${file}`);
         if (isStrict) {
           throw new Error(`Failed to find badge anchor line in ${file}`);
         }
       }
    }

    if (content !== originalNormalized) {
      const eol = rawContent.includes("\r\n") ? "\r\n" : "\n";
      const eolRestored = content.replace(/\n/g, eol);
      fs.writeFileSync(filePath, eolRestored, "utf-8");
      updatedFiles.push(file);
    } else {
      console.log(`Badges in ${file} are already up-to-date or no changes were made.`);
    }
  }

  return updatedFiles;
}

function main() {
  try {
    const updatedFiles = updateBadges();
    autoCommit(updatedFiles);
  } catch (error: unknown) {
    console.error("Fatal error during badge update:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
