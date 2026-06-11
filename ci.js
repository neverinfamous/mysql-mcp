const { execSync } = require('child_process');
try {
  console.log("Running lint/typecheck...");
  execSync('pnpm run check', { stdio: 'inherit' });
  console.log("Running build...");
  execSync('pnpm run build', { stdio: 'inherit' });
  console.log("Running vitest tests...");
  execSync('pnpm run test', { stdio: 'inherit' });
  console.log("Running playwright e2e tests...");
  execSync('pnpm run test:e2e', { stdio: 'inherit' });
} catch (e) {
  console.error("Task failed!");
  process.exit(1);
}
console.log("All tasks completed successfully!");
