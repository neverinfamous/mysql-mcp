
const fs = require("fs");
const file = "test-server/infrastructure/config/datadog-ai-dashboard.json";
let dashboard = JSON.parse(fs.readFileSync(file, "utf8"));
dashboard.widgets.forEach(w => {
  if (w.definition && w.definition.type === "query_value") {
    w.definition.requests.forEach(r => {
      // If the formula contains monotonic_diff, we want the SUM of the diffs over time, not the AVG.
      if (r.formulas && r.formulas.some(f => f.formula.includes("monotonic_diff"))) {
        r.aggregator = "sum";
      }
    });
  }
});
fs.writeFileSync(file, JSON.stringify(dashboard, null, 2));

