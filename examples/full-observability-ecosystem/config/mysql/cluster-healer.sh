#!/bin/bash
# InnoDB Cluster Auto-Healer
# Uses raw SQL (no mysqlsh dependency) to detect and recover from complete cluster outages.
# Runs as a lightweight sidecar container using the mysql:9.1.0 image.

echo "[Healer] Starting InnoDB Cluster auto-healer..."

# Rapid initial checks, then slow down once healthy
CHECK_INTERVAL=5
HEALTHY_INTERVAL=30
HEALTH_FILE="/tmp/cluster-healthy"

# Remove any stale health file from previous runs
rm -f "$HEALTH_FILE"

run_sql() {
    local host="$1" query="$2"
    mysql -uroot -proot -h "$host" -N -s -e "$query" 2>/dev/null
}

wait_for_nodes() {
    echo "[Healer] Waiting for MySQL nodes to be reachable..."
    for node in mysql-node1 mysql-node2 mysql-node3; do
        for i in $(seq 1 60); do
            if mysqladmin ping -h "$node" -uroot -proot --silent 2>/dev/null; then
                echo "[Healer] $node is reachable."
                break
            fi
            [ "$i" -eq 60 ] && echo "[Healer] WARNING: $node not reachable after 120s"
            sleep 2
        done
    done
}

reboot_cluster() {
    echo "[Healer] === COMPLETE OUTAGE DETECTED ==="
    echo "[Healer] Stopping stale Group Replication on all nodes..."
    for node in mysql-node1 mysql-node2 mysql-node3; do
        run_sql "$node" "STOP GROUP_REPLICATION;" || true
    done
    sleep 2

    echo "[Healer] Bootstrapping Group Replication on mysql-node1..."
    run_sql mysql-node1 "SET GLOBAL group_replication_bootstrap_group=ON; START GROUP_REPLICATION; SET GLOBAL group_replication_bootstrap_group=OFF;"

    echo "[Healer] Waiting for mysql-node1 to come ONLINE..."
    for i in $(seq 1 30); do
        local status
        status=$(run_sql mysql-node1 "SELECT member_state FROM performance_schema.replication_group_members WHERE member_host='mysql-node1';" || echo "WAITING")
        if [ "$status" = "ONLINE" ]; then
            echo "[Healer] mysql-node1 is ONLINE!"
            break
        fi
        sleep 2
    done

    for node in mysql-node2 mysql-node3; do
        echo "[Healer] Starting Group Replication on $node..."
        run_sql "$node" "START GROUP_REPLICATION;" || true
        sleep 3
    done

    sleep 5
    local final_count
    final_count=$(run_sql mysql-node1 "SELECT COUNT(*) FROM performance_schema.replication_group_members WHERE member_state='ONLINE';" || echo "0")
    echo "[Healer] Cluster reboot complete. $final_count/3 members ONLINE."
}

rejoin_node() {
    local node="$1"
    echo "[Healer] Attempting to rejoin $node..."
    run_sql "$node" "STOP GROUP_REPLICATION;" || true
    sleep 1
    run_sql "$node" "START GROUP_REPLICATION;" || true
}

# Wait for nodes to be reachable before starting the main loop
wait_for_nodes

while true; do
    sleep $CHECK_INTERVAL

    # Check if ANY node reports ONLINE members
    ONLINE_COUNT=0
    for node in mysql-node1 mysql-node2 mysql-node3; do
        count=$(run_sql "$node" "SELECT COUNT(*) FROM performance_schema.replication_group_members WHERE member_state='ONLINE';" || echo "0")
        if [ "$count" -gt "$ONLINE_COUNT" ]; then
            ONLINE_COUNT=$count
        fi
    done

    if [ "$ONLINE_COUNT" -eq 0 ]; then
        # Complete outage - no members online anywhere
        rm -f "$HEALTH_FILE"
        reboot_cluster
        CHECK_INTERVAL=10
    elif [ "$ONLINE_COUNT" -lt 3 ]; then
        # Partial outage - try to rejoin missing nodes
        echo "$ONLINE_COUNT" > "$HEALTH_FILE"
        for node in mysql-node1 mysql-node2 mysql-node3; do
            node_status=$(run_sql mysql-node1 "SELECT member_state FROM performance_schema.replication_group_members WHERE member_host='$node';" || echo "UNKNOWN")
            if [ "$node_status" != "ONLINE" ] && [ "$node_status" != "RECOVERING" ]; then
                rejoin_node "$node"
            fi
        done
        CHECK_INTERVAL=10
    else
        # All healthy
        echo "$ONLINE_COUNT" > "$HEALTH_FILE"
        CHECK_INTERVAL=$HEALTHY_INTERVAL
    fi
done
