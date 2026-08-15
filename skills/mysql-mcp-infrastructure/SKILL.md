---
name: mysql-mcp-infrastructure
version: 1.0.0
tags:
  - "agent-skill"
description: |
  Master guide for orchestrating, recreating, and verifying the local database test ecosystems and examples in the mysql-mcp repository. Use when the user asks to set up the local test infrastructure, spin up the examples, or troubleshoot database cluster setups.
---

# MySQL MCP Infrastructure & Examples Guide

The `mysql-mcp` repository contains complex, multi-node database ecosystems for both advanced E2E testing and user examples. When an AI agent is asked to orchestrate, set up, or troubleshoot these environments, they **MUST** follow these specific procedures.

## 1. Core Test Ecosystem (`test-server`)

The core test ecosystem is derived from the master `adamic` unified database ecosystem. It includes a 3-node InnoDB cluster, MySQL Router, ProxySQL, and a full observability stack (Datadog, Prometheus, Grafana, Dozzle).

**To Recreate the Ecosystem:**
If the test infrastructure breaks, has port conflicts, or needs to be completely wiped and re-created:

> **⚠️ SAFETY GATE**: This script **permanently destroys all containers and data** in the test ecosystem. You MUST obtain explicit user confirmation (e.g., "yes, destroy everything") before running this command. Never infer intent.

```bash
# Natively on Windows (via PowerShell or cmd)
node test-server/infrastructure/scripts/recreate-ecosystem.mjs
```
> **Note:** This will completely tear down the containers, initialize the InnoDB cluster, join secondary nodes, and run the `reset-database.mjs` seed script.

**To Re-seed Data (Without Teardown):**
If the cluster is healthy but the data is dirty:
```bash
node test-server/infrastructure/scripts/reset-database.mjs
```

**To Recover a Broken Cluster (Quorum Loss):**
If the InnoDB cluster loses quorum or the primary is stuck in `super_read_only` mode:
```bash
node test-server/infrastructure/scripts/heal-primary.mjs
```

## 2. Setting Up Examples

The repository provides standalone example stacks. Always copy the `.env.example` to `.env` before bringing up the stacks.

### Basic MySQL + Datadog Example
Located in `examples/basic-mysql-datadog`. This is a lightweight stack demonstrating Datadog observability.
```bash
cd examples/basic-mysql-datadog
cp .env.example .env
# Edit .env with your DD_API_KEY
docker compose up -d
```

### Enterprise HA MySQL Example
Located in `examples/enterprise-ha-mysql`. This is a heavy stack demonstrating a fully configured InnoDB Cluster with ProxySQL.
```bash
cd examples/enterprise-ha-mysql
cp .env.example .env
docker compose up -d
# Wait for containers to be healthy, then run the initialization script:
bash init-cluster.sh
```

### Full Observability Ecosystem
Located in `examples/full-observability-ecosystem`. This represents the complete enterprise architecture including Prometheus, Grafana, Loki, Alloy, and Dozzle.
```bash
cd examples/full-observability-ecosystem
cp .env.example .env
docker compose up -d
# Wait for containers to be healthy, then run the initialization script:
bash init-cluster.sh
```

## 3. Infrastructure Audit Rules

When generating, modifying, or troubleshooting Docker Compose files or orchestration scripts, adhere to these rigorous standards (derived from the `adamic` global infrastructure audits):

- **Healthchecks**: Every database-tier service (MySQL, ProxySQL, etc.) MUST have a defined healthcheck. The startup dependency chain MUST enforce health wait states (e.g., ProxySQL depends on MySQL router `condition: service_healthy`).
- **Restart Policies**: All services must have `restart: unless-stopped`.
- **Resource Limits**: Always define a `mem_limit`. Ensure MySQL nodes have sufficient container headroom above their configured `innodb_buffer_pool_size`.
- **Logging**: Enforce the `json-file` driver with rotation (`max-size`, `max-file`).
- **WSL Context**: 
  - Scripts executed within WSL MUST use dynamic discovery (e.g., `docker compose config --services`) and MUST use `docker exec` (no host binary coupling).
  - Datadog Agent containers running in WSL MUST include `cgroup: host` for accurate `docker.cpu.usage` metrics.
  - All `reported_hostname` values for Datadog should use the `adamic-wsl2` convention.
- **Strict Tags**: All images must use explicit version tags. Never use `latest`.
- **Exit Codes**: Orchestration scripts must explicitly `process.exit(1)` on failure to break CI/CD pipelines immediately.
