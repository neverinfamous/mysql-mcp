# MySQL MCP Advanced Code Mode Testing - Master Index

Due to the extreme length of the Advanced Code Mode test suite (108 tests), the coordinator workflow has been sharded into 4 domain-specific phases. This prevents context-window exhaustion and ensures subagents complete their queues reliably.

## Execution Rules

**CRITICAL**: You MUST start a **new conversation thread** for each phase and provide the agent with the specific phase file (e.g., `test-server/test-advanced/coordinator-workflow-phase1-foundation.md`). 

**DO NOT** instruct a single agent to run all four phases in one thread, as this will lead to the same context exhaustion the sharding is designed to prevent.

## The Phases

### 1. Phase 1: Foundation & Docstore (Tests 1-27)
**File**: `test-server/test-advanced/coordinator-workflow-phase1-foundation.md`
Covers: Admin Control, Maintenance, Backup, Cluster Replication, InnoDB, Concurrency, Core, Docstore, Events, Fulltext, Introspection.

### 2. Phase 2: JSON, Performance & Infrastructure (Tests 28-54)
**File**: `test-server/test-advanced/coordinator-workflow-phase2-performance.md`
Covers: JSON Core, Migration, Monitoring, Optimization, Partitioning, Performance Analysis, ProxySQL, Replication.

### 3. Phase 3: Security, Routing & Spatial (Tests 55-81)
**File**: `test-server/test-advanced/coordinator-workflow-phase3-security.md`
Covers: Roles, Router Advanced, Schema Management, Security Audit, Sessions, Shell, Spatial Geometry.

### 4. Phase 4: Analytics, Types & Vector (Tests 82-108)
**File**: `test-server/test-advanced/coordinator-workflow-phase4-analytics.md`
Covers: Stats, Sys Schema, Text, Transactions, Types, Vector, Sandbox Isolation.

## Compatibility with Dynamic Context Audit
This sharded structure is fully compatible with the `/dynamic-context-audit` skill. Audit subagents will enumerate all `.md` files in `test-server/test-advanced/` and automatically verify the sequential test queues within each `coordinator-workflow-phaseX.md` file against the prompt files on disk.
