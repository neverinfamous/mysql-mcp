# MySQL MCP Agent Skills

This directory contains AI agent skills that enforce enterprise best practices, strict safety rules, and optimized usage patterns when interacting with the `mysql-mcp` server.

## Installation

To equip your AI assistant with these skills, copy the contents of this folder into your agent's skills directory.

For example, if you are using Google Antigravity or a similar agent framework:

```bash
# Copy the skills to your agent's skill directory
cp -r skills/mysql ~/.gemini/skills/
cp -r skills/mysql-mcp ~/.gemini/skills/
```

## Available Skills

- **`mysql`**: Enforces enterprise production rules for query safety, strict parameterization, connection pooling, and strict schema configurations (`STRICT_TRANS_TABLES`).
- **`mysql-mcp`**: Provides core guidelines and instruction pointers for utilizing the `mysql-mcp` server, optimizing token usage with Code Mode, and tool filtering.
