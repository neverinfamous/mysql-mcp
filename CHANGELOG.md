# Changelog

## 💎 Value Proposition

MySQL MCP is a production-ready integration engineered for AI agents. It minimizes LLM token consumption by up to 90% via sandboxed Code Mode. It scales reliably through built-in connection pooling. It secures database access using strict OAuth 2.1 validation.

This project uses `bun ./.agents/scripts/commit.ts` to enforce a single-source-of-truth Git commit strategy. The commit wrapper embeds all changelog entries and release notes directly into the Git commit history. The release process compiles them automatically.

- **To view Unreleased changes:** View the recent git history or run the Adamic `preview-changelog.mjs` script.
- **To view Past Releases:** Please refer to the [GitHub Releases](https://github.com/neverinfamous/mysql-mcp/releases) page or the `releases/` directory.
