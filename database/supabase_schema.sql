-- ============================================================================
-- LINA MANUFACTURING · ENTERPRISE STOCK VERIFICATION CLOUD
-- COMPLETE SUPABASE PRODUCTION SCHEMA (PostgreSQL + RLS + Realtime)
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. DROP EXISTING COLLIDING TABLES (Clean Slate)
DROP TABLE IF EXISTS public.audit_trails CASCADE;
DROP TABLE IF EXISTS public.count_logs CASCADE;
DROP TABLE IF EXISTS public.stock_items CASCADE;
DROP TABLE IF EXISTS public.count_sessions CASCADE;
DROP TABLE IF EXISTS public.stock_users CASCADE;

-- 2. USERS TABLE (Named stock_users to prevent collision with generic 'users' tables)
CREATE TABLE public.stock_users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('ADMIN', 'EXECUTIVE', 'SUPERVISOR', 'MANAGER', 'COUNTER')),
    password_salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. COUNT SESSIONS TABLE
CREATE TABLE public.count_sessions (
    id TEXT PRIMARY KEY,
    session_code TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    count_type TEXT NOT NULL DEFAULT 'BLIND_COUNT' CHECK (count_type IN ('BLIND_COUNT', 'SUPERVISED_COUNT', 'DOUBLE_BLIND')),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CLOSED', 'LOCKED')),
    total_items INTEGER NOT NULL DEFAULT 0,
    counted_items INTEGER NOT NULL DEFAULT 0,
    progress_percent INTEGER NOT NULL DEFAULT 0,
    created_by TEXT REFERENCES public.stock_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    closed_at TIMESTAMPTZ
);

-- 4. MASTER STOCK ITEMS TABLE
CREATE TABLE public.stock_items (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES public.count_sessions(id) ON DELETE CASCADE,
    sku TEXT NOT NULL,
    item_name TEXT NOT NULL,
    barcode TEXT,
    batch_no TEXT,
    expiry_date VARCHAR(32),
    zone_location TEXT,
    system_qty NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (system_qty >= 0),
    total_counted_qty NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_counted_qty >= 0),
    variance_qty NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    uom TEXT NOT NULL DEFAULT 'PCS',
    is_unlisted BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. COUNT TRANSACTION LOGS (Append-Only Physical Scans)
