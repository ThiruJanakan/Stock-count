/**
 * Lina Manufacturing · Comprehensive Input Validation, Sanitization & Secrets Audit Test Suite
 * 
 * Verifies:
 * - SQL Injection & Script Injection (XSS) Rejection across all API endpoints
 * - Malicious Query Parameter Detection & Interception
 * - Command Injection Character Rejection
 * - Unsafe File Upload Guards (file extension whitelist, MIME type, 25MB size limit)
 * - CSV & Spreadsheet Formula Injection Neutralization (=, +, -, @, \t, \r)
 * - Strict Input Types & Finite Positive Quantity Bounds (rejection of NaN, Infinity, negatives)
 * - Strict Enum Validation for Roles, Count Types, and Session Statuses
 * - Complete Secrets Audit (Zero exposed service keys or tokens in frontend/git)
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

let server;
try {
  server = require('../dev-server.js');
} catch (e) {
  console.warn('Server already started or loading error:', e.message);
}

const {
  resetAllRateLimits,
  checkSqlInjection,
  checkScriptInjection,
  checkMaliciousInput,
  sanitizeString,
  sanitizeHtml,
  sanitizeFormulaInjection,
  validatePositiveNumber,
  validateEnum,
  validateIdentifier,
  validateFileUpload,
  validateAndSanitizeInput
} = require('../lib/security');

const SERVER_BASE = 'http://localhost:5173';

function httpRequest(urlPath, options = {}, payload = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, SERVER_BASE);
    const reqOptions = {
      method: options.method || 'GET',
      headers: {
        'User-Agent': 'Lina-Validation-Test-Runner/1.0',
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

describe('Lina Manufacturing · Input Validation, Sanitization & Secrets Audit Suite', () => {

  let adminToken = '';

  before((_, done) => {
    resetAllRateLimits();
    const login = () => {
      httpRequest('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, { username: 'admin', password: 'admin123' }).then(res => {
        if (res.json && res.json.token) adminToken = res.json.token;
        done();
      }).catch(done);
    };

    httpRequest('/api/health').then(() => {
      login();
    }).catch(() => {
      if (server && !server.listening) {
        server.once('error', (err) => {
          if (err.code === 'EADDRINUSE') login();
          else done(err);
        });
        server.listen(5173, '127.0.0.1', () => login());
      } else {
        login();
      }
    });
  });

  after(() => {
    resetAllRateLimits();
    if (server && typeof server.close === 'function') {
      try {
        server.close();
      } catch (_) {}
    }
  });

  // 1. Query Parameter Injection Scanner
  test('VAL-01: Malicious Query Parameter Detection & Interception', async () => {
    const maliciousUrls = [
      "/api/audit?limit=10;DROP TABLE users;--",
      "/api/stock/session?sessionId=ses-1' OR '1'='1",
      "/api/health?test=<script>alert('XSS')</script>",
      "/api/stock/items?session_id=ses-123|whoami"
    ];

    for (const url of maliciousUrls) {
      const res = await httpRequest(url, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      assert.strictEqual(res.statusCode, 400, `Malicious query param should return HTTP 400 for: ${url}`);
      assert.match(res.json.error, /Malicious query parameter detected/i);
    }
  });

  // 2. Count Entry Strict Type & Negative/Infinity/NaN Rejection
  test('VAL-02: Quantity Type Enforcement (Reject NaN, Negative, Infinity, and Out-of-Bounds)', async () => {
    const invalidQuantities = [-1, -500, NaN, Infinity, -Infinity, 999999999, 'not-a-number', '100; DROP TABLE'];

    for (const qty of invalidQuantities) {
      const res = await httpRequest('/api/stock/count', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        }
      }, {
        session_id: 'ses-default',
        sku: 'TEST-SKU-001',
        counted_qty: qty,
        location: 'Aisle 1'
      });

      assert.strictEqual(res.statusCode, 400, `Invalid quantity "${qty}" must be rejected with HTTP 400`);
    }
  });

  // 3. Count Entry SQL & Script Injection Rejection
  test('VAL-03: Count Entry Injection Rejection on SKU and Location', async () => {
    const maliciousSubmissions = [
      { sku: "SKU-001' OR 1=1--", counted_qty: 5, location: 'Shelf A' },
      { sku: "SKU-001; DELETE FROM stock_items;--", counted_qty: 5, location: 'Shelf A' },
      { sku: "SKU-001", counted_qty: 5, location: "<script>alert('XSS')</script>" },
      { sku: "SKU-001`reboot`", counted_qty: 5, location: 'Shelf A' }
    ];

    for (const sub of maliciousSubmissions) {
      const res = await httpRequest('/api/stock/count', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        }
      }, {
        session_id: 'ses-default',
        ...sub
      });

      assert.strictEqual(res.statusCode, 400, `Malicious payload must be rejected with HTTP 400: ${JSON.stringify(sub)}`);
    }
  });

  // 4. User Provisioning Validation & Privilege Safety
  test('VAL-04: User Provisioning Input Validation & Injection Rejection', async () => {
    const invalidUsers = [
      { username: "us' OR 1=1--", full_name: "Hacker", role: "COUNTER", password: "password123" },
      { username: "user_valid", full_name: "<script>alert(1)</script>", role: "COUNTER", password: "password123" },
      { username: "ab", full_name: "Short User", role: "COUNTER", password: "password123" }, // < 3 chars
      { username: "valid_counter_x", full_name: "Valid User", role: "INVALID_ROLE", password: "password123" }
    ];

    for (const u of invalidUsers) {
      const res = await httpRequest('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        }
      }, {
        action: 'CREATE',
        ...u
      });

      assert.strictEqual(res.statusCode, 400, `Invalid user input must be rejected with HTTP 400: ${JSON.stringify(u)}`);
    }
  });

  // 5. File Upload Verification (Extension & Size Bounds)
  test('VAL-05: Unsafe File Upload Rejection', () => {
    const unsafeFiles = [
      { name: 'exploit.exe', mime: 'application/octet-stream', size: 1024 },
      { name: 'webshell.php', mime: 'application/x-php', size: 2048 },
      { name: 'payload.sh', mime: 'application/x-sh', size: 512 },
      { name: 'vector.svg', mime: 'image/svg+xml', size: 1024 },
      { name: 'huge_sheet.xlsx', mime: 'application/vnd.ms-excel', size: 30 * 1024 * 1024 }, // > 25MB
      { name: 'zero_byte.csv', mime: 'text/csv', size: 0 }
    ];

    for (const f of unsafeFiles) {
      const check = validateFileUpload(f.name, f.mime, f.size);
      assert.strictEqual(check.valid, false, `Unsafe upload "${f.name}" should be rejected`);
      assert.ok(check.error, 'An explicit rejection message must be provided');
    }

    const validFiles = [
      { name: 'inventory_master.xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 50000 },
      { name: 'legacy_stock.xls', mime: 'application/vnd.ms-excel', size: 40000 },
      { name: 'warehouse_floor.csv', mime: 'text/csv', size: 12000 }
    ];

    for (const f of validFiles) {
      const check = validateFileUpload(f.name, f.mime, f.size);
      assert.strictEqual(check.valid, true, `Valid file "${f.name}" must be accepted`);
    }
  });

  // 6. CSV & Spreadsheet Formula Injection Neutralization
  test('VAL-06: CSV / Spreadsheet Formula Injection Neutralization', () => {
    assert.strictEqual(sanitizeFormulaInjection('=cmd|\' /C calc\'!A0'), "'=cmd|' /C calc'!A0");
    assert.strictEqual(sanitizeFormulaInjection('+12345'), "'+12345");
    assert.strictEqual(sanitizeFormulaInjection('-2000'), "'-2000");
    assert.strictEqual(sanitizeFormulaInjection('@SUM(A1:A10)'), "'@SUM(A1:A10)");
    assert.strictEqual(sanitizeFormulaInjection('\tTabPayload'), "'\tTabPayload");
    assert.strictEqual(sanitizeFormulaInjection('\rCarriagePayload'), "'\rCarriagePayload");
    assert.strictEqual(sanitizeFormulaInjection('Safe Item Description'), 'Safe Item Description');
  });

  // 7. Strict Enum Validation
  test('VAL-07: Strict Enum Validation for Roles, Count Types & Statuses', () => {
    const roleCheck = validateEnum('ADMIN', ['ADMIN', 'MANAGER', 'SUPERVISOR', 'COUNTER', 'EXECUTIVE']);
    assert.strictEqual(roleCheck.valid, true);

    const badRoleCheck = validateEnum('ROOT_SUPERUSER', ['ADMIN', 'MANAGER', 'SUPERVISOR', 'COUNTER', 'EXECUTIVE']);
    assert.strictEqual(badRoleCheck.valid, false);

    const typeCheck = validateEnum('BLIND_COUNT', ['PHYSICAL', 'CYCLE', 'BLIND_COUNT', 'OPEN_COUNT']);
    assert.strictEqual(typeCheck.valid, true);

    const badTypeCheck = validateEnum('HACKER_COUNT', ['PHYSICAL', 'CYCLE', 'BLIND_COUNT', 'OPEN_COUNT']);
    assert.strictEqual(badTypeCheck.valid, false);
  });

  // 8. Secrets Audit: Scan Frontend Files for Exposed Keys
  test('VAL-08: Complete Secrets Audit - Zero Leaked API Keys in Client Code or Git', () => {
    const rootDir = path.join(__dirname, '..');
    const frontendFiles = [
      path.join(rootDir, 'index.html'),
      path.join(rootDir, 'public', 'index.html'),
      path.join(rootDir, 'Stock_Count_System_V5.html'),
      path.join(rootDir, 'public', 'Stock_Count_System_V5.html'),
      path.join(rootDir, 'app', 'src', 'main', 'assets', 'index.html'),
      path.join(rootDir, 'app', 'src', 'main', 'assets', 'Stock_Count_System_V5.html')
    ];

    for (const f of frontendFiles) {
      if (fs.existsSync(f)) {
        const text = fs.readFileSync(f, 'utf8');
        // Check for private / secret key leaks
        assert.ok(!text.includes('SUPABASE_SECRET_KEY'), `SUPABASE_SECRET_KEY must never exist in frontend file: ${f}`);
        assert.ok(!text.includes('service_role'), `service_role secret must never exist in frontend file: ${f}`);
        assert.ok(!text.includes('SESSION_SECRET'), `SESSION_SECRET must never exist in frontend file: ${f}`);
      }
    }

    // Check .gitignore ignores .env and variants
    const gitignorePath = path.join(rootDir, '.gitignore');
    const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
    assert.ok(gitignoreContent.includes('.env'), '.gitignore must ignore .env');
    assert.ok(gitignoreContent.includes('.env.*'), '.gitignore must ignore .env.*');
    assert.ok(gitignoreContent.includes('*.env'), '.gitignore must ignore *.env');
  });

});
