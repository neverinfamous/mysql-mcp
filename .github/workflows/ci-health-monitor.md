---
description: 'Weekly audit of CI workflows for deprecations, outdated actions, and health issues'
private: true
labels: [maintenance, ci-cd]

on:
  schedule:
    - cron: "0 14 * * 3" # Every Wednesday at 14:00 UTC
  workflow_dispatch:

engine:
  id: copilot
  model: claude-3-5-sonnet-latest

secrets:
  COPILOT_GITHUB_TOKEN: ${{ secrets.COPILOT_GITHUB_TOKEN }}
  GH_AW_GITHUB_MCP_SERVER_TOKEN: ${{ secrets.GH_AW_GITHUB_MCP_SERVER_TOKEN }}
  GH_AW_GITHUB_TOKEN: ${{ secrets.GH_AW_GITHUB_TOKEN }}
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

network:
  allowed:
    - defaults
    - node

permissions: read-all


safe-outputs:
  report-failure-as-issue: false
  create-issue:
    title-prefix: "[ci-health] "
    labels: [maintenance, ci-cd]
    max: 1
  noop:
    max: 1

timeout-minutes: 15
concurrency: ci-health-monitor
---

# CI Health Monitor Instructions

Audit the mysql-mcp CI/CD infrastructure to guarantee peak reliability. Proactively identify deprecations, outdated actions, and pipeline bottlenecks.

## Audit Instructions

- **Only report actionable findings.** Don't flag things that are working correctly.
- **If everything is healthy, report "all clear" via noop.** Do not create empty issues.
- **Be specific with fix suggestions.** Include the exact file, line, and replacement value.

## Inspect Workflows for Reliability

List all `.yml` files in `.github/workflows/`, explicitly excluding auto-generated lockfiles (`*.lock.yml`). For each workflow file:

1. **Check action versions** — for each `uses:` line, note the action name and version/tag. Check if a newer major or minor version exists by reading the action's releases.
2. **Check Node.js runtime** — focus on action versions, not deprecated flags. Look for actions using deprecated Node.js versions. Flag any blocking target runtime compatibility.
3. **Check for deprecated features** — such as set-output, save-state, or ::set-output:: commands.
4. **Check Dependabot config**. Verify .github/dependabot.yml covers used ecosystems (npm, GitHub Actions, Docker).

## Pipeline Execution Trends

Check recent workflow runs (last 7 days):

1. Any workflows with consistent failures?
2. Any runs with annotations or warnings?
3. Any runs that are abnormally slow?

## Reporting Output

Before creating a new issue, check for existing open issues with the `[ci-health]` prefix. Use the `noop` tool if an issue is already being tracked. Create a new issue only if none exists.

### If issues are found:

Create an issue via safe-output with this structure:

```
## 🏥 CI Health Report — [DATE]

### 🔴 Critical (blocks current target Node.js runtime compatibility)
- [action@version] in [workflow.yml] — needs update to [version] for current target Node.js runtime

### 🟡 Warnings
- [description of warning/deprecation]

### 🟢 Healthy
- [list of workflows that passed all checks]

### Suggested Fixes
1. [exact code change with file + line]
```

### If everything is healthy:

Use the noop tool with: "✅ CI Health Check — all workflows healthy, no deprecations or issues found."
