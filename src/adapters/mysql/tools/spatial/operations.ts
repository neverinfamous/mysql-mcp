/**
 * MySQL Spatial/GIS Tools - Spatial Operations
 *
 * Tools for spatial transformations and operations.
 * 4 tools: intersection, buffer, transform, geojson.
 */


import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "../core/error-helpers.js";
import type { MySQLAdapter } from "../../mysql-adapter/index.js";
import {
  type ToolDefinition,
  type RequestContext,
  ValidationError,
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
  SpatialIntersectionOutputSchema,
  SpatialBufferOutputSchema,
  SpatialTransformOutputSchema,
  SpatialGeoJSONOutputSchema,
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

/**
 * Truncate coordinate precision in WKT strings to save tokens
 */
function truncateWktPrecision(wkt: unknown, decimals = 5): unknown {
  if (typeof wkt !== "string") return wkt;
  return wkt.replace(/-?\d+(?:\.\d+)?(?:e[-+]\d+)?/gi, (match) => {
    const parts = match.split('.');
    if (match.toLowerCase().includes('e') || (parts.length > 1 && parts[1] && parts[1].length > decimals)) {
      return parseFloat(parseFloat(match).toFixed(decimals)).toString();
    }
    return match;
  });
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
    outputSchema: SpatialIntersectionOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { geometry1, geometry2, srid } = IntersectionSchema.parse(params);

        const validateSrid = async (sridNum: number): Promise<boolean> => {
          if (sridNum === 0 || sridNum === 4326) return true;
          const check = await adapter.executeReadQuery(
            "WITH cte AS (SELECT 1 FROM INFORMATION_SCHEMA.ST_SPATIAL_REFERENCE_SYSTEMS WHERE SRS_ID = ?) SELECT * FROM cte",
            [sridNum]
          );
          return (check.rows?.length ?? 0) > 0;
        };

        if (!(await validateSrid(srid))) {
          throw new ValidationError(`Validation error: Invalid srid: ${srid} is not a known spatial reference system in the database.`);
        }
        
        if (srid !== 0) {
           throw new ValidationError(`Validation error: ST_Intersection is only implemented for Cartesian geometry (SRID 0). Geographic spatial reference systems (e.g. 4326) are not supported by MySQL for this operation.`);
        }

        const isGeographic = srid !== 0;
        const axisClauseGeom = isGeographic ? ", 'axis-order=long-lat'" : "";
        const axisClauseAsText = isGeographic ? ", 'axis-order=long-lat'" : "";

        // Use IF(ST_Intersects...) to avoid crashing MySQL on disjoint geometries
        const result = await adapter.executeReadQuery(
          `WITH cte AS (SELECT
                    ST_Intersects(
                        ST_GeomFromText(?, ${String(srid)}${axisClauseGeom}),
                        ST_GeomFromText(?, ${String(srid)}${axisClauseGeom})
                    ) as intersects,
                    IF(ST_Intersects(ST_GeomFromText(?, ${String(srid)}${axisClauseGeom}), ST_GeomFromText(?, ${String(srid)}${axisClauseGeom})),
                      ST_AsText(ST_Intersection(
                          ST_GeomFromText(?, ${String(srid)}${axisClauseGeom}),
                          ST_GeomFromText(?, ${String(srid)}${axisClauseGeom})
                      )${axisClauseAsText}),
                      'GEOMETRYCOLLECTION EMPTY'
                    ) as intersection_wkt,
                    IF(ST_Intersects(ST_GeomFromText(?, ${String(srid)}${axisClauseGeom}), ST_GeomFromText(?, ${String(srid)}${axisClauseGeom})),
                      ST_AsGeoJSON(ST_Intersection(
                          ST_GeomFromText(?, ${String(srid)}${axisClauseGeom}),
                          ST_GeomFromText(?, ${String(srid)}${axisClauseGeom})
                      ), 5),
                      '{"type":"GeometryCollection","geometries":[]}'
                    ) as intersection_geojson) SELECT * FROM cte`,
          [
             geometry1, geometry2, 
             geometry1, geometry2, geometry1, geometry2,
             geometry1, geometry2, geometry1, geometry2
          ],
        );

        const row = result.rows?.[0];
        return withTokenEstimate({
          success: true,
          data: {
            intersects: Boolean(row?.["intersects"]),
            intersectionWkt: truncateWktPrecision(row?.["intersection_wkt"]),
            intersectionGeoJson: parseGeoJsonResult(
              row?.["intersection_geojson"],
            ),
          },
        });
      } catch (error) {
        return formatHandlerErrorResponse(error);
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
    outputSchema: SpatialBufferOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { geometry, distance, srid, segments } =
          BufferSchema.parse(params);

        const validateSrid = async (sridNum: number): Promise<boolean> => {
          if (sridNum === 0 || sridNum === 4326) return true;
          const check = await adapter.executeReadQuery(
            "WITH cte AS (SELECT 1 FROM INFORMATION_SCHEMA.ST_SPATIAL_REFERENCE_SYSTEMS WHERE SRS_ID = ?) SELECT * FROM cte",
            [sridNum]
          );
          return (check.rows?.length ?? 0) > 0;
        };

        if (!(await validateSrid(srid))) {
          throw new ValidationError(`Validation error: Invalid srid: ${srid} is not a known spatial reference system in the database.`);
        }

        const isGeographic = srid !== 0;
        
        let bufferQuery: string;
        let queryParams: unknown[];
        let segmentsApplied = false;

        const isPointOrMultiPoint = typeof geometry === "string" && (geometry.trim().toUpperCase().startsWith("POINT") || geometry.trim().toUpperCase().startsWith("MULTIPOINT"));

        if (srid === 0 && segments !== undefined && isPointOrMultiPoint) {
          bufferQuery = `WITH cte AS (SELECT ST_AsText(ST_Buffer(ST_GeomFromText(?, ?), ?, ST_Buffer_Strategy('point_circle', ?))) as buffer_wkt) SELECT * FROM cte`;
          queryParams = [geometry, srid, distance, segments];
          segmentsApplied = true;
        } else {
          // Ensure we don't pass axis-order for Cartesian as it is strictly for geographic SRIDs
          const axisClauseGeom = isGeographic ? ", 'axis-order=long-lat'" : "";
          const axisClauseAsText = isGeographic ? ", 'axis-order=long-lat'" : "";
          bufferQuery = `WITH cte AS (SELECT ST_AsText(ST_Buffer(ST_GeomFromText(?, ${String(srid)}${axisClauseGeom}), ?)${axisClauseAsText}) as buffer_wkt) SELECT * FROM cte`;
          queryParams = [geometry, distance];
        }

        const result = await adapter.executeReadQuery(bufferQuery, queryParams);

        const row = result.rows?.[0];
        return withTokenEstimate({
          success: true,
          data: {
            bufferWkt: truncateWktPrecision(row?.["buffer_wkt"]),
            bufferDistance: distance,
            segments,
            segmentsApplied,
            srid,
          },
        });
      } catch (error) {
        return formatHandlerErrorResponse(error);
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
    outputSchema: SpatialTransformOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { geometry, fromSrid, toSrid } = TransformSchema.parse(params);

        // Pre-validate SRIDs to prevent MySQL connection drop (ER_SPATIAL_UNKNOWN_DICT_SRID)
        const validateSrid = async (srid: number): Promise<boolean> => {
          if (srid === 0 || srid === 4326) return true;
          const check = await adapter.executeReadQuery(
            "WITH cte AS (SELECT 1 FROM INFORMATION_SCHEMA.ST_SPATIAL_REFERENCE_SYSTEMS WHERE SRS_ID = ?) SELECT * FROM cte",
            [srid]
          );
          return (check.rows?.length ?? 0) > 0;
        };

        if (!(await validateSrid(fromSrid))) {
          throw new ValidationError(`Validation error: Invalid fromSrid: ${fromSrid} is not a known spatial reference system in the database.`);
        }
        if (!(await validateSrid(toSrid))) {
          throw new ValidationError(`Validation error: Invalid toSrid: ${toSrid} is not a known spatial reference system in the database.`);
        }

        const result = await adapter.executeReadQuery(
          `WITH cte AS (SELECT
                    ST_AsText(ST_Transform(ST_GeomFromText(?, ${String(fromSrid)}, 'axis-order=long-lat'), ${String(toSrid)}), 'axis-order=long-lat') as transformed_wkt,
                    ST_AsGeoJSON(ST_Transform(ST_GeomFromText(?, ${String(fromSrid)}, 'axis-order=long-lat'), ${String(toSrid)}), 5) as transformed_geojson) SELECT * FROM cte`,
          [geometry, geometry],
        );

        const row = result.rows?.[0];
        const transformedWkt = truncateWktPrecision(row?.["transformed_wkt"]) ?? null;
        
        return withTokenEstimate({
          success: true,
          data: {
            originalWkt: truncateWktPrecision(geometry),
            transformedWkt,
            transformedGeoJson: transformedWkt === null ? null : parseGeoJsonResult(
              row?.["transformed_geojson"],
            ),
            fromSrid,
            toSrid,
          },
        });
      } catch (error) {
        return formatHandlerErrorResponse(error);
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
    outputSchema: SpatialGeoJSONOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { geometry, geoJson, srid } = GeoJSONSchema.parse(params);

        const validateSrid = async (sridNum: number): Promise<boolean> => {
          if (sridNum === 0 || sridNum === 4326) return true;
          const check = await adapter.executeReadQuery(
            "WITH cte AS (SELECT 1 FROM INFORMATION_SCHEMA.ST_SPATIAL_REFERENCE_SYSTEMS WHERE SRS_ID = ?) SELECT * FROM cte",
            [sridNum]
          );
          return (check.rows?.length ?? 0) > 0;
        };

        if (geometry) {
          if (!(await validateSrid(srid))) {
            throw new ValidationError(`Validation error: Invalid srid: ${srid} is not a known spatial reference system in the database.`);
          }

          const isGeographic = srid !== 0;
          const axisClause = isGeographic ? ", 'axis-order=long-lat'" : "";

          // Convert WKT to GeoJSON
          const result = await adapter.executeReadQuery(
            `WITH cte AS (SELECT ST_AsGeoJSON(ST_GeomFromText(?, ${String(srid)}${axisClause}), 5) as geoJson) SELECT * FROM cte`,
            [geometry],
          );

          const row = result.rows?.[0];
          return withTokenEstimate({
            success: true,
            data: {
              wkt: truncateWktPrecision(geometry),
              geoJson: parseGeoJsonResult(row?.["geoJson"]),
              conversion: "WKT to GeoJSON",
            },
          });
        } else if (geoJson) {
          // Check for embedded CRS in geoJson to prevent connection drops
          let embeddedSrid: number | undefined;
          try {
             const parsed: unknown = JSON.parse(geoJson);
             if (typeof parsed === "object" && parsed !== null && "crs" in parsed) {
                 const crs = parsed.crs;
                 if (typeof crs === "object" && crs !== null && "properties" in crs) {
                     const properties = crs.properties;
                     if (typeof properties === "object" && properties !== null && "name" in properties) {
                         const crsName = properties.name;
                         if (typeof crsName === "string") {
                             const match = /EPSG:{1,2}(\d+)/i.exec(crsName);
                             if (match?.[1]) embeddedSrid = parseInt(match[1], 10);
                         }
                     }
                 }
             }
          } catch {
             // Ignore JSON parse errors here, let MySQL handle invalid JSON
          }
          if (embeddedSrid !== undefined) {
             if (!(await validateSrid(embeddedSrid))) {
                 throw new ValidationError(`Validation error: Invalid embedded CRS SRID: ${embeddedSrid} is not a known spatial reference system in the database.`);
             }
          }

          // Convert GeoJSON to WKT
          const targetSrid = embeddedSrid ?? srid;
          if (!(await validateSrid(targetSrid))) {
              throw new ValidationError(`Validation error: Invalid srid: ${targetSrid} is not a known spatial reference system in the database.`);
          }
          const axisClause = targetSrid !== 0 ? ", 'axis-order=long-lat'" : "";
          const result = await adapter.executeReadQuery(
            `WITH cte AS (SELECT ST_AsText(ST_GeomFromGeoJSON(?, 2, ${String(targetSrid)})${axisClause}) as wkt) SELECT * FROM cte`,
            [geoJson],
          );

          const row = result.rows?.[0];
          return withTokenEstimate({
            success: true,
            data: {
              wkt: truncateWktPrecision(row?.["wkt"]),
              geoJson: typeof JSON.parse(geoJson) === "object" && JSON.parse(geoJson) !== null ? (JSON.parse(geoJson) as Record<string, unknown>) : {},
              conversion: "GeoJSON to WKT",
            },
          });
        }
        
        throw new Error("Unreachable");
      } catch (error) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}
