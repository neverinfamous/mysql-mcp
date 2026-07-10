import { execSync } from 'child_process';
import { setTimeout } from 'timers/promises';
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
    // Dynamically fetch the Windows host IP (WSL2 Default Gateway) to allow Docker containers to scrape metrics
    console.log('\n[Network] Fetching Windows Host IP...');
    const wslGateway = execSync(`wsl bash -c "ip route show default | awk '{print \\$3}'"`).toString().trim();
    console.log(`[Network] Windows Host IP: ${wslGateway}`);
    
    // Write to .env so docker-compose can use it for extra_hosts
    execSync(`echo WINDOWS_HOST_IP=${wslGateway} > .env`, { cwd: REPO_ROOT });

    run('docker compose down -v --remove-orphans');
    console.log('\n[Wait] Giving Docker daemon time to flush networks...');
    await setTimeout(5000); // 5s sleep

    run('docker compose up -d');
    console.log('\n[Wait] Waiting for containers to initialize...');
    await setTimeout(10000); // 10s sleep

    console.log('\n[Bootstrap] Starting InnoDB Cluster bootstrap process...');
    run('node scripts/create-cluster.mjs');
    
    console.log('\n[Seed] Automatically seeding the test database...');
    run('node scripts/reset-database.mjs --skip-verify');
    
    console.log('\n✅ MySQL Test Ecosystem Successfully Recreated.');
} catch (error) {
    console.error('\n❌ Ecosystem recreation failed:', error.message);
    process.exit(1);
}
