/**
 * Payload Contract Tests: Security + Roles
 *
 * Validates response shapes for security (9) and roles (8) tools.
 */

import { test, expect } from "@playwright/test";
import { createClient, callToolAndParse } from "./helpers.js";

test.describe.configure({ mode: "serial" });

test.describe("Payload Contracts: Security + Roles", () => {
  test("mysql_security_ssl_status returns SSL info", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(
        client,
        "mysql_security_ssl_status",
        {},
      );

      expect(typeof payload).toBe("object");
    } finally {
      await client.close();
    }
  });

  test("mysql_security_user_privileges returns privileges", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(
        client,
        "mysql_security_user_privileges",
        {},
      );

      expect(typeof payload).toBe("object");
    } finally {
      await client.close();
    }
  });

  test("mysql_security_audit returns audit findings", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(
        client,
        "mysql_security_audit",
        {},
      );

      expect(typeof payload).toBe("object");
    } finally {
      await client.close();
    }
  });

  test("mysql_security_encryption_status returns encryption info", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(
        client,
        "mysql_security_encryption_status",
        {},
      );

      expect(typeof payload).toBe("object");
    } finally {
      await client.close();
    }
  });

  test("mysql_security_sensitive_tables returns findings", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(
        client,
        "mysql_security_sensitive_tables",
        {},
      );

      expect(typeof payload).toBe("object");
    } finally {
      await client.close();
    }
  });

  test("mysql_role_list returns role data", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(client, "mysql_role_list", {});

      expect(typeof payload).toBe("object");
    } finally {
      await client.close();
    }
  });

  test("mysql_user_roles returns user role info", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(client, "mysql_user_roles", {
        user: "root",
        host: "localhost",
      });

      expect(typeof payload).toBe("object");
      expect(typeof payload.user).toBe("string");
    } finally {
      await client.close();
    }
  });
});
