import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
console.log("_zod in CallToolResultSchema:", !!CallToolResultSchema._zod);
console.log("_def in CallToolResultSchema:", !!CallToolResultSchema._def);
console.log("typeof safeParse:", typeof CallToolResultSchema.safeParse);
