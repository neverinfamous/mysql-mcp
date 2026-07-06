import { z } from "zod";
import { preprocessSpatialParams } from "./preprocess-utils.js";

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
  spatialColumn: z.unknown().optional().describe("Spatial column name"),
  geometryColumn: z.unknown().optional(),
  column: z.unknown().optional().describe("Column name"),
  col: z.unknown().optional(),
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

export const SpatialColumnSchema = z.preprocess(
  preprocessSpatialParams,
  z.object({
    table: z.string().optional(),
    tableName: z.string().optional(),
    name: z.string().optional(),
    spatialColumn: z.string().optional(),
    geometryColumn: z.string().optional(),
    column: z.string().optional(),
    col: z.string().optional(),
    type: z.unknown().optional(),
    srid: z.unknown().optional(),
    nullable: z.unknown().optional(),
  })
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.spatialColumn ?? data.geometryColumn ?? data.column ?? data.col ?? "",
    type: typeof data.type === "string" ? data.type : "GEOMETRY",
    srid: data.srid !== undefined ? Number(data.srid) : 4326,
    nullable: data.nullable !== undefined ? Boolean(data.nullable) : false,
  }))
)
  .refine((data) => !Number.isNaN(data.srid), {
    message: "srid must be a valid number",
  });

export const SpatialIndexSchemaBase = z.object({
  table: z.unknown().optional().describe("Table name"),
  tableName: z.unknown().optional(),
  name: z.unknown().optional(),
  spatialColumn: z.unknown().optional().describe("Spatial column name"),
  geometryColumn: z.unknown().optional(),
  column: z.unknown().optional().describe("Spatial column name"),
  col: z.unknown().optional(),
  columns: z.unknown().optional(),
  indexName: z
    .unknown()
    .optional()
    .describe("Index name (auto-generated if not provided)"),
});

export const SpatialIndexSchema = z.preprocess(
  preprocessSpatialParams,
  z.object({
    table: z.string().optional(),
    tableName: z.string().optional(),
    name: z.string().optional(),
    spatialColumn: z.string().optional(),
    geometryColumn: z.string().optional(),
    column: z.string().optional(),
    col: z.string().optional(),
    columns: z.string().optional(),
    indexName: z.unknown().optional(),
  })
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.spatialColumn ?? data.geometryColumn ?? data.column ?? data.col ?? data.columns ?? "",
    indexName: typeof data.indexName === "string" ? data.indexName : undefined,
  }))
);

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
      "Polygon coordinates as array of rings, each ring is array of [lon, lat] pairs. Note: Pass coordinates, not points or coords.",
    ),
  points: z.unknown().optional(),
  coords: z.unknown().optional(),
  polygon: z.unknown().optional().describe("Polygon WKT"),
  wkt: z.unknown().optional(),
  srid: z.unknown().optional().describe("SRID (default: 4326)"),
});

export const PolygonSchema = z.preprocess(
  (val: unknown) => {
    if (typeof val !== "object" || val === null) return val;
    const data = val as Record<string, unknown>;
    
    const poly = data["polygon"] ?? data["wkt"];
    let coords = data["coordinates"] ?? data["coords"] ?? data["points"];

    // If coordinates were passed to the first positional argument "table" due to positional.ts mapping
    if (typeof data["table"] === "string" && data["table"].toUpperCase().includes("POLYGON")) {
        coords = data["table"];
    } else if (Array.isArray(data["table"])) {
        coords = data["table"];
    }

    return {
      ...data,
      coordinates: coords,
      polygon: poly,
    };
  },
  z.object({
    coordinates: z.union([z.array(z.array(z.array(z.number()).min(2).max(2))), z.string()]).optional(),
    polygon: z.string().optional(),
    srid: z.unknown().optional().transform((v) => (v !== undefined ? Number(v) : 4326)),
  })
).transform(data => {
  let polygonWkt = data.polygon;
  let coords = data.coordinates;
  
  if (!polygonWkt && typeof coords === "string") {
      polygonWkt = coords;
      coords = undefined;
  }
  
  return { ...data, coordinates: Array.isArray(coords) ? coords : undefined, polygon: polygonWkt };
}).refine(data => data.coordinates ?? data.polygon, { message: "Either coordinates or polygon WKT must be provided" })
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
  col: z.unknown().optional(),
  point1: z.unknown().optional(),
  point2: z.unknown().optional(),
  geometry1: z.unknown().optional(),
  geometry2: z.unknown().optional(),
  longitude: z.unknown().optional(),
  latitude: z.unknown().optional(),
  point: z
    .object({
      longitude: z.unknown().optional(),
      latitude: z.unknown().optional(),
    })
    .optional()
    .describe("Reference point. Note: Must provide valid longitude and latitude numbers."),
  maxDistance: z.unknown().optional().describe("Maximum distance in meters"),
  limit: z.unknown().optional().describe("Maximum results (default: 20)"),
  srid: z.unknown().optional().describe("SRID (default: 4326)"),
});

