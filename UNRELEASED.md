# Unreleased

### Changed
- Refactored server instructions to an Adaptive Instruction Architecture (matching `db-mcp`) with a static slim payload and on-demand `mysql://help/{group}` resources.
- Removed legacy `--instruction-level` CLI flag, environment variables, and `InstructionLevel` configuration options to reduce complexity and improve token efficiency.
- Updated `scripts` tests and `test-server` prompt readmes to remove legacy `instruction-level` references and validate the new Adaptive Instruction Architecture parameters.

### Fixed
- Fixed Playwright E2E tests failing with `--super-read-only` errors by correcting the default test database connection string to target port 3306 (`mysql-final`) instead of an InnoDB Cluster secondary node (port 3307).
- Fixed missing `mysql://help/introspection` and `mysql://help/migration` resources from the active help registry.
