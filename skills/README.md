# MySQL MCP Agent Skills

## Value Proposition
- **Enforce Production Rules**: Mandate query parameterization, strict schema validation, and connection safety across AI workflows.
- **Optimize Token Overhead**: Utilize Code Mode guidelines to streamline complex multi-step database interactions.
- **Standardize Test Deployment**: Orchestrate E2E database environments and HA cluster infrastructure seamlessly.

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
- **`mysql-mcp-infrastructure`**: Master guide for orchestrating, recreating, and verifying the local database test ecosystems and examples (e.g. running the test-server cluster or basic/enterprise examples).
