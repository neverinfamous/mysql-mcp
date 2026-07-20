#!/bin/bash
set -e

echo "Bootstrapping InnoDB Cluster 'mcpCluster'..."

mysqlsh --user=cluster_admin --password=cluster_admin --host=127.0.0.1 --port=3307 --execute="
try {
  var cluster = dba.getCluster('mcpCluster');
  print('Cluster already exists.\\n');
} catch (e) {
  print('Creating new cluster...\\n');
  var cluster = dba.createCluster('mcpCluster', {
    ipAllowlist: 'AUTOMATIC'
  });
  
  print('Adding node 2...\\n');
  cluster.addInstance('cluster_admin:cluster_admin@mysql-node2:3306', {
    recoveryMethod: 'clone',
    ipAllowlist: 'AUTOMATIC'
  });
  
  print('Adding node 3...\\n');
  cluster.addInstance('cluster_admin:cluster_admin@mysql-node3:3306', {
    recoveryMethod: 'clone',
    ipAllowlist: 'AUTOMATIC'
  });
  
  print('Cluster bootstrap complete.\\n');
}
"

echo "Cluster status:"
mysqlsh --user=cluster_admin --password=cluster_admin --host=127.0.0.1 --port=3307 --execute="dba.getCluster('mcpCluster').status()"
