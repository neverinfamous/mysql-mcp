const fs = require('fs');
const path = require('path');

const dirs = [
    "C:\\Users\\chris\\Desktop\\mysql-mcp\\test-server\\test-advanced",
    "C:\\Users\\chris\\Desktop\\mysql-mcp\\test-server\\test-codemode",
    "C:\\Users\\chris\\Desktop\\mysql-mcp\\test-server\\test-tool-groups",
    "C:\\Users\\chris\\Desktop\\mysql-mcp\\test-server\\test-usability"
];

// Replacement 1: Validation in test files
const oldValidationText = "6. **Validate**: You MUST validate changes locally by running `pnpm run lint`, `pnpm run typecheck`, and `pnpm run test`. You MUST skip `pnpm run test:e2e` (the coordinator will handle E2E at the end). Do NOT ask the user to run tests.";
const newValidationText = "6. **Validate**: You MUST validate changes locally by running `pnpm run lint` and `pnpm run typecheck`. You MUST skip `pnpm run test` (Vitest) and `pnpm run test:e2e` (Playwright), as the coordinator will run the full suite at the end. Do NOT ask the user to run tests.";

// Replacement 2: Commit in test files
const oldCommitText = "5. **Commit**: Stage and commit all changes — do NOT push.";
// We will replace this using regex to dynamically insert the filename
const newCommitTextTemplate = "5. **Commit**: Stage and commit all changes — do NOT push. **CRITICAL**: Your commit message MUST explicitly include the name of this tool group prompt file (e.g. `[Testing: {{FILENAME}}]`) so the history can be traced.";

// Replacement 3: Coordinator Workflow Validation
const oldCoordinatorValidation = "If a subagent modifies the codebase to fix an issue, the subagent MUST validate all changes locally by running `pnpm run lint && pnpm run typecheck && pnpm run test`. They MUST SKIP `pnpm run test:e2e` as the coordinator will run E2E tests at the end. Ensure the local tests pass cleanly and any resulting errors are fixed.";
const newCoordinatorValidation = "If a subagent modifies the codebase to fix an issue, the subagent MUST validate all changes locally by running `pnpm run lint && pnpm run typecheck`. They MUST SKIP `pnpm run test` and `pnpm run test:e2e` as the coordinator will run the full suite at the end. Ensure the local checks pass cleanly and any resulting errors are fixed.";

function walk(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walk(fullPath);
        } else if (fullPath.endsWith('.md')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let updated = false;
            
            // Subagent Test Files Updates
            if (content.includes(oldValidationText)) {
                content = content.replace(oldValidationText, newValidationText);
                updated = true;
            }
            if (content.includes(oldCommitText)) {
                const specificCommitText = newCommitTextTemplate.replace('{{FILENAME}}', file);
                content = content.replace(oldCommitText, specificCommitText);
                updated = true;
            }

            // Coordinator Workflow Updates
            if (content.includes(oldCoordinatorValidation)) {
                content = content.replace(oldCoordinatorValidation, newCoordinatorValidation);
                updated = true;
            }
            
            if (updated) {
                fs.writeFileSync(fullPath, content);
                console.log(`Updated ${fullPath}`);
            }
        }
    }
}

for (const dir of dirs) {
    walk(dir);
}
console.log("Done.");
