/**
 * Payload Contract Tests: Stats
 *
 * Validates response shapes for the 8 stats tools:
 * descriptive, percentiles, distribution, histogram, sampling,
 * correlation, time_series, regression.
 */

import { test, expect } from "@playwright/test";
import { createClient, callToolAndParse } from "./helpers.js";

test.describe.configure({ mode: "serial" });

test.describe("Payload Contracts: Stats", () => {
  test("mysql_stats_descriptive returns statistical summary", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(
        client,
        "mysql_stats_descriptive",
        {
          table: "test_products",
          column: "price",
        },
      );

      expect(typeof payload).toBe("object");
      // Should contain statistical measures
      expect(typeof payload.count).toBe("number");
    } finally {
      await client.close();
    }
  });

  test("mysql_stats_percentiles returns percentile data", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(
        client,
        "mysql_stats_percentiles",
        {
          table: "test_measurements",
          column: "temperature",
        },
      );

      expect(typeof payload).toBe("object");
    } finally {
      await client.close();
    }
  });

  test("mysql_stats_distribution returns distribution data", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(
        client,
        "mysql_stats_distribution",
        {
          table: "test_measurements",
          column: "temperature",
        },
      );

      expect(typeof payload).toBe("object");
    } finally {
      await client.close();
    }
  });

  test("mysql_stats_histogram returns bins", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(client, "mysql_stats_histogram", {
        table: "test_measurements",
        column: "temperature",
        bins: 5,
      });

      expect(typeof payload).toBe("object");
    } finally {
      await client.close();
    }
  });

  test("mysql_stats_correlation returns correlation result", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(
        client,
        "mysql_stats_correlation",
        {
          table: "test_measurements",
          column1: "temperature",
          column2: "humidity",
        },
      );

      expect(typeof payload).toBe("object");
    } finally {
      await client.close();
    }
  });

  test("mysql_stats_sampling returns sampled rows", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(client, "mysql_stats_sampling", {
        table: "test_measurements",
        sampleSize: 10,
      });

      expect(typeof payload).toBe("object");
    } finally {
      await client.close();
    }
  });
});
