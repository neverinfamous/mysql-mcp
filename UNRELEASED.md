# Unreleased

### Added

### Changed

### Deprecated

### Removed

### Fixed

- **Progress Notifications**: Resolved TypeScript typing and ESLint errors in the backup and maintenance tools by ensuring `RequestContext` is properly typed with `progressToken` and `server`. Added backwards-compatible `start()` and `progress()` aliases to `ProgressReporter` for seamless integration.

### Security
