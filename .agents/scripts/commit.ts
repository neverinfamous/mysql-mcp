import { execSync, execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { z } from 'zod';
import { match, P } from 'ts-pattern';

const VALID_CATEGORIES = ['Added', 'Changed', 'Fixed', 'Removed', 'Security', 'Deprecated'] as const;

const TYPE_TO_CATEGORY: Record<string, typeof VALID_CATEGORIES[number]> = {
  feat: 'Added',
  fix: 'Fixed',
  perf: 'Changed',
  refactor: 'Changed',
  remove: 'Removed',
  drop: 'Removed',
  security: 'Security',
  docs: 'Changed',
  style: 'Changed',
  test: 'Changed',
  chore: 'Changed',
};

const cliSchema = z.object({
  msg: z.string().optional(),
  message: z.string().optional(),
  history: z.string().optional(),
  'history-file': z.string().optional(),
  'no-history': z.boolean().default(false),
  help: z.boolean().default(false),
  impact: z.coerce.number().min(0.0).max(1.0),
  trust: z.coerce.number().min(0.0).max(1.0).optional(),
  confidence: z.coerce.number().min(0.0).max(1.0),
  validation: z.enum(['passed', 'none', 'failed']),
  significance: z.string().optional(),
  category: z.string()
    .min(1, { message: "Category cannot be empty" })
    .transform(val => val.charAt(0).toUpperCase() + val.slice(1).toLowerCase())
    .pipe(z.enum(VALID_CATEGORIES))
    .optional(),
  cwd: z.string().optional(),
  add: z.array(z.string()).optional(),
  journal: z.boolean().default(false),
  'journal-project': z.coerce.number().int().finite().positive().optional(),
});

type CliArgs = z.infer<typeof cliSchema>;

function parseArguments(): CliArgs {
  const options = {
    msg: { type: 'string', short: 'm' },
    message: { type: 'string' },
    history: { type: 'string' },
    'history-file': { type: 'string' },
    'no-history': { type: 'boolean' },
    help: { type: 'boolean' },
    impact: { type: 'string' },
    trust: { type: 'string' },
    confidence: { type: 'string' },
    validation: { type: 'string' },
    significance: { type: 'string' },
    category: { type: 'string' },
    cwd: { type: 'string' },
    add: { type: 'string', multiple: true },
    journal: { type: 'boolean' },
    'journal-project': { type: 'string' },
  } as const;

  const rawArgs = process.argv.slice(2);
  const sanitizedArgs: string[] = [];
  for (let i = 0; i < rawArgs.length; i++) {
    if (rawArgs[i].startsWith('--') && rawArgs[i+1] && rawArgs[i+1].match(/^-\d+(\.\d+)?$/)) {
      sanitizedArgs.push(`${rawArgs[i]}=${rawArgs[i+1]}`);
      i++;
    } else {
      sanitizedArgs.push(rawArgs[i]);
    }
  }

  let values: Record<string, unknown>, positionals: string[];
  try {
    const parsedArgs = parseArgs({ args: sanitizedArgs, options, allowPositionals: true });
    values = parsedArgs.values;
    positionals = parsedArgs.positionals;
  } catch (error) {
    match(error)
      .with({ code: 'ERR_PARSE_ARGS_INVALID_OPTION_VALUE', message: P.string }, (e: { message: string }) => {
        console.error(`Error parsing CLI arguments: ${e.message}`);
        process.exit(1);
      })
      .with({ code: 'ERR_PARSE_ARGS_UNKNOWN_OPTION', message: P.string }, (e: { message: string }) => {
        console.error(`Error: Unknown CLI argument. ${e.message}`);
        process.exit(1);
      })
      .otherwise((e: unknown) => {
        console.error(`Error parsing CLI arguments: ${e instanceof Error ? e.message : String(e)}`);
        process.exit(1);
      });
    return process.exit(1);
  }
  
  let messageCount = 0;
  if (values.msg) messageCount++;
  if (values.message) messageCount++;
  
  // 🛠️ AUTONOMOUS HEALING: If an agent hallucinates space-separated array arguments for --add (e.g. `--add f1 f2`),
  // util.parseArgs parses the extra files as positionals. If we already have a commit message via --msg,
  // we can safely assume these extra positionals are meant to be files to stage.
  if (positionals.length > 0) {
    if (messageCount > 0) {
      console.warn("⚠️ AUTONOMOUS HEALING: Extra positional arguments detected alongside --msg. Assuming these are space-separated files for --add.");
      values.add = [...(Array.isArray(values.add) ? values.add : []), ...positionals];
      positionals = []; // Clear them so they aren't parsed as a second commit message
    } else {
      messageCount++; // First positional is the commit message
    }
  }

  if (messageCount > 1) {
    console.error("Error: Multiple commit messages provided. Please use only one of --msg, --message, or a positional argument.");
    process.exit(1);
  }

  const mergedValues = { ...values };
  if (!mergedValues.msg && mergedValues.message) {
    mergedValues.msg = mergedValues.message;
  }
  if (!mergedValues.msg && positionals.length > 0) {
    mergedValues.msg = positionals[0];
  }

  if (mergedValues.trust !== undefined && mergedValues.confidence === undefined) {
    mergedValues.confidence = mergedValues.trust;
  }
  
  if (mergedValues['journal-project'] !== undefined && !mergedValues.journal) {
    console.warn("⚠️ AUTONOMOUS HEALING: --journal-project provided without --journal flag. Automatically enabling --journal.");
    mergedValues.journal = true;
  }
  
  if (mergedValues.help) {
    showHelpAndExit();
  }

  const parsed = cliSchema.safeParse(mergedValues);
  if (!parsed.success) {
    console.error("🛠️ AUTONOMOUS HEALING: Invalid CLI arguments provided to commit.ts");
    parsed.error.issues.forEach(err => {
      const field = err.path.join('.');
      
      const errorMessage = match(err)
        .with({ code: 'invalid_type', received: 'undefined' }, () => {
          if (field === 'validation') return `Missing required flag. You MUST append '--validation passed', '--validation failed', or '--validation none' to your command.`;
          if (field === 'impact') return `Missing required flag. You MUST append an impact score (e.g. '--impact 0.5').`;
          if (field === 'confidence') return `Missing required flag. You MUST append a confidence score (e.g. '--confidence 1.0').`;
          return `Missing required flag.`;
        })
        .with({ code: 'invalid_type', expected: 'number', received: P.union('nan', 'NaN') }, () => {
          if ((mergedValues as Record<string, unknown>)[field] === undefined) {
            if (field === 'impact') return `Missing required flag. You MUST append an impact score (e.g. '--impact 0.5').`;
            if (field === 'confidence') return `Missing required flag. You MUST append a confidence score (e.g. '--confidence 1.0').`;
            return `Missing required flag.`;
          }
          return 'Expected a valid number, but received NaN';
        })
        .with({ code: 'invalid_type', expected: P.string, received: P.string }, (e: { expected: string; received: string }) => `Expected ${e.expected}, but received ${e.received}`)
        .with({ code: 'invalid_union' }, () => 'Invalid value provided')
        .with({ code: 'too_big', maximum: P.number }, (e: { maximum: number }) => `Too big: expected number to be <=${e.maximum}`)
        .with({ code: 'too_small', minimum: P.number }, (e: { minimum: number }) => `Too small: expected number to be >=${e.minimum}`)
        .with({ code: 'invalid_value', values: P.select(P.array(P.union(P.string, P.number))) }, (values: (string | number)[]) => {
          if ((mergedValues as Record<string, unknown>)[field] === undefined) {
            if (field === 'validation') return `Missing required flag. You MUST append '--validation passed', '--validation failed', or '--validation none' to your command.`;
            return `Missing required flag.`;
          }
          return `Invalid enum value. Expected one of: ${values.join(', ')}`;
        })
        .with({ message: P.string }, (e: { message: string }) => e.message)
        .otherwise(() => 'Validation failed for this field');
      
      console.error(`- --${field}: ${errorMessage}`);
    });
    process.exit(1);
  }
  return parsed.data;
}

function showHelpAndExit(): never {
  console.log(`Usage: bun commit.ts [options]

Options:
  --msg <string>         Conventional commit message (e.g. 'feat(core): subject')
  --history <string>     History narrative. Prefix with 'Category: ' to explicitly set category.
  --history-file <path>  Path to a file containing the history narrative (prevents shell escaping issues).
  --no-history           Skip history entry for trivial changes.
  --impact <number>      Impact score (0.0 to 1.0).
  --trust <number>       Trust score (0.0 to 1.0) (deprecated, prefer --confidence).
  --confidence <number>  Confidence score (0.0 to 1.0).
  --validation <string>  Validation status ('passed', 'none', 'failed').
  --significance <string> Significance type (e.g. 'milestone', 'security', 'breakthrough').
  --category <string>    Explicit category override (e.g. 'Added', 'Fixed').
  --add <path>           Explicitly stage these files before committing. Can be used multiple times.
  --cwd <path>           Explicit working directory for the git command.
  --journal              Automatically create a memory journal entry for this commit.
  --journal-project <id> Specify the project ID for the journal entry (defaults to omitting it).
  --help                 Show this help message.
  
🤖 AI AGENT INSTRUCTIONS:
- MULTI-LINE HISTORY: ALWAYS write history to a scratch file (e.g. \`scratch/hist.txt\`) and use \`--history-file <path>\` instead of \`--history\` to prevent shell escaping failures.
- MESSAGE FORMAT: \`--msg\` MUST strictly follow conventional commits: \`type(scope): subject\`.
- REQUIRED FLAGS: You MUST provide \`--impact\`, \`--confidence\`, and \`--validation\`.
- WARNING: DO NOT use \`git add .\` to blanket stage files. Stage ONLY the specific files you modified using \`--add <path>\` to avoid polluting commits.
- EXAMPLE: bun commit.ts --msg "fix(cli): resolve option errors" --history-file "scratch/hist.txt" --impact 0.6 --confidence 1.0 --validation passed --add "src/index.ts"`);
  process.exit(0);
}

function validateCommitMessage(msg?: string): string {
  if (!msg) {
    console.error("❌ CRITICAL: Missing Commit Message!");
    console.error("You must provide a commit message using either `--msg \"...\"` or as the first positional argument.");
    console.error("Example: bun commit.ts --msg \"feat(core): added new optimization workflow\"");
    process.exit(1);
  }

  const firstLine = msg.trim().split('\n')[0];
  const commitMatch = firstLine.match(/^([a-zA-Z0-9_-]+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/);
  if (!commitMatch) {
    console.error("Error: --msg must follow conventional commit format (e.g., 'feat(core): subject' or 'feat!: breaking').");
    process.exit(1);
  }
  
  return commitMatch[1];
}

function ensureStagedFiles(filesToAdd?: string[]): void {
  if (filesToAdd && filesToAdd.length > 0) {
    try {
      execSync(`git add ${filesToAdd.map(f => `"${f}"`).join(' ')}`, { stdio: 'inherit' });
    } catch (e) {
      console.error(`Error adding files: ${e instanceof Error ? e.message : String(e)}`);
      process.exit(1);
    }
  }

  try {
    const gitDir = execSync('git rev-parse --git-dir', { encoding: 'utf-8' }).trim();
    if (fs.existsSync(path.join(gitDir, 'MERGE_HEAD')) ||
        fs.existsSync(path.join(gitDir, 'rebase-merge')) ||
        fs.existsSync(path.join(gitDir, 'rebase-apply'))) {
      console.error('Error: Repository is in a merge/rebase state. Resolve conflicts first.');
      process.exit(1);
    }
  } catch {
    // Ignore error, allow git status to fail naturally if not a git repository
  }

  const status = execSync('git status --porcelain', { encoding: 'utf-8' });
  const hasStaged = status.split('\n').some(line => {
    if (line.length < 2) return false;
    const indexStatus = line[0];
    return indexStatus !== ' ' && indexStatus !== '?';
  });
  
  if (!hasStaged) {
    console.error('🛠️ AUTONOMOUS HEALING: No files staged for commit.');
    console.error('You MUST explicitly stage the files you want to commit using `git add <file-path>` before running this wrapper.');
    console.error('Do NOT use `git add .` to blanket stage files.');
    const shortStatus = execSync('git status --short', { encoding: 'utf-8' });
    if (shortStatus.trim()) {
      console.error('Current status:');
      console.error(shortStatus);
    }
    process.exit(1);
  }
}

function parseCategory(history: string, type: string): { category: string; entry: string } {
  let rawCategory: string;
  let entry: string;

  const categoryMatch = history.match(/^([A-Za-z]+):\s*([\s\S]+)$/);

  if (categoryMatch) {
    const matchedCat = categoryMatch[1];
    const capitalizedMatch = matchedCat.charAt(0).toUpperCase() + matchedCat.slice(1).toLowerCase();
    
    if ((VALID_CATEGORIES as readonly string[]).includes(capitalizedMatch)) {
      rawCategory = matchedCat.trim();
      entry = categoryMatch[2].trim();
    } else {
      rawCategory = TYPE_TO_CATEGORY[type] || 'Changed';
      entry = history.trim();
    }
  } else {
    rawCategory = TYPE_TO_CATEGORY[type] || 'Changed';
    entry = history.trim();
  }

  const category = rawCategory.charAt(0).toUpperCase() + rawCategory.slice(1).toLowerCase();

  if (!(VALID_CATEGORIES as readonly string[]).includes(category)) {
    console.error(`Error: Invalid explicit category '${category}'. Must be one of: ${VALID_CATEGORIES.join(', ')}`);
    process.exit(1);
  }

  return { category, entry };
}

function generateHistoryEntry(args: CliArgs, type: string): string {


  let historyContent = args.history || '';
  if (args['history-file']) {
    try {
      historyContent = fs.readFileSync(path.resolve(args['history-file']), 'utf-8');
    } catch (e) {
      console.error(`Error reading history file: ${e instanceof Error ? e.message : String(e)}`);
      process.exit(1);
    }
  }

  if (!historyContent && !args['no-history']) {
    console.warn("⚠️ AUTONOMOUS HEALING: Missing history flag detected. Defaulting to --no-history.");
    args['no-history'] = true;
  }

  const parsedCategory = parseCategory(historyContent, type);
  let category = args.category || parsedCategory.category;
  
  if (args.category) {
    category = args.category;
    if (!(VALID_CATEGORIES as readonly string[]).includes(category)) {
      console.error(`Error: Invalid explicit category '${category}'. Must be one of: ${VALID_CATEGORIES.join(', ')}`);
      process.exit(1);
    }
  }

  let entry = parsedCategory.entry;

  // Indent continuation lines in the entry to make it a valid git trailer
  entry = entry.replace(/\n/g, '\n  ');

  let body = `\n\nHistory-Category: ${category}`;
  
  if (entry || (!args['no-history'] && !entry)) {
      body += `\nHistory-Entry: ${entry}`;
  }

  if (args.significance) {
    body += `\nHistory-Significance: ${args.significance}`;
  }
  if (args.impact !== undefined) {
    body += `\nHistory-Impact: ${args.impact}`;
  }
  if (args.trust !== undefined) {
    body += `\nHistory-Trust: ${args.trust}`;
  }
  if (args.confidence !== undefined) {
    body += `\nHistory-Confidence: ${args.confidence}`;
  }
  if (args.validation) {
    body += `\nHistory-Validation: ${args.validation}`;
  }
  if (args.journal) {
    body += `\nHistory-Journal: true`;
  }
  if (args['journal-project'] !== undefined) {
    body += `\nHistory-Journal-Project: ${args['journal-project']}`;
  }

  return body;
}

function executeCommit(header: string, body: string, args: CliArgs): void {
  const msgFile = path.join(os.tmpdir(), `commit-msg-${crypto.randomUUID()}.txt`);
  fs.writeFileSync(msgFile, `${header}${body}`);
  try {
    execFileSync('git', ['commit', '-F', msgFile], { stdio: 'inherit' });
  } finally {
    if (fs.existsSync(msgFile)) {
      fs.unlinkSync(msgFile);
    }
  }

  const sha = execSync('git log -1 --format=%h', { encoding: 'utf-8' }).trim();
  console.log(`\n✅ Successfully committed ${sha}`);
  console.log(`__COMMIT_SHA__:${sha}`);

  if (args.journal) {
    console.log(`\n📓 Creating automated journal entry for ${sha}...`);
    try {
      const frontmatterLines = [
        '---',
        'type: "architecture"',
        'tags: ["commit-narrative"]'
      ];
      
      if (args['journal-project']) {
        frontmatterLines.push(`project: ${args['journal-project']}`);
      }
      
      if (args.impact !== undefined) frontmatterLines.push(`impact: ${args.impact}`);
      if (args.confidence !== undefined) frontmatterLines.push(`trust: ${args.confidence}`);
      if (args.validation) frontmatterLines.push(`validation_status: "${args.validation}"`);
      
      frontmatterLines.push('auto_context:');
      frontmatterLines.push('  type: "session-commits"');
      frontmatterLines.push(`  commits: ["${sha}"]`);
      frontmatterLines.push('---');
      
      let historyContent = args.history || '';
      if (args['history-file']) {
        try {
          historyContent = fs.readFileSync(path.resolve(args['history-file']), 'utf-8');
        } catch {
          // Fallback if history file does not exist
        }
      }
      const journalBody = historyContent || header;
      const journalContent = `${frontmatterLines.join('\n')}\n${journalBody}\n\nCommit: ${sha}`;
      
      const journalFile = path.join(os.tmpdir(), `journal-${sha}.md`);
      fs.writeFileSync(journalFile, journalContent);
      
      execSync(`memory-journal-mcp entry create --file "${journalFile}"`, { stdio: 'inherit' });
      
      if (fs.existsSync(journalFile)) {
        fs.unlinkSync(journalFile);
      }
    } catch (e) {
      console.error(`\n⚠️ Failed to create journal entry: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

async function main(): Promise<void> {
  try {
    const args = parseArguments();

    if (args.help) {
      showHelpAndExit();
    }

    if (args.cwd) {
      const targetCwd = path.resolve(args.cwd);
      if (!fs.existsSync(targetCwd)) {
        console.error(`Commit failed: Directory does not exist: ${targetCwd}`);
        process.exit(1);
      }
      try {
        process.chdir(targetCwd);
      } catch {
        console.error(`Commit failed: Could not change directory to ${targetCwd}`);
        process.exit(1);
      }
    }

    const type = validateCommitMessage(args.msg);
    ensureStagedFiles(args.add);
    
    const body = generateHistoryEntry(args, type);
    executeCommit(args.msg!, body, args);

  } catch (error) {
    if (error instanceof Error) {
      console.error("Commit failed:", error.message);
      if (error.stack) {
        console.error(error.stack);
      }
    } else {
      console.error("Commit failed with unknown error:", error);
    }
    process.exit(1);
  }
}

main();
