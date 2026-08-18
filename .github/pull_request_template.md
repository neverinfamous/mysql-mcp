Thank you for contributing to MySQL MCP—the production-ready, highly observable integration engineered for AI agents!

## Detail Your Value-Adding Changes

Provide a brief, clear description of the changes.

## Link Related Issues

Closes #

## Categorize Your Contribution

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature changing existing functionality)
- [ ] Documentation update

## Confirm Operational Integrity

Detail the specific tests you ran. Ensure thorough validation.

## Verify Quality Standards

- [ ] I have exported any new types in `src/types/index.ts`
- [ ] I have not used `eslint-disable` (always forbidden)
- [ ] I have not used `@ts-ignore`, `@ts-expect-error`, or `as` assertions (use `satisfies` or type guards).
- [ ] I have ensured tool handlers return structured error responses, not raw exceptions
- [ ] I have referenced `gh copilot` instead of the deprecated `github-copilot-cli`
- [ ] I have split files approaching 500 lines
- [ ] I have added new tools to the tool filtering configuration
- [ ] I have added Zod schemas to all new tools
- [ ] I have used kebab-case for new filenames (except for .github templates)
- [ ] I have avoided `continue-on-error: true` in workflow files (except Agentic .lock.yml files).
- [ ] I have run tests locally (e.g., via `pnpm run test` and `pnpm run test:e2e`)
- [ ] I have enforced the Dual-Schema Pattern
- [ ] I have ensured Docker instructions use `:latest` tag for user-facing pulls in `DOCKER_README.md` (infrastructure files must use explicit version tags) and use exact account names (Docker Hub uses 'writenotenow' and GitHub uses 'neverinfamous')
- [ ] I have avoided using 'any' (used 'unknown' instead) and preferred union types over enums.
- [ ] I have added a prominent Value Proposition at the top to the standard README.md and Wikis. I used active voice, benefit-driven headers, and concise sentences (<15 words).
- [ ] I have not added any marketing tone to AGENT_README.md or SKILL.md files
- [ ] I have ensured the Docker readme is <= 25,000 chars and dynamically updated test badges are preserved.
- [ ] I have ensured table-querying tools return `{exists: false, table}` for nonexistent tables
- [ ] I have correctly configured the file system sandbox to enforce `ALLOWED_IO_ROOTS` (if applicable)
- [ ] I have ensured schema examples reflect the comprehensive toolset and current configuration flags.
- [ ] I have ensured version-agnostic text (no exact tool/resource counts)
- [ ] I have verified performance benchmark throughput (via pnpm run bench) for any hot-path modifications
- [ ] I have verified that new features expose relevant Prometheus metrics and maintain observability standards
