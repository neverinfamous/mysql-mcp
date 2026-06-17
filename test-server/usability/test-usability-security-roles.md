# mysql-mcp Usability & Hallucination Test: Security & Roles

> **This test is optimized for an autonomous agent.**

This prompt instructs you to organically test the `security` and `roles` tool groups using Code Mode (`mysql_execute_code`), intentionally fuzzing the inputs to discover agent hallucinations, and permanently hardening the codebase against them.

## 1. Fuzz Phase

Use the `mysql_execute_code` tool to interact with the following tools across the two groups:
`security_audit`, `security_firewall_status`, `security_firewall_rules`, `security_mask_data`, `security_user_privileges`, `security_sensitive_tables`, `security_ssl_status`, `security_encryption_status`, `security_password_validate`, `role_list`, `role_create`, `role_drop`, `role_grants`, `role_grant`, `role_assign`, `role_revoke`, `user_roles`

**Instructions:**

- Do not perfectly structure your initial calls. Act intuitively as an agent.
- Guess property names: Pass `roleName` instead of `role`.
- Test aliases: See if `mysql.security.ssl()` or `mysql.roles.create()` map correctly.
- Test type coercion: For boolean flags, pass strings ("true", "false") to see if they coerce correctly or fail Zod validation.
- Test missing properties: Try passing `{}` to verify it throws a structured domain error (e.g., `VALIDATION_ERROR`) instead of a raw Zod/MCP exception.
- Note any errors, exceptions, or unexpected behavior.

## 2. Heal Phase

If you encounter any failures, errors, or hallucinations:

1. STOP. Do not just work around the issue in your script.
2. Read the hardening guidelines in `skills/mysql-mcp-heal/SKILL.md`.
3. Apply the permanent fix to schemas, parameter mapping, or aliases.

## 3. Local Verification

1. Run `pnpm run check`, `pnpm run build`, `pnpm run test` and `pnpm run test:e2e` locally.
2. **DO NOT PROCEED** until all tests pass cleanly.

## 4. Commit

1. If local verification passes, run `git add .` and `git commit -m "Optimize security and roles tool usage"`.
2. Report your findings to the Coordinator.

## 5. Continuous Improvement

If during this test you discover a blind spot or a new hallucination vector, edit this markdown file directly to permanently improve the testing apparatus. Commit any prompt improvements alongside your codebase fixes.
