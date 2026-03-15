# MySQL-MCP Test Database Reset Script
# Resets the testdb database with fresh seed data

[CmdletBinding()]
param(
    [switch]$SkipVerify,
    [switch]$Force,
    [switch]$Cluster  # Target InnoDB Cluster (mysql-node1) instead of standalone (mysql-final)
)

$ErrorActionPreference = 'Stop'

# Configuration based on target
if ($Cluster) {
    $ContainerName = "mysql-node1"
    $MySqlHost = "localhost"
    $MySqlPort = "3307"
    $MySqlUser = "root"
    $MySqlPassword = "root"
    $MySqlDatabase = "testdb"
    $TargetLabel = "InnoDB Cluster"
} else {
    $ContainerName = "mysql-final"
    $MySqlHost = "localhost"
    $MySqlPort = "3306"
    $MySqlUser = "root"
    $MySqlPassword = "root"
    $MySqlDatabase = "testdb"
    $TargetLabel = "Standalone MySQL"
}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SeedFile = Join-Path $ScriptDir "test-seed.sql"

Write-Host "`n=== MySQL-MCP Test Database Reset ===" -ForegroundColor Cyan
Write-Host "Target: $TargetLabel ($ContainerName @ $MySqlHost`:$MySqlPort/$MySqlDatabase)" -ForegroundColor Gray

# Check if seed file exists
if (-not (Test-Path $SeedFile)) {
    Write-Error "Seed file not found: $SeedFile"
    exit 1
}

Write-Verbose "Seed file: $SeedFile"

# Function to run MySQL command
function Invoke-MySql {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Query,
        [switch]$NoDatabase
    )
    
    $db = if ($NoDatabase) { "" } else { $MySqlDatabase }
    
    # Use docker exec with configured container
    try {
        if ($db) {
            $result = docker exec $ContainerName mysql -uroot -proot $db -e "$Query" 2>&1
        } else {
            $result = docker exec $ContainerName mysql -uroot -proot -e "$Query" 2>&1
        }
        
        if ($LASTEXITCODE -eq 0) {
            return $result
        }
        throw "Docker exec failed: $result"
    } catch {
        throw "MySQL command failed: $_"
    }
}

# Function to execute SQL file
function Invoke-MySqlFile {
    param(
        [Parameter(Mandatory=$true)]
        [string]$FilePath
    )
    
    Write-Host "`n[1/3] Executing seed script..." -ForegroundColor Yellow
    
    # Use docker exec with piped input
    try {
        $result = Get-Content $FilePath -Raw | docker exec -i $ContainerName mysql -uroot -proot $MySqlDatabase 2>&1
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to execute seed file: $result"
        }
        Write-Verbose "Executed via Docker"
    } catch {
        throw "Failed to execute seed file: $_"
    }
}

# Test connection
Write-Host "`n[0/3] Testing connection..." -ForegroundColor Yellow
try {
    $version = Invoke-MySql -Query "SELECT VERSION();" -NoDatabase
    Write-Host "  Connected to MySQL: $($version | Select-Object -Last 1)" -ForegroundColor Green
} catch {
    Write-Error "Failed to connect to MySQL: $_"
    Write-Host "`nTroubleshooting:" -ForegroundColor Yellow
    Write-Host "  1. Ensure $ContainerName container is running: docker ps | grep $ContainerName"
    Write-Host "  2. Or ensure MySQL is running locally on port $MySqlPort"
    Write-Host "  3. Check credentials: $MySqlUser / $MySqlPassword"
    exit 1
}

# Execute seed script
try {
    Invoke-MySqlFile -FilePath $SeedFile
    Write-Host "  Seed script executed successfully" -ForegroundColor Green
} catch {
    Write-Error "Failed to execute seed script: $_"
    exit 1
}

# Verify tables
if (-not $SkipVerify) {
    Write-Host "`n[2/3] Verifying tables..." -ForegroundColor Yellow
    
    $expectedTables = @{
        'test_products' = 16
        'test_orders' = 20
        'test_json_docs' = 8
        'test_articles' = 10
        'test_users' = 10
        'test_measurements' = 200
        'test_locations' = 15
        'test_categories' = 17
        'test_events' = 100
        'test_documents' = 10
        'test_partitioned' = 26
        'temp_write_test' = 5
    }
    
    $allPassed = $true
    foreach ($table in $expectedTables.Keys) {
        try {
            # Use -N for no header, -s for silent (no column names)
            $result = docker exec $ContainerName mysql -uroot -proot $MySqlDatabase -N -s -e "SELECT COUNT(*) FROM $table;" 2>&1
            if ($LASTEXITCODE -ne 0) {
                throw "Query failed: $result"
            }
            # Result should be just the number
            $count = $result | Where-Object { $_ -match '^\d+$' } | Select-Object -First 1
            if (-not $count) { $count = "0" }
            $expected = $expectedTables[$table]
            
            if ([int]$count -ge $expected) {
                Write-Host "  [PASS] $($table): $count rows (expected: $($expected)+)" -ForegroundColor Green
            } else {
                Write-Host "  [FAIL] $($table): $count rows (expected: $expected)" -ForegroundColor Red
                $allPassed = $false
            }
        } catch {
            Write-Host "  [FAIL] $($table): ERROR - $_" -ForegroundColor Red
            $allPassed = $false
        }
    }
    
    if (-not $allPassed) {
        Write-Host ""
        Write-Host '[WARN] Some verifications failed' -ForegroundColor Yellow
    }
} else {
    Write-Host ""
    Write-Host '[2/3] Skipping verification (--SkipVerify)' -ForegroundColor Gray
}

Write-Host ""
Write-Host '[3/3] Summary' -ForegroundColor Yellow
Write-Host '  Database: testdb' -ForegroundColor Gray
Write-Host '  Tables: 12' -ForegroundColor Gray
Write-Host '  Total rows: ~461' -ForegroundColor Gray

Write-Host ''
Write-Host '[PASS] Database reset complete!' -ForegroundColor Green
Write-Host ""
