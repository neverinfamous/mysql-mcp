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
  column: z.unknown().optional().describe("Column name"),
  type: z.unknown().optional().describe("Geometry type (default: GEOMETRY)"),
  srid: z
    .unknown()
    .optional()
    .describe("Spatial Reference System ID (4326 = WGS84)"),
  nullable: z.unknown().optional().describe("Allow NULL values (default: true)"),
});

export const SpatialColumnSchema = z.object({
  table: z.string(),
  column: z.string(),
  type: z.unknown().optional(),
  srid: z.unknown().optional(),
  nullable: z.unknown().optional(),
})
.transform((data) => ({
  table: data.table,
  column: data.column,
  type: typeof data.type === "string" ? data.type : "GEOMETRY",
  srid: data.srid !== undefined ? Number(data.srid) : 4326,
  nullable: data.nullable !== undefined ? Boolean(data.nullable) : true,
}))
.refine(
  (data) => !Number.isNaN(data.srid),
  { message: "srid must be a valid number" }
);

export const SpatialIndexSchemaBase = z.object({
  table: z.unknown().optional().describe("Table name"),
  column: z.unknown().optional().describe("Spatial column name"),
  indexName: z
    .unknown()
    .optional()
    .describe("Index name (auto-generated if not provided)"),
});

export const SpatialIndexSchema = z.object({
  table: z.string(),
  column: z.string(),
  indexName: z.unknown().optional(),
})
.transform((data) => ({
  table: data.table,
  column: data.column,
  indexName: typeof data.indexName === "string" ? data.indexName : undefined,
}));

export const PointSchemaBase = z.object({
  longitude: z.unknown().optional().describe("Longitude coordinate"),
  latitude: z.unknown().optional().describe("Latitude coordinate"),
  srid: z.unknown().optional().describe("SRID (default: 4326)"),
});

