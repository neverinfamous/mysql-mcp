import { z } from "zod";

export const VALID_GEOMETRY_TYPES = new Set([
  "POINT",
  "LINESTRING",
  "POLYGON",
  "GEOMETRY",
  "MULTIPOINT",
  "MULTILINESTRING",
  "MULTIPOLYGON",
  "GEOMETRYCOLLECTION",
]);

export const SpatialColumnSchemaBase = z.object({
  table: z.unknown().optional().describe("Table name"),
  tableName: z.unknown().optional(),
  name: z.unknown().optional(),
  column: z.unknown().optional().describe("Column name"),
  type: z.unknown().optional().describe("Geometry type (default: GEOMETRY)"),
  srid: z
    .unknown()
    .optional()
    .describe("Spatial Reference System ID (4326 = WGS84)"),
  nullable: z
    .unknown()
    .optional()
    .describe("Allow NULL values (default: false for spatial compatibility)"),
});

export const SpatialColumnSchema = z
  .object({
    table: z.string().optional(),
    tableName: z.string().optional(),
    name: z.string().optional(),
    column: z.string(),
    type: z.unknown().optional(),
    srid: z.unknown().optional(),
    nullable: z.unknown().optional(),
  })
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column,
    type: typeof data.type === "string" ? data.type : "GEOMETRY",
    srid: data.srid !== undefined ? Number(data.srid) : 4326,
    nullable: data.nullable !== undefined ? Boolean(data.nullable) : false,
  }))
  .refine((data) => !Number.isNaN(data.srid), {
    message: "srid must be a valid number",
  });

export const SpatialIndexSchemaBase = z.object({
  table: z.unknown().optional().describe("Table name"),
  tableName: z.unknown().optional(),
  name: z.unknown().optional(),
  column: z.unknown().optional().describe("Spatial column name"),
  indexName: z
    .unknown()
    .optional()
    .describe("Index name (auto-generated if not provided)"),
});

export const SpatialIndexSchema = z
  .object({
    table: z.string().optional(),
    tableName: z.string().optional(),
    name: z.string().optional(),
    column: z.string(),
    indexName: z.unknown().optional(),
  })
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column,
    indexName: typeof data.indexName === "string" ? data.indexName : undefined,
  }));

export const PointSchemaBase = z.object({
  longitude: z.unknown().optional().describe("Longitude coordinate"),
  latitude: z.unknown().optional().describe("Latitude coordinate"),
  srid: z.unknown().optional().describe("SRID (default: 4326)"),
});

export const PointSchema = z
  .object({
    longitude: z.unknown().optional(),
    latitude: z.unknown().optional(),
    srid: z.unknown().optional(),
  })
  .transform((data) => ({
    longitude: Number(data.longitude),
    latitude: Number(data.latitude),
    srid: data.srid !== undefined ? Number(data.srid) : 4326,
  }))
  .refine(
    (data) => !Number.isNaN(data.longitude) && !Number.isNaN(data.latitude),
    { message: "longitude and latitude must be valid numbers" },
  )
  .refine((data) => !Number.isNaN(data.srid), {
    message: "srid must be a valid number",
  });

export const PolygonSchemaBase = z.object({
  coordinates: z
    .unknown()
    .optional()
    .describe(
      "Polygon coordinates as array of rings, each ring is array of [lon, lat] pairs",
    ),
  srid: z.unknown().optional().describe("SRID (default: 4326)"),
});

export const PolygonSchema = z
  .object({
    coordinates: z.array(z.array(z.array(z.number()).min(2).max(2))),
    srid: z.unknown().optional(),
  })
  .transform((data) => ({
    coordinates: data.coordinates,
    srid: data.srid !== undefined ? Number(data.srid) : 4326,
  }))
  .refine((data) => !Number.isNaN(data.srid), {
    message: "srid must be a valid number",
  });

