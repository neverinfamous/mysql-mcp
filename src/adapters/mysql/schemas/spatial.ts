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

export function isValidWKT(wkt: string): boolean {
  if (!wkt || typeof wkt !== "string") return false;
  const t = wkt.trim().toUpperCase();
  
  if (t.endsWith(" EMPTY")) {
    const type = t.replace(" EMPTY", "").trim();
    return VALID_GEOMETRY_TYPES.has(type);
  }
  
  const match = /^([A-Z]+)\s*\((.*)\)$/.exec(t);
  if (!match?.[1] || match?.[2] === undefined) return false;
  
  const type = match[1];
  const content = match[2];
  
  if (!VALID_GEOMETRY_TYPES.has(type)) return false;
  if (!/^[-\d.,\s()]*$/.test(content)) return false;
  
  if (type === "POINT") {
    return /^[-+]?\d*\.?\d+\s+[-+]?\d*\.?\d+$/.test(content.trim());
  }
  
  const pairs = content.match(/[-+]?\d*\.?\d+\s+[-+]?\d*\.?\d+/g);
  if (!pairs || pairs.length === 0) return false;
  
  if (type === "LINESTRING" || type === "MULTIPOINT") {
    if (pairs.length < 2) return false;
  }
  
  if (type === "POLYGON") {
    if (pairs.length < 4) return false;
  }
  
  return true;
}

export const SpatialColumnSchemaBase = z.object({
  table: z.unknown().optional().describe("Table name"),
  tableName: z.unknown().optional(),
  name: z.unknown().optional(),
  spatialColumn: z.unknown().optional().describe("Spatial column name"),
  geometryColumn: z.unknown().optional(),
  column: z.unknown().optional().describe("Column name"),
  columnName: z.unknown().optional(),
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
    columnName: z.string().optional(),
    col: z.string().optional(),
    type: z.unknown().optional(),
    srid: z.unknown().optional(),
    nullable: z.unknown().optional(),
  })
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.spatialColumn ?? data.geometryColumn ?? data.column ?? data.columnName ?? data.col ?? "",
    type: typeof data.type === "string" ? data.type : "GEOMETRY",
    srid: data.srid !== undefined ? Number(data.srid) : 4326,
    nullable: data.nullable !== undefined ? Boolean(data.nullable) : false,
  }))
)
  .refine((data) => data.table !== "", { message: "table is required" })
  .refine((data) => data.column !== "", { message: "column is required" })
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
  columnName: z.unknown().optional(),
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
    columnName: z.string().optional(),
    col: z.string().optional(),
    columns: z.string().optional(),
    indexName: z.unknown().optional(),
  })
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.spatialColumn ?? data.geometryColumn ?? data.column ?? data.columnName ?? data.col ?? data.columns ?? "",
    indexName: typeof data.indexName === "string" ? data.indexName : undefined,
  }))
)
  .refine((data) => data.table !== "", { message: "table is required" })
  .refine((data) => data.column !== "", { message: "column is required" });

export const PointSchemaBase = z.object({
  longitude: z.unknown().optional().describe("Longitude coordinate"),
  lon: z.unknown().optional(),
  lng: z.unknown().optional(),
  latitude: z.unknown().optional().describe("Latitude coordinate"),
  lat: z.unknown().optional(),
  srid: z.unknown().optional().describe("SRID (default: 4326)"),
});

export const PointSchema = z.preprocess(
  (val: unknown) => {
    if (typeof val !== "object" || val === null) return val ?? {};
    const data = { ...(val as Record<string, unknown>) };
    
    // Explicitly handle empty strings, nulls, and undefined
    let lon = data["longitude"];
    if (lon === undefined || lon === null || lon === "") {
        lon = data["lon"] !== undefined && data["lon"] !== null && data["lon"] !== "" ? data["lon"] : data["lng"];
    }
    
    let lat = data["latitude"];
    if (lat === undefined || lat === null || lat === "") {
        lat = data["lat"];
    }

    return { ...data, longitude: lon, latitude: lat };
  },
  z.object({
    longitude: z.unknown().optional(),
    latitude: z.unknown().optional(),
    srid: z.unknown().optional(),
  })
)
  .transform((data) => ({
    longitude: Number(data.longitude),
    latitude: Number(data.latitude),
    srid: data.srid !== undefined ? Number(data.srid) : 4326,
  }))
  .refine(
    (data) => !Number.isNaN(data.longitude) && !Number.isNaN(data.latitude),
    { message: "longitude and latitude must be valid numbers" },
  )
  .refine(
    (data) => {
       if (data.srid === 4326) {
           return data.latitude >= -90 && data.latitude <= 90;
       }
       return true;
    },
    { message: "latitude must be between -90 and 90 degrees for SRID 4326" }
  )
  .refine(
    (data) => {
       if (data.srid === 4326) {
           return data.longitude >= -180 && data.longitude <= 180;
       }
       return true;
    },
    { message: "longitude must be between -180 and 180 degrees for SRID 4326" }
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
  geometry: z.unknown().optional(),
  wkt: z.unknown().optional(),
  srid: z.unknown().optional().describe("SRID (default: 4326)"),
});

