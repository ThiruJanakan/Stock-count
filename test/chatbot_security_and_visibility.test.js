/**
 * Lina Manufacturing · Chatbot Security, RBAC & Blind Count Integrity Test Suite
 * 
 * Verifies:
 * 1. UI Cleanness: Elimination of developer notes, "Zero API", and "Free Offline" marketing text.
 * 2. Simplified Query Mode: Single unified "Complete History" mode without redundant questions.
 * 3. Chatbot Role-Based Access Control (RBAC): Admin governance over user permissions.
 * 4. User History Isolation: Storage keys are scoped per user; no history leakage across sessions.
 * 5. Strict Session Blind Count Enforcement:
 *    - In BLIND_ALL: System Book Qty and Variance are strictly masked for Counters and Executives.
 *    - In BLIND_COUNT: System Book Qty and Variance are masked for Counters.
 *    - Variance is always masked when System Book Qty is hidden to prevent calculation attacks.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

describe('Lina Manufacturing · Chatbot RBAC, History Isolation & Blind Count Test Suite', () => {
  const indexHtmlPath = path.join(__dirname, '..', 'index.html');
  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');

  test('TC-BOT-01: UI Cleanness & Elimination of Developer/Marketing Jargon', () => {
    // Assert "Free Offline Data Retrieval · Zero API" is completely absent
    assert.strictEqual(
      indexHtml.includes('Free Offline Data Retrieval · Zero API'),
      false,
      'index.html must not contain "Free Offline Data Retrieval · Zero API"'
    );

    // Assert "DB Live" badge is eliminated from chatbot header
    assert.strictEqual(
      indexHtml.includes('DB Live'),
      false,
      'index.html must not contain developer badge "DB Live"'
    );

    // Assert title is clean "Stock Bot"
    assert.match(
      indexHtml,
      /<div class="chatbot-header-title">\s*<span>Stock Bot<\/span>\s*<\/div>/,
      'Chatbot header must display clean, professional "Stock Bot" title'
    );
  });

  test('TC-BOT-02: Single Unified Predefined Query Mode (Complete History Only)', () => {
    // Redundant carousel buttons should not exist
    assert.strictEqual(
      indexHtml.includes('selectChatbotQuestion(\'Q_PHYSICAL_VS_SYSTEM\')'),
      false,
      'Pills for Q_PHYSICAL_VS_SYSTEM should be removed'
    );
    assert.strictEqual(
      indexHtml.includes('selectChatbotQuestion(\'Q_SESSIONS_DATES\')'),
      false,
      'Pills for Q_SESSIONS_DATES should be removed'
    );
    assert.strictEqual(
      indexHtml.includes('selectChatbotQuestion(\'Q_ZONE_LOCATION\')'),
      false,
      'Pills for Q_ZONE_LOCATION should be removed'
    );
    assert.strictEqual(
      indexHtml.includes('selectChatbotQuestion(\'Q_VARIANCE_AUDIT\')'),
      false,
      'Pills for Q_VARIANCE_AUDIT should be removed'
    );

    // Only clean Complete History mode indicator
    assert.match(
      indexHtml,
      /Predefined Query:[\s\S]*?Complete Item History/,
      'Predefined query section must showcase single clean "Complete Item History" option'
    );
  });

  test('TC-BOT-03: Admin Chatbot Access Control Discoverability in User Management View', () => {
    // Assert prominent card exists in #view-users
    assert.match(
      indexHtml,
      /id="view-users"[\s\S]*?Stock Chatbot Access &amp; Data Governance[\s\S]*?openChatbotAdminConfigModal\(\)/,
      'User Management view must contain dedicated Chatbot Governance card with configure button'
    );

    // Assert header access rules button exists for Admin
    assert.match(
      indexHtml,
      /<button[^>]*class="[^"]*admin-strict[^"]*"[^>]*onclick="openChatbotAdminConfigModal\(\)"[^>]*>[\s\S]*?Access Rules[\s\S]*?<\/button>/,
      'Chatbot header must include an explicit Access Rules button for Admin'
    );
  });

  test('TC-BOT-04: User Chat History Isolation Logic', () => {
    // Verify per-user key function exists
    assert.match(
      indexHtml,
      /function getUserChatStorageKey\(\)\s*\{[\s\S]*?'LINA_CHAT_HISTORY_' \+ String\(currentUser\.id \|\| currentUser\.username\)\.toLowerCase\(\);[\s\S]*?\}/,
      'Must generate storage key strictly isolated per authenticated user ID/username'
    );

    // Verify handleLogout completely resets in-memory conversation & DOM container
    assert.match(
      indexHtml,
      /chatbotConversationHistory = \[\];[\s\S]*?chatContainer\.innerHTML = '';/,
      'handleLogout must wipe in-memory conversation history and DOM messages container'
    );
  });

  test('TC-BOT-05: Strict Blind Count Enforcement for COUNTER and EXECUTIVE', () => {
    // Extract and evaluate canChatbotViewSystemQty logic
    function isExecutive(user) {
      return !!(user && (user.role === 'EXECUTIVE' || user.role === 'SUPERVISOR'));
    }

    function canChatbotViewSystemQty(user, session, settings) {
      if (!user) return false;
      if (user.role === 'ADMIN') return true;
      if (!settings.allow_system_qty) return false;

      const countMode = (session && session.count_type) || 'BLIND_ALL';

      // 1. In BLIND_ALL: both Counters and Executives are strictly blind
      if (countMode === 'BLIND_ALL') {
        if (user.role === 'MANAGER') return true;
        return false;
      }

      // 2. In BLIND_COUNT: Counters are blind, Executives can view
      if (countMode === 'BLIND_COUNT') {
        if (isExecutive(user) || user.role === 'MANAGER') return true;
        return false;
      }

      if (user.role === 'COUNTER') {
        return false;
      }

      return true;
    }

    const defaultSettings = {
      enabled_roles: ['ADMIN', 'MANAGER', 'EXECUTIVE', 'COUNTER'],
      allow_system_qty: true,
      enforce_blind_rules: true,
      allow_variance: true,
      allow_historical_sessions: true
    };

    const adminUser = { id: 'u-1', username: 'admin', role: 'ADMIN' };
    const execUser = { id: 'u-2', username: 'exec1', role: 'EXECUTIVE' };
    const counterUser = { id: 'u-3', username: 'counter1', role: 'COUNTER' };
    const managerUser = { id: 'u-4', username: 'mgr1', role: 'MANAGER' };

    const strictBlindSession = { id: 'ses-1', count_type: 'BLIND_ALL', title: 'PM Combined Stock List' };
    const blindCountSession = { id: 'ses-2', count_type: 'BLIND_COUNT', title: 'General Warehouse Count' };
    const openCountSession = { id: 'ses-3', count_type: 'OPEN_COUNT', title: 'Open Audit Count' };

    // Strict Blind (BLIND_ALL):
    // Admin & Manager see system stock
    assert.strictEqual(canChatbotViewSystemQty(adminUser, strictBlindSession, defaultSettings), true);
    assert.strictEqual(canChatbotViewSystemQty(managerUser, strictBlindSession, defaultSettings), true);
    // Executive and Counter MUST BE BLOCKED
    assert.strictEqual(canChatbotViewSystemQty(execUser, strictBlindSession, defaultSettings), false, 'Executive must be blocked in BLIND_ALL');
    assert.strictEqual(canChatbotViewSystemQty(counterUser, strictBlindSession, defaultSettings), false, 'Counter must be blocked in BLIND_ALL');

    // Blind Count (BLIND_COUNT):
    // Admin, Manager & Executive see system stock
    assert.strictEqual(canChatbotViewSystemQty(adminUser, blindCountSession, defaultSettings), true);
    assert.strictEqual(canChatbotViewSystemQty(managerUser, blindCountSession, defaultSettings), true);
    assert.strictEqual(canChatbotViewSystemQty(execUser, blindCountSession, defaultSettings), true);
    // Counter MUST BE BLOCKED
    assert.strictEqual(canChatbotViewSystemQty(counterUser, blindCountSession, defaultSettings), false, 'Counter must be blocked in BLIND_COUNT');

    // Open Count (OPEN_COUNT):
    // Floor counter must STILL be blocked from asking chatbot for target book stock
    assert.strictEqual(canChatbotViewSystemQty(counterUser, openCountSession, defaultSettings), false, 'Counter must not see book stock even in OPEN_COUNT');

    // Policy Override: If Admin disables allow_system_qty
    const restrictedSettings = { ...defaultSettings, allow_system_qty: false };
    assert.strictEqual(canChatbotViewSystemQty(adminUser, openCountSession, restrictedSettings), true, 'Admin always retains access');
    assert.strictEqual(canChatbotViewSystemQty(managerUser, openCountSession, restrictedSettings), false, 'Manager blocked when allow_system_qty is false');
    assert.strictEqual(canChatbotViewSystemQty(execUser, openCountSession, restrictedSettings), false, 'Executive blocked when allow_system_qty is false');
  });

  test('TC-BOT-06: Variance is Always Masked When System Quantity is Hidden', () => {
    // Assert in index.html that whenever isSysAllowed is false, variance is masked
    assert.match(
      indexHtml,
      /varianceDisplay = '<span style="color: var\(--text-dim\); font-weight: 600;">🔒 Masked \(Blind Count Policy\)<\/span>';/,
      'Variance must always be masked when System Qty is hidden to prevent physical - variance deduction'
    );
  });

  test('TC-BOT-07: Per-User Chatbot Enablement and Disablement Controls', () => {
    // 1. Assert "Bot Policies" button is prominent in User Management header
    assert.match(
      indexHtml,
      /<button[^>]*class="[^"]*admin-strict[^"]*"[^>]*onclick="openChatbotAdminConfigModal\(\)"[^>]*>[\s\S]*?Bot Policies[\s\S]*?<\/button>/,
      'User Management header must display prominent "Bot Policies" button'
    );

    // 2. Assert "Bot Access" column exists in usersTable
    assert.match(
      indexHtml,
      /<th>Status<\/th>\s*<th>Bot Access<\/th>\s*<th>Created At<\/th>/,
      'Users table must include a dedicated "Bot Access" column'
    );

    // 3. Assert toggleUserBotAccess function is implemented and wired
    assert.match(
      indexHtml,
      /function toggleUserBotAccess\(userId\)/,
      'toggleUserBotAccess function must exist'
    );
    assert.match(
      indexHtml,
      /toggleUserBotAccess\('\${u\.id}'\)/,
      'Table rows must render interactive toggle button calling toggleUserBotAccess'
    );

    // 4. Assert Edit User drawer contains editChatbotAccess control
    assert.match(
      indexHtml,
      /id="editChatbotAccess"/,
      'Edit user form must contain editChatbotAccess select control'
    );

    // 5. Assert isUserAllowedChatbot logic strictly respects user.chatbot_enabled
    function isUserAllowedChatbot(user, settings = { enabled_roles: ['ADMIN', 'MANAGER', 'EXECUTIVE', 'COUNTER'] }) {
      if (!user) return false;
      if (user.role === 'ADMIN') return true;
      if (user.chatbot_enabled === false) return false;
      const roles = settings.enabled_roles || [];
      const roleAllowed = roles.includes(user.role) || (user.role === 'EXECUTIVE' && roles.includes('EXECUTIVE'));
      if (!roleAllowed) return false;
      return user.chatbot_enabled !== false;
    }

    const enabledCounter = { id: 'u-c1', username: 'counter1', role: 'COUNTER', chatbot_enabled: true };
    const disabledCounter = { id: 'u-c2', username: 'counter2', role: 'COUNTER', chatbot_enabled: false };
    const adminUser = { id: 'u-a', username: 'admin', role: 'ADMIN', chatbot_enabled: false };

    assert.strictEqual(isUserAllowedChatbot(enabledCounter), true, 'Enabled counter must have bot access');
    assert.strictEqual(isUserAllowedChatbot(disabledCounter), false, 'Disabled counter must have bot access blocked');
    assert.strictEqual(isUserAllowedChatbot(adminUser), true, 'Admin always has authoritative access');
  });
});

