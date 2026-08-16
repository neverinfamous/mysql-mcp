# Security Tools

**Encapsulated Tools**: Contains a suite of tools for auditing, managing, and inspecting MySQL security settings and data protection mechanisms.
- **SSL status**: `mysql_security_ssl_status` returns SSL/TLS connection status, cipher, certificate paths, and session statistics.
- **Encryption status**: `mysql_security_encryption_status` checks TDE availability, keyring plugins, encrypted tablespaces, and encryption settings.
- **Password validation**: `mysql_security_password_validate` uses MySQL `validate_password` component to check password strength (0-100 scale). Returns a structured `EXTENSION_MISSING` error if the component is not installed.
- **Data masking**: `mysql_security_mask_data` masks sensitive data. Types: `email` (preserves domain), `phone` (shows last 4), `ssn` (shows last 4), `credit_card` (shows first/last 4), `partial` (uses `keepFirst`/`keepLast`). Credit card masking requires more than 8 digits; values with 8 or fewer digits are fully masked with a `warning` field.
- **User privileges**: `mysql_security_user_privileges` returns comprehensive user privilege report. Filter with `user` parameter to reduce payload. Returns `{"success": false, "error": "..."}` for nonexistent users (P154). Use `summary: true` for condensed output (privilege counts instead of raw GRANT strings). Summary mode caps `globalPrivileges` at 10 entries and includes `totalGlobalPrivileges` for the full count.
- **Sensitive tables**: `mysql_security_sensitive_tables` identifies columns matching sensitive patterns (password, email, ssn, etc.). Use `schema` parameter to limit scope. Returns `{"success": false, "error": "..."}` for nonexistent schemas (P154).
- **Enterprise features**: `mysql_security_firewall_status` and `mysql_security_firewall_rules` report availability and suggest installation for MySQL Enterprise Edition.
- **Security audit**: `mysql_security_audit` audits user privileges and settings.
- **Anti-Hallucination**: For `mysql_security_audit` and `mysql_security_firewall_rules`, use the `user` parameter to filter by user (do not use `username`).

### Example: Data Masking
```json
{
  "value": "123-45-6789",
  "type": "ssn"
}
```
