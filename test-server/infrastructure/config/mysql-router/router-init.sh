#!/bin/bash
set -e

ROUTER_DIR="/tmp/mysqlrouter"
CONF_FILE="$ROUTER_DIR/mysqlrouter.conf"

if [ ! -f "$CONF_FILE" ]; then
    echo "[Router-Init] Bootstrapping router..."
    
    MAX_RETRIES=15
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
            --conf-set-option logger.level=ERROR \
            --conf-use-gr-notifications=1 2>/dev/null; then
            BOOTSTRAP_SUCCESS=true
            break
        fi
        
        RETRY_COUNT=$((RETRY_COUNT+1))
        echo "[Router-Init] Bootstrap failed. Retrying in 5 seconds... ($RETRY_COUNT/$MAX_RETRIES)"
        sleep 5
    done
    
    if [ "$BOOTSTRAP_SUCCESS" = "false" ]; then
        
        echo "[Router-Init] Dynamic metadata bootstrap unavailable; configuring static routing..."
        mkdir -p "$ROUTER_DIR/data"
        echo 'router_api' | /usr/bin/mysqlrouter_passwd set "$ROUTER_DIR/data/rest_users" rest_api
        cat <<'EOF' > "$CONF_FILE"
[DEFAULT]
logging_folder=
runtime_folder=/tmp/mysqlrouter
data_folder=/tmp/mysqlrouter/data

[routing:bootstrap_rw]
bind_address=0.0.0.0
bind_port=6446
destinations=mysql-node1:3306,mysql-node2:3306,mysql-node3:3306
routing_strategy=first-available
protocol=classic

[routing:bootstrap_ro]
bind_address=0.0.0.0
bind_port=6447
destinations=mysql-node2:3306,mysql-node3:3306,mysql-node1:3306
routing_strategy=round-robin
protocol=classic

[http_server]
bind_address=0.0.0.0
port=8443

[http_auth_backend:default_auth_backend]
backend=file
filename=/tmp/mysqlrouter/data/rest_users

[http_auth_realm:default_auth_realm]
backend=default_auth_backend
method=basic
name=default_realm

[rest_api]
require_realm=default_auth_realm

[rest_router]
require_realm=default_auth_realm

[rest_routing]
require_realm=default_auth_realm
EOF
    else
        echo "[Router-Init] Bootstrap complete. Configuring REST API authentication..."
        # Create REST API user
        echo 'router_api' | /usr/bin/mysqlrouter_passwd set "$ROUTER_DIR/data/rest_users" rest_api
        
        # Switch REST auth from metadata_cache to file-based
        sed -i 's|backend=metadata_cache|backend=file\nfilename=/tmp/mysqlrouter/data/rest_users|' "$CONF_FILE"

        # Make router log to stdout/stderr so we can see what it's doing
        sed -i -e 's/logging_folder=.*$/logging_folder=/' "$CONF_FILE"
        
        # Force log level to ERROR and enable GR notifications (bootstrap ignores conf-set-option for these)
        sed -i 's/level=info/level=ERROR/g' "$CONF_FILE"
        sed -i 's/use_gr_notifications=0/use_gr_notifications=1/g' "$CONF_FILE"
    fi

    echo "[Router-Init] Configuration complete."
else
    echo "[Router-Init] Existing configuration found. Skipping bootstrap."
fi

echo "[Router-Init] Starting mysql-router..."
exec mysqlrouter -c "$CONF_FILE"