export const DistanceSchema = z
  .object({
    table: z.unknown().optional(),
    tableName: z.string().optional(),
    name: z.string().optional(),
    spatialColumn: z.string().optional(),
    geometryColumn: z.string().optional(),
    column: z.string().optional(),
    col: z.string().optional(),
    point: z.unknown().optional(),
    point1: z.unknown().optional(),
    point2: z.unknown().optional(),
    geometry1: z.unknown().optional(),
    geometry2: z.unknown().optional(),
    longitude: z.unknown().optional(),
    latitude: z.unknown().optional(),
    maxDistance: z.unknown().optional(),
    limit: z.unknown().optional(),
    srid: z.unknown().optional(),
  })
  .transform((data) => {
    let table = typeof data.table === "string" ? data.table : data.tableName ?? data.name ?? "";
    const spatialColumn = data.spatialColumn ?? data.geometryColumn ?? data.column ?? data.col ?? "";
    
    let pt1 = typeof data.point1 === "string" ? data.point1 : typeof data.geometry1 === "string" ? data.geometry1 : "";
    let pt2 = typeof data.point2 === "string" ? data.point2 : typeof data.geometry2 === "string" ? data.geometry2 : "";
    const pointStr = typeof data.point === "string" ? data.point : null;

    // Heal positional parameters where agents put geometries in `table` and `spatialColumn` 
    // e.g. distance("POINT(1 2)", "POINT(3 4)") -> table: "POINT(1 2)", spatialColumn: "POINT(3 4)"
    if (table.toUpperCase().includes("POINT") || table.toUpperCase().includes("POLYGON")) {
        pt1 = table;
        pt2 = pointStr ?? spatialColumn;
        table = "";
    }

    let longitude = Number((data.point as Record<string, unknown>)?.["longitude"] ?? data.longitude);
    let latitude = Number((data.point as Record<string, unknown>)?.["latitude"] ?? data.latitude);

    if (pointStr && Number.isNaN(longitude)) {
        const match = /POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i.exec(pointStr);
        if (match) {
           longitude = Number(match[1]);
           latitude = Number(match[2]);
        }
    }

    return {
      table,
      spatialColumn,
      point: { longitude, latitude },
      geometry1: pt1,
      geometry2: pt2,
      maxDistance: data.maxDistance !== undefined ? Number(data.maxDistance) : undefined,
      limit: data.limit !== undefined ? Number(data.limit) : 20,
      srid: data.srid !== undefined ? Number(data.srid) : 4326,
    };
  })
  .refine(
    (data) => {
      if (data.table) {
        return !Number.isNaN(data.point.longitude) && !Number.isNaN(data.point.latitude);
      }
      return data.geometry1 !== "" && data.geometry2 !== "";
    },
    { message: "If table is provided, point.longitude and point.latitude must be valid numbers. Otherwise, point1 and point2 (or geometry1 and geometry2) must be provided." },
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
  col: z.unknown().optional(),
  polygon: z.unknown().optional().describe("WKT polygon to test containment"),
  wkt: z.unknown().optional(),
  limit: z.unknown().optional().describe("Maximum results (default: 100)"),
  srid: z
    .unknown()
    .optional()
    .describe("SRID of the input geometry (default: 4326 for GPS coordinates)"),
});

export const ContainsSchema = z.preprocess(
  preprocessSpatialParams,
  z.object({
    table: z.string().optional(),
    tableName: z.string().optional(),
    name: z.string().optional(),
    spatialColumn: z.string().optional(),
    geometryColumn: z.string().optional(),
    column: z.string().optional(),
    col: z.string().optional(),
    polygon: z.string().optional(),
    wkt: z.string().optional(),
    limit: z.unknown().optional(),
    srid: z.unknown().optional(),
  })
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    spatialColumn: data.spatialColumn ?? data.geometryColumn ?? data.column ?? data.col ?? "",
    polygon: data.polygon ?? data.wkt ?? "",
    limit: data.limit !== undefined ? Number(data.limit) : 100,
    srid: data.srid !== undefined ? Number(data.srid) : 4326,
  }))
)
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
  col: z.unknown().optional(),
  geometry: z.unknown().optional().describe("WKT geometry to test within"),
  wkt: z.unknown().optional(),
  limit: z.unknown().optional().describe("Maximum results (default: 100)"),
  srid: z
    .unknown()
    .optional()
    .describe("SRID of the input geometry (default: 4326 for GPS coordinates)"),
});

