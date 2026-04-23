# mysql-mcp Tool Group Testing: [spatial]

**ESSENTIAL INSTRUCTIONS**

- Execute **EVERY** numbered test below using direct MCP tool calls, **NOT** codemode.
- Do not use scripts or terminal to replace planned tests.
- Do not modify or skip tests.
- Do not put temp files in root; Use C:\Users\chris\Desktop\mysql-mcp\tmp

## Reporting Format

- ❌ Fail: Tool errors or produces incorrect results (include error message)
- ⚠️ Issue: Unexpected behavior or improvement opportunity
- 📦 Payload: Unnecessarily large response that should be optimized.

> **Token estimates**: Every tool response includes `_meta.tokenEstimate` in its `content[].text` payload.

## Test Database Schema

| Table | Rows | Key Columns |
|-------|------|-------------|
| `test_locations` | 15 | id, name, city, latitude, longitude, geom (POINT SRID 4326) |

## Structured Error Response Pattern

| Type | What you see | Verdict |
|------|-------------|---------|
| **Handler error** ✅ | Parseable JSON with `success` and `error` fields | Correct |
| **MCP error** ❌ | Raw text error string with `isError: true` | Bug |

## P154 / Cleanup / Post-Test

- All tools accepting table names must return structured errors for nonexistent tables.
- Prefix temp tables with `temp_*`, drop after testing.
- After testing: fix findings, read `code-map.md` before changes, update changelog, commit without pushing.

---

## Group Focus: spatial

### spatial Group-Specific Testing

spatial Tool Group (12 tools +1 for code mode):

1. 'mysql_spatial_create_column'
2. 'mysql_spatial_create_index'
3. 'mysql_spatial_point'
4. 'mysql_spatial_polygon'
5. 'mysql_spatial_distance'
6. 'mysql_spatial_distance_sphere'
7. 'mysql_spatial_contains'
8. 'mysql_spatial_within'
9. 'mysql_spatial_intersection'
10. 'mysql_spatial_buffer'
11. 'mysql_spatial_transform'
12. 'mysql_spatial_geojson'
13. 'mysql_execute_code' (codemode, auto-added)

> **Instructions**: Execute every numbered checklist item with the exact inputs shown using DIRECT TOOL CALLS ONLY.

**Test data:** Uses `test_locations` (15 rows, geom POINT SRID 4326).

1. `mysql_spatial_distance_sphere({table: "test_locations", geometryColumn: "geom", latitude: 40.7128, longitude: -74.0060, limit: 3})` → 3 nearest locations with distances
2. `mysql_spatial_point({table: "test_locations", column: "geom", latitude: 40.7128, longitude: -74.0060, where: "id = 1"})` → verify point creation
3. `mysql_spatial_contains({table: "test_locations", geometryColumn: "geom", wkt: "POLYGON((-180 -90, 180 -90, 180 90, -180 90, -180 -90))"})` → all locations contained
4. `mysql_spatial_buffer({table: "test_locations", geometryColumn: "geom", distance: 1000, where: "id = 1"})` → verify buffer geometry

**Domain error paths (🔴):**

5. 🔴 `mysql_spatial_distance_sphere({table: "nonexistent_xyz", geometryColumn: "geom", latitude: 0, longitude: 0})` → `{success: false, error: "..."}` handler error
6. 🔴 `mysql_spatial_distance_sphere({table: "test_locations", geometryColumn: "nonexistent_col", latitude: 0, longitude: 0})` → `{success: false, error: "..."}`

**Zod validation error paths (🔴):**

7. 🔴 `mysql_spatial_distance_sphere({})` → `{success: false, error: "..."}` (Zod validation)
8. 🔴 `mysql_spatial_point({})` → `{success: false, error: "..."}` (missing required params)
9. 🔴 `mysql_spatial_create_column({})` → `{success: false, error: "..."}` (missing required params)

**Wrong-type numeric param coercion (🔴):**

10. 🔴 `mysql_spatial_distance_sphere({table: "test_locations", geometryColumn: "geom", latitude: "abc", longitude: -74})` → must NOT return raw MCP error
11. 🔴 `mysql_spatial_distance_sphere({table: "test_locations", geometryColumn: "geom", latitude: 40, longitude: -74, limit: "abc"})` → must NOT return raw MCP error
