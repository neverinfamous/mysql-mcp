import { execSync } from 'child_process';

const serverName = process.argv[2];

if (!serverName) {
  console.error('Usage: bun .\\.agents\\scripts\\restart-mcp.ts <server-name>');
  process.exit(1);
}

console.log(`🔄 Attempting to restart MCP server: ${serverName}`);

try {
  // Fetch all node.exe processes with their command lines
  const output = execSync('wmic process where "name=\'node.exe\'" get processid,commandline /format:csv', { encoding: 'utf-8' });
  
  const lines = output.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  let killed = 0;
  for (const line of lines) {
    if (line.includes('CommandLine') || line.includes('Node,')) continue; // Skip header
    
    // Line format: Node, CommandLine, ProcessId
    // The command line might contain commas, so we take the last part after the last comma as the PID
    const lastCommaIdx = line.lastIndexOf(',');
    if (lastCommaIdx === -1) continue;
    
    const cmdLine = line.substring(0, lastCommaIdx);
    const pidStr = line.substring(lastCommaIdx + 1).trim();
    const pid = parseInt(pidStr, 10);
    
    if (isNaN(pid)) continue;
    
    if (cmdLine.includes(serverName) && !cmdLine.includes('restart-mcp.ts')) {
      console.log(`Killing process ID ${pid} for matching server: ${serverName}`);
      console.log(`  > ${cmdLine.replace(/^.*?Node,\s*/, '')}`); // cleanup prefix
      try {
        process.kill(pid); // Kills the process on Windows
        killed++;
      } catch (e) {
        if (e instanceof Error && (e as NodeJS.ErrnoException).code === 'ESRCH') {
          // Process already dead
        } else {
          console.error(`  ❌ Failed to kill process ${pid}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }
  }
  
  if (killed > 0) {
    console.log(`\n✅ Restart triggered. Killed ${killed} process(es).`);
    console.log(`The IDE will automatically resurrect the server with the new configuration.`);
  } else {
    console.log(`\n⚠️ No running node processes found for MCP Server: ${serverName}`);
  }
} catch (err) {
  console.error(`Failed to query processes: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
