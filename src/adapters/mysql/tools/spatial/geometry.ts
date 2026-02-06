/**
 * MySQL Spatial/GIS Tools - Geometry Creation
 *
 * Tools for creating basic geometry objects.
 * 2 tools: point and polygon creation.
 */

import { z } from "zod";
import type { MySQLAdapter } from "../../MySQLAdapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";

// =============================================================================
// Helpers
// =============================================================================

/**
 * Parse GeoJSON result from MySQL.
 * MySQL returns ST_AsGeoJSON as a string, but mysql2 driver may auto-parse JSON.
 * This handles both cases.
 */
function parseGeoJsonResult(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  if (typeof value === "object") {
    return value as Record<string, unknown>;
  }
  return null;
}

// =============================================================================
// Zod Schemas
// =============================================================================

const PointSchema = z.object({
  longitude: z.number().describe("Longitude coordinate"),
  latitude: z.number().describe("Latitude coordinate"),
  srid: z.number().default(4326).describe("SRID"),
});

const PolygonSchema = z.object({
  coordinates: z
    .array(z.array(z.array(z.number()).min(2).max(2)))
    .describe(
      "Polygon coordinates as array of rings, each ring is array of [lon, lat] pairs",
    ),
  srid: z.number().default(4326).describe("SRID"),
});

/**
 * Create a POINT geometry
 */
export function createSpatialPointTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_spatial_point",
    title: "MySQL Create Point",
    description: "Create a POINT geometry from longitude/latitude coordinates.",
    group: "spatial",
    inputSchema: PointSchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { longitude, latitude, srid } = PointSchema.parse(params);

      // Use 'axis-order=long-lat' to accept natural longitude-latitude order
      // MySQL 8.0+ defaults to EPSG standard (latitude-longitude) for SRID 4326
      const result = await adapter.executeQuery(
        `SELECT ST_AsText(ST_SRID(ST_GeomFromText('POINT(${String(longitude)} ${String(latitude)})', ${String(srid)}, 'axis-order=long-lat'), ${String(srid)})) as wkt,
                        ST_AsGeoJSON(ST_SRID(ST_GeomFromText('POINT(${String(longitude)} ${String(latitude)})', ${String(srid)}, 'axis-order=long-lat'), ${String(srid)})) as geoJson`,
      );

      const row = result.rows?.[0];
      return {
        wkt: row?.["wkt"],
        geoJson: parseGeoJsonResult(row?.["geoJson"]),
        srid,
        longitude,
        latitude,
      };
    },
  };
}

/**
 * Create a POLYGON geometry
 */
export function createSpatialPolygonTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_spatial_polygon",
    title: "MySQL Create Polygon",
    description: "Create a POLYGON geometry from coordinates.",
    group: "spatial",
    inputSchema: PolygonSchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { coordinates, srid } = PolygonSchema.parse(params);

      // Build WKT polygon
      const rings = coordinates.map(
        (ring) =>
          "(" +
          ring.map(([lon, lat]) => `${String(lon)} ${String(lat)}`).join(", ") +
          ")",
      );
      const wkt = `POLYGON(${rings.join(", ")})`;

      const result = await adapter.executeQuery(
        `SELECT ST_AsText(ST_GeomFromText(?, ${String(srid)}, 'axis-order=long-lat')) as wkt,
                        ST_AsGeoJSON(ST_GeomFromText(?, ${String(srid)}, 'axis-order=long-lat')) as geoJson,
                        ST_Area(ST_GeomFromText(?, ${String(srid)}, 'axis-order=long-lat')) as area`,
        [wkt, wkt, wkt],
      );

      const row = result.rows?.[0];
      return {
        wkt: row?.["wkt"],
        geoJson: parseGeoJsonResult(row?.["geoJson"]),
        area: row?.["area"],
        srid,
      };
    },
  };
}
