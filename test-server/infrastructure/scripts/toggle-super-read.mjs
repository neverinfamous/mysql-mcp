import { createConnection } from 'mysql2/promise';

async function main() {
  const host = process.env.DB_HOST || '127.0.0.1';
  const port = Number(process.env.DB_PORT) || 3307;
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || 'root';

  console.log(`Connecting to mysql://${user}:***@${host}:${port}...`);
  
  const connection = await createConnection({ host, port, user, password });

  try {
    // Toggle natively on the database side (reduces network round-trips)
    await connection.query('SET GLOBAL super_read_only = NOT @@global.super_read_only');
    
    // Fetch the new state
    const [rows] = await connection.query('SELECT @@global.super_read_only AS super_read_only');
    console.log(`Success! Current state: ${rows[0].super_read_only}`);
  } catch (error) {
    console.error('Error toggling super_read_only:', error);
    process.exitCode = 1;
  } finally {
    await connection.end();
  }
}

main();
