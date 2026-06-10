/**
 * MySQL Spatial/GIS Tools - Geometry Creation
 *
 * Tools for creating basic geometry objects.
 * 2 tools: point and polygon creation.
 */

import { ZodError } from "zod";
import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "../core/error-helpers.js";
import type { MySQLAdapter } from "../../mysql-adapter.js";
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

        const result = await adapter.executeQuery(
          `SELECT ST_AsText(ST_SRID(ST_GeomFromText('POINT(${String(longitude)} ${String(latitude)})', ${String(srid)}, 'axis-order=long-lat'), ${String(srid)}), 'axis-order=long-lat') as wkt,
                        ST_AsGeoJSON(ST_SRID(ST_GeomFromText('POINT(${String(longitude)} ${String(latitude)})', ${String(srid)}, 'axis-order=long-lat'), ${String(srid)})) as geoJson`,
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
        if (error instanceof ZodError) {
          return formatHandlerErrorResponse(error);
        }
        const msg = error instanceof Error ? error.message : String(error);
        return formatHandlerErrorResponse(new Error(msg));
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
        const { coordinates, srid } = PolygonSchema.parse(params);

        // Build WKT polygon
        const rings = coordinates.map(
          (ring) =>
            "(" +
            ring
              .map(([lon, lat]) => `${String(lon)} ${String(lat)}`)
              .join(", ") +
            ")",
        );
        const wkt = `POLYGON(${rings.join(", ")})`;

        const result = await adapter.executeQuery(
          `SELECT ST_AsText(ST_GeomFromText(?, ${String(srid)}, 'axis-order=long-lat'), 'axis-order=long-lat') as wkt,
                        ST_AsGeoJSON(ST_GeomFromText(?, ${String(srid)}, 'axis-order=long-lat')) as geoJson,
                        ST_Area(ST_GeomFromText(?, ${String(srid)}, 'axis-order=long-lat')) as area`,
          [wkt, wkt, wkt],
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
        if (error instanceof ZodError) {
          return formatHandlerErrorResponse(error);
        }
        const msg = error instanceof Error ? error.message : String(error);
        return formatHandlerErrorResponse(new Error(msg));
      }
    },
  };
}
