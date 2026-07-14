## Hallucination & Usability Fuzzing

> **Instructions**: You must organically test the tool group using code mode (`mysql_execute_code`), intentionally fuzzing the inputs.
> 1. Provide edge cases, unexpected types, and boundary values.
> 2. Ensure that the tool gracefully handles errors and returns structured domain errors, rather than crashing or returning raw `-32602` or `FAILED_FILE_NOT_FOUND` errors.
> 3. If you find a hallucination or unhandled edge case, you must apply a permanent fix to the codebase to harden it against this scenario.
