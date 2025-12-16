/**
 * MySQL Prompt - Backup Strategy
 * 
 * Enterprise backup planning with RTO/RPO considerations.
 */
import type { PromptDefinition, RequestContext } from '../../../types/index.js';

export function createBackupStrategyPrompt(): PromptDefinition {
    return {
        name: 'mysql_backup_strategy',
        description: 'Design enterprise backup strategy with RTO/RPO planning',
        arguments: [
            { name: 'rpo', description: 'Recovery Point Objective (e.g., "1 hour", "15 minutes")', required: false },
            { name: 'rto', description: 'Recovery Time Objective (e.g., "4 hours", "30 minutes")', required: false },
            { name: 'data_size', description: 'Approximate database size (e.g., "100GB", "2TB")', required: false }
        ],
        handler: (args: Record<string, string>, _context: RequestContext) => {
            const rpo = args['rpo'] ?? 'to be determined';
            const rto = args['rto'] ?? 'to be determined';
            const dataSize = args['data_size'] ?? 'unknown';

            return Promise.resolve(`# MySQL Backup Strategy Planning

Design a comprehensive backup strategy for this MySQL database.

**Requirements:**
- **RPO (Recovery Point Objective):** ${rpo}
- **RTO (Recovery Time Objective):** ${rto}
- **Database Size:** ${dataSize}

## Step 1: Assess Current State
- Check current binary log configuration (\`mysql://replication\`)
- Review storage engine (InnoDB recommended for consistent backups)
- Identify critical tables/databases

## Step 2: Choose Backup Method

### Option A: mysqldump (Logical Backup)
- **Pros:** Portable, human-readable, works with any storage engine
- **Cons:** Slower for large databases, locks required for consistency
- Use: \`mysql_create_dump\` tool
- Best for: < 100GB, development, cross-version migration

### Option B: MySQL Shell Dump (Parallel Logical Backup)
- **Pros:** 10-20x faster than mysqldump, parallel execution
- **Cons:** Requires MySQL Shell 8.0+
- Use: \`mysqlsh_dump_instance\`, \`mysqlsh_dump_schemas\`
- Best for: 100GB - 2TB, faster recovery needed

### Option C: Physical Backup (Percona XtraBackup)
- **Pros:** Hot backup, minimal locking, fast for large databases
- **Cons:** Same MySQL version required for restore
- Best for: > 500GB, production systems

## Step 3: Configure Point-in-Time Recovery
1. Enable binary logging:
   - log_bin = mysql-bin
   - expire_logs_days = 7 (or binlog_expire_logs_seconds)
   - sync_binlog = 1 (for durability)

2. Schedule full backups:
   - Daily for most workloads
   - Weekly for stable, low-change databases

3. Continuously archive binary logs to separate storage

## Step 4: Test Recovery
1. Regularly test full restore to a different server
2. Test point-in-time recovery procedure
3. Document and automate recovery steps

## Step 5: Create Backup Schedule
Based on your RPO of ${rpo}:
- Calculate backup frequency needed
- Plan retention policy
- Set up monitoring and alerting

Please provide your RPO/RTO requirements if not specified, and I'll create a tailored backup plan.`);
        }
    };
}
