/**
 * Payload Contract Tests: Spatial
 *
 * Validates response shapes for spatial query tools.
 * Uses the DistanceSchema which requires: table, spatialColumn, point{longitude, latitude}.
 */

import { test, expect } from "@playwright/test";
import { createClient, callToolAndParse } from "./helpers.js";

test.describe.configure({ mode: "serial" });

test.describe("Payload Contracts: Spatial", () => {
  test("mysql_spatial_distance returns { results[], count, referencePoint }", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(client, "mysql_spatial_distance", {
        table: "test_locations",
        spatialColumn: "geom",
        point: { longitude: -74.006, latitude: 40.7128 },
        limit: 5,
      });

      expect(Array.isArray(payload.data.results)).toBe(true);
      expect(typeof payload.data.count).toBe("number");
      expect(typeof payload.data.referencePoint).toBe("object");
    } finally {
      await client.close();
    }
  });

  test("mysql_spatial_distance_sphere returns { results[], count, unit }", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(
        client,
        "mysql_spatial_distance_sphere",
        {
          table: "test_locations",
          spatialColumn: "geom",
          point: { longitude: -74.006, latitude: 40.7128 },
          limit: 5,
        },
      );

      expect(Array.isArray(payload.data.results)).toBe(true);
      expect(typeof payload.data.count).toBe("number");
      expect(payload.data.unit).toBe("meters");
    } finally {
      await client.close();
    }
  });

  test("mysql_spatial_geojson returns GeoJSON data", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(client, "mysql_spatial_geojson", {
        geometry: "POINT(-74.006 40.7128)",
      });

      expect(typeof payload.data).toBe("object");
    } finally {
      await client.close();
    }
  });
});
