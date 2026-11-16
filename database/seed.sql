-- ============================================================================
-- LINA MANUFACTURING · INITIAL DATABASE SEED DATA
-- ============================================================================

-- Seed Users (PBKDF2-HMAC-SHA256, 100,000 iterations)
INSERT INTO users (id, username, full_name, role, password_salt, password_hash, is_active, created_at, updated_at) VALUES
('u-admin', 'Chinthaka', 'Central Admin', 'ADMIN', 'a8f5b2c1d0e9478291f038572bcae142', 'pbkdf2$9fd945ec65d80cefc9833968dd6022784fbce26da4771bb218008793f86c16ec', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('u-sup', 'Ayeshika', 'Ayeshika Kumari', 'SUPERVISOR', 'b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6', 'pbkdf2$956cb185650fba5f8e5f4e594f7e628694d05fe93900a4876039780bc3452132', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('u-c1', 'Navod', 'Navod Sanjana', 'COUNTER', 'c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8', 'pbkdf2$041f65657070c30ebfd7fa94da3557c35cf60ad6e0e5344ac32e9677a0428ad7', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('u-c2', 'Pawan', 'Pawan Munasinghe', 'COUNTER', 'd4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9', 'pbkdf2$468d7c9a0745e7d70a9a841f6802d052445964ea34d646db550a489fe5c4ebed', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('u-indunil', 'Indunil', 'Indunil Buddhika', 'COUNTER', '88edd4d28e9f26f3548fca564d2e1e47', 'pbkdf2$1be8ac2bb0be5b1b1ceb6eec7e3c1923573e55220c772a7842b7534b748106c7', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (username) DO NOTHING;

-- Seed Default Count Session
INSERT INTO sessions (id, name, description, status, created_at, updated_at) VALUES
('sess-init-001', 'Initial Warehouse Audit', 'System generated bootstrap count session for floor operators.', 'OPEN', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;
