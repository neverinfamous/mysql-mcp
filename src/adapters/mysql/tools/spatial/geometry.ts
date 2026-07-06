/**
 * MySQL Spatial/GIS Tools - Geometry Creation
 *
 * Tools for creating basic geometry objects.
 * 2 tools: point and polygon creation.
 */


import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "../core/error-helpers.js";
import type { MySQLAdapter } from "../../mysql-adapter/index.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import {
  PointSchemaBase,
  PointSchema,
  PolygonSchemaBase,
  PolygonSchema,
  SpatialPointOutputSchema,
  SpatialPolygonOutputSchema,
} from "../../schemas/spatial.js";
import { READ_ONLY } from "../../../../utils/annotations.js";

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
      const parsed: unknown = JSON.parse(value);
      return (parsed !== null) ? (parsed as Record<string, unknown>) : {};
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

/**
 * Create a POINT geometry
 */
export function createSpatialPointTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_spatial_point",
    title: "MySQL Create Point",
    description: "Create a POINT geometry from longitude/latitude coordinates.",
    group: "spatial",
    inputSchema: PointSchemaBase,
    outputSchema: SpatialPointOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { longitude, latitude, srid } = PointSchema.parse(params);

        const wkt = `POINT(${String(longitude)} ${String(latitude)})`;
        const result = await adapter.executeQuery(
          `SELECT ST_AsText(ST_GeomFromText(?, ?, 'axis-order=long-lat'), 'axis-order=long-lat') as wkt,
                        ST_AsGeoJSON(ST_GeomFromText(?, ?, 'axis-order=long-lat'), 5) as geoJson`,
          [wkt, srid, wkt, srid],
        );

        const row = result.rows?.[0];
        return withTokenEstimate({
          success: true,
          data: {
            wkt: row?.["wkt"],
            geoJson: parseGeoJsonResult(row?.["geoJson"]),
            srid,
            longitude,
            latitude,
          },
        });
      } catch (error) {
        return formatHandlerErrorResponse(error);
      }
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
    inputSchema: PolygonSchemaBase,
    outputSchema: SpatialPolygonOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { coordinates, polygon, srid } = PolygonSchema.parse(params);

        let wkt: string;
        if (polygon) {
          wkt = polygon;
        } else if (coordinates) {
          // Build WKT polygon
          const rings = coordinates.map(
            (ring) =>
              "(" +
              ring
                .map(([lon, lat]) => `${String(lon)} ${String(lat)}`)
                .join(", ") +
              ")",
          );
          wkt = `POLYGON(${rings.join(", ")})`;
        } else {
          return withTokenEstimate({
            success: false, error: "Either coordinates or polygon WKT must be provided", code: "VALIDATION_ERROR", category: "validation", recoverable: false,
          });
        }

        const result = await adapter.executeQuery(
          `SELECT ST_AsText(ST_GeomFromText(?, ?, 'axis-order=long-lat'), 'axis-order=long-lat') as wkt,
                        ST_AsGeoJSON(ST_GeomFromText(?, ?, 'axis-order=long-lat'), 5) as geoJson,
                        ST_Area(ST_GeomFromText(?, ?, 'axis-order=long-lat')) as area`,
          [wkt, srid, wkt, srid, wkt, srid],
        );

        const row = result.rows?.[0];
        return withTokenEstimate({
          success: true,
          data: {
            wkt: row?.["wkt"],
            geoJson: parseGeoJsonResult(row?.["geoJson"]),
            area: row?.["area"],
            srid,
          },
        });
      } catch (error) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}
