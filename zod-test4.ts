import { JsonKeysSchema } from "./src/adapters/mysql/schemas/json/extract.ts";
try {
  const result = JsonKeysSchema.parse({ tableName: 'test_json_docs', columnName: 'doc', jsonPath: '$invalid[' });
  console.log("SUCCESS:", result);
} catch (e) {
  console.log('ERROR:', e);
}
