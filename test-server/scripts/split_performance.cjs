const fs = require('fs');
const path = require('path');

const baseDir = path.resolve(__dirname, '..');

// 1. Split test-tool-groups/test-performance.md
const tgPerfPath = path.join(baseDir, 'test-tool-groups', 'test-performance.md');
if (fs.existsSync(tgPerfPath)) {
  const content = fs.readFileSync(tgPerfPath, 'utf8');
  
  // Replace [performance] with [performance-analysis]
  let analysisContent = content.replace(/\[performance\]/g, '[performance-analysis]');
  analysisContent = analysisContent.replace(/performance Tool Group \(11 tools \+1 for code mode\):/, 'performance-analysis Tool Group (8 tools +1 for code mode):');
  analysisContent = analysisContent.replace(/9\. 'mysql_detect_query_anomalies'\n10\. 'mysql_detect_bloat_risk'\n11\. 'mysql_detect_connection_spike'\n12\. 'mysql_execute_code'/g, '9. \'mysql_execute_code\'');
  analysisContent = analysisContent.replace(/8\. `mysql_detect_query_anomalies\(\)`.*?\n9\. `mysql_detect_bloat_risk\(\)`.*?\n10\. `mysql_detect_connection_spike\(\)`.*?\n/g, '');
  analysisContent = analysisContent.replace(/15\. 🔴 `mysql_detect_query_anomalies\(\{minExecutions: "invalid"\}\)`.*?\n/g, '');
  
  fs.writeFileSync(path.join(baseDir, 'test-tool-groups', 'test-performance-analysis.md'), analysisContent);

  let anomalyContent = content.replace(/\[performance\]/g, '[performance-anomaly]');
  anomalyContent = anomalyContent.replace(/performance Tool Group \(11 tools \+1 for code mode\):/, 'performance-anomaly Tool Group (3 tools +1 for code mode):');
  anomalyContent = anomalyContent.replace(/1\. 'mysql_explain'[\s\S]*?12\. 'mysql_execute_code'/m, "1. 'mysql_detect_query_anomalies'\n2. 'mysql_detect_bloat_risk'\n3. 'mysql_detect_connection_spike'\n4. 'mysql_execute_code' (codemode, auto-added)");
  anomalyContent = anomalyContent.replace(/1\. `mysql_explain.*?\n[\s\S]*?10\. `mysql_detect_connection_spike\(\)`.*?\n/m, "1. `mysql_detect_query_anomalies()` → verify query anomalies detected\n2. `mysql_detect_bloat_risk()` → verify table bloat risks\n3. `mysql_detect_connection_spike()` → verify connection spike risks\n");
  anomalyContent = anomalyContent.replace(/11\. 🔴 `mysql_table_stats.*?12\. 🔴 `mysql_explain.*?\n/m, "");
  anomalyContent = anomalyContent.replace(/13\. 🔴 `mysql_explain.*?14\. 🔴 `mysql_table_stats.*?\n/m, "");
  anomalyContent = anomalyContent.replace(/16\. 🔴 `mysql_query_stats.*?17\. 🔴 `mysql_slow_queries.*?\n/m, "");
  
  fs.writeFileSync(path.join(baseDir, 'test-tool-groups', 'test-performance-anomaly.md'), anomalyContent);
  fs.unlinkSync(tgPerfPath);
}

// 2. Split test-codemode/test-codemode-performance.md
const cmPerfPath = path.join(baseDir, 'test-codemode', 'test-codemode-performance.md');
if (fs.existsSync(cmPerfPath)) {
  const content = fs.readFileSync(cmPerfPath, 'utf8');
  
  let analysisContent = content.replace(/\[performance\]/g, '[performance-analysis]');
  analysisContent = analysisContent.replace(/performance Tool Group \(11 tools \+1 code mode\):/, 'performance-analysis Tool Group (8 tools +1 code mode):');
  analysisContent = analysisContent.replace(/8\. `mysql_thread_stats` 9\. `mysql_detect_query_anomalies`\n4\. `mysql_detect_bloat_risk` 11\. `mysql_detect_connection_spike`/g, '8. `mysql_thread_stats`');
  analysisContent = analysisContent.replace(/9\. `mysql\.performance\.detectQueryAnomalies\(\)`.*?\n10\. `mysql\.performance\.detectBloatRisk\(\)`.*?\n11\. `mysql\.performance\.detectConnectionSpike\(\)`.*?\n/g, '');
  analysisContent = analysisContent.replace(/16\. 🔴 `mysql\.performance\.detectQueryAnomalies.*?\n/g, '');
  
  fs.writeFileSync(path.join(baseDir, 'test-codemode', 'test-codemode-performance-analysis.md'), analysisContent);

  let anomalyContent = content.replace(/\[performance\]/g, '[performance-anomaly]');
  anomalyContent = anomalyContent.replace(/performance Tool Group \(11 tools \+1 code mode\):/, 'performance-anomaly Tool Group (3 tools +1 code mode):');
  anomalyContent = anomalyContent.replace(/1\. `mysql_explain`.*?11\. `mysql_detect_connection_spike`/ms, "1. `mysql_detect_query_anomalies` 2. `mysql_detect_bloat_risk` 3. `mysql_detect_connection_spike`");
  anomalyContent = anomalyContent.replace(/1\. `mysql\.performance\.help\(\)`.*?\n.*?11\. `mysql\.performance\.detectConnectionSpike.*?\n/ms, "1. `mysql.performance.help()` → verify method listing\n2. `mysql.performance.detectQueryAnomalies()` → query anomalies\n3. `mysql.performance.detectBloatRisk()` → table bloat risks\n4. `mysql.performance.detectConnectionSpike()` → connection spike risks\n");
  anomalyContent = anomalyContent.replace(/12\. 🔴 `mysql\.performance\.tableStats.*?13\. 🔴 `mysql\.performance\.explain.*?\n/ms, "");
  anomalyContent = anomalyContent.replace(/14\. 🔴 `mysql\.performance\.explain.*?15\. 🔴 `mysql\.performance\.tableStats.*?\n/ms, "");
  
  fs.writeFileSync(path.join(baseDir, 'test-codemode', 'test-codemode-performance-anomaly.md'), anomalyContent);
  fs.unlinkSync(cmPerfPath);
}

// 3. Split test-advanced/test-codemode-advanced-performance.md
const advPerfPath = path.join(baseDir, 'test-advanced', 'test-codemode-advanced-performance.md');
if (fs.existsSync(advPerfPath)) {
  const content = fs.readFileSync(advPerfPath, 'utf8');
  
  let analysisContent = content.replace(/\[performance\]/g, '[performance-analysis]');
  analysisContent = analysisContent.replace(/## Category 5: Anomaly Detection Boundaries[\s\S]*?## Category 6/m, '## Category 6');
  
  fs.writeFileSync(path.join(baseDir, 'test-advanced', 'test-codemode-advanced-performance-analysis.md'), analysisContent);

  let anomalyContent = content.replace(/\[performance\]/g, '[performance-anomaly]');
  anomalyContent = anomalyContent.replace(/## Category 1: Explain Payload Sizes[\s\S]*?## Category 5/m, '## Category 1');
  anomalyContent = anomalyContent.replace(/Category 5: Anomaly Detection Boundaries/g, 'Category 1: Anomaly Detection Boundaries');
  anomalyContent = anomalyContent.replace(/Category 6/g, 'Category 2');
  
  fs.writeFileSync(path.join(baseDir, 'test-advanced', 'test-codemode-advanced-performance-anomaly.md'), anomalyContent);
  fs.unlinkSync(advPerfPath);
}

console.log("Done splitting");
