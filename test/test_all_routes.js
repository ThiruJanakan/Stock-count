const http = require('http');
const assert = require('assert');
const devServer = require('../dev-server.js');
const vercelApiHandler = require('../api/index.js');
const { resetAllRateLimits } = require('../lib/security');

const PORT = 5173;
const BASE_URL = `http://127.0.0.1:${PORT}`;

function makeRequest(path, options = {}, payload = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const req = http.request(url, {
      method: options.method || 'GET',
      headers: {
        'User-Agent': 'Route-Tester/1.0',
        ...(options.headers || {})
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });
    req.on('error', reject);
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

function simulateVercelRequest(urlPath, method = 'GET', headers = {}, body = null) {
  return new Promise((resolve) => {
    const mockReq = {
      url: urlPath,
      method: method,
      headers: {
        host: 'stock-count-gamma.vercel.app',
        'x-forwarded-proto': 'https',
        ...headers
      },
      socket: { remoteAddress: '127.0.0.1' },
      on: function (event, handler) {
        if (event === 'data' && body) {
          handler(Buffer.from(typeof body === 'object' ? JSON.stringify(body) : body));
        }
        if (event === 'end') {
          handler();
        }
      }
    };

    let statusCode = 200;
    let resHeaders = {};
    let resBody = '';

    const mockRes = {
      writeHead: function (status, h) {
        statusCode = status;
        if (h) resHeaders = Object.assign(resHeaders, h);
      },
      setHeader: function (k, v) {
        resHeaders[k] = v;
      },
      end: function (chunk) {
        if (chunk) resBody += chunk.toString();
        resolve({
          statusCode,
          headers: resHeaders,
          body: resBody
        });
      }
    };

    vercelApiHandler(mockReq, mockRes);
  });
}

async function runAllRouteTests() {
  console.log('=== STARTING COMPREHENSIVE ROUTE VERIFICATION ===\n');
  resetAllRateLimits();

  // Ensure server is listening
  await new Promise((resolve) => {
    if (devServer && !devServer.listening) {
      devServer.listen(PORT, '127.0.0.1', () => resolve());
    } else {
      resolve();
    }
  });

  let passed = 0;
  let failed = 0;

  async function check(name, fn) {
    try {
      await fn();
      console.log(`  [PASS] ${name}`);
      passed++;
    } catch (e) {
      console.error(`  [FAIL] ${name}:`, e.message);
      failed++;
    }
  }

  console.log('--- 1. Testing Standalone Dev Server Static Routes ---');
  await check('GET / returns 200 with HTML', async () => {
    const res = await makeRequest('/');
    assert.strictEqual(res.statusCode, 200);
    assert(res.body.includes('Lina Manufacturing'));
  });

  await check('GET /index.html returns 200', async () => {
    const res = await makeRequest('/index.html');
    assert.strictEqual(res.statusCode, 200);
    assert(res.body.includes('Lina Manufacturing'));
  });

  await check('GET /sw.js returns 200 with javascript', async () => {
    const res = await makeRequest('/sw.js');
    assert.strictEqual(res.statusCode, 200);
    assert(res.body.includes('CACHE_NAME') || res.body.includes('Service Worker'));
  });

  await check('GET /manifest.json returns 200', async () => {
    const res = await makeRequest('/manifest.json');
    assert.strictEqual(res.statusCode, 200);
    assert(res.body.includes('Lina Stock Verification'));
  });

  await check('GET /manifest.webmanifest returns 200', async () => {
    const res = await makeRequest('/manifest.webmanifest');
    assert.strictEqual(res.statusCode, 200);
    assert(res.body.includes('Lina Stock Verification'));
  });

  await check('GET /vendor/lucide.min.js returns 200', async () => {
    const res = await makeRequest('/vendor/lucide.min.js');
    assert.strictEqual(res.statusCode, 200);
    assert(res.body.length > 1000);
  });

  await check('GET /vendor/xlsx.full.min.js returns 200', async () => {
    const res = await makeRequest('/vendor/xlsx.full.min.js');
    assert.strictEqual(res.statusCode, 200);
    assert(res.body.length > 1000);
  });

  await check('GET /vendor/html5-qrcode.min.js returns 200', async () => {
    const res = await makeRequest('/vendor/html5-qrcode.min.js');
    assert.strictEqual(res.statusCode, 200);
    assert(res.body.length > 1000);
  });

  await check('GET /assets/lina_logo.jpg returns 200', async () => {
    const res = await makeRequest('/assets/lina_logo.jpg');
    assert.strictEqual(res.statusCode, 200);
  });

  console.log('\n--- 2. Testing Dev Server API Routes ---');
  await check('GET /api/health returns status UP or ok', async () => {
    const res = await makeRequest('/api/health');
    assert.strictEqual(res.statusCode, 200);
    const data = JSON.parse(res.body);
    assert(data.status === 'UP' || data.status === 'ok');
  });

  await check('GET /api/supabase/config returns config state', async () => {
    const res = await makeRequest('/api/supabase/config');
    assert.strictEqual(res.statusCode, 200);
    const data = JSON.parse(res.body);
    assert(data.hasOwnProperty('supabaseUrl'));
  });

  let adminToken = '';
  await check('POST /api/auth/login authenticates admin and returns token', async () => {
    const res = await makeRequest('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { username: 'admin', password: 'admin123' });
    assert.strictEqual(res.statusCode, 200);
    const data = JSON.parse(res.body);
    assert(data.token);
    assert.strictEqual(data.user.role, 'ADMIN');
    adminToken = data.token;
  });

  await check('GET /api/auth/session returns authenticated session', async () => {
    const res = await makeRequest('/api/auth/session', {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(res.statusCode, 200);
    const data = JSON.parse(res.body);
    assert(data.user);
    assert.strictEqual(data.user.username, 'admin');
  });

  await check('GET /api/stock/db returns full database snapshot', async () => {
    const res = await makeRequest('/api/stock/db', {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(res.statusCode, 200);
    const data = JSON.parse(res.body);
    assert(Array.isArray(data.sessions));
    assert(Array.isArray(data.items));
  });

  await check('GET /api/audit returns tamper-evident audit logs', async () => {
    const res = await makeRequest('/api/audit', {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(res.statusCode, 200);
    const data = JSON.parse(res.body);
    assert(Array.isArray(data.audit_trails));
  });

  console.log('\n--- 3. Testing Vercel Serverless Entrypoint (api/index.js) Routes ---');
  await check('Vercel: GET / serves index.html (Status 200)', async () => {
    const res = await simulateVercelRequest('/');
    assert.strictEqual(res.statusCode, 200);
    assert(res.body.includes('Lina Manufacturing'));
    assert(res.headers['Content-Type'].includes('text/html'));
  });

  await check('Vercel: GET /sw.js serves Service Worker with proper headers', async () => {
    const res = await simulateVercelRequest('/sw.js');
    assert.strictEqual(res.statusCode, 200);
    assert(res.headers['Content-Type'].includes('javascript'));
    assert(res.body.includes('CACHE_NAME') || res.body.includes('Service Worker'));
  });

  await check('Vercel: GET /manifest.webmanifest serves PWA manifest', async () => {
    const res = await simulateVercelRequest('/manifest.webmanifest');
    assert.strictEqual(res.statusCode, 200);
    assert(res.headers['Content-Type'].includes('json'));
  });

  await check('Vercel: GET /api/health returns 200 with status UP', async () => {
    const res = await simulateVercelRequest('/api/health');
    assert.strictEqual(res.statusCode, 200);
    const data = JSON.parse(res.body);
    assert(data.status === 'UP' || data.status === 'ok');
  });

  await check('Vercel: POST /api/auth/login logs in admin with PBKDF2', async () => {
    const res = await simulateVercelRequest('/api/auth/login', 'POST', {
      'content-type': 'application/json'
    }, { username: 'admin', password: 'admin123' });
    assert.strictEqual(res.statusCode, 200);
    const data = JSON.parse(res.body);
    assert(data.token);
    assert.strictEqual(data.user.role, 'ADMIN');
  });

  console.log('\n--- 4. Client-Side Tab & Routing Verification in index.html ---');
  const fs = require('fs');
  const path = require('path');
  const indexContent = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

  await check('index.html contains all 7 view sections', async () => {
    const expectedViews = [
      'view-dashboard',
      'view-counting',
      'view-reconciliation',
      'view-upload',
      'view-sessions',
      'view-users',
      'view-audit'
    ];
    for (const v of expectedViews) {
      assert(indexContent.includes(`id="${v}"`), `Missing view section ${v}`);
    }
  });

  await check('index.html switchView function highlights targetBtn and targetDrawerBtn', async () => {
    assert(indexContent.includes("targetBtn.classList.add('active');"));
    assert(indexContent.includes("targetDrawerBtn.classList.add('active');"));
  });

  await check('index.html contains admin delete session password modal', async () => {
    assert(indexContent.includes('id="adminDeleteSessionModalBackdrop"'));
    assert(indexContent.includes('id="adminDeleteSessionPasswordInput"'));
    assert(indexContent.includes('THIS ACTION CANNOT BE UNDONE!'));
  });

  await check('index.html contains smart sheet reconciliation modal', async () => {
    assert(indexContent.includes('id="smartSheetReconcileModalBackdrop"'));
    assert(indexContent.includes('id="reconcileKeepCounts"'));
    assert(indexContent.includes('id="reconcileAddNewItems"'));
    assert(indexContent.includes('id="reconcileRemoveMissing"'));
  });

  await check('index.html Add Unlisted button does not have duplicate plus icon', async () => {
    assert(!indexContent.includes('<span>+ Add Unlisted</span>'), 'Found duplicate plus in span!');
    assert(indexContent.includes('<span>Add Unlisted</span>'), 'Missing clean Add Unlisted span!');
  });

  console.log(`\n=== ROUTE VERIFICATION COMPLETE: ${passed} PASSED, ${failed} FAILED ===`);
  if (devServer && devServer.close) devServer.close();
  process.exit(failed > 0 ? 1 : 0);
}

runAllRouteTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