export const PolygonSchema = z.preprocess(
  (val: unknown) => {
    if (typeof val !== "object" || val === null) return val;
    const data = val as Record<string, unknown>;
    
    const poly = data["polygon"] ?? data["wkt"] ?? data["geometry"];
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
  .refine(data => {
    if (Array.isArray(data.coordinates)) {
        for (const ring of data.coordinates) {
            if (ring.length < 4) return false;
            const first = ring[0];
            const last = ring[ring.length - 1];
            if (!first || !last || first[0] !== last[0] || first[1] !== last[1]) return false;
        }
    } else if (data.polygon) {
        const wkt = data.polygon.trim().toUpperCase();
        if (!wkt.startsWith("POLYGON")) return false;
        const match = /POLYGON\s*\(\s*(.*)\s*\)/.exec(wkt);
        if (!match?.[1]) return false;
        const rings = match[1].split(/\)\s*,\s*\(/);
        for (let ring of rings) {
            ring = ring.replace(/[()]/g, "").trim();
            const points = ring.split(",").map(p => p.trim());
            if (points.length < 4) return false;
            if (points[0] !== points[points.length - 1]) return false;
        }
    }
    return true;
  }, { message: "polygon WKT or coordinates must contain closed rings with at least 4 points each" })
  .refine(data => {
    if (data.srid === 4326) {
        if (Array.isArray(data.coordinates)) {
            for (const ring of data.coordinates) {
                for (const point of ring) {
                    if (point[0] !== undefined && (point[0] < -180 || point[0] > 180)) return false;
                    if (point[1] !== undefined && (point[1] < -90 || point[1] > 90)) return false;
                }
            }
        } else if (data.polygon) {
            const match = /POLYGON\s*\(\s*(.*)\s*\)/i.exec(data.polygon);
            if (match?.[1]) {
                const points = match[1].replace(/[()]/g, "").split(",");
                for (const p of points) {
                    const coords = p.trim().split(/\s+/);
                    if (coords.length >= 2) {
                        const lon = Number(coords[0]);
                        const lat = Number(coords[1]);
                        if (lon < -180 || lon > 180) return false;
                        if (lat < -90 || lat > 90) return false;
                    }
                }
            }
        }
    }
    return true;
  }, { message: "longitude must be between -180 and 180, and latitude between -90 and 90 for SRID 4326" })
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
    (data) => data.maxDistance === undefined || (!Number.isNaN(data.maxDistance) && data.maxDistance >= 0),
    { message: "maxDistance must be a valid non-negative number" },
  )
  .refine(
    (data) => {
       if (data.table && data.srid === 4326) {
           return data.point.latitude >= -90 && data.point.latitude <= 90;
       }
       return true;
    },
    { message: "latitude must be between -90 and 90 degrees for SRID 4326" }
  )
  .refine(
    (data) => {
       if (data.table && data.srid === 4326) {
           return data.point.longitude >= -180 && data.point.longitude <= 180;
       }
       return true;
    },
    { message: "longitude must be between -180 and 180 degrees for SRID 4326" }
  )
  .refine((data) => !Number.isNaN(data.limit) && data.limit > 0, {
    message: "limit must be a positive number",
  })
  .refine((data) => !Number.isNaN(data.srid), {
    message: "srid must be a valid number",
  })
  .refine((data) => {
    if (!data.table) {
      if (!data.geometry1 || !data.geometry2) return false;
      const g1 = typeof data.geometry1 === "string" ? data.geometry1 : "";
      const g2 = typeof data.geometry2 === "string" ? data.geometry2 : "";
      return isValidWKT(g1) && isValidWKT(g2);
    }
    return true;
  }, {
    message: "geometry1 and geometry2 must be valid WKT strings (e.g. POINT(1 1))",
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
    limit: data.limit !== undefined ? Math.floor(Number(data.limit)) : 100,
    srid: data.srid !== undefined ? Math.floor(Number(data.srid)) : 4326,
  }))
)
  .refine((data) => data.polygon.trim() !== "", { message: "polygon (WKT) must be a non-empty string" })
  .refine((data) => {
    return isValidWKT(data.polygon);
  }, { message: "polygon must be a valid WKT string (e.g. POLYGON((...)))" })
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
    limit: data.limit !== undefined ? Math.floor(Number(data.limit)) : 100,
    srid: data.srid !== undefined ? Math.floor(Number(data.srid)) : 4326,
  }))
)
  .refine((data) => data.geometry.trim() !== "", { message: "geometry (WKT) must be a non-empty string" })
  .refine((data) => {
    return isValidWKT(data.geometry);
  }, { message: "geometry must be a valid WKT string (e.g. POINT(1 1))" })
  .refine((data) => !Number.isNaN(data.limit) && data.limit > 0, {
    message: "limit must be a positive number",
  })
  .refine((data) => !Number.isNaN(data.srid), {
    message: "srid must be a valid number",
  });

