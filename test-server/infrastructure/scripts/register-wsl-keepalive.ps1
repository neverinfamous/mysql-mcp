# WSL KeepAlive Scheduled Task - Hidden Window Version
# Re-registers the task to use a VBS wrapper so no console window is visible.

$taskName = 'WSL-KeepAlive'
$vbsPath = Join-Path $PSScriptRoot 'wsl-keepalive.vbs'

# Stop any running instance first
Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

$action = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument "`"$vbsPath`""
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1)

$principal = New-ScheduledTaskPrincipal `
    -UserId $env:USERNAME `
    -LogonType Interactive `
    -RunLevel Limited

Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Description 'Keeps WSL2 Ubuntu distro alive for Docker services (hidden)' `
    -Force

Write-Host "Scheduled task '$taskName' re-registered with hidden window."
Start-ScheduledTask -TaskName $taskName
Start-Sleep -Seconds 3
$task = Get-ScheduledTask -TaskName $taskName
Write-Host "Task state: $($task.State)"
