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

function runQuiet(command) {
    try {
        return execSync(command, { encoding: 'utf-8', cwd: REPO_ROOT, stdio: 'pipe' });
    } catch {
        return '';
    }
}

console.log('=== Recreating MySQL Test Ecosystem ===');

try {
    // Dynamically discover all service container names from docker-compose.yml
    console.log('\n[Cleanup] Discovering containers from docker-compose.yml...');
    const services = runQuiet('docker compose config --services').trim().split('\n').filter(Boolean);
    if (services.length === 0) {
        throw new Error('No services found in docker-compose.yml. Is the file valid?');
    }
    console.log(`[Cleanup] Found ${services.length} services: ${services.join(', ')}`);

    // Forcefully remove any orphaned/conflicting containers by name
    console.log('[Cleanup] Forcefully removing any potentially conflicting containers...');
    for (const name of services) {
        runQuiet(`docker rm -f ${name}`);
    }

    run('docker compose down -v --remove-orphans');
    console.log('\n[Wait] Giving Docker daemon time to flush networks...');
    await setTimeout(5000);

    run('docker compose up -d');
    console.log('\n[Wait] Waiting for containers to initialize...');
    await setTimeout(10000);

    console.log('\n[Bootstrap] Starting InnoDB Cluster bootstrap process...');
    run('node scripts/create-cluster.mjs');
    
    console.log('\n[Seed] Automatically seeding the test database...');
    run('node scripts/reset-database.mjs --skip-verify');
    
    console.log('\n✅ MySQL Test Ecosystem Successfully Recreated.');
} catch (error) {
    console.error('\n❌ Ecosystem recreation failed:', error.message);
    process.exit(1);
}
