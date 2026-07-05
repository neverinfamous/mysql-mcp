# Server Instructions Overview

[![npm version](https://img.shields.io/npm/v/mysql-mcp.svg)](https://npmjs.org/package/mysql-mcp) [![License](https://img.shields.io/npm/l/mysql-mcp.svg)](https://github.com/neverinfamous/mysql-mcp/blob/main/LICENSE) [![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)  
[![Model Context Protocol](https://img.shields.io/badge/MCP-Protocol-purple.svg)](https://modelcontextprotocol.io/) [![Docker Support](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)

## Value Proposition
Build AI integrations instantly.
Empower agents with secure database access.
Execute complex logic via Code Mode.
Scale operations with robust connection pooling.
Leverage OAuth 2.1 for enterprise security.

**🤖 AGENT OPTIMIZED README**

This directory contains the Markdown files that serve as the foundation for the `mysql-mcp` dynamic help system. These files are presented directly to AI agents making context-gathering queries.

> 🚀 **Core Features to Highlight:** When modifying instructions, always emphasize our best-in-class features: **OAuth 2.1**, **Code Mode**, and **Connection Pooling**.

## ⚠️ Critical Workflow

**DO NOT** edit `src/constants/server-instructions.ts` directly. It is auto-generated.

If you need to update a tool group's instructions or the general gotchas, follow these steps:

1. Modify the relevant `.md` file in this directory (e.g., `gotchas.md`, `core.md`, etc.).
2. Run the generator script to compile these markdown files into the TypeScript constant map:
   ```bash
   pnpm run generate:instructions
   ```
   _(or `npx tsx scripts/generate-server-instructions.ts`)_
3. The generator script converts your markdown into escaped strings embedded in the `server-instructions.ts` generated code.

## File Structure

- `overview.md`: The minimal core instructions sent to all clients on initialization. Keep this extremely short (~150 tokens) to preserve context limits.
- `gotchas.md`: The core help payload returned for `mysql://help`. Contains critical usage patterns across the entire extension.
- `[group-name].md`: Group-specific hints returned by `mysql://help/[group-name]` (e.g., `mysql://help/json`).

## Guidelines

- Write strictly for AI consumption (concise, rule-based, clear mappings).
- Use code blocks for specific exact schemas/examples.
- Watch payload sizes; do not put the entire documentation in here.
