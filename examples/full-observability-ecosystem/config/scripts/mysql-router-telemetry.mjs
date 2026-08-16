/**
 * MySQL Router OpenTelemetry Sidecar
 * 
 * Polls the MySQL Router REST API and pushes OpenTelemetry OTLP/JSON metrics to an OTLP HTTP receiver.
 * This script is zero-dependency, leveraging Bun's native fetch and OTLP JSON protocols.
 */

// To bypass self-signed cert validation for the router API, set NODE_TLS_REJECT_UNAUTHORIZED=0 in your environment.

const ROUTER_API_URL = process.env.ROUTER_API_URL || "https://mysql-router:8443/api/20190715";
const ROUTER_API_USER = process.env.ROUTER_API_USER || "rest_api";
const ROUTER_API_PASSWORD = process.env.ROUTER_API_PASSWORD || "router_api";
const OTEL_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://datadog-unified:4318";
const POLL_INTERVAL_MS = parseInt(process.env.OTEL_METRIC_EXPORT_INTERVAL || "15000", 10);

const authHeader = `Basic ${Buffer.from(`${ROUTER_API_USER}:${ROUTER_API_PASSWORD}`).toString('base64')}`;

async function fetchRouterAPI(path) {
  const res = await fetch(`${ROUTER_API_URL}${path}`, {
    headers: { 'Authorization': authHeader }
  });
  if (!res.ok) throw new Error(`Router API ${path} returned ${res.status}`);
  return res.json();
}

const START_TIME = (Date.now() * 1000000).toString();

function createDataPoint(value, attributes) {
  return {
    startTimeUnixNano: START_TIME,
    timeUnixNano: (Date.now() * 1000000).toString(),
    asInt: String(Number(Math.floor(value))),
    attributes: Object.entries(attributes).map(([key, val]) => ({
      key,
      value: { stringValue: String(val) }
    }))
  };
}

async function collectMetrics() {
  const scopeMetrics = [];
  
  try {
    const routesRes = await fetchRouterAPI('/routes');
    const routes = routesRes.items || [];
    
    const activeConnectionsPoints = [];
    const totalConnectionsPoints = [];
    const bytesClientPoints = [];
    const bytesServerPoints = [];
    const blockedHostsPoints = [];
    const destinationHealthPoints = [];

    for (const route of routes) {
      const routeName = route.name;
      
      // Get status (connections & blocked hosts)
      try {
        const status = await fetchRouterAPI(`/routes/${routeName}/status`);
        activeConnectionsPoints.push(createDataPoint(status.activeConnections || 0, { route: routeName }));
        totalConnectionsPoints.push(createDataPoint(status.totalConnections || 0, { route: routeName }));
        blockedHostsPoints.push(createDataPoint(status.blockedHosts || 0, { route: routeName }));
      } catch (err) {
        console.error(`Failed to fetch status for route ${routeName}:`, err.message);
      }

      // Get connections (bytes)
      try {
        const conn = await fetchRouterAPI(`/routes/${routeName}/connections`);
        let totalBytesClient = 0;
        let totalBytesServer = 0;
        for (const item of (conn.items || [])) {
          totalBytesClient += (item.bytesToServer || 0); // Bytes from client sent to server
          totalBytesServer += (item.bytesFromServer || 0); // Bytes from server sent to client
        }
        bytesClientPoints.push(createDataPoint(totalBytesClient, { route: routeName }));
        bytesServerPoints.push(createDataPoint(totalBytesServer, { route: routeName }));
      } catch (err) {
        console.error(`Failed to fetch connections for route ${routeName}:`, err.message);
      }

      // Get destinations and health
      try {
        const dests = await fetchRouterAPI(`/routes/${routeName}/destinations`);
        const healthResult = await fetchRouterAPI(`/routes/${routeName}/health`);
        const isHealthy = healthResult.isAlive ? 1 : 0;
        
        for (const dest of (dests.items || [])) {
          destinationHealthPoints.push(createDataPoint(isHealthy, { 
            route: routeName, 
            address: dest.address,
            status: healthResult.isAlive ? "Ok" : "Failing"
          }));
        }
      } catch (err) {
        console.error(`Failed to fetch destinations for route ${routeName}:`, err.message);
      }
    }

    const pushMetric = (name, desc, unit, points, type) => {
      if (points.length === 0) return;
      scopeMetrics.push({
        name,
        description: desc,
        unit,
        [type]: {
          dataPoints: points
        }
      });
    };

    pushMetric("mysqlrouter.connections.active", "Active connections per route", "{connection}", activeConnectionsPoints, "gauge");
    pushMetric("mysqlrouter.connections.total", "Total connections handled per route", "{connection}", totalConnectionsPoints, "sum");
    pushMetric("mysqlrouter.bytes.client", "Bytes received from client", "By", bytesClientPoints, "sum");
    pushMetric("mysqlrouter.bytes.server", "Bytes received from server", "By", bytesServerPoints, "sum");
    pushMetric("mysqlrouter.blocked_hosts", "Number of blocked hosts", "{host}", blockedHostsPoints, "gauge");
    pushMetric("mysqlrouter.destination.health", "Health of backend destinations", "1", destinationHealthPoints, "gauge");

  } catch (err) {
    console.error("Failed to collect metrics from Router:", err);
    process.exit(1);
  }

  for (const m of scopeMetrics) {
    if (m.sum) {
      m.sum.aggregationTemporality = 2; // CUMULATIVE
      m.sum.isMonotonic = true;
    }
  }

  return {
    resourceMetrics: [{
      resource: {
        attributes: [
          { key: "service.name", value: { stringValue: "mysql-router" } },
          { key: "service.version", value: { stringValue: "9.7.1" } },
          { key: "deployment.environment.name", value: { stringValue: "development" } }
        ]
      },
      scopeMetrics: [{
        scope: { name: "mysql-router-telemetry", version: "1.0.0" },
        metrics: scopeMetrics
      }]
    }]
  };
}

async function exportMetrics(payload) {
  if (!payload) return;
  try {
    const res = await fetch(`${OTEL_ENDPOINT}/v1/metrics`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      console.error(`OTLP Export failed: ${res.status}`, await res.text());
    } else {
      console.log(`[${new Date().toISOString()}] Successfully exported metrics to Datadog via OTLP HTTP`);
    }
  } catch (err) {
    console.error("Failed to export metrics to Datadog:", err.message);
    process.exit(1);
  }
}

async function run() {
  console.log(`Starting MySQL Router OTLP telemetry poller every ${POLL_INTERVAL_MS}ms...`);
  
  // Run once immediately
  const payload = await collectMetrics();
  await exportMetrics(payload);
  
  setInterval(async () => {
    const p = await collectMetrics();
    await exportMetrics(p);
  }, POLL_INTERVAL_MS);
}

run();