export const IntersectionSchemaBase = z.object({
  geometry1: z.unknown().optional().describe("First WKT geometry"),
  geometry2: z.unknown().optional().describe("Second WKT geometry"),
  geomColumn1: z.unknown().optional(),
  geomColumn2: z.unknown().optional(),
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
  .refine((data) => isValidWKT(data.geometry1) && isValidWKT(data.geometry2), { message: "both geometries must be valid WKT strings (e.g. POINT(1 1))" })
  .refine((data) => !Number.isNaN(data.srid), {
    message: "srid must be a valid number",
  })
  .refine((data) => {
    if (data.srid === 4326) {
        for (const geom of [data.geometry1, data.geometry2]) {
            const matches = geom.match(/[-\d.]+\s+[-\d.]+/g);
            if (matches) {
                for (const match of matches) {
                    const [lonStr, latStr] = match.split(/\s+/);
                    const lon = Number(lonStr);
                    const lat = Number(latStr);
                    if (lon < -180 || lon > 180) return false;
                    if (lat < -90 || lat > 90) return false;
                }
            }
        }
    }
    return true;
  }, { message: "longitude must be between -180 and 180, and latitude between -90 and 90 for SRID 4326" });

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
      "Number of segments per quarter-circle for buffer polygon approximation (default: 8, MySQL default: 32). Must be >= 1 and <= 128. Lower values produce simpler polygons with smaller payloads. Only effective with Cartesian geometries (SRID 0); geographic SRIDs use MySQL's internal algorithm.",
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
  .refine((data) => isValidWKT(data.geometry), { message: "geometry must be a valid WKT string (e.g. POINT(1 1))" })
  .refine((data) => {
    if (data.srid === 4326) {
      const g = data.geometry.trim().toUpperCase();
      return g.startsWith("POINT") || g.startsWith("MULTIPOINT");
    }
    return true;
  }, { message: "MySQL only supports ST_Buffer for POINT and MULTIPOINT geometries when using geographic SRS (SRID 4326). Use SRID 0 (Cartesian) for other geometries." })
  .refine((data) => {
    if (data.srid === 4326) {
        const matches = data.geometry.match(/[-\d.]+\s+[-\d.]+/g);
        if (matches) {
            for (const match of matches) {
                const [lonStr, latStr] = match.split(/\s+/);
                const lon = Number(lonStr);
                const lat = Number(latStr);
                if (lon < -180 || lon > 180) return false;
                if (lat < -90 || lat > 90) return false;
            }
        }
    }
    return true;
  }, { message: "longitude must be between -180 and 180, and latitude between -90 and 90 for SRID 4326" })
  .refine((data) => !Number.isNaN(data.distance), {
    message: "distance must be a valid number",
  })
  .refine((data) => {
    if (data.distance < 0) {
        const g = data.geometry.trim().toUpperCase();
        if (!g.startsWith("POLYGON") && !g.startsWith("MULTIPOLYGON")) {
            return false;
        }
    }
    return true;
  }, { message: "negative distance is only valid for POLYGON and MULTIPOLYGON geometries" })
  .refine((data) => !Number.isNaN(data.srid), {
    message: "srid must be a valid number",
  })
  .refine((data) => !Number.isNaN(data.segments) && data.segments >= 1 && data.segments <= 128, {
    message: "segments must be a valid number between 1 and 128",
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
  .refine((data) => isValidWKT(data.geometry), { message: "geometry must be a valid WKT string (e.g. POINT(1 1))" })
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
    geoJson: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
    srid: z.unknown().optional(),
  })
  .transform((data) => ({
    geometry: data.geometry ?? data.wkt,
    geoJson: typeof data.geoJson === 'object' && data.geoJson !== null ? JSON.stringify(data.geoJson) : (data.geoJson as string | undefined),
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
  if (data.geometry !== undefined && !isValidWKT(data.geometry)) return false;
  if (data.geoJson !== undefined) {
    if (data.geoJson.trim() === "") return false;
    try {
      const parsed = JSON.parse(data.geoJson) as unknown;
      if (typeof parsed !== "object" || parsed === null || !("type" in parsed)) return false;
      const type = parsed["type" as keyof typeof parsed];
      if (typeof type !== "string") return false;
      const validTypes = ["Point", "LineString", "Polygon", "MultiPoint", "MultiLineString", "MultiPolygon", "GeometryCollection", "Feature", "FeatureCollection"];
      if (!validTypes.includes(type)) return false;
    } catch {
      return false;
    }
  }
  return true;
}, { message: "Provided geometry must be a valid WKT string, or geoJson must be a valid GeoJSON object" });

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
