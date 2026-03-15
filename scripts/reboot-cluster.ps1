<#
.SYNOPSIS
    Reboots the InnoDB Cluster from a complete outage.

.DESCRIPTION
    After a full machine reboot or Docker volume rebuild where all 3 cluster nodes
    were stopped simultaneously, Group Replication will be OFFLINE on all nodes.
    This script uses MySQL Shell to safely reboot the cluster and rejoin secondaries.

.NOTES
    Requires: MySQL Shell 9.5+ installed at MYSQLSH_PATH (or default location)
    Containers: mysql-node1, mysql-node2, mysql-node3 must be running
#>

param(
    [string]$MysqlshPath = "C:\Program Files\MySQL\MySQL Shell 9.5\bin\mysqlsh.exe",
    [string]$PrimaryHost = "localhost",
    [int]$PrimaryPort = 3307,
    [string]$User = "root",
    [string]$Password = "root",
    [string]$ClusterName = "testCluster"
)

$ErrorActionPreference = "Stop"

Write-Host "=== InnoDB Cluster Reboot ===" -ForegroundColor Cyan

# 1. Verify containers are running
Write-Host "`n[1/4] Checking container status..." -ForegroundColor Yellow
$nodes = @("mysql-node1", "mysql-node2", "mysql-node3")
foreach ($node in $nodes) {
    $status = docker inspect -f '{{.State.Status}}' $node 2>$null
    if ($status -ne "running") {
        Write-Host "  Starting $node..." -ForegroundColor Gray
        docker start $node | Out-Null
    }
    Write-Host "  $node`: $status" -ForegroundColor Green
}

# 2. Wait for MySQL to be ready on primary
Write-Host "`n[2/4] Waiting for MySQL to be ready on ${PrimaryHost}:${PrimaryPort}..." -ForegroundColor Yellow
$maxRetries = 30
$retry = 0
do {
    $retry++
    try {
        docker exec mysql-node1 mysqladmin ping -h localhost -uroot -proot 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) { break }
    } catch {}
    if ($retry -ge $maxRetries) {
        Write-Host "  ERROR: MySQL not ready after $maxRetries attempts" -ForegroundColor Red
        exit 1
    }
    Write-Host "  Waiting... ($retry/$maxRetries)" -ForegroundColor Gray
    Start-Sleep -Seconds 2
} while ($true)
Write-Host "  MySQL is ready" -ForegroundColor Green

# 3. Reboot cluster from complete outage
Write-Host "`n[3/4] Rebooting cluster '$ClusterName' from complete outage..." -ForegroundColor Yellow
$uri = "${User}:${Password}@${PrimaryHost}:${PrimaryPort}"
& $MysqlshPath --uri $uri --js -e "dba.rebootClusterFromCompleteOutage('$ClusterName', {force: true})"

if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR: Cluster reboot failed" -ForegroundColor Red
    exit 1
}
Write-Host "  Cluster rebooted successfully" -ForegroundColor Green

# 4. Rejoin secondaries from inside Docker network
# MySQL Shell on Windows can't resolve Docker container hostnames,
# so secondaries may show as MISSING after reboot. Rejoin from inside node1.
Write-Host "`n[4/5] Rejoining secondaries from inside Docker network..." -ForegroundColor Yellow
$clusterUser = "cluster_admin"
$clusterPass = "cluster_admin"
$secondaries = @("mysql-node2", "mysql-node3")
foreach ($node in $secondaries) {
    Write-Host "  Rejoining $node..." -ForegroundColor Gray
    docker exec mysql-node1 mysqlsh --uri "${clusterUser}:${clusterPass}@mysql-node1:3306" --js -e "var c = dba.getCluster(); c.rejoinInstance('${clusterUser}:${clusterPass}@${node}:3306');" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  $node rejoined successfully" -ForegroundColor Green
    } else {
        Write-Host "  $node rejoin failed (may already be online)" -ForegroundColor Yellow
    }
}

# 5. Verify cluster status
Write-Host "`n[5/5] Verifying cluster status..." -ForegroundColor Yellow
Start-Sleep -Seconds 3
& $MysqlshPath --uri $uri --js -e "print(JSON.stringify(dba.getCluster().status(), null, 2))"

Write-Host "`n=== Cluster reboot complete ===" -ForegroundColor Cyan
