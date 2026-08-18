import type { PromptDefinition, RequestContext } from "../../../types/index.js";

function getObservabilitySkillDirectives(): string {
  // Use explicit local skill paths or environment overrides
  const ddPath = process.env["MYSQL_DD_SKILL_PATH"] || "C:\\Users\\chris\\Desktop\\mysql-mcp\\skills\\datadog\\SKILL.md";
  const otelPath = process.env["MYSQL_OTEL_SKILL_PATH"] || "C:\\Users\\chris\\Desktop\\mysql-mcp\\skills\\opentelemetry\\SKILL.md";
  const infraPath = process.env["MYSQL_INFRA_SKILL_PATH"] || "C:\\Users\\chris\\Desktop\\mysql-mcp\\skills\\mysql-mcp-infrastructure\\SKILL.md";

  return `\n\n> **CRITICAL**: Before providing observability configuration guidance, you MUST read the production standards skill files located at:
> - Datadog: \`${ddPath}\`
> - OpenTelemetry: \`${otelPath}\`
> - Test Infrastructure: \`${infraPath}\`
> 
> Adhere strictly to the defined guidelines regarding duplicate autodiscovery prevention, healthchecks, WSL2 context, and trace context propagation.`;
}

export function createSetupObservabilityPrompt(): PromptDefinition {
  return {
    name: "mysql_setup_observability",
    description: "Guide for configuring enterprise observability (Datadog, Prometheus, Loki, OpenTelemetry)",
    arguments: [],
    handler: (_args: Record<string, string>, _context: RequestContext) => {
      const focus = "the complete observability stack (Prometheus, Grafana Alloy, Loki, Datadog)";

      return Promise.resolve(`
You are an expert Reliability Engineer and Database Administrator. 
Please provide a comprehensive guide on setting up and configuring ${focus} for a MySQL and mysql-mcp architecture.

Your guide should cover:
1. **Architecture & Topology**: How the component fits into the overall observability pipeline.
2. **Container Configuration**: Specific docker-compose configurations, required labels, healthchecks, and resource limits.
3. **Common Pitfalls**: What to avoid (e.g., duplicate autodiscovery, Windows/WSL file mount issues).
4. **Validation**: How to verify that the metrics, logs, or traces are successfully flowing.

Use structured Markdown with clear headings and code blocks.
${getObservabilitySkillDirectives()}`);
    },
  };
}