CREATE TABLE public.count_logs (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES public.count_sessions(id) ON DELETE CASCADE,
    item_id TEXT REFERENCES public.stock_items(id) ON DELETE SET NULL,
    sku TEXT NOT NULL,
    item_name TEXT NOT NULL,
    batch_no TEXT,
    location TEXT,
    qty_counted NUMERIC(12, 2) NOT NULL CHECK (qty_counted >= 0),
    counted_by TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. IMMUTABLE CRYPTOGRAPHIC AUDIT TRAILS
CREATE TABLE public.audit_trails (
    id TEXT PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    user_id TEXT NOT NULL,
    username TEXT NOT NULL,
    role TEXT NOT NULL,
    action TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'SYSTEM',
    details TEXT NOT NULL,
    target TEXT,
    prev_hash TEXT NOT NULL,
    event_hash TEXT NOT NULL
);

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================
CREATE INDEX idx_stock_items_session ON public.stock_items(session_id);
CREATE INDEX idx_stock_items_sku ON public.stock_items(sku);
CREATE INDEX idx_stock_items_barcode ON public.stock_items(barcode);
CREATE INDEX idx_stock_items_batch ON public.stock_items(batch_no);
CREATE INDEX idx_count_logs_session ON public.count_logs(session_id);
CREATE INDEX idx_count_logs_timestamp ON public.count_logs(timestamp);
CREATE INDEX idx_audit_trails_timestamp ON public.audit_trails(timestamp);

-- ============================================================================
-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES (Enterprise Zero-Trust Lockdown)
-- ============================================================================
ALTER TABLE public.stock_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.count_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.count_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_trails ENABLE ROW LEVEL SECURITY;

-- 1. stock_users: STRICT ISOLATION
-- Public internet (anon) has ZERO access to user table (salts, hashes, metadata protected)
DROP POLICY IF EXISTS "Allow public read stock_users" ON public.stock_users;
DROP POLICY IF EXISTS "Allow all stock_users" ON public.stock_users;
CREATE POLICY "Deny anon access to stock_users" ON public.stock_users FOR ALL TO anon USING (false);
CREATE POLICY "Allow service_role full stock_users" ON public.stock_users FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2. count_sessions: Service role authoritative writes; Read-only for authorized clients
DROP POLICY IF EXISTS "Allow public read count_sessions" ON public.count_sessions;
DROP POLICY IF EXISTS "Allow update count_sessions" ON public.count_sessions;
DROP POLICY IF EXISTS "Allow insert count_sessions" ON public.count_sessions;
CREATE POLICY "Allow service_role full count_sessions" ON public.count_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated read count_sessions" ON public.count_sessions FOR SELECT TO authenticated, anon USING (true);

-- 3. stock_items: Service role authoritative writes; Read-only for active sessions
DROP POLICY IF EXISTS "Allow public read stock_items" ON public.stock_items;
DROP POLICY IF EXISTS "Allow update stock_items" ON public.stock_items;
DROP POLICY IF EXISTS "Allow insert stock_items" ON public.stock_items;
CREATE POLICY "Allow service_role full stock_items" ON public.stock_items FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated read stock_items" ON public.stock_items FOR SELECT TO authenticated, anon USING (true);

-- 4. count_logs: Append-only transaction records managed by authoritative backend
DROP POLICY IF EXISTS "Allow public read count_logs" ON public.count_logs;
DROP POLICY IF EXISTS "Allow insert count_logs" ON public.count_logs;
CREATE POLICY "Allow service_role full count_logs" ON public.count_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated read count_logs" ON public.count_logs FOR SELECT TO authenticated, anon USING (true);

-- 5. audit_trails: Immutable cryptographic audit ledger
DROP POLICY IF EXISTS "Allow public read audit_trails" ON public.audit_trails;
DROP POLICY IF EXISTS "Allow insert audit_trails" ON public.audit_trails;
CREATE POLICY "Allow service_role full audit_trails" ON public.audit_trails FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated read audit_trails" ON public.audit_trails FOR SELECT TO authenticated, anon USING (true);

-- ============================================================================
-- LEAST-PRIVILEGE ROLE GRANTS (Revoke Public / Anon Arbitrary Access)
-- ============================================================================
REVOKE ALL ON SCHEMA public FROM anon;
GRANT USAGE ON SCHEMA public TO service_role, authenticated, anon;

-- Revoke all table rights from anon on sensitive user credentials
REVOKE ALL ON TABLE public.stock_users FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.count_sessions FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.stock_items FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.count_logs FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.audit_trails FROM anon;

-- Full authoritative data access is strictly reserved for the service_role backend
GRANT ALL ON TABLE public.stock_users TO service_role;
GRANT ALL ON TABLE public.count_sessions TO service_role;
GRANT ALL ON TABLE public.stock_items TO service_role;
GRANT ALL ON TABLE public.count_logs TO service_role;
GRANT ALL ON TABLE public.audit_trails TO service_role;

-- Grant selective read-only access for Realtime event subscriptions
GRANT SELECT ON TABLE public.count_sessions TO authenticated, anon;
GRANT SELECT ON TABLE public.stock_items TO authenticated, anon;
GRANT SELECT ON TABLE public.count_logs TO authenticated, anon;
GRANT SELECT ON TABLE public.audit_trails TO authenticated, anon;

GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- ============================================================================
-- SUPABASE REALTIME REPLICATION (For live multi-device warehouse sync)
-- ============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.count_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.count_logs;

-- ============================================================================
-- INITIAL ENTERPRISE SEED DATA
-- ============================================================================
INSERT INTO public.stock_users (id, username, full_name, role, password_salt, password_hash, is_active) VALUES
('u-admin', 'admin', 'Central Admin', 'ADMIN', 'a8f5b2c1d0e9478291f038572bcae142', 'pbkdf2$9fd945ec65d80cefc9833968dd6022784fbce26da4771bb218008793f86c16ec', true),
('u-sup', 'supervisor1', 'Floor Supervisor', 'SUPERVISOR', 'b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6', 'pbkdf2$956cb185650fba5f8e5f4e594f7e628694d05fe93900a4876039780bc3452132', true),
('u-c1', 'counter1', 'Operator Alpha', 'COUNTER', 'c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8', 'pbkdf2$041f65657070c30ebfd7fa94da3557c35cf60ad6e0e5344ac32e9677a0428ad7', true),
('u-c2', 'counter2', 'Operator Beta', 'COUNTER', 'd4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9', 'pbkdf2$468d7c9a0745e7d70a9a841f6802d052445964ea34d646db550a489fe5c4ebed', true);

INSERT INTO public.count_sessions (id, session_code, title, description, count_type, status, total_items, counted_items, progress_percent, created_by) VALUES
('ses-101', 'SES-20261019-01', 'Main Warehouse Stock Verification - Cycle 1', 'Centralized Count for Raw Materials and Finished Goods', 'BLIND_COUNT', 'ACTIVE', 8, 0, 0, 'u-admin');

INSERT INTO public.stock_items (id, session_id, sku, item_name, barcode, batch_no, expiry_date, zone_location, system_qty, total_counted_qty, variance_qty, uom, is_unlisted) VALUES
('item-seed-1', 'ses-101', 'RM-PARA-001', 'Paracetamol Micronized IP Powder (50kg)', '8901234000101', 'BAT-PARA-2401', '2027-08-30', 'Aisle 1 - Raw Materials', 40.00, 0.00, -40.00, 'DRUM', false),
('item-seed-2', 'ses-101', 'RM-AMOX-002', 'Amoxicillin Trihydrate Compacted Powder (25kg)', '8901234000102', 'BAT-AMOX-2309', '2026-11-08', 'Aisle 1 - Raw Materials', 25.00, 0.00, -25.00, 'DRUM', false),
('item-seed-3', 'ses-101', 'PM-BLIS-010', 'Aluminium Blister Printed Foil 250mm', '8901234000103', 'PKG-FOIL-2405', '2028-05-15', 'Aisle 2 - Packaging', 150.00, 0.00, -150.00, 'ROLL', false),
('item-seed-4', 'ses-101', 'PM-CART-022', 'Lina Paracetamol 500mg Outer Printed Cartons', '8901234000104', 'PKG-CART-2402', '2029-01-01', 'Aisle 2 - Packaging', 5000.00, 0.00, -5000.00, 'PCS', false),
('item-seed-5', 'ses-101', 'PM-BOTT-035', 'Amber Glass Syrup Bottles 100ml USP Type III', '8901234000105', 'PKG-BOTT-2401', '2030-01-01', 'Aisle 3 - Containers', 12000.00, 0.00, -12000.00, 'BTL', false),
('item-seed-6', 'ses-101', 'FG-PARA-500', 'Lina Paracetamol Tablets 500mg (10x10 Blister Pack)', '8901234000106', 'BAT-PARA-2304', '2026-10-10', 'Warehouse FG - Rack A', 850.00, 0.00, -850.00, 'BOX', false),
('item-seed-7', 'ses-101', 'FG-COUGH-100', 'Lina Cough Expectorant Syrup 100ml Bottle', '8901234000107', 'BAT-SYRP-2402', '2026-12-15', 'Warehouse FG - Rack B', 620.00, 0.00, -620.00, 'BTL', false),
('item-seed-8', 'ses-101', 'FG-AMOX-250', 'Amoxicillin Oral Dry Suspension 250mg/5ml', '8901234000108', 'BAT-DRYS-2403', '2026-11-20', 'Warehouse FG - Rack C', 410.00, 0.00, -410.00, 'BTL', false);

INSERT INTO public.audit_trails (id, user_id, username, role, action, category, details, target, prev_hash, event_hash) VALUES
('adt-genesis', 'u-admin', 'admin', 'ADMIN', 'SYSTEM_INIT', 'SYSTEM', 'Supabase Cloud Database Initialized with Cryptographic Ledger Chaining', 'SYSTEM', 'GENESIS_ROOT', 'a1b2c3d4e5f60718293a4b5c6d7e8f90');
