import { ProxySQLVariableFilterSchema, ProxySQLStatusInputSchema, ProxySQLLimitInputSchema } from "./src/adapters/mysql/schemas/proxysql.js";

console.log("Global Vars like: true =>", ProxySQLVariableFilterSchema.parse({ like: true }));
console.log("Status summary: unknown =>", ProxySQLStatusInputSchema.parse({ summary: "unknown" }));
console.log("Status summary: 'yes' =>", ProxySQLStatusInputSchema.parse({ summary: "yes" }));
console.log("Limit: ' 10 ' =>", ProxySQLLimitInputSchema.parse({ limit: " 10 " }));
console.log("Limit: 'invalid' =>", ProxySQLLimitInputSchema.parse({ limit: "invalid" }));
