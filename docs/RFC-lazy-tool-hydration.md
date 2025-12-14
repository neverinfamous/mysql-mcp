# MCP Proposal: Lazy Tool Hydration

**Status**: Draft  
**Author**: @neverinfamous  
**Created**: 2024-12-13  
**Reference Implementation**: [mysql-mcp (lazy branch)](https://github.com/neverinfamous/mysql-mcp/tree/lazy)

---

## Abstract

This proposal introduces **Lazy Tool Hydration** to optimize token consumption when MCP servers expose many tools. The current `tools/list` method returns full schemas for all tools, which becomes expensive as tool counts grow. This proposal adds a `minimal` mode and an on-demand `tools/get_schema` method.

---

## Problem Statement

### The Issue

MCP servers with many tools consume significant tokens listing all tool schemas:

| Server Tools | Full Listing Size | Tokens (est.) |
|--------------|------------------|---------------|
| 10 tools     | ~20 KB           | ~5,000        |
| 50 tools     | ~100 KB          | ~26,000       |
| **106 tools**| **207 KB**       | **54,604**    |

For servers like `mysql-mcp` (106 tools), the full listing consumes ~54K tokens per initialization—even when the model only needs 2-3 tools.

### Real-World Measurement

Using `mysql-mcp` with 106 database tools:

```
Full listing:    207,493 bytes → 54,604 tokens
Minimal listing:  18,614 bytes →  4,899 tokens
───────────────────────────────────────────────
Savings:         188,879 bytes   91% reduction
```

### Who This Affects

- Servers with 50+ tools (database, cloud APIs, enterprise integrations)
- Use cases where only a few tools are needed per session
- Cost-sensitive deployments

---

## Proposed Solution

### 1. Add `minimal` Flag to `tools/list`

```typescript
// Request
{ "method": "tools/list", "params": { "minimal": true } }

// Response
{
  "tools": [
    { 
      "name": "mysql_query", 
      "category": "core",
      "tags": ["query", "select", "sql"],
      "summary": "Execute a read-only SQL query"
    },
    // ... more tools
  ],
  "minimal": true
}
```

### 2. Add `tools/get_schema` Method

```typescript
// Request
{ "method": "tools/get_schema", "params": { "name": "mysql_query" } }

// Response
{
  "tool": {
    "name": "mysql_query",
    "description": "Execute a read-only SQL query...",
    "inputSchema": {
      "type": "object",
      "properties": { "query": {...}, "params": {...} },
      "required": ["query"]
    }
  }
}
```

### 3. Add `lazyHydration` Capability

```typescript
{
  "capabilities": {
    "tools": {
      "lazyHydration": true,  // NEW
      "listChanged": true
    }
  }
}
```

---

## Schema Definitions

### ToolIndexSchema (Minimal Tool Info)

```typescript
export const ToolIndexSchema = z.object({
  name: z.string(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  summary: z.string().optional()
});
```

### GetToolSchemaRequestSchema

```typescript
export const GetToolSchemaRequestSchema = RequestSchema.extend({
  method: z.literal('tools/get_schema'),
  params: z.object({
    name: z.string().describe('Name of the tool to get schema for')
  })
});
```

---

## Backward Compatibility

| Scenario | Behavior |
|----------|----------|
| Old client, new server | No change—full listing returned if no `minimal` flag |
| New client, old server | Can fallback to full listing if capability not present |
| `tools/get_schema` unknown | Server returns method not found; client falls back |

The proposal is **fully backward compatible**—existing implementations continue to work unchanged.

---

## Usage Patterns

### Pattern 1: Minimal Discovery

```
1. Client: tools/list { minimal: true }
2. Server: Returns 106 tool names + categories (~5K tokens)
3. Client: Displays tool index to model
4. Model: Selects tool by name from index
5. Client: tools/get_schema { name: "selected_tool" }
6. Server: Returns full schema (~400 tokens)
7. Client: tools/call with full schema
```

### Pattern 2: Category-Based Filtering

```
1. Client: tools/list { minimal: true }
2. Model: "Show me JSON tools"
3. Client: Filter by category: "json"
4. Model: Selects mysql_json_extract
5. Client: tools/get_schema { name: "mysql_json_extract" }
```

---

## Reference Implementation

| Component | Location |
|-----------|----------|
| Protocol Types | [mcp/src/types.ts](https://github.com/neverinfamous/mysql-mcp/blob/lazy/...) |
| Server Handlers | [mcp/src/server/mcp.ts](https://github.com/neverinfamous/mysql-mcp/blob/lazy/...) |
| Schema Cache | [mcp/src/client/schemaCache.ts](https://github.com/neverinfamous/mysql-mcp/blob/lazy/...) |
| Tool Registry | [mcp/src/client/toolRegistry.ts](https://github.com/neverinfamous/mysql-mcp/blob/lazy/...) |

---

## Alternatives Considered

| Alternative | Why Rejected |
|-------------|--------------|
| Pagination only | Doesn't reduce per-page token cost |
| Tool filtering | Server-side filtering still needs schema knowledge |
| Schema compression | Limited gains, adds complexity |

---

## Open Questions

1. Should `category` and `tags` be standardized annotations?
2. Should there be a `tools/search` method for semantic lookup?
3. Should schema caching TTL be configurable per-server?

---

## Conclusion

Lazy Tool Hydration provides **91% token savings** for servers with many tools while maintaining full backward compatibility. The implementation is proven with 106 tools in a production-ready MySQL MCP server.
