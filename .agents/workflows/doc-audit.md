---
name: doc-audit
description: |
  Use when you need to run an exhaustive adversarial documentation audit for both the main repository and wiki.
  Do NOT use for standard code reviews or linting.
disable-model-invocation: true
---

# Unified Documentation & Wiki Audit

> **Prerequisite**: Ensure your Git working directories for both the Main Repository and the Wiki Repository (if it exists) are completely clean before starting.

Run a comprehensive subagent-based documentation audit to synchronize the repository (and its Wiki).
**Rule:** The purpose of the doc audit is to edit docs, not code. Do NOT alter any source code during this workflow.

## 1. Audit Initialization
<phase>
<instructions>
1. Ask the user for the absolute path to the **Main Repository**.
2. Identify whether the project is an MCP server, Cloudflare manager, or standalone library.
3. Check if a Wiki Repository exists (e.g., `<repo-name>.wiki`). Ask the user to confirm the path if one exists.
</instructions>
</phase>

---

## Phase 1: Discrepancy-Driven Audit (Main Repo)
<phase>
Divide the target files into logical groups and dispatch multiple parallel `main_repo_auditor` subagents with `enable_write_tools = false`.

**Target Files (Audit whatever exists)**: 
- **Core Docs**: `README.md`, `DOCKER_README.md`, `SECURITY.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `UNRELEASED.md`
- **Config & Env**: `.env.example`, `server.json`, `mcp-config-example.json`, `docker-compose.yml`, `wrangler.toml`, `wrangler.jsonc`
- **GitHub Elements**: `.github/copilot-instructions.md`, `.github/pull_request_template.md`, `.github/workflows/`
- **MCP & Instructions**: `test-server/code-map.md`, `test-server/tool-reference.md`, `src/constants/server-instructions/README.md`, `test-server/scripts/prompt-template.md`
- **Skills**: `skills/**/*.md` (e.g., `/mcp-builder`)
- **Testing Prompts**: `test-server/*/README.md`, `test-server/*/coordinator-workflow.md`

<instructions>
**Crucial Instructions for the Main Repo Subagent**:
- Cross-compare all files to spot discrepancies, conflicting claims, or obviously outdated information.
- **Marketing Compliance**: Maximize the marketing aspect by structuring docs to put best features forward. Ensure READMEs and Wikis have a prominent "Value Proposition" block at the top. Use active voice, benefit-driven headers, and concise sentences (<15 words).
- **Platform Limits**: Ensure `DOCKER_README.md` MUST NOT exceed Docker Hub's 25,000 character limit.
- **Error Handling**: If you encounter an unexpected error, fail gracefully and report back. Do not enter autonomous retry loops.
- **Reporting**: Do NOT make any changes. Compile a detailed list of every discrepancy or drift you find, specifying exactly what is wrong and how it should be fixed, and report this back to the primary agent.
</instructions>
</phase>

---

## Phase 2: Discrepancy-Driven Audit (Wiki Repo)
<phase>
If a Wiki Repository exists, do not audit linearly to prevent context exhaustion.

<instructions>
1. **Enumerate Files**: List all `.md` files in the Wiki Repository.
2. **Define Subagent**: Define a specialized `wiki_auditor` subagent type equipped with `enable_write_tools = false`.
3. **Dispatch Subagents**:
   - Divide the list of wiki markdown files logically into batches of 5-10 files.
   - Invoke parallel `wiki_auditor` subagents, assigning each batch to a different subagent.
   - **Crucial Instructions for Subagents**: 
     - "You must read **every single page** assigned to you."
     - "Define a clear stop condition: once you have processed your assigned batch of files, you MUST return and report."
     - "Cross-compare your pages to spot discrepancies, conflicting claims, or obviously outdated information."
     - "Enhance the marketing tone of technical docs to emphasize core value."
       > **Note**: When updating schemas or validation logic, please refer to the `/zod` skill for best practices on Standard Schema and Safe Parsing.
     - "Error Handling: If you encounter an unexpected error, fail gracefully and report back. Do not enter autonomous retry loops."
     - "Reporting: Do NOT make any changes. Compile a detailed list of every discrepancy or drift you find, specifying exactly what is wrong and how it should be fixed, and report this back to the primary agent."
</instructions>
</phase>

---

## Phase 3: Targeted Truth-Finding & Planning
<phase>
<instructions>
Once all subagents have completed their tasks and reported back, you (the primary agent) must act as the ultimate arbiter:

1. **Verify Discrepancies**: Take the list of discrepancies flagged by the subagents and surgically verify the truth. Instead of assuming the docs are wrong, use `grep_search` on the codebase, `get-git-history-json.ts` for git history, or query the Memory Journal to find the definitive answer.
2. **Compile the Plan**: Create a single structured `implementation_plan.md` artifact detailing:
   - **Summary of Audit**
   - **Main Repo Drift**: Detailed list of which files had drift and the exact proposed fixes.
   - **Wiki Repo Drift**: Detailed list of which pages had drift and the exact proposed fixes.

Use the artifact metadata to set `RequestFeedback: true`. **STOP and wait for the user's explicit approval before making any changes.**
</instructions>
</phase>

---

## Phase 4: Execution
<phase>
<instructions>
Once the user explicitly approves the implementation plan, proceed to make the changes to the documentation.

> [!CAUTION]
> **NO SCRIPTS RULE:** You are strictly forbidden from writing or running scripts (e.g., node, python, bash) to perform bulk string replacements or automated document updates. You must directly edit files using targeted replacement tools (like `replace_file_content`) or spawn subagents with write capabilities to apply surgical edits cleanly.

> [!NOTE]
> Do not run automated validation steps like `pnpm run check` for doc-audits, as validation is run frequently elsewhere and docs rarely break the build.
</instructions>
</phase>

---

## Phase 5: Committing
<phase>
<instructions>
> [!CAUTION]
> **STOP for HITL Approval**: Do NOT proceed to commit until the user explicitly approves the applied changes.

Once approved by the user, proceed to commit the changes:

1. Commit the synchronization changes to the Wiki Repository (if applicable) using the enforced wrapper from the main repository. **You MUST run `git status --porcelain` first to identify modified files, and pass each explicitly using multiple `--add <file>` flags** (e.g., `bun C:\path\to\main-repo\.agents\scripts\commit.ts` with `--validation none --add file1.md --add file2.md`). Wildcard staging (`--add .`) is strictly forbidden by the wrapper. Do NOT use raw `git commit`.
2. Commit the Main Repository changes using the enforced wrapper in the same manner, passing each modified file explicitly (e.g., `bun .\.agents\scripts\commit.ts` with `--validation none --add file1.md`). Wildcard staging (`--add .`) is forbidden.
3. Inform the user that the unified audit is fully complete and present the final documentation audit report artifact.
</instructions>
</phase>
