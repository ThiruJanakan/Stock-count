-- ============================================================================
-- LINA MANUFACTURING · INITIAL DATABASE SEED DATA
-- ============================================================================

-- Seed Users (PBKDF2-HMAC-SHA256, 100,000 iterations)
INSERT INTO users (id, username, full_name, role, password_salt, password_hash, is_active, created_at, updated_at) VALUES
('u-admin', 'admin', 'Central Admin', 'ADMIN', 'a8f5b2c1d0e9478291f038572bcae142', 'pbkdf2$e565cf7400deddb134e20c56b5f8fd27569eb2a6077e022b749fa8f295c9d69c', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('u-sup', 'supervisor1', 'Floor Supervisor', 'SUPERVISOR', 'b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6', 'pbkdf2$5ea5f9ac90ee3e3054ec99177576012049b4e92f555147ce8e5820d4e0153709', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('u-c1', 'counter1', 'Operator Alpha', 'COUNTER', 'c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8', 'pbkdf2$6b89184d3b0b01591868ab9d678f8ec04714e566a69346d57bd97ad99ae04c31', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('u-c2', 'counter2', 'Operator Beta', 'COUNTER', 'd4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9', 'pbkdf2$cebe37c591e6e9dc92a53426a023d1abf4eaa000cc80fa19c50e4e6d67d530d2', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (username) DO NOTHING;

-- Seed Default Count Session
INSERT INTO count_sessions (id, session_code, title, description, count_type, status, total_items, counted_items, progress_percent, created_by, created_at) VALUES
('ses-101', 'SES-20261019-01', 'Main Warehouse Stock Verification - Cycle 1', 'Centralized Count for Raw Materials and Finished Goods', 'BLIND_COUNT', 'ACTIVE', 8, 0, 0, 'u-admin', CURRENT_TIMESTAMP)
ON CONFLICT (session_code) DO NOTHING;

-- Seed Master Stock Items
INSERT INTO stock_items (id, session_id, sku, item_name, barcode, batch_no, expiry_date, zone_location, system_qty, total_counted_qty, variance_qty, uom, is_unlisted, created_at, updated_at) VALUES
('item-seed-1', 'ses-101', 'RM-PARA-001', 'Paracetamol Micronized IP Powder (50kg)', '8901234000101', 'BAT-PARA-2401', '2027-08-30', 'Aisle 1 - Raw Materials', 40.00, 0.00, -40.00, 'DRUM', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('item-seed-2', 'ses-101', 'RM-AMOX-002', 'Amoxicillin Trihydrate Compacted Powder (25kg)', '8901234000102', 'BAT-AMOX-2309', '2026-11-08', 'Aisle 1 - Raw Materials', 25.00, 0.00, -25.00, 'DRUM', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('item-seed-3', 'ses-101', 'PM-BLIS-010', 'Aluminium Blister Printed Foil 250mm', '8901234000103', 'PKG-FOIL-2405', '2028-05-15', 'Aisle 2 - Packaging', 150.00, 0.00, -150.00, 'ROLL', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('item-seed-4', 'ses-101', 'PM-CART-022', 'Lina Paracetamol 500mg Outer Printed Cartons', '8901234000104', 'PKG-CART-2402', '2029-01-01', 'Aisle 2 - Packaging', 5000.00, 0.00, -5000.00, 'PCS', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('item-seed-5', 'ses-101', 'PM-BOTT-035', 'Amber Glass Syrup Bottles 100ml USP Type III', '8901234000105', 'PKG-BOTT-2401', '2030-01-01', 'Aisle 3 - Containers', 12000.00, 0.00, -12000.00, 'BTL', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('item-seed-6', 'ses-101', 'FG-PARA-500', 'Lina Paracetamol Tablets 500mg (10x10 Blister Pack)', '8901234000106', 'BAT-PARA-2304', '2026-10-10', 'Warehouse FG - Rack A', 850.00, 0.00, -850.00, 'BOX', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('item-seed-7', 'ses-101', 'FG-COUGH-100', 'Lina Cough Expectorant Syrup 100ml Bottle', '8901234000107', 'BAT-SYRP-2402', '2026-12-15', 'Warehouse FG - Rack B', 620.00, 0.00, -620.00, 'BTL', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('item-seed-8', 'ses-101', 'FG-AMOX-250', 'Amoxicillin Oral Dry Suspension 250mg/5ml', '8901234000108', 'BAT-DRYS-2403', '2026-11-20', 'Warehouse FG - Rack C', 410.00, 0.00, -410.00, 'BTL', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- Genesis Audit Trail
INSERT INTO audit_trails (id, timestamp, user_id, username, role, action, category, details, target, prev_hash, event_hash) VALUES
('adt-genesis', CURRENT_TIMESTAMP, 'u-admin', 'admin', 'ADMIN', 'SYSTEM_INIT', 'SYSTEM', 'Authoritative Relational Database Initialized with Cryptographic Ledger Chaining', 'SYSTEM', 'GENESIS_ROOT', 'a1b2c3d4e5f60718293a4b5c6d7e8f90')
ON CONFLICT (id) DO NOTHING;
