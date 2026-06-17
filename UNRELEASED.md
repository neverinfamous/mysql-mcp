## [Unreleased]

### Fixed
- Fixed transaction handlers (`mysql_transaction_savepoint`, `mysql_transaction_release`, `mysql_transaction_rollback_to`, and `mysql_transaction_execute`) to correctly throw structured `TransactionError`s instead of generic `Error`s when an active transaction is not found, ensuring consistent domain error classification instead of fallback `UNKNOWN_ERROR`s. (`f6588fe`)
