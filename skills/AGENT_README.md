# MySQL MCP Agent Skills

This directory contains AI agent skills that enforce enterprise practices, safety rules, and usage patterns when interacting with the `mysql-mcp` server.

## Installation

To equip your AI assistant with these skills, copy the contents of this folder into your agent's skills directory.

For example, if you are using Antigravity, Cursor, Claude Desktop, or another agent framework:

```bash
# Copy the skills to your agent's skill directory (Bash)
cp -r skills/mysql <your-agent-skills-directory>/
cp -r skills/mysql-router <your-agent-skills-directory>/
cp -r skills/mysqlsh <your-agent-skills-directory>/
cp -r skills/proxysql <your-agent-skills-directory>/
cp -r skills/mysql-mcp <your-agent-skills-directory>/
cp -r skills/mysql-mcp-infrastructure <your-agent-skills-directory>/
cp -r skills/datadog <your-agent-skills-directory>/
cp -r skills/opentelemetry <your-agent-skills-directory>/
```

```powershell
# Copy the skills to your agent's skill directory (PowerShell/CMD)
Copy-Item -Recurse skills/mysql <your-agent-skills-directory>/
Copy-Item -Recurse skills/mysql-router <your-agent-skills-directory>/
Copy-Item -Recurse skills/mysqlsh <your-agent-skills-directory>/
Copy-Item -Recurse skills/proxysql <your-agent-skills-directory>/
Copy-Item -Recurse skills/mysql-mcp <your-agent-skills-directory>/
Copy-Item -Recurse skills/mysql-mcp-infrastructure <your-agent-skills-directory>/
Copy-Item -Recurse skills/datadog <your-agent-skills-directory>/
Copy-Item -Recurse skills/opentelemetry <your-agent-skills-directory>/
```

## Available Skills

- **`mysql`**: Enforces enterprise production rules for query safety, parameterization, connection pooling, and schema configurations (`STRICT_TRANS_TABLES`).
- **`mysql-router`**: Production standards for MySQL Router HA routing, connection pooling, and cluster integration.
- **`mysqlsh`**: Production standards for MySQL Shell, InnoDB Cluster management (AdminAPI), and parallel dump/load utilities.
- **`proxysql`**: Production standards for ProxySQL connection multiplexing, query routing, caching, and firewalling.
- **`mysql-mcp`**: Provides guidelines and instruction pointers for utilizing the `mysql-mcp` server, optimizing token usage with Code Mode, and tool filtering.
- **`mysql-mcp-infrastructure`**: Guide for orchestrating, recreating, and verifying the local database test ecosystems and examples (e.g. running the test-server cluster or basic/enterprise examples).
- **`datadog`**: Observability standards for Datadog monitoring and dashboards.
- **`opentelemetry`**: Observability standards for OpenTelemetry distributed tracing and metrics.
