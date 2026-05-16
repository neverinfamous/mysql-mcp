/**
 * Integration Test: Filtered Instructions
 *
 * Starts the server with different --tool-filter values and verifies that
 * filtered instructions are shorter than unfiltered and contain/exclude
 * the expected sections.
 *
 * Usage:
 *   npm run build
 *   node scripts/test-instruction-levels.mjs
 *
 * Requires: MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE env vars
 */

import { spawn } from "child_process";

const PROJECT_DIR = "C:\\Users\\chris\\Desktop\\mysql-mcp";

// Ensure DB connection env vars are present (inherit from shell or use Docker defaults)
if (!process.env.MYSQL_HOST) process.env.MYSQL_HOST = "127.0.0.1";
if (!process.env.MYSQL_USER) process.env.MYSQL_USER = "root";
if (!process.env.MYSQL_PASSWORD) process.env.MYSQL_PASSWORD = "root";
if (!process.env.MYSQL_DATABASE) process.env.MYSQL_DATABASE = "testdb";

/**
 * Start server with given args, send initialize, return instruction text
 */
function testServer(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      "node",
      ["dist/cli.js", "--log-level", "error", ...args],
      {
        cwd: PROJECT_DIR,
        stdio: ["pipe", "pipe", "pipe"],
      },
    );

    let buffer = "";
    proc.stdout.on("data", (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const msg = JSON.parse(trimmed);
          if (msg.id === 1 && msg.result) {
            const instructions =
              msg.result?.serverInfo?.instructions ||
              msg.result?.instructions ||
              "";
            const capInstructions =
              msg.result?.capabilities?.instructions || "";
            const text = instructions || capInstructions;

            proc.kill();
            resolve({
              charCount: text.length,
              tokenEstimate: Math.round(text.length / 4),
              text,
            });
          }
        } catch {
          // Not complete JSON yet
        }
      }
    });

    proc.stderr.on("data", () => {});

    proc.stdin.write(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "instruction-test", version: "1.0" },
        },
      }) + "\n",
    );

    setTimeout(() => {
      proc.kill();
      reject(new Error(`Timeout for args: ${args.join(" ")}`));
    }, 15000);
  });
}

async function main() {
  let allPassed = true;

  console.log("=== Test 1: Filtered Instructions (--tool-filter) ===\n");

  const fullAll = await testServer([]);
  console.log(
    `  all groups: ${fullAll.charCount} chars (~${fullAll.tokenEstimate} tokens)`,
  );

  const coreOnly = await testServer(["--tool-filter", "core"]);
  console.log(
    `  core only:  ${coreOnly.charCount} chars (~${coreOnly.tokenEstimate} tokens)`,
  );

  const filterReduced = coreOnly.charCount < fullAll.charCount;
  const savings = fullAll.charCount - coreOnly.charCount;
  const pct = ((savings / fullAll.charCount) * 100).toFixed(1);
  console.log(
    `\n  Filtered < unfiltered: ${filterReduced ? "✅" : "❌"} (saved ${savings} chars, ${pct}%)`,
  );
  if (!filterReduced) allPassed = false;

  const shouldExclude = [
    "help/json",
    "help/fulltext",
    "help/docstore",
    "help/spatial",
    "help/stats",
    "help/proxysql",
    "help/shell",
    "help/security",
  ];
  for (const section of shouldExclude) {
    const found = coreOnly.text.includes(section);
    console.log(`  Excludes "${section}": ${found ? "❌ FOUND" : "✅"}`);
    if (found) allPassed = false;
  }

  // Always-include sections (Core and Code Mode since it's auto-injected for whitelist)
  const shouldInclude = ["Quick Reference", "mysql.core.help()"];
  for (const section of shouldInclude) {
    const found = coreOnly.text.includes(section);
    console.log(`  Includes "${section}": ${found ? "✅" : "❌ MISSING"}`);
    if (!found) allPassed = false;
  }

  console.log(
    `\n=== Overall: ${allPassed ? "✅ ALL PASSED" : "❌ FAILURES"} ===`,
  );
  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
