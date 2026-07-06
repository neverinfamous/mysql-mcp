## Description

Provide a brief, clear description of the changes.

## Related Issue

Closes #

## Type of Change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature changing existing functionality)
- [ ] Documentation update

## How Has This Been Tested?

Detail the specific tests you ran. Ensure thorough validation.

## Checklist

- [ ] My code follows all project style guidelines (kebab-case filenames).
- [ ] I performed a rigorous self-review of my code.
- [ ] No `eslint-disable`, `@ts-ignore`, or `as any` used (always forbidden).
- [ ] Source files are under ~500 lines (split if necessary).
- [ ] Structured error responses used in tool handlers (never raw exceptions).
- [ ] Dual-Schema Pattern enforced (with Zod schemas for all new tool inputs).
- [ ] New tools added to tool filtering configuration.
- [ ] Missing barrel exports added to `src/types/index.ts` if new types were created.
- [ ] Table-querying tools return `{exists: false, table}` for nonexistent tables.
- [ ] File system sandbox configuration correctly enforces `ALLOWED_IO_ROOTS`.
- [ ] No `continue-on-error: true` in workflow files.
- [ ] All new and existing tests pass locally (`pnpm run check`).
- [ ] I ensured marketing compliance (prominent Value Proposition, active voice, <15 words) and Docker readme <= 25,000 chars.
