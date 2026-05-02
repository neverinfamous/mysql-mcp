/**
 * MySQL Spatial/GIS Tools - Spatial Operations
 *
 * Tools for spatial transformations and operations.
 * 4 tools: intersection, buffer, transform, geojson.
 */

import { ZodError } from "zod";
import { formatHandlerErrorResponse, withTokenEstimate } from "../core/error-helpers.js";
import type { MySQLAdapter } from "../../mysql-adapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import {
  IntersectionSchemaBase,
  IntersectionSchema,
  BufferSchemaBase,
  BufferSchema,
  TransformSchemaBase,
  TransformSchema,
  GeoJSONSchemaBase,
  GeoJSONSchema,
} from "../../schemas/spatial.js";

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
 * Calculate intersection of two geometries
 */
export function createSpatialIntersectionTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_spatial_intersection",
    title: "MySQL Spatial Intersection",
    description: "Calculate the intersection of two geometries.",
    group: "spatial",
    inputSchema: IntersectionSchemaBase,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { geometry1, geometry2, srid } = IntersectionSchema.parse(params);

        const result = await adapter.executeQuery(
          `SELECT
                    ST_Intersects(
                        ST_GeomFromText(?, ${String(srid)}, 'axis-order=long-lat'),
                        ST_GeomFromText(?, ${String(srid)}, 'axis-order=long-lat')
                    ) as intersects,
                    ST_AsText(ST_Intersection(
                        ST_GeomFromText(?, ${String(srid)}, 'axis-order=long-lat'),
                        ST_GeomFromText(?, ${String(srid)}, 'axis-order=long-lat')
                    ), 'axis-order=long-lat') as intersection_wkt,
                    ST_AsGeoJSON(ST_Intersection(
                        ST_GeomFromText(?, ${String(srid)}, 'axis-order=long-lat'),
                        ST_GeomFromText(?, ${String(srid)}, 'axis-order=long-lat')
                    )) as intersection_geojson`,
          [geometry1, geometry2, geometry1, geometry2, geometry1, geometry2],
        );

        const row = result.rows?.[0];
        return withTokenEstimate({
          success: true,
          intersects: Boolean(row?.["intersects"]),
          intersectionWkt: row?.["intersection_wkt"],
          intersectionGeoJson: parseGeoJsonResult(
            row?.["intersection_geojson"],
          ),
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
 * Create a buffer around a geometry
 */
export function createSpatialBufferTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_spatial_buffer",
    title: "MySQL Spatial Buffer",
    description: "Create a buffer (expanded area) around a geometry.",
    group: "spatial",
    inputSchema: BufferSchemaBase,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { geometry, distance, srid, segments } =
          BufferSchema.parse(params);

        // Handler-level validation for segments (replaces schema .min(1))
        if (segments < 1) {
          return withTokenEstimate({ success: false, error: "segments must be >= 1" });
        }

        // ST_Buffer_Strategy only works with Cartesian (non-geographic) SRIDs.
        // Geographic SRIDs (e.g., 4326) use MySQL's internal geographic buffer algorithm.
        const isGeographic = srid !== 0;
        const strategyClause = isGeographic
          ? ""
          : `, ST_Buffer_Strategy('point_circle', ${String(segments)})`;
        const result = await adapter.executeQuery(
          `SELECT ST_AsText(ST_Buffer(ST_GeomFromText(?, ${String(srid)}, 'axis-order=long-lat'), ?${strategyClause}), 'axis-order=long-lat') as buffer_wkt`,
          [geometry, distance],
        );

        const row = result.rows?.[0];
        return withTokenEstimate({
          success: true,
          bufferWkt: row?.["buffer_wkt"],
          bufferDistance: distance,
          segments,
          segmentsApplied: !isGeographic,
          srid,
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
 * Transform geometry between SRIDs
 */
export function createSpatialTransformTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_spatial_transform",
    title: "MySQL Spatial Transform",
    description:
      "Transform a geometry from one spatial reference system to another.",
    group: "spatial",
    inputSchema: TransformSchemaBase,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { geometry, fromSrid, toSrid } = TransformSchema.parse(params);

        const result = await adapter.executeQuery(
          `SELECT
                    ST_AsText(ST_Transform(ST_GeomFromText(?, ${String(fromSrid)}, 'axis-order=long-lat'), ${String(toSrid)}), 'axis-order=long-lat') as transformed_wkt,
                    ST_AsGeoJSON(ST_Transform(ST_GeomFromText(?, ${String(fromSrid)}, 'axis-order=long-lat'), ${String(toSrid)})) as transformed_geojson`,
          [geometry, geometry],
        );

        const row = result.rows?.[0];
        return withTokenEstimate({
          success: true,
          originalWkt: geometry,
          transformedWkt: row?.["transformed_wkt"],
          transformedGeoJson: parseGeoJsonResult(row?.["transformed_geojson"]),
          fromSrid,
          toSrid,
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
 * Convert between WKT and GeoJSON
 */
export function createSpatialGeoJSONTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_spatial_geojson",
    title: "MySQL GeoJSON Conversion",
    description: "Convert geometry between WKT and GeoJSON formats.",
    group: "spatial",
    inputSchema: GeoJSONSchemaBase,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { geometry, geoJson, srid } = GeoJSONSchema.parse(params);

        if (geometry) {
          // Convert WKT to GeoJSON
          const result = await adapter.executeQuery(
            `SELECT ST_AsGeoJSON(ST_GeomFromText(?, ${String(srid)}, 'axis-order=long-lat')) as geoJson`,
            [geometry],
          );

          const row = result.rows?.[0];
          return withTokenEstimate({
            success: true,
            wkt: geometry,
            geoJson: parseGeoJsonResult(row?.["geoJson"]),
            conversion: "WKT to GeoJSON",
          });
        } else if (geoJson) {
          // Convert GeoJSON to WKT
          const result = await adapter.executeQuery(
            `SELECT ST_AsText(ST_GeomFromGeoJSON(?), 'axis-order=long-lat') as wkt`,
            [geoJson],
          );

          const row = result.rows?.[0];
          return withTokenEstimate({
            success: true,
            wkt: row?.["wkt"],
            geoJson: JSON.parse(geoJson) as Record<string, unknown>,
            conversion: "GeoJSON to WKT",
          });
        }

        return withTokenEstimate({
          success: false,
          error: "Either geometry or geoJson must be provided",
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
