# Server Instructions

> **Value Proposition:** Managing instructions in Markdown provides a readable, centralized source of truth for agent prompting. It empowers domain experts to iterate on agent behavior safely, independently from code deployments.

This directory contains the source of truth for MCP server instructions.
The `scripts/generate-server-instructions.ts` script compiles these `.md` files into TypeScript constants (`src/constants/instructions/*.ts`).

After editing markdown files here, run the build script to sync changes:

```bash
pnpm run generate:instructions
```

## Structure
- Each `.md` file corresponds to a tool group (e.g., `admin.md` -> `admin.ts`).
- `overview.md` compiles into `base.ts` as the root `INSTRUCTIONS` export.
- `gotchas.md` contains the `mysql://help` overview and common pitfalls.
- Document any new tool in its respective markdown file to provide agents accurate context.
