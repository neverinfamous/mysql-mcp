-- =============================================================================
-- test-prompts.sql - Database seed for testing mysql-mcp prompts
-- =============================================================================
-- This seed creates tables and data to support testing all 19 prompts.
-- Prompts are documentation/guidance generators, so this seed primarily
-- ensures the referenced tools and queries will work when testing prompts.
--
-- Target: testdb database on mysql-final Docker container
-- Usage: Get-Content test-prompts.sql -Raw | docker exec -i mysql-final mysql -uroot -proot testdb
-- =============================================================================

-- Increase recursion depth for 10K-row CTE generation
SET SESSION cte_max_recursion_depth = 11000;

-- =============================================================================
-- CLEANUP: Drop existing prompt tables
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS prompt_order_items;
DROP TABLE IF EXISTS prompt_orders;
DROP TABLE IF EXISTS prompt_users;
DROP TABLE IF EXISTS prompt_transactions;
DROP TABLE IF EXISTS prompt_sessions;
DROP TABLE IF EXISTS prompt_audit_log;
DROP TABLE IF EXISTS prompt_locations;
DROP TABLE IF EXISTS prompt_documents;
DROP TABLE IF EXISTS prompt_events;
DROP TABLE IF EXISTS prompt_daily_reports;
DROP TABLE IF EXISTS prompt_weekly_metrics;

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- SECTION 1: Core Tables (for mysql_query_builder, mysql_schema_design,
--            mysql_migration, mysql_quick_query, mysql_quick_schema)
-- =============================================================================

-- Users table for authentication/query examples
CREATE TABLE prompt_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash TEXT,
    display_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    INDEX idx_prompt_users_email (email),
    INDEX idx_prompt_users_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Orders table for join/CTE examples
