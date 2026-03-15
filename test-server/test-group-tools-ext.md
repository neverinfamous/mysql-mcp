# Group-Specific Tool Testing — Spatial, Partitioning, Events

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

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation. These are the minimum-bar tests that must pass every run — freeform testing comes after.

**Test data:** Uses `test_locations.geom` (POINT with SRID 4326). Cities: New York, Paris, London, Tokyo, Sydney, San Francisco.

**Checklist:**

1. `mysql_spatial_point({lat: 40.7128, lng: -74.006})` → verify POINT geometry returned with WKT
2. `mysql_spatial_distance_sphere({table: "test_locations", column: "geom", lat: 40.7128, lng: -74.006, radius: 100000})` → expect: New York locations in results
3. `mysql_spatial_distance({point1: "POINT(-74.006 40.7128)", point2: "POINT(-0.1276 51.5074)"})` → verify distance returned (NYC to London)
4. `mysql_spatial_geojson({table: "test_locations", column: "geom", where: "city = 'New York'"})` → verify GeoJSON output

**Create → Use → Drop lifecycle:**

5. `mysql_spatial_create_column({table: "temp_spatial_test", column: "location", type: "POINT", srid: 4326})` → first create `temp_spatial_test` table, then add spatial column
6. `mysql_spatial_create_index({table: "temp_spatial_test", column: "location"})` → verify SPATIAL index created

**Domain error paths (🔴):**

7. 🔴 `mysql_spatial_distance_sphere({table: "nonexistent_xyz", column: "geom", lat: 0, lng: 0, radius: 100})` → `{success: false, error: "..."}` handler error
8. 🔴 `mysql_spatial_point({lat: 91, lng: 0})` → report behavior for out-of-bounds latitude

**Zod validation error paths (🔴):**

9. 🔴 `mysql_spatial_point({})` → `{success: false, error: "..."}` (missing required `lat`/`lng`)
10. 🔴 `mysql_spatial_distance({})` → `{success: false, error: "..."}` (missing required params)

**Wrong-type numeric param coercion (🔴):**

11. 🔴 `mysql_spatial_distance_sphere({table: "test_locations", column: "geom", lat: 40.7128, lng: -74.006, radius: "abc"})` → must NOT return raw MCP error

**Code mode parity:**

12. `mysql_execute_code({code: "return await mysql.spatial.help()"})` → verify lists spatial methods

**Cleanup:**

13. Drop `temp_spatial_test` if created

---

### partitioning Group-Specific Testing

partitioning Tool Group (4 tools +1 for code mode):

1. 'mysql_partition_info'
2. 'mysql_add_partition'
3. 'mysql_drop_partition'
4. 'mysql_reorganize_partition'
5. 'mysql_execute_code' (codemode, auto-added)

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation. These are the minimum-bar tests that must pass every run — freeform testing comes after.

**Test data:** Uses `test_partitioned` with 4 LIST COLUMNS partitions by region. Regions: east, northeast, west, northwest, central, midwest, south, southeast.

**Checklist:**

1. `mysql_partition_info({table: "test_partitioned"})` → verify 4 partitions listed with row counts
2. `mysql_partition_info({table: "test_partitioned"})` → verify partition names and region assignments

**Domain error paths (🔴):**

3. 🔴 `mysql_partition_info({table: "nonexistent_table_xyz"})` → `{success: false, error: "..."}` handler error
4. 🔴 `mysql_partition_info({table: "test_products"})` → should indicate table is not partitioned (not error)

**Zod validation error paths (🔴):**

5. 🔴 `mysql_partition_info({})` → `{success: false, error: "..."}` (missing required `table`)
6. 🔴 `mysql_add_partition({})` → `{success: false, error: "..."}` (missing required params)

**Code mode parity:**

7. `mysql_execute_code({code: "return await mysql.partitioning.help()"})` → verify lists partitioning methods

---

### events Group-Specific Testing

events Tool Group (6 tools +1 for code mode):

1. 'mysql_event_create'
2. 'mysql_event_alter'
3. 'mysql_event_drop'
4. 'mysql_event_list'
5. 'mysql_event_status'
6. 'mysql_scheduler_status'
7. 'mysql_execute_code' (codemode, auto-added)

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation. These are the minimum-bar tests that must pass every run — freeform testing comes after.

1. `mysql_scheduler_status()` → verify `{enabled: true/false}`
2. `mysql_event_list({database: "testdb"})` → verify response structure `{events: [...]}`

**Create → Use → Drop lifecycle:**

3. `mysql_event_create({name: "temp_event_test", schedule: "EVERY 1 DAY", body: "SELECT 1", database: "testdb"})` → `{success: true}`
4. `mysql_event_list({database: "testdb"})` → verify `temp_event_test` appears
5. `mysql_event_status({name: "temp_event_test", database: "testdb"})` → verify event details
6. `mysql_event_drop({name: "temp_event_test", database: "testdb"})` → `{success: true}`

**Domain error paths (🔴):**

7. 🔴 `mysql_event_drop({name: "nonexistent_event_xyz", database: "testdb"})` → `{success: false, error: "..."}` handler error
8. 🔴 `mysql_event_status({name: "nonexistent_event_xyz", database: "testdb"})` → `{success: false, error: "..."}`

**Zod validation error paths (🔴):**

9. 🔴 `mysql_event_create({})` → `{success: false, error: "..."}` (missing required params)

**Code mode parity:**

10. `mysql_execute_code({code: "return await mysql.events.help()"})` → verify lists event methods

