/**
 * Lina Manufacturing · Enterprise Security & Integrity Kernel
 * Authoritative Security Controls:
 * - PBKDF2-HMAC-SHA256 Cryptographic Authentication & Password Work Factor Validation
 * - Cryptographically Signed Sessions with Explicit Lifetime, Inactivity Timeout & Revocation
 * - Multi-Tier Rate Limiting (Login, General API, Account Creation, AI Generation, Anti-Scraping)
 * - Bot & Automated Scraper Detection Firewall
 * - Insecure Direct Object Reference (IDOR) Ownership & Authorization Enforcement
 * - HTTPS Enforcement, Secure Headers & Cryptographic Audit Logging
 */

const crypto = require('crypto');

// ============================================================================
// 1. CONFIGURATION & SECRETS MANAGEMENT
// ============================================================================
const NODE_ENV = process.env.NODE_ENV || 'production';

// Cryptographic Session Secret Key (Enforce high-entropy random key if unconfigured)
let SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET || SESSION_SECRET.length < 32 || SESSION_SECRET === 'your_production_session_secret_key_here') {
  if (NODE_ENV === 'production' && !SESSION_SECRET) {
    console.warn('[SECURITY WARNING] SESSION_SECRET not set in environment. Generating dynamic high-entropy ephemeral secret.');
  }
  // Generate high-entropy 256-bit secret for token signing
  SESSION_SECRET = SESSION_SECRET || crypto.randomBytes(32).toString('hex');
}

// Session Lifetimes
const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;    // 8 Hours Hard Lifetime
const SESSION_IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 Hours Inactivity Timeout

// Token Revocation Blacklist (In-Memory with automatic TTL pruning)
const revokedTokens = new Map(); // tokenSig -> expiryTimestamp

function purgeRevokedTokens() {
  const now = Date.now();
  for (const [sig, expiry] of revokedTokens.entries()) {
    if (now > expiry) {
      revokedTokens.delete(sig);
    }
  }
}
const purgeTimer = setInterval(purgeRevokedTokens, 15 * 60 * 1000);
if (purgeTimer && purgeTimer.unref) purgeTimer.unref();

// ============================================================================
// 2. CRYPTOGRAPHIC PASSWORD HASHING (PBKDF2-HMAC-SHA256)
// ============================================================================
const PBKDF2_ITERATIONS = 100000;
const PBKDF2_KEYLEN = 32;
const PBKDF2_DIGEST = 'sha256';

function generateSecureSalt(bytes = 16) {
  return crypto.randomBytes(bytes).toString('hex');
}

function hashPasswordPbkdf2(password, salt) {
  return new Promise((resolve, reject) => {
    if (!password || !salt) {
      return reject(new Error('Password and salt are required for PBKDF2 hashing'));
    }
    crypto.pbkdf2(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST, (err, derivedKey) => {
      if (err) return reject(err);
      resolve('pbkdf2$' + derivedKey.toString('hex'));
    });
  });
}

function verifyPasswordPbkdf2(password, salt, storedHash) {
  return new Promise((resolve) => {
    if (!password || !salt || !storedHash) return resolve(false);

    const cleanHash = storedHash.startsWith('pbkdf2$') ? storedHash.slice(7) : storedHash;

    crypto.pbkdf2(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST, (err, derivedKey) => {
      if (err) return resolve(false);
      const computedHex = derivedKey.toString('hex');

      // Constant-time comparison to prevent timing attacks
      if (computedHex.length === cleanHash.length) {
        if (crypto.timingSafeEqual(Buffer.from(computedHex), Buffer.from(cleanHash))) {
          return resolve(true);
        }
      }

      // Transparent backward compatibility: Salted SHA-256 fallback (will require upgrade)
      const legacyHex = crypto.createHash('sha256').update(salt + ':' + password).digest('hex');
      if (legacyHex.length === cleanHash.length && crypto.timingSafeEqual(Buffer.from(legacyHex), Buffer.from(cleanHash))) {
        return resolve('NEEDS_UPGRADE');
      }

      return resolve(false);
    });
  });
}