export const DistanceSchemaBase = z.object({
  table: z.unknown().optional().describe("Table name"),
  tableName: z.unknown().optional(),
  name: z.unknown().optional(),
  spatialColumn: z.unknown().optional().describe("Spatial column name"),
  geometryColumn: z.unknown().optional(),
  column: z.unknown().optional(),
  longitude: z.unknown().optional(),
  latitude: z.unknown().optional(),
  point: z
    .object({
      longitude: z.unknown().optional(),
      latitude: z.unknown().optional(),
    })
    .optional()
    .describe("Reference point"),
  maxDistance: z.unknown().optional().describe("Maximum distance in meters"),
  limit: z.unknown().optional().describe("Maximum results (default: 20)"),
  srid: z.unknown().optional().describe("SRID (default: 4326)"),
});

export const DistanceSchema = z
  .object({
    table: z.string().optional(),
    tableName: z.string().optional(),
    name: z.string().optional(),
    spatialColumn: z.string().optional(),
    geometryColumn: z.string().optional(),
    column: z.string().optional(),
    point: z.object({
      longitude: z.unknown().optional(),
      latitude: z.unknown().optional(),
    }).optional(),
    longitude: z.unknown().optional(),
    latitude: z.unknown().optional(),
    maxDistance: z.unknown().optional(),
    limit: z.unknown().optional(),
    srid: z.unknown().optional(),
  })
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    spatialColumn: data.spatialColumn ?? data.geometryColumn ?? data.column ?? "",
    point: {
      longitude: Number(data.point?.longitude ?? data.longitude),
      latitude: Number(data.point?.latitude ?? data.latitude),
    },
    maxDistance:
      data.maxDistance !== undefined ? Number(data.maxDistance) : undefined,
    limit: data.limit !== undefined ? Number(data.limit) : 20,
    srid: data.srid !== undefined ? Number(data.srid) : 4326,
  }))
  .refine(
    (data) =>
      !Number.isNaN(data.point.longitude) && !Number.isNaN(data.point.latitude),
    { message: "point.longitude and point.latitude must be valid numbers" },
  )
  .refine(
    (data) => data.maxDistance === undefined || !Number.isNaN(data.maxDistance),
    { message: "maxDistance must be a valid number" },
  )
  .refine((data) => !Number.isNaN(data.limit) && data.limit > 0, {
    message: "limit must be a positive number",
  })
  .refine((data) => !Number.isNaN(data.srid), {
    message: "srid must be a valid number",
  });

export const ContainsSchemaBase = z.object({
  table: z.unknown().optional().describe("Table name"),
  tableName: z.unknown().optional(),
  name: z.unknown().optional(),
  spatialColumn: z.unknown().optional().describe("Spatial column name"),
  geometryColumn: z.unknown().optional(),
  column: z.unknown().optional(),
  polygon: z.unknown().optional().describe("WKT polygon to test containment"),
  wkt: z.unknown().optional(),
  limit: z.unknown().optional().describe("Maximum results (default: 100)"),
  srid: z
    .unknown()
    .optional()
    .describe("SRID of the input geometry (default: 4326 for GPS coordinates)"),
});

export const ContainsSchema = z
  .object({
    table: z.string().optional(),
    tableName: z.string().optional(),
    name: z.string().optional(),
    spatialColumn: z.string().optional(),
    geometryColumn: z.string().optional(),
    column: z.string().optional(),
    polygon: z.string().optional(),
    wkt: z.string().optional(),
    limit: z.unknown().optional(),
    srid: z.unknown().optional(),
  })
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    spatialColumn: data.spatialColumn ?? data.geometryColumn ?? data.column ?? "",
    polygon: data.polygon ?? data.wkt ?? "",
    limit: data.limit !== undefined ? Number(data.limit) : 100,
    srid: data.srid !== undefined ? Number(data.srid) : 4326,
  }))
  .refine((data) => data.polygon.trim() !== "", { message: "polygon (WKT) must be a non-empty string" })
  .refine((data) => !Number.isNaN(data.limit) && data.limit > 0, {
    message: "limit must be a positive number",
  })
  .refine((data) => !Number.isNaN(data.srid), {
    message: "srid must be a valid number",
  });

export const WithinSchemaBase = z.object({
  table: z.unknown().optional().describe("Table name"),
  tableName: z.unknown().optional(),
  name: z.unknown().optional(),
  spatialColumn: z.unknown().optional().describe("Spatial column name"),
  geometryColumn: z.unknown().optional(),
  column: z.unknown().optional(),
  geometry: z.unknown().optional().describe("WKT geometry to test within"),
  wkt: z.unknown().optional(),
  limit: z.unknown().optional().describe("Maximum results (default: 100)"),
  srid: z
    .unknown()
    .optional()
    .describe("SRID of the input geometry (default: 4326 for GPS coordinates)"),
});

