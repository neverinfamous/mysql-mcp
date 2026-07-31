$dashboards = @(
    @{ id = "qwe-2un-us8"; file = "datadog-dashboard.json" },
    @{ id = "q48-mq9-3i7"; file = "datadog-ai-dashboard.json" },
    @{ id = "4w2-tdx-wf7"; file = "datadog-mysql.json" },
    @{ id = "khx-zry-d49"; file = "datadog-redis.json" }
)

$targetDirs = @(
    "C:\Users\chris\Desktop\adamic\docs\unified-database-ecosystem\config",
    "C:\Users\chris\Desktop\mysql-mcp\test-server\infrastructure\config",
    "C:\Users\chris\Desktop\mysql-mcp\examples\dashboards"
)

foreach ($dashboard in $dashboards) {
    Write-Host "Downloading dashboard $($dashboard.file) ($($dashboard.id))..."
    
    $tempFile = [System.IO.Path]::GetTempFileName()
    # Use pup to download and strip API-specific metadata
    pup dashboards get $dashboard.id -o json --jq "{title, description, widgets, template_variables, layout_type, notify_list, pause_auto_refresh, reflow_type}" | Out-File $tempFile -Encoding utf8NoBOM

    foreach ($dir in $targetDirs) {
        if (Test-Path $dir) {
            $dest = Join-Path $dir $dashboard.file
            Copy-Item $tempFile -Destination $dest -Force
            Write-Host "  -> Saved to $dest"
        }
    }
    Remove-Item $tempFile -Force
}
Write-Host "Dashboards backup complete."
