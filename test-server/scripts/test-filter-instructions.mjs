/**
 * Filter-Aware Instruction Validation
 *
 * Starts the server with various --tool-filter configs and verifies that
 * each instruction section is correctly included or excluded based on enabled
 * tool groups. Also verifies that the dynamic resources at mysql://help properly
 * reflect the enabled groups.
 *
 * Usage:
 *   npm run build && node test-server/scripts/test-filter-instructions.mjs
 */

import { spawn } from 'child_process'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_DIR = resolve(__dirname, '../..')

// Ensure DB connection env vars are present (inherit from shell or use Docker defaults)
if (!process.env.MYSQL_HOST) process.env.MYSQL_HOST = "127.0.0.1";
if (!process.env.MYSQL_USER) process.env.MYSQL_USER = "root";
if (!process.env.MYSQL_PASSWORD) process.env.MYSQL_PASSWORD = "root";
if (!process.env.MYSQL_DATABASE) process.env.MYSQL_DATABASE = "testdb";

const SECTIONS = {
    CORE: '## Quick Access',
    CODE_MODE: '# Code Mode',
    HELP_POINTERS: '## Help Resources',
}

const ALL_GROUPS = [
    'core', 'json', 'transactions', 'text', 'fulltext', 'stats', 'spatial',
    'admin', 'monitoring', 'performance', 'optimization', 'backup',
    'replication', 'partitioning', 'schema', 'introspection', 'migration',
    'events', 'sysschema', 'security', 'roles', 'docstore', 'cluster',
    'proxysql', 'router', 'shell', 'vector', 'gotchas'
]

const TEST_CONFIGS = [
    {
        label: 'Slim Instructions (No Filters)',
        filter: null, // default
        expect: { CORE: true, CODE_MODE: true, HELP_POINTERS: true },
        expectedGroups: ALL_GROUPS
    },
    {
        label: 'Core-only Filter (--tool-filter core,-codemode)',
        filter: 'core,-codemode',
        expect: { CORE: true, CODE_MODE: false, HELP_POINTERS: true },
        expectedGroups: ['core', 'gotchas']
    },
    {
        label: 'Stats Filter (--tool-filter stats,-codemode)',
        filter: 'stats,-codemode',
        expect: { CORE: true, CODE_MODE: false, HELP_POINTERS: true },
        expectedGroups: ['stats', 'gotchas']
    },
    {
        label: 'Multi-group Filter (--tool-filter core,json,text,stats,-codemode)',
        filter: 'core,json,text,stats,-codemode',
        expect: { CORE: true, CODE_MODE: false, HELP_POINTERS: true },
        expectedGroups: ['core', 'json', 'text', 'stats', 'gotchas']
    },
    {
        label: 'Full Filter (--tool-filter full)',
        filter: 'full',
        expect: { CORE: true, CODE_MODE: true, HELP_POINTERS: true },
        expectedGroups: ALL_GROUPS
    }
]

function runConfig(config) {
    return new Promise((resolve, reject) => {
        const args = ['dist/cli.js', '--log-level', 'error']
        if (config.filter) args.push('--tool-filter', config.filter)

        const proc = spawn('node', args, {
            cwd: PROJECT_DIR,
            stdio: ['pipe', 'pipe', 'pipe']
        })

        let buffer = ''
        let instructions = ''
        let availableGroups = []

        proc.stdout.on('data', (chunk) => {
            buffer += chunk.toString()
            const lines = buffer.split('\n')
            buffer = lines.pop() // keep incomplete line

            for (const line of lines) {
                const trimmed = line.trim()
                if (!trimmed) continue
                try {
                    const msg = JSON.parse(trimmed)
                    if (msg.id === 1 && msg.result) {
                        instructions =
                            msg.result?.serverInfo?.instructions ||
                            msg.result?.instructions ||
                            msg.result?.capabilities?.instructions ||
                            ''
                        
                        proc.stdin.write(
                            JSON.stringify({
                                jsonrpc: '2.0',
                                id: 2,
                                method: 'resources/read',
                                params: { uri: 'mysql://help' },
                            }) + '\n'
                        )
                    } else if (msg.id === 2 && msg.result) {
                        try {
                            const contents = msg.result.contents || []
                            if (contents.length > 0 && contents[0].text) {
                                const parsed = JSON.parse(contents[0].text)
                                availableGroups = (parsed.groups || []).map(g => typeof g === 'string' ? g : g.name)
                            }
                        } catch {
                            // parse error
                        }
                        proc.kill()
                        resolve({ instructions, availableGroups })
                    } else if (msg.id === 2 && msg.error) {
                         console.error('Resource read error:', msg.error)
                         proc.kill()
                         resolve({ instructions, availableGroups: [] })
                    }
                } catch {
                    // Incomplete JSON, keep buffering
                }
            }
        })

        proc.stderr.on('data', () => {})

        proc.stdin.write(
            JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'initialize',
                params: {
                    protocolVersion: '2025-03-26',
                    capabilities: {},
                    clientInfo: { name: 'filter-instruction-test', version: '1.0' },
                },
            }) + '\n'
        )

        setTimeout(() => {
            proc.kill()
            reject(new Error('Timeout'))
        }, 15000)
    })
}

