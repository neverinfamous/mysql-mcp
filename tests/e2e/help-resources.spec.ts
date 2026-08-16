/**
 * E2E Tests: Help Resources
 *
 * Validates the mysql://help resource system that agents use
 * for on-demand tool reference documentation.
 *
 * Tests:
 * - mysql://help (root gotchas + code mode)
 * - mysql://help/{group} for all 22 tool groups
 * - Content structure and non-empty responses
 *
 * The test server runs with --tool-filter +all, so all 22 help
 * resources should be registered.
 *
 * Ported from db-mcp/tests/e2e/help-resources.spec.ts — adapted for mysql-mcp.
 */

import { test, expect } from "@playwright/test";
import { createClient } from "./helpers.js";

test.describe.configure({ mode: "serial" });

const HELP_GROUPS = [
  "core",
  "json",
  "transactions",
  "text",
  "fulltext",
  "stats",
  "spatial",
  "admin",
  "monitoring",
  "performance",
  "optimization",
  "backup",
  "replication",
  "partitioning",
  "schema",
  "events",
  "sysschema",
  "security",
  "cluster",
  "roles",
  "docstore",
  "router",
];

test.describe("Help Resources", () => {
  test("mysql://help is listed in resources", async () => {
    const client = await createClient();
    try {
      const list = await client.listResources();
      const uris = list.resources.map((r) => r.uri);
      expect(uris).toContain("mysql://help");
    } finally {
      await client.close();
    }
  });

  test("mysql://help/{group} template is listed in resource templates", async () => {
    const client = await createClient();
    try {
      const list = await client.listResourceTemplates();
      const uris = list.resourceTemplates.map((r) => r.uriTemplate);
      expect(uris).toContain("mysql://help/{group}");
    } finally {
      await client.close();
    }
  });

  test("mysql://help returns non-empty application/json", async () => {
    const client = await createClient();
    try {
      const response = await client.readResource({ uri: "mysql://help" });

      expect(response.contents).toBeDefined();
      expect(response.contents.length).toBe(1);
      expect(response.contents[0].uri).toBe("mysql://help");
      expect(response.contents[0].mimeType).toBe("application/json");

      const text = response.contents[0].text as string;
      const parsed = JSON.parse(text);
      expect(parsed.groups).toBeDefined();
      expect(Array.isArray(parsed.groups)).toBe(true);
      expect(parsed.groups.length).toBeGreaterThan(0);
    } finally {
      await client.close();
    }
  });

  test("mysql://help JSON contains critical group keys", async () => {
    const client = await createClient();
    try {
      const response = await client.readResource({ uri: "mysql://help" });
      const parsed = JSON.parse(response.contents[0].text as string);
      const groupNames = parsed.groups.map((g: any) => g.name);

      expect(groupNames).toContain("gotchas");
      expect(groupNames).toContain("core");
    } finally {
      await client.close();
    }
  });

  for (const group of HELP_GROUPS) {
    test(`mysql://help/${group} returns non-empty application/json`, async () => {
      const client = await createClient();
      try {
        const response = await client.readResource({
          uri: `mysql://help/${group}`,
        });

        expect(response.contents).toBeDefined();
        expect(response.contents.length).toBe(1);
        expect(response.contents[0].uri).toBe(`mysql://help/${group}`);
        expect(response.contents[0].mimeType).toBe("application/json");

        const text = response.contents[0].text as string;
        const parsed = JSON.parse(text);
        expect(parsed.group).toBe(group);
        expect(parsed.helpContent.length, `${group} help content too short`).toBeGreaterThan(
          50,
        );
      } finally {
        await client.close();
      }
    });
  }
});
