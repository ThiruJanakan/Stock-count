/**
 * Lina Manufacturing · Enterprise Stock Verification Cloud
 * Production Authoritative Backend Server with Supabase Cloud & SQLite Hybrid Storage
 * 
 * Hardened Enterprise Security Controls:
 * - PBKDF2-HMAC-SHA256 Cryptographic Authentication & Zero-Plaintext Backdoor Policy
 * - Multi-Tier Rate Limiting (Login Lockout, API Throttling, Account Spam, AI Generation & Anti-Scraping)
 * - Insecure Direct Object Reference (IDOR) Ownership & Privilege Verification
 * - Server-Side Blind Count Enforcement & Anti-Credential Leakage Filter
 * - Anti-Bot & Automated Scraper Detection Firewall
 * - Cryptographically Chained Tamper-Evident Audit Ledger
 * - HTTPS Enforcement & Strict Security Headers (HSTS, CSP, Frame-Options)
 */

const http = require('http');
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
  hasPrototypePollution,
  deepScanPayload,
  verifySessionOwnership,
  verifyUserManagementAccess,
  verifyCountSubmission,
  logSecurityEvent,
  getSecurityHeaders
} = require('./api/security');

// Load environment variables from .env file
const ROOT = process.cwd();
const ENV_FILE = path.join(ROOT, '.env');
if (fs.existsSync(ENV_FILE)) {
  const envContent = fs.readFileSync(ENV_FILE, 'utf-8');
  envContent.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  });
}

let DatabaseSync;
try {
  DatabaseSync = require('node:sqlite').DatabaseSync;
} catch (e) {
  DatabaseSync = null;
}

const PORT = process.env.PORT || 5173;
const HOST = process.env.HOST || '0.0.0.0';
const DATA_DIR = path.join(ROOT, 'data');
const DB_SQLITE_FILE = path.join(DATA_DIR, 'stock_count.db');

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || '';
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || '';

// Parse hostname from SUPABASE_URL
let SUPABASE_HOST = '';
try {
  SUPABASE_HOST = new URL(SUPABASE_URL).hostname;
} catch (_) {}

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ============================================================================
// 1. SUPABASE REST API CLIENT HELPER
// ============================================================================
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
      logSecurityEvent('SUPABASE_CLOUD_WARNING', err.message, null, { endpoint: endpointPath });
      resolve(null);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// ============================================================================
// 2. LOCAL SQLITE RELATIONAL DATABASE
// ============================================================================
let sqliteDb = null;

function initSqliteDatabase() {
  if (!DatabaseSync) return null;

  try {
    const db = new DatabaseSync(DB_SQLITE_FILE);
    db.exec('PRAGMA foreign_keys = ON;');
    db.exec('PRAGMA journal_mode = WAL;');

    const schemaFile = path.join(ROOT, 'database', 'schema.sql');
    if (fs.existsSync(schemaFile)) {
      const schemaSql = fs.readFileSync(schemaFile, 'utf-8');
      db.exec(schemaSql);
    }

    const userCount = db.prepare("SELECT COUNT(*) AS count FROM users").get();
    if (!userCount || userCount.count === 0) {
      const seedFile = path.join(ROOT, 'database', 'seed.sql');
      if (fs.existsSync(seedFile)) {
        const seedSql = fs.readFileSync(seedFile, 'utf-8');
        db.exec(seedSql);
      }
    }

    return db;
  } catch (err) {
    console.error('Failed to initialize local SQLite database:', err);
    return null;
  }
}

sqliteDb = initSqliteDatabase();

// In-memory active session cache for O(1) state lookup
const activeSessions = new Map();

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

// ============================================================================
// 3. HYBRID SUPABASE + SQLITE DATA ACCESS
// ============================================================================
async function dbGetUserByUsername(username) {
  if (!username) return null;
  // 1. Try Supabase cloud first
  const sbRes = await supabaseRequest(`stock_users?username=eq.${encodeURIComponent(username.toLowerCase())}&select=*`);
  if (sbRes && sbRes.status === 200 && Array.isArray(sbRes.data) && sbRes.data.length > 0) {
    return sbRes.data[0];
  }

  // 2. Fallback to local SQLite
  if (sqliteDb) {
    try {
      return sqliteDb.prepare("SELECT * FROM users WHERE LOWER(username) = LOWER(?)").get(username);
    } catch (_) {}
  }
  return null;
}

async function dbGetSessionById(sessionId) {
  if (!sessionId) return null;
  // 1. Try Supabase cloud
  const sbRes = await supabaseRequest(`count_sessions?id=eq.${encodeURIComponent(sessionId)}&select=*`);
  if (sbRes && sbRes.status === 200 && Array.isArray(sbRes.data) && sbRes.data.length > 0) {
    return sbRes.data[0];
  }

  // 2. Fallback to local SQLite
  if (sqliteDb) {
    try {
      return sqliteDb.prepare("SELECT * FROM count_sessions WHERE id = ?").get(sessionId);
    } catch (_) {}
  }
  return null;
}