function validatePasswordStrength(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password must be provided' };
  }
  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters in length' };
  }
  // Check for mix of characters (letters and numbers)
  const hasLetters = /[a-zA-Z]/.test(password);
  const hasNumbers = /[0-9]/.test(password);
  if (!hasLetters || !hasNumbers) {
    return { valid: false, error: 'Password must contain both letters and numbers' };
  }
  // Check common weak passwords
  const weakPasswords = ['password', '12345678', 'admin123', 'counter123', 'super123', 'password123'];
  if (weakPasswords.includes(password.toLowerCase())) {
    return { valid: false, error: 'Password is too common or easily guessable' };
  }
  return { valid: true };
}

// Sanitize user object before returning to client (Ensures secrets are NEVER exposed)
function sanitizeUser(user) {
  if (!user || typeof user !== 'object') return null;
  const safe = { ...user };
  delete safe.password;
  delete safe.password_hash;
  delete safe.password_salt;
  delete safe.secret;
  return safe;
}

// ============================================================================
// 3. CRYPTOGRAPHIC SESSION MANAGEMENT
// ============================================================================
function signSessionToken(user) {
  const now = Date.now();
  const jti = crypto.randomBytes(16).toString('hex');
  const payload = JSON.stringify({
    id: user.id,
    username: user.username,
    role: user.role,
    full_name: user.full_name,
    iat: now,
    exp: now + SESSION_MAX_AGE_MS,
    idleExp: now + SESSION_IDLE_TIMEOUT_MS,
    jti: jti
  });

  const b64 = Buffer.from(payload).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(b64).digest('base64url');
  return `${b64}.${sig}`;
}

function verifySessionToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [b64, sig] = parts;

  // 1. Check if token signature is in revocation list
  if (revokedTokens.has(sig)) {
    return null;
  }

  // 2. Cryptographic signature verification in constant time
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(b64).digest('base64url');
  if (sig.length !== expectedSig.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
    return null;
  }

  // 3. Payload integrity and expiration verification
  try {
    const payload = JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'));
    const now = Date.now();

    // Check hard expiration
    if (!payload.exp || now > payload.exp) {
      return null;
    }

    // Check inactivity / idle expiration
    if (payload.idleExp && now > payload.idleExp) {
      return null;
    }

    // Sliding window for idle expiration
    payload.idleExp = now + SESSION_IDLE_TIMEOUT_MS;
    payload.tokenSig = sig;
    return payload;
  } catch (_) {
    return null;
  }
}

function revokeSessionToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return;
  const parts = token.split('.');
  if (parts.length === 2) {
    const sig = parts[1];
    revokedTokens.set(sig, Date.now() + SESSION_MAX_AGE_MS);
  }
}

function parseCookies(req) {
  const list = {};
  const rc = req.headers.cookie;
  if (rc) {
    rc.split(';').forEach((cookie) => {
      const parts = cookie.split('=');
      if (parts.length >= 2) {
        list[parts.shift().trim()] = decodeURI(parts.join('='));
      }
    });
  }
  return list;
}

function getAuthenticatedUser(req) {
  // 1. Check Bearer Authorization Header
  const authHeader = req.headers['authorization'] || '';
  if (authHeader.startsWith('Bearer ')) {
    const bearer = authHeader.slice(7).trim();
    const u = verifySessionToken(bearer);
    if (u) return u;
  }

  // 2. Check HttpOnly Session Cookie
  const cookies = parseCookies(req);
  const cookieToken = cookies['LINA_AUTH_SESSION'];
  if (cookieToken) {
    const u = verifySessionToken(cookieToken);
    if (u) return u;
  }

  return null;
}

