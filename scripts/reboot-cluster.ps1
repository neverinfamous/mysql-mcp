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
    $oldErrPref = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    docker exec mysql-node1 mysqladmin ping -h localhost -uroot -proot 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { 
        $ErrorActionPreference = $oldErrPref
        break 
    }
    $ErrorActionPreference = $oldErrPref
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
& $MysqlshPath --uri $uri --js -e "try { dba.rebootClusterFromCompleteOutage('$ClusterName', {force: true}); } catch(e) { print('Reboot output: ' + e.message); }"

Write-Host "  Cluster reboot step completed" -ForegroundColor Green

# 4. Rejoin secondaries from inside Docker network
# MySQL Shell on Windows can't resolve Docker container hostnames,
# so secondaries may show as MISSING after reboot. Rejoin from inside node1.
Write-Host "`n[4/5] Rejoining secondaries from inside Docker network..." -ForegroundColor Yellow
$clusterUser = "cluster_admin"
$clusterPass = "cluster_admin"
$secondaries = @("mysql-node2", "mysql-node3")
foreach ($node in $secondaries) {
    Write-Host "  Rejoining $node..." -ForegroundColor Gray
    $oldErrPref = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $rejoinOutput = docker exec mysql-node1 mysqlsh --uri "${clusterUser}:${clusterPass}@mysql-node1:3306" --js -e "var c = dba.getCluster(); try { c.rejoinInstance('${clusterUser}:${clusterPass}@${node}:3306'); print('REJOIN_SUCCESS'); } catch(e) { print('REJOIN_ERROR'); }" 2>&1
    $ErrorActionPreference = $oldErrPref
    
    if ($rejoinOutput -match "REJOIN_SUCCESS") {
        Write-Host "  $node rejoined successfully" -ForegroundColor Green
    } else {
        Write-Host "  $node rejoin failed. Attempting automated clone recovery..." -ForegroundColor Yellow
        
        # 1. Remove the stale instance
        Write-Host "    -> Removing stale instance..." -ForegroundColor Gray
        docker exec mysql-node1 mysqlsh --uri "${clusterUser}:${clusterPass}@mysql-node1:3306" --js -e "var c = dba.getCluster(); try { c.removeInstance('${clusterUser}:${clusterPass}@${node}:3306', {force: true}); } catch(e) {}" 2>&1 | Out-Null
        
        # 2. Add instance via clone (starts a background job since it blocks)
        Write-Host "    -> Cloning instance (this will take a moment)..." -ForegroundColor Gray
        $addJob = Start-Job -ScriptBlock {
            param($user, $pass, $targetNode)
            docker exec mysql-node1 mysqlsh --uri "${user}:${pass}@mysql-node1:3306" --js -e "var c = dba.getCluster(); c.addInstance('${user}:${pass}@${targetNode}:3306', {recoveryMethod: 'clone'});" 2>&1
        } -ArgumentList $clusterUser, $clusterPass, $node
        
        # 3. Monitor the container status and start it when it stops
        $retries = 0
        while ($retries -lt 60) {
            Start-Sleep -Seconds 2
            $status = docker inspect -f '{{.State.Status}}' $node 2>$null
            if ($status -eq "exited" -or $status -eq "stopped") {
                Write-Host "    -> Container stopped during clone. Restarting $node..." -ForegroundColor Cyan
                docker start $node | Out-Null
                break
            }
            if ($addJob.State -eq "Completed") {
                break
            }
            $retries++
        }
        
        # 4. Wait for the clone operation to finish
        Wait-Job $addJob | Out-Null
        Receive-Job $addJob | Out-Null
        Remove-Job $addJob
        
        Write-Host "  Clone recovery for $node completed." -ForegroundColor Green
        
        # Restart router so it picks up the new topology correctly
        docker restart mysql-router | Out-Null
    }
}

# 5. Verify cluster status
Write-Host "`n[5/5] Verifying cluster status..." -ForegroundColor Yellow
Start-Sleep -Seconds 3
& $MysqlshPath --uri $uri --js -e "print(JSON.stringify(dba.getCluster().status(), null, 2))"

Write-Host "`n=== Cluster reboot complete ===" -ForegroundColor Cyan