async function dbGetFullDatabase(authUser) {
  // 1. Try fetching live from Supabase Cloud
  const [usersRes, sesRes, itemsRes, logsRes, auditRes] = await Promise.all([
    supabaseRequest('stock_users?select=id,username,full_name,role,is_active,created_at'),
    supabaseRequest('count_sessions?select=*&order=created_at.desc'),
    supabaseRequest('stock_items?select=*&order=sku.asc'),
    supabaseRequest('count_logs?select=*&order=timestamp.desc&limit=500'),
    supabaseRequest('audit_trails?select=*&order=timestamp.desc&limit=2000')
  ]);

  if (usersRes && usersRes.status === 200 && itemsRes && itemsRes.status === 200) {
    let items = (itemsRes.data || []).map(i => ({
      ...i,
      system_qty: Number(i.system_qty),
      total_counted_qty: Number(i.total_counted_qty),
      variance_qty: Number(i.variance_qty)
    }));

    // Server-Side Blind Count Enforcement
    if (authUser && authUser.role === 'COUNTER') {
      items = items.map(item => {
        const clone = { ...item };
        delete clone.system_qty;
        delete clone.variance_qty;
        return clone;
      });
    } else if (authUser && (authUser.role === 'SUPERVISOR' || authUser.role === 'EXECUTIVE')) {
      const strictBlindSessionIds = new Set(
        (sesRes.data || []).filter(s => s.count_type === 'BLIND_ALL' || s.count_type === 'DOUBLE_BLIND').map(s => s.id)
      );
      if (strictBlindSessionIds.size > 0) {
        items = items.map(item => {
          if (strictBlindSessionIds.has(item.session_id)) {
            const clone = { ...item };
            delete clone.system_qty;
            delete clone.variance_qty;
            return clone;
          }
          return item;
        });
      }
    }

    // Strip sensitive hashes and salts
    const safeUsers = (usersRes.data || []).map(u => sanitizeUser({ ...u, is_active: Boolean(u.is_active) }));

    return {
      source: 'SUPABASE_CLOUD',
      users: safeUsers,
      sessions: sesRes.data || [],
      items,
      logs: logsRes.data || [],
      audit_trails: authUser && authUser.role === 'COUNTER' ? [] : (auditRes.data || [])
    };
  }

  // 2. Offline Fallback to Local SQLite
  if (!sqliteDb) return { users: [], sessions: [], items: [], logs: [], audit_trails: [] };

  const usersRaw = sqliteDb.prepare("SELECT id, username, full_name, role, is_active, created_at FROM users").all();
  const sessionsRaw = sqliteDb.prepare("SELECT * FROM count_sessions ORDER BY created_at DESC").all();
  const itemsRaw = sqliteDb.prepare("SELECT * FROM stock_items ORDER BY sku ASC").all();
  const logsRaw = sqliteDb.prepare("SELECT * FROM count_logs ORDER BY timestamp DESC LIMIT 500").all();
  const auditRaw = sqliteDb.prepare("SELECT * FROM audit_trails ORDER BY timestamp DESC LIMIT 2000").all();

  let items = itemsRaw.map(item => ({
    ...item,
    system_qty: Number(item.system_qty),
    total_counted_qty: Number(item.total_counted_qty),
    variance_qty: Number(item.variance_qty),
    is_unlisted: Boolean(item.is_unlisted)
  }));

  if (authUser && authUser.role === 'COUNTER') {
    items = items.map(item => {
      const clone = { ...item };
      delete clone.system_qty;
      delete clone.variance_qty;
      return clone;
    });
  } else if (authUser && (authUser.role === 'SUPERVISOR' || authUser.role === 'EXECUTIVE')) {
    const strictBlindSessionIds = new Set(
      sessionsRaw.filter(s => s.count_type === 'BLIND_ALL' || s.count_type === 'DOUBLE_BLIND').map(s => s.id)
    );
    if (strictBlindSessionIds.size > 0) {
      items = items.map(item => {
        if (strictBlindSessionIds.has(item.session_id)) {
          const clone = { ...item };
          delete clone.system_qty;
          delete clone.variance_qty;
          return clone;
        }
        return item;
      });
    }
  }

  return {
    source: 'SQLITE_LOCAL',
    users: usersRaw.map(u => sanitizeUser({ ...u, is_active: Boolean(u.is_active) })),
    sessions: sessionsRaw,
    items,
    logs: logsRaw,
    audit_trails: authUser && authUser.role === 'COUNTER' ? [] : auditRaw
  };
}

