import { z } from "zod";
import { JsonArrayAppendSchema } from "../src/adapters/mysql/schemas/json/modify.js";

const input = {
  tableName: "test_json_docs",
  columnName: "tags",
  key: "$",
  data: "test",
  filter: "id = 1"
};

try {
  const res = JsonArrayAppendSchema.parse(input);
  console.log("Success:", res);
} catch (e) {
  console.error("Error:", e);
}
