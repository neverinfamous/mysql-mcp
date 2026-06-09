# Test Advanced: Session Lifecycle

This document provides testing instructions to validate the HTTP transport session lifecycle (idle timeout, absolute TTL, sweep enforcement, and in-flight request protection) implemented in `mysql-mcp`. 

> **Important**: This test is primarily observational. Since timeouts are 30 minutes (idle) and 24 hours (TTL), we cannot easily wait for them to expire in a standard CI/CD test loop. Instead, we validate the presence of the health metrics, error handling structure, and basic persistence.

## Execution Rules

1.  **Transport Requirements**: This test *must* be run against the `mysql-mcp` server started in **HTTP Mode** (`--transport http`), since Stdio mode does not use HTTP sessions.
2.  **No Direct Code Execution**: Unlike other advanced tests, this is not executing complex MySQL queries via Code Mode. We are making direct HTTP requests (or using the `mcp-client` CLI or equivalent test harness) to validate HTTP protocol behavior.
3.  **Observation**: The agent should document that the timeouts are correctly configured and that the `/health` endpoint exposes `activeSessions`.

## Test Steps

### Step 1: Baseline Health Check

Before establishing any sessions, call the HTTP `/health` endpoint.

**Expected Result**:
The server should respond with `200 OK` and the JSON body should indicate `status: "healthy"`. The `activeSessions` count should be `0` (or absent if no sessions have ever been created).

### Step 2: Establish a Session

Initialize a new Streamable HTTP session via `POST /mcp` (using the standard MCP 2025-03-26 initialization payload) or use an MCP client to connect.

**Expected Result**:
The server should respond with a valid initialization response and assign a session ID via the `mcp-session-id` header (or equivalent).

### Step 3: Validate Active Sessions Metric

Call the HTTP `/health` endpoint again.

**Expected Result**:
The JSON body must include `"activeSessions": 1` (or incremented by 1 from the baseline). This confirms the `SessionManager` is tracking the new session.

### Step 4: Validate Ongoing Communication

Use the established session to execute a simple tool (e.g., `mysql_server_health`).

**Expected Result**:
The tool executes successfully, proving the session is active and functional. The `SessionManager.touch()` method is implicitly called during this request.

### Step 5: Document Timeout Behavior

Document (in the test results) that the following behaviors are expected by design, even if they cannot be strictly verified in a short test run:
-   **Idle Timeout**: The session will expire after 30 minutes of inactivity.
-   **Absolute TTL**: The session will forcefully expire after 24 hours, regardless of activity.
-   **Sweep Interval**: The server runs a cleanup task every 1 minute.
-   **In-Flight Protection**: A session will not be reaped by the sweep if a request is currently executing.
-   **Expiration Error**: An expired session will return a `401 Unauthorized` with the message `"Session absolute TTL expired"` (or a `400 Bad Request` if it was already reaped by the sweep and no longer exists).

### Step 6: Session Termination

Terminate the session by sending a `DELETE /mcp` request with the correct `mcp-session-id` header, or by closing the client connection. Wait briefly for the cleanup to occur.

### Step 7: Final Validation

Call the HTTP `/health` endpoint one last time.

**Expected Result**:
The `activeSessions` count should return to `0` (or its baseline value).

## Success Criteria

- [ ] `GET /health` successfully returns the `activeSessions` property.
- [ ] Session initialization increments `activeSessions`.
- [ ] Session termination decrements `activeSessions`.
- [ ] Timeout parameters (30m idle, 24h TTL) are correctly documented in the final report.