function tokenEstimate(text) {
    return Math.round(text.length / 4)
}

function checkSections(instructions, expect) {
    const results = {}
    for (const [key, marker] of Object.entries(SECTIONS)) {
        const present = instructions.includes(marker)
        const shouldBePresent = expect[key]
        results[key] = {
            present,
            expected: shouldBePresent,
            pass: present === shouldBePresent,
        }
    }
    return results
}

function checkGroups(actualGroups, expectedGroups, configLabel) {
    let expected = [...expectedGroups];

    const missing = expected.filter(g => !actualGroups.includes(g))
    const unexpected = actualGroups.filter(g => !expected.includes(g))
    return {
        pass: missing.length === 0 && unexpected.length === 0,
        missing,
        unexpected
    }
}

async function main() {
    console.log('=== Filter-Aware Instruction Validation ===\n')
    console.log('Checking that instruction sections are correctly included/excluded')
    console.log('and dynamically registered help resources correctly map to groups.\n')

    let totalPassed = 0
    let totalFailed = 0
    const rows = []

    for (const config of TEST_CONFIGS) {
        process.stdout.write(`  Testing: ${config.label} ... `)
        let result
        try {
            result = await runConfig(config)
        } catch (err) {
            console.log(`❌ ERROR: ${err.message}`)
            totalFailed++
            continue
        }

        const { instructions, availableGroups } = result
        const chars = instructions.length
        const tokens = tokenEstimate(instructions)
        const sectionResults = checkSections(instructions, config.expect)
        const groupResults = checkGroups(availableGroups, config.expectedGroups, config.label)

        const sectionFailures = Object.entries(sectionResults).filter(([, r]) => !r.pass)
        const allPass = sectionFailures.length === 0 && groupResults.pass

        if (allPass) {
            console.log(`✅ (${chars} chars, ~${tokens} tokens)`)
            totalPassed++
        } else {
            console.log(`❌ (${chars} chars, ~${tokens} tokens)`)
            totalFailed++
            for (const [section, r] of sectionFailures) {
                const action = r.expected ? 'MISSING' : 'UNEXPECTED'
                console.log(`      [${action}] SECTION ${section}`)
            }
            for (const g of groupResults.missing) {
                console.log(`      [MISSING] RESOURCE mysql://help/${g}`)
            }
            for (const g of groupResults.unexpected) {
                console.log(`      [UNEXPECTED] RESOURCE mysql://help/${g}`)
            }
        }

        rows.push({ label: config.label, chars, tokens, pass: allPass, sectionResults })
    }

    // Token summary table
    console.log('\n=== Token Estimates by Filter ===\n')
    console.log(`  ${'Filter'.padEnd(62)} ${'Chars'.padStart(6)} ${'~Tokens'.padStart(8)} ${'Sections'.padStart(30)}`)
    console.log(`  ${'-'.repeat(62)} ${'-'.repeat(6)} ${'-'.repeat(8)} ${'-'.repeat(30)}`)
    for (const row of rows) {
        const sectionSummary = Object.entries(row.sectionResults)
            .map(([k, r]) => (r.present ? k.toLowerCase().replace('_', '-').slice(0, 5) : null))
            .filter(Boolean)
            .join('+')
        console.log(`  ${row.label.padEnd(62)} ${String(row.chars).padStart(6)} ${String(row.tokens).padStart(8)}   ${sectionSummary}`)
    }

    console.log(`\n=== Results: ${totalPassed} passed, ${totalFailed} failed ===\n`)
    process.exit(totalFailed > 0 ? 1 : 0)
}

main().catch((err) => {
    console.error('Fatal:', err.message)
    process.exit(1)
})
