import { z } from "zod";

export const ShowProcesslistSchemaBase = z.object({
  full: z.boolean().optional().default(false).describe("Show full query text"),
  all: z.boolean().optional().describe("Alias for full"),
  verbose: z.boolean().optional().describe("Alias for full"),
  complete: z.boolean().optional().describe("Alias for full"),
  limit: z
    .unknown()
    .optional()
    .describe(
      "Maximum number of processes to return (default: 10). Set higher to see all.",
    ),
  summary: z.boolean().optional().describe("Return only summarized counts"),
});

export const ShowProcesslistSchema = z.preprocess(
  (obj: unknown) => {
    if (typeof obj === "object" && obj !== null) {
      const data = obj as Record<string, unknown>;
      const { all, verbose, complete, full, ...rest } = data;
      const result: Record<string, unknown> = {
        ...rest,
        full: full ?? all ?? verbose ?? complete,
      };
      
      if (typeof result["full"] === "string") result["full"] = result["full"] === "true" || result["full"] === "1";
      if (typeof result["full"] === "number") result["full"] = result["full"] === 1;
      if (typeof result["summary"] === "string") result["summary"] = result["summary"] === "true" || result["summary"] === "1";
      if (typeof result["summary"] === "number") result["summary"] = result["summary"] === 1;
      
      return result;
    }
    return obj;
  },
  ShowProcesslistSchemaBase
  .transform((data) => ({
    full: data.full,
    limit: data.limit !== undefined ? Number(data.limit) : 10,
    summary: data.summary ?? false,
  }))
  .refine(
    (data) =>
      data.limit === undefined || (!Number.isNaN(data.limit) && data.limit > 0),
    { message: "limit must be a positive integer" },
  )
);

try {
  console.log("Parsing...");
  const params = { all: "true", complete: 1, full: "true", limit: "5", summary: "false", verbose: 1 };
  const result = ShowProcesslistSchema.parse(params);
  console.log("SUCCESS:", result);
} catch (e) {
  if (e instanceof z.ZodError) {
    console.log("Validation error: " + e.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; "));
  } else {
    console.log(e.message);
  }
}