export const WithinSchema = z
  .object({
    table: z.string().optional(),
    tableName: z.string().optional(),
    name: z.string().optional(),
    spatialColumn: z.string().optional(),
    geometryColumn: z.string().optional(),
    column: z.string().optional(),
    geometry: z.string().optional(),
    wkt: z.string().optional(),
    limit: z.unknown().optional(),
    srid: z.unknown().optional(),
  })
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    spatialColumn: data.spatialColumn ?? data.geometryColumn ?? data.column ?? "",
    geometry: data.geometry ?? data.wkt ?? "",
    limit: data.limit !== undefined ? Number(data.limit) : 100,
    srid: data.srid !== undefined ? Number(data.srid) : 4326,
  }))
  .refine((data) => data.geometry.trim() !== "", { message: "geometry (WKT) must be a non-empty string" })
  .refine((data) => !Number.isNaN(data.limit) && data.limit > 0, {
    message: "limit must be a positive number",
  })
  .refine((data) => !Number.isNaN(data.srid), {
    message: "srid must be a valid number",
  });

export const IntersectionSchemaBase = z.object({
  geometry1: z.unknown().optional().describe("First WKT geometry"),
  geometry2: z.unknown().optional().describe("Second WKT geometry"),
  srid: z.unknown().optional().describe("SRID (default: 4326)"),
});

export const IntersectionSchema = z
  .object({
    geometry1: z.string(),
    geometry2: z.string(),
    srid: z.unknown().optional(),
  })
  .transform((data) => ({
    geometry1: data.geometry1,
    geometry2: data.geometry2,
    srid: data.srid !== undefined ? Number(data.srid) : 4326,
  }))
  .refine((data) => data.geometry1.trim() !== "" && data.geometry2.trim() !== "", { message: "both geometries must be non-empty strings" })
  .refine((data) => !Number.isNaN(data.srid), {
    message: "srid must be a valid number",
  });

export const BufferSchemaBase = z.object({
  geometry: z.unknown().optional().describe("WKT geometry"),
  wkt: z.unknown().optional(),
  distance: z.unknown().optional().describe("Buffer distance in meters"),
  srid: z.unknown().optional().describe("SRID (default: 4326)"),
  segments: z
    .unknown()
    .optional()
    .describe(
      "Number of segments per quarter-circle for buffer polygon approximation (default: 8, MySQL default: 32). Must be >= 1. Lower values produce simpler polygons with smaller payloads. Only effective with Cartesian geometries (SRID 0); geographic SRIDs use MySQL's internal algorithm.",
    ),
});

export const BufferSchema = z
  .object({
    geometry: z.string().optional(),
    wkt: z.string().optional(),
    distance: z.unknown().optional(),
    srid: z.unknown().optional(),
    segments: z.unknown().optional(),
  })
  .transform((data) => ({
    geometry: data.geometry ?? data.wkt ?? "",
    distance: Number(data.distance),
    srid: data.srid !== undefined ? Number(data.srid) : 4326,
    segments: data.segments !== undefined ? Number(data.segments) : 8,
  }))
  .refine((data) => data.geometry.trim() !== "", { message: "geometry (WKT) must be a non-empty string" })
  .refine((data) => !Number.isNaN(data.distance), {
    message: "distance must be a valid number",
  })
  .refine((data) => !Number.isNaN(data.srid), {
    message: "srid must be a valid number",
  })
  .refine((data) => !Number.isNaN(data.segments) && data.segments >= 1, {
    message: "segments must be a valid number >= 1",
  });

export const TransformSchemaBase = z.object({
  geometry: z.unknown().optional().describe("WKT geometry"),
  wkt: z.unknown().optional(),
  fromSrid: z.unknown().optional().describe("Source SRID"),
  toSrid: z.unknown().optional().describe("Target SRID"),
});

