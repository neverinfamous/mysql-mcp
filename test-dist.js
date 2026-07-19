import { JsonRemoveSchema } from "./dist/adapters/mysql/schemas/json/modify.js";
import mysql from "mysql2";
const parsed = JsonRemoveSchema.parse({
  table: "test_json_docs",
  column: "doc",
  paths: "author",
  where: "id = 1"
});
console.log("PARSED DIST:", parsed);
const pathArgs = parsed.paths.map(p => mysql.escape(p)).join(", ");
console.log("PATHARGS DIST:", pathArgs);
