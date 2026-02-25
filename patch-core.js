import * as fs from "fs";

const file = "src/adapters/mysql/tools/core.ts";
let content = fs.readFileSync(file, "utf8");

// 1. Add ZodError import and helper if missing
if (!content.includes("formatZodError")) {
  content = content.replace(
    /\} from "\.\.\/types\.js";/,
    `} from "../types.js";\nimport { ZodError } from "zod";\n\n/**\n * Extract human-readable messages from a ZodError instead of raw JSON array\n */\nfunction formatZodError(error: ZodError): string {\n  return error.issues.map((i) => i.message).join("; ");\n}`,
  );
}

// 2. Replace Schema parses safely
const patterns = [
  {
    schema: "ReadQuerySchema",
    props: "query, params: queryParams, transactionId",
  },
  {
    schema: "WriteQuerySchema",
    props: "query, params: queryParams, transactionId",
  },
  { schema: "ListTablesSchema", props: "database" },
  { schema: "DescribeTableSchema", props: "table" },
  {
    schema: "CreateTableSchema",
    props: "name, columns, engine, charset, collate, comment, ifNotExists",
  },
  { schema: "DropTableSchema", props: "table, ifExists" },
  { schema: "GetIndexesSchema", props: "table" },
  {
    schema: "CreateIndexSchema",
    props: "name, table, columns, unique, type, ifNotExists",
  },
];

for (const p of patterns) {
  // Use [^}]*? to ensure it only matches inside a single destructuring block, not spanning across the file!
  const regex = new RegExp(
    `const\\s+\\{\\s*([^}]*?)\\s*\\}\\s*=\\s*${p.schema}\\.parse\\(params\\);`,
    "g",
  );

  content = content.replace(regex, (match, propsMatch) => {
    const propsText = propsMatch ? propsMatch.trim() : p.props;

    return `let parsed;\n      try {\n        parsed = ${p.schema}.parse(params);\n      } catch (err: unknown) {\n        if (err instanceof ZodError) return { success: false, error: formatZodError(err) };\n        throw err;\n      }\n      const { ${propsText} } = parsed;`;
  });
}

fs.writeFileSync(file, content);
console.log("Patched core.ts successfully with fixed regex.");
