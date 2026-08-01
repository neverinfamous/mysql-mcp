import { execFileSync } from 'child_process';
import dgram from 'dgram';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

const isWindows = process.platform === 'win32';
const dockerCmd = isWindows ? 'wsl' : 'docker';

const execCommand = (cmd, args, ignoreError = false) => {
  try {
    return execFileSync(cmd, args, { encoding: 'utf-8', stdio: 'pipe', cwd: REPO_ROOT });
  } catch (e) {
    if (!ignoreError) {
      console.error(`Error: ${e.message}`);
    }
    return null;
  }
};

const dockerExec = (container, cmdArgs, ignoreError = true) => {
    const args = isWindows
        ? ['docker', 'exec', container, ...cmdArgs]
        : ['exec', container, ...cmdArgs];
    return execCommand(dockerCmd, args, ignoreError);
};

const emitStatus = () => {
    console.log('Verifying MySQL Shell Status...');
    const jsPayload = "try { var c = dba.getCluster('mcpCluster'); print('OK'); } catch(e) { print('ERROR: ' + e.message); process.exit(1); }";
    const shellOut = dockerExec('mysql-node1', ['mysqlsh', '--user=root', '--password=root', '--host=127.0.0.1', '--port=3306', '--js', '-e', jsPayload], true);

    const isUp = shellOut && shellOut.includes('OK');
    const statusValue = isUp ? 1 : 0;

    if (isUp) {
        console.log(`✅ mysqlsh successfully read InnoDB Cluster metadata`);
    } else {
        console.log(`❌ mysqlsh could not verify cluster metadata`);
        if (shellOut) {
            console.log(shellOut.trim());
        }
    }

    // Send to DogStatsD (datadog-unified exposes UDP 8125 on host)
    const metricPayload = `mysql_mcp.shell.status:${statusValue}|g|#env:development`;

    if (isWindows) {
        // Send metric via WSL to bypass Windows->WSL UDP networking restrictions
        execCommand('wsl', ['bash', '-c', `echo -n "${metricPayload}" | nc -u -w0 127.0.0.1 8125`], true);
        console.log(`Sent metric (via WSL): ${metricPayload}`);
    } else {
        const client = dgram.createSocket('udp4');
        const message = Buffer.from(metricPayload);
        
        client.send(message, 8125, '127.0.0.1', (err) => {
            if (err) {
                console.error('Failed to send metric to DogStatsD:', err);
            } else {
                console.log(`Sent metric: ${metricPayload}`);
            }
            client.close();
        });
    }
};

const watch = process.argv.includes('--watch');

if (watch) {
    console.log('👀 Watching MySQL Shell Status every 60 seconds...');
    emitStatus();
    setInterval(emitStatus, 60000);
} else {
    emitStatus();
}
