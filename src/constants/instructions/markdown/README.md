# Server Instructions

This directory contains the source of truth for the MCP server instructions in Markdown format.
These `.md` files are compiled into TypeScript constants in `src/constants/instructions/*.ts` by the `scripts/generate-server-instructions.ts` script.

If you make any changes to the markdown files in this directory, you must run the build script to synchronize the changes into the actual server codebase:

```bash
pnpm run generate:instructions
```

## Structure
- Each `.md` file corresponds to a tool group (e.g., `admin.md` -> `admin.ts`).
- `overview.md` is compiled into `base.ts` as the root `INSTRUCTIONS` export.
- `gotchas.md` contains the `mysql://help` overview and common pitfalls.
- Ensure any tool added to the system is documented in its respective group's markdown file to ensure agents have accurate context.
