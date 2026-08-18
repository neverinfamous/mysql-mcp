#!/bin/bash
set -e

ROUTER_DIR="/tmp/mysqlrouter"
CONF_FILE="$ROUTER_DIR/mysqlrouter.conf"

if [ ! -f "$CONF_FILE" ]; then
    echo "[Router-Init] Bootstrapping router..."
    
    MAX_RETRIES=60
    RETRY_COUNT=0
    BOOTSTRAP_SUCCESS=false
    
    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        if mysqlrouter --bootstrap root:root@mysql-node1:3306 \
            --directory "$ROUTER_DIR" \
            --force \
            --conf-set-option http_server.port=8443 \
            --conf-set-option rest_connection_pool.require_realm=default_auth_realm \
            --conf-set-option routing:bootstrap_rw.connection_sharing=1 \
            --conf-set-option routing:bootstrap_ro.connection_sharing=1 \
            --conf-use-gr-notifications=1 2>/dev/null; then
            BOOTSTRAP_SUCCESS=true
            break
        fi
        
        RETRY_COUNT=$((RETRY_COUNT+1))
        echo "[Router-Init] Bootstrap failed. Retrying in 5 seconds... ($RETRY_COUNT/$MAX_RETRIES)"
        sleep 5
    done
    
    if [ "$BOOTSTRAP_SUCCESS" = "false" ]; then
        echo "[Router-Init] Dynamic metadata bootstrap unavailable. Exiting so container can restart and try again."
        exit 1
    else
        echo "[Router-Init] Bootstrap complete. Configuring REST API authentication..."
        # Create REST API user
        echo 'router_api' | /usr/bin/mysqlrouter_passwd set "$ROUTER_DIR/data/rest_users" rest_api
        
        # Switch REST auth from metadata_cache to file-based
        sed -i 's|backend=metadata_cache|backend=file\nfilename=/tmp/mysqlrouter/data/rest_users|' "$CONF_FILE"

        # Make router log to stdout/stderr so we can see what it's doing
        sed -i -e 's/logging_folder=.*$/logging_folder=/' "$CONF_FILE"
        
        # Enable GR notifications (bootstrap ignores conf-set-option for these)
        sed -i 's/use_gr_notifications=0/use_gr_notifications=1/g' "$CONF_FILE"
    fi

    echo "[Router-Init] Configuration complete."
else
    echo "[Router-Init] Existing configuration found. Skipping bootstrap."
fi

echo "[Router-Init] Starting mysql-router..."
exec mysqlrouter -c "$CONF_FILE"
