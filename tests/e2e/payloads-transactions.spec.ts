/**
 * Payload Contract Tests: Transactions (Extended)
 *
 * Extended lifecycle tests beyond the basic begin+commit.
 * Tests savepoints, rollback, execute-within-txn, and status.
 *
 * Ported from postgres-mcp/tests/e2e/payloads-transactions.spec.ts — adapted for mysql-mcp.
 */

import { test, expect } from "@playwright/test";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { createClient, callToolAndParse, expectSuccess } from "./helpers.js";

test.describe.configure({ mode: "serial" });

test.describe("Payload Contracts: Transactions (Extended)", () => {
  let client: Client;

  test.beforeAll(async () => {
    client = await createClient();
  });

  test.afterAll(async () => {
    await client.close();
  });

  test("begin → savepoint → rollback_to → commit lifecycle", async () => {
    // Begin
    const begin = await callToolAndParse(client, "mysql_transaction_begin", {});
    expectSuccess(begin);
    // Note: mysql-mcp typically returns transactionId inside the payload
    // Adjusting based on standard conventions (which could put it at root or inside data object).
    // The previous test in payloads-misc used: (beginPayload.data as any).transactionId
    const data = begin.data as any;
    const txnId = data?.transactionId || begin.transactionId;
    expect(typeof txnId).toBe("string");

    // Savepoint
    const savepoint = await callToolAndParse(
      client,
      "mysql_transaction_savepoint",
      {
        transactionId: txnId,
        name: "sp1",
      },
    );
    expectSuccess(savepoint);

    // Rollback to savepoint
    const rollbackTo = await callToolAndParse(
      client,
      "mysql_transaction_rollback_to",
      {
        transactionId: txnId,
        name: "sp1",
      },
    );
    expectSuccess(rollbackTo);

    // Commit
    const commit = await callToolAndParse(client, "mysql_transaction_commit", {
      transactionId: txnId,
    });
    expectSuccess(commit);
  });

  test("begin → execute INSERT → rollback → verify row not inserted", async () => {
    // Create a temp table for isolation (force InnoDB for transaction support)
    await callToolAndParse(client, "mysql_write_query", {
      sql: "DROP TABLE IF EXISTS _e2e_txn_rollback_test",
    });
    await callToolAndParse(client, "mysql_write_query", {
      sql: "CREATE TABLE _e2e_txn_rollback_test (id INT AUTO_INCREMENT PRIMARY KEY, value TEXT) ENGINE=InnoDB",
    });

    try {
      // Begin
      const begin = await callToolAndParse(client, "mysql_transaction_begin", {});
      expectSuccess(begin);
      const data = begin.data as any;
      const txnId = data?.transactionId || begin.transactionId;

      // Execute INSERT inside transaction
      const exec = await callToolAndParse(client, "mysql_write_query", {
        transactionId: txnId,
        query: "INSERT INTO _e2e_txn_rollback_test (value) VALUES ('should_not_persist')",
      });
      expectSuccess(exec);

      // Rollback
      const rollback = await callToolAndParse(
        client,
        "mysql_transaction_rollback",
        {
          transactionId: txnId,
        },
      );
      expectSuccess(rollback);

      // Verify row was NOT inserted
      const check = await callToolAndParse(client, "mysql_read_query", {
        query:
          "SELECT COUNT(*) AS cnt FROM _e2e_txn_rollback_test WHERE value = 'should_not_persist'",
      });
      expectSuccess(check);
      // In mysql-mcp, rows are usually under data.rows or just rows depending on tool
      const resData = check.data as any;
      const rows = resData?.rows || check.rows;
      expect(Number(rows[0].cnt)).toBe(0);
    } finally {
      // Cleanup
      await callToolAndParse(client, "mysql_write_query", {
        sql: "DROP TABLE IF EXISTS _e2e_txn_rollback_test",
      });
    }
  });

});
