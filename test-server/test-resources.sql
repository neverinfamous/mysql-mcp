-- =============================================================================
-- MySQL-MCP Resource Testing Seed Data
-- =============================================================================
-- This file warms up MySQL internal statistics views so that all 18 resources
-- return meaningful data. Run AFTER test-seed.sql.
--
-- Target: testdb database on mysql-final Docker container
-- Usage: Get-Content test-resources.sql -Raw | docker exec -i mysql-final mysql -uroot -proot testdb
-- =============================================================================

-- =============================================================================
-- PERFORMANCE RESOURCE: Populate performance_schema.events_statements_summary
-- =============================================================================
-- Run varied query patterns to generate digest entries
SELECT COUNT(*) FROM test_products WHERE price > 50;
SELECT * FROM test_orders WHERE status = 'pending' LIMIT 5;
SELECT p.name, SUM(o.quantity) FROM test_products p
  JOIN test_orders o ON p.id = o.product_id GROUP BY p.name;
SELECT * FROM test_measurements WHERE temperature > 25 ORDER BY measured_at DESC LIMIT 10;
SELECT COUNT(*), AVG(humidity) FROM test_measurements GROUP BY sensor_id;
SELECT category, COUNT(*), AVG(price) FROM test_products GROUP BY category;
SELECT DISTINCT customer_name FROM test_orders WHERE total_price > 100;
SELECT event_type, COUNT(*) FROM test_events GROUP BY event_type ORDER BY COUNT(*) DESC;

-- =============================================================================
-- STATUS / HEALTH RESOURCE: Warm up global status counters
-- =============================================================================
-- Buffer cache hits via sequential reads
SELECT * FROM test_products ORDER BY id;
SELECT * FROM test_orders ORDER BY id;
SELECT * FROM test_articles;
SELECT COUNT(*) FROM test_measurements;
SELECT * FROM test_users ORDER BY id;
SELECT * FROM test_categories ORDER BY id;
SELECT * FROM test_events ORDER BY id LIMIT 50;

-- =============================================================================
-- INDEXES RESOURCE: Exercise existing indexes to populate usage stats
-- =============================================================================
-- Hit various indexed columns
SELECT * FROM test_products WHERE category = 'electronics';
SELECT * FROM test_products WHERE price BETWEEN 20 AND 100;
SELECT * FROM test_orders WHERE status = 'completed';
SELECT * FROM test_orders WHERE order_date > '2026-01-20';
SELECT * FROM test_orders WHERE customer_name = 'Alice Johnson';
SELECT * FROM test_measurements WHERE sensor_id = 3;
SELECT * FROM test_measurements WHERE measured_at > '2026-01-05';
SELECT * FROM test_users WHERE email = 'john.doe@example.com';
SELECT * FROM test_users WHERE role = 'admin';
SELECT * FROM test_articles WHERE author = 'Alice Johnson';
SELECT * FROM test_events WHERE event_type = 'purchase';
SELECT * FROM test_events WHERE user_id = 1;

-- Create a redundant index for detection testing (skip if already exists)
SET @idx_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'test_orders' AND INDEX_NAME = 'idx_orders_status_dup');
SET @sql = IF(@idx_exists = 0, 'CREATE INDEX idx_orders_status_dup ON test_orders(status, order_date)', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =============================================================================
-- INNODB RESOURCE: Drive buffer pool activity
-- =============================================================================
-- Cross-join generates InnoDB buffer pool reads
SELECT COUNT(*), AVG(m1.temperature * m2.humidity)
FROM test_measurements m1
CROSS JOIN (SELECT * FROM test_measurements LIMIT 20) m2;

-- Update rows to generate InnoDB history
UPDATE test_products SET description = CONCAT(description, '') WHERE id <= 5;

-- =============================================================================
-- EVENTS RESOURCE: Create a test scheduled event
-- =============================================================================
-- Enable event scheduler if not already on
SET GLOBAL event_scheduler = ON;

-- Create a one-time test event (executes far in the future, harmless)
CREATE EVENT IF NOT EXISTS test_resource_event
  ON SCHEDULE AT CURRENT_TIMESTAMP + INTERVAL 30 DAY
  ON COMPLETION PRESERVE
  DO SELECT 1;

-- Create a recurring test event
CREATE EVENT IF NOT EXISTS test_resource_recurring
  ON SCHEDULE EVERY 1 DAY
  STARTS CURRENT_TIMESTAMP + INTERVAL 1 DAY
  ON COMPLETION PRESERVE
  DISABLE
  DO SELECT 1;

-- =============================================================================
-- SYSSCHEMA RESOURCE: Generate activity for sys schema views
-- =============================================================================
-- Run queries that will appear in sys.statements_with_runtimes_in_95th_percentile
SELECT SQL_NO_CACHE * FROM test_measurements ORDER BY temperature DESC;
SELECT SQL_NO_CACHE * FROM test_events WHERE event_type = 'search' ORDER BY event_date;
SELECT SQL_NO_CACHE p.name, COUNT(o.id) as order_count, SUM(o.total_price) as revenue
FROM test_products p
LEFT JOIN test_orders o ON p.id = o.product_id
GROUP BY p.name
ORDER BY revenue DESC;

-- =============================================================================
-- LOCKS RESOURCE: No seed needed
-- =============================================================================
-- Lock contention requires concurrent transactions; resource gracefully
-- returns empty lock_waits array and lock statistics from SHOW STATUS.

-- =============================================================================
-- REPLICATION RESOURCE: No seed needed
-- =============================================================================
-- Queries binlog status and replica info — available on mysql-final by default.

-- =============================================================================
-- CLUSTER RESOURCE: No seed needed
-- =============================================================================
-- Queries Group Replication — returns "not configured" on standalone mysql-final.
-- Meaningful results only on mysql-node1 (port 3307) with InnoDB Cluster.

-- =============================================================================
-- SPATIAL RESOURCE: Already seeded
-- =============================================================================
-- test_locations has 15 POINT rows with SPATIAL INDEX — no additional seed needed.

-- =============================================================================
-- DOCSTORE RESOURCE: Already seeded
-- =============================================================================
-- test_documents has doc (JSON) + _id columns — detected as X DevAPI collections.

-- =============================================================================
-- SCHEMA, TABLES, VARIABLES, PROCESSLIST, POOL, CAPABILITIES:
-- =============================================================================
-- These resources query SHOW commands, information_schema, or internal pool
-- state — they return meaningful data with no additional seeding.

-- =============================================================================
-- Run ANALYZE TABLE to update optimizer statistics
-- =============================================================================
ANALYZE TABLE test_products;
ANALYZE TABLE test_orders;
ANALYZE TABLE test_json_docs;
ANALYZE TABLE test_articles;
ANALYZE TABLE test_users;
ANALYZE TABLE test_measurements;
ANALYZE TABLE test_locations;
ANALYZE TABLE test_categories;
ANALYZE TABLE test_events;
ANALYZE TABLE test_documents;
ANALYZE TABLE test_partitioned;

-- Completion
SELECT 'Resource test seed completed successfully' AS result;
