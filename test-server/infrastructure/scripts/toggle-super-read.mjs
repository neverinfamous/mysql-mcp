import mysql from 'mysql2/promise';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try to parse .env if exists
try {
  const envPaths = [
    path.join(__dirname, '..', '..', '..', '.env'), // root .env
    path.join(__dirname, '..', '.env') // test-server infra .env
  ];
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const envFile = fs.readFileSync(envPath, 'utf8');
      envFile.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match && !process.env[match[1]]) {
          process.env[match[1]] = match[2];
        }
      });
    }
  }
} catch (e) {
  // ignore
}

async function main() {
  const host = '127.0.0.1';
  const port = 3307;
  const user = 'root';
  const password = 'root';

  console.log(`Connecting to mysql://${user}:***@${host}:${port}...`);
  
  const connection = await mysql.createConnection({
    host,
    port,
    user,
    password,
  });

  try {
    const [current] = await connection.query('SELECT @@global.super_read_only AS super_read_only');
    const currentState = current[0].super_read_only;
    const toggle = currentState ? 0 : 1;
    console.log(`Setting GLOBAL super_read_only = ${toggle}...`);
    await connection.query(`SET GLOBAL super_read_only = ${toggle};`);
    
    const [rows] = await connection.query('SELECT @@global.super_read_only AS super_read_only');
    console.log(`Success! Current state: ${rows[0].super_read_only}`);
  } catch (error) {
    console.error('Error toggling super_read_only:', error);
  } finally {
    await connection.end();
  }
}

main().catch(console.error);
