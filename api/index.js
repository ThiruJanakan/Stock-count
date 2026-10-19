/**
 * Lina Manufacturing · Enterprise Stock Verification Cloud
 * Vercel Serverless Function API Entrypoint
 * 
 * Powered by Supabase Cloud PostgreSQL
 */

const https = require('https');
const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || '';
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || '';

let SUPABASE_HOST = '';
try {
  SUPABASE_HOST = new URL(SUPABASE_URL).hostname;
} catch (_) {}

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
      console.warn('Supabase request error:', err.message);
      resolve(null);
    });

    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

// Security: Check Malicious Input / SQL Injection
const SQL_INJECTION_REGEX = /('(''|[^'])*')|(;)|(\b(SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|UNION|EXEC|XP_CMDSHELL|TRUNCATE)\b)|(--)|(\/\*)|(\bOR\b\s+['"\w]+\s*=\s*['"\w]+)|(\bAND\b\s+['"\w]+\s*=\s*['"\w]+)/i;
const COMMAND_INJECTION_REGEX = /[;&|`$<>]/;

function checkSqlInjection(input) {
  if (typeof input !== 'string') return false;
  return SQL_INJECTION_REGEX.test(input) || COMMAND_INJECTION_REGEX.test(input);
}

function deepScanPayload(obj) {
  if (!obj) return false;
  if (typeof obj === 'string') return checkSqlInjection(obj);
  if (typeof obj === 'object') {
    for (const key of Object.keys(obj)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') return true;
      if (checkSqlInjection(key)) return true;
      if (deepScanPayload(obj[key])) return true;
    }
  }
  return false;
}

// Password verification (Supports PBKDF2-HMAC-SHA256 and salted SHA-256 fallback)
function verifyPasswordPbkdf2(password, salt, storedHash) {
  return new Promise((resolve) => {
    if (!storedHash || !salt) return resolve(false);
    const cleanHash = storedHash.startsWith('pbkdf2$') ? storedHash.slice(7) : storedHash;

    crypto.pbkdf2(password, salt, 100000, 32, 'sha256', (err, derivedKey) => {
      if (!err) {
        const computedHex = derivedKey.toString('hex');
        if (computedHex.length === cleanHash.length && crypto.timingSafeEqual(Buffer.from(computedHex), Buffer.from(cleanHash))) {
          return resolve(true);
        }
      }

      // Fallback: Salted SHA-256 check
      const legacyHex = crypto.createHash('sha256').update(salt + ':' + password).digest('hex');
      if (legacyHex.length === cleanHash.length && crypto.timingSafeEqual(Buffer.from(legacyHex), Buffer.from(cleanHash))) {
        return resolve(true);
      }

      resolve(false);
    });
  });
}

function parseCookies(req) {
  const list = {};
  const rc = req.headers.cookie;
  if (rc) {
    rc.split(';').forEach((cookie) => {
      const parts = cookie.split('=');
      list[parts.shift().trim()] = decodeURI(parts.join('='));
    });
  }
  return list;
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
  const reqUrl = (req.url || '').split('?')[0];
  const reqMethod = (req.method || 'GET').toUpperCase();

  function sendJson(statusCode, data, extraHeaders = {}) {
    res.writeHead(statusCode, {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Access-Control-Allow-Origin': req.headers.origin || '*',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      ...extraHeaders
    });
    res.end(JSON.stringify(data));
  }

  if (reqMethod === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': req.headers.origin || '*',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Max-Age': '86400'
    });
    return res.end();
  }

  // 1. Health API
  if (reqUrl.endsWith('/api/health') || reqUrl === '/api/health') {
    return sendJson(200, {
      status: 'UP',
      service: 'Lina Enterprise Stock Verification Cloud (Vercel Serverless)',
      timestamp: new Date().toISOString(),
      cloud: {
        provider: 'Supabase Cloud PostgreSQL',
        url: SUPABASE_URL,
        status: 'CONNECTED'
      }
    });
  }

  // 2. Public Config
  if (reqUrl.endsWith('/api/supabase/config')) {
    return sendJson(200, {
      supabaseUrl: SUPABASE_URL,
      publishableKey: SUPABASE_PUBLISHABLE_KEY
    });
  }

  // 3. Login
  if (reqUrl.endsWith('/api/auth/login') && reqMethod === 'POST') {
    const body = await parseBody(req);
    const username = (body.username || '').trim();
    const password = (body.password || '').trim();

    if (checkSqlInjection(username) || checkSqlInjection(password)) {
      return sendJson(400, { error: 'Malicious input detected' });
    }

    const sbRes = await supabaseRequest(`stock_users?username=eq.${encodeURIComponent(username.toLowerCase())}&select=*`);
    if (!sbRes || sbRes.status !== 200 || !Array.isArray(sbRes.data) || sbRes.data.length === 0) {
      return sendJson(401, { error: 'Invalid credentials' });
    }

    const user = sbRes.data[0];
    if (!user.is_active) {
      return sendJson(401, { error: 'Account is deactivated' });
    }

    const isValid = await verifyPasswordPbkdf2(password, user.password_salt, user.password_hash);
    if (!isValid) {
      return sendJson(401, { error: 'Invalid credentials' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const cookieHeader = `LINA_AUTH_SESSION=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800; Secure`;

    return sendJson(200, {
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: user.role
      }
    }, { 'Set-Cookie': cookieHeader });
  }

  // 4. Session Check
  if (reqUrl.endsWith('/api/auth/session') && reqMethod === 'GET') {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return sendJson(401, { authenticated: false });
    return sendJson(200, { authenticated: true });
  }

  // 5. Stock Database Fetch
  if (reqUrl.endsWith('/api/stock/db') && reqMethod === 'GET') {
    const [usersRes, sesRes, itemsRes, logsRes, auditRes] = await Promise.all([
      supabaseRequest('stock_users?select=id,username,full_name,role,is_active,created_at'),
      supabaseRequest('count_sessions?select=*&order=created_at.desc'),
      supabaseRequest('stock_items?select=*&order=sku.asc'),
      supabaseRequest('count_logs?select=*&order=timestamp.desc&limit=500'),
      supabaseRequest('audit_trails?select=*&order=timestamp.desc&limit=2000')
    ]);

    return sendJson(200, {
      source: 'SUPABASE_CLOUD',
      users: usersRes && usersRes.data ? usersRes.data : [],
      sessions: sesRes && sesRes.data ? sesRes.data : [],
      items: itemsRes && itemsRes.data ? itemsRes.data : [],
      logs: logsRes && logsRes.data ? logsRes.data : [],
      audit_trails: auditRes && auditRes.data ? auditRes.data : []
    });
  }

  // 6. Record Stock Count
  if (reqUrl.endsWith('/api/stock/count') && reqMethod === 'POST') {
    const body = await parseBody(req);
    if (deepScanPayload(body)) {
      return sendJson(400, { error: 'Malicious payload detected' });
    }

    const sku = String(body.sku || '').trim();
    const qty = parseFloat(body.counted_qty);
    if (!sku || isNaN(qty) || qty < 0) {
      return sendJson(400, { error: 'Valid SKU and non-negative quantity required' });
    }

    const now = new Date().toISOString();
    let item = null;
    const sbItemRes = await supabaseRequest(`stock_items?sku=eq.${encodeURIComponent(sku)}&select=*`);
    
    if (sbItemRes && sbItemRes.status === 200 && Array.isArray(sbItemRes.data) && sbItemRes.data.length > 0) {
      item = sbItemRes.data[0];
      const newCounted = Number(item.total_counted_qty) + qty;
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
        session_id: 'ses-101',
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

    // Insert log
    const logId = 'log-' + Date.now();
    await supabaseRequest('count_logs', 'POST', {
      id: logId,
      session_id: 'ses-101',
      item_id: item.id,
      sku: item.sku,
      item_name: item.item_name,
      batch_no: item.batch_no || '',
      location: item.zone_location || '',
      qty_counted: qty,
      counted_by: body.counted_by || 'counter',
      timestamp: now
    });

    return sendJson(200, { success: true, item });
  }

  // 7. Audit
  if (reqUrl.endsWith('/api/audit') && reqMethod === 'GET') {
    const sbAuditRes = await supabaseRequest('audit_trails?select=*&order=timestamp.desc&limit=2000');
    return sendJson(200, { audit_trails: sbAuditRes && sbAuditRes.data ? sbAuditRes.data : [] });
  }

  return sendJson(404, { error: 'Endpoint not found' });
};
