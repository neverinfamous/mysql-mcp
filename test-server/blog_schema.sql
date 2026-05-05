-- ============================================================================
-- Blog System Schema with Posts, Categories, Tags, Authors, and Comments
-- ============================================================================
-- Engine: InnoDB (for transactions and foreign key support)
-- Charset: utf8mb4 (full Unicode support)
-- ============================================================================

-- Create database
CREATE DATABASE IF NOT EXISTS blog_system
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE blog_system;

-- ============================================================================
-- 1. AUTHORS TABLE
-- ============================================================================
-- Stores information about blog post authors
CREATE TABLE authors (
    author_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    username VARCHAR(100) NOT NULL UNIQUE COMMENT 'Unique username',
    email VARCHAR(255) NOT NULL UNIQUE COMMENT 'Unique email address',
    full_name VARCHAR(255) NOT NULL COMMENT 'Author full name',
    bio TEXT COMMENT 'Short biography',
    avatar_url VARCHAR(500) COMMENT 'Profile picture URL',
    is_active BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'Account active status',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    PRIMARY KEY (author_id),
    UNIQUE KEY uk_username (username),
    UNIQUE KEY uk_email (email),
    KEY idx_is_active (is_active),
    KEY idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Authors/contributors for blog posts';


-- ============================================================================
-- 2. CATEGORIES TABLE
-- ============================================================================
-- Stores blog post categories
CREATE TABLE categories (
    category_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL UNIQUE COMMENT 'Category name',
    slug VARCHAR(100) NOT NULL UNIQUE COMMENT 'URL-friendly slug',
    description TEXT COMMENT 'Category description',
    icon_url VARCHAR(500) COMMENT 'Category icon URL',
    display_order INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Display order',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    PRIMARY KEY (category_id),
    UNIQUE KEY uk_name (name),
    UNIQUE KEY uk_slug (slug),
    KEY idx_display_order (display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Blog post categories';


-- ============================================================================
-- 3. TAGS TABLE
-- ============================================================================
-- Stores blog post tags
CREATE TABLE tags (
    tag_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL UNIQUE COMMENT 'Tag name',
    slug VARCHAR(100) NOT NULL UNIQUE COMMENT 'URL-friendly slug',
    description TEXT COMMENT 'Tag description',
    color_hex VARCHAR(7) COMMENT 'Display color (hex)',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    PRIMARY KEY (tag_id),
    UNIQUE KEY uk_name (name),
    UNIQUE KEY uk_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Blog post tags';


-- ============================================================================
-- 4. POSTS TABLE
-- ============================================================================
-- Main blog posts table with full-text search support
CREATE TABLE posts (
    post_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    author_id BIGINT UNSIGNED NOT NULL COMMENT 'Post author',
    category_id BIGINT UNSIGNED NOT NULL COMMENT 'Primary category',
    title VARCHAR(300) NOT NULL COMMENT 'Post title',
    slug VARCHAR(300) NOT NULL UNIQUE COMMENT 'URL-friendly slug',
    excerpt VARCHAR(500) COMMENT 'Short excerpt for listings',
    content LONGTEXT NOT NULL COMMENT 'Full post content',
    featured_image_url VARCHAR(500) COMMENT 'Featured image URL',
    
    -- Status and visibility
    status ENUM('draft', 'scheduled', 'published', 'archived') NOT NULL DEFAULT 'draft'
        COMMENT 'Publication status',
    is_featured BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Featured post flag',
    allow_comments BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'Enable comments',
    
    -- SEO and metadata
    meta_description VARCHAR(160) COMMENT 'SEO meta description',
    meta_keywords VARCHAR(255) COMMENT 'SEO keywords',
    reading_time_minutes INT UNSIGNED COMMENT 'Estimated reading time',
    
    -- JSON column for flexible metadata
    metadata JSON COMMENT 'Additional flexible metadata (e.g., custom fields)',
    
    -- View tracking
    view_count BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Number of views',
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    published_at TIMESTAMP NULL COMMENT 'When post was published',
    
    PRIMARY KEY (post_id),
    UNIQUE KEY uk_slug (slug),
    
    -- Foreign key relationships
    CONSTRAINT fk_posts_author FOREIGN KEY (author_id) 
        REFERENCES authors(author_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_posts_category FOREIGN KEY (category_id) 
        REFERENCES categories(category_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    
    -- Indexes for common queries
    KEY idx_author_id (author_id),
    KEY idx_category_id (category_id),
    KEY idx_status (status),
    KEY idx_is_featured (is_featured),
    KEY idx_created_at (created_at),
    KEY idx_published_at (published_at),
    KEY idx_status_published_at (status, published_at),
    
    -- Full-text search index on title, excerpt, and content
    FULLTEXT KEY ft_content (title, excerpt, content)
        WITH PARSER ngram COMMENT 'Full-text search index for blog content'
        
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Blog posts with full-text search capability';


-- ============================================================================
-- 5. POST_TAGS JUNCTION TABLE
-- ============================================================================
-- Many-to-many relationship between posts and tags
CREATE TABLE post_tags (
    post_id BIGINT UNSIGNED NOT NULL,
    tag_id BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (post_id, tag_id),
    
    CONSTRAINT fk_post_tags_post FOREIGN KEY (post_id) 
        REFERENCES posts(post_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_post_tags_tag FOREIGN KEY (tag_id) 
        REFERENCES tags(tag_id) ON DELETE CASCADE ON UPDATE CASCADE,
    
    -- Index for reverse lookups (find posts by tag)
    KEY idx_tag_id (tag_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Many-to-many relationship: posts to tags';


-- ============================================================================
-- 6. COMMENTS TABLE
-- ============================================================================
-- Blog post comments with nested reply support
CREATE TABLE comments (
    comment_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    post_id BIGINT UNSIGNED NOT NULL COMMENT 'Parent post',
    parent_comment_id BIGINT UNSIGNED COMMENT 'Parent comment for replies (null for top-level)',
    author_id BIGINT UNSIGNED COMMENT 'Author ID if logged in (null for guests)',
    author_name VARCHAR(100) NOT NULL COMMENT 'Comment author name',
    author_email VARCHAR(255) NOT NULL COMMENT 'Comment author email',
    author_url VARCHAR(500) COMMENT 'Comment author website',
    
    content TEXT NOT NULL COMMENT 'Comment text',
    
    status ENUM('pending', 'approved', 'spam', 'trash') NOT NULL DEFAULT 'pending'
        COMMENT 'Moderation status',
    
    ip_address VARCHAR(45) COMMENT 'Commenter IP address (IPv4 or IPv6)',
    user_agent VARCHAR(500) COMMENT 'Browser user agent',
    
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    PRIMARY KEY (comment_id),
    
    CONSTRAINT fk_comments_post FOREIGN KEY (post_id) 
        REFERENCES posts(post_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_comments_parent FOREIGN KEY (parent_comment_id) 
        REFERENCES comments(comment_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_comments_author FOREIGN KEY (author_id) 
        REFERENCES authors(author_id) ON DELETE SET NULL ON UPDATE CASCADE,
    
    -- Indexes for common queries
    KEY idx_post_id (post_id),
    KEY idx_parent_comment_id (parent_comment_id),
    KEY idx_author_id (author_id),
    KEY idx_status (status),
    KEY idx_created_at (created_at),
    KEY idx_post_status_created (post_id, status, created_at)
        COMMENT 'Optimized for fetching approved comments by post'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Blog post comments with nested replies';


-- ============================================================================
-- 7. SCHEMA STATISTICS TABLE (Optional)
-- ============================================================================
-- Track post engagement metrics
CREATE TABLE post_statistics (
    stat_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    post_id BIGINT UNSIGNED NOT NULL UNIQUE,
    total_views BIGINT UNSIGNED NOT NULL DEFAULT 0,
    total_comments BIGINT UNSIGNED NOT NULL DEFAULT 0,
    total_shares BIGINT UNSIGNED NOT NULL DEFAULT 0,
    average_rating DECIMAL(3,2) COMMENT 'Average rating 0-5',
    unique_visitors BIGINT UNSIGNED NOT NULL DEFAULT 0,
    last_viewed_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    PRIMARY KEY (stat_id),
    
    CONSTRAINT fk_post_stats_post FOREIGN KEY (post_id) 
        REFERENCES posts(post_id) ON DELETE CASCADE ON UPDATE CASCADE,
    
    KEY idx_total_views (total_views),
    KEY idx_average_rating (average_rating)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Aggregated statistics for blog posts';


-- ============================================================================
-- SAMPLE INSERT STATEMENTS
-- ============================================================================

-- Insert Authors
INSERT INTO authors (username, email, full_name, bio, is_active) VALUES
('john_doe', 'john@example.com', 'John Doe', 'Senior software architect with 15 years experience', TRUE),
('jane_smith', 'jane@example.com', 'Jane Smith', 'Cloud infrastructure specialist', TRUE),
('bob_wilson', 'bob@example.com', 'Bob Wilson', 'Database performance expert', TRUE);

-- Insert Categories
INSERT INTO categories (name, slug, description, display_order) VALUES
('Technology', 'technology', 'Articles about technology and software development', 1),
('Database', 'database', 'Database design, optimization, and best practices', 2),
('DevOps', 'devops', 'DevOps tools, practices, and infrastructure', 3),
('Performance', 'performance', 'Performance optimization techniques', 4);

-- Insert Tags
INSERT INTO tags (name, slug, description, color_hex) VALUES
('MySQL', 'mysql', 'MySQL database articles', '#00758F'),
('PostgreSQL', 'postgresql', 'PostgreSQL database articles', '#336791'),
('Docker', 'docker', 'Docker containerization', '#2496ED'),
('Kubernetes', 'kubernetes', 'Kubernetes orchestration', '#326CE5'),
('Performance', 'performance', 'Performance optimization', '#FF6B6B'),
('Best Practices', 'best-practices', 'Industry best practices', '#4ECDC4');

-- Insert Blog Posts
INSERT INTO posts (
    author_id, category_id, title, slug, excerpt, content, 
    status, published_at, meta_description, reading_time_minutes
) VALUES
(
    1, 1, 
    'MySQL Query Optimization Techniques',
    'mysql-query-optimization-techniques',
    'Learn effective techniques to optimize your MySQL queries for better performance.',
    'This comprehensive guide covers various techniques to optimize MySQL queries. We\'ll explore query execution plans, index strategies, and common performance pitfalls...',
    'published',
    NOW(),
    'Learn MySQL query optimization techniques for better database performance',
    8
),
(
    2, 2,
    'InnoDB vs MyISAM: Choosing the Right Storage Engine',
    'innodb-vs-myisam-storage-engine',
    'Understanding the differences between InnoDB and MyISAM storage engines to make informed decisions.',
    'When designing a MySQL database, one of the critical decisions is choosing the storage engine. This article compares InnoDB and MyISAM...',
    'published',
    NOW() - INTERVAL 7 DAY,
    'Comparison of InnoDB and MyISAM storage engines for MySQL databases',
    6
),
(
    3, 3,
    'Docker Compose for Local Development',
    'docker-compose-local-development',
    'Set up a complete development environment using Docker Compose.',
    'Docker Compose simplifies managing multi-container applications. In this tutorial, we\'ll create a development environment with multiple services...',
    'published',
    NOW() - INTERVAL 14 DAY,
    'Using Docker Compose to set up local development environments',
    10
),
(
    1, 2,
    'Database Indexing Best Practices',
    'database-indexing-best-practices',
    'Master database indexing to dramatically improve query performance.',
    'Indexes are crucial for database performance. This guide covers single-column indexes, composite indexes, and index optimization strategies...',
    'draft',
    NULL,
    'Learn database indexing best practices for optimal performance',
    12
);

-- Link posts to tags
INSERT INTO post_tags (post_id, tag_id) VALUES
(1, 1), -- Post 1 tagged with MySQL
(1, 5), -- Post 1 tagged with Performance
(1, 6), -- Post 1 tagged with Best Practices
(2, 1), -- Post 2 tagged with MySQL
(2, 6), -- Post 2 tagged with Best Practices
(3, 3), -- Post 3 tagged with Docker
(3, 4), -- Post 3 tagged with Kubernetes
(4, 1), -- Post 4 tagged with MySQL
(4, 5), -- Post 4 tagged with Performance
(4, 6); -- Post 4 tagged with Best Practices

-- Insert Comments
INSERT INTO comments (post_id, author_id, author_name, author_email, content, status, created_at) VALUES
(1, 1, 'John Doe', 'john@example.com', 'Great article! Very helpful.', 'approved', NOW() - INTERVAL 2 DAY),
(1, NULL, 'Guest User', 'guest@example.com', 'This helped me optimize my queries significantly.', 'approved', NOW() - INTERVAL 1 DAY),
(2, 2, 'Jane Smith', 'jane@example.com', 'InnoDB is definitely the way to go for modern applications.', 'approved', NOW() - INTERVAL 3 DAY),
(3, NULL, 'DevOps Enthusiast', 'devops@example.com', 'Excellent Docker Compose examples!', 'pending', NOW() - INTERVAL 1 HOUR);

-- Insert nested reply
INSERT INTO comments (post_id, parent_comment_id, author_id, author_name, author_email, content, status) VALUES
(1, 1, 2, 'Jane Smith', 'jane@example.com', 'I agree! The index strategy section was particularly valuable.', 'approved');

-- Insert post statistics
INSERT INTO post_statistics (post_id, total_views, total_comments, average_rating, unique_visitors) VALUES
(1, 1250, 2, 4.8, 890),
(2, 856, 1, 4.6, 620),
(3, 2145, 1, 4.9, 1560),
(4, 0, 0, NULL, 0);


-- ============================================================================
-- COMMON SELECT QUERIES WITH INDEX OPTIMIZATION
-- ============================================================================

-- Query 1: Get published posts by category with author and comment count
-- Indexes: status + published_at, category_id
SELECT 
    p.post_id,
    p.title,
    p.slug,
    p.excerpt,
    a.full_name AS author_name,
    c.name AS category_name,
    COUNT(DISTINCT co.comment_id) AS comment_count,
    p.created_at
FROM posts p
    INNER JOIN authors a ON p.author_id = a.author_id
    INNER JOIN categories c ON p.category_id = c.category_id
    LEFT JOIN comments co ON p.post_id = co.post_id AND co.status = 'approved'
WHERE p.status = 'published' 
    AND p.category_id = 1
    AND p.published_at <= NOW()
GROUP BY p.post_id
ORDER BY p.published_at DESC
LIMIT 10;

-- Query 2: Full-text search posts
-- Indexes: FULLTEXT key on (title, excerpt, content)
SELECT 
    post_id,
    title,
    slug,
    MATCH(title, excerpt, content) AGAINST('MySQL optimization' IN BOOLEAN MODE) AS relevance
FROM posts
WHERE MATCH(title, excerpt, content) AGAINST('MySQL optimization' IN BOOLEAN MODE)
    AND status = 'published'
ORDER BY relevance DESC;

-- Query 3: Get posts by specific tag with statistics
-- Indexes: tag_id (post_tags), post_id (post_statistics)
SELECT 
    p.post_id,
    p.title,
    p.slug,
    t.name AS tag_name,
    a.full_name AS author_name,
    ps.total_views,
    ps.average_rating
FROM posts p
    INNER JOIN post_tags pt ON p.post_id = pt.post_id
    INNER JOIN tags t ON pt.tag_id = t.tag_id
    LEFT JOIN post_statistics ps ON p.post_id = ps.post_id
    INNER JOIN authors a ON p.author_id = a.author_id
WHERE t.slug = 'mysql' 
    AND p.status = 'published'
ORDER BY ps.total_views DESC, p.published_at DESC;

-- Query 4: Get comments for a post with author details (nested replies)
-- Indexes: post_status_created_at
SELECT 
    c.comment_id,
    c.content,
    c.author_name,
    COALESCE(a.full_name, c.author_name) AS author_display_name,
    c.parent_comment_id,
    c.created_at,
    c.status
FROM comments c
    LEFT JOIN authors a ON c.author_id = a.author_id
WHERE c.post_id = 1
    AND c.status = 'approved'
ORDER BY 
    COALESCE(c.parent_comment_id, c.comment_id) ASC,
    c.comment_id ASC;

-- Query 5: Get featured posts with related tags
-- Indexes: is_featured, published_at
SELECT 
    p.post_id,
    p.title,
    p.slug,
    p.featured_image_url,
    a.full_name AS author_name,
    GROUP_CONCAT(t.name, ', ') AS tags,
    ps.total_views
FROM posts p
    INNER JOIN authors a ON p.author_id = a.author_id
    LEFT JOIN post_tags pt ON p.post_id = pt.post_id
    LEFT JOIN tags t ON pt.tag_id = t.tag_id
    LEFT JOIN post_statistics ps ON p.post_id = ps.post_id
WHERE p.is_featured = TRUE 
    AND p.status = 'published'
    AND p.published_at <= NOW()
GROUP BY p.post_id
ORDER BY p.published_at DESC;

-- Query 6: Get recent posts by author
-- Indexes: author_id, status, published_at
SELECT 
    p.post_id,
    p.title,
    p.slug,
    p.excerpt,
    COUNT(DISTINCT co.comment_id) AS comment_count,
    p.published_at
FROM posts p
    LEFT JOIN comments co ON p.post_id = co.post_id 
        AND co.status = 'approved'
WHERE p.author_id = 1
    AND p.status = 'published'
GROUP BY p.post_id
ORDER BY p.published_at DESC
LIMIT 20;

-- Query 7: Get posts with multiple tags matching
-- Indexes: tag_id (post_tags), post_id
SELECT 
    p.post_id,
    p.title,
    COUNT(pt.tag_id) AS matching_tags
FROM posts p
    INNER JOIN post_tags pt ON p.post_id = pt.post_id
    INNER JOIN tags t ON pt.tag_id = t.tag_id
WHERE p.status = 'published'
    AND t.slug IN ('mysql', 'performance')
GROUP BY p.post_id
HAVING COUNT(pt.tag_id) >= 2
ORDER BY matching_tags DESC, p.published_at DESC;

-- Query 8: Dashboard - post performance overview
-- Indexes: various
SELECT 
    p.post_id,
    p.title,
    p.status,
    a.full_name AS author_name,
    ps.total_views,
    ps.total_comments,
    ps.average_rating,
    COUNT(DISTINCT co.comment_id) AS pending_comments,
    p.created_at
FROM posts p
    INNER JOIN authors a ON p.author_id = a.author_id
    LEFT JOIN post_statistics ps ON p.post_id = ps.post_id
    LEFT JOIN comments co ON p.post_id = co.post_id 
        AND co.status = 'pending'
GROUP BY p.post_id
ORDER BY p.created_at DESC
LIMIT 50;










