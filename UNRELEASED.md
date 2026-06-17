## [Unreleased]

### Fixed
- Fixed vector search tools (`mysql_vector_search`, `mysql_vector_range_search`, `mysql_vector_hybrid_search`) leaking raw MySQL `"Incorrect arguments to from_vector"` errors when querying non-vector columns. They now properly return a structured `INVALID_COLUMN_TYPE` error. (`9cba8d5`)
- Fixed transaction handlers (`mysql_transaction_savepoint`, `mysql_transaction_release`, `mysql_transaction_rollback_to`, and `mysql_transaction_execute`) to correctly throw structured `TransactionError`s instead of generic `Error`s when an active transaction is not found, ensuring consistent domain error classification instead of fallback `UNKNOWN_ERROR`s. (`f6588fe`)
