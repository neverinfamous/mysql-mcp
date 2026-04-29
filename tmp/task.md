# MySQL-MCP Spatial Tool Group Certification

## Coverage Matrix

| Tool / Method | Happy Path | Domain Error Path | Zod Validation Error |
|---------------|------------|-------------------|----------------------|
| `mysql_spatial_create_column` | ✅ Passed | ✅ Passed | ✅ Passed |
| `mysql_spatial_create_index` | ✅ Passed | ✅ Passed | ✅ Passed |
| `mysql_spatial_point` | ✅ Passed | N/A | ✅ Passed |
| `mysql_spatial_polygon` | ✅ Passed | N/A | ✅ Passed |
| `mysql_spatial_distance` | ✅ Passed | ✅ Passed | ✅ Passed |
| `mysql_spatial_distance_sphere` | ✅ Passed | ✅ Passed | ✅ Passed |
| `mysql_spatial_contains` | ✅ Passed | ✅ Passed | ✅ Passed |
| `mysql_spatial_within` | ✅ Passed | ✅ Passed | ✅ Passed |
| `mysql_spatial_intersection` | ✅ Passed | N/A | ✅ Passed |
| `mysql_spatial_buffer` | ✅ Passed | N/A | ✅ Passed |
| `mysql_spatial_transform` | ✅ Passed | N/A | ✅ Passed |
| `mysql_spatial_geojson` | ✅ Passed | ✅ Passed | ✅ Passed |

## Notes
- `createColumn` and `createIndex` tested successfully on a fresh empty table since adding a `NOT NULL` GEOMETRY column to a table with rows violates MySQL constraints without a default value.
- All spatial query tools successfully return `ErrorResponse` structured objects for non-existent tables/columns.
- All tools strictly enforce valid numbers and SRIDs via Zod schemas.
- `geojson` properly validates exclusive input (`geometry` XOR `geoJson`).
- All tools adhere to the standard structured error contract (`{ success: false, error: "..." }`).
