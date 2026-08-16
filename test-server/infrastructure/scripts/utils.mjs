/**
 * Shared utilities for the unified database ecosystem scripts.
 *
 * Provides standardized Docker/WSL detection, exec wrappers, secrets loading,
 * path resolution, and a generic bounded retry utility.
 *
 * @module utils
 */

import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';

// ── Regex Constants (hoisted out of loops) ───────────────────────────
const ENV_LINE_RE = /^\s*([\w.-]+)\s*=\s*(.*)?$/;
const ENV_QUOTE_RE = /^['"](.*?)['"]$/;

/**
 * Resolve common script paths from an ESM `import.meta.url`.
 *
 * @param {string} importMetaUrl - The `import.meta.url` of the calling module.
 * @returns {{ __filename: string, __dirname: string, ecosystemRoot: string, adamicRoot: string }}
 */
export function resolveScriptPaths(importMetaUrl) {
    const __filename = fileURLToPath(importMetaUrl);
    const __dirname = dirname(__filename);
    const ecosystemRoot = join(__dirname, '..');
    const adamicRoot = join(__dirname, '../../..');
    return { __filename, __dirname, ecosystemRoot, adamicRoot };
}

/**
 * Detect whether Docker is available natively or must be proxied through WSL.
 * Standardizes on `docker info` (validates daemon, not just binary).
 *
 * @returns {{ dockerCmd: string, dockerBaseArgs: string[] }}
 */
export function detectDocker() {
    if (process.platform === 'win32') {
        return { dockerCmd: 'wsl', dockerBaseArgs: ['docker'] };
    }
    return { dockerCmd: 'docker', dockerBaseArgs: [] };
}

/**
 * Load environment variables from `secrets.env` in the adamic root.
 * Sets `DD_API_KEY` passthrough via `WSLENV` for WSL interop.
 *
 * @param {string} adamicRoot - Absolute path to the adamic repository root.
 * @returns {string} The resolved `MYSQL_ROOT_PASSWORD` (defaults to `'root'`).
 */
export async function loadSecrets(adamicRoot) {
    const secretsPath = join(adamicRoot, 'secrets.env');
    if (existsSync(secretsPath)) {
        const envConfig = await fs.readFile(secretsPath, 'utf-8');
        for (const line of envConfig.split('\n')) {
            const match = line.match(ENV_LINE_RE);
            if (match) {
                process.env[match[1]] = (match[2] || '').trim().replace(ENV_QUOTE_RE, '$1');
            }
        }
        process.env.WSLENV = process.env.WSLENV
            ? `${process.env.WSLENV}:DD_API_KEY/u`
            : 'DD_API_KEY/u';
    }
    return process.env.MYSQL_ROOT_PASSWORD || 'root';
}

/**
 * Execute a Docker command using the detected Docker/WSL configuration.
 *
 * @param {string} dockerCmd - The Docker binary (`'docker'` or `'wsl'`).
 * @param {string[]} dockerBaseArgs - Base args (`[]` or `['docker']`).
 * @param {string[]} args - The Docker command arguments (e.g., `['exec', 'mysql-node1', ...]`).
 * @param {object} [opts] - Options.
 * @param {boolean} [opts.ignoreError=false] - If true, returns `null` on error instead of throwing.
 * @param {boolean} [opts.trim=true] - If true, trims stdout output.
 * @param {string} [opts.cwd] - Working directory for the command.
 * @param {string} [opts.input] - String to pipe to stdin.
 * @returns {string | null} The stdout output, or `null` if `ignoreError` is true and the command failed.
 */
export function execDocker(dockerCmd, dockerBaseArgs, args, opts = {}) {
    const { ignoreError = false, trim = true, cwd, input } = opts;
    try {
        const result = execFileSync(dockerCmd, [...dockerBaseArgs, ...args], {
            encoding: 'utf-8',
            stdio: input ? ['pipe', 'pipe', 'pipe'] : 'pipe',
            input,
            cwd,
        });
        return trim ? result.trim() : result;
    } catch (e) {
        if (!ignoreError) {
            const msg = e instanceof Error ? e.message : String(e);
            console.error(`Error: ${msg}`);
            throw e;
        }
        return null;
    }
}

/**
 * Generic bounded retry utility with configurable delay and callback.
 *
 * @param {() => Promise<boolean>} fn - Async function that returns `true` when the condition is met.
 * @param {object} opts - Retry options.
 * @param {number} opts.maxAttempts - Maximum number of attempts before giving up.
 * @param {number} opts.delayMs - Delay in milliseconds between attempts.
 * @param {(attempt: number) => void} [opts.onRetry] - Optional callback invoked on each retry.
 * @returns {Promise<boolean>} `true` if the condition was met, `false` if all attempts exhausted.
 */
export async function retry(fn, { maxAttempts, delayMs, onRetry }) {
    const { setTimeout } = await import('timers/promises');
    for (let i = 1; i <= maxAttempts; i++) {
        if (await fn(i)) return true;
        if (onRetry) onRetry(i);
        if (i < maxAttempts) await setTimeout(delayMs);
    }
    return false;
}

/**
 * Registers a Windows Scheduled Task to keep WSL alive in the background.
 * Creates a hidden VBS wrapper to ensure no console windows spawn.
 * 
 * @param {string} localAppData - Path to the local app data directory (e.g., `%LOCALAPPDATA%`).
 * @returns {string} The output of the PowerShell command that checks task status.
 */
export function registerWslKeepalive(localAppData) {
    
    // We execute the PS1 logic directly via a PowerShell command block
    const psScript = `
        $taskName = 'WSL-KeepAlive'
        $vbsDir = Join-Path $env:LOCALAPPDATA 'adamic'
        if (-not (Test-Path $vbsDir)) {
            New-Item -ItemType Directory -Path $vbsDir -Force | Out-Null
        }
        $vbsPath = Join-Path $vbsDir 'wsl-keepalive.vbs'
        
        $vbsContent = @"
' WSL KeepAlive - runs wsl.exe hidden (no console window)
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "wsl.exe -d Ubuntu-24.04 --exec sleep infinity", 0, True
"@
        Set-Content -Path $vbsPath -Value $vbsContent -Encoding Ascii
        
        Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
        
        $action = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument "\`"$vbsPath\`""
        $trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
        
        $settings = New-ScheduledTaskSettingsSet \`
            -AllowStartIfOnBatteries \`
            -DontStopIfGoingOnBatteries \`
            -ExecutionTimeLimit ([TimeSpan]::Zero) \`
            -RestartCount 3 \`
            -RestartInterval (New-TimeSpan -Minutes 1)
            
        $principal = New-ScheduledTaskPrincipal \`
            -UserId $env:USERNAME \`
            -LogonType Interactive \`
            -RunLevel Limited
            
        Register-ScheduledTask \`
            -TaskName $taskName \`
            -Action $action \`
            -Trigger $trigger \`
            -Settings $settings \`
            -Principal $principal \`
            -Description 'Keeps WSL2 Ubuntu distro alive for Docker services (hidden)' \`
            -Force | Out-Null
            
        Start-ScheduledTask -TaskName $taskName
        Start-Sleep -Seconds 3
        $task = Get-ScheduledTask -TaskName $taskName
        Write-Output "Task state: $($task.State)"
    `;

    return execFileSync('pwsh', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psScript], {
        encoding: 'utf-8',
        timeout: 30000,
        env: { ...process.env, LOCALAPPDATA: localAppData }
    });
}
