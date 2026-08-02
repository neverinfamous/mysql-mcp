import { MySQLAdapter } from "./src/adapters/mysql/adapter.ts";
import { getToolGroup } from "./src/filtering/registry.ts";

async function run() {
  const adapter = new MySQLAdapter({
    host: "127.0.0.1",
    port: 3307,
    user: "cluster_admin",
    password: "cluster_admin",
    database: "testdb"
  });
  await adapter.connect();

  const spatialTools = getToolGroup("spatial");
  const tool = spatialTools.find((t: any) => t.name === "mysql_spatial_distance_sphere");
  if (!tool) {
    console.error("Tool not found");
    return;
  }

  const result = await tool.handler(adapter, {
    point: { latitude: 40.7128, longitude: -74.006 },
    spatialColumn: "geom",
    srid: 0,
    table: "test_locations"
  });

  console.log(JSON.stringify(result, null, 2));
  await adapter.disconnect();
}

run().catch(console.error);
