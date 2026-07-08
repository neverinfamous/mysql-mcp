import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const REPO_ROOT = join(__dirname, '..');

function run(command) {
    console.log(`\n> ${command}`);
    execSync(command, { stdio: 'inherit', cwd: REPO_ROOT });
}

console.log('=== Recreating MySQL Test Ecosystem ===');

try {
    run('docker compose down -v --remove-orphans');
    console.log('\n[Wait] Giving Docker daemon time to flush networks...');
    execSync('ping 127.0.0.1 -n 6 > nul'); // Windows sleep 5s

    run('docker compose up -d');
    console.log('\n[Wait] Waiting for containers to initialize...');
    execSync('ping 127.0.0.1 -n 11 > nul'); // Windows sleep 10s

    console.log('\n[Bootstrap] Starting InnoDB Cluster bootstrap process...');
    run('node scripts/create-cluster.mjs');
    
    console.log('\n✅ MySQL Test Ecosystem Successfully Recreated.');
} catch (error) {
    console.error('\n❌ Ecosystem recreation failed:', error.message);
    process.exit(1);
}
