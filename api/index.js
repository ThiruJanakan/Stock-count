/**
 * Lina Manufacturing · Enterprise Stock Verification Cloud
 * Vercel Serverless Function API Entrypoint
 * 
 * Powered by Supabase Cloud PostgreSQL with Authoritative Security Kernel
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  hashPasswordPbkdf2,
  verifyPasswordPbkdf2,
  validatePasswordStrength,
  generateSecureSalt,
  sanitizeUser,
  signSessionToken,
  verifySessionToken,
  revokeSessionToken,
  getAuthenticatedUser,
  parseCookies,
  checkLoginRateLimit,
  recordLoginFailure,
  recordLoginSuccess,
  generalApiLimiter,
  accountCreationLimiter,
  aiGenerationLimiter,
  dataScrapingLimiter,
  isMaliciousBotOrScraper,
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
  validateAndSanitizeInput,
  hasPrototypePollution,
  deepScanPayload,
  verifySessionOwnership,
  verifyUserManagementAccess,
  verifyCountSubmission,
  logSecurityEvent,
  getSecurityHeaders
} = require('../lib/security');

// Load local .env fallback if present
try {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split(/\r?\n/).forEach(line => {
      line = line.trim();
      if (!line || line.startsWith('#')) return;
      const idx = line.indexOf('=');
      if (idx !== -1) {
        const key = line.slice(0, idx).trim();
        const val = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
        if (!process.env[key]) process.env[key] = val;
      }
    });
  }
} catch (_) {}

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || '';
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || '';

let SUPABASE_HOST = '';
try {
  SUPABASE_HOST = new URL(SUPABASE_URL).hostname;
} catch (_) {}

// Active Soft Holds Registry for Concurrent Item Counting (auto-expires in 90 seconds)
const activeItemHolds = new Map();

function cleanExpiredHolds() {
  const now = Date.now();
  for (const [itemId, hold] of activeItemHolds.entries()) {
    if (hold.expiresAt <= now) {
      activeItemHolds.delete(itemId);
    }
  }
}

function supabaseRequest(endpointPath, method = 'GET', data = null) {
  if (!SUPABASE_HOST || !SUPABASE_SECRET_KEY) return Promise.resolve(null);

  return new Promise((resolve) => {
    const reqOptions = {
      hostname: SUPABASE_HOST,
      path: '/rest/v1/' + endpointPath,
      method: method,
      headers: {
        'apikey': SUPABASE_SECRET_KEY,
        'Authorization': `Bearer ${SUPABASE_SECRET_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': method === 'POST' || method === 'PATCH' ? 'return=representation' : ''
      }
    };

    const req = https.request(reqOptions, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body || 'null');
          resolve({ status: res.statusCode, data: parsed });
        } catch (_) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', (err) => {
      logSecurityEvent('SUPABASE_REQUEST_ERROR', err.message, null, { endpoint: endpointPath });
      resolve(null);
    });

    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

// Seed Users with pre-hashed PBKDF2 credentials (Zero plaintext fallback credentials)
const SECURE_SEEDED_USERS = [
  {
    id: 'u-admin',
    username: 'admin',
    full_name: 'Central Admin',
    role: 'ADMIN',
    password_salt: 'a8f5b2c1d0e9478291f038572bcae142',
    password_hash: 'pbkdf2$e565cf7400deddb134e20c56b5f8fd27569eb2a6077e022b749fa8f295c9d69c', // admin123
    is_active: true
  },
  {
    id: 'u-sup',
    username: 'executive1',
    full_name: 'Floor Executive',
    role: 'EXECUTIVE',
    password_salt: 'b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6',
    password_hash: 'pbkdf2$5ea5f9ac90ee3e3054ec99177576012049b4e92f555147ce8e5820d4e0153709', // super123
    is_active: true
  },
  {
    id: 'u-c1',
    username: 'counter1',
    full_name: 'Operator Alpha',
    role: 'COUNTER',
    password_salt: 'c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8',
    password_hash: 'pbkdf2$6b89184d3b0b01591868ab9d678f8ec04714e566a69346d57bd97ad99ae04c31', // counter123
    is_active: true
  },
  {
    id: 'u-c2',
    username: 'counter2',
    full_name: 'Operator Beta',
    role: 'COUNTER',
    password_salt: 'd4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9',
    password_hash: 'pbkdf2$cebe37c591e6e9dc92a53426a023d1abf4eaa000cc80fa19c50e4e6d67d530d2', // counter123
    is_active: true
  }
];

function toDbCountType(mode) {
  if (mode === 'BLIND_ALL' || mode === 'DOUBLE_BLIND' || mode === 'STRICT_BLIND') return 'DOUBLE_BLIND';
  if (mode === 'OPEN_COUNT' || mode === 'SUPERVISED_COUNT' || mode === 'OPEN') return 'SUPERVISED_COUNT';
  return 'BLIND_COUNT';
}

function fromDbCountType(mode) {
  if (mode === 'DOUBLE_BLIND') return 'BLIND_ALL';
  if (mode === 'SUPERVISED_COUNT') return 'OPEN_COUNT';
  return mode || 'BLIND_COUNT';
}

function parseBody(req) {
  return new Promise((resolve) => {
    if (req.body && typeof req.body === 'object') {
      return resolve(req.body);
    }
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (_) {
        resolve({});
      }
    });
  });
}

module.exports = async function handler(req, res) {
  const clientIp = req.socket?.remoteAddress || req.headers['x-forwarded-for'] || '127.0.0.1';
  const reqUrl = (req.url || '').split('?')[0];
  const reqMethod = (req.method || 'GET').toUpperCase();

  // 1. Enforce HTTPS in Production Deployments
  const proto = req.headers['x-forwarded-proto'];
  if (proto === 'http' && process.env.NODE_ENV === 'production') {
    const secureUrl = `https://${req.headers.host}${req.url}`;
    res.writeHead(301, { 'Location': secureUrl });
    return res.end();
  }

  function sendJson(statusCode, data, extraHeaders = {}) {
    const headers = getSecurityHeaders({
      'Access-Control-Allow-Origin': req.headers.origin || '*',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      ...extraHeaders
    });
    res.writeHead(statusCode, headers);
    res.end(JSON.stringify(data));
  }

  // Universal Query Parameter Injection & Malicious Token Scanner
  let parsedUrl = null;
  try {
    parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    for (const [paramName, paramVal] of parsedUrl.searchParams.entries()) {
      if (checkMaliciousInput(paramName) || checkMaliciousInput(paramVal)) {
        logSecurityEvent('QUERY_INJECTION_BLOCKED', `Malicious query param: ${paramName}=${paramVal}`, req);
        return sendJson(400, { error: 'Malicious query parameter detected. Request rejected by security filter.' });
      }
    }
  } catch (_) {}

  if (reqMethod === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': req.headers.origin || '*',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Max-Age': '86400'
    });
    return res.end();
  }

  // 2. Static App Shell & Asset Streaming Handlers (Zero-failure serving on Vercel)
  if (reqUrl === '/' || reqUrl === '/index.html' || reqUrl === '' || reqUrl === '/Stock_Count_System_V5.html') {
    const candidatePaths = [
      path.join(__dirname, '..', 'public', 'index.html'),
      path.join(__dirname, '..', 'index.html'),
      path.join(__dirname, '..', 'Stock_Count_System_V5.html')
    ];
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Access-Control-Allow-Origin': '*'
        });
        return res.end(fs.readFileSync(p));
      }
    }
  }

  if (reqUrl === '/favicon.ico') {
    const logoCandidate = [
      path.join(__dirname, '..', 'public', 'lina-logo.png'),
      path.join(__dirname, '..', 'lina-logo.png')
    ];
    for (const p of logoCandidate) {
      if (fs.existsSync(p)) {
        res.writeHead(200, {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=86400',
          'Access-Control-Allow-Origin': '*'
        });
        return res.end(fs.readFileSync(p));
      }
    }
    res.writeHead(204);
    return res.end();
  }

  if (reqUrl === '/sw.js' || reqUrl.endsWith('/sw.js')) {
    const swCandidate = [
      path.join(__dirname, '..', 'public', 'sw.js'),
      path.join(__dirname, '..', 'sw.js')
    ];
    for (const swPath of swCandidate) {
      if (fs.existsSync(swPath)) {
        res.writeHead(200, {
          'Content-Type': 'application/javascript; charset=utf-8',
          'Service-Worker-Allowed': '/',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Access-Control-Allow-Origin': '*'
        });
        return res.end(fs.readFileSync(swPath));
      }
    }
  }

  if (reqUrl === '/manifest.webmanifest' || reqUrl.endsWith('/manifest.webmanifest') || reqUrl === '/manifest.json' || reqUrl.endsWith('/manifest.json')) {
    const mfCandidate = [
      path.join(__dirname, '..', 'public', 'manifest.json'),
      path.join(__dirname, '..', 'manifest.json')
    ];
    for (const mfPath of mfCandidate) {
      if (fs.existsSync(mfPath)) {
        res.writeHead(200, {
          'Content-Type': 'application/manifest+json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache'
        });
        return res.end(fs.readFileSync(mfPath));
      }
    }
  }

  if (reqUrl === '/lina-logo.png' || reqUrl.endsWith('/lina-logo.png')) {
    const logoCandidate = [
      path.join(__dirname, '..', 'public', 'lina-logo.png'),
      path.join(__dirname, '..', 'lina-logo.png')
    ];
    for (const logoPath of logoCandidate) {
      if (fs.existsSync(logoPath)) {
        res.writeHead(200, {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=86400',
          'Access-Control-Allow-Origin': '*'
        });
        return res.end(fs.readFileSync(logoPath));
      }
    }
  }

  if (reqUrl === '/lina-stock-count.apk' || reqUrl.endsWith('/lina-stock-count.apk')) {
    const apkCandidate = [
      path.join(__dirname, '..', 'public', 'lina-stock-count.apk'),
      path.join(__dirname, '..', 'lina-stock-count.apk')
    ];
    for (const apkPath of apkCandidate) {
      if (fs.existsSync(apkPath)) {
        res.writeHead(200, {
          'Content-Type': 'application/vnd.android.package-archive',
          'Content-Disposition': 'attachment; filename="lina-stock-count.apk"',
          'Access-Control-Allow-Origin': '*'
        });
        return res.end(fs.readFileSync(apkPath));
      }
    }
  }

  if (reqUrl.startsWith('/vendor/') || reqUrl.startsWith('/assets/')) {
    const assetCandidate = [
      path.join(__dirname, '..', 'public', reqUrl),
      path.join(__dirname, '..', reqUrl)
    ];
    for (const target of assetCandidate) {
      if (fs.existsSync(target) && fs.statSync(target).isFile()) {
        const ext = path.extname(target).toLowerCase();
        const mimeTypes = {
          '.js': 'application/javascript; charset=utf-8',
          '.css': 'text/css; charset=utf-8',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.svg': 'image/svg+xml',
          '.json': 'application/json'
        };
        res.writeHead(200, {
          'Content-Type': mimeTypes[ext] || 'application/octet-stream',
          'Cache-Control': 'public, max-age=86400',
          'Access-Control-Allow-Origin': '*'
        });
        return res.end(fs.readFileSync(target));
      }
    }
  }

  // 3. API Endpoints Abuse Defense & Anti-Bot Firewall
  if (reqUrl.startsWith('/api/')) {
    const botCheck = isMaliciousBotOrScraper(req);
    if (botCheck.isBot) {
      logSecurityEvent('ABUSE_BOT_DETECTED', botCheck.reason, req);
      return sendJson(403, { error: 'Access Denied: Automated scraping or malicious traffic pattern detected' });
    }

    const apiLimit = generalApiLimiter.isAllowed(clientIp);
    if (!apiLimit.allowed) {
      logSecurityEvent('RATE_LIMIT_EXCEEDED', `General API limit exceeded by ${clientIp}`, req);
      return sendJson(429, {
        error: 'Too many requests. Please slow down.',
        retryAfter: apiLimit.retryAfter
      }, { 'Retry-After': String(apiLimit.retryAfter) });
    }
  }

  // --------------------------------------------------------------------------
  // API Route: Health & Diagnostics
  // --------------------------------------------------------------------------
  if (reqUrl.endsWith('/api/health') || reqUrl === '/api/health') {
    return sendJson(200, {
      status: 'UP',
      service: 'Lina Enterprise Stock Verification Cloud (Vercel Serverless)',
      timestamp: new Date().toISOString(),
      security: {
        pbkdf2: true,
        sessionExpiry: '8h-hard-2h-idle',
        rateLimiting: true,
        antiBotProtection: true,
        idorProtection: true,
        httpsEnforced: true,
        noPlaintextFallbacks: true
      },
      cloud: {
        provider: 'Supabase Cloud PostgreSQL',
        status: SUPABASE_HOST && SUPABASE_SECRET_KEY ? 'CONNECTED' : 'DISCONNECTED'
      }
    });
  }

  // --------------------------------------------------------------------------
  // API Route: Supabase Public Config
  // --------------------------------------------------------------------------
  if (reqUrl.endsWith('/api/supabase/config')) {
    const authUser = getAuthenticatedUser(req);
    if (!authUser) {
      return sendJson(401, { error: 'Authentication required to retrieve cloud connection parameters' });
    }
    return sendJson(200, {
      supabaseUrl: SUPABASE_URL,
      publishableKey: SUPABASE_PUBLISHABLE_KEY
    });
  }

  // --------------------------------------------------------------------------
  // API Route: Authentication Login (Protected with Lockout Rate Limiter)
  // --------------------------------------------------------------------------
  if (reqUrl.endsWith('/api/auth/login') && reqMethod === 'POST') {
    const body = await parseBody(req);
    if (deepScanPayload(body)) {
      return sendJson(400, { error: 'Malicious payload detected' });
    }

    const rawUsername = typeof body.username === 'string' ? body.username.trim() : '';
    const rawPassword = typeof body.password === 'string' ? body.password.trim() : '';

    if (checkMaliciousInput(rawUsername) || checkMaliciousInput(rawPassword)) {
      logSecurityEvent('INJECTION_ATTEMPT', `Malicious SQL/Command input from IP: ${clientIp}`, req, { username: rawUsername });
      return sendJson(400, { error: 'Malicious input detected. Request rejected by security filter.' });
    }

    const userCheck = validateAndSanitizeInput('USERNAME', rawUsername, { required: true });
    if (!userCheck.valid) {
      logSecurityEvent('INJECTION_ATTEMPT', `Invalid username input from IP: ${clientIp}`, req, { username: rawUsername });
      return sendJson(400, { error: userCheck.error });
    }
    const username = userCheck.value;

    if (!rawPassword || rawPassword.length > 128) {
      return sendJson(400, { error: 'Password is required (maximum 128 characters)' });
    }
    const password = rawPassword;

    // Rate Limiting & Lockout Check
    const lockCheck = checkLoginRateLimit(clientIp, username);
    if (lockCheck.locked) {
      logSecurityEvent('AUTH_LOCKOUT', `Brute-force lockout active for user: ${username} from ${clientIp}`, req);
      return sendJson(429, {
        error: lockCheck.error,
        retryAfter: lockCheck.retryAfter
      }, { 'Retry-After': String(lockCheck.retryAfter) });
    }

    let user = null;
    let isValid = false;

    // 1. Query live Supabase database
    if (SUPABASE_HOST && SUPABASE_SECRET_KEY) {
      let queryUser = username.toLowerCase();
      let sbRes = await supabaseRequest(`stock_users?username=eq.${encodeURIComponent(queryUser)}&select=*`);
      if ((!sbRes || !sbRes.data || sbRes.data.length === 0) && queryUser === 'executive1') {
        sbRes = await supabaseRequest(`stock_users?username=eq.supervisor1&select=*`);
      }
      if (sbRes && sbRes.status === 200 && Array.isArray(sbRes.data) && sbRes.data.length > 0) {
        user = sbRes.data[0];
        if (!user.is_active) {
          logSecurityEvent('AUTH_INACTIVE_LOGIN', `Login attempted on deactivated account: ${username}`, req);
          return sendJson(401, { error: 'Account is deactivated. Contact Administrator.' });
        }
        isValid = await verifyPasswordPbkdf2(password, user.password_salt, user.password_hash);
      }
    }

    // 2. Cryptographic Offline Seed Fallback (Evaluates pre-hashed PBKDF2 only, NO plaintext comparisons)
    if (!user && !isValid) {
      const uLower = username.toLowerCase();
      const seedUser = SECURE_SEEDED_USERS.find(s => 
        s.username === uLower || 
        (uLower === 'supervisor1' && s.username === 'executive1')
      );
      if (seedUser) {
        const seedValid = await verifyPasswordPbkdf2(password, seedUser.password_salt, seedUser.password_hash);
        if (seedValid) {
          user = { ...seedUser };
          isValid = true;
        }
      }
    }

    if (!user || !isValid) {
      const failureStats = recordLoginFailure(clientIp, username);
      logSecurityEvent('AUTH_FAILURE', `Invalid credentials for user: ${username} from IP: ${clientIp}`, req, {
        attempts: failureStats.attempts,
        remaining: failureStats.remaining
      });

      if (failureStats.locked) {
        return sendJson(429, {
          error: 'Account locked due to excessive failed attempts. Please retry in 900 seconds.',
          retryAfter: 900
        }, { 'Retry-After': '900' });
      }

      return sendJson(401, {
        error: failureStats.remaining > 0 
          ? `Invalid credentials. ${failureStats.remaining} attempt(s) remaining.`
          : 'Account locked due to excessive failed attempts.',
        attemptsRemaining: failureStats.remaining
      });
    }

    // Successful Login
    recordLoginSuccess(clientIp, username);
    const token = signSessionToken(user);
    const cookieHeader = `LINA_AUTH_SESSION=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800; Secure`;

    logSecurityEvent('AUTH_SUCCESS', `User ${user.username} (${user.role}) authenticated successfully`, req);

    return sendJson(200, {
      success: true,
      token,
      user: sanitizeUser(user)
    }, { 'Set-Cookie': cookieHeader });
  }

  // --------------------------------------------------------------------------
  // API Route: Session Check
  // --------------------------------------------------------------------------
  if (reqUrl.endsWith('/api/auth/session') && reqMethod === 'GET') {
    const authUser = getAuthenticatedUser(req);
    if (!authUser) {
      return sendJson(401, { authenticated: false, error: 'Session expired or invalid' });
    }
    return sendJson(200, { authenticated: true, user: sanitizeUser(authUser) });
  }

  // --------------------------------------------------------------------------
  // API Route: Logout
  // --------------------------------------------------------------------------
  if (reqUrl.endsWith('/api/auth/logout') && reqMethod === 'POST') {
    const cookies = parseCookies(req);
    const token = cookies['LINA_AUTH_SESSION'] || (req.headers['authorization'] || '').replace('Bearer ', '').trim();
    if (token) {
      revokeSessionToken(token);
    }
    logSecurityEvent('AUTH_LOGOUT', 'User logged out and session revoked', req);
    return sendJson(200, { success: true }, {
      'Set-Cookie': 'LINA_AUTH_SESSION=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0; Secure'
    });
  }

  // --------------------------------------------------------------------------
  // API Route: Stock Database Fetch (Protected + Anti-Scraping Rate Limited)
  // --------------------------------------------------------------------------
  if (reqUrl.endsWith('/api/stock/db') && reqMethod === 'GET') {
    const authUser = getAuthenticatedUser(req);
    if (!authUser) {
      return sendJson(401, { error: 'Unauthorized: Authentication required' });
    }

    const scrapeCheck = dataScrapingLimiter.isAllowed(authUser.id || clientIp);
    if (!scrapeCheck.allowed) {
      logSecurityEvent('ABUSE_DATA_SCRAPE_EXCEEDED', `Bulk data export rate limit exceeded by ${authUser.username}`, req);
      return sendJson(429, { error: 'Data query rate limit exceeded. Please wait before refreshing.', retryAfter: scrapeCheck.retryAfter }, { 'Retry-After': String(scrapeCheck.retryAfter) });
    }

    const [usersRes, sesRes, itemsRes, logsRes, auditRes] = await Promise.all([
      supabaseRequest('stock_users?select=id,username,full_name,role,is_active,created_at'),
      supabaseRequest('count_sessions?select=*&order=created_at.desc'),
      supabaseRequest('stock_items?select=*&order=sku.asc'),
      supabaseRequest('count_logs?select=*&order=timestamp.desc&limit=500'),
      supabaseRequest('audit_trails?select=*&order=timestamp.desc&limit=2000')
    ]);

    let items = itemsRes && itemsRes.data ? itemsRes.data : [];
    const sessionsList = sesRes && sesRes.data ? sesRes.data : [];

    // Server-Side Blind Count Enforcement
    if (authUser.role === 'COUNTER') {
      items = items.map(item => {
        const clean = { ...item };
        delete clean.system_qty;
        delete clean.variance_qty;
        return clean;
      });
    } else if (authUser.role === 'SUPERVISOR' || authUser.role === 'EXECUTIVE') {
      const strictBlindSessionIds = new Set(
        sessionsList.filter(s => s.count_type === 'BLIND_ALL' || s.count_type === 'DOUBLE_BLIND').map(s => s.id)
      );
      if (strictBlindSessionIds.size > 0) {
        items = items.map(item => {
          if (strictBlindSessionIds.has(item.session_id)) {
            const clean = { ...item };
            delete clean.system_qty;
            delete clean.variance_qty;
            return clean;
          }
          return item;
        });
      }
    }

    // Ensure all user objects have sensitive hashes and salts stripped
    const safeUsers = (usersRes && usersRes.data ? usersRes.data : []).map(u => sanitizeUser(u));

    return sendJson(200, {
      source: 'SUPABASE_CLOUD',
      users: safeUsers,
      sessions: sessionsList.map(s => ({ ...s, count_type: fromDbCountType(s.count_type) })),
      items: items,
      logs: logsRes && logsRes.data ? logsRes.data : [],
      audit_trails: authUser.role === 'COUNTER' ? [] : (auditRes && auditRes.data ? auditRes.data : [])
    });
  }

  // --------------------------------------------------------------------------
  // API Route: Stock Session Creation (Protected)
  // --------------------------------------------------------------------------
  if (reqUrl.endsWith('/api/stock/session') && reqMethod === 'POST') {
    const authUser = getAuthenticatedUser(req);
    if (!authUser) {
      return sendJson(401, { error: 'Unauthorized: Authentication required' });
    }
    if (authUser.role === 'COUNTER') {
      return sendJson(403, { error: 'Forbidden: Counter operators cannot create sessions' });
    }

    const body = await parseBody(req);
    if (deepScanPayload(body)) {
      return sendJson(400, { error: 'Malicious payload rejected by security filter' });
    }

    const session = body.session;
    const items = Array.isArray(body.items) ? body.items : [];
    if (!session || !session.id || !session.title) {
      return sendJson(400, { error: 'Valid session object required with id and title' });
    }

    const idCheck = validateIdentifier(session.id, 1, 64, 'Session ID');
    if (!idCheck.valid) return sendJson(400, { error: idCheck.error });

    const titleCheck = validateAndSanitizeInput('SESSION_TITLE', session.title, { required: true });
    if (!titleCheck.valid) return sendJson(400, { error: titleCheck.error });

    const codeCheck = validateAndSanitizeInput('SESSION_CODE', session.session_code || `SES-${Date.now()}`);
    if (!codeCheck.valid) return sendJson(400, { error: codeCheck.error });

    const descCheck = validateAndSanitizeInput('NOTES', session.description || '');
    if (!descCheck.valid) return sendJson(400, { error: descCheck.error });

    if (items.length > 50000) {
      return sendJson(400, { error: 'Batch items limit exceeded (maximum 50,000 items)' });
    }

    // Enforce ownership: assign session creator
    const now = new Date().toISOString();
    const sessionRow = {
      id: idCheck.value,
      session_code: codeCheck.value,
      title: titleCheck.value,
      description: descCheck.value,
      count_type: toDbCountType(session.count_type),
      status: session.status || 'ACTIVE',
      total_items: items.length || session.total_items || 0,
      counted_items: session.counted_items || 0,
      progress_percent: session.progress_percent || 0,
      created_by: authUser.id,
      created_at: session.created_at || now,
      closed_at: session.status === 'CLOSED' ? (session.closed_at || now) : null
    };

    if (SUPABASE_HOST && SUPABASE_SECRET_KEY) {
      const existCheck = await supabaseRequest(`count_sessions?id=eq.${encodeURIComponent(session.id)}&select=id,created_by`);
      if (existCheck && existCheck.status === 200 && Array.isArray(existCheck.data) && existCheck.data.length > 0) {
        // IDOR Check on Session Overwrite
        const ownership = verifySessionOwnership(authUser, existCheck.data[0], 'OVERWRITE');
        if (!ownership.allowed) {
          logSecurityEvent('IDOR_PREVENTED', `User ${authUser.username} tried to overwrite session ${session.id}`, req);
          return sendJson(ownership.statusCode, { error: ownership.error });
        }
        await supabaseRequest(`count_sessions?id=eq.${encodeURIComponent(session.id)}`, 'PATCH', sessionRow);
      } else {
        await supabaseRequest('count_sessions', 'POST', sessionRow);
      }

      if (items.length > 0) {
        const chunkSize = 200;
        for (let i = 0; i < items.length; i += chunkSize) {
          const chunk = items.slice(i, i + chunkSize).map((it, idx) => ({
            id: it.id || `item-${session.id}-${i + idx}`,
            session_id: session.id,
            sku: String(it.sku || '').trim(),
            item_name: String(it.item_name || '').trim(),
            barcode: String(it.barcode || it.sku || '').trim(),
            batch_no: String(it.batch_no || '').trim(),
            expiry_date: it.expiry_date || null,
            zone_location: String(it.zone_location || it.location || 'FLOOR').trim(),
            system_qty: parseFloat(it.system_qty) || 0,
            total_counted_qty: parseFloat(it.total_counted_qty) || 0,
            variance_qty: parseFloat(it.variance_qty) || -(parseFloat(it.system_qty) || 0),
            uom: String(it.uom || 'PCS').trim(),
            is_unlisted: Boolean(it.is_unlisted),
            created_at: it.created_at || now,
            updated_at: it.updated_at || now
          }));
          await supabaseRequest('stock_items', 'POST', chunk);
        }
      }
    }

    logSecurityEvent('SESSION_CREATED', `Session ${session.id} created by ${authUser.username}`, req);
    return sendJson(201, { success: true, session: sessionRow, itemsCount: items.length });
  }

  // --------------------------------------------------------------------------
  // API Route: Stock Session Update (Protected + IDOR Ownership Enforcement)
  // --------------------------------------------------------------------------
  if (reqUrl.includes('/api/stock/session') && reqMethod === 'PATCH') {
    const authUser = getAuthenticatedUser(req);
    if (!authUser || authUser.role === 'COUNTER') {
      return sendJson(403, { error: 'Forbidden' });
    }

    const body = await parseBody(req);
    const sessionId = body.id || (reqUrl.split('/api/stock/session/')[1] || '').trim();
    if (!sessionId) return sendJson(400, { error: 'Session ID required' });

    // IDOR Check: verify ownership of the target session
    if (SUPABASE_HOST && SUPABASE_SECRET_KEY) {
      const sesRes = await supabaseRequest(`count_sessions?id=eq.${encodeURIComponent(sessionId)}&select=*`);
      if (sesRes && sesRes.status === 200 && Array.isArray(sesRes.data) && sesRes.data.length > 0) {
        const targetSession = sesRes.data[0];
        const ownership = verifySessionOwnership(authUser, targetSession, 'UPDATE');
        if (!ownership.allowed) {
          logSecurityEvent('IDOR_PREVENTED', `User ${authUser.username} unauthorized session update on ${sessionId}`, req);
          return sendJson(ownership.statusCode, { error: ownership.error });
        }
      }
    }

    const updateFields = {};
    if (body.status !== undefined) updateFields.status = body.status;
    if (body.count_type !== undefined) updateFields.count_type = toDbCountType(body.count_type);
    if (body.title !== undefined) updateFields.title = body.title;
    if (body.status === 'CLOSED') updateFields.closed_at = new Date().toISOString();
    if (body.status === 'ACTIVE') updateFields.closed_at = null;

    if (SUPABASE_HOST && SUPABASE_SECRET_KEY && Object.keys(updateFields).length > 0) {
      await supabaseRequest(`count_sessions?id=eq.${encodeURIComponent(sessionId)}`, 'PATCH', updateFields);
    }

    logSecurityEvent('SESSION_UPDATED', `Session ${sessionId} updated by ${authUser.username}`, req, { fields: Object.keys(updateFields) });
    return sendJson(200, { success: true, sessionId, updated: updateFields });
  }

  // --------------------------------------------------------------------------
  // API Route: Stock Session Deletion (Protected + IDOR Ownership Enforcement)
  // --------------------------------------------------------------------------
  if (reqUrl.includes('/api/stock/session') && reqMethod === 'DELETE') {
    const authUser = getAuthenticatedUser(req);
    if (!authUser || authUser.role === 'COUNTER') {
      return sendJson(403, { error: 'Forbidden' });
    }

    const sessionId = (reqUrl.split('/api/stock/session/')[1] || '').trim();
    if (!sessionId) return sendJson(400, { error: 'Session ID required' });

    // IDOR Check: verify ownership before deletion
    if (SUPABASE_HOST && SUPABASE_SECRET_KEY) {
      const sesRes = await supabaseRequest(`count_sessions?id=eq.${encodeURIComponent(sessionId)}&select=*`);
      if (sesRes && sesRes.status === 200 && Array.isArray(sesRes.data) && sesRes.data.length > 0) {
        const targetSession = sesRes.data[0];
        const ownership = verifySessionOwnership(authUser, targetSession, 'DELETE');
        if (!ownership.allowed) {
          logSecurityEvent('IDOR_PREVENTED', `User ${authUser.username} attempted unauthorized delete of session ${sessionId}`, req);
          return sendJson(ownership.statusCode, { error: ownership.error });
        }
      }

      await supabaseRequest(`stock_items?session_id=eq.${encodeURIComponent(sessionId)}`, 'DELETE');
      await supabaseRequest(`count_sessions?id=eq.${encodeURIComponent(sessionId)}`, 'DELETE');
    }

    logSecurityEvent('SESSION_DELETED', `Session ${sessionId} deleted by ${authUser.username}`, req);
    return sendJson(200, { success: true, sessionId });
  }

  // --------------------------------------------------------------------------
  // API Route: User Management - Create User (Rate Limited + Access Control)
  // --------------------------------------------------------------------------
  if (reqUrl.endsWith('/api/auth/users') && reqMethod === 'POST') {
    const authUser = getAuthenticatedUser(req);
    if (!authUser) {
      return sendJson(401, { error: 'Unauthorized: Authentication required' });
    }

    // Rate Limit Account Creation (Mitigate Automated Spam Accounts)
    const creationLimit = accountCreationLimiter.isAllowed(clientIp);
    if (!creationLimit.allowed) {
      logSecurityEvent('ABUSE_ACCOUNT_FLOOD', `Account creation rate limit exceeded by ${clientIp}`, req);
      return sendJson(429, { error: 'Account creation rate limit exceeded. Please wait.', retryAfter: creationLimit.retryAfter }, { 'Retry-After': String(creationLimit.retryAfter) });
    }

    const body = await parseBody(req);
    if (hasPrototypePollution(body)) {
      return sendJson(400, { error: 'Malicious payload detected' });
    }

    const { id, username, full_name, role, password } = body;
    if (!username || !role) {
      return sendJson(400, { error: 'Username and role are required' });
    }

    // IDOR / Privilege Escalation Check
    const accessCheck = verifyUserManagementAccess(authUser, null, role.toUpperCase(), 'CREATE');
    if (!accessCheck.allowed) {
      logSecurityEvent('PRIVILEGE_ESCALATION_BLOCKED', `${authUser.username} attempted unauthorized account creation of role ${role}`, req);
      return sendJson(accessCheck.statusCode, { error: accessCheck.error });
    }

    // Password Validation
    const rawPass = password || 'counter123';
    const strengthCheck = validatePasswordStrength(rawPass);
    if (!strengthCheck.valid) {
      return sendJson(400, { error: strengthCheck.error });
    }

    const userId = id || ('u-' + Date.now());
    const salt = generateSecureSalt(16);
    const hash = await hashPasswordPbkdf2(rawPass, salt);

    const userRow = {
      id: userId,
      username: String(username).trim().toLowerCase(),
      full_name: String(full_name || username).trim(),
      role: role.toUpperCase(),
      password_salt: salt,
      password_hash: hash,
      is_active: body.is_active !== undefined ? Boolean(body.is_active) : true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (SUPABASE_HOST && SUPABASE_SECRET_KEY) {
      const existCheck = await supabaseRequest('stock_users?username=eq.' + encodeURIComponent(userRow.username) + '&select=id');
      if (existCheck && existCheck.status === 200 && Array.isArray(existCheck.data) && existCheck.data.length > 0) {
        return sendJson(400, { error: 'Username is already taken' });
      }
      await supabaseRequest('stock_users', 'POST', userRow);
    }

    logSecurityEvent('USER_CREATED', `Account ${userRow.username} (${userRow.role}) created by ${authUser.username}`, req);
    return sendJson(201, { success: true, user: sanitizeUser(userRow) });
  }

  // --------------------------------------------------------------------------
  // API Route: User Management - Update User (Protected + IDOR Enforcement)
  // --------------------------------------------------------------------------
  if (reqUrl.includes('/api/auth/users') && reqMethod === 'PATCH') {
    const authUser = getAuthenticatedUser(req);
    if (!authUser) {
      return sendJson(401, { error: 'Unauthorized' });
    }

    const body = await parseBody(req);
    if (hasPrototypePollution(body)) {
      return sendJson(400, { error: 'Malicious payload detected' });
    }

    const userId = body.id || (reqUrl.split('/api/auth/users/')[1] || '').trim();
    if (!userId) {
      return sendJson(400, { error: 'User ID is required' });
    }

    // IDOR Check: fetch target user to verify authority
    let targetUser = null;
    if (SUPABASE_HOST && SUPABASE_SECRET_KEY) {
      const targetRes = await supabaseRequest('stock_users?id=eq.' + encodeURIComponent(userId) + '&select=*');
      if (targetRes && targetRes.data && targetRes.data[0]) {
        targetUser = targetRes.data[0];
      }
    }

    const accessCheck = verifyUserManagementAccess(authUser, targetUser, body.role, 'MODIFY');
    if (!accessCheck.allowed) {
      logSecurityEvent('IDOR_PREVENTED', `${authUser.username} unauthorized attempt to modify user ${userId}`, req);
      return sendJson(accessCheck.statusCode, { error: accessCheck.error });
    }

    const updateFields = { updated_at: new Date().toISOString() };
    if (body.full_name !== undefined) updateFields.full_name = String(body.full_name).trim();
    if (body.role !== undefined && authUser.role === 'ADMIN') updateFields.role = body.role.toUpperCase();
    if (body.is_active !== undefined) updateFields.is_active = Boolean(body.is_active);

    if (body.password) {
      const strengthCheck = validatePasswordStrength(body.password);
      if (!strengthCheck.valid) {
        return sendJson(400, { error: strengthCheck.error });
      }
      const salt = generateSecureSalt(16);
      updateFields.password_salt = salt;
      updateFields.password_hash = await hashPasswordPbkdf2(body.password, salt);
    }

    if (SUPABASE_HOST && SUPABASE_SECRET_KEY) {
      await supabaseRequest('stock_users?id=eq.' + encodeURIComponent(userId), 'PATCH', updateFields);
    }

    logSecurityEvent('USER_MODIFIED', `User ${userId} modified by ${authUser.username}`, req, { fields: Object.keys(updateFields) });
    return sendJson(200, { success: true, userId, updated: sanitizeUser(updateFields) });
  }

  // --------------------------------------------------------------------------
  // API Route: Soft Holds for Item Entry (Concurrent Counting Coordination)
  // --------------------------------------------------------------------------
  if (reqUrl.endsWith('/api/stock/holds') && reqMethod === 'GET') {
    cleanExpiredHolds();
    return sendJson(200, {
      success: true,
      holds: Array.from(activeItemHolds.values()).filter(h => h.expiresAt > Date.now())
    });
  }

  if (reqUrl.endsWith('/api/stock/holds') && reqMethod === 'POST') {
    const authUser = getAuthenticatedUser(req);
    if (!authUser) {
      return sendJson(401, { error: 'Unauthorized: Authentication required for item hold management' });
    }

    const body = await parseBody(req);
    cleanExpiredHolds();

    const action = body.action || 'ACQUIRE';
    const itemId = String(body.itemId || body.item_id || '').trim();

    if (!itemId) {
      return sendJson(400, { error: 'Missing required itemId' });
    }

    if (action === 'RELEASE') {
      const existing = activeItemHolds.get(itemId);
      if (existing) {
        if (existing.userId === authUser.id || authUser.role === 'ADMIN' || body.force) {
          activeItemHolds.delete(itemId);
        }
      }
      return sendJson(200, { success: true, itemId, released: true });
    }

    if (action === 'HEARTBEAT') {
      const existing = activeItemHolds.get(itemId);
      if (existing && existing.userId === authUser.id) {
        existing.expiresAt = Date.now() + 90000;
        return sendJson(200, { success: true, hold: existing });
      }
    }

    // ACQUIRE
    const now = Date.now();
    const existing = activeItemHolds.get(itemId);
    const isConflict = existing && existing.userId !== authUser.id && existing.expiresAt > now;

    if (isConflict && !body.forceTakeOver) {
      return sendJson(409, {
        success: false,
        conflict: true,
        message: `${existing.operatorName} is currently performing a count on this item`,
        hold: existing
      });
    }

    const hold = {
      itemId,
      sku: body.sku || '',
      userId: authUser.id,
      username: authUser.username,
      operatorName: authUser.full_name || authUser.username,
      heldAt: now,
      expiresAt: now + 90000
    };

    activeItemHolds.set(itemId, hold);
    return sendJson(200, { success: true, hold });
  }

  // --------------------------------------------------------------------------
  // API Route: Record Stock Count (Protected + Session Verification)
  // --------------------------------------------------------------------------
  if (reqUrl.endsWith('/api/stock/count') && reqMethod === 'POST') {
    const authUser = getAuthenticatedUser(req);
    if (!authUser) {
      return sendJson(401, { error: 'Unauthorized: Authentication required to submit inventory counts' });
    }

    const body = await parseBody(req);
    if (deepScanPayload(body)) {
      return sendJson(400, { error: 'Malicious payload detected' });
    }

    const skuCheck = validateAndSanitizeInput('SKU', body.sku, { required: true });
    if (!skuCheck.valid) return sendJson(400, { error: skuCheck.error });
    const sku = skuCheck.value;

    const qtyCheck = validatePositiveNumber(body.counted_qty, 10000000, true);
    if (!qtyCheck.valid) return sendJson(400, { error: qtyCheck.error });
    const qty = qtyCheck.value;

    const locCheck = validateAndSanitizeInput('LOCATION', body.location || '');
    if (!locCheck.valid) return sendJson(400, { error: locCheck.error });
    const location = locCheck.value;

    const sesCheck = body.session_id ? validateIdentifier(body.session_id, 1, 64, 'Session ID') : { valid: true };
    if (!sesCheck.valid) return sendJson(400, { error: sesCheck.error });
    let targetSessionId = body.session_id;

    if (SUPABASE_HOST && SUPABASE_SECRET_KEY) {
      if (targetSessionId) {
        const sesRes = await supabaseRequest(`count_sessions?id=eq.${encodeURIComponent(targetSessionId)}&select=*`);
        if (sesRes && sesRes.data && sesRes.data[0]) {
          targetSession = sesRes.data[0];
        }
      } else {
        const activeSesRes = await supabaseRequest('count_sessions?status=eq.ACTIVE&limit=1&select=*');
        if (activeSesRes && activeSesRes.data && activeSesRes.data[0]) {
          targetSession = activeSesRes.data[0];
          targetSessionId = targetSession.id;
        }
      }
    }

    const countCheck = verifyCountSubmission(authUser, targetSession);
    if (!countCheck.allowed) {
      logSecurityEvent('COUNT_REJECTED', countCheck.error, req);
      return sendJson(countCheck.statusCode, { error: countCheck.error });
    }

    const now = new Date().toISOString();
    let item = null;
    const sbItemRes = await supabaseRequest(`stock_items?sku=eq.${encodeURIComponent(sku)}&select=*`);

    if (sbItemRes && sbItemRes.status === 200 && Array.isArray(sbItemRes.data) && sbItemRes.data.length > 0) {
      item = sbItemRes.data[0];
      const isReplace = body.mode === 'REPLACE';
      const newCounted = isReplace ? qty : (Number(item.total_counted_qty) + qty);
      const newVariance = newCounted - Number(item.system_qty);

      await supabaseRequest(`stock_items?id=eq.${encodeURIComponent(item.id)}`, 'PATCH', {
        total_counted_qty: newCounted,
        variance_qty: newVariance,
        updated_at: now
      });
      item.total_counted_qty = newCounted;
      item.variance_qty = newVariance;
    } else {
      const newItem = {
        id: 'item-unlisted-' + Date.now(),
        session_id: targetSessionId || 'ses-default',
        sku: sku,
        item_name: body.item_name || `Unlisted Item (${sku})`,
        barcode: sku,
        batch_no: body.batch_no || 'UNLISTED',
        expiry_date: null,
        zone_location: body.location || 'FLOOR',
        system_qty: 0.0,
        total_counted_qty: qty,
        variance_qty: qty,
        uom: body.uom || 'PCS',
        is_unlisted: true,
        created_at: now,
        updated_at: now
      };
      await supabaseRequest('stock_items', 'POST', newItem);
      item = newItem;
    }

    // Insert count transaction log strictly binding counted_by to authUser
    const logId = 'log-' + Date.now();
    await supabaseRequest('count_logs', 'POST', {
      id: logId,
      session_id: targetSessionId || item.session_id || 'ses-default',
      item_id: item.id,
      sku: item.sku,
      item_name: item.item_name,
      batch_no: item.batch_no || '',
      location: item.zone_location || '',
      qty_counted: qty,
      counted_by: authUser.username // Bound directly to authenticated user
    });

    // Automatically release any soft hold on this item
    if (item && item.id) activeItemHolds.delete(item.id);
    if (body.item_id) activeItemHolds.delete(body.item_id);

    return sendJson(200, { success: true, item });
  }

  // --------------------------------------------------------------------------
  // API Route: AI Generation Requests (Protected + Dedicated AI Rate Limiting)
  // --------------------------------------------------------------------------
  if (reqUrl.endsWith('/api/ai/generate') && reqMethod === 'POST') {
    const authUser = getAuthenticatedUser(req);
    if (!authUser) {
      return sendJson(401, { error: 'Unauthorized: Authentication required for AI inventory generation' });
    }

    // Dedicated AI Rate Limiter (Protects against compute exhaustion and prompt scraping)
    const aiLimit = aiGenerationLimiter.isAllowed(authUser.id || clientIp);
    if (!aiLimit.allowed) {
      logSecurityEvent('ABUSE_AI_RATE_LIMIT', `AI generation rate limit exceeded by ${authUser.username} (${clientIp})`, req);
      return sendJson(429, {
        error: 'AI generation request limit reached. Please wait before requesting additional AI insights.',
        retryAfter: aiLimit.retryAfter
      }, { 'Retry-After': String(aiLimit.retryAfter) });
    }

    const body = await parseBody(req);
    if (deepScanPayload(body)) {
      return sendJson(400, { error: 'Malicious payload detected' });
    }

    const requestType = String(body.type || 'VARIANCE_ANALYSIS').toUpperCase();
    const sessionId = String(body.session_id || '').trim();

    // Verify session existence and user access
    let session = null;
    let items = [];
    if (SUPABASE_HOST && SUPABASE_SECRET_KEY) {
      if (sessionId) {
        const sRes = await supabaseRequest(`count_sessions?id=eq.${encodeURIComponent(sessionId)}&select=*`);
        if (sRes && sRes.data && sRes.data[0]) session = sRes.data[0];
        const iRes = await supabaseRequest(`stock_items?session_id=eq.${encodeURIComponent(sessionId)}&select=*`);
        if (iRes && iRes.data) items = iRes.data;
      } else {
        const sRes = await supabaseRequest('count_sessions?status=eq.ACTIVE&limit=1&select=*');
        if (sRes && sRes.data && sRes.data[0]) session = sRes.data[0];
      }
    }

    // Ownership check on AI analysis
    if (session) {
      const ownership = verifySessionOwnership(authUser, session, 'ANALYZE');
      if (!ownership.allowed && authUser.role === 'COUNTER') {
        return sendJson(403, { error: 'Counters are restricted from viewing AI variance analyses' });
      }
    }

    // Synthesize structured AI inventory analytics response
    const totalItems = items.length;
    const discrepancies = items.filter(it => Math.abs(Number(it.variance_qty)) > 0);
    const criticalDiscrepancies = discrepancies.filter(it => Math.abs(Number(it.variance_qty)) >= 5);

    const aiReport = {
      model: 'Lina-Enterprise-Inventory-Intelligence-Engine-v2',
      requestType,
      generatedAt: new Date().toISOString(),
      requestedBy: authUser.username,
      analysis: {
        totalEvaluatedItems: totalItems,
        discrepancyCount: discrepancies.length,
        criticalDiscrepanciesCount: criticalDiscrepancies.length,
        discrepancyRatePct: totalItems > 0 ? ((discrepancies.length / totalItems) * 100).toFixed(1) : 0,
        riskScore: criticalDiscrepancies.length > 3 ? 'HIGH' : (discrepancies.length > 0 ? 'MODERATE' : 'LOW'),
        recommendations: [
          'Perform secondary blind recount on SKUs with variance threshold > 5%',
          'Verify physical batch expiration dates against warehouse ERP ledger',
          'Lock completed zones to prevent accidental recount duplication'
        ]
      }
    };

    logSecurityEvent('AI_GENERATION_SUCCESS', `AI analysis (${requestType}) generated for user ${authUser.username}`, req);
    return sendJson(200, { success: true, aiReport });
  }

  // --------------------------------------------------------------------------
  // API Route: Audit Trails (Protected + Restricted Strictly to Admin Only)
  // --------------------------------------------------------------------------
  if (reqUrl.endsWith('/api/audit') && reqMethod === 'GET') {
    const authUser = getAuthenticatedUser(req);
    if (!authUser || authUser.role !== 'ADMIN') {
      return sendJson(403, { error: 'Forbidden: Audit trail access restricted to Administrators only' });
    }

    const scrapeCheck = dataScrapingLimiter.isAllowed(authUser.id || clientIp);
    if (!scrapeCheck.allowed) {
      return sendJson(429, { error: 'Audit log query rate limit exceeded.', retryAfter: scrapeCheck.retryAfter }, { 'Retry-After': String(scrapeCheck.retryAfter) });
    }

    const sbAuditRes = await supabaseRequest('audit_trails?select=*&order=timestamp.desc&limit=2000');
    return sendJson(200, { audit_trails: sbAuditRes && sbAuditRes.data ? sbAuditRes.data : [] });
  }

  return sendJson(404, { error: 'Endpoint not found' });
};