export const PointSchema = z.object({
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
  { message: "longitude and latitude must be valid numbers" }
)
.refine(
  (data) => !Number.isNaN(data.srid),
  { message: "srid must be a valid number" }
);

export const PolygonSchemaBase = z.object({
  coordinates: z
    .unknown()
    .optional()
    .describe(
      "Polygon coordinates as array of rings, each ring is array of [lon, lat] pairs",
    ),
  srid: z.unknown().optional().describe("SRID (default: 4326)"),
});

export const PolygonSchema = z.object({
  coordinates: z.array(z.array(z.array(z.number()).min(2).max(2))),
  srid: z.unknown().optional(),
})
.transform((data) => ({
  coordinates: data.coordinates,
  srid: data.srid !== undefined ? Number(data.srid) : 4326,
}))
.refine(
  (data) => !Number.isNaN(data.srid),
  { message: "srid must be a valid number" }
);

export const DistanceSchemaBase = z.object({
  table: z.unknown().optional().describe("Table name"),
  spatialColumn: z.unknown().optional().describe("Spatial column name"),
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

export const DistanceSchema = z.object({
  table: z.string(),
  spatialColumn: z.string(),
  point: z.object({
    longitude: z.unknown().optional(),
    latitude: z.unknown().optional(),
  }),
  maxDistance: z.unknown().optional(),
  limit: z.unknown().optional(),
  srid: z.unknown().optional(),
})
.transform((data) => ({
  table: data.table,
  spatialColumn: data.spatialColumn,
  point: {
    longitude: Number(data.point?.longitude),
    latitude: Number(data.point?.latitude),
  },
  maxDistance: data.maxDistance !== undefined ? Number(data.maxDistance) : undefined,
  limit: data.limit !== undefined ? Number(data.limit) : 20,
  srid: data.srid !== undefined ? Number(data.srid) : 4326,
}))
.refine(
  (data) => !Number.isNaN(data.point.longitude) && !Number.isNaN(data.point.latitude),
  { message: "point.longitude and point.latitude must be valid numbers" }
)
.refine(
  (data) => data.maxDistance === undefined || !Number.isNaN(data.maxDistance),
  { message: "maxDistance must be a valid number" }
)
.refine(
  (data) => !Number.isNaN(data.limit) && data.limit > 0,
  { message: "limit must be a positive number" }
)
.refine(
  (data) => !Number.isNaN(data.srid),
  { message: "srid must be a valid number" }
);

export const ContainsSchemaBase = z.object({
  table: z.unknown().optional().describe("Table name"),
  spatialColumn: z.unknown().optional().describe("Spatial column name"),
  polygon: z.unknown().optional().describe("WKT polygon to test containment"),
  limit: z.unknown().optional().describe("Maximum results (default: 100)"),
  srid: z
    .unknown()
    .optional()
    .describe("SRID of the input geometry (default: 4326 for GPS coordinates)"),
});

export const ContainsSchema = z.object({
  table: z.string(),
  spatialColumn: z.string(),
  polygon: z.string(),
  limit: z.unknown().optional(),
  srid: z.unknown().optional(),
})
.transform((data) => ({
  table: data.table,
  spatialColumn: data.spatialColumn,
  polygon: data.polygon,
  limit: data.limit !== undefined ? Number(data.limit) : 100,
  srid: data.srid !== undefined ? Number(data.srid) : 4326,
}))
.refine(
  (data) => !Number.isNaN(data.limit) && data.limit > 0,
  { message: "limit must be a positive number" }
)
.refine(
  (data) => !Number.isNaN(data.srid),
  { message: "srid must be a valid number" }
);

export const WithinSchemaBase = z.object({
  table: z.unknown().optional().describe("Table name"),
  spatialColumn: z.unknown().optional().describe("Spatial column name"),
  geometry: z.unknown().optional().describe("WKT geometry to test within"),
  limit: z.unknown().optional().describe("Maximum results (default: 100)"),
  srid: z
    .unknown()
    .optional()
    .describe("SRID of the input geometry (default: 4326 for GPS coordinates)"),
});

export const WithinSchema = z.object({
  table: z.string(),
  spatialColumn: z.string(),
  geometry: z.string(),
  limit: z.unknown().optional(),
  srid: z.unknown().optional(),
})
.transform((data) => ({
  table: data.table,
  spatialColumn: data.spatialColumn,
  geometry: data.geometry,
  limit: data.limit !== undefined ? Number(data.limit) : 100,
  srid: data.srid !== undefined ? Number(data.srid) : 4326,
}))
.refine(
  (data) => !Number.isNaN(data.limit) && data.limit > 0,
  { message: "limit must be a positive number" }
)
.refine(
  (data) => !Number.isNaN(data.srid),
  { message: "srid must be a valid number" }
);

export const IntersectionSchemaBase = z.object({
  geometry1: z.unknown().optional().describe("First WKT geometry"),
  geometry2: z.unknown().optional().describe("Second WKT geometry"),
  srid: z.unknown().optional().describe("SRID (default: 4326)"),
});

export const IntersectionSchema = z.object({
  geometry1: z.string(),
  geometry2: z.string(),
  srid: z.unknown().optional(),
})
.transform((data) => ({
  geometry1: data.geometry1,
  geometry2: data.geometry2,
  srid: data.srid !== undefined ? Number(data.srid) : 4326,
}))
.refine(
  (data) => !Number.isNaN(data.srid),
  { message: "srid must be a valid number" }
);

export const BufferSchemaBase = z.object({
  geometry: z.unknown().optional().describe("WKT geometry"),
  distance: z.unknown().optional().describe("Buffer distance in meters"),
  srid: z.unknown().optional().describe("SRID (default: 4326)"),
  segments: z
    .unknown()
    .optional()
    .describe(
      "Number of segments per quarter-circle for buffer polygon approximation (default: 8, MySQL default: 32). Must be >= 1. Lower values produce simpler polygons with smaller payloads. Only effective with Cartesian geometries (SRID 0); geographic SRIDs use MySQL's internal algorithm.",
    ),
});

export const BufferSchema = z.object({
  geometry: z.string(),
  distance: z.unknown().optional(),
  srid: z.unknown().optional(),
  segments: z.unknown().optional(),
})
.transform((data) => ({
  geometry: data.geometry,
  distance: Number(data.distance),
  srid: data.srid !== undefined ? Number(data.srid) : 4326,
  segments: data.segments !== undefined ? Number(data.segments) : 8,
}))
.refine(
  (data) => !Number.isNaN(data.distance),
  { message: "distance must be a valid number" }
)
.refine(
  (data) => !Number.isNaN(data.srid),
  { message: "srid must be a valid number" }
)
.refine(
  (data) => !Number.isNaN(data.segments) && data.segments >= 1,
  { message: "segments must be a valid number >= 1" }
);

export const TransformSchemaBase = z.object({
  geometry: z.unknown().optional().describe("WKT geometry"),
  fromSrid: z.unknown().optional().describe("Source SRID"),
  toSrid: z.unknown().optional().describe("Target SRID"),
});

export const TransformSchema = z.object({
  geometry: z.string(),
  fromSrid: z.unknown().optional(),
  toSrid: z.unknown().optional(),
})
.transform((data) => ({
  geometry: data.geometry,
  fromSrid: Number(data.fromSrid),
  toSrid: Number(data.toSrid),
}))
.refine(
  (data) => !Number.isNaN(data.fromSrid),
  { message: "fromSrid must be a valid number" }
)
.refine(
  (data) => !Number.isNaN(data.toSrid),
  { message: "toSrid must be a valid number" }
);

export const GeoJSONSchemaBase = z.object({
  geometry: z
    .unknown()
    .optional()
    .describe("WKT geometry to convert to GeoJSON"),
  geoJson: z.unknown().optional().describe("GeoJSON to convert to WKT"),
  srid: z.unknown().optional().describe("SRID for conversion (default: 4326)"),
});

export const GeoJSONSchemaStrict = z.object({
  geometry: z.string().optional(),
  geoJson: z.string().optional(),
  srid: z.unknown().optional(),
})
.transform((data) => ({
  geometry: data.geometry,
  geoJson: data.geoJson,
  srid: data.srid !== undefined ? Number(data.srid) : 4326,
}))
.refine(
  (data) => !Number.isNaN(data.srid),
  { message: "srid must be a valid number" }
);

export const GeoJSONSchema = GeoJSONSchemaStrict.refine(
  (data) => (data.geometry !== undefined) !== (data.geoJson !== undefined),
  "Either geometry or geoJson must be provided, but not both",
);
