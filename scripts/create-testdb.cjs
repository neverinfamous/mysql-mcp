const mysql = require('mysql2/promise');
async function run() {
  const c = await mysql.createConnection({host:'127.0.0.1', port:3307, user:'root', password:'root'});
  try { await c.query('SET GLOBAL super_read_only = OFF;'); } catch(e) {}
  try { await c.query('SET GLOBAL read_only = OFF;'); } catch(e) {}
  await c.query('CREATE DATABASE IF NOT EXISTS testdb;');
  console.log('created');
  process.exit(0);
}
run();
