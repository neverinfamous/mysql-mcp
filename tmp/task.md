# MySQL-MCP Advanced Stress Tests: [transactions]

## 📝 Test Execution Summary
- **Target**: `mysql-mcp` (transactions tool group)
- **Method**: Code Mode (`mysql_execute_code`)
- **Status**: ✅ Passed (with 1 alias parity issue)

## 📊 Findings & Metrics

### Category 1: Rollback Recovery
- **Test 1**: ✅ Rollback Recovery OK (Row does not exist after rollback)
- **Test 2**: ✅ Savepoint Rollback OK (Preserves first row, drops second)
- **Test 3**: ✅ Empty commit OK (No error on empty transaction commit)

### Category 2: Abandoned Transactions
- **Test 4**: ✅ Second begin succeeded with new ID, previous transaction state isolated (returns structured error or successfully creates new transaction)
- **Test 5**: ✅ Explicit isolation OK (via `isolationLevel: 'READ COMMITTED'`)
  - ⚠️ **Issue**: Parameter alias `isolation_level` is ignored, silently falling back to default isolation level (REPEATABLE-READ) instead of applying the requested isolation.

### Category 3: Rapid State Transitions
- **Test 6**: ✅ Rapid state transitions OK (5 sequential begin/commit cycles completed without connection pool exhaustion)
- **Test 7**: ✅ Large transaction_execute OK (15 bulk statements executed and validated successfully)

### Category 4: Mixed Statement Failures
- **Test 8**: ✅ Mixed validity rollback OK (Rolls back valid statements on batch failure, returns structured error)
- **Test 9**: ✅ Empty statements error OK (Returns structured error on empty `statements: []` input)
- **Test 10**: ✅ PK violation rollback OK (Auto-rollback and structured error on duplicate insert)

### Cleanup
- **Test 11**: ✅ Cleanup OK (No lingering `stress_tx` tables or dangling connections)

## ❌ Failures
- `[]` (None)

## 📦 Payload Metrics
- **Token Estimate**: ~226 tokens per full verification pass
- **Execution Time**: ~3045ms (11 combined transactional steps)
- **Memory Used**: ~0MB overhead reported

## 🛠 Required Actions
- Add schema/parameter alias parity for `isolation_level` -> `isolationLevel` in the `transactions.begin` tool.
