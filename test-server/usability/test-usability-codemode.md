# mysql-mcp Usability & Hallucination Test: Code Mode Mechanics

> **This test is optimized for an autonomous agent.**

This prompt instructs you to organically test the core sandboxing and execution mechanics of Code Mode (`mysql_execute_code`), intentionally fuzzing the inputs to discover generic LLM hallucinations and hardening the codebase against them.

## 1. Fuzz Phase

Focus purely on the mechanics of Code Mode itself, ignoring specific tool data. Try to:

- Access `Promise` objects synchronously (forgetting `await`).
- Try to access missing properties on a failed result object (e.g. `const { data } = await mysql.core.readQuery("BAD SQL")`).
- Test standard Javascript array methods like `.map()` or `.filter()` on what you intuitively assume is an array.
- Call `mysql.help()`.
- Test intuitive array destructuring `const [row1, row2] = await ...` on returned objects.
- Attempt to use `console.log()` to check if it correctly feeds into the `logs` output array instead of crashing or leaking to stdout.
- Note any raw exceptions, V8 engine crashes, or confusing proxy behaviors.

## 2. Heal Phase

If you encounter confusing V8 errors, unhandled edge cases, or raw exceptions instead of actionable domain errors:

1. STOP. Do not just work around the issue.
2. Read the hardening guidelines in `skills/mysql-mcp-heal/SKILL.md`.
3. Modify the proxy interceptors in `src/codemode/sandbox.ts` or the main dispatcher.
4. Apply the permanent fix (e.g. throwing custom errors with actionable feedback).

## 3. Local Verification

1. Run `pnpm run check`, `pnpm run build`, `pnpm run test` and `pnpm run test:e2e` locally.
2. **DO NOT PROCEED** until all tests and types pass locally.
3. You do NOT need to wait for a live server restart.

## 4. Commit

1. If local verification passes, run `git add .` and `git commit -m "Optimize codemode mechanics"`.
2. Report your findings to the Coordinator.

## 5. Continuous Improvement

If during this test you discover a blind spot or a new hallucination vector, edit this markdown file directly to permanently improve the testing apparatus. Commit any prompt improvements alongside your codebase fixes.
