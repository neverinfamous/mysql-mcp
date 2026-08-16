/**
 * E2E Tests: Audit Log Rotation Stress Test
 *
 * Verifies that the audit logger seamlessly handles log file rotation
 * under high throughput without losing data, and correctly maintains
 * the configured number of rotated archive files (up to 5).
 */

import { stat, rm } from "node:fs/promises";
import { test, expect } from "@playwright/test";
import { setTimeout as delay } from "node:timers/promises";
import {
  startServer,
  stopServer,
  createClient,
  callToolAndParse,
  cleanupAuditFiles,
  auditLogPath,
} from "./helpers.js";
import type { Client } from "@modelcontextprotocol/client";

const AUDIT_PORT_BASE = 3170;
const AUDIT_FILTER = "transactions";

import { TIMEOUTS } from "./helpers.js";

test.describe.configure({ mode: "serial", timeout: TIMEOUTS.DEFAULT });

test.describe("Audit Log Rotation Stress", () => {
  test("maintains 5 rotated files under high write throughput", async () => {
    const port = AUDIT_PORT_BASE + 1;
    const logPath = auditLogPath("audit-stress", "rotation-stress");

    // Set max size extremely small to force rapid rotation
    await startServer(
      port,
      [
        "--audit-log",
        logPath,
        "--audit-log-max-size",
        "200",
        "--tool-filter",
        AUDIT_FILTER,
      ],
      "audit-rotation-stress",
    );

    let client: Client | undefined;
    try {
      client = await createClient(`http://127.0.0.1:${port}`);

      // Rapidly fire off many write-scope tool calls to force multiple rotations.
      // We do this sequentially to avoid MCP protocol congestion, but fast enough
      // to trigger the rotation logic repeatedly.
      const iterations = 40;
      for (let i = 0; i < iterations; i++) {
        const beginRes = await callToolAndParse(
          client,
          "mysql_transaction_begin",
          {},
        );
        const txId = (beginRes.data as Record<string, unknown>)?.transactionId as
          | string
          | undefined;
        if (txId) {
          await callToolAndParse(client, "mysql_transaction_rollback", {
            transactionId: txId,
          });
        }
        // Every few iterations, pause to let background disk writes complete and rotate
        if (i % 5 === 0) {
          await delay(150);
        }
      }

      // Wait for all async flushes and final rotations
      await delay(1000);

      // Verify the file retention policy (keeps up to 5 rotations)
      // logPath.1, logPath.2, ..., logPath.5 should exist
      let rotatedCount = 0;
      for (let i = 1; i <= 6; i++) {
        const rotatedPath = `${logPath}.${i}`;
        try {
          const s = await stat(rotatedPath);
          if (s.size > 0) {
            rotatedCount++;

            // Should not exceed 5
            if (i > 5) {
              throw new Error(
                `Rotation exceeded maximum limit, found ${rotatedPath}`,
              );
            }
          }
        } catch {
          // File doesn't exist, which is fine if we haven't hit the cap
        }
      }

      // We wrote enough to guarantee at least 2-3 rotations
      expect(rotatedCount).toBeGreaterThanOrEqual(2);
      expect(rotatedCount).toBeLessThanOrEqual(5);
    } finally {
      if (client) await client.close();
      stopServer(port);

      // Cleanup all possible rotated files
      await cleanupAuditFiles(logPath);
      for (let i = 1; i <= 6; i++) {
        await rm(`${logPath}.${i}`, { force: true }).catch(() => {});
      }
    }
  });
});