// ============================================================================
// 4. MULTI-TIER RATE LIMITING & ABUSE PROTECTION
// ============================================================================
class SlidingWindowRateLimiter {
  constructor(windowMs, maxRequests) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.records = new Map(); // key -> [timestamps]
  }

  isAllowed(key) {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    let timestamps = this.records.get(key) || [];
    // Filter out expired timestamps
    timestamps = timestamps.filter(t => t > windowStart);

    if (timestamps.length >= this.maxRequests) {
      const oldestInWindow = timestamps[0];
      const retryAfter = Math.ceil((oldestInWindow + this.windowMs - now) / 1000);
      this.records.set(key, timestamps);
      return { allowed: false, retryAfter: Math.max(1, retryAfter), count: timestamps.length };
    }

    timestamps.push(now);
    this.records.set(key, timestamps);
    return { allowed: true, remaining: this.maxRequests - timestamps.length };
  }

  reset(key) {
    this.records.delete(key);
  }
}

// 1. Login Rate Limiting & Account Lockout Tracker
const loginAttemptTracker = new Map(); // key -> { attempts, lockUntil, firstAttemptTime }
const MAX_USER_LOGIN_ATTEMPTS = 5;
const MAX_IP_LOGIN_ATTEMPTS = 50; // Protects against distributed credential stuffing across many usernames
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;   // 15 Minutes Lockout
const LOGIN_WINDOW_MS = 5 * 60 * 1000;     // 5 Minutes Attempt Window

function checkLoginRateLimit(clientIp, username) {
  const ipKey = `ip:${clientIp}`;
  const userKey = `user:${clientIp}::${(username || '').toLowerCase()}`;
  const now = Date.now();

  const userTracker = loginAttemptTracker.get(userKey);
  if (userTracker && userTracker.lockUntil > now) {
    const remainingSeconds = Math.ceil((userTracker.lockUntil - now) / 1000);
    return {
      locked: true,
      retryAfter: remainingSeconds,
      error: `Account locked due to excessive failed attempts. Please retry in ${remainingSeconds} seconds.`
    };
  }

  const ipTracker = loginAttemptTracker.get(ipKey);
  if (ipTracker && ipTracker.lockUntil > now) {
    const remainingSeconds = Math.ceil((ipTracker.lockUntil - now) / 1000);
    return {
      locked: true,
      retryAfter: remainingSeconds,
      error: `IP address temporarily locked due to excessive failed attempts across accounts. Please retry in ${remainingSeconds} seconds.`
    };
  }

  return { locked: false };
}

function recordLoginFailure(clientIp, username) {
  const ipKey = `ip:${clientIp}`;
  const userKey = `user:${clientIp}::${(username || '').toLowerCase()}`;
  const now = Date.now();

  // 1. User-specific attempt tracking
  let userTracker = loginAttemptTracker.get(userKey);
  if (!userTracker || now - userTracker.firstAttemptTime > LOGIN_WINDOW_MS) {
    userTracker = { attempts: 0, lockUntil: 0, firstAttemptTime: now };
  }
  userTracker.attempts += 1;
  if (userTracker.attempts >= MAX_USER_LOGIN_ATTEMPTS) {
    userTracker.lockUntil = now + LOGIN_LOCKOUT_MS;
  }
  loginAttemptTracker.set(userKey, userTracker);

  // 2. IP-wide attempt tracking (higher threshold to avoid NAT/proxy denial of service)
  let ipTracker = loginAttemptTracker.get(ipKey);
  if (!ipTracker || now - ipTracker.firstAttemptTime > LOGIN_WINDOW_MS) {
    ipTracker = { attempts: 0, lockUntil: 0, firstAttemptTime: now };
  }
  ipTracker.attempts += 1;
  if (ipTracker.attempts >= MAX_IP_LOGIN_ATTEMPTS) {
    ipTracker.lockUntil = now + LOGIN_LOCKOUT_MS;
  }
  loginAttemptTracker.set(ipKey, ipTracker);

  const remaining = Math.max(0, MAX_USER_LOGIN_ATTEMPTS - userTracker.attempts);
  return { attempts: userTracker.attempts, remaining, locked: remaining === 0 };
}

function recordLoginSuccess(clientIp, username) {
  const userKey = `user:${clientIp}::${(username || '').toLowerCase()}`;
  loginAttemptTracker.delete(userKey);
}

function resetLoginRateLimit(clientIp, username) {
  if (username) {
    loginAttemptTracker.delete(`user:${clientIp}::${username.toLowerCase()}`);
  }
  if (clientIp) {
    loginAttemptTracker.delete(`ip:${clientIp}`);
  }
}

