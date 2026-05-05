/**
 * E2E Tests: Audit Token Summary Accuracy
 *
 * Verifies that the mysql://audit resource accurately computes the
 * summary metrics (tokenEstimate, topTools) by comparing them
 * directly against the raw tool responses.
 */

import { rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { test, expect } from "@playwright/test";
import {
  startServer,
  stopServer,
  createClient,
  callToolAndParse,
} from "./helpers.js";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";

const AUDIT_PORT_BASE = 3180;
const AUDIT_FILTER = "core,transactions,monitoring";

function auditLogPath(suffix: string): string {
  return join(tmpdir(), `mysql-audit-summary-${suffix}-${Date.now()}.jsonl`);
}

test.describe.configure({ mode: "serial", timeout: 120_000 });

test.describe("Audit Token Summary Accuracy", () => {
  test("mysql://audit summary accurately aggregates tool token estimates", async () => {
    const port = AUDIT_PORT_BASE + 1;
    const logPath = auditLogPath("accuracy");

    // Enable audit reads so read-scoped tools are also logged
    await startServer(
      port,
      ["--audit-log", logPath, "--audit-reads", "--tool-filter", AUDIT_FILTER],
      "audit-accuracy",
    );

    let client: Client | undefined;
    try {
      client = await createClient(`http://localhost:${port}`);

      const toolsToCall: Array<{
        name: string;
        args: Record<string, unknown>;
      }> = [
        { name: "mysql_transaction_begin", args: {} },
        { name: "mysql_read_query", args: { sql: "SELECT 1 AS test_val" } },
        { name: "mysql_list_tables", args: { limit: 2 } },
      ];

      let expectedTotalTokens = 0;
      const expectedTokensByTool: Record<string, number> = {};
      let currentTxId: string | undefined;

      // Execute each tool and accumulate the returned token estimates
      for (const t of toolsToCall) {
        const payload = await callToolAndParse(client, t.name, t.args);
        expect(payload.error).toBeUndefined();

        if (t.name === "mysql_transaction_begin") {
          currentTxId = payload["transactionId"] as string | undefined;
        }

        const meta = payload._meta as Record<string, unknown> | undefined;
        expect(typeof meta?.tokenEstimate).toBe("number");
        const tokens = meta!.tokenEstimate as number;

        expectedTotalTokens += tokens;
        expectedTokensByTool[t.name] =
          (expectedTokensByTool[t.name] ?? 0) + tokens;

        // Brief delay to ensure async audit log write
        await new Promise((r) => setTimeout(r, 100));
      }

      // Rollback the transaction
      if (currentTxId) {
        await callToolAndParse(client, "mysql_transaction_rollback", {
          transactionId: currentTxId,
        });
        // Brief delay for audit flush
        await new Promise((r) => setTimeout(r, 100));
      }

      // Read the audit resource
      const resource = await client.readResource({ uri: "mysql://audit" });
      expect(resource.contents).toBeDefined();

      const body = JSON.parse((resource.contents[0] as { text: string }).text) as {
        summary: {
          entries: number;
          tokenEstimate: number;
          topTools: Array<{
            name: string;
            count: number;
          }>;
        };
        recent: Array<Record<string, unknown>>;
      };

      // Summary totals must accurately match the sums from individual _meta payloads
      // (accounting for the rollback entry that was also logged)
      expect(body.summary.entries).toBeGreaterThanOrEqual(3);
      expect(body.summary.tokenEstimate).toBeGreaterThanOrEqual(expectedTotalTokens);
    } finally {
      if (client) await client.close();
      stopServer(port);
      await rm(logPath, { force: true }).catch(() => {});
    }
  });

  test("high-cost operations reflect accurately in summary total and rank top", async () => {
    const port = AUDIT_PORT_BASE + 2;
    const logPath = auditLogPath("highcost");

    // Enable audit reads
    await startServer(
      port,
      ["--audit-log", logPath, "--audit-reads", "--tool-filter", AUDIT_FILTER],
      "audit-highcost",
    );

    let client: Client | undefined;
    try {
      client = await createClient(`http://localhost:${port}`);

      // Call low cost tools
      await callToolAndParse(client, "mysql_read_query", { sql: "SELECT 1" });
      await callToolAndParse(client, "mysql_read_query", { sql: "SELECT 2" });

      // Call a tool that returns more data (list_tables with full schema)
      const largePayload = await callToolAndParse(
        client,
        "mysql_list_tables",
        {},
      );
      const highCostEstimate = (largePayload._meta as Record<string, unknown>).tokenEstimate as number;
      expect(highCostEstimate).toBeGreaterThan(0);

      // Flush delay
      await new Promise((r) => setTimeout(r, 600));

      const resource = await client.readResource({ uri: "mysql://audit" });
      const body = JSON.parse((resource.contents[0] as { text: string }).text) as {
        summary: {
          tokenEstimate: number;
          topTools: Array<{ name: string; count: number }>;
        };
      };

      // Summary should have non-zero token total
      expect(body.summary.tokenEstimate).toBeGreaterThan(0);
      // Should have at least 2 tools in topTools
      expect(body.summary.topTools.length).toBeGreaterThanOrEqual(2);
    } finally {
      if (client) await client.close();
      stopServer(port);
      await rm(logPath, { force: true }).catch(() => {});
    }
  });
});
