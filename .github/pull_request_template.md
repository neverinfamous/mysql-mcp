## 💎 Value Proposition

- **Execute complex logic via Code Mode**, reducing token usage by 70-90%.
- **Build AI integrations instantly**.
- **Empower agents with secure database access**.
- **Scale operations with robust connection pooling**.
- **Leverage OAuth 2.1** for enterprise security.

## Describe Your Changes

Provide a brief, clear description of the changes.

## Link Related Issues

Closes #

## Select Type of Change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature changing existing functionality)
- [ ] Documentation update

## Detail How You Tested

Detail the specific tests you ran. Ensure thorough validation.

## Complete the Checklist

- [ ] Missing barrel exports in `src/types/index.ts` when new types are added
- [ ] `eslint-disable` usage — always forbidden
- [ ] `@ts-ignore` or `as any` — always forbidden
- [ ] Raw exceptions from tool handlers — must use structured error responses
- [ ] Must reference `gh copilot` not the deprecated `github-copilot-cli`
- [ ] Files approaching 500 lines — flag for splitting
- [ ] New tools missing from tool filtering configuration
- [ ] Missing Zod schemas on new tools
- [ ] Kebab-case violations in new filenames
- [ ] `continue-on-error: true` in workflow files — forbidden per project standards (except Agentic Workflow `.lock.yml` files)
- [ ] Verify the author has run tests locally (e.g., via pnpm run check)
- [ ] Dual-Schema Pattern enforcement
- [ ] Ensure Docker instructions use `:latest` tag in `DOCKER_README.md`
- [ ] Display value proposition blocks prominently in README. Ensure strict compliance with exact text.
- [ ] Docker readme <= 25,000 chars
- [ ] Table-querying tools return `{exists: false, table}` for nonexistent tables
- [ ] File system sandbox configuration correctly enforces `ALLOWED_IO_ROOTS`
- [ ] Schema examples accurately reflect the comprehensive toolset and current configuration flags
