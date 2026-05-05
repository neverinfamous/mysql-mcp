-- =============================================================================
-- MySQL-MCP Test Database - Seed Data
-- =============================================================================
-- This file creates all test tables needed for comprehensive testing of
-- the mysql-mcp MCP server's 24 tool groups (191 tools).
--
-- Target: testdb database on mysql-final Docker container
-- Usage: mysql -h localhost -u root -proot testdb < test-seed.sql
-- =============================================================================

-- =============================================================================
-- CLEANUP: Drop existing test tables
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS test_products;
DROP TABLE IF EXISTS test_orders;
DROP TABLE IF EXISTS test_json_docs;
DROP TABLE IF EXISTS test_articles;
DROP TABLE IF EXISTS test_users;
DROP TABLE IF EXISTS test_measurements;
DROP TABLE IF EXISTS test_locations;
DROP TABLE IF EXISTS test_categories;
DROP TABLE IF EXISTS test_events;
DROP TABLE IF EXISTS test_documents;
DROP TABLE IF EXISTS test_partitioned;
DROP TABLE IF EXISTS temp_write_test;

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- CORE + STATS: Products and Orders
-- =============================================================================

CREATE TABLE test_products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2),
    category VARCHAR(100),
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_products_category (category),
    INDEX idx_products_price (price)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO test_products (name, description, price, category, metadata) VALUES
    ('Laptop Pro 15', 'High-performance laptop with 15-inch display', 1299.99, 'electronics', '{"brand": "TechCorp", "warranty": 24}'),
    ('Wireless Mouse', 'Ergonomic wireless mouse with precision tracking', 49.99, 'electronics', '{"brand": "PeripheralPro", "wireless": true}'),
    ('USB-C Hub', 'Multi-port USB-C hub with HDMI and USB 3.0', 79.99, 'electronics', '{"ports": 7, "hdmi": true}'),
    ('Mechanical Keyboard', 'RGB mechanical keyboard with Cherry MX switches', 149.99, 'electronics', '{"switches": "Cherry MX Blue", "rgb": true}'),
    ('Monitor Stand', 'Adjustable aluminum monitor stand', 89.99, 'accessories', '{"material": "aluminum", "adjustable": true}'),
    ('Webcam HD', '1080p HD webcam with autofocus', 69.99, 'electronics', '{"resolution": "1080p", "autofocus": true}'),
    ('Desk Lamp', 'LED desk lamp with adjustable brightness', 45.99, 'accessories', '{"lumens": 800, "dimmable": true}'),
    ('Notebook Pack', 'Pack of 3 lined notebooks', 12.99, 'office', '{"count": 3, "pages": 100}'),
    ('Pen Set', 'Premium ballpoint pen set', 24.99, 'office', '{"count": 5, "type": "ballpoint"}'),
    ('Cable Organizer', 'Silicone cable management clips', 9.99, 'accessories', '{"material": "silicone", "count": 10}'),
    ('Headphones Pro', 'Noise-cancelling over-ear headphones', 299.99, 'electronics', '{"anc": true, "battery_hours": 30}'),
    ('Mouse Pad XL', 'Extra large gaming mouse pad', 29.99, 'accessories', '{"size": "XL", "material": "cloth"}'),
    ('Phone Stand', 'Aluminum phone and tablet stand', 34.99, 'accessories', '{"material": "aluminum", "foldable": true}'),
    ('Desk Mat', 'Leather desk mat 80x40cm', 59.99, 'accessories', '{"material": "leather", "size": "80x40"}'),
    ('Power Strip', 'Surge protector with 6 outlets and USB', 39.99, 'electronics', '{"outlets": 6, "usb_ports": 2}'),
    ('Café Décor Light', 'Elegant café-style accent lamp with résumé holder', 89.99, 'accessories', '{"style": "vintage", "bulb_type": "LED"}');

