# JSON Code Mode Verification Matrix

## Overview
All 17 `json` tools have been functionally verified in code mode. The `helpers.ts` module was found to have a flaw where Zod parsing was placed outside the `try/catch` block, leaking raw exceptions. This was fixed.

## Coverage Matrix

| Tool | Happy Path | Domain Error | Zod Error |
|------|------------|--------------|-----------|
| `json.extract` | ✅ Passed | ✅ Passed | ✅ Passed |
| `json.set` | ✅ Passed | ✅ Passed | ✅ Passed |
| `json.insert` | ✅ Passed | ✅ Passed | ✅ Passed |
| `json.replace` | ✅ Passed | ✅ Passed | ✅ Passed |
| `json.remove` | ✅ Passed | ✅ Passed | ✅ Passed |
| `json.contains` | ✅ Passed | ✅ Passed | ✅ Passed |
| `json.keys` | ✅ Passed | ✅ Passed | ✅ Passed |
| `json.arrayAppend` | ✅ Passed | ✅ Passed | ✅ Passed |
| `json.get` | ✅ Passed | ✅ Passed | ✅ Passed (fixed) |
| `json.update` | ✅ Passed | ✅ Passed | ✅ Passed (fixed) |
| `json.search` | ✅ Passed | ✅ Passed | ✅ Passed (fixed) |
| `json.validate` | ✅ Passed | ✅ Passed | ✅ Passed (fixed) |
| `json.merge` | ✅ Passed | ✅ Passed | ✅ Passed |
| `json.diff` | ✅ Passed | ✅ Passed | ✅ Passed |
| `json.normalize` | ✅ Passed | ✅ Passed | ✅ Passed |
| `json.stats` | ✅ Passed | ✅ Passed | ✅ Passed |
| `json.indexSuggest` | ✅ Passed | ✅ Passed | ✅ Passed |

## Remediation Note
In `src/adapters/mysql/tools/json/helpers.ts`, `JsonGetSchema.parse(params)`, `JsonUpdateSchema.parse(params)`, `JsonSearchSchema.parse(params)`, and `JsonValidateSchema.parse(params)` were moved inside the `try/catch` block to properly use `formatHandlerErrorResponse`, converting ZodError objects into standardized `{success: false, error: ...}` results, avoiding unhandled promise rejections in Code Mode.