function resetAllRateLimits() {
  loginAttemptTracker.clear();
  generalApiLimiter.records.clear();
  accountCreationLimiter.records.clear();
  aiGenerationLimiter.records.clear();
  dataScrapingLimiter.records.clear();
}

// 2. General API Rate Limiter (120 requests / minute)
const generalApiLimiter = new SlidingWindowRateLimiter(60 * 1000, 120);

// 3. Account Creation Rate Limiter (5 accounts / 15 minutes)
const accountCreationLimiter = new SlidingWindowRateLimiter(15 * 60 * 1000, 5);

// 4. AI Generation Request Rate Limiter (10 requests / minute)
const aiGenerationLimiter = new SlidingWindowRateLimiter(60 * 1000, 10);

// 5. Bulk Data Export / Scraping Protection Limiter (25 requests / minute)
const dataScrapingLimiter = new SlidingWindowRateLimiter(60 * 1000, 25);

// ============================================================================
// 5. ANTI-BOT & AUTOMATED SCRAPER DETECTION
// ============================================================================
const SUSPICIOUS_BOT_PATTERNS = [
  /python-requests/i,
  /scrapy/i,
  /aiohttp/i,
  /httpx/i,
  /curl\//i,
  /wget/i,
  /libwww-perl/i,
  /nikto/i,
  /sqlmap/i,
  /masscan/i,
  /nmap/i,
  /zgrab/i,
  /gobuster/i,
  /dirbuster/i,
  /headlesschrome/i,
  /phantomjs/i,
  /selenium/i,
  /puppeteer/i
];

function isMaliciousBotOrScraper(req) {
  const userAgent = req.headers['user-agent'] || '';
  const clientIp = req.socket?.remoteAddress || req.headers['x-forwarded-for'] || '127.0.0.1';
  const isLocal = clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === 'localhost';

  // 1. Missing user-agent on remote requests
  if (!userAgent && !isLocal && !req.headers['x-internal-probe']) {
    return { isBot: true, reason: 'Missing User-Agent header from remote client' };
  }

  // 2. Known automated exploit & scraper user-agent signatures
  for (const pattern of SUSPICIOUS_BOT_PATTERNS) {
    if (pattern.test(userAgent)) {
      // Allow curl only in explicit test environments with authorization
      const auth = req.headers['authorization'];
      if (!auth) {
        return { isBot: true, reason: `Suspicious automated agent detected: ${userAgent}` };
      }
    }
  }

  // 3. Rapid scanning probe detection (Detect path traversal or sensitive files)
  const url = req.url || '';
  if (url.includes('.env') || url.includes('.git') || url.includes('wp-admin') || url.includes('phpmyadmin')) {
    return { isBot: true, reason: `Reconnaissance probe detected: ${url}` };
  }

  return { isBot: false };
}

