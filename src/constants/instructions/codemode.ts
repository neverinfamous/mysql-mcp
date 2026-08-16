export const CODEMODE_HELP = `# Code Mode

**Encapsulated Tools**: \`mysql_execute_code\`

Execute JavaScript in a worker-thread sandbox (separate V8 isolate). Access all MySQL tools via \`mysql.*\` API. 70-90% token savings.

## Testing Architecture

Code Mode serves as the primary verification engine for the test suite. 
To ensure tests remain synchronized with the server's tool mappings, test files are dynamically generated rather than manually maintained. Do not rely on exhaustive test file lists.

- **Source of Truth**: \`test-manifest.ts\` defines all test groups, templates, and generation parameters.
- **Generator Engine**: \`test-server/scripts/generate-tests.ts\` compiles the manifest into markdown test files.
- **Updating Tests**: Modify the manifest and run the generator engine.`;
