import { z } from "zod";

export const JsonMergeSchema = z
  .object({
    json1: z.unknown().optional().describe("First JSON document"),
    doc1: z.unknown().optional().describe("Alias for json1"),
    json2: z.unknown().optional().describe("Second JSON document"),
    doc2: z.unknown().optional().describe("Alias for json2"),
    mode: z
      .enum(["patch", "preserve"])
      .default("patch")
      .describe("Merge mode: patch (RFC 7396) or preserve (array merge)"),
  })
  .transform((data) => {
    const val1 = data.json1 !== undefined ? data.json1 : data.doc1;
    const val2 = data.json2 !== undefined ? data.json2 : data.doc2;
    return {
      json1: typeof val1 === "string" ? val1 : JSON.stringify(val1),
      json2: typeof val2 === "string" ? val2 : JSON.stringify(val2),
      mode: data.mode,
      _raw1: val1,
      _raw2: val2,
    };
  })
  .refine((data) => data._raw1 !== undefined, {
    message: "json1 (or doc1 alias) is required",
  })
  .refine((data) => data._raw2 !== undefined, {
    message: "json2 (or doc2 alias) is required",
  });

export const JsonDiffSchema = z
  .object({
    json1: z.unknown().optional().describe("First JSON document"),
    doc1: z.unknown().optional().describe("Alias for json1"),
    json2: z.unknown().optional().describe("Second JSON document"),
    doc2: z.unknown().optional().describe("Alias for json2"),
  })
  .transform((data) => {
    const val1 = data.json1 !== undefined ? data.json1 : data.doc1;
    const val2 = data.json2 !== undefined ? data.json2 : data.doc2;
    return {
      json1: typeof val1 === "string" ? val1 : JSON.stringify(val1),
      json2: typeof val2 === "string" ? val2 : JSON.stringify(val2),
      _raw1: val1,
      _raw2: val2,
    };
  })
  .refine((data) => data._raw1 !== undefined, {
    message: "json1 (or doc1 alias) is required",
  })
  .refine((data) => data._raw2 !== undefined, {
    message: "json2 (or doc2 alias) is required",
  });
