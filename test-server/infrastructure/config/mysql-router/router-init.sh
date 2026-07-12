#!/bin/bash
set -e

ROUTER_DIR="/tmp/mysqlrouter"
CONF_FILE="$ROUTER_DIR/mysqlrouter.conf"

if [ ! -f "$CONF_FILE" ]; then
    echo "[Router-Init] Bootstrapping router..."
    
    # Loop until bootstrap succeeds (it fails if cluster isn't ONLINE yet)
    max_tries=30
    attempt_num=0
    until mysqlrouter --bootstrap root:root@mysql-node1:3306 \
        --directory "$ROUTER_DIR" \
        --force \
        --conf-set-option http_server.port=8443 \
        --conf-set-option rest_connection_pool.require_realm=default_auth_realm \
        --conf-set-option routing:bootstrap_rw.connection_sharing=1 \
        --conf-set-option routing:bootstrap_ro.connection_sharing=1; do
        
        echo "[Router-Init] Bootstrap failed or cluster not ONLINE yet. Retrying in 3 seconds ($attempt_num/$max_tries)..."
        sleep 3
        attempt_num=$(( attempt_num + 1 ))
        if [ $attempt_num -eq $max_tries ]; then
            echo "[Router-Init] Error: Could not bootstrap mysql-router."
            exit 1
        fi
    done

    echo "[Router-Init] Bootstrap complete. Configuring REST API authentication..."
    # Create REST API user
    echo 'router_api' | /usr/bin/mysqlrouter_passwd set "$ROUTER_DIR/data/rest_users" rest_api
    
    # Switch REST auth from metadata_cache to file-based
    sed -i 's|backend=metadata_cache|backend=file\nfilename=/tmp/mysqlrouter/data/rest_users|' "$CONF_FILE"

    # Make router log to stdout/stderr so we can see what it's doing
    sed -i -e 's/logging_folder=.*$/logging_folder=/' "$CONF_FILE"

    echo "[Router-Init] Configuration complete."
else
    echo "[Router-Init] Existing configuration found. Skipping bootstrap."
fi

echo "[Router-Init] Starting mysql-router..."
exec mysqlrouter -c "$CONF_FILE"
