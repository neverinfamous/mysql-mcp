import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    cli: "src/cli.ts"
  },
  format: ["esm"],
  dts: false,
  clean: true,
  treeshake: true,
  splitting: true,
  sourcemap: false,
  minify: false,
  outDir: "dist",
  target: "es2022",
  external: [
    "mysql2",
    "@modelcontextprotocol/sdk",
    "zod",
    "jose",
    "isolated-vm",
    "acorn"
  ],
  tsconfig: "tsconfig.build.json",
});
