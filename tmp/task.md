# MySQL-MCP Certification Matrix: Schema Tools

## Code Mode Certification
**Status:** 100% Pass

| Method | Happy Path | Domain Error | Zod Error |
|--------|------------|--------------|-----------|
| `help` | ✅ Pass | N/A | N/A |
| `listSchemas` | ✅ Pass | N/A | N/A |
| `createSchema` | N/A (Tested Zod) | N/A | ✅ Pass |
| `dropSchema` | N/A | ✅ Pass | N/A |
| `listViews` | ✅ Pass | N/A | N/A |
| `createView` | ✅ Pass | N/A | ✅ Pass |
| `listStoredProcedures` | ✅ Pass | N/A | N/A |
| `listFunctions` | ✅ Pass | N/A | N/A |
| `listTriggers` | ✅ Pass | N/A | N/A |
| `listConstraints` | ✅ Pass | ✅ Pass | N/A |
| `listEvents` | ✅ Pass | N/A | N/A |

### Notes
* All 15 specific checks verified successfully via `mysql_execute_code` (`schema` namespace).
* The script bundled validations into a single payload, demonstrating robust sandboxing stability.
* Metrics: `wallTimeMs: 177`, `tokenEstimate: 4`.
