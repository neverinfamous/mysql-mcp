# Spatial Tools (`mysql_spatial_*`)

- **Coordinate Order**: All spatial tools use standard **longitude, latitude** parameter order (X, Y), matching GeoJSON and common mapping conventions.
  - ✅ Example: `{ longitude: -122.4194, latitude: 37.7749 }` for San Francisco
  - MySQL 8.0+ uses EPSG standard axis order (latitude, longitude) internally for SRID 4326, but tools handle this conversion automatically using `axis-order=long-lat` option.
- **SRID 4326**: Default spatial reference system is WGS 84 (GPS coordinates). Use `srid` parameter to specify other coordinate systems.
- **WKT Input**: When providing WKT geometry strings, use **longitude first** order: `POINT(-122.4194 37.7749)`.
- **SPATIAL Indexes**: `mysql_spatial_create_index` requires the column to be NOT NULL. The tool validates this and provides an ALTER TABLE suggestion if needed.
- **GeoJSON Conversion**: `mysql_spatial_geojson` converts between WKT and GeoJSON formats. `mysql_spatial_point`, `mysql_spatial_polygon`, `mysql_spatial_intersection`, `mysql_spatial_buffer`, and `mysql_spatial_transform` also return GeoJSON representations.
- **Buffer Segments**: `mysql_spatial_buffer` accepts an optional `segments` parameter (default: 8, MySQL default: 32) controlling the number of segments per quarter-circle in the buffer polygon approximation. Lower values produce simpler polygons with smaller payloads. Note: `segments` only takes effect with Cartesian geometries (SRID 0); geographic SRIDs (e.g., 4326) use MySQL's internal geographic buffer algorithm which does not support custom segment counts. The response includes `segmentsApplied: true/false` to indicate whether the parameter was effective.
- **Error Handling (P154)**: Table-querying tools (`distance`, `distance_sphere`, `contains`, `within`, `create_column`, `create_index`) return `{ exists: false, table }` for nonexistent tables. `create_column` returns `{ success: false, error }` for duplicate columns. All tools return `{ success: false, error }` for invalid WKT, coordinates, SRIDs, or other MySQL errors instead of raw exceptions.
