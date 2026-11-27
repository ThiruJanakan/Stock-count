-- ============================================================================
-- LINA MANUFACTURING · PRODUCTION DATABASE SEED DATA
-- ============================================================================

-- Seed Authorized Users (PBKDF2-HMAC-SHA256, 100,000 iterations)
INSERT INTO users (id, username, full_name, role, password_salt, password_hash, is_active, created_at, updated_at) VALUES
('u-admin', 'Chinthaka', 'Central Admin', 'ADMIN', '62110c36ea51bb8f9c142319e11f5bd9', 'pbkdf2$edb40df19185e1bf38de553226cb06460f0c2f4351fec585ff2f7d8c5b43b770', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('u-sup', 'Ayeshika', 'Ayeshika Kumari', 'SUPERVISOR', '2543f414bc50663be86cbc8a185928f6', 'pbkdf2$51398bcf3c18e994eb4488e6d1d1500429e168dde0b8d9519ed77f13b941b39f', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('u-c1', 'Navod', 'Navod Sanjana', 'COUNTER', 'd7ebd06977f615f3ab7da90a17d5f6ab', 'pbkdf2$a92990a77ffa1b001b0c392f751ec9f79472aca49fe575138763ff7d3d60d82d', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('u-c2', 'Pawan', 'Pawan Munasinghe', 'COUNTER', '2e6edaad57aadd3d5f745ff9e4bc4c16', 'pbkdf2$65a2f27042eadb048f8dd0421ee59965b0f34f60fa5af01be0e903a3a707e294', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('u-indunil', 'Indunil', 'Indunil Buddhika', 'COUNTER', '4b2e4da5bb01817af14f3f39d7806127', 'pbkdf2$d3e01b882668eae7f9897668bdeb6d4bb04cafb62275ba913cf99575b7ae2c59', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('u-nethinu', 'nethinu', 'Methinu', 'COUNTER', '9893fdbd98261d7312edc79ee52a7915', 'pbkdf2$d520e7437f1c7d166f24b63383c645f9e44598e3538b15f837c5bc6692e19f17', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('u-avishka', 'avishka', 'Avishka', 'COUNTER', 'b2fdf21a811967374a8fc754ef9a69a3', 'pbkdf2$9f63174e9fd3a40c80cdb3b4a2c2e69e3e28496810ddde481a70daee97a5a3c9', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('u-arulraj', 'arulraj', 'Arul', 'COUNTER', '65e177b1b70b1411d3e5340767dbb873', 'pbkdf2$fa2d4965f6121465e17499bbd5f87c644f7704e270817f4bbcd1c65aef77e9e6', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('u-samith', 'Samith', 'Samith Priyakelum', 'SUPERVISOR', 'af268a4fa011992ad5d18f6562024fc0', 'pbkdf2$80679663691a6f351496f5e37c72056a5aaf32a5e4c8acae460eca835f6398ec', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('u-indika', 'Indika', 'Indika Ruwansiri', 'SUPERVISOR', 'ae9b61d267ac28e818ae132670a9720d', 'pbkdf2$22d8ebc020d9fa324059d65bab259a70bf720301212da5a5e8ec26ecf4697a31', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('u-tenith', 'Tenith', 'Tenith', 'COUNTER', '2e67d415484d4208f463ac101036c8d7', 'pbkdf2$afe342886784e0ad0d81e33194c414a6209bfa5e50e2366bdcd098202c053072', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('u-enosh', 'Enosh', 'Enosh', 'COUNTER', '6a70c87237585a15b4ea2bc2864c3583', 'pbkdf2$a01b3ae23202ba3eefd7ca1e2a4470940b285f4155c6954e12109315e6ed3c8e', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (username) DO NOTHING;
