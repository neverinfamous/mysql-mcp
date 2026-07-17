Thank you for contributing to MySQL MCP—the production-ready integration engineered for AI agents!

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
- [ ] Type assertions (e.g., as) — always forbidden (use satisfies or strict type guards instead)
- [ ] I have ensured tool handlers return structured error responses, not raw exceptions
- [ ] I have referenced `gh copilot` instead of the deprecated `github-copilot-cli`
- [ ] I have split files approaching 500 lines
- [ ] I have added new tools to the tool filtering configuration
- [ ] I have added Zod schemas to all new tools
- [ ] I have used kebab-case for new filenames
- [ ] I have not used `continue-on-error: true` in workflow files (except Agentic Workflow `.lock.yml` files)
- [ ] I have run tests locally (e.g., via `pnpm run check`)
- [ ] I have enforced the Dual-Schema Pattern
- [ ] I have ensured Docker instructions use `:latest` tag in `DOCKER_README.md`
- [ ] I have added a prominent Value Proposition to the standard README.md and Wikis
- [ ] I have not added any marketing tone to AGENT_README.md
- [ ] I have ensured the Docker readme is <= 25,000 chars
- [ ] I have ensured table-querying tools return `{exists: false, table}` for nonexistent tables
- [ ] I have correctly configured the file system sandbox to enforce `ALLOWED_IO_ROOTS`
- [ ] I have ensured schema examples accurately reflect the comprehensive toolset and current configuration flags