CREATE TABLE prompt_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total_amount DECIMAL(10,2),
    status VARCHAR(50) DEFAULT 'pending',
    FOREIGN KEY (user_id) REFERENCES prompt_users(id) ON DELETE SET NULL,
    INDEX idx_prompt_orders_user (user_id),
    INDEX idx_prompt_orders_status (status),
    INDEX idx_prompt_orders_date (order_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Order items for multi-table queries
CREATE TABLE prompt_order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT,
    product_name VARCHAR(255),
    quantity INT,
    unit_price DECIMAL(10,2),
    FOREIGN KEY (order_id) REFERENCES prompt_orders(id) ON DELETE CASCADE,
    INDEX idx_prompt_items_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed core tables
INSERT INTO prompt_users (email, username, display_name) VALUES
    ('alice@example.com', 'alice', 'Alice Smith'),
    ('bob@example.com', 'bob', 'Bob Johnson'),
    ('carol@example.com', 'carol', 'Carol Williams');

-- Seed orders (5 per user)
INSERT INTO prompt_orders (user_id, total_amount, status) VALUES
    (1, 125.50, 'pending'),
    (1, 299.99, 'shipped'),
    (1, 45.00, 'delivered'),
    (1, 189.75, 'processing'),
    (1, 67.25, 'delivered'),
    (2, 350.00, 'pending'),
    (2, 88.50, 'delivered'),
    (2, 420.00, 'shipped'),
    (2, 55.99, 'processing'),
    (2, 175.25, 'delivered'),
    (3, 99.99, 'pending'),
    (3, 245.00, 'delivered'),
    (3, 310.50, 'shipped'),
    (3, 72.00, 'processing'),
    (3, 158.75, 'delivered');

-- Seed order items (3 per order, first 5 orders)
INSERT INTO prompt_order_items (order_id, product_name, quantity, unit_price) VALUES
    (1, 'Widget A', 2, 25.50),
    (1, 'Widget B', 1, 74.50),
    (2, 'Gadget Pro', 1, 299.99),
    (3, 'Cable Pack', 3, 15.00),
    (4, 'Monitor Stand', 1, 89.75),
    (4, 'Mouse Pad', 2, 25.00),
    (4, 'Pen Set', 1, 25.00),
    (5, 'Notebook', 5, 12.99),
    (5, 'Stapler', 1, 2.30);

-- =============================================================================
-- SECTION 2: Performance Analysis Tables
--            (for mysql_performance_analysis, mysql_index_tuning)
-- =============================================================================

-- Large table for performance testing
CREATE TABLE prompt_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    account_id INT,
    transaction_type VARCHAR(20),
    amount DECIMAL(12,2),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_prompt_trans_account (account_id),
    INDEX idx_prompt_trans_type (transaction_type),
    INDEX idx_prompt_trans_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed with 10,000 rows using recursive CTE
INSERT INTO prompt_transactions (account_id, transaction_type, amount, description, created_at)
WITH RECURSIVE cnt AS (
    SELECT 1 AS n
    UNION ALL
    SELECT n + 1 FROM cnt WHERE n < 10000
)
SELECT
    1 + (n MOD 100) AS account_id,
    ELT(1 + (n MOD 5), 'deposit', 'withdrawal', 'transfer', 'payment', 'refund') AS transaction_type,
    ROUND((n * 7.31 MOD 10000) + 0.01, 2) AS amount,
    CONCAT('Transaction #', n) AS description,
    DATE_SUB(NOW(), INTERVAL FLOOR(n * 0.0365) DAY) AS created_at
FROM cnt;

-- =============================================================================
-- SECTION 3: Health Check Tables (for mysql_database_health_check)
-- =============================================================================

-- Sessions table for connection monitoring examples
CREATE TABLE prompt_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    token VARCHAR(64),
    expires_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_prompt_sessions_user (user_id),
    INDEX idx_prompt_sessions_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed 50 sessions
INSERT INTO prompt_sessions (user_id, token, expires_at)
WITH RECURSIVE cnt AS (
    SELECT 1 AS n
    UNION ALL
    SELECT n + 1 FROM cnt WHERE n < 50
)
SELECT
    1 + (n MOD 3),
    SHA2(CONCAT('token-', n, '-', RAND()), 256),
    DATE_ADD(NOW(), INTERVAL (n MOD 24) HOUR)
FROM cnt;

-- =============================================================================
-- SECTION 4: Backup Strategy Tables (for mysql_backup_strategy)
-- =============================================================================

-- Audit log for backup tracking examples
CREATE TABLE prompt_audit_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    table_name VARCHAR(100),
    operation VARCHAR(20),
    old_data JSON,
    new_data JSON,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    changed_by VARCHAR(100),
    INDEX idx_prompt_audit_table (table_name),
    INDEX idx_prompt_audit_time (changed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed 100 audit entries
INSERT INTO prompt_audit_log (table_name, operation, new_data, changed_by, changed_at)
WITH RECURSIVE cnt AS (
    SELECT 1 AS n
    UNION ALL
    SELECT n + 1 FROM cnt WHERE n < 100
)
SELECT
    'prompt_users',
    ELT(1 + (n MOD 3), 'INSERT', 'UPDATE', 'DELETE'),
    JSON_OBJECT('id', n, 'action', 'test'),
    'system',
    DATE_SUB(NOW(), INTERVAL (n * 15) MINUTE)
FROM cnt;

-- =============================================================================
-- SECTION 5: Event Scheduler Tables (for mysql_setup_events)
-- =============================================================================

-- Event log table (1,000 rows)
CREATE TABLE prompt_events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    payload JSON,
    event_time TIMESTAMP NOT NULL,
    INDEX idx_prompt_events_type (event_type),
    INDEX idx_prompt_events_time (event_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO prompt_events (event_type, payload, event_time)
WITH RECURSIVE cnt AS (
    SELECT 1 AS n
    UNION ALL
    SELECT n + 1 FROM cnt WHERE n < 1000
)
SELECT
    ELT(1 + (n MOD 5), 'click', 'view', 'purchase', 'signup', 'logout'),
    JSON_OBJECT('source', 'test', 'id', n),
    DATE_SUB(NOW(), INTERVAL (n * 30) MINUTE)
FROM cnt;

-- Daily reports table
CREATE TABLE prompt_daily_reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    report_date DATE NOT NULL UNIQUE,
    total_orders INT,
    revenue DECIMAL(12,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO prompt_daily_reports (report_date, total_orders, revenue)
WITH RECURSIVE cnt AS (
    SELECT 1 AS n
    UNION ALL
    SELECT n + 1 FROM cnt WHERE n < 30
)
SELECT
    DATE_SUB(CURDATE(), INTERVAL n DAY),
    20 + (n * 3 MOD 80),
    ROUND(1000 + (n * 333.33 MOD 9000), 2)
FROM cnt;

-- Weekly metrics placeholder table
CREATE TABLE prompt_weekly_metrics (
    id INT AUTO_INCREMENT PRIMARY KEY,
    week_start DATE,
    total_orders INT,
    total_revenue DECIMAL(12,2),
    avg_order_value DECIMAL(10,2)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- SECTION 6: Spatial Tables (for mysql_setup_spatial)
-- =============================================================================

CREATE TABLE prompt_locations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    latitude DECIMAL(10,6) NOT NULL,
    longitude DECIMAL(11,6) NOT NULL,
    geom POINT NOT NULL SRID 4326,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    SPATIAL INDEX idx_prompt_locations_geom (geom)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO prompt_locations (name, description, latitude, longitude, geom) VALUES
    ('San Francisco', 'Golden Gate city', 37.774900, -122.419400,
     ST_GeomFromText('POINT(-122.419400 37.774900)', 4326, 'axis-order=long-lat')),
    ('New York', 'The Big Apple', 40.712800, -74.006000,
     ST_GeomFromText('POINT(-74.006000 40.712800)', 4326, 'axis-order=long-lat')),
    ('London', 'Capital of England', 51.507400, -0.127600,
     ST_GeomFromText('POINT(-0.127600 51.507400)', 4326, 'axis-order=long-lat')),
    ('Tokyo', 'Capital of Japan', 35.689500, 139.691700,
     ST_GeomFromText('POINT(139.691700 35.689500)', 4326, 'axis-order=long-lat')),
    ('Sydney', 'Harbour city', -33.868800, 151.209300,
     ST_GeomFromText('POINT(151.209300 -33.868800)', 4326, 'axis-order=long-lat'));

-- =============================================================================
-- SECTION 7: Document Store Tables (for mysql_setup_docstore)
-- =============================================================================

CREATE TABLE prompt_documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    doc JSON NOT NULL,
    _id VARCHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE INDEX idx_prompt_docs_id (_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO prompt_documents (doc, _id) VALUES
    ('{"name": "Alice", "age": 28, "email": "alice@example.com", "active": true}', UUID()),
    ('{"name": "Bob", "age": 35, "email": "bob@example.com", "active": true}', UUID()),
    ('{"name": "Carol", "age": 42, "email": "carol@example.com", "active": false}', UUID()),
    ('{"sku": "PROD-001", "name": "Widget", "price": 29.99, "stock": 100}', UUID()),
    ('{"sku": "PROD-002", "name": "Gadget", "price": 49.99, "stock": 50}', UUID());

-- =============================================================================
-- SECTION 8: Run ANALYZE TABLE for accurate statistics
-- =============================================================================

ANALYZE TABLE prompt_users;
ANALYZE TABLE prompt_orders;
ANALYZE TABLE prompt_order_items;
ANALYZE TABLE prompt_transactions;
ANALYZE TABLE prompt_sessions;
ANALYZE TABLE prompt_audit_log;
ANALYZE TABLE prompt_events;
ANALYZE TABLE prompt_daily_reports;
ANALYZE TABLE prompt_locations;
ANALYZE TABLE prompt_documents;

-- =============================================================================
-- Summary
-- =============================================================================

SELECT
    CONCAT(
        'Prompt test seed completed. Created ',
        (SELECT COUNT(*) FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME LIKE 'prompt_%'),
        ' tables with prefix "prompt_".'
    ) AS result;

-- =============================================================================
-- Tables Created:
-- =============================================================================
-- prompt_users          - 3 rows    (Core, Query Builder, Migration)
-- prompt_orders         - 15 rows   (Core, Query Builder)
-- prompt_order_items    - 9 rows    (Core, Multi-table queries)
-- prompt_transactions   - 10K rows  (Performance Analysis, Index Tuning)
-- prompt_sessions       - 50 rows   (Health Check)
-- prompt_audit_log      - 100 rows  (Backup Strategy)
-- prompt_events         - 1K rows   (Event Scheduler)
-- prompt_daily_reports  - 30 rows   (Event Scheduler, Reporting)
-- prompt_weekly_metrics - 0 rows    (Placeholder for materialized views)
-- prompt_locations      - 5 rows    (Spatial Setup)
-- prompt_documents      - 5 rows    (Docstore Setup)
-- =============================================================================
-- TOTAL: 11 tables, ~11,217 rows
-- =============================================================================
-- Ready to test all 19 prompts:
--   - 10 no-argument prompts (complete immediately)
--   - 4 optional-argument prompts with defaults
--   - 5 required-argument prompts
-- =============================================================================
