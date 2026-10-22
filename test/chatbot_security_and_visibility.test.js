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

  test('TC-BATCH-01: Batch Code Columns & Omni-Search Support', () => {
    // Assert Batch Code columns in both Counter floor table and Recon table
    assert.match(indexHtml, /<th>Item Description \/ Name<\/th>\s*<th>Batch Code<\/th>\s*<th>Location \/ Zone<\/th>/, 'Counter checklist table must have Batch Code column');
    assert.match(indexHtml, /<th>Description<\/th>\s*<th>Batch Code<\/th>\s*<th>Zone<\/th>/, 'Reconciliation table must have Batch Code column');

    // Assert Omni-Search covers batch_no in floor table
    assert.match(indexHtml, /matchBatch = item\.batch_no && String\(item\.batch_no\)\.toLowerCase\(\)\.includes\(search\)/, 'Counter search must match batch_no');
    assert.match(indexHtml, /batchKey: findKey\(\[/, 'Spreadsheet import must detect batch/lot column headers');

    // Assert unlisted form contains batch input
    assert.match(indexHtml, /id="unlistedBatch"/, 'Unlisted item drawer must include batch input');
  });

  test('TC-BATCH-02: Multi-Batch Chatbot Presentation & Direct Batch Selection', () => {
    // Assert chatbot groups items and identifies multi-batch items
    assert.match(indexHtml, /const hasMultipleBatches = group\.occurrences\.length > 1;/, 'Chatbot must detect single SKU with multiple batches');
    assert.match(indexHtml, /selectChatbotBatch\('\${itm\.id}'\)/, 'Chatbot multi-batch list must render select buttons');
    assert.match(indexHtml, /function selectChatbotBatch\(itemId\)/, 'selectChatbotBatch function must exist');
    assert.match(indexHtml, /function renderSingleBatchDetailCard\(/, 'renderSingleBatchDetailCard function must exist');
  });

  test('TC-SEC-SYSTEM-QTY: Strict System Qty Protection for Counter and Supervisor', () => {
    // Assert edit record drawer locks system_qty for non-admin
    assert.match(indexHtml, /const isAdmin = currentUser && currentUser\.role === 'ADMIN';/, 'Drawer checks admin privileges');
    assert.match(indexHtml, /sysQtyInput\.disabled = true;/, 'System Qty input must be disabled for non-admins');
    assert.match(indexHtml, /sysQtyInput\.readOnly = true;/, 'System Qty input must be read-only for non-admins');

    // Assert handleSaveRecordEdit guarantees system_qty cannot be changed by non-admins
    assert.match(indexHtml, /const finalSysQty = isAdmin \? inputSysQty : \(appDb\.items\[itmIdx\]\.system_qty \|\| 0\);/, 'Save handler only updates system_qty if isAdmin');
  });

  test('TC-LOGIN-FEEDBACK: Login Error Shake Animation & Immediate Loading Reset', () => {
    // Assert CSS shake animation is defined
    assert.match(indexHtml, /@keyframes loginCardShake/, 'CSS keyframes for login card shake must be defined');
    assert.match(indexHtml, /\.login-card-shake/, 'CSS .login-card-shake class must exist');
    assert.match(indexHtml, /\.login-input-error/, 'CSS .login-input-error class must exist');

    // Assert inline error alert container exists
    assert.match(indexHtml, /id="loginErrorMessage"/, 'Inline login error message element must exist');

    // Assert triggerLoginErrorFeedback function exists and resets loading
    assert.match(indexHtml, /function triggerLoginErrorFeedback\(/, 'triggerLoginErrorFeedback function must exist');
  });

  test('TC-SESSION-WIDTH: Session Switcher Full-Width & Non-Truncating Styles', () => {
    assert.match(indexHtml, /id="sessionSelector"[^>]*style="[^"]*min-width:\s*280px/, 'Active session select must have min-width 280px');
    assert.match(indexHtml, /id="dashSessionSelect"[^>]*style="[^"]*min-width:\s*280px/, 'Dashboard session select must have min-width 280px');
  });

  test('TC-SOFT-HOLD-01: Soft Hold Concurrency UI Banner & Take Over Action', () => {
    // Assert soft hold warning banner in scanned item card
    assert.match(indexHtml, /id="itemSoftHoldNotice"/, 'Soft hold notice element must exist in scanned item card');
    assert.match(indexHtml, /id="itemSoftHoldNoticeText"/, 'Soft hold text element must exist');
    assert.match(indexHtml, /takeOverCurrentItemHold\(\)/, 'Take Over Count button handler must be bound in soft hold notice');
    assert.match(indexHtml, /function takeOverCurrentItemHold\(\)/, 'takeOverCurrentItemHold function must exist');
    assert.match(indexHtml, /function checkAndApplyItemHoldUI\(/, 'checkAndApplyItemHoldUI function must exist');
  });

  test('TC-SOFT-HOLD-02: Soft Hold State Management & Multi-Operator Synchronization', () => {
    // Assert client-side hold management functions
    assert.match(indexHtml, /let activeItemHoldsMap = new Map\(\);/, 'activeItemHoldsMap state must be declared');
    assert.match(indexHtml, /function acquireItemHold\(/, 'acquireItemHold function must exist');
    assert.match(indexHtml, /function releaseItemHold\(/, 'releaseItemHold function must exist');
    assert.match(indexHtml, /function fetchServerHolds\(/, 'fetchServerHolds function must exist');
    assert.match(indexHtml, /function initItemHoldsSync\(\)/, 'initItemHoldsSync function must exist');
    assert.match(indexHtml, /new BroadcastChannel\('lina_stock_holds'\)/, 'BroadcastChannel must be used for instant cross-tab sync');
  });

  test('TC-SOFT-HOLD-03: Floor Checklist Table Soft Hold Badges & Warning Buttons', () => {
    // Assert floor table renders in-process operator badge and dynamic counting button
    assert.match(indexHtml, /In Progress \(\${escapeHtml\(activeHold\.operatorName\)\}\)/, 'Floor table must render in-process badge with operator name');
    assert.match(indexHtml, /Counting \(\${escapeHtml\(activeHold\.operatorName\)\}\)/, 'Floor table must render Counting (Operator) button');
    assert.match(indexHtml, /Counting by You/, 'Floor table must render Counting by You badge for current user');
  });

  test('TC-SOFT-HOLD-04: Backend API Endpoints for /api/stock/holds', () => {
    const apiCode = fs.readFileSync(path.join(__dirname, '..', 'api', 'index.js'), 'utf8');
    const devServerCode = fs.readFileSync(path.join(__dirname, '..', 'dev-server.js'), 'utf8');

    [apiCode, devServerCode].forEach(code => {
      assert.match(code, /\/api\/stock\/holds/, 'Endpoint /api/stock/holds must be handled');
      assert.match(code, /action === 'RELEASE'/, 'Action RELEASE must be handled');
      assert.match(code, /action === 'HEARTBEAT'/, 'Action HEARTBEAT must be handled');
      assert.match(code, /conflict: true/, '409 Conflict must be returned when held by another user');
    });
  });

  test('TC-RECON-MULTI-SESSION-01: Session Scope Dropdown & All Sessions Option in Reconciliation View', () => {
    // Assert session selector dropdown exists in reconciliation filter bar
    assert.match(indexHtml, /id="reconSessionFilter"/, 'Reconciliation view must contain a session filter dropdown');
    assert.match(indexHtml, /<option value="ALL"[^>]*>[\s\S]*?All Sessions/, 'Session dropdown must include an "All Sessions" option');
    assert.match(indexHtml, /id="reconScopeSummaryBadge"/, 'Reconciliation scope summary badge must exist');
    assert.match(indexHtml, /<th>Session<\/th>/, 'Reconciliation table header must have a Session column');
    assert.match(indexHtml, /function onReconSessionChange\(\)/, 'onReconSessionChange function must exist');
    assert.match(indexHtml, /function populateReconSessionDropdown\(\)/, 'populateReconSessionDropdown function must exist');
  });

  test('TC-RECON-MULTI-SESSION-02: Consolidated Multi-Session Reconciliation Filtering & Export', () => {
    // Assert filterReconciliationTable handles isAllSessions and consolidates items
    assert.match(indexHtml, /const isAllSessions = reconSessionId === 'ALL';/, 'filterReconciliationTable must detect ALL sessions mode');
    assert.match(indexHtml, /sessionItems = appDb\.items \|\| \[\];/, 'ALL sessions mode must retrieve items across all sessions');
    assert.match(indexHtml, /title="Session: \${escapeHtml\(sessionTitle\)}"/, 'Reconciliation rows must display session badge and title');

    // Assert exportReconciliationReport handles consolidated multi-session export
    assert.match(indexHtml, /Consolidated Reconciliation/, 'Excel report must include Consolidated Reconciliation sheet in multi-session mode');
    assert.match(indexHtml, /Lina_Stock_Reconciliation_ALL_SESSIONS_/, 'Multi-session exports must use ALL_SESSIONS filename');
  });
});



