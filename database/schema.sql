-- ============================================================================
-- LINA MANUFACTURING · ENTERPRISE STOCK VERIFICATION CLOUD
-- PRODUCTION RELATIONAL DATABASE SCHEMA (PostgreSQL / SQLite Compatible)
-- ============================================================================

-- 1. USERS & ACCESS CONTROL TABLE
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    username VARCHAR(64) UNIQUE NOT NULL,
    full_name VARCHAR(128) NOT NULL,
    role VARCHAR(32) NOT NULL CHECK (role IN ('ADMIN', 'SUPERVISOR', 'MANAGER', 'COUNTER')),
    password_salt VARCHAR(64) NOT NULL,
    password_hash VARCHAR(128) NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. STOCK COUNT SESSIONS TABLE
CREATE TABLE IF NOT EXISTS count_sessions (
    id VARCHAR(64) PRIMARY KEY,
    session_code VARCHAR(64) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    count_type VARCHAR(32) NOT NULL DEFAULT 'BLIND_COUNT' CHECK (count_type IN ('BLIND_COUNT', 'SUPERVISED_COUNT', 'DOUBLE_BLIND')),
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CLOSED', 'LOCKED')),
    total_items INTEGER NOT NULL DEFAULT 0,
    counted_items INTEGER NOT NULL DEFAULT 0,
    progress_percent INTEGER NOT NULL DEFAULT 0,
    created_by VARCHAR(64) REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP WITH TIME ZONE
);

-- 3. MASTER INVENTORY ITEMS TABLE
CREATE TABLE IF NOT EXISTS stock_items (
    id VARCHAR(64) PRIMARY KEY,
    session_id VARCHAR(64) NOT NULL REFERENCES count_sessions(id) ON DELETE CASCADE,
    sku VARCHAR(128) NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    barcode VARCHAR(128),
    batch_no VARCHAR(128),
    expiry_date VARCHAR(32),
    zone_location VARCHAR(128),
    system_qty NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (system_qty >= 0),
    total_counted_qty NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_counted_qty >= 0),
    variance_qty NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    uom VARCHAR(32) NOT NULL DEFAULT 'PCS',
    is_unlisted INTEGER NOT NULL DEFAULT 0 CHECK (is_unlisted IN (0, 1)),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. PHYSICAL COUNT TRANSACTION LOGS (Append-Only)
CREATE TABLE IF NOT EXISTS count_logs (
    id VARCHAR(64) PRIMARY KEY,
    session_id VARCHAR(64) NOT NULL REFERENCES count_sessions(id) ON DELETE CASCADE,
    item_id VARCHAR(64) REFERENCES stock_items(id),
    sku VARCHAR(128) NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    batch_no VARCHAR(128),
    location VARCHAR(128),
    qty_counted NUMERIC(12, 2) NOT NULL CHECK (qty_counted >= 0),
    counted_by VARCHAR(64) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. CRYPTOGRAPHIC TAMPER-EVIDENT AUDIT LEDGER (Immutable Chain)
CREATE TABLE IF NOT EXISTS audit_trails (
    id VARCHAR(64) PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    user_id VARCHAR(64) NOT NULL,
    username VARCHAR(64) NOT NULL,
    role VARCHAR(32) NOT NULL,
    action VARCHAR(64) NOT NULL,
    category VARCHAR(64) NOT NULL DEFAULT 'SYSTEM',
    details TEXT NOT NULL,
    target VARCHAR(128),
    prev_hash VARCHAR(64) NOT NULL,
    event_hash VARCHAR(64) NOT NULL
);

-- ============================================================================
-- HIGH-PERFORMANCE QUERY INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_stock_items_session ON stock_items(session_id);
CREATE INDEX IF NOT EXISTS idx_stock_items_sku ON stock_items(sku);
CREATE INDEX IF NOT EXISTS idx_stock_items_barcode ON stock_items(barcode);
CREATE INDEX IF NOT EXISTS idx_stock_items_batch ON stock_items(batch_no);
CREATE INDEX IF NOT EXISTS idx_stock_items_expiry ON stock_items(expiry_date);
CREATE INDEX IF NOT EXISTS idx_count_logs_session ON count_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_count_logs_timestamp ON count_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_trails_timestamp ON audit_trails(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_trails_event_hash ON audit_trails(event_hash);