export const WithinSchema = z.preprocess(
  preprocessSpatialParams,
  z.object({
    table: z.string().optional(),
    tableName: z.string().optional(),
    name: z.string().optional(),
    spatialColumn: z.string().optional(),
    geometryColumn: z.string().optional(),
    column: z.string().optional(),
    col: z.string().optional(),
    geometry: z.string().optional(),
    wkt: z.string().optional(),
    limit: z.unknown().optional(),
    srid: z.unknown().optional(),
  })
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    spatialColumn: data.spatialColumn ?? data.geometryColumn ?? data.column ?? data.col ?? "",
    geometry: data.geometry ?? data.wkt ?? "",
    limit: data.limit !== undefined ? Number(data.limit) : 100,
    srid: data.srid !== undefined ? Number(data.srid) : 4326,
  }))
)
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

export const IntersectionSchema = z.preprocess(
  preprocessSpatialParams,
  z.object({
    geometry1: z.string(),
    geometry2: z.string(),
    srid: z.unknown().optional(),
  })
  .transform((data) => ({
    geometry1: data.geometry1,
    geometry2: data.geometry2,
    srid: data.srid !== undefined ? Number(data.srid) : 4326,
  }))
)
  .refine((data) => data.geometry1.trim() !== "" && data.geometry2.trim() !== "", { message: "both geometries must be non-empty strings" })
  .refine((data) => !Number.isNaN(data.srid), {
    message: "srid must be a valid number",
  });

export const BufferSchemaBase = z.object({
  geometry: z.unknown().optional().describe("WKT geometry. Note: Pass geometry or wkt, not coords or point."),
  wkt: z.unknown().optional(),
  distance: z.unknown().optional().describe("Buffer distance in meters"),
  dist: z.unknown().optional(),
  srid: z.unknown().optional().describe("SRID (default: 4326)"),
  segments: z
    .unknown()
    .optional()
    .describe(
      "Number of segments per quarter-circle for buffer polygon approximation (default: 8, MySQL default: 32). Must be >= 1. Lower values produce simpler polygons with smaller payloads. Only effective with Cartesian geometries (SRID 0); geographic SRIDs use MySQL's internal algorithm.",
    ),
});

export const BufferSchema = z.preprocess(
  preprocessSpatialParams,
  z.object({
    geometry: z.string().optional(),
    wkt: z.string().optional(),
    distance: z.unknown().optional(),
    dist: z.unknown().optional(),
    srid: z.unknown().optional(),
    segments: z.unknown().optional(),
  })
  .transform((data) => ({
    geometry: data.geometry ?? data.wkt ?? "",
    distance: Number(data.distance ?? data.dist),
    srid: data.srid !== undefined ? Number(data.srid) : 4326,
    segments: data.segments !== undefined ? Number(data.segments) : 8,
  }))
)
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
  geometry: z.unknown().optional().describe("WKT geometry. Note: Pass geometry or wkt, not coords or point."),
  wkt: z.unknown().optional(),
  fromSrid: z.unknown().optional().describe("Source SRID (default: 4326)"),
  toSrid: z.unknown().optional().describe("Target SRID"),
});

export const TransformSchema = z.preprocess(
  preprocessSpatialParams,
  z.object({
    geometry: z.string().optional(),
    wkt: z.string().optional(),
    fromSrid: z.unknown().optional(),
    toSrid: z.unknown().optional(),
  })
  .transform((data) => ({
    geometry: data.geometry ?? data.wkt ?? "",
    fromSrid: data.fromSrid !== undefined ? Number(data.fromSrid) : 4326,
    toSrid: Number(data.toSrid),
  }))
)
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
    .describe("WKT geometry to convert to GeoJSON. Note: Pass geometry or geoJson."),
  wkt: z.unknown().optional(),
  geoJson: z.unknown().optional().describe("GeoJSON to convert to WKT"),
  srid: z.unknown().optional().describe("SRID for conversion (default: 4326)"),
});

export const GeoJSONSchemaStrict = z.preprocess(
  preprocessSpatialParams,
  z.object({
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
)
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
    results: z.array(z.record(z.string(), z.unknown())).optional(),
    count: z.number().optional(),
    referencePoint: z.object({
      longitude: z.number().optional(),
      latitude: z.number().optional(),
    }).loose().optional(),
    unit: z.string().optional(),
    distance: z.number().optional(),
  }).loose().optional(),
});
