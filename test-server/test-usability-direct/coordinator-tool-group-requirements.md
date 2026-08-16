# Tool Groups Needed for test-usability-direct Workflows

1. Phase 1: Foundation
   Individual Groups Needed: core, json, text
   Best Meta-Group: starter
2. Phase 2: Admin
   Individual Groups Needed: admin, backup, monitoring, performance, transactions
   Meta-Group Equivalents: You need a combination of dba-manage (admin, backup), dba-monitor (monitoring, performance), and essential (transactions).
3. Phase 3: Schema
   Individual Groups Needed: partitioning, schema, stats, introspection, migration
   Meta-Group Equivalents: You need a combination of dba-schema (schema, introspection, migration), base-analytics (stats), and dba-manage (partitioning).
4. Phase 4: Analytics
   Individual Groups Needed: fulltext, optimization, replication, router, proxysql, shell, events, sysschema, spatial, security, cluster, roles, docstore, vector
   Meta-Group Equivalents: This phase tests the rest of the ecosystem heavily. You need a broad combination of meta-groups like ecosystem, dba-secure, base-nosql, and dba-monitor to cover everything.