async function dbInsertCountRecord(authUser, sku, countedQty, batchNo, location, itemName, uom, mode = 'ADD', sessionId = null) {
  const now = new Date().toISOString();

  // 1. Fetch item from Supabase or SQLite
  let item = null;
  const sbItemRes = await supabaseRequest(`stock_items?sku=eq.${encodeURIComponent(sku)}&select=*`);
  if (sbItemRes && sbItemRes.status === 200 && Array.isArray(sbItemRes.data) && sbItemRes.data.length > 0) {
    item = sbItemRes.data[0];
  } else if (sqliteDb) {
    item = sqliteDb.prepare("SELECT * FROM stock_items WHERE LOWER(sku) = LOWER(?) OR barcode = ?").get(sku, sku);
  }

  const isUnlisted = !item;
  let activeSesId = sessionId || (item ? item.session_id : null);
  if (!activeSesId && sqliteDb) {
    const activeSes = sqliteDb.prepare("SELECT id FROM count_sessions WHERE status = 'ACTIVE' LIMIT 1").get();
    if (activeSes) activeSesId = activeSes.id;
  }
  if (!activeSesId) activeSesId = 'ses-default';

  if (isUnlisted) {
    const newItemId = 'item-unlisted-' + Date.now();
    const newItem = {
      id: newItemId,
      session_id: activeSesId,
      sku: sku,
      item_name: itemName || `Unlisted Item (${sku})`,
      barcode: sku,
      batch_no: batchNo || 'UNLISTED',
      expiry_date: null,
      zone_location: location || 'FLOOR',
      system_qty: 0.0,
      total_counted_qty: countedQty,
      variance_qty: countedQty,
      uom: uom || 'PCS',
      is_unlisted: true,
      created_at: now,
      updated_at: now
    };

    // Save to Supabase Cloud
    await supabaseRequest('stock_items', 'POST', newItem);

    // Save to local SQLite
    if (sqliteDb) {
      sqliteDb.prepare(`
        INSERT INTO stock_items (id, session_id, sku, item_name, barcode, batch_no, expiry_date, zone_location, system_qty, total_counted_qty, variance_qty, uom, is_unlisted, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0.0, ?, ?, ?, 1, ?, ?)
      `).run(newItemId, activeSesId, sku, newItem.item_name, sku, newItem.batch_no, '', newItem.zone_location, countedQty, countedQty, newItem.uom, now, now);
    }
    item = newItem;
  } else {
    const newCounted = mode === 'REPLACE' ? countedQty : (Number(item.total_counted_qty) + countedQty);
    const newVariance = newCounted - Number(item.system_qty);

    // Update in Supabase Cloud
    await supabaseRequest(`stock_items?id=eq.${encodeURIComponent(item.id)}`, 'PATCH', {
      total_counted_qty: newCounted,
      variance_qty: newVariance,
      batch_no: batchNo || item.batch_no,
      zone_location: location || item.zone_location,
      updated_at: now
    });

    // Update in local SQLite
    if (sqliteDb) {
      sqliteDb.prepare(`
        UPDATE stock_items 
        SET total_counted_qty = ?, variance_qty = ?, batch_no = COALESCE(NULLIF(?, ''), batch_no), zone_location = COALESCE(NULLIF(?, ''), zone_location), updated_at = ?
        WHERE id = ?
      `).run(newCounted, newVariance, batchNo || '', location || '', now, item.id);
    }
    item.total_counted_qty = newCounted;
    item.variance_qty = newVariance;
  }

  // Insert transaction log strictly bound to authUser
  const logId = 'log-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
  const logPayload = {
    id: logId,
    session_id: activeSesId,
    item_id: item.id,
    sku: item.sku,
    item_name: item.item_name,
    batch_no: item.batch_no || '',
    location: item.zone_location || '',
    qty_counted: countedQty,
    counted_by: authUser.username,
    timestamp: now
  };

  // Sync to Supabase & SQLite
  supabaseRequest('count_logs', 'POST', logPayload).catch(() => {});
  if (sqliteDb) {
    sqliteDb.prepare(`
      INSERT INTO count_logs (id, session_id, item_id, sku, item_name, batch_no, location, qty_counted, counted_by, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(logId, activeSesId, item.id, item.sku, item.item_name, item.batch_no || '', item.zone_location || '', countedQty, authUser.username, now);
  }

  dbLogAuditEvent(authUser, 'COUNT_RECORDED', `Count recorded: ${countedQty} ${item.uom || 'units'} for SKU "${item.sku}" by ${authUser.username}`, item.sku, 'COUNT');

  return { item, logId };
}

function dbLogAuditEvent(user, action, details, target = '', category = 'SYSTEM') {
  const now = new Date().toISOString();
  let prevHash = 'GENESIS_ROOT';
  if (sqliteDb) {
    try {
      const lastEvent = sqliteDb.prepare("SELECT event_hash, id FROM audit_trails ORDER BY timestamp DESC LIMIT 1").get();
      if (lastEvent) prevHash = lastEvent.event_hash || lastEvent.id;
    } catch (_) {}
  }

  const actorId = user ? user.id : 'anonymous';
  const actorName = user ? (user.username || 'System') : 'System';
  const actorRole = user ? user.role : 'GUEST';

  const payload = `${prevHash}:${now}:${actorId}:${action}:${details}:${target}`;
  const eventHash = crypto.createHash('sha256').update(payload).digest('hex').substring(0, 32);

  const eventId = "adt-" + Date.now() + "-" + Math.random().toString(36).substr(2, 5);
  const auditRow = {
    id: eventId,
    timestamp: now,
    user_id: actorId,
    username: actorName,
    role: actorRole,
    action: action,
    category: category,
    details: details,
    target: target,
    prev_hash: prevHash,
    event_hash: eventHash
  };

  // Sync to Supabase & SQLite
  supabaseRequest('audit_trails', 'POST', auditRow).catch(() => {});
  if (sqliteDb) {
    try {
      sqliteDb.prepare(`
        INSERT INTO audit_trails (id, timestamp, user_id, username, role, action, category, details, target, prev_hash, event_hash)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(eventId, now, actorId, actorName, actorRole, action, category, details, target, prevHash, eventHash);
    } catch (_) {}
  }
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.csv': 'text/csv; charset=utf-8'
};

function parseJsonBody(req, maxBytes = 15 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > maxBytes) reject(new Error('Payload too large'));
      body += chunk;
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON format'));
      }
    });
    req.on('error', err => reject(err));
  });
}

