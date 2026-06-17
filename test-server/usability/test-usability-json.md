# mysql-mcp Usability & Hallucination Test: JSON

> **This test is optimized for an autonomous agent.**

This prompt instructs you to organically test the `json` tool group using Code Mode (`mysql_execute_code`), intentionally fuzzing the inputs to discover agent hallucinations, and permanently hardening the codebase against them.

## 1. Fuzz Phase

Use the `mysql_execute_code` tool to interact with the following tools in the `json` group:
`json_extract`, `json_set`, `json_insert`, `json_replace`, `json_remove`, `json_contains`, `json_keys`, `json_array_append`, `json_get`, `json_update`, `json_search`, `json_validate`, `json_merge`, `json_diff`, `json_normalize`, `json_stats`, `json_index_suggest`

**Instructions:**

- Do not perfectly structure your initial calls. Act intuitively as an agent.
- Test method naming: The tools have `json_` prefixes (e.g. `mysql_json_extract`). In Code Mode, are they mapped to `mysql.json.extract` or `mysql.json.jsonExtract`? Try the intuitive ones. If you guess wrong, add an alias.
- Guess property names: Pass `tableName` instead of `table`, `filter` instead of `where`.
- Test type coercion: Pass `value: { foo: "bar" }` to `json_set` directly without `JSON.stringify()`. Does the tool properly handle object payloads or does it reject them via Zod? If it rejects, use a `z.preprocess()` wrapper to auto-stringify it.
- Test array methods: Test `mysql.json.extract().map(...)` — verify the proxy correctly targets the inner array instead of throwing.
- Note any errors, exceptions, or unexpected behavior.

## 2. Heal Phase

If you encounter any failures, errors, or hallucinations:

1. STOP. Do not just work around the issue in your script.
2. Read the hardening guidelines in `skills/mysql-mcp-heal/SKILL.md`.
3. Apply the permanent fix to schemas, aliases, or positional params.

## 3. Local Verification

1. Run `pnpm run check`, `pnpm run build`, `pnpm run test` and `pnpm run test:e2e` locally.
2. **DO NOT PROCEED** until all tests pass cleanly.

## 4. Commit

1. If local verification passes, run `git add .` and `git commit -m "Optimize json tool usage"`.
2. Report your findings to the Coordinator.

## 5. Continuous Improvement

If during this test you discover a blind spot or a new hallucination vector, edit this markdown file directly to permanently improve the testing apparatus. Commit any prompt improvements alongside your codebase fixes.
