#!/bin/bash
set -e

echo "Bootstrapping InnoDB Cluster 'mcpCluster'..."

docker exec -i example-ha-node1 mysqlsh --user=cluster_admin --password=cluster_admin --execute="
try {
  var cluster = dba.getCluster('mcpCluster');
  print('Cluster already exists.\\n');
} catch (e) {
  print('Creating new cluster...\\n');
  var cluster = dba.createCluster('mcpCluster', {
    ipAllowlist: 'AUTOMATIC'
  });
  
  print('Adding node 2...\\n');
  cluster.addInstance('cluster_admin:cluster_admin@example-ha-node2:3306', {
    recoveryMethod: 'clone',
    ipAllowlist: 'AUTOMATIC'
  });
  
  print('Adding node 3...\\n');
  cluster.addInstance('cluster_admin:cluster_admin@example-ha-node3:3306', {
    recoveryMethod: 'clone',
    ipAllowlist: 'AUTOMATIC'
  });
  
  print('Cluster bootstrap complete.\\n');
}
"

echo "Cluster status:"
docker exec -i example-ha-node1 mysqlsh --user=cluster_admin --password=cluster_admin --execute="dba.getCluster('mcpCluster').status()"
