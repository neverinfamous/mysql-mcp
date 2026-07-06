import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const cliPath = join(__dirname, "../dist/cli.js");

async function verify() {
  const env = { ...process.env };
  if (!env.MYSQL_HOST) env.MYSQL_HOST = "127.0.0.1";
  if (!env.MYSQL_USER) env.MYSQL_USER = "root";
  if (!env.MYSQL_PASSWORD) env.MYSQL_PASSWORD = "root";
  if (!env.MYSQL_DATABASE) env.MYSQL_DATABASE = "testdb";
  if (!env.MYSQL_PORT) env.MYSQL_PORT = "3307";

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [cliPath, "--tool-filter", "all"],
    env,
  });

  const client = new Client(
    {
      name: "test-client",
      version: "1.0.0",
    },
    {
      capabilities: {},
    },
  );

  await client.connect(transport);

  // Use pagination to get all tools
  let tools = [];
  let cursor;
  do {
    const res = await client.listTools({ cursor });
    tools = tools.concat(res.tools);
    cursor = res.nextCursor;
  } while (cursor);

  // Check if tools have the non-standard outputSchema property
  const missing = tools
    .filter((t) => !("outputSchema" in t))
    .map((t) => t.name);

  if (missing.length === 0) {
    console.log(
      `SUCCESS: All ${tools.length} standard tools have outputSchema defined on the protocol level.`,
    );
    process.exit(0);
  } else {
    console.error(
      `FAILED: The following tools are missing outputSchema:`,
      missing,
    );
    process.exit(1);
  }
}

verify().catch((err) => {
  console.error(err);
  process.exit(1);
});
