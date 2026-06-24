import { readFileSync } from 'fs';
import mysql from 'mysql2/promise';

async function seed() {
  const sql = readFileSync('test-server/test-seed.sql', 'utf8');
  const conn = await mysql.createConnection({
    host: '127.0.0.1', port: 3307, user: 'cluster_admin', password: 'cluster_admin', database: 'testdb', multipleStatements: true
  });
  
  await conn.query(sql);
  await conn.end();
  console.log("Seeding complete!");
}
seed().catch(console.error);
