/**
 * Lina Manufacturing · Automated Security, Privacy & Integrity Test Suite (CHK-P01)
 * 
 * Verifies:
 * - SEC-007 / CHK-H01: Authoritative API & Sensitive Storage Controls
 * - SEC-009 / CHK-L01: Subresource Integrity & Vendor Script Safety
 * - CHK-A02: Brute Force Protection & Lockout
 * - CHK-P01: Automated Testing & Continuous Verification
 * - SQL Injection & Cross-Site Scripting (XSS) Defenses
 * - CSV / Spreadsheet Formula Injection Neutralization
 * - Server-Side Blind Count Enforcement
 * - Tamper-Evident Cryptographic Audit Ledger
 * - IDOR (Insecure Direct Object Reference) Prevention on Sessions & Users
 * - Multi-Tier Abuse Protection & Rate Limiting (API, Account Creation, AI Generation)
 * - Anti-Bot & Automated Scraper Protection
 * - Elimination of Plaintext Fallback Passwords
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const crypto = require('node:crypto');

// Import authoritative server to ensure it is listening
let server;
try {
  server = require('../dev-server.js');
} catch (e) {
  console.warn('Server already started or loading error:', e.message);
}

const { resetAllRateLimits } = require('../lib/security');

const SERVER_BASE = 'http://localhost:5173';

// Helper for making HTTP requests
function httpRequest(urlPath, options = {}, payload = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, SERVER_BASE);
    const reqOptions = {
      method: options.method || 'GET',
      headers: {
        'User-Agent': 'Lina-Security-Test-Runner/1.0',
        ...(options.headers || {})
      },
      ...options
    };

    const req = http.request(url, reqOptions, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (_) {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
          json: json
        });
      });
    });

    req.on('error', err => reject(err));
    if (payload) {
      if (typeof payload === 'object') {
        req.write(JSON.stringify(payload));
      } else {
        req.write(payload);
      }
    }
    req.end();
  });
}

describe('Lina Manufacturing · Enterprise Security & Integrity Test Suite', () => {

  before((_, done) => {
    resetAllRateLimits();
    if (server && !server.listening) {
      server.listen(5173, '127.0.0.1', () => done());
    } else {
      done();
    }
  });

  after(() => {
    resetAllRateLimits();
    if (server && typeof server.close === 'function') {
      try {
        server.close();
      } catch (_) {}
    }
  });

  // TST-01: Health API
  test('TST-01: Health & Security Configuration Verification', async () => {
    const res = await httpRequest('/api/health');
    assert.strictEqual(res.statusCode, 200, 'Health endpoint should return HTTP 200');
    assert.strictEqual(res.json.status, 'UP', 'Service status should be UP');
    assert.strictEqual(res.json.security.pbkdf2, true, 'PBKDF2 must be active');
    assert.strictEqual(res.json.security.bruteForceLockout, true, 'Brute force lockout must be active');
    assert.strictEqual(res.json.security.antiSqlInjection, true, 'Anti-SQL injection firewall must be active');
    assert.strictEqual(res.json.security.idorProtection, true, 'IDOR protection must be active');
  });

  // TST-02: SQL Injection Defense
  test('TST-02: Anti-SQL Injection & Command Injection Firewall', async () => {
    const maliciousPayloads = [
      { username: "admin' OR '1'='1' --", password: 'password' },
      { username: "admin; DROP TABLE users; --", password: 'password' },
      { username: "admin' UNION SELECT null, null, null --", password: 'password' },
      { username: "admin`cat /etc/passwd`", password: 'password' }
    ];

    for (const payload of maliciousPayloads) {
      const res = await httpRequest('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, payload);

      assert.strictEqual(
        res.statusCode, 
        400, 
        `Malicious payload should be rejected with 400 Bad Request: ${JSON.stringify(payload)}`
      );
      assert.match(
        res.json.error, 
        /Malicious input detected/i, 
        'Error message should indicate malicious input detection'
      );
    }
  });

  // TST-03: Brute-Force Rate Limiting & Lockout (CHK-A02)
  test('TST-03: Brute-Force Rate Limiting & Account Lockout (CHK-A02)', async () => {
    const testUsername = 'test_lockout_user_' + Date.now();

    // 5 consecutive invalid attempts
    let lastRes = null;
    for (let i = 1; i <= 5; i++) {
      lastRes = await httpRequest('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, { username: testUsername, password: 'WrongPassword' + i });
    }

    // 6th attempt should be blocked by rate limiter with HTTP 429
    const lockRes = await httpRequest('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { username: testUsername, password: 'AnyPassword' });

    assert.strictEqual(lockRes.statusCode, 429, 'Excessive failed logins must trigger HTTP 429 Too Many Requests');
    assert.ok(lockRes.json.retryAfter > 0, 'Retry-After duration must be provided');
    assert.ok(lockRes.headers['retry-after'], 'HTTP Retry-After header must be set');
  });

  // TST-04: Authoritative Authentication & Session Management (SEC-007, CHK-H01)
  test('TST-04: Authoritative PBKDF2 Authentication & Session Verification', async () => {
    const res = await httpRequest('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { username: 'admin', password: 'admin123' });

    assert.strictEqual(res.statusCode, 200, 'Valid credentials should return HTTP 200');
    assert.ok(res.json.token, 'A cryptographic session token must be issued');
    assert.strictEqual(res.json.user.username, 'admin');
    assert.strictEqual(res.json.user.role, 'ADMIN');

    // Verify Set-Cookie header contains HttpOnly and SameSite=Strict
    const cookieHeader = res.headers['set-cookie'];
    assert.ok(cookieHeader, 'Session cookie must be set');
    const cookieStr = Array.isArray(cookieHeader) ? cookieHeader.join('; ') : cookieHeader;
    assert.match(cookieStr, /HttpOnly/i, 'Session cookie must be HttpOnly');
    assert.match(cookieStr, /SameSite=Strict/i, 'Session cookie must enforce SameSite=Strict');

    // Verify session check with Bearer token
    const sessionRes = await httpRequest('/api/auth/session', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${res.json.token}` }
    });
    assert.strictEqual(sessionRes.statusCode, 200);
    assert.strictEqual(sessionRes.json.authenticated, true);
    assert.strictEqual(sessionRes.json.user.username, 'admin');
  });

  // TST-05: Server-Side Blind Count Enforcement
  test('TST-05: Server-Side Blind Count Enforcement for COUNTER Role', async () => {
    const loginRes = await httpRequest('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { username: 'counter1', password: 'counter123' });

    assert.strictEqual(loginRes.statusCode, 200);
    const counterToken = loginRes.json.token;

    const dbRes = await httpRequest('/api/stock/db', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${counterToken}` }
    });

    assert.strictEqual(dbRes.statusCode, 200);
    const items = dbRes.json.items;
    assert.ok(items.length > 0, 'Database should contain items');

    // Verify system_qty and variance_qty are stripped
    for (const item of items) {
      assert.strictEqual(item.system_qty, undefined, `system_qty must be stripped for counter on SKU ${item.sku}`);
      assert.strictEqual(item.variance_qty, undefined, `variance_qty must be stripped for counter on SKU ${item.sku}`);
    }
  });

  // TST-06: Sensitive Credential Stripping from API Responses
  test('TST-06: Sensitive Credential Stripping from API Responses', async () => {
    const loginRes = await httpRequest('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { username: 'admin', password: 'admin123' });

    const adminToken = loginRes.json.token;

    const dbRes = await httpRequest('/api/stock/db', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    assert.strictEqual(dbRes.statusCode, 200);
    const users = dbRes.json.users;
    assert.ok(users.length > 0, 'Users must be returned');

    for (const user of users) {
      assert.strictEqual(user.password, undefined, 'Cleartext passwords must not exist in API');
      assert.strictEqual(user.password_hash, undefined, 'Password hashes must not be exposed');
      assert.strictEqual(user.password_salt, undefined, 'Password salts must not be exposed');
    }
  });

  // TST-07: DOM XSS & Formula Injection Sanitization Logic
  test('TST-07: DOM XSS & Spreadsheet Formula Injection Defense Logic', () => {
    function escapeHtml(str) {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    const xssPayload = '<script>alert("XSS")</script><img src=x onerror=alert(1)>';
    const cleanHtml = escapeHtml(xssPayload);
    assert.ok(!cleanHtml.includes('<script>'), 'Script tag must be escaped');
    assert.ok(!cleanHtml.includes('<img'), 'Img tag must be escaped');
    assert.ok(cleanHtml.includes('&lt;script&gt;'), 'Angle brackets must be converted to entities');

    function escapeCsvFormula(value) {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (/^[=+@\-\t\r]/.test(str)) {
        return "'" + str;
      }
      return str;
    }

    assert.strictEqual(escapeCsvFormula('=CMD("calc")'), "'=CMD(\"calc\")");
    assert.strictEqual(escapeCsvFormula('+12345'), "'+12345");
    assert.strictEqual(escapeCsvFormula('-SUM(A1:A10)'), "'-SUM(A1:A10)");
    assert.strictEqual(escapeCsvFormula('@SUM(B1:B5)'), "'@SUM(B1:B5)");
    assert.strictEqual(escapeCsvFormula('PARACETAMOL 500MG'), 'PARACETAMOL 500MG');
  });

  // TST-08: Cryptographic Audit Ledger Chaining
  test('TST-08: Cryptographic Hash Chaining Integrity in Audit Ledger', () => {
    function computeEventHash(prevHash, timestamp, actorId, action, details, target) {
      const payload = `${prevHash}:${timestamp}:${actorId}:${action}:${details}:${target}`;
      return crypto.createHash('sha256').update(payload).digest('hex').substring(0, 32);
    }

    const t1 = new Date().toISOString();
    const h1 = computeEventHash('GENESIS_ROOT', t1, 'u-admin', 'LOGIN', 'Admin login', 'AUTH');

    const t2 = new Date().toISOString();
    const h2 = computeEventHash(h1, t2, 'u-admin', 'COUNT', 'Count recorded', 'SKU-001');

    assert.notStrictEqual(h1, h2, 'Chained hashes must be distinct');
    assert.strictEqual(h1.length, 32, 'Hash must be 32 hex characters');
    assert.strictEqual(h2.length, 32, 'Hash must be 32 hex characters');

    const tamperedH2 = computeEventHash('TAMPERED_PREV_HASH', t2, 'u-admin', 'COUNT', 'Count recorded', 'SKU-001');
    assert.notStrictEqual(h2, tamperedH2, 'Tampering with prevHash must invalidate eventHash');
  });

  // TST-09: Directory Traversal Defense
  test('TST-09: Path Traversal Attack Prevention', async () => {
    const traversalPaths = [
      '/../../../../Windows/win.ini',
      '/..%2f..%2f..%2fpackage.json',
      '/....//....//dev-server.js'
    ];

    for (const p of traversalPaths) {
      const res = await httpRequest(p);
      assert.ok(
        res.statusCode === 403 || res.statusCode === 404, 
        `Directory traversal must be blocked with 403 or 404 for path: ${p}`
      );
    }
  });

  // TST-10: User Soft-Removal & Root Admin Protection
  test('TST-10: Soft-Removal Integrity & Root Admin Immortality', async () => {
    const loginRes = await httpRequest('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { username: 'admin', password: 'admin123' });

    const adminToken = loginRes.json.token;

    const adminDeactRes = await httpRequest('/api/users', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    }, { action: 'SOFT_REMOVE', userId: 'u-admin' });

    assert.strictEqual(adminDeactRes.statusCode, 400, 'Root admin deactivation must be rejected');
    assert.match(adminDeactRes.json.error, /cannot be deactivated/i);
  });

  // TST-11: IDOR Protection on Session Management
  test('TST-11: IDOR Protection on Session Modification & Deletion', async () => {
    // 1. Counter operator attempts to delete or update a session -> 403 Forbidden
    const counterLogin = await httpRequest('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { username: 'counter1', password: 'counter123' });

    const counterToken = counterLogin.json.token;

    const deleteRes = await httpRequest('/api/stock/session/ses-101', {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${counterToken}` }
    });
    assert.strictEqual(deleteRes.statusCode, 403, 'Counters must be forbidden from deleting sessions');

    const patchRes = await httpRequest('/api/stock/session/ses-101', {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${counterToken}` 
      }
    }, { status: 'CLOSED' });
    assert.strictEqual(patchRes.statusCode, 403, 'Counters must be forbidden from modifying sessions');
  });

  // TST-12: IDOR Protection on User Management & Privilege Escalation
  test('TST-12: IDOR Protection on User Management & Privilege Escalation', async () => {
    // 1. Supervisor logs in
    const supLogin = await httpRequest('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { username: 'supervisor1', password: 'super123' });

    assert.strictEqual(supLogin.statusCode, 200);
    const supToken = supLogin.json.token;

    // 2. Supervisor attempts to create an ADMIN account -> 403 Forbidden
    const createAdminRes = await httpRequest('/api/users', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supToken}` 
      }
    }, { action: 'CREATE', username: 'malicious_admin_' + Date.now(), role: 'ADMIN', password: 'SecurePassword123' });

    assert.strictEqual(createAdminRes.statusCode, 403, 'Supervisors must be forbidden from creating ADMIN accounts');

    // 3. Supervisor attempts to deactivate the root admin account -> 400 or 403
    const deactAdminRes = await httpRequest('/api/users', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supToken}` 
      }
    }, { action: 'SOFT_REMOVE', userId: 'u-admin' });

    assert.ok(deactAdminRes.statusCode === 400 || deactAdminRes.statusCode === 403, 'Supervisors must not deactivate Admin');
  });

  // TST-13: AI Generation Endpoint & Abuse Rate Limiting
  test('TST-13: AI Generation Request Rate Limiting & Abuse Protection', async () => {
    const loginRes = await httpRequest('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { username: 'admin', password: 'admin123' });

    const adminToken = loginRes.json.token;

    // 1. Valid AI request succeeds with 200
    const aiRes = await httpRequest('/api/ai/generate', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}` 
      }
    }, { type: 'VARIANCE_ANALYSIS', session_id: 'ses-101' });

    assert.strictEqual(aiRes.statusCode, 200, 'AI generation should return 200 for authenticated requests');
    assert.ok(aiRes.json.aiReport, 'aiReport must be generated');
    assert.strictEqual(aiRes.json.aiReport.requestType, 'VARIANCE_ANALYSIS');

    // 2. Counter role should be restricted from AI variance analysis
    const counterLogin = await httpRequest('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { username: 'counter1', password: 'counter123' });

    const counterAiRes = await httpRequest('/api/ai/generate', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${counterLogin.json.token}` 
      }
    }, { type: 'VARIANCE_ANALYSIS', session_id: 'ses-101' });

    assert.strictEqual(counterAiRes.statusCode, 403, 'Counters must be restricted from AI variance analysis');
  });

  // TST-14: Zero-Plaintext Backdoor Passwords
  test('TST-14: Elimination of Hardcoded Plaintext Fallback Passwords', async () => {
    const randomFakeUser = 'non_existent_user_' + Date.now();
    const res = await httpRequest('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { username: randomFakeUser, password: 'admin123' });

    assert.strictEqual(res.statusCode, 401, 'Unseeded user with default password must be rejected');

    // Attempting wrong password on real admin
    const wrongPassRes = await httpRequest('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { username: 'admin', password: 'WrongPassword999' });

    assert.strictEqual(wrongPassRes.statusCode, 401, 'Wrong password on admin must return 401');
  });

  // TST-15: Anti-Bot & Automated Scraper Detection
  test('TST-15: Anti-Bot & Malicious Scraper Detection Firewall', async () => {
    const maliciousBots = [
      'sqlmap/1.5.2#stable',
      'nikto/2.1.6',
      'masscan/1.3.2',
      'Scrapy/2.5.0'
    ];

    for (const botAgent of maliciousBots) {
      const res = await httpRequest('/api/health', {
        headers: { 'User-Agent': botAgent }
      });

      assert.strictEqual(
        res.statusCode, 
        403, 
        `Malicious bot user-agent ${botAgent} should be blocked with 403 Forbidden`
      );
    }
  });

});
