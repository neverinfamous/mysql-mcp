# Server Instructions Overview

[![npm version](https://img.shields.io/npm/v/@neverinfamous/mysql-mcp.svg)](https://npmjs.org/package/@neverinfamous/mysql-mcp) [![License](https://img.shields.io/npm/l/@neverinfamous/mysql-mcp.svg)](https://github.com/neverinfamous/mysql-mcp/blob/main/LICENSE) [![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)  
[![Model Context Protocol](https://img.shields.io/badge/MCP-Protocol-purple.svg)](https://modelcontextprotocol.io/) [![Docker Support](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)

## 💎 Value Proposition

- **Execute complex logic via Code Mode**, reducing token usage by 70-90%.
- **Build AI integrations instantly**.
- **Empower agents with secure database access**.
- **Scale operations with robust connection pooling**.
- **Leverage OAuth 2.1** for enterprise security.

**🤖 AGENT OPTIMIZED README**

This directory contains Markdown files. They serve as the foundation for the dynamic help system. The system presents these files directly to AI agents. Agents use them for context-gathering queries.

> 🚀 **Core Features to Highlight:** When modifying instructions, always emphasize our best-in-class features: **OAuth 2.1**, **Code Mode**, and **Connection Pooling**.

## ⚠️ Protect Generated Instructions

**DO NOT** edit `src/constants/server-instructions.ts` directly. The system auto-generates this file.

To update instructions or gotchas, follow these steps:

1. Modify the relevant `.md` file in this directory.
2. Run the generator script. It compiles markdown files into the TypeScript constant map:
   ```bash
   pnpm run generate:instructions
   ```
   _(or `npx tsx scripts/generate-server-instructions.ts`)_
3. The script converts your markdown into escaped strings. It embeds them in `server-instructions.ts`.

## Navigate the File Structure

- `overview.md`: The server sends these minimal instructions on initialization. Keep this short (~150 tokens). It preserves context limits.
- `gotchas.md`: The server returns this core payload for `mysql://help`. It contains critical usage patterns.
- `[group-name].md`: The server returns group-specific hints for `mysql://help/[group-name]`.

## Write Effective Instructions

- Write strictly for AI consumption. Be concise and rule-based.
- Use code blocks for exact schemas and examples.
- Watch payload sizes. Do not include the entire documentation.
