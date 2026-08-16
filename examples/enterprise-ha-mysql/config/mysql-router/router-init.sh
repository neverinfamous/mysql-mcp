#!/bin/bash
set -e

# Wait for the cluster to be fully bootstrapped before bootstrapping the router
echo "Waiting for InnoDB cluster to be ready on example-ha-node1..."
until mysqlsh --user=cluster_admin --password=cluster_admin --host=example-ha-node1 --port=3306 --sql -e "SELECT 1" &> /dev/null; do
  echo "Cluster not ready yet. Retrying in 5 seconds..."
  sleep 5
done

# We also need to verify the cluster is actually created in the metadata, not just the node being up
until mysqlsh --user=cluster_admin --password=cluster_admin --host=example-ha-node1 --port=3306 --execute="var cluster = dba.getCluster('mcpCluster');" &> /dev/null; do
  echo "InnoDB Cluster 'mcpCluster' metadata not found yet. Waiting 5s..."
  sleep 5
done

echo "Cluster is ready. Bootstrapping MySQL Router..."
mysqlrouter --bootstrap cluster_admin:cluster_admin@example-ha-node1:3306 \
  --directory /tmp/mysqlrouter \
  --user root \
  --conf-use-sockets \
  --force \
  --conf-set-option=http_server.port=8443 \
  --conf-set-option=rest_connection_pool.require_realm=default_auth_realm \
  --conf-set-option=routing:bootstrap_ro.connection_sharing=1

echo "Configuring REST API authentication..."
mkdir -p /tmp/mysqlrouter/data
echo 'router_api' | /usr/bin/mysqlrouter_passwd set /tmp/mysqlrouter/data/rest_users rest_api
sed -i 's|backend=metadata_cache|backend=file\nfilename=/tmp/mysqlrouter/data/rest_users|' /tmp/mysqlrouter/mysqlrouter.conf

echo "Starting MySQL Router..."
mysqlrouter --config /tmp/mysqlrouter/mysqlrouter.conf
