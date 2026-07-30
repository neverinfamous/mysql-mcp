import { RouteNameInputSchema } from "./src/adapters/mysql/schemas/router.js";
try {
  const result = RouteNameInputSchema.parse({ route: "test_route" });
  console.log("Success:", result);
} catch (e: any) {
  console.error(e.message);
}
