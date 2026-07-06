# Security Tools

Tools: `mysql_security_audit`, `mysql_security_firewall_status`, `mysql_security_firewall_rules`, `mysql_security_mask_data`, `mysql_security_password_validate`, `mysql_security_ssl_status`, `mysql_security_user_privileges`, `mysql_security_sensitive_tables`, `mysql_security_encryption_status`
- **SSL status**: `mysql_security_ssl_status` returns SSL/TLS connection status, cipher, certificate paths, and session statistics.
- **Encryption status**: `mysql_security_encryption_status` checks TDE availability, keyring plugins, encrypted tablespaces, and encryption settings.
- **Password validation**: `mysql_security_password_validate` uses MySQL `validate_password` component to check password strength (0-100 scale). Returns `available: false` if component not installed.
- **Data masking**: `mysql_security_mask_data` masks sensitive data. Types: `email` (preserves domain), `phone` (shows last 4), `ssn` (shows last 4), `credit_card` (shows first/last 4), `partial` (uses `keepFirst`/`keepLast`). Credit card masking requires more than 8 digits; values with 8 or fewer digits are fully masked with a `warning` field.
- **User privileges**: `mysql_security_user_privileges` returns comprehensive user privilege report. Filter with `user` parameter to reduce payload. Returns `{ exists: false, user }` for nonexistent users (P154). Use `summary: true` for condensed output (privilege counts instead of raw GRANT strings). Summary mode caps `globalPrivileges` at 10 entries and includes `totalGlobalPrivileges` for the full count.
- **Sensitive tables**: `mysql_security_sensitive_tables` identifies columns matching sensitive patterns (password, email, ssn, etc.). Use `schema` parameter to limit scope. Returns `{ exists: false, schema }` for nonexistent schemas (P154).
- **Enterprise features**: `mysql_security_firewall_status` and `mysql_security_firewall_rules` report availability and suggest installation for MySQL Enterprise Edition.
- **Audit fallback**: `mysql_security_audit` falls back to `performance_schema.events_statements_history` when Enterprise Audit is unavailable. In fallback mode, `startTime` is ignored (picosecond counters incompatible with ISO timestamps — noted in `filtersIgnored`). `eventType` uses LIKE matching against `EVENT_NAME` (e.g., `"Execute"`, `"Ping"`). Default limit is 5.
- **Anti-Hallucination**: For `mysql_security_audit` and `mysql_security_firewall_rules`, use the `user` parameter to filter by user (do not use `username`).

### Example: Data Masking
```json
{
  "value": "123-45-6789",
  "type": "ssn"
}
```
