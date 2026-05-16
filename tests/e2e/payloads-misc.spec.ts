/**
 * Payload Contract Tests: Misc
 *
 * Validates response shapes for events, partitioning, sysschema,
 * docstore, and transactions groups.
 */

import { test, expect } from "@playwright/test";
import { createClient, callToolAndParse } from "./helpers.js";

test.describe.configure({ mode: "serial" });

test.describe("Payload Contracts: Misc", () => {
  // --- Events ---

  test("mysql_scheduler_status returns scheduler info", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(
        client,
        "mysql_scheduler_status",
        {},
      );

      expect(typeof payload).toBe("object");
    } finally {
      await client.close();
    }
  });

  test("mysql_event_list returns events", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(client, "mysql_event_list", {});

      expect(typeof payload).toBe("object");
    } finally {
      await client.close();
    }
  });

  // --- Partitioning ---

  test("mysql_partition_info returns partition data", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(client, "mysql_partition_info", {
        table: "test_partitioned",
      });

      expect(typeof payload).toBe("object");
    } finally {
      await client.close();
    }
  });

  // --- Sysschema ---

  test("mysql_sys_user_summary returns user stats", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(client, "mysql_sys_user_summary", {
        limit: 3,
      });

      expect(typeof payload).toBe("object");
    } finally {
      await client.close();
    }
  });

  test("mysql_sys_statement_summary returns statement stats", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(
        client,
        "mysql_sys_statement_summary",
        { limit: 3 },
      );

      expect(typeof payload).toBe("object");
    } finally {
      await client.close();
    }
  });

  // --- Docstore ---

  test("mysql_doc_list_collections returns collections", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(
        client,
        "mysql_doc_list_collections",
        {},
      );

      expect(typeof payload).toBe("object");
    } finally {
      await client.close();
    }
  });

  // --- Transactions ---

  test("mysql_transaction_begin + rollback lifecycle", async () => {
    const client = await createClient();
    try {
      const beginPayload = await callToolAndParse(
        client,
        "mysql_transaction_begin",
        {},
      );

      expect(typeof (beginPayload.data as any).transactionId).toBe("string");

      const rollbackPayload = await callToolAndParse(
        client,
        "mysql_transaction_rollback",
        { transactionId: (beginPayload.data as any).transactionId as string },
      );

      expect(typeof rollbackPayload.success).toBe("boolean");
    } finally {
      await client.close();
    }
  });

  // --- Replication status ---

  test("mysql_replication_status returns replication info", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(
        client,
        "mysql_replication_status",
        {},
      );

      // May or may not have replication configured
      expect(typeof payload).toBe("object");
    } finally {
      await client.close();
    }
  });
});
