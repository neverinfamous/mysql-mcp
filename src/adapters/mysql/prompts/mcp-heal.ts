import type { PromptDefinition, RequestContext } from "../../../types/index.js";

export function createMcpHealPrompt(): PromptDefinition {
  return {
    name: "mysql_mcp_heal",
    description: "Guide for modifying the codebase (schemas, proxies) to prevent and heal LLM hallucinations.",
    arguments: [],
    handler: (_args: Record<string, string>, _context: RequestContext) => {
      return Promise.resolve(`
# MySQL MCP Server Optimization & Anti-Hallucination Guardrails

The primary philosophy of this workflow is: **Automate away as many problems as possible.** When you (the agent) encounter a hallucination, confusion, or an artificial roadblock, DO NOT just work around it or settle for throwing a "good error message".

You MUST modify the underlying infrastructure (codebase, environment profiles, wrappers) to ensure execution succeeds seamlessly without the agent even noticing.

## 1. Phase 1: Determine the Layer of Healing

There is a strict hierarchy of how you should heal the codebase:
1. **Prevent (Highest Preference - Frictionless Recovery):** Automate the problem away. Modify the API schemas, dispatchers, environment profiles, or interceptors to silently catch, transform, or permit the hallucinatory payload so the execution succeeds automatically.
2. **Mitigate (Fallback Only):** ONLY if the input cannot be safely inferred, coerced, or permitted without causing data destruction, intercept it and throw a highly actionable custom error explicitly guiding the agent on how to fix it immediately.

Determine which of the 6 layers needs modification:

### Layer 1: Schema & Instruction Hardening (The First Line of Defense)
The most robust way to prevent a hallucination is to explicitly instruct the agent via the tools list or initialization payload.

* **Schema \`.describe()\` Tags:** When an agent hallucinates a property, update the Zod schema in \`src/adapters/mysql/schemas/*.ts\`. Add an explicit "Anti-Hallucination Hint" in the \`.describe()\` string. These surface directly in the JSON Schema that agents see on \`tools/list\`.
* **Tool Descriptions:** Update the \`description\` fields on tool definition files (e.g., \`src/adapters/mysql/tools/*/index.ts\`). This is the agent's first impression of each tool.
* **Server Instructions:** If a structural hallucination persists, update the markdown fragments in \`src/constants/instructions/markdown/\` and run the generator script (\`pnpm run generate:instructions\`). **DO NOT** edit \`src/constants/server-instructions.ts\` directly.

### Layer 2: Heal Parameter Normalization (Dual-Schema Pattern)
If agents consistently hallucinate inputs that can be logically inferred or normalized, heal them silently via \`z.preprocess()\` wrappers or positional params.

* **Parameter Aliases:** If agents pass \`tableName\` instead of \`table\`, use the alias resolver in \`preprocess-utils.ts\` to automatically map the keys.
* **Type Coercion:** If agents pass strings instead of numbers, use \`coerceNumber\` or similar in Zod to heal it.
* **Positional Params:** If agents intuitively pass positional arguments (e.g., \`mysql.core.readQuery("SELECT 1")\` instead of \`{ sql: "SELECT 1" }\`), update bindings in \`src/codemode/api/constants/positional.ts\`.

### Layer 3: Intercept Sandbox Proxies
When agents execute code in Code Mode, they often make standard Javascript mistakes. Instead of cryptic V8 runtime failures, use Proxy interceptors in \`src/codemode/sandbox.ts\` to throw explicit guidance.

* **Missing \`await\` Catching:** Wrap all RPC Promise returns. If the agent attempts synchronous access (e.g., \`result.success\`), throw: "Did you forget to 'await' the tool call?".
* **Array Method Healing:** Bind array methods (\`.map\`, \`.filter\`) dynamically to the inner array if tools return objects containing arrays (e.g. \`.rows\`, \`.tables\`).
* **Failed Operation Masking:** Prevent agents from destructuring \`data\` or \`rows\` out of a failed response object by explicitly throwing an error referencing the tool failure.

### Layer 4: Manage Aliases Intuitively (The Shadowing Trap)
Agents commonly extrapolate method names based on patterns (e.g., trying to call \`mysql.json.jsonExtract()\` instead of \`mysql.json.extract()\`).

* **Adding Aliases:** Add entries to the \`METHOD_ALIASES\` constant in \`src/codemode/api/constants/aliases.ts\`.
* **Safe Resolution:** Alias resolution happens at API construction time in \`src/codemode/api/generator.ts\`, gracefully copying the reference of the correctly bound function without "shadowing" bugs.

### Layer 5: Inject CLI Guardrails and Help
When an agent hallucinates CLI flags or usage patterns for standalone scripts or the commander CLI:
* **Option Aliasing:** Add hardcoded aliases for commonly truncated flags in commander (e.g., \`.option('--log, --audit-log')\`).
* **Dummy Command Interception:** When creating dummy commands to intercept hallucinations, ALWAYS use \`[args...]\` in the signature to prevent Commander from throwing a "too many arguments" error.
* **Help Meta-Prompting:** Use Commander's \`addHelpText('after', ...)\` to inject explicit \`🤖 AI AGENT INSTRUCTIONS\` directly into the \`--help\` output.
* **Actionable Errors:** Prefix CLI validation failures with \`🛠️ AUTONOMOUS HEALING: \` to prevent agent loop retries.

### Layer 6: Environment & Tooling Guardrails (The Meta-Trap)
Agents often run into environment-level interceptors (like global PowerShell profiles or Git hooks) that throw hallucinatory errors.

* **Fragile Native Tools:** When attempting to heal global environment files, **DO NOT** use the agent-native \`replace_file_content\` tool on large code blocks, as it uses loose heuristics that can permanently butcher files. Use \`multi_replace_file_content\` for single lines, or a deterministic script.
* **Native Tool Priority:** If you trigger a system interceptor for using shell commands like \`cat\`, \`grep\`, or \`ls\`, you MUST autonomously switch to native tools (\`view_file\`, \`grep_search\`, \`list_dir\`). DO NOT ask the user for help.
* **Transient IDE Errors:** If shifting lines triggers IDE typing errors, ALWAYS verify with \`tsc --noEmit\` before refactoring, as it may just be a stale ESLint cache.
* **Interceptor Awareness:** If an agent encounters a global interceptor that contradicts autonomous healing, that profile itself must be healed to instruct the agent to autonomously recover.
* **Command Verification Trap (lib-agent-exec):** In PowerShell utilizing \`lib-agent-exec\` proxy functions, tools (\`git\`, \`bun\`, \`pnpm\`) exist as Aliases/Functions. DO NOT use \`Get-Command <tool> -CommandType Application\` as this explicitly filters out aliases. Use \`Get-Command <tool>\` without the filter.
* **&& Pipeline Chaining:** PowerShell natively DOES NOT support \`&&\`. Always use \`;\` or route commands through \`agent-exec\` with \`target: "wsl2"\` if Unix pipelines are required.
* **Coordinator Guidelines:** Halt execution immediately on \`FAILED_FILE_NOT_FOUND\` rather than retrying unknown paths. Use \`list_dir\` proactively.
* **Audit Tool Payload Bloat:** The audit tool MUST receive at least one filter. If an agent hallucinates a blank audit call, the tool should reject it or the schema should enforce it.

## 2. Phase 2: Implementation

1. Update the necessary files (schemas, instructions, normalizers, aliases).
2. Validate the integrity of your changes by running \`pnpm run check\` (linting, typechecking, E2E tests).
3. **Agent-First Validation (CRITICAL):** Programmatic tests cannot verify if an AI agent is actually healed. You MUST verify the fix against an actual agent by running the usability coordinator workflows (\`test-server/test-usability/coordinator-workflow.md\`).
4. Commit the changes locally.

## 3. Review Important References
- **CLI Wrapper Library (\`lib-agent-exec\`):** Load the \`lib-agent-exec\` skill for execution bridge boundaries and safety rules.
- **MySQL Skill:** Load the \`/mysql\` skill for enterprise production rules, query safety, and schema configurations.
- **MySQL MCP Skill:** Load the \`/mysql-mcp\` skill for architecture and tool usage.
`);
    },
  };
}
