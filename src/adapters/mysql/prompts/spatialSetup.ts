/**
 * MySQL Prompt - Spatial/GIS Setup
 *
 * Complete Spatial data and GIS setup guide.
 */
import type { PromptDefinition, RequestContext } from "../../../types/index.js";

export function createSetupSpatialPrompt(): PromptDefinition {
  return {
    name: "mysql_setup_spatial",
    description: "Complete MySQL Spatial/GIS setup and usage guide",
    arguments: [],
    handler: (_args: Record<string, string>, _context: RequestContext) => {
      return Promise.resolve(`# MySQL Spatial/GIS Setup Guide

MySQL provides native spatial data support with geometry types and spatial functions (ST_*).

## Prerequisites

1. **MySQL 5.7+** for full spatial support
2. **MySQL 8.0+** for proper SRID enforcement
3. **InnoDB engine** for spatial indexes

## Step 1: Create Spatial Columns

\`\`\`sql
CREATE TABLE locations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100),
    location POINT NOT NULL SRID 4326,
    boundary POLYGON SRID 4326,
    SPATIAL INDEX (location)
);
\`\`\`

## Step 2: Insert Spatial Data

\`\`\`sql
-- Using WKT (Well-Known Text)
INSERT INTO locations (name, location) VALUES
('Office', ST_GeomFromText('POINT(40.7484 -73.9857)', 4326));

-- Using GeoJSON
INSERT INTO locations (name, location) VALUES
('Store', ST_GeomFromGeoJSON('{"type":"Point","coordinates":[-73.9857,40.7484]}'));
\`\`\`

## Step 3: Query Spatial Data

\`\`\`sql
-- Find points within distance (meters for SRID 4326)
SELECT name, ST_Distance_Sphere(
    location,
    ST_GeomFromText('POINT(40.7128 -74.0060)', 4326)
) AS distance_meters
FROM locations
ORDER BY distance_meters
LIMIT 10;

-- Points within polygon
SELECT * FROM locations
WHERE ST_Contains(
    ST_GeomFromText('POLYGON((...))'),
    location
);
\`\`\`

## Common SRIDs

| SRID | Name | Use Case |
|------|------|----------|
| 4326 | WGS 84 | GPS coordinates (lon/lat) |
| 3857 | Web Mercator | Web maps |
| 0 | Planar | Local/metric calculations |

## Available MCP Tools

| Tool | Description |
|------|-------------|
| \`mysql_spatial_create_column\` | Add geometry column |
| \`mysql_spatial_create_index\` | Create SPATIAL index |
| \`mysql_spatial_point\` | Create POINT geometry |
| \`mysql_spatial_polygon\` | Create POLYGON geometry |
| \`mysql_spatial_distance\` | Calculate distance |
| \`mysql_spatial_distance_sphere\` | Spherical distance |
| \`mysql_spatial_contains\` | ST_Contains check |
| \`mysql_spatial_within\` | ST_Within check |
| \`mysql_spatial_intersection\` | Find intersection |
| \`mysql_spatial_buffer\` | Create buffer zone |
| \`mysql_spatial_transform\` | Transform SRID |
| \`mysql_spatial_geojson\` | Convert GeoJSON |

## Best Practices

1. **Always specify SRID** for geographic data
2. **Use SRID 4326** for GPS/lon-lat coordinates
3. **Index spatial columns** for query performance
4. **Use ST_Distance_Sphere** for earth distance calculations

## Common Issues

1. **SRID mismatch**: Ensure all geometries use same SRID
2. **Coordinate order**: MySQL 8.0+ with SRID 4326 uses (X, Y) = (latitude, longitude) per EPSG standard
3. **Index not used**: Check column is NOT NULL

Start by creating a spatial column with \`mysql_spatial_create_column\`.`);
    },
  };
}
