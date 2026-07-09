import { z } from "zod";
const schema = z.object({ a: z.string() });
console.log("schema._zod =", !!schema._zod);
console.log("schema._def =", !!schema._def);
console.log("typeof schema.safeParse =", typeof schema.safeParse);
console.log("typeof z.safeParse =", typeof z.safeParse);
