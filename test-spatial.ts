import { PolygonSchema } from "./src/adapters/mysql/schemas/spatial";
try {
  const result = PolygonSchema.parse({coordinates: [[["0","0"],["0","10"],["10","10"],["10","0"],["0","0"]]], srid: 4326});
  console.log("SUCCESS:", JSON.stringify(result));
} catch (e) {
  console.error("FAIL:", e.errors);
}
