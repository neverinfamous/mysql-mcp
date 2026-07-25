#!/bin/bash
echo "[Healer] Starting auto-healer sidecar..."

while true; do
    # Sleep first to give nodes time to start naturally
    sleep 30

    # Query the replication group members
    STATUS=$(mysql -uroot -proot -h mysql-node1 -N -s -e 'SELECT member_state FROM performance_schema.replication_group_members WHERE member_host="mysql-node1";' 2>/dev/null || echo "ERROR")
    
    if [ "$STATUS" = "OFFLINE" ] || [ "$STATUS" = "ERROR" ]; then
        echo "[Healer] Cluster node1 is not ONLINE (status: $STATUS). Checking if a reboot is needed..."
        
        # Check if the cluster is completely out (no other nodes are ONLINE)
        ONLINE_COUNT=$(mysql -uroot -proot -h mysql-node1 -N -s -e 'SELECT COUNT(*) FROM performance_schema.replication_group_members WHERE member_state="ONLINE";' 2>/dev/null || echo "0")
        
        if [ "$ONLINE_COUNT" -eq 0 ]; then
            echo "[Healer] Cluster is completely offline! Attempting reboot..."
            
            # Reboot cluster
            mysqlsh --uri root:root@mysql-node1:3306 --js -e 'try { dba.rebootClusterFromCompleteOutage() } catch(e) { print(e) }'
            
            echo "[Healer] Waiting for reboot to settle..."
            sleep 10
            
            # Attempt to rejoin secondaries incrementally
            echo "[Healer] Rejoining mysql-node2..."
            mysqlsh --uri root:root@mysql-node1:3306 --js -e 'try { var c = dba.getCluster(); c.rejoinInstance("root:root@mysql-node2:3306"); } catch(e) { print(e) }'
            
            echo "[Healer] Rejoining mysql-node3..."
            mysqlsh --uri root:root@mysql-node1:3306 --js -e 'try { var c = dba.getCluster(); c.rejoinInstance("root:root@mysql-node3:3306"); } catch(e) { print(e) }'
            
            echo "[Healer] Auto-heal procedure complete."
        else
            echo "[Healer] Cluster has $ONLINE_COUNT online nodes, waiting for natural recovery..."
        fi
    fi

    # Check ProxySQL backend status and heal if shunned
    PROXY_STATUS=$(mysql -uadmin -padmin -h proxysql -P 6032 -N -s -e 'SELECT status FROM stats_mysql_connection_pool WHERE srv_host="mysql-router";' 2>/dev/null || echo "UNKNOWN")
    if [ "$PROXY_STATUS" = "SHUNNED" ]; then
        echo "[Healer] ProxySQL backend mysql-router is SHUNNED! Forcing reload to runtime..."
        mysql -uadmin -padmin -h proxysql -P 6032 -e "LOAD MYSQL SERVERS TO RUNTIME;"
    fi
done
