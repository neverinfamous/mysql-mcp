# Server Instructions Overview

**🤖 AGENT INSTRUCTIONS**

This directory contains Markdown files that serve as the foundation for the dynamic help system. The system presents these files directly to AI agents. Agents use them for context-gathering queries.

## ⚠️ Protect Generated Instructions for System Stability

**DO NOT** edit `src/constants/server-instructions.ts` directly. The system auto-generates this file.

To update instructions or gotchas, follow these steps:

1. Modify the relevant `.md` file in this directory.
2. Run the generator script. It compiles markdown files into the TypeScript constant map:
   ```bash
   pnpm run generate:instructions
   ```
   _(or `npx tsx scripts/generate-server-instructions.ts`)_
3. The script converts your markdown into escaped strings. It embeds them in `server-instructions.ts`.

## Navigate the File Structure for Rapid Context

- `overview.md`: The server sends these minimal instructions on initialization. Keep this short (~150 tokens). It preserves context limits.
- `gotchas.md`: The server returns this core payload for `mysql://help`. It contains critical usage patterns.
- `[group-name].md`: The server returns group-specific hints for `mysql://help/[group-name]`.

## Write Effective Instructions to Empower AI Agents

- Write strictly for AI consumption. Be concise and rule-based.
- Use code blocks for exact schemas and examples.
- Watch payload sizes. Do not include the entire documentation.
