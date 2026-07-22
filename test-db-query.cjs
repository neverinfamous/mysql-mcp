const Database = require('better-sqlite3-multiple-ciphers');
const db = new Database('C:/Users/chris/Desktop/mysql-mcp/logs/mcp-audit.sqlite');
db.pragma("key = 'adamic123'");
console.log(db.prepare('SELECT tool, tokens, calls, timestamp FROM metrics_snapshots ORDER BY id DESC LIMIT 5;').all());
