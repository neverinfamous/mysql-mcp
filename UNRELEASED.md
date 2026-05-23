# Unreleased

### Added

### Changed

### Deprecated

### Removed

### Fixed

- **Progress Notifications**: Resolved TypeScript typing and ESLint errors in the backup and maintenance tools by ensuring `RequestContext` is properly typed with `progressToken` and `server`. Added backwards-compatible `start()` and `progress()` aliases to `ProgressReporter` for seamless integration.

### Security

- **Code Mode**: Added V8 `codeGeneration` restrictions (`{ strings: false, wasm: false }`) to `vm.createContext` — disables `eval()` and `Function()` at the engine level
- **Code Mode**: Added frozen built-in prototypes inside the vm sandbox context — prevents dynamic constructor chain escapes (e.g., `Error().constructor.constructor('return process')()`)
- **Code Mode**: Nullified `Proxy` constructor in sandbox globals (`Proxy: undefined`) — prevents meta-object protocol abuse
- **Code Mode**: Upgraded `Reflect.construct` blocked pattern to `Reflect.*` — covers `getPrototypeOf`, `ownKeys`, `construct`, etc.
- **Code Mode**: Added `Symbol.*` blocked pattern — prevents `hasInstance`, `toPrimitive`, and other well-known symbol overrides
- **Code Mode**: Added `new Proxy(` blocked pattern — defense-in-depth alongside Proxy nullification
- **Code Mode**: Added RPC allowlist validation — host-side verification prevents workers from invoking unauthorized API methods
- **Code Mode**: Added streaming egress boundary enforcement — `JSON.stringify` replacer aborts mid-flight when result exceeds `CODE_MODE_MAX_RESULT_SIZE` (default 100KB), preventing OOM
- **Code Mode**: Added `CODE_MODE_MAX_RESULT_SIZE` environment variable (default 100KB, cap 50MB)
- **Code Mode**: Reduced default `maxResultSize` from 10MB to 100KB (fleet standard)
- **Code Mode**: Aligned `maxYoungGenerationSizeMb` formula to `max(8, floor(memoryLimitMb/8))` (fleet standard)
- **Docs**: Fixed SECURITY.md copy-paste errors referencing "postgres-mcp" instead of "mysql-mcp"