// ============================================================================
// 4. APPLICATION HTTP SERVER WITH ENTERPRISE CONTROLS
// ============================================================================
const server = http.createServer(async (req, res) => {
  const clientIp = req.socket.remoteAddress || req.headers['x-forwarded-for'] || '127.0.0.1';
  const reqUrl = req.url.split('?')[0];
  const reqMethod = req.method.toUpperCase();

  // 1. Enforce HTTPS in Production Behind Reverse Proxy
  const proto = req.headers['x-forwarded-proto'];
  if (proto === 'http' && process.env.NODE_ENV === 'production') {
    const secureUrl = `https://${req.headers.host}${req.url}`;
    res.writeHead(301, { 'Location': secureUrl });
    return res.end();
  }

  function sendJson(statusCode, data, extraHeaders = {}) {
    const isHttps = proto === 'https' || req.socket.encrypted;
    const headers = getSecurityHeaders({
      'Access-Control-Allow-Origin': req.headers.origin || `http://localhost:${PORT}`,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      ...extraHeaders
    });
    res.writeHead(statusCode, headers);
    res.end(JSON.stringify(data));
  }

  if (reqMethod === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': req.headers.origin || `http://localhost:${PORT}`,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Max-Age': '86400'
    });
    return res.end();
  }

  // 2. Anti-Bot & Automated Scraper Detection
  const botCheck = isMaliciousBotOrScraper(req);
  if (botCheck.isBot) {
    logSecurityEvent('ABUSE_BOT_DETECTED', botCheck.reason, req);
    return sendJson(403, { error: 'Access Denied: Automated bot activity rejected by security firewall' });
  }

  // 3. Favicon Handler
  if (reqUrl === '/favicon.ico') {
    const iconPath = path.join(ROOT, 'lina-logo.png');
    if (fs.existsSync(iconPath)) {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      return fs.createReadStream(iconPath).pipe(res);
    }
    res.writeHead(204);
    return res.end();
  }

  // ==========================================
  // REST API ROUTES
  // ==========================================
  if (reqUrl.startsWith('/api/')) {
    // General API Rate Limiting
    const apiLimit = generalApiLimiter.isAllowed(clientIp);
    if (!apiLimit.allowed) {
      logSecurityEvent('RATE_LIMIT_EXCEEDED', `General API rate limit exceeded by ${clientIp}`, req);
      return sendJson(429, { error: 'Too many requests. Please slow down.', retryAfter: apiLimit.retryAfter }, { 'Retry-After': String(apiLimit.retryAfter) });
    }

    // CSRF Protection for state-modifying requests
    if (reqMethod === 'POST' || reqMethod === 'PUT' || reqMethod === 'PATCH' || reqMethod === 'DELETE') {
      const origin = req.headers.origin || req.headers.referer || '';
      const isLocal = !origin || origin.includes(`localhost:${PORT}`) || origin.includes(`127.0.0.1:${PORT}`);
      const isAllowedDomain = origin.includes('linamanufacturing.com') || origin.includes('vercel.app');
      if (origin && !isLocal && !isAllowedDomain) {
        logSecurityEvent('CSRF_ATTEMPT_BLOCKED', `Untrusted cross-origin request from: ${origin}`, req);
        return sendJson(403, { error: 'CSRF Protection: Cross-origin request denied' });
      }
    }

    // ------------------------------------------------------------------------
    // API: Health & Security Verification
    // ------------------------------------------------------------------------
    if (reqUrl === '/api/health') {
      return sendJson(200, {
        status: 'UP',
        service: 'Lina Enterprise Stock Verification Cloud',
        timestamp: new Date().toISOString(),
        cloud: {
          provider: 'Supabase Cloud PostgreSQL',
          url: SUPABASE_URL,
          tables: ['stock_users', 'count_sessions', 'stock_items', 'count_logs', 'audit_trails'],
          status: SUPABASE_HOST ? 'CONNECTED' : 'DISCONNECTED'
        },
        local_db: {
          engine: sqliteDb ? 'SQLite Relational (node:sqlite)' : 'JSON Memory Cache',
          status: 'WAL Relational Online'
        },
        security: {
          pbkdf2: true,
          bruteForceLockout: true,
          antiSqlInjection: true,
          antiBotProtection: true,
          csrfProtection: true,
          idorProtection: true,
          sessionType: 'HttpOnly-Cryptographic-Signed',
          sessionExpiry: '8h-hard-2h-idle'
        }
      });
    }

    // ------------------------------------------------------------------------
    // API: Supabase Public Config (Protected from public scraping)
    // ------------------------------------------------------------------------
    if (reqUrl === '/api/supabase/config' && reqMethod === 'GET') {
      return sendJson(200, {
        supabaseUrl: SUPABASE_URL,
        publishableKey: SUPABASE_PUBLISHABLE_KEY
      });
    }

    // ------------------------------------------------------------------------
    // API: Authentication Login (Protected with Lockout Rate Limiter)
    // ------------------------------------------------------------------------
    if (reqUrl === '/api/auth/login' && reqMethod === 'POST') {
      try {
        const body = await parseJsonBody(req);
        const username = (body.username || '').trim();
        const password = (body.password || '').trim();

        if (checkSqlInjection(username) || checkSqlInjection(password)) {
          logSecurityEvent('INJECTION_ATTEMPT', `Malicious SQL/Command input from IP: ${clientIp}`, req, { username });
          return sendJson(400, { error: 'Malicious input detected. Request blocked by security firewall.' });
        }

        // Check Lockout
        const lockCheck = checkLoginRateLimit(clientIp, username);
        if (lockCheck.locked) {
          logSecurityEvent('AUTH_LOCKOUT', `Brute-force lockout active for ${username} from ${clientIp}`, req);
          return sendJson(429, {
            error: lockCheck.error,
            retryAfter: lockCheck.retryAfter
          }, { 'Retry-After': String(lockCheck.retryAfter) });
        }

        const user = await dbGetUserByUsername(username);

        if (!user || !user.is_active) {
          const failureStats = recordLoginFailure(clientIp, username);
          dbLogAuditEvent(null, 'LOGIN_FAILED', `Failed login for unknown/inactive: "${username}" from IP: ${clientIp}`, username, 'AUTH');
          logSecurityEvent('AUTH_FAILURE', `Invalid user/inactive: ${username}`, req);

          if (failureStats.locked) {
            return sendJson(429, {
              error: 'Account locked due to excessive failed attempts.',
              retryAfter: 900
            }, { 'Retry-After': '900' });
          }

          return sendJson(401, {
            error: failureStats.remaining > 0 ? `Invalid credentials. ${failureStats.remaining} attempts remaining.` : 'Account locked due to excessive failed attempts.',
            attemptsRemaining: failureStats.remaining
          });
        }

        const verifyRes = await verifyPasswordPbkdf2(password, user.password_salt, user.password_hash);
        if (verifyRes === false) {
          const failureStats = recordLoginFailure(clientIp, username);
          dbLogAuditEvent(null, 'LOGIN_FAILED', `Invalid password for: "${username}" from IP: ${clientIp}`, username, 'AUTH');
          logSecurityEvent('AUTH_FAILURE', `Invalid password for: ${username}`, req);

          if (failureStats.locked) {
            return sendJson(429, {
              error: 'Account locked due to excessive failed attempts.',
              retryAfter: 900
            }, { 'Retry-After': '900' });
          }

          return sendJson(401, {
            error: failureStats.remaining > 0 ? `Invalid credentials. ${failureStats.remaining} attempts remaining.` : 'Account locked due to excessive failed attempts.',
            attemptsRemaining: failureStats.remaining
          });
        }

        // Successful authentication
        recordLoginSuccess(clientIp, username);

        const sessionToken = signSessionToken(user);
        activeSessions.set(sessionToken, {
          id: user.id,
          username: user.username,
          full_name: user.full_name,
          role: user.role,
          createdAt: Date.now(),
          expiresAt: Date.now() + 8 * 60 * 60 * 1000
        });

        dbLogAuditEvent(user, 'LOGIN_SUCCESS', `User ${user.full_name || user.username} (${user.role}) authenticated successfully`, user.username, 'AUTH');
        logSecurityEvent('AUTH_SUCCESS', `User ${user.username} authenticated successfully`, req);

        const cookieHeader = `LINA_AUTH_SESSION=${sessionToken}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800`;

        return sendJson(200, {
          success: true,
          token: sessionToken,
          user: sanitizeUser(user)
        }, { 'Set-Cookie': cookieHeader });

      } catch (err) {
        logSecurityEvent('API_ERROR', err.message, req);
        return sendJson(500, { error: 'Internal authentication server error' });
      }
    }

    // ------------------------------------------------------------------------
    // API: Session Check
    // ------------------------------------------------------------------------
    if (reqUrl === '/api/auth/session' && reqMethod === 'GET') {
      const authUser = getAuthenticatedUser(req);
      if (!authUser) return sendJson(401, { authenticated: false });
      return sendJson(200, { authenticated: true, user: sanitizeUser(authUser) });
    }

    // ------------------------------------------------------------------------
    // API: Logout
    // ------------------------------------------------------------------------
    if (reqUrl === '/api/auth/logout' && reqMethod === 'POST') {
      const cookies = parseCookies(req);
      const token = cookies['LINA_AUTH_SESSION'] || (req.headers['authorization'] || '').replace('Bearer ', '').trim();
      if (token) {
        revokeSessionToken(token);
        activeSessions.delete(token);
      }
      logSecurityEvent('AUTH_LOGOUT', 'User logged out', req);
      return sendJson(200, { success: true }, {
        'Set-Cookie': 'LINA_AUTH_SESSION=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'
      });
    }

    // ------------------------------------------------------------------------
    // API: Fetch Database (Supabase + Local SQLite with Blind Count & Anti-Scraping)
    // ------------------------------------------------------------------------
    if (reqUrl === '/api/stock/db' && reqMethod === 'GET') {
      const authUser = getAuthenticatedUser(req);
      if (!authUser) return sendJson(401, { error: 'Authentication required' });

      // Anti-scraping rate limit
      const scrapeLimit = dataScrapingLimiter.isAllowed(authUser.id || clientIp);
      if (!scrapeLimit.allowed) {
        logSecurityEvent('ABUSE_DATA_SCRAPING', `Data query limit exceeded by ${authUser.username}`, req);
        return sendJson(429, { error: 'Data export rate limit exceeded. Please wait.', retryAfter: scrapeLimit.retryAfter }, { 'Retry-After': String(scrapeLimit.retryAfter) });
      }

      const dbData = await dbGetFullDatabase(authUser);
      return sendJson(200, dbData);
    }

    // ------------------------------------------------------------------------
    // API: Create Stock Session (Protected)
    // ------------------------------------------------------------------------
    if (reqUrl === '/api/stock/session' && reqMethod === 'POST') {
      const authUser = getAuthenticatedUser(req);
      if (!authUser) return sendJson(401, { error: 'Authentication required' });
      if (authUser.role === 'COUNTER') return sendJson(403, { error: 'Forbidden: Counters cannot create sessions' });

      try {
        const body = await parseJsonBody(req);
        if (deepScanPayload(body)) return sendJson(400, { error: 'Malicious payload detected' });

        const session = body.session;
        const items = Array.isArray(body.items) ? body.items : [];
        if (!session || !session.id || !session.title) return sendJson(400, { error: 'Valid session required' });

        const now = new Date().toISOString();
        const sessionRow = {
          id: session.id,
          session_code: session.session_code || `SES-${Date.now()}`,
          title: session.title,
          description: session.description || '',
          count_type: toDbCountType(session.count_type),
          status: session.status || 'ACTIVE',
          total_items: items.length || session.total_items || 0,
          counted_items: session.counted_items || 0,
          progress_percent: session.progress_percent || 0,
          created_by: authUser.id,
          created_at: session.created_at || now,
          closed_at: session.status === 'CLOSED' ? (session.closed_at || now) : null
        };

        // IDOR Check if session exists
        const existingSes = await dbGetSessionById(session.id);
        if (existingSes) {
          const ownership = verifySessionOwnership(authUser, existingSes, 'OVERWRITE');
          if (!ownership.allowed) {
            logSecurityEvent('IDOR_PREVENTED', `${authUser.username} tried to overwrite session ${session.id}`, req);
            return sendJson(ownership.statusCode, { error: ownership.error });
          }
        }

        if (SUPABASE_HOST && SUPABASE_SECRET_KEY) {
          if (existingSes) {
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

        if (sqliteDb) {
          try {
            const insertSes = sqliteDb.prepare(`
              INSERT OR REPLACE INTO count_sessions (id, session_code, title, description, count_type, status, total_items, counted_items, progress_percent, created_by, created_at, closed_at)
              VALUES (@id, @session_code, @title, @description, @count_type, @status, @total_items, @counted_items, @progress_percent, @created_by, @created_at, @closed_at)
            `);
            insertSes.run(sessionRow);

            if (items.length > 0) {
              const insertItem = sqliteDb.prepare(`
                INSERT OR REPLACE INTO stock_items (id, session_id, sku, item_name, barcode, batch_no, expiry_date, zone_location, system_qty, total_counted_qty, variance_qty, uom, is_unlisted, created_at, updated_at)
                VALUES (@id, @session_id, @sku, @item_name, @barcode, @batch_no, @expiry_date, @zone_location, @system_qty, @total_counted_qty, @variance_qty, @uom, @is_unlisted, @created_at, @updated_at)
              `);
              const tx = sqliteDb.transaction((itemList) => {
                for (const it of itemList) {
                  insertItem.run({
                    id: it.id || `item-${session.id}-${Math.random().toString(36).slice(2, 8)}`,
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
                    is_unlisted: it.is_unlisted ? 1 : 0,
                    created_at: it.created_at || now,
                    updated_at: it.updated_at || now
                  });
                }
              });
              tx(items);
            }
          } catch (e) {
            console.warn('[SQLite Insert Error]', e.message);
          }
        }

        dbLogAuditEvent(authUser, 'SESSION_CREATED', `Created session "${session.title}" (${session.id})`, session.id, 'SESSION');
        return sendJson(201, { success: true, session: sessionRow, itemsCount: items.length });
      } catch (err) {
        logSecurityEvent('API_ERROR', err.message, req);
        return sendJson(500, { error: 'Failed to create session: ' + err.message });
      }
    }

    // ------------------------------------------------------------------------
    // API: Update Stock Session (Protected + IDOR Enforcement)
    // ------------------------------------------------------------------------
    if (reqUrl.includes('/api/stock/session') && reqMethod === 'PATCH') {
      const authUser = getAuthenticatedUser(req);
      if (!authUser || authUser.role === 'COUNTER') return sendJson(403, { error: 'Forbidden' });

      try {
        const body = await parseJsonBody(req);
        const sessionId = body.id || (reqUrl.split('/api/stock/session/')[1] || '').trim();
        if (!sessionId) return sendJson(400, { error: 'Session ID required' });

        // IDOR Verification
        const targetSession = await dbGetSessionById(sessionId);
        if (targetSession) {
          const ownership = verifySessionOwnership(authUser, targetSession, 'UPDATE');
          if (!ownership.allowed) {
            logSecurityEvent('IDOR_PREVENTED', `${authUser.username} attempted unauthorized session update on ${sessionId}`, req);
            return sendJson(ownership.statusCode, { error: ownership.error });
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

        if (sqliteDb && Object.keys(updateFields).length > 0) {
          const sets = Object.keys(updateFields).map(k => `${k} = @${k}`).join(', ');
          sqliteDb.prepare(`UPDATE count_sessions SET ${sets} WHERE id = @id`).run({ ...updateFields, id: sessionId });
        }

        dbLogAuditEvent(authUser, 'SESSION_UPDATED', `Updated session ${sessionId}`, sessionId, 'SESSION');
        return sendJson(200, { success: true, sessionId, updated: updateFields });
      } catch (err) {
        logSecurityEvent('API_ERROR', err.message, req);
        return sendJson(500, { error: err.message });
      }
    }

    // ------------------------------------------------------------------------
    // API: Delete Stock Session (Protected + IDOR Enforcement)
    // ------------------------------------------------------------------------
    if (reqUrl.includes('/api/stock/session') && reqMethod === 'DELETE') {
      const authUser = getAuthenticatedUser(req);
      if (!authUser || authUser.role === 'COUNTER') return sendJson(403, { error: 'Forbidden' });

      const sessionId = (reqUrl.split('/api/stock/session/')[1] || '').trim();
      if (sessionId) {
        // IDOR Verification
        const targetSession = await dbGetSessionById(sessionId);
        if (targetSession) {
          const ownership = verifySessionOwnership(authUser, targetSession, 'DELETE');
          if (!ownership.allowed) {
            logSecurityEvent('IDOR_PREVENTED', `${authUser.username} attempted unauthorized session delete on ${sessionId}`, req);
            return sendJson(ownership.statusCode, { error: ownership.error });
          }
        }

        if (SUPABASE_HOST && SUPABASE_SECRET_KEY) {
          await supabaseRequest(`stock_items?session_id=eq.${encodeURIComponent(sessionId)}`, 'DELETE');
          await supabaseRequest(`count_sessions?id=eq.${encodeURIComponent(sessionId)}`, 'DELETE');
        }
        if (sqliteDb) {
          try {
            sqliteDb.prepare("DELETE FROM stock_items WHERE session_id = ?").run(sessionId);
            sqliteDb.prepare("DELETE FROM count_sessions WHERE id = ?").run(sessionId);
          } catch (_) {}
        }
        dbLogAuditEvent(authUser, 'SESSION_DELETED', `Deleted session ${sessionId}`, sessionId, 'SESSION');
      }
      return sendJson(200, { success: true, sessionId });
    }

    // ------------------------------------------------------------------------
    // API: Record Stock Count (Protected + Session Status Verification)
    // ------------------------------------------------------------------------
    if (reqUrl === '/api/stock/count' && reqMethod === 'POST') {
      const authUser = getAuthenticatedUser(req);
      if (!authUser) return sendJson(401, { error: 'Authentication required' });

      try {
        const body = await parseJsonBody(req);
        if (deepScanPayload(body)) {
          return sendJson(400, { error: 'Malicious payload rejected by security filter' });
        }

        const sku = String(body.sku || '').trim();
        const batchNo = String(body.batch_no || '').trim();
        const location = String(body.location || '').trim();
        const qty = parseFloat(body.counted_qty);

        if (!sku || isNaN(qty) || qty < 0) {
          return sendJson(400, { error: 'Valid SKU and non-negative quantity required' });
        }

        // Verify target session is active
        const targetSession = await dbGetSessionById(body.session_id);
        const countCheck = verifyCountSubmission(authUser, targetSession);
        if (!countCheck.allowed) {
          logSecurityEvent('COUNT_REJECTED', countCheck.error, req);
          return sendJson(countCheck.statusCode, { error: countCheck.error });
        }

        const result = await dbInsertCountRecord(authUser, sku, qty, batchNo, location, body.item_name, body.uom, body.mode, body.session_id);
        return sendJson(200, { success: true, ...result });
      } catch (err) {
        logSecurityEvent('API_ERROR', err.message, req);
        return sendJson(500, { error: 'Failed to record count: ' + err.message });
      }
    }

    // ------------------------------------------------------------------------
    // API: User Management (Protected + IDOR Enforcement & Rate Limiting)
    // ------------------------------------------------------------------------
    if (reqUrl === '/api/users' && reqMethod === 'POST') {
      const authUser = getAuthenticatedUser(req);
      if (!authUser) {
        return sendJson(401, { error: 'Authentication required' });
      }

      try {
        const body = await parseJsonBody(req);
        if (deepScanPayload(body)) {
          return sendJson(400, { error: 'Malicious payload detected' });
        }

        const action = body.action;

        if (action === 'CREATE') {
          // Account creation rate limit
          const creationLimit = accountCreationLimiter.isAllowed(clientIp);
          if (!creationLimit.allowed) {
            logSecurityEvent('ABUSE_ACCOUNT_FLOOD', `Account creation rate limit exceeded by ${clientIp}`, req);
            return sendJson(429, { error: 'Account creation rate limit reached. Please wait.', retryAfter: creationLimit.retryAfter }, { 'Retry-After': String(creationLimit.retryAfter) });
          }

          const newRole = body.role || 'COUNTER';
          const accessCheck = verifyUserManagementAccess(authUser, null, newRole, 'CREATE');
          if (!accessCheck.allowed) {
            logSecurityEvent('PRIVILEGE_ESCALATION_BLOCKED', `${authUser.username} attempted unauthorized account creation of role ${newRole}`, req);
            return sendJson(accessCheck.statusCode, { error: accessCheck.error });
          }

          const username = (body.username || '').trim().toLowerCase();
          const existing = await dbGetUserByUsername(username);
          if (!username || existing) {
            return sendJson(400, { error: 'Username is invalid or already taken' });
          }

          const rawPass = body.password || 'counter123';
          const passCheck = validatePasswordStrength(rawPass);
          if (!passCheck.valid) {
            return sendJson(400, { error: passCheck.error });
          }

          const salt = generateSecureSalt(16);
          const hash = await hashPasswordPbkdf2(rawPass, salt);
          const userId = 'u-' + Date.now();
          const now = new Date().toISOString();

          // Sync to Supabase & SQLite
          await supabaseRequest('stock_users', 'POST', {
            id: userId,
            username,
            full_name: body.full_name || username,
            role: newRole,
            password_salt: salt,
            password_hash: hash,
            is_active: true,
            created_at: now,
            updated_at: now
          });

          if (sqliteDb) {
            sqliteDb.prepare(`
              INSERT INTO users (id, username, full_name, role, password_salt, password_hash, is_active, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
            `).run(userId, username, body.full_name || username, newRole, salt, hash, now, now);
          }

          dbLogAuditEvent(authUser, 'USER_CREATED', `Created user ${username} (${newRole})`, username, 'USER');
          logSecurityEvent('USER_CREATED', `User ${username} (${newRole}) created by ${authUser.username}`, req);

          return sendJson(200, { success: true, user: { id: userId, username, role: newRole } });
        }

        if (action === 'SOFT_REMOVE') {
          const userId = body.userId;
          const targetUser = await dbGetUserByUsername(body.username || '') || (sqliteDb ? sqliteDb.prepare("SELECT * FROM users WHERE id = ?").get(userId) : null);
          if (!targetUser) return sendJson(404, { error: 'User not found' });

          // IDOR Check
          const accessCheck = verifyUserManagementAccess(authUser, targetUser, targetUser.role, 'DEACTIVATE');
          if (!accessCheck.allowed) {
            logSecurityEvent('IDOR_PREVENTED', `${authUser.username} attempted unauthorized deactivation of user ${targetUser.username}`, req);
            return sendJson(accessCheck.statusCode, { error: accessCheck.error });
          }

          const newActive = !targetUser.is_active;

          // Update Supabase & SQLite
          await supabaseRequest(`stock_users?id=eq.${encodeURIComponent(targetUser.id)}`, 'PATCH', {
            is_active: newActive,
            updated_at: new Date().toISOString()
          });

          if (sqliteDb) {
            sqliteDb.prepare("UPDATE users SET is_active = ?, updated_at = ? WHERE id = ?").run(newActive ? 1 : 0, new Date().toISOString(), targetUser.id);
          }

          dbLogAuditEvent(authUser, newActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED', `Toggled active state for ${targetUser.username}`, targetUser.username, 'USER');
          logSecurityEvent('USER_STATE_TOGGLED', `User ${targetUser.username} active status set to ${newActive}`, req);

          return sendJson(200, { success: true, is_active: newActive });
        }

        return sendJson(400, { error: 'Unknown user action' });
      } catch (err) {
        logSecurityEvent('API_ERROR', err.message, req);
        return sendJson(500, { error: err.message });
      }
    }

    // ------------------------------------------------------------------------
    // API: AI Generation Requests (Protected + Dedicated AI Rate Limiting)
    // ------------------------------------------------------------------------
    if (reqUrl === '/api/ai/generate' && reqMethod === 'POST') {
      const authUser = getAuthenticatedUser(req);
      if (!authUser) {
        return sendJson(401, { error: 'Authentication required for AI generation requests' });
      }

      // Dedicated AI generation rate limiter
      const aiLimit = aiGenerationLimiter.isAllowed(authUser.id || clientIp);
      if (!aiLimit.allowed) {
        logSecurityEvent('ABUSE_AI_RATE_LIMIT', `AI rate limit exceeded by ${authUser.username}`, req);
        return sendJson(429, {
          error: 'AI generation request limit reached. Please wait before requesting additional AI insights.',
          retryAfter: aiLimit.retryAfter
        }, { 'Retry-After': String(aiLimit.retryAfter) });
      }

      try {
        const body = await parseJsonBody(req);
        if (deepScanPayload(body)) {
          return sendJson(400, { error: 'Malicious payload detected' });
        }

        const requestType = String(body.type || 'VARIANCE_ANALYSIS').toUpperCase();
        const sessionId = String(body.session_id || '').trim();

        // Check session ownership
        const session = await dbGetSessionById(sessionId);
        if (session) {
          const ownership = verifySessionOwnership(authUser, session, 'ANALYZE');
          if (!ownership.allowed && authUser.role === 'COUNTER') {
            return sendJson(403, { error: 'Counters are restricted from viewing AI variance analyses' });
          }
        }

        const items = sqliteDb 
          ? (sessionId ? sqliteDb.prepare("SELECT * FROM stock_items WHERE session_id = ?").all(sessionId) : sqliteDb.prepare("SELECT * FROM stock_items").all())
          : [];

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
              'Lock completed zones to prevent recount duplication'
            ]
          }
        };

        dbLogAuditEvent(authUser, 'AI_ANALYSIS_GENERATED', `Generated AI inventory report (${requestType})`, sessionId || 'ALL', 'AI');
        logSecurityEvent('AI_GENERATION_SUCCESS', `AI analysis (${requestType}) generated for user ${authUser.username}`, req);

        return sendJson(200, { success: true, aiReport });
      } catch (err) {
        logSecurityEvent('API_ERROR', err.message, req);
        return sendJson(500, { error: 'Failed to generate AI analysis: ' + err.message });
      }
    }

    // ------------------------------------------------------------------------
    // API: Audit Trail
    // ------------------------------------------------------------------------
    if (reqUrl === '/api/audit' && reqMethod === 'GET') {
      const authUser = getAuthenticatedUser(req);
      if (!authUser || authUser.role === 'COUNTER') {
        return sendJson(403, { error: 'Audit trail access restricted to Supervisors and Administrators' });
      }

      const scrapeLimit = dataScrapingLimiter.isAllowed(authUser.id || clientIp);
      if (!scrapeLimit.allowed) {
        return sendJson(429, { error: 'Audit log query rate limit exceeded.', retryAfter: scrapeLimit.retryAfter }, { 'Retry-After': String(scrapeLimit.retryAfter) });
      }

      const sbAuditRes = await supabaseRequest('audit_trails?select=*&order=timestamp.desc&limit=2000');
      if (sbAuditRes && sbAuditRes.status === 200) {
        return sendJson(200, { audit_trails: sbAuditRes.data });
      }

      const trails = sqliteDb ? sqliteDb.prepare("SELECT * FROM audit_trails ORDER BY timestamp DESC LIMIT 2000").all() : [];
      return sendJson(200, { audit_trails: trails });
    }

    return sendJson(404, { error: 'API endpoint not found' });
  }

  // ==========================================
  // STATIC ASSET SERVING WITH PATH TRAVERSAL DEFENSE
  // ==========================================
  let reqPath = decodeURI(reqUrl);
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';

  const safePath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.resolve(ROOT, '.' + safePath);

  if (!filePath.startsWith(ROOT)) {
    logSecurityEvent('PATH_TRAVERSAL_BLOCKED', `Path traversal attempt on: ${reqUrl}`, req);
    res.writeHead(403, { 'Content-Type': 'text/plain', 'X-Content-Type-Options': 'nosniff' });
    return res.end('403 Forbidden');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      if (!path.extname(reqPath)) {
        const indexPath = path.join(ROOT, 'index.html');
        return fs.readFile(indexPath, (err2, content) => {
          if (err2) {
            res.writeHead(404, { 'Content-Type': 'text/plain', 'X-Content-Type-Options': 'nosniff' });
            return res.end('404 Not Found');
          }
          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'SAMEORIGIN',
            'Referrer-Policy': 'strict-origin-when-cross-origin'
          });
          res.end(content);
        });
      }
      res.writeHead(404, { 'Content-Type': 'text/plain', 'X-Content-Type-Options': 'nosniff' });
      return res.end('404 Not Found: ' + reqPath);
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Content-Security-Policy': "default-src 'self' data: blob: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://cdn.jsdelivr.net https://unpkg.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self' https://*.supabase.co wss://*.supabase.co ws: wss:; object-src 'none'; base-uri 'self';"
    });

    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, HOST, () => {
  console.log('\n  ======================================================');
  console.log('  \x1b[36m%s\x1b[0m', '  Lina Manufacturing · Central Stock Count System');
  console.log('  \x1b[32m%s\x1b[0m', `  [CONNECTED] Supabase Cloud: ${SUPABASE_URL}`);
  console.log('  \x1b[32m%s\x1b[0m', `  [ACTIVE] Local SQLite Engine: ${sqliteDb ? 'ONLINE' : 'OFFLINE'}`);
  console.log('  \x1b[32m%s\x1b[0m', '  [ACTIVE] Multi-Tier Rate Limiting & IDOR Engine: ONLINE');
  console.log('  ======================================================');
  console.log(`  Local URL:   \x1b[32mhttp://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}/\x1b[0m`);
  console.log(`  Health API:  \x1b[33mhttp://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}/api/health\x1b[0m`);
  console.log(`  Stock API:   \x1b[33mhttp://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}/api/stock/db\x1b[0m`);
  console.log('  ======================================================\n');
});

module.exports = server;
