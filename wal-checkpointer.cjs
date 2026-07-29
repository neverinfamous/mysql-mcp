const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'logs', 'mcp-audit.sqlite');
console.log('Starting background WAL checkpointer for', dbPath);

try {
  const db = new Database(dbPath);
  
  // Provide the key if encrypted
  const key = process.env.DB_ENCRYPTION_KEY || "adamic123";
  db.pragma(`key = '${key}'`);
  
  console.log('Connected. Running checkpoint every 10 seconds...');
  
  setInterval(() => {
    try {
      // Use PASSIVE so we don't block writers, just flush whatever we can
      db.pragma('wal_checkpoint(PASSIVE)', { simple: true });
      process.stdout.write('.'); // heartbeat
    } catch (err) {
      if (err.code !== 'SQLITE_BUSY') {
        console.error('\nCheckpoint error:', err);
      }
    }
  }, 10000);
  
  // Keep alive
  process.on('SIGINT', () => {
    console.log('\nShutting down checkpointer...');
    db.close();
    process.exit(0);
  });
} catch (err) {
  console.error('Fatal Error:', err);
}
