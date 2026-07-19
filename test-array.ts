import { JsonRemoveSchema } from "./src/adapters/mysql/schemas/json/modify.ts";
const parsed = JsonRemoveSchema.parse({
  table: "test_json_docs",
  column: "doc",
  paths: ["$.author", "date"],
  where: "id = 1"
});
console.log("PARSED ARRAY:", parsed);
