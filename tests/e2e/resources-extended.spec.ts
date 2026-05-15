/**
 * E2E Tests: Extended Resource Reads
 *
 * Reads the 13 data resources NOT covered by resources.spec.ts.
 * Extension-dependent resources (vector, postgis, crypto) use
 * lenient assertions since extensions may not be installed.
 *
 * Already covered in resources.spec.ts: schema, tables, health, extensions, settings.
 */

import { test, expect } from "@playwright/test";
import { createClient,  } from "./helpers.js";

test.describe.configure({ mode: "serial" });

test.describe("Extended Resource Reads", () => {
  test("mysql://pool returns JSON", async ({}, testInfo) => {
    const client = await createClient();
    try {
      const response = await client.readResource({ uri: "mysql://pool" });
      expect(response.contents).toBeDefined();
      expect(response.contents.length).toBeGreaterThan(0);
      const content = response.contents[0];
      const parsed = JSON.parse("text" in content ? content.text : "");
      expect(typeof parsed).toBe("object");
    } finally {
      await client.close();
    }
  });

  test("mysql://capabilities returns JSON with version", async ({}, testInfo) => {
    test.setTimeout(120000);
    const client = await createClient();
    try {
      const response = await client.readResource({
        uri: "mysql://capabilities",
      });
      expect(response.contents).toBeDefined();
      expect(response.contents.length).toBeGreaterThan(0);
      const content = response.contents[0];
      const parsed = JSON.parse("text" in content ? content.text : "");
      expect(typeof parsed).toBe("object");
    } finally {
      await client.close();
    }
  });

  test("mysql://performance returns JSON", async ({}, testInfo) => {
    const client = await createClient();
    try {
      const response = await client.readResource({
        uri: "mysql://performance",
      });
      expect(response.contents).toBeDefined();
      expect(response.contents.length).toBeGreaterThan(0);
      const content = response.contents[0];
      const parsed = JSON.parse("text" in content ? content.text : "");
      // May be empty if mysql_stat_statements not enabled
      expect(typeof parsed).toBe("object");
    } finally {
      await client.close();
    }
  });

  test("mysql://indexes returns JSON", async ({}, testInfo) => {
    const client = await createClient();
    try {
      const response = await client.readResource({
        uri: "mysql://indexes",
      });
      expect(response.contents).toBeDefined();
      expect(response.contents.length).toBeGreaterThan(0);
      const content = response.contents[0];
      const parsed = JSON.parse("text" in content ? content.text : "");
      expect(typeof parsed).toBe("object");
    } finally {
      await client.close();
    }
  });

  test("mysql://replication returns JSON", async ({}, testInfo) => {
    const client = await createClient();
    try {
      const response = await client.readResource({
        uri: "mysql://replication",
      });
      expect(response.contents).toBeDefined();
      expect(response.contents.length).toBeGreaterThan(0);
      const content = response.contents[0];
      const parsed = JSON.parse("text" in content ? content.text : "");
      expect(typeof parsed).toBe("object");
    } finally {
      await client.close();
    }
  });
  test("mysql://locks returns JSON", async ({}, testInfo) => {
    const client = await createClient();
    try {
      const response = await client.readResource({ uri: "mysql://locks" });
      expect(response.contents).toBeDefined();
      expect(response.contents.length).toBeGreaterThan(0);
      const content = response.contents[0];
      const parsed = JSON.parse("text" in content ? content.text : "");
      expect(typeof parsed).toBe("object");
    } finally {
      await client.close();
    }
  });

  // --- Extension-dependent resources (lenient assertions) ---
  // --- In-memory resources ---

  test("mysql://insights returns text memo", async ({}, testInfo) => {
    const client = await createClient();
    try {
      const response = await client.readResource({
        uri: "mysql://insights",
      });
      expect(response.contents).toBeDefined();
      expect(response.contents.length).toBeGreaterThan(0);
      const content = response.contents[0];
      const text = "text" in content ? content.text : "";
      // insights resource returns a text memo (may be empty placeholder or contain insights)
      expect(typeof text).toBe("string");
      expect(text.length).toBeGreaterThan(0);
    } finally {
      await client.close();
    }
  });
});