CREATE TABLE test_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT,
    customer_name VARCHAR(255),
    quantity INT,
    total_price DECIMAL(10,2),
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('pending', 'shipped', 'completed', 'cancelled') DEFAULT 'pending',
    notes JSON,
    FOREIGN KEY (product_id) REFERENCES test_products(id) ON DELETE SET NULL,
    INDEX idx_orders_status (status),
    INDEX idx_orders_date (order_date),
    INDEX idx_orders_customer (customer_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO test_orders (product_id, customer_name, quantity, total_price, status, order_date, notes) VALUES
    (1, 'Alice Johnson', 1, 1299.99, 'completed', '2026-01-15 10:30:00', '{"gift_wrap": false}'),
    (2, 'Bob Smith', 2, 99.98, 'completed', '2026-01-15 11:45:00', '{"priority": "standard"}'),
    (3, 'Carol White', 1, 79.99, 'shipped', '2026-01-16 09:15:00', '{"tracking": "TRK001"}'),
    (4, 'David Brown', 1, 149.99, 'pending', '2026-01-17 14:20:00', NULL),
    (11, 'Eve Davis', 1, 299.99, 'completed', '2026-01-17 16:00:00', '{"gift_wrap": true}'),
    (5, 'Frank Miller', 2, 179.98, 'shipped', '2026-01-18 08:30:00', '{"tracking": "TRK002"}'),
    (6, 'Grace Wilson', 1, 69.99, 'pending', '2026-01-19 13:45:00', NULL),
    (1, 'Henry Taylor', 1, 1299.99, 'completed', '2026-01-20 10:00:00', '{"corporate": true}'),
    (7, 'Ivy Anderson', 3, 137.97, 'completed', '2026-01-20 15:30:00', '{"bulk_order": true}'),
    (2, 'Jack Thomas', 1, 49.99, 'shipped', '2026-01-21 09:00:00', '{"tracking": "TRK003"}'),
    (8, 'Karen Martinez', 5, 64.95, 'pending', '2026-01-22 11:20:00', '{"back_to_school": true}'),
    (9, 'Leo Garcia', 2, 49.98, 'completed', '2026-01-22 14:10:00', NULL),
    (10, 'Mia Robinson', 10, 99.90, 'shipped', '2026-01-23 08:45:00', '{"wholesale": true}'),
    (12, 'Noah Clark', 1, 29.99, 'pending', '2026-01-24 10:30:00', NULL),
    (13, 'Olivia Lewis', 1, 34.99, 'completed', '2026-01-24 16:15:00', '{"gift_wrap": true}'),
    (14, 'Peter Hall', 1, 59.99, 'shipped', '2026-01-25 09:30:00', '{"tracking": "TRK004"}'),
    (15, 'Quinn Young', 2, 79.98, 'pending', '2026-01-26 11:00:00', NULL),
    (4, 'Rachel King', 1, 149.99, 'completed', '2026-01-27 13:20:00', '{"loyalty_member": true}'),
    (11, 'Sam Wright', 1, 299.99, 'shipped', '2026-01-28 15:45:00', '{"tracking": "TRK005"}'),
    (3, 'Tina Scott', 2, 159.98, 'pending', '2026-01-29 10:15:00', NULL);

-- =============================================================================
-- JSON: Document Storage with JSON (17 tools)
-- =============================================================================

CREATE TABLE test_json_docs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    doc JSON NOT NULL,
    metadata JSON,
    tags JSON DEFAULT ('[]'),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_json_docs_type ((CAST(doc->>'$.type' AS CHAR(50))))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO test_json_docs (doc, metadata, tags) VALUES
    ('{"type": "article", "title": "Getting Started with MySQL", "author": "Alice", "views": 1250, "rating": 4.5}',
     '{"source": "blog", "language": "en", "version": 1}',
     '["database", "tutorial", "beginner"]'),
    ('{"type": "article", "title": "Advanced JSON Operations", "author": "Bob", "views": 890, "rating": 4.8}',
     '{"source": "docs", "language": "en", "version": 2}',
     '["json", "advanced", "mysql"]'),
    ('{"type": "video", "title": "MCP Protocol Deep Dive", "author": "Carol", "duration": 3600, "views": 5400}',
     '{"source": "youtube", "language": "en", "quality": "1080p"}',
     '["mcp", "protocol", "ai"]'),
    ('{"type": "article", "title": "Full-Text Search Guide", "author": "David", "views": 670, "rating": 4.2, "nested": {"level1": {"level2": "deep value"}}}',
     '{"source": "wiki", "language": "en", "version": 1}',
     '["fulltext", "search", "indexing"]'),
    ('{"type": "podcast", "title": "Database Performance Tips", "author": "Eve", "duration": 2700, "episodes": 12}',
     '{"source": "spotify", "language": "en", "subscribers": 15000}',
     '["performance", "tips", "podcast"]'),
    ('{"type": "article", "title": "Spatial Data Fundamentals", "author": "Frank", "views": 2100, "rating": 4.7}',
     '{"source": "medium", "language": "en", "version": 3}',
     '["spatial", "gis", "geometry"]'),
    ('{"type": "tutorial", "title": "MySQL Replication Setup", "author": "Grace", "views": 1500, "rating": 4.3}',
     '{"source": "blog", "language": "en", "version": 2}',
     '["replication", "cluster", "ha"]'),
    ('{"type": "article", "title": "Event Scheduler Deep Dive", "author": "Henry", "views": 980, "rating": 4.6}',
     '{"source": "docs", "language": "en", "version": 1}',
     '["events", "scheduler", "automation"]');

-- =============================================================================
-- TEXT + FULLTEXT: Article Content (4 fulltext + 6 text tools)
-- =============================================================================

CREATE TABLE test_articles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    author VARCHAR(100),
    category VARCHAR(50),
    published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FULLTEXT INDEX ft_articles (title, body),
    INDEX idx_articles_author (author),
    INDEX idx_articles_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO test_articles (title, body, author, category) VALUES
    ('Introduction to MySQL', 
     'MySQL is the world''s most popular open source database. It powers many web applications and is known for its reliability, performance, and ease of use. MySQL reads and writes directly to disk files, making it incredibly fast and efficient.',
     'Alice Johnson', 'database'),
    ('Understanding Full-Text Search',
     'Full-text search (FTS) enables searching for words and phrases within text content. MySQL provides powerful full-text search capabilities with MATCH AGAINST syntax, supporting natural language mode and boolean mode. FTS is essential for applications requiring fast text search capabilities.',
     'Bob Smith', 'search'),
    ('The Model Context Protocol Explained',
     'The Model Context Protocol (MCP) is an open standard that enables AI assistants to interact with external data sources and tools. MCP provides a standardized way for AI models to access databases, APIs, and other services while maintaining security and privacy.',
     'Carol White', 'ai'),
    ('JSON in Modern Databases',
     'Modern databases increasingly support JSON as a first-class data type. JSON enables flexible schema design and is perfect for storing semi-structured data. MySQL provides comprehensive JSON functions including extraction, modification, and validation capabilities.',
     'David Brown', 'database'),
    ('Spatial Data and GIS Operations',
     'Spatial data represents geographic information as points, lines, and polygons. MySQL supports spatial data types and functions for calculating distances, checking containment, and finding nearest neighbors. This is essential for location-based applications.',
     'Eve Davis', 'gis'),
    ('Database Performance Optimization',
     'Optimizing database performance requires understanding query execution plans, proper indexing strategies, and efficient schema design. Key techniques include using appropriate indexes, avoiding unnecessary joins, and leveraging query caching.',
     'Frank Miller', 'performance'),
    ('Building RESTful APIs with MySQL',
     'MySQL is an excellent choice for API backends. Its robust ACID compliance ensures data integrity, while connection pooling enables efficient concurrent access. Combined with modern frameworks, MySQL enables rapid API development.',
     'Grace Wilson', 'development'),
    ('Data Analysis with Statistical Functions',
     'Statistical analysis of database content reveals patterns and insights. Common operations include calculating averages, standard deviations, percentiles, and correlations. These metrics help understand data distributions and identify outliers.',
     'Henry Taylor', 'analytics'),
    ('MySQL Replication Strategies',
     'Replication enables data redundancy and read scaling. MySQL supports asynchronous, semi-synchronous, and group replication modes. Understanding replication lag, binary logs, and failover is essential for high availability.',
     'Ivy Anderson', 'replication'),
    ('Event Scheduler Automation',
     'The Event Scheduler automates recurring database tasks. Events can be scheduled to run once or repeatedly at specified intervals. Common uses include data cleanup, report generation, and maintenance operations.',
     'Jack Thomas', 'automation');

-- =============================================================================
-- TEXT: User Data with Various Patterns (text + security tools)
-- =============================================================================

CREATE TABLE test_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    bio TEXT,
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_users_email (email),
    INDEX idx_users_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO test_users (username, email, phone, bio, role) VALUES
    ('johndoe', 'john.doe@example.com', '+1-555-0101', 'Software developer passionate about databases and AI.', 'admin'),
    ('janesmith', 'jane.smith@company.org', '+1-555-0102', 'Data scientist specializing in machine learning.', 'analyst'),
    ('bobwilson', 'bob.wilson@startup.io', '+44-20-7123-4567', 'Full-stack developer and open source contributor.', 'developer'),
    ('alicechen', 'alice.chen@university.edu', '+1-555-0104', 'PhD researcher in natural language processing.', 'researcher'),
    ('mikebrown', 'mike.brown@tech.co', NULL, 'DevOps engineer focused on infrastructure automation.', 'admin'),
    ('sarahlee', 'sarah.lee@design.studio', '+1-555-0106', 'UX designer creating intuitive user experiences.', 'designer'),
    ('davidkim', 'david.kim@finance.com', '+82-2-1234-5678', 'Quantitative analyst building trading algorithms.', 'analyst'),
    ('emmagarcia', 'emma.garcia@healthcare.org', '+1-555-0108', 'Health informatics specialist improving patient care.', 'user'),
    ('testuser', 'test.user@gmail.com', '+1-555-0109', 'QA engineer testing regex patterns and text tools.', 'tester'),
    ('adminuser', 'admin@example.com', '+1-555-0110', 'System administrator with full access.', 'admin');

-- =============================================================================
-- STATS: Sensor Measurements (stats tools - 200 rows)
-- =============================================================================

CREATE TABLE test_measurements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sensor_id INT NOT NULL,
    temperature DECIMAL(5,2),
    humidity DECIMAL(5,2),
    pressure DECIMAL(7,2),
    measured_at TIMESTAMP NOT NULL,
    INDEX idx_measurements_sensor (sensor_id),
    INDEX idx_measurements_time (measured_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Generate 200 measurement records with realistic sensor data
INSERT INTO test_measurements (sensor_id, temperature, humidity, pressure, measured_at)
WITH RECURSIVE cnt AS (
    SELECT 0 AS n
    UNION ALL
    SELECT n + 1 FROM cnt WHERE n < 199
)
SELECT 
    1 + (n MOD 5) AS sensor_id,
    20.0 + (n * 0.731 MOD 15) + (n * 0.113 MOD 3) AS temperature,
    40.0 + (n * 0.919 MOD 40) AS humidity,
    1000.0 + (n * 0.557 MOD 50) AS pressure,
    DATE_ADD('2026-01-01 00:00:00', INTERVAL n HOUR) AS measured_at
FROM cnt;

-- =============================================================================
-- SPATIAL: Location Points with Geometry (spatial tools - 12)
-- =============================================================================

CREATE TABLE test_locations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    city VARCHAR(100),
    latitude DECIMAL(10,6) NOT NULL,
    longitude DECIMAL(11,6) NOT NULL,
    geom POINT NOT NULL SRID 4326,
    type VARCHAR(50),
    SPATIAL INDEX idx_locations_geom (geom),
    INDEX idx_locations_city (city),
    INDEX idx_locations_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO test_locations (name, city, latitude, longitude, geom, type) VALUES
    ('Central Park', 'New York', 40.782900, -73.965400, ST_GeomFromText('POINT(-73.965400 40.782900)', 4326, 'axis-order=long-lat'), 'park'),
    ('Empire State Building', 'New York', 40.748400, -73.985700, ST_GeomFromText('POINT(-73.985700 40.748400)', 4326, 'axis-order=long-lat'), 'landmark'),
    ('Times Square', 'New York', 40.758000, -73.985500, ST_GeomFromText('POINT(-73.985500 40.758000)', 4326, 'axis-order=long-lat'), 'attraction'),
    ('Eiffel Tower', 'Paris', 48.858400, 2.294500, ST_GeomFromText('POINT(2.294500 48.858400)', 4326, 'axis-order=long-lat'), 'landmark'),
    ('Louvre Museum', 'Paris', 48.860600, 2.337600, ST_GeomFromText('POINT(2.337600 48.860600)', 4326, 'axis-order=long-lat'), 'museum'),
    ('Notre-Dame', 'Paris', 48.853000, 2.349900, ST_GeomFromText('POINT(2.349900 48.853000)', 4326, 'axis-order=long-lat'), 'landmark'),
    ('Big Ben', 'London', 51.500700, -0.124600, ST_GeomFromText('POINT(-0.124600 51.500700)', 4326, 'axis-order=long-lat'), 'landmark'),
    ('Tower Bridge', 'London', 51.505500, -0.075400, ST_GeomFromText('POINT(-0.075400 51.505500)', 4326, 'axis-order=long-lat'), 'landmark'),
    ('Buckingham Palace', 'London', 51.501400, -0.141900, ST_GeomFromText('POINT(-0.141900 51.501400)', 4326, 'axis-order=long-lat'), 'landmark'),
    ('Tokyo Tower', 'Tokyo', 35.658600, 139.745400, ST_GeomFromText('POINT(139.745400 35.658600)', 4326, 'axis-order=long-lat'), 'landmark'),
    ('Shibuya Crossing', 'Tokyo', 35.659500, 139.700400, ST_GeomFromText('POINT(139.700400 35.659500)', 4326, 'axis-order=long-lat'), 'attraction'),
    ('Senso-ji Temple', 'Tokyo', 35.714800, 139.796700, ST_GeomFromText('POINT(139.796700 35.714800)', 4326, 'axis-order=long-lat'), 'temple'),
    ('Sydney Opera House', 'Sydney', -33.856800, 151.215300, ST_GeomFromText('POINT(151.215300 -33.856800)', 4326, 'axis-order=long-lat'), 'landmark'),
    ('Harbour Bridge', 'Sydney', -33.852300, 151.210800, ST_GeomFromText('POINT(151.210800 -33.852300)', 4326, 'axis-order=long-lat'), 'landmark'),
    ('Golden Gate Bridge', 'San Francisco', 37.819900, -122.478300, ST_GeomFromText('POINT(-122.478300 37.819900)', 4326, 'axis-order=long-lat'), 'landmark');

-- =============================================================================
-- TEXT: Hierarchical Categories (for path-based queries)
-- =============================================================================

CREATE TABLE test_categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    path VARCHAR(255) NOT NULL,
    level INT NOT NULL,
    INDEX idx_categories_path (path),
    INDEX idx_categories_level (level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO test_categories (name, path, level) VALUES
    ('Electronics', 'electronics', 1),
    ('Computers', 'electronics.computers', 2),
    ('Laptops', 'electronics.computers.laptops', 3),
    ('Desktops', 'electronics.computers.desktops', 3),
    ('Phones', 'electronics.phones', 2),
    ('Smartphones', 'electronics.phones.smartphones', 3),
    ('Feature Phones', 'electronics.phones.feature', 3),
    ('Accessories', 'electronics.accessories', 2),
    ('Clothing', 'clothing', 1),
    ('Mens', 'clothing.mens', 2),
    ('Shirts', 'clothing.mens.shirts', 3),
    ('Pants', 'clothing.mens.pants', 3),
    ('Womens', 'clothing.womens', 2),
    ('Dresses', 'clothing.womens.dresses', 3),
    ('Home', 'home', 1),
    ('Kitchen', 'home.kitchen', 2),
    ('Appliances', 'home.kitchen.appliances', 3);

-- =============================================================================
-- STATS + ADMIN + EVENTS: Event Logs (100 rows)
-- =============================================================================

CREATE TABLE test_events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    event_type ENUM('page_view', 'click', 'purchase', 'login', 'search') NOT NULL,
    user_id INT NOT NULL,
    payload JSON,
    event_date TIMESTAMP NOT NULL,
    INDEX idx_events_type (event_type),
    INDEX idx_events_user (user_id),
    INDEX idx_events_date (event_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Generate 100 event records
INSERT INTO test_events (event_type, user_id, payload, event_date)
WITH RECURSIVE cnt AS (
    SELECT 0 AS n
    UNION ALL
    SELECT n + 1 FROM cnt WHERE n < 99
)
SELECT 
    CASE n MOD 5
        WHEN 0 THEN 'page_view'
        WHEN 1 THEN 'click'
        WHEN 2 THEN 'purchase'
        WHEN 3 THEN 'login'
        WHEN 4 THEN 'search'
    END AS event_type,
    1 + (n MOD 8) AS user_id,
    JSON_OBJECT(
        'page', CASE n MOD 4
            WHEN 0 THEN 'home'
            WHEN 1 THEN 'products'
            WHEN 2 THEN 'cart'
            WHEN 3 THEN 'checkout'
        END,
        'session', CONCAT('sess_', 1000 + n)
    ) AS payload,
    DATE_ADD('2026-01-01 00:00:00', INTERVAL (n * 2) HOUR) AS event_date
FROM cnt;

-- =============================================================================
-- DOCSTORE: Document Store Collections (docstore tools - 9)
-- =============================================================================

CREATE TABLE test_documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    collection_name VARCHAR(100) NOT NULL,
    doc JSON NOT NULL,
    _id VARCHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE INDEX idx_documents_collection_id (collection_name, _id),
    INDEX idx_documents_collection (collection_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO test_documents (collection_name, doc, _id) VALUES
    ('users', '{"name": "Alice", "age": 28, "email": "alice@example.com", "active": true}', UUID()),
    ('users', '{"name": "Bob", "age": 35, "email": "bob@example.com", "active": true}', UUID()),
    ('users', '{"name": "Carol", "age": 42, "email": "carol@example.com", "active": false}', UUID()),
    ('products', '{"sku": "PROD-001", "name": "Widget", "price": 29.99, "stock": 100}', UUID()),
    ('products', '{"sku": "PROD-002", "name": "Gadget", "price": 49.99, "stock": 50}', UUID()),
    ('products', '{"sku": "PROD-003", "name": "Gizmo", "price": 19.99, "stock": 200}', UUID()),
    ('orders', '{"order_id": "ORD-001", "user": "Alice", "total": 79.98, "status": "shipped"}', UUID()),
    ('orders', '{"order_id": "ORD-002", "user": "Bob", "total": 49.99, "status": "pending"}', UUID()),
    ('logs', '{"level": "info", "message": "Server started", "timestamp": "2026-01-01T00:00:00Z"}', UUID()),
    ('logs', '{"level": "error", "message": "Connection failed", "timestamp": "2026-01-01T01:30:00Z"}', UUID());

-- =============================================================================
-- PARTITIONING: Partitioned Table (partitioning tools - 4)
-- =============================================================================

CREATE TABLE test_partitioned (
    id INT AUTO_INCREMENT,
    region VARCHAR(20) NOT NULL,
    created_at DATE NOT NULL,
    data JSON,
    PRIMARY KEY (id, region)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
PARTITION BY LIST COLUMNS(region) (
    PARTITION p_east VALUES IN ('east', 'northeast'),
    PARTITION p_west VALUES IN ('west', 'northwest'),
    PARTITION p_central VALUES IN ('central', 'midwest'),
    PARTITION p_south VALUES IN ('south', 'southeast')
);

INSERT INTO test_partitioned (region, created_at, data) VALUES
    ('east', '2026-01-01', '{"store": "NYC-001", "sales": 15000}'),
    ('east', '2026-01-02', '{"store": "NYC-002", "sales": 12500}'),
    ('northeast', '2026-01-01', '{"store": "BOS-001", "sales": 8900}'),
    ('west', '2026-01-01', '{"store": "LA-001", "sales": 22000}'),
    ('west', '2026-01-02', '{"store": "LA-002", "sales": 18500}'),
    ('northwest', '2026-01-01', '{"store": "SEA-001", "sales": 9800}'),
    ('central', '2026-01-01', '{"store": "CHI-001", "sales": 17500}'),
    ('midwest', '2026-01-01', '{"store": "DET-001", "sales": 7200}'),
    ('south', '2026-01-01', '{"store": "ATL-001", "sales": 14300}'),
    ('southeast', '2026-01-01', '{"store": "MIA-001", "sales": 11800}');

-- Add more rows for better partition testing
INSERT INTO test_partitioned (region, created_at, data)
SELECT 
    CASE (id MOD 8)
        WHEN 0 THEN 'east'
        WHEN 1 THEN 'northeast'
        WHEN 2 THEN 'west'
        WHEN 3 THEN 'northwest'
        WHEN 4 THEN 'central'
        WHEN 5 THEN 'midwest'
        WHEN 6 THEN 'south'
        WHEN 7 THEN 'southeast'
    END AS region,
    DATE_ADD('2026-01-03', INTERVAL (id MOD 28) DAY) AS created_at,
    JSON_OBJECT('store', CONCAT('STORE-', id), 'sales', 5000 + (id * 100)) AS data
FROM test_products
LIMIT 40;

-- =============================================================================
-- CORE: Temporary Table for Write Operation Testing
-- =============================================================================

CREATE TABLE temp_write_test (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100),
    description TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO temp_write_test (name, description) VALUES
    ('hello world', 'A simple greeting'),
    ('world peace', 'A noble goal'),
    ('goodbye world', 'A farewell message'),
    ('new world order', 'A controversial phrase'),
    ('world champion', 'A title of achievement');

-- =============================================================================
-- Summary: Test Tables Created
-- =============================================================================
-- test_products      - 16 rows  (Core, Stats, JSON)
-- test_orders        - 20 rows  (Core, Stats, Transactions)
-- test_json_docs     - 8 rows   (JSON - 17 tools)
-- test_articles      - 10 rows  (Text, Fulltext - with FULLTEXT INDEX)
-- test_users         - 10 rows  (Text, Core, Security)
-- test_measurements  - 200 rows (Stats - 8 tools)
-- test_locations     - 15 rows  (Spatial - 12 tools, with POINT geometry)
-- test_categories    - 17 rows  (Text)
-- test_events        - 100 rows (Stats, Admin, Events)
-- test_documents     - 10 rows  (DocStore - 9 tools)
-- test_partitioned   - 50 rows  (Partitioning - 4 tools)
-- temp_write_test    - 5 rows   (Core writes)
-- =============================================================================
-- TOTAL: 12 tables, ~461 rows
-- =============================================================================
