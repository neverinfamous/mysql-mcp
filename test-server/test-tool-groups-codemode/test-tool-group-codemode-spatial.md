# mysql-mcp Code Mode Re-Testing: [spatial]

**ESSENTIAL INSTRUCTIONS**

- Conduct an exhaustive test using ONLY code mode (`mysql_execute_code`).
- Do not modify or skip tests. Return an aggregated `failures` array.
- All changes MUST be consistent with other mysql-mcp tools and `../code-map.md`.

## Reporting: ❌ Fail | ⚠️ Issue | 📦 Payload (monitor `metrics.tokenEstimate`)
> **Important**: ALWAYS use `tmp/task.md` as your scratchpad for testing and reporting results. DO NOT modify this testing prompt file directly.

## Test Data: `test_locations` (15 rows, geom POINT SRID 4326)

## Requirements

1. 
2. 

---

## Group Focus: spatial

spatial Tool Group (12 tools +1 code mode):

1. `mysql_spatial_create_column` 2. `mysql_spatial_create_index` 3. `mysql_spatial_point`
4. `mysql_spatial_polygon` 5. `mysql_spatial_distance` 6. `mysql_spatial_distance_sphere`
7. `mysql_spatial_contains` 8. `mysql_spatial_within` 9. `mysql_spatial_intersection`
10. `mysql_spatial_buffer` 11. `mysql_spatial_transform` 12. `mysql_spatial_geojson`

> **Instructions**: Use `mysql.*` namespace, push deviations to `failures` array.

1. `mysql.spatial.help()` → verify method listing
2. `mysql.spatial.distanceSphere({table: "test_locations", geometryColumn: "geom", latitude: 40.7128, longitude: -74.0060, limit: 3})` → 3 nearest
3. `mysql.spatial.contains({table: "test_locations", geometryColumn: "geom", wkt: "POLYGON((-180 -90, 180 -90, 180 90, -180 90, -180 -90))"})` → all contained
4. `mysql.spatial.buffer({table: "test_locations", geometryColumn: "geom", distance: 1000, where: "id = 1"})` → buffer geometry

**Domain error paths (🔴):**

5. 🔴 `mysql.spatial.distanceSphere({table: "nonexistent_xyz", geometryColumn: "geom", latitude: 0, longitude: 0})` → `{success: false}`
6. 🔴 `mysql.spatial.distanceSphere({table: "test_locations", geometryColumn: "nonexistent_col", latitude: 0, longitude: 0})` → `{success: false}`

**Zod validation error paths (🔴):**

7. 🔴 `mysql.spatial.distanceSphere({})` → `{success: false, error: "Validation error: ..."}`
8. 🔴 `mysql.spatial.point({})` → `{success: false, error: "Validation error: ..."}`
9. 🔴 `mysql.spatial.createColumn({})` → `{success: false, error: "Validation error: ..."}`
