# Instructions

> **Value Proposition:** This architecture separates documentation from code. Non-developers and domain experts manage prompt engineering. They update server instructions safely without touching TypeScript. This ensures agents always receive synchronized, current guidance.

This directory contains the compiled server instructions in TypeScript format.
These `.ts` files are auto-generated from the `.md` files in `src/constants/instructions/markdown`.

DO NOT EDIT THESE `.ts` FILES DIRECTLY.
Instead, edit the corresponding `.md` file in `src/constants/instructions/markdown` and run:

```bash
pnpm run generate:instructions
```

This ensures the markdown source of truth remains synchronized with the code.
