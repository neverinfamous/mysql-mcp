import { zodToJsonSchema } from "zod-to-json-schema";
import { ShowProcesslistSchema, ShowProcesslistSchemaBase } from "./src/adapters/mysql/schemas/admin.js";

console.log("BASE SCHEMA:");
console.log(JSON.stringify(zodToJsonSchema(ShowProcesslistSchemaBase), null, 2));

console.log("\nPREPROCESSED SCHEMA:");
console.log(JSON.stringify(zodToJsonSchema(ShowProcesslistSchema), null, 2));
