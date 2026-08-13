process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const authHeader = `Basic ${Buffer.from(`rest_api:router_api`).toString('base64')}`;
async function run() {
  const res = await fetch("https://mysql-router:8443/api/20190715/connection_pool", { headers: { Authorization: authHeader } });
  console.log(await res.text());
}
run();
