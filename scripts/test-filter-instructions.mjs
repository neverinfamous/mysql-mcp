/**
 * Integration Test: Filtered Instructions + Help Resources
 *
 * Starts the server with various --tool-filter configs and verifies:
 * 1. Instructions are slim (within client limits)
 * 2. mysql://help resources are registered based on tool filter
 * 3. Group-specific help resources are only registered for enabled groups
 *
 * Usage:
 *   npm run build
 *   node scripts/test-filter-instructions.mjs
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
 * Start server, send initialize + resources/list, return results
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
    let instructions = "";
    let resourceUris = [];
    let gotInitialize = false;

    proc.stdout.on("data", (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop(); // Keep incomplete line

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const msg = JSON.parse(trimmed);

          // Response to initialize (id=1)
          if (msg.id === 1 && msg.result) {
            instructions =
              msg.result?.serverInfo?.instructions ||
              msg.result?.instructions ||
              msg.result?.capabilities?.instructions ||
              "";
            gotInitialize = true;

            // Send resources/list
            proc.stdin.write(
              JSON.stringify({
                jsonrpc: "2.0",
                id: 2,
                method: "resources/list",
                params: {},
              }) + "\n",
            );
          }

          // Response to resources/list (id=2)
          if (msg.id === 2 && msg.result) {
            const resources = msg.result.resources || [];
            resourceUris = resources.map((r) => r.uri);
            proc.kill();
            resolve({
              instructions,
              instructionChars: instructions.length,
              resourceUris,
            });
          }
        } catch {
          // Not complete JSON yet
        }
      }
    });

    proc.stderr.on("data", () => {});

    // Send initialize request
    proc.stdin.write(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "help-resource-test", version: "1.0" },
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

  // ── Test 1: Slim Instructions ──
  console.log("=== Test 1: Slim Instructions (No Filters) ===\n");

  const baseResult = await testServer([]);
  console.log(`  Instruction chars: ${baseResult.instructionChars}`);
  console.log(
    `  Token estimate: ~${Math.round(baseResult.instructionChars / 4)}`,
  );

  const isSlim = baseResult.instructionChars < 2500;
  console.log(`  Under 2500 chars: ${isSlim ? "✅" : "❌"}`);
  if (!isSlim) allPassed = false;

  const hasHelpPointer = baseResult.instructions.includes("mysql://help");
  console.log(
    `  Contains mysql://help pointer: ${hasHelpPointer ? "✅" : "❌"}`,
  );
  if (!hasHelpPointer) allPassed = false;

  // ── Test 2: Core-only Filter ──
  console.log("\n=== Test 2: Core-only Filter (--tool-filter core,-codemode) ===\n");

  const coreResult = await testServer(["--tool-filter", "core,-codemode"]);
  const coreHelpUris = coreResult.resourceUris.filter((u) =>
    u.startsWith("mysql://help"),
  );
  console.log(`  Help resources: ${coreHelpUris.join(", ") || "(none)"}`);

  const coreHasBaseHelp = coreHelpUris.includes("mysql://help");
  console.log(`  Has mysql://help: ${coreHasBaseHelp ? "✅" : "❌"}`);
  if (!coreHasBaseHelp) allPassed = false;

  const coreHasCoreHelp = coreHelpUris.includes("mysql://help/core");
  console.log(`  Has mysql://help/core: ${coreHasCoreHelp ? "✅" : "❌"}`);
  if (!coreHasCoreHelp) allPassed = false;

  const coreNoOtherGroupHelp = coreHelpUris.length === 2;
  console.log(
    `  No other group-specific help: ${coreNoOtherGroupHelp ? "✅" : "❌"} (count: ${coreHelpUris.length})`,
  );
  if (!coreNoOtherGroupHelp) allPassed = false;

  // ── Test 3: Stats Filter ──
  console.log("\n=== Test 3: Stats Filter (--tool-filter stats,-codemode) ===\n");

  const statsResult = await testServer(["--tool-filter", "stats,-codemode"]);
  const statsHelpUris = statsResult.resourceUris.filter((u) =>
    u.startsWith("mysql://help"),
  );
  console.log(`  Help resources: ${statsHelpUris.join(", ")}`);

  const statsHasBaseHelp = statsHelpUris.includes("mysql://help");
  const statsHasStatsHelp = statsHelpUris.includes("mysql://help/stats");
  console.log(`  Has mysql://help: ${statsHasBaseHelp ? "✅" : "❌"}`);
  console.log(`  Has mysql://help/stats: ${statsHasStatsHelp ? "✅" : "❌"}`);
  if (!statsHasBaseHelp || !statsHasStatsHelp) allPassed = false;

  const statsNoJsonHelp = !statsHelpUris.includes("mysql://help/json");
  console.log(`  No mysql://help/json: ${statsNoJsonHelp ? "✅" : "❌"}`);
  if (!statsNoJsonHelp) allPassed = false;

  // ── Test 4: Multi-group Filter ──
  console.log(
    "\n=== Test 4: Multi-group Filter (--tool-filter core,json,text,stats,-codemode) ===\n",
  );

  const multiResult = await testServer([
    "--tool-filter",
    "core,json,text,stats,-codemode",
  ]);
  const multiHelpUris = multiResult.resourceUris.filter((u) =>
    u.startsWith("mysql://help"),
  );
  console.log(`  Help resources: ${multiHelpUris.join(", ")}`);

  const expectedMulti = [
    "mysql://help",
    "mysql://help/core",
    "mysql://help/json",
    "mysql://help/text",
    "mysql://help/stats",
  ];
  for (const uri of expectedMulti) {
    const found = multiHelpUris.includes(uri);
    console.log(`  Has ${uri}: ${found ? "✅" : "❌"}`);
    if (!found) allPassed = false;
  }

  const multiNoSpatial = !multiHelpUris.includes("mysql://help/spatial");
  console.log(`  No mysql://help/spatial: ${multiNoSpatial ? "✅" : "❌"}`);
  if (!multiNoSpatial) allPassed = false;

  // ── Test 5: Full Filter ──
  console.log("\n=== Test 5: Full Filter (--tool-filter full) ===\n");

  const fullResult = await testServer(["--tool-filter", "full"]);
  const fullHelpUris = fullResult.resourceUris.filter((u) =>
    u.startsWith("mysql://help"),
  );
  console.log(
    `  Help resources (${fullHelpUris.length}): ${fullHelpUris.join(", ")}`,
  );

  const expectedFull = [
    "mysql://help",
    "mysql://help/core",
    "mysql://help/json",
    "mysql://help/transactions",
    "mysql://help/text",
    "mysql://help/fulltext",
    "mysql://help/stats",
    "mysql://help/spatial",
    "mysql://help/admin",
    "mysql://help/monitoring",
    "mysql://help/performance",
    "mysql://help/optimization",
    "mysql://help/backup",
    "mysql://help/replication",
    "mysql://help/partitioning",
    "mysql://help/schema",
    "mysql://help/introspection",
    "mysql://help/migration",
    "mysql://help/events",
    "mysql://help/sysschema",
    "mysql://help/security",
    "mysql://help/roles",
    "mysql://help/docstore",
    "mysql://help/cluster",
    "mysql://help/proxysql",
    "mysql://help/router",
    "mysql://help/shell",
    "mysql://help/vector"
  ];
  const fullHasAll = expectedFull.length === fullHelpUris.length && expectedFull.every((u) => fullHelpUris.includes(u));
  console.log(`  Has expected help resources: ${fullHasAll ? "✅" : "❌"}`);
  if (!fullHasAll) allPassed = false;

  // ── Summary ──
  console.log(
    `\n=== Overall: ${allPassed ? "✅ ALL PASSED" : "❌ FAILURES"} ===`,
  );
  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