export const TransformSchema = z
  .object({
    geometry: z.string().optional(),
    wkt: z.string().optional(),
    fromSrid: z.unknown().optional(),
    toSrid: z.unknown().optional(),
  })
  .transform((data) => ({
    geometry: data.geometry ?? data.wkt ?? "",
    fromSrid: Number(data.fromSrid),
    toSrid: Number(data.toSrid),
  }))
  .refine((data) => data.geometry.trim() !== "", { message: "geometry (WKT) must be a non-empty string" })
  .refine((data) => !Number.isNaN(data.fromSrid), {
    message: "fromSrid must be a valid number",
  })
  .refine((data) => !Number.isNaN(data.toSrid), {
    message: "toSrid must be a valid number",
  });

export const GeoJSONSchemaBase = z.object({
  geometry: z
    .unknown()
    .optional()
    .describe("WKT geometry to convert to GeoJSON"),
  wkt: z.unknown().optional(),
  geoJson: z.unknown().optional().describe("GeoJSON to convert to WKT"),
  srid: z.unknown().optional().describe("SRID for conversion (default: 4326)"),
});

export const GeoJSONSchemaStrict = z
  .object({
    geometry: z.string().optional(),
    wkt: z.string().optional(),
    geoJson: z.string().optional(),
    srid: z.unknown().optional(),
  })
  .transform((data) => ({
    geometry: data.geometry ?? data.wkt,
    geoJson: data.geoJson,
    srid: data.srid !== undefined ? Number(data.srid) : 4326,
  }))
  .refine((data) => !Number.isNaN(data.srid), {
    message: "srid must be a valid number",
  });

export const GeoJSONSchema = GeoJSONSchemaStrict.refine(
  (data) => (data.geometry !== undefined) !== (data.geoJson !== undefined),
  "Either geometry or geoJson must be provided, but not both",
).refine((data) => {
  if (data.geometry?.trim() === "") return false;
  if (data.geoJson?.trim() === "") return false;
  return true;
}, { message: "Provided geometry or geoJson must not be an empty string" });

// Output Schemas

import { BaseOutputSchema } from "./output-schemas.js";

export const SpatialPointOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    wkt: z.string().optional(),
    geoJson: z.record(z.string(), z.unknown()).nullable().optional(),
    srid: z.number().optional(),
    longitude: z.number(),
    latitude: z.number(),
  }).loose().optional(),
});

export const SpatialPolygonOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    wkt: z.string().optional(),
    geoJson: z.record(z.string(), z.unknown()).nullable().optional(),
    area: z.number().optional(),
    srid: z.number().optional(),
  }).loose().optional(),
});

export const SpatialCreateColumnOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    table: z.string().optional(),
    tableName: z.string().optional(),
    name: z.string().optional(),
    column: z.string(),
    type: z.string(),
    srid: z.number().nullable(),
    nullable: z.boolean(),
  }).loose().optional(),
});

export const SpatialCreateIndexOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    table: z.string().optional(),
    tableName: z.string().optional(),
    name: z.string().optional(),
    column: z.string(),
    indexName: z.string(),
  }).loose().optional(),
});

export const SpatialIntersectionOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    intersects: z.boolean(),
    intersectionWkt: z.string().optional(),
    intersectionGeoJson: z.record(z.string(), z.unknown()).nullable().optional(),
  }).loose().optional(),
});

export const SpatialBufferOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    bufferWkt: z.string().optional(),
    bufferDistance: z.number().optional(),
    segments: z.number().optional(),
    segmentsApplied: z.boolean().optional(),
    srid: z.number().optional(),
  }).loose().optional(),
});

export const SpatialTransformOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    originalWkt: z.string().optional(),
    transformedWkt: z.string().optional(),
    transformedGeoJson: z.record(z.string(), z.unknown()).nullable().optional(),
    fromSrid: z.number().optional(),
    toSrid: z.number().optional(),
  }).loose().optional(),
});

export const SpatialGeoJSONOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    wkt: z.string().optional(),
    geoJson: z.record(z.string(), z.unknown()).nullable().optional(),
    conversion: z.string().optional(),
  }).loose().optional(),
});

export const SpatialQueryResultOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    results: z.array(z.record(z.string(), z.unknown())),
    count: z.number().optional(),
    referencePoint: z.object({
      longitude: z.number().optional(),
      latitude: z.number().optional(),
    }).loose().optional(),
    unit: z.string().optional(),
  }).loose().optional(),
});
