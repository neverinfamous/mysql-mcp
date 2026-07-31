$dashboards = @(
    @{ id = "qwe-2un-us8"; file = "datadog-dashboard.json" },
    @{ id = "q48-mq9-3i7"; file = "datadog-ai-dashboard.json" },
    @{ id = "4w2-tdx-wf7"; file = "datadog-mysql.json" },
    @{ id = "khx-zry-d49"; file = "datadog-redis.json" }
)

$configDir = "C:\Users\chris\Desktop\adamic\docs\unified-database-ecosystem\config"

foreach ($dashboard in $dashboards) {
    Write-Host "Uploading dashboard $($dashboard.file) ($($dashboard.id))..."
    $sourceFile = Join-Path $configDir $dashboard.file

    if (Test-Path $sourceFile) {
        pup dashboards update $dashboard.id --file $sourceFile -y
        Write-Host "  -> Successfully uploaded."
    } else {
        Write-Host "  -> Warning: File $sourceFile not found. Skipping." -ForegroundColor Yellow
    }
}
Write-Host "Dashboards upload complete."
