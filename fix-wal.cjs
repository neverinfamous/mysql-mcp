const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'logs', 'mcp-audit.sqlite');
console.log('Connecting to', dbPath);

try {
  const db = new Database(dbPath);
  
  // Provide the key if encrypted
  const key = process.env.DB_ENCRYPTION_KEY || "adamic123";
  db.pragma(`key = '${key}'`);
  
  console.log('Current journal mode:', db.pragma('journal_mode', { simple: true }));
  
  console.log('Setting journal mode to TRUNCATE...');
  db.pragma('journal_mode = TRUNCATE');
  
  console.log('New journal mode:', db.pragma('journal_mode', { simple: true }));
  
  // Force a checkpoint just in case
  db.pragma('wal_checkpoint(TRUNCATE)');
  console.log('Checkpoint complete.');
  
  db.close();
  console.log('Done.');
} catch (err) {
  console.error('Error:', err);
}