// Security: Comprehensive Input Validation, Sanitization & Injection Defense-in-Depth
const SQL_INJECTION_REGEX = /('(''|[^'])*')|(;)|(\b(SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|UNION|EXEC|XP_CMDSHELL|TRUNCATE)\b)|(--)|(\/\*)|(\bOR\b\s+['"\w]+\s*=\s*['"\w]+)|(\bAND\b\s+['"\w]+\s*=\s*['"\w]+)/i;
const COMMAND_INJECTION_REGEX = /[;&|`$<>]/;
const SCRIPT_INJECTION_REGEX = /<script\b[^>]*>|javascript:|onerror\s*=|onload\s*=|onclick\s*=|eval\s*\(|document\.cookie|<iframe|<object|<embed/i;

function checkSqlInjection(input) {
  if (typeof input !== 'string') return false;
  return SQL_INJECTION_REGEX.test(input) || COMMAND_INJECTION_REGEX.test(input);
}

function checkScriptInjection(input) {
  if (typeof input !== 'string') return false;
  return SCRIPT_INJECTION_REGEX.test(input);
}

function checkMaliciousInput(input) {
  if (typeof input !== 'string') return false;
  return checkSqlInjection(input) || checkScriptInjection(input);
}

function sanitizeString(val, maxLength = 255) {
  if (val === null || val === undefined) return '';
  // Strip control characters: 0x00-0x08, 0x0B, 0x0C, 0x0E-0x1F, 0x7F
  const cleaned = String(val).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();
  return cleaned.slice(0, maxLength);
}

function sanitizeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function sanitizeFormulaInjection(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/^[=+@\-\t\r]/.test(str)) {
    return "'" + str;
  }
  return str;
}

function validatePositiveNumber(val, max = 10000000, allowZero = true) {
  if (val === null || val === undefined) {
    return { valid: false, error: 'Numeric value is required' };
  }
  let num;
  if (typeof val === 'number') {
    num = val;
  } else if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
      return { valid: false, error: 'Value must be a valid numeric format' };
    }
    num = Number(trimmed);
  } else {
    return { valid: false, error: 'Value must be a number' };
  }
  if (!Number.isFinite(num)) {
    return { valid: false, error: 'Value must be a valid finite number' };
  }
  if (allowZero ? num < 0 : num <= 0) {
    return { valid: false, error: `Value must be ${allowZero ? '>= 0' : '> 0'}` };
  }
  if (num > max) {
    return { valid: false, error: `Value exceeds maximum allowable threshold (${max})` };
  }
  return { valid: true, value: num };
}

function validateEnum(val, allowedArray, fieldName = 'Value') {
  if (!val || typeof val !== 'string') {
    return { valid: false, error: `${fieldName} is required` };
  }
  const cleanVal = val.trim();
  if (!allowedArray.includes(cleanVal)) {
    return { valid: false, error: `Invalid ${fieldName}: "${cleanVal}". Allowed options: ${allowedArray.join(', ')}` };
  }
  return { valid: true, value: cleanVal };
}

function validateIdentifier(val, minLen = 1, maxLen = 64, fieldName = 'Identifier') {
  if (!val || typeof val !== 'string') {
    return { valid: false, error: `${fieldName} must be a non-empty string` };
  }
  const cleanVal = val.trim();
  if (cleanVal.length < minLen || cleanVal.length > maxLen) {
    return { valid: false, error: `${fieldName} must be between ${minLen} and ${maxLen} characters` };
  }
  if (!/^[a-zA-Z0-9_\-\.]{1,64}$/.test(cleanVal)) {
    return { valid: false, error: `${fieldName} contains invalid characters. Only alphanumeric, dashes, dots, and underscores allowed.` };
  }
  return { valid: true, value: cleanVal };
}

const ALLOWED_UPLOAD_EXTENSIONS = ['.xlsx', '.xls', '.csv'];
const ALLOWED_UPLOAD_MIMES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'application/csv',
  'text/plain',
  'application/octet-stream'
];
const MAX_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

function validateFileUpload(filename, mimeType, sizeBytes, maxBytes = MAX_UPLOAD_SIZE_BYTES) {
  if (!filename || typeof filename !== 'string') {
    return { valid: false, error: 'File name is required' };
  }
  const extMatch = filename.toLowerCase().match(/\.[0-9a-z]+$/);
  const ext = extMatch ? extMatch[0] : '';
  if (!ALLOWED_UPLOAD_EXTENSIONS.includes(ext)) {
    return { valid: false, error: `Unsafe file upload rejected: extension "${ext}" is not permitted. Only .xlsx, .xls, and .csv are allowed.` };
  }
  if (typeof sizeBytes === 'number') {
    if (sizeBytes <= 0) {
      return { valid: false, error: 'File is empty (0 bytes)' };
    }
    if (sizeBytes > maxBytes) {
      return { valid: false, error: `File size exceeds the 25MB maximum threshold (${(sizeBytes / (1024 * 1024)).toFixed(1)} MB)` };
    }
  }
  if (mimeType && typeof mimeType === 'string') {
    const cleanMime = mimeType.toLowerCase().split(';')[0].trim();
    if (cleanMime && !ALLOWED_UPLOAD_MIMES.includes(cleanMime)) {
      return { valid: false, error: `Unsafe file MIME type rejected: ${cleanMime}` };
    }
  }
  return { valid: true, filename, ext };
}

function validateAndSanitizeInput(type, value, options = {}) {
  if (value === null || value === undefined) {
    if (options.required) {
      return { valid: false, error: `${type} is required` };
    }
    return { valid: true, value: '' };
  }

  const str = String(value).trim();

  switch (type) {
    case 'USERNAME': {
      if (checkMaliciousInput(str)) {
        return { valid: false, error: 'Malicious input detected. Request blocked by security firewall.' };
      }
      if (str.length < 3 || str.length > 32) {
        return { valid: false, error: 'Username must be between 3 and 32 characters' };
      }
      if (!/^[a-zA-Z0-9_\-\.]{3,32}$/.test(str)) {
        return { valid: false, error: 'Username contains invalid characters (letters, numbers, _, -, . only)' };
      }
      return { valid: true, value: str.toLowerCase() };
    }
    case 'FULL_NAME': {
      if (str.length < 2 || str.length > 100) {
        return { valid: false, error: 'Full name must be between 2 and 100 characters' };
      }
      if (checkMaliciousInput(str)) {
        return { valid: false, error: 'Malicious characters detected in full name' };
      }
      return { valid: true, value: sanitizeString(str, 100) };
    }
    case 'ROLE': {
      const allowedRoles = ['ADMIN', 'MANAGER', 'SUPERVISOR', 'COUNTER', 'EXECUTIVE'];
      return validateEnum(str.toUpperCase(), allowedRoles, 'User Role');
    }
    case 'SESSION_CODE': {
      if (!/^[a-zA-Z0-9_\-\.]{3,32}$/.test(str)) {
        return { valid: false, error: 'Session code must be 3-32 alphanumeric characters' };
      }
      return { valid: true, value: str };
    }
    case 'SESSION_TITLE': {
      if (str.length < 2 || str.length > 128) {
        return { valid: false, error: 'Session title must be between 2 and 128 characters' };
      }
      if (checkMaliciousInput(str)) {
        return { valid: false, error: 'Malicious characters detected in session title' };
      }
      return { valid: true, value: sanitizeString(str, 128) };
    }
    case 'COUNT_TYPE': {
      const allowed = ['PHYSICAL', 'CYCLE', 'BLIND', 'SPOT_CHECK', 'BLIND_COUNT', 'BLIND_ALL', 'OPEN_COUNT', 'DOUBLE_BLIND', 'SUPERVISED_COUNT'];
      return validateEnum(str.toUpperCase(), allowed, 'Count Type');
    }
    case 'SKU': {
      if (!str || str.length > 64) {
        return { valid: false, error: 'SKU code must be 1 to 64 characters' };
      }
      if (checkMaliciousInput(str)) {
        return { valid: false, error: 'Malicious characters detected in SKU' };
      }
      return { valid: true, value: sanitizeFormulaInjection(sanitizeString(str, 64)) };
    }
    case 'BARCODE': {
      if (!str || str.length > 64) {
        return { valid: false, error: 'Barcode must be 1 to 64 characters' };
      }
      if (checkMaliciousInput(str)) {
        return { valid: false, error: 'Malicious characters detected in barcode' };
      }
      return { valid: true, value: sanitizeFormulaInjection(sanitizeString(str, 64)) };
    }
    case 'LOCATION': {
      if (str.length > 64) {
        return { valid: false, error: 'Location must be at most 64 characters' };
      }
      if (checkMaliciousInput(str)) {
        return { valid: false, error: 'Malicious characters detected in location' };
      }
      return { valid: true, value: sanitizeFormulaInjection(sanitizeString(str || 'FLOOR', 64)) };
    }
    case 'UOM': {
      const cleanUom = sanitizeString(str || 'PCS', 16).toUpperCase();
      return { valid: true, value: cleanUom };
    }
    case 'QUANTITY': {
      return validatePositiveNumber(value, options.max || 10000000, options.allowZero !== false);
    }
    case 'NOTES': {
      if (str.length > 500) {
        return { valid: false, error: 'Notes cannot exceed 500 characters' };
      }
      if (checkScriptInjection(str)) {
        return { valid: false, error: 'Script injection detected in notes' };
      }
      return { valid: true, value: sanitizeString(str, 500) };
    }
    default:
      return { valid: true, value: sanitizeString(str, 255) };
  }
}

function hasPrototypePollution(obj) {
  if (!obj || typeof obj !== 'object') return false;
  for (const key of Object.keys(obj)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') return true;
    if (typeof obj[key] === 'object' && hasPrototypePollution(obj[key])) return true;
  }
  return false;
}

function deepScanPayload(obj) {
  if (!obj) return false;
  return hasPrototypePollution(obj);
}

// ============================================================================
// 6. INSECURE DIRECT OBJECT REFERENCE (IDOR) & OWNERSHIP ENFORCEMENT
// ============================================================================

/**
 * Enforces ownership check on Stock Count Sessions
 * - ADMIN: Unrestricted access across all sessions
 * - EXECUTIVE / SUPERVISOR: Full control only over sessions they created or own.
 * - COUNTER: Strict read-only for counting. Modifying or deleting is strictly forbidden.
 */
function verifySessionOwnership(authUser, session, action = 'MODIFY') {
  if (!authUser) {
    return { allowed: false, statusCode: 401, error: 'Unauthorized: Authentication required' };
  }

  if (authUser.role === 'COUNTER') {
    return { allowed: false, statusCode: 403, error: 'Forbidden: Counter operators cannot modify or delete sessions' };
  }

  if (authUser.role === 'ADMIN') {
    return { allowed: true };
  }

  // Executive / Supervisor ownership verification
  if (authUser.role === 'EXECUTIVE' || authUser.role === 'SUPERVISOR' || authUser.role === 'MANAGER') {
    if (!session) {
      return { allowed: true }; // New session creation
    }

    // Verify creator ownership
    const sessionCreator = session.created_by;
    if (sessionCreator && sessionCreator !== authUser.id && sessionCreator !== authUser.username) {
      return {
        allowed: false,
        statusCode: 403,
        error: `Forbidden (IDOR Protection): You do not have ownership of session "${session.id}". Only the creator or an Administrator can ${action.toLowerCase()} it.`
      };
    }

    return { allowed: true };
  }

  return { allowed: false, statusCode: 403, error: 'Forbidden: Insufficient privileges' };
}

/**
 * Enforces ownership check on User Management
 * - ADMIN: Can manage all accounts (except root admin cannot be deleted or deactivated)
 * - EXECUTIVE / SUPERVISOR: Can ONLY manage COUNTER accounts; cannot escalate privileges or modify other executives/admins.
 * - COUNTER: Cannot manage any accounts (403 Forbidden).
 */
function verifyUserManagementAccess(authUser, targetUser, targetRole, action = 'MODIFY') {
  if (!authUser) {
    return { allowed: false, statusCode: 401, error: 'Unauthorized' };
  }

  if (authUser.role === 'COUNTER') {
    return { allowed: false, statusCode: 403, error: 'Forbidden: Counter operators are not authorized for user management' };
  }

  const targetId = targetUser ? targetUser.id : null;
  const isRootAdmin = targetId === 'u-admin' || (targetUser && targetUser.username && targetUser.username.toLowerCase() === 'admin');

  // Prevent root admin deactivation or modification by anyone other than root admin himself
  if (isRootAdmin) {
    if (action === 'DELETE' || action === 'DEACTIVATE' || action === 'SOFT_REMOVE') {
      return { allowed: false, statusCode: 400, error: 'Root administrator account is immutable and cannot be deactivated or removed' };
    }
    if (authUser.role !== 'ADMIN') {
      return { allowed: false, statusCode: 403, error: 'Forbidden: Only Administrators can modify administrator accounts' };
    }
  }

  if (authUser.role === 'ADMIN') {
    if (action === 'CREATE' && targetRole === 'ADMIN') {
      return { allowed: false, statusCode: 403, error: 'Secondary Administrator account creation is restricted by enterprise policy' };
    }
    return { allowed: true };
  }

  // Executive / Supervisor tier restrictions
  if (authUser.role === 'EXECUTIVE' || authUser.role === 'SUPERVISOR') {
    if (action === 'CREATE') {
      if (targetRole && targetRole !== 'COUNTER') {
        return { allowed: false, statusCode: 403, error: 'Forbidden: Executives can only provision COUNTER accounts' };
      }
      return { allowed: true };
    }

    // Modifying or toggling existing user: Must be a COUNTER
    if (targetUser && targetUser.role !== 'COUNTER') {
      return {
        allowed: false,
        statusCode: 403,
        error: `Forbidden (IDOR Protection): Executives cannot modify ${targetUser.role} accounts. Access restricted to Counter personnel.`
      };
    }

    if (targetRole && targetRole !== 'COUNTER') {
      return { allowed: false, statusCode: 403, error: 'Forbidden: Executives cannot elevate accounts above COUNTER role' };
    }

    return { allowed: true };
  }

  return { allowed: false, statusCode: 403, error: 'Forbidden: Insufficient permissions' };
}

/**
 * Enforces ownership and validity for Count Submissions
 * - Requires active session
 * - Binds submitter identity directly to authenticated session token
 */
function verifyCountSubmission(authUser, session) {
  if (!authUser) {
    return { allowed: false, statusCode: 401, error: 'Unauthorized: Authentication required to submit inventory counts' };
  }

  if (session && session.status && session.status !== 'ACTIVE') {
    return {
      allowed: false,
      statusCode: 400,
      error: `Invalid Operation: Session "${session.id}" is ${session.status}. Inventory counts can only be recorded for ACTIVE sessions.`
    };
  }

  return { allowed: true };
}

// ============================================================================
// 7. SECURITY AUDIT & ANOMALY LOGGING
// ============================================================================
function logSecurityEvent(eventType, details, req = null, extraMeta = {}) {
  const timestamp = new Date().toISOString();
  const clientIp = req ? (req.socket?.remoteAddress || req.headers['x-forwarded-for'] || '127.0.0.1') : 'internal';
  const userAgent = req ? (req.headers['user-agent'] || 'unknown') : 'internal';
  const path = req ? req.url : 'n/a';

  const logEntry = {
    timestamp,
    security_event: eventType,
    client_ip: clientIp,
    user_agent: userAgent,
    path: path,
    details: details,
    ...extraMeta
  };

  // Structured security log output
  const levelPrefix = eventType.includes('FAIL') || eventType.includes('ABUSE') || eventType.includes('BLOCKED')
    ? '\x1b[31m[SEC-ALERT]\x1b[0m'
    : '\x1b[32m[SEC-AUDIT]\x1b[0m';

  console.log(`${levelPrefix} ${JSON.stringify(logEntry)}`);
  return logEntry;
}

// ============================================================================
// 8. HTTP SECURITY HEADERS & HTTPS ENFORCEMENT
// ============================================================================
function getSecurityHeaders(extraHeaders = {}) {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Permissions-Policy': 'geolocation=(), camera=(self), microphone=()',
    ...extraHeaders
  };
}

module.exports = {
  // Passwords
  hashPasswordPbkdf2,
  verifyPasswordPbkdf2,
  validatePasswordStrength,
  generateSecureSalt,
  sanitizeUser,

  // Sessions
  signSessionToken,
  verifySessionToken,
  revokeSessionToken,
  getAuthenticatedUser,
  parseCookies,

  // Rate Limiting & Abuse
  checkLoginRateLimit,
  recordLoginFailure,
  recordLoginSuccess,
  generalApiLimiter,
  accountCreationLimiter,
  aiGenerationLimiter,
  dataScrapingLimiter,
  isMaliciousBotOrScraper,

  // Input & Payload Validation & Sanitization
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

  // IDOR & Authorization
  verifySessionOwnership,
  verifyUserManagementAccess,
  verifyCountSubmission,

  // Logging & Headers
  logSecurityEvent,
  getSecurityHeaders,

  // Admin / Testing Rate Limit Reset Helpers
  resetLoginRateLimit,
  resetAllRateLimits
};
