## Group Focus

> **Instructions**: The subagent MUST autonomously generate and execute exhaustive, adversarial tests for the explicitly required tools below. 
> 
> **CRITICAL EXECUTION REQUIREMENTS**:
> 1. **Live Execution**: You MUST execute live direct MCP tool calls. Do NOT simulate or mock responses.
> 2. **Realistic Data**: You MUST use realistic database schemas, queries, and scenarios relevant to this domain. Do NOT use lazy placeholders like `foo` or `bar`.
> 3. **Error Paths & Graceful Degradation**: You MUST test negative scenarios (e.g. invalid permissions, non-existent tables) and ensure the tool returns a properly formatted MCP error, not an unhandled stack trace.
> 4. **No Hallucination**: You MUST strictly adhere to the defined tool schema in `tool-reference.md`. Do NOT invent parameters.
