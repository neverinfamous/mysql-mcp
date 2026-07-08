---
description: Exhaustive adversarial audit of MCP dynamic context (testing prompts, code-map, server instructions) via subagents to ensure accuracy, completeness, and context safety.
---

# Dynamic Context Audit

> **Prerequisite**: Ensure your Git working directory is completely clean before starting. Stash or commit any unrelated changes.

Run an exhaustive subagent-based documentation and coverage audit of the testing prompts and workflows in an MCP server repository.

## 1. Audit Initialization

1. Ask the user for the absolute path to the target MCP repository, if they have not provided it (e.g. `C:\Users\chris\Desktop\mysql-mcp`). Do not guess; use the Briefing's registered workspaces to resolve the exact path.
2. Verify that the repository has a `test-server` folder containing testing prompts.

---

## Phase 1: Source of Truth (SoT) Research

As the primary agent, you must first establish the ground truth for what tools exist, how they are grouped, and how they function. Do not guess; rely strictly on file contents.

### Gather the SSoT
1. Read the architectural logic flows in `test-server/code-map.md`.
2. Read the tool documentation and schema requirements in `test-server/tool-reference.md`.
3. Locate and read the tool grouping definitions (typically `src/filtering/tool-constants.ts` or `src/filtering/tool-filter.ts`).
4. Compile a master mapping of all active tools categorized by their testing grouping (e.g., Code Mode, Advanced, standard/direct tool groups, usability).
5. **CRITICAL**: Write this master mapping to a scratch file (e.g., `<appDataDir>\brain\<conversation-id>\scratch\ssot-mapping.md`). Do not pass massive SSoT strings directly into the subagents' prompts; pass the scratch file path instead.

---

## Phase 2: Parallel Subagent Prompt Audit

> [!CAUTION]
> **Template Architecture Boundary**: Do NOT allow subagents to edit ANY of the generated `.md` test prompt files directly (e.g. `test-codemode-*.md`, `test-advanced-*.md`). They are fully generated and any direct edits will be overwritten. Follow this strict architecture:
> - **Tool Coverage Overlaps/Gaps**: Must be fixed in `test-server/scripts/tool-map.json`.
> - **Boilerplate/Structural Bugs**: Must be fixed in `test-server/scripts/prompt-template.md`.
> - **Custom Test Logic Flaws (Hallucinations/Parameter Drift)**: Must NOT be fixed in the markdown files. You must add programmatic replacement logic (e.g. regex string replacements) to `test-server/scripts/standardize-prompts.js` so the fixes are dynamically applied during generation.
> - **Enforcement**: Run `node test-server/scripts/standardize-prompts.js` after making updates to regenerate the files and guarantee structural integrity.

You must exhaustively audit all testing prompts. Because this requires deeply analyzing dozens of prompts and comparing them to the SSoT, doing this sequentially will cause context exhaustion. You MUST delegate this to subagents.

1. **Enumerate Files**: List all `coordinator-workflow.md` and individual test `.md` files in the `test-server` subdirectories (e.g., `test-codemode`, `test-advanced`, `test-tool-groups`, `test-usability`, etc.).
2. **Define Subagents**: Define a specialized `prompt_auditor` subagent type equipped with `enable_write_tools = true`.
3. **Dispatch Subagents**:
   - Divide the testing prompt files logically by grouping (e.g., one subagent for `test-codemode`, one for `test-tool-groups`). 
   - Provide the SSoT mapping to each subagent so they know exactly what tools *must* be present in their assigned grouping.
   - **Crucial Instructions for Subagents**:
     - "Cross-reference every single test prompt against the SSoT mapping. Are all tools in this group fully and rigorously tested?"
     - "Ensure the tests align with the logic flows in `code-map.md` and the schemas in `tool-reference.md`."
     - "**Context Exhaustion Prevention**: If any test prompt file covers too many tools, is too long, or represents too much work for a single subagent test pass, use your own judgment to aggressively split it into smaller logical files (e.g., `test-codemode-core-part1.md`, `test-codemode-core-part2.md`)."
     - "**Queue Alignment**: Subagents MUST double-check that the sequence queue in `coordinator-workflow.md` perfectly matches the files on disk."
     - "**No README Lists**: Exhaustive file lists should ONLY live in `coordinator-workflow.md`. The `README.md` files should NOT contain duplicate exhaustive lists of test files to prevent sync drift. If a `README.md` has an exhaustive list, delete the list and replace it with a reference to `coordinator-workflow.md`."
     - "Use your write tools to correct gaps, rewrite inaccurate test flows, and split files immediately."
     - "**Self-Improvement**: As you audit these prompts, proactively identify opportunities to improve the test coverage, clarify ambiguities, or refine the workflows and `AGENT_README.md`s themselves. You are expected to rewrite and improve these files directly if you find gaps or redundancies."
     - "Report back with a detailed summary of your changes."

---

## Phase 3: Parallel Subagent Server Instructions Audit

The server instructions (typically `src/constants/server-instructions/*.md` or `src/constants/instructions/*.md`) must accurately reflect the SSoT. If they omit tools or hallucinate non-existent tools, the dynamic help system will fail. You MUST delegate this to subagents as well.

1. **Locate Instructions Directory**: Determine whether the repository uses `src/constants/server-instructions/` or `src/constants/instructions/`.
2. **Define Subagents**: Re-use the `prompt_auditor` subagent type.
3. **Dispatch Subagents**:
   - Assign the subagents to audit the `.md` files in the located instructions directory by dividing the files logically among them.
   - Provide the same SSoT mapping to the subagents.
   - **Crucial Instructions**:
     - "Cross-reference every single tool mentioned in your assigned `.md` instruction files against the SSoT mapping."
     - "Are all tools in this group fully documented? Are there any tools mentioned that do NOT exist in the SSoT?"
     - "Ensure parameter descriptions align with the schemas in `test-server/tool-reference.md`."
       > **Note**: When updating schemas or validation logic, please refer to the `/zod` skill for best practices on Standard Schema and Safe Parsing.
     - "Use your write tools to add missing tools, remove hallucinated tools, and correct parameter drift immediately."
     - "Report back with a detailed summary of your changes."

---

## Phase 4: Server Instructions Synchronization

Once subagents report back:
1. Verify if the updates to the testing prompts necessitate updates to the server instructions generation process.
2. Check `src/constants/server-instructions/README.md`.
3. Run `bun scripts/generate-server-instructions.ts` to ensure the compiled `src/constants/server-instructions.ts` file reflects any relevant architectural or workflow documentation updates.
4. Note: Do NOT run `pnpm run check` or `pnpm run test`, as these are purely documentation and instruction modifications.

---

## Phase 5: Final Consolidated Report & Committing

> [!IMPORTANT]
> **HITL Checkpoint**: STOP HERE. Present the full audit report artifact to the user. Wait for explicit approval before proceeding to commit.

1. **Consolidated Report**: Produce a single structured artifact detailing:
   - **Summary of Audit**
   - **Tools Added/Fixed**: Which missing tools were integrated into the tests.
   - **Prompts Split**: Which files were split to prevent context exhaustion.
2. **Mandatory Review**: Run `git diff` and thoroughly review all changes made to the testing prompts and server instructions. These are extremely fragile and valuable documents. Ensure no destructive edits or hallucinations were introduced.
3. Commit the synchronization changes to the repository:
   > **Note:** Always use the repository's custom commit wrapper (like `commit.ts`) if available, to adhere to global rules.
   ```bash
   git add .
   bun path/to/commit.ts --msg "test: exhaustive testing prompt audit and workflow synchronization" --category Changed --impact 0.5 --confidence 1.0
   ```
