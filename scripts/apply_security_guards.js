const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'index.html');
let content = fs.readFileSync(indexPath, 'utf8');

// 1. Add checkClientMaliciousInput and sanitizeClientString
const formulaTarget = `    function escapeCsvFormula(value) {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (/^[=+@\\-\\t\\r]/.test(str)) {
        return "'" + str;
      }
      return str;
    }`;

const formulaReplacement = `    function escapeCsvFormula(value) {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (/^[=+@\\-\\t\\r]/.test(str)) {
        return "'" + str;
      }
      return str;
    }

    function checkClientMaliciousInput(str) {
      if (!str || typeof str !== 'string') return false;
      const sqlPattern = /('(''|[^'])*')|(;)|(\\b(SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|UNION|EXEC|XP_CMDSHELL|TRUNCATE)\\b)|(--)|(\\/\\*)|(\\bOR\\b\\s+['"\\w]+\\s*=\\s*['"\\w]+)|(\\bAND\\b\\s+['"\\w]+\\s*=\\s*['"\\w]+)/i;
      const cmdPattern = /[;&|\`$<>]/;
      const scriptPattern = /<script\\b[^>]*>|javascript:|onerror\\s*=|onload\\s*=|onclick\\s*=|eval\\s*\\(|document\\.cookie|<iframe|<object|<embed/i;
      return sqlPattern.test(str) || cmdPattern.test(str) || scriptPattern.test(str);
    }

    function sanitizeClientString(val, maxLength = 255) {
      if (val === null || val === undefined) return '';
      const cleaned = String(val).replace(/[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]/g, '').trim();
      return cleaned.slice(0, maxLength);
    }`;

content = content.replace(formulaTarget.replace(/\r?\n/g, '\r\n'), formulaReplacement.replace(/\r?\n/g, '\r\n'));
if (!content.includes('checkClientMaliciousInput')) {
  content = content.replace(formulaTarget.replace(/\r?\n/g, '\n'), formulaReplacement.replace(/\r?\n/g, '\n'));
}

// 2. submitCountEntry input check
const countInputTarget = `      const rawInput = (document.getElementById('manualCountQtyInput')?.value || '').trim();
      if (rawInput === '') {
        showToast('Please enter a count quantity (e.g. 0, 5, 100).', 'error');
        document.getElementById('manualCountQtyInput')?.focus();
        return;
      }
      const inputVal = parseFloat(rawInput);
      if (isNaN(inputVal) || inputVal < 0) {
        showToast('Please enter a valid count quantity >= 0.', 'error');
        return;
      }`;

const countInputReplacement = `      const rawInput = (document.getElementById('manualCountQtyInput')?.value || '').trim();
      if (rawInput === '') {
        showToast('Please enter a count quantity (e.g. 0, 5, 100).', 'error');
        document.getElementById('manualCountQtyInput')?.focus();
        return;
      }
      const inputVal = parseFloat(rawInput);
      if (!Number.isFinite(inputVal) || inputVal < 0 || inputVal > 10000000) {
        showToast('Please enter a valid count quantity between 0 and 10,000,000.', 'error');
        return;
      }`;

content = content.replace(countInputTarget.replace(/\r?\n/g, '\r\n'), countInputReplacement.replace(/\r?\n/g, '\r\n'));
if (!content.includes('Number.isFinite(inputVal)')) {
  content = content.replace(countInputTarget.replace(/\r?\n/g, '\n'), countInputReplacement.replace(/\r?\n/g, '\n'));
}

// 3. handleCreateUnlistedItem input check
const unlistedTarget = `      const sku = document.getElementById('unlistedSku').value.trim();
      const name = document.getElementById('unlistedName').value.trim();
      const barcode = document.getElementById('unlistedBarcode').value.trim() || sku;
      const zone = document.getElementById('unlistedZone').value.trim();
      const qty = parseFloat(document.getElementById('unlistedQty').value) || 1;
      const uom = document.getElementById('unlistedUom').value.trim() || 'PCS';`;

const unlistedReplacement = `      const rawSku = document.getElementById('unlistedSku').value.trim();
      const rawName = document.getElementById('unlistedName').value.trim();
      const rawBarcode = document.getElementById('unlistedBarcode').value.trim() || rawSku;
      const rawZone = document.getElementById('unlistedZone').value.trim();
      const rawQty = parseFloat(document.getElementById('unlistedQty').value);
      const rawUom = document.getElementById('unlistedUom').value.trim() || 'PCS';

      if (!rawSku || rawSku.length > 64 || checkClientMaliciousInput(rawSku)) {
        showToast('Invalid SKU: must be 1-64 characters without script or injection tokens.', 'error');
        return;
      }
      if (!rawName || rawName.length > 100 || checkClientMaliciousInput(rawName)) {
        showToast('Invalid Item Name: must be 1-100 characters without script or injection tokens.', 'error');
        return;
      }
      if (rawBarcode.length > 64 || checkClientMaliciousInput(rawBarcode)) {
        showToast('Invalid Barcode: cannot exceed 64 characters or contain injection tokens.', 'error');
        return;
      }
      if (rawZone.length > 50 || checkClientMaliciousInput(rawZone)) {
        showToast('Invalid Zone Location: cannot exceed 50 characters or contain injection tokens.', 'error');
        return;
      }
      if (!Number.isFinite(rawQty) || rawQty <= 0 || rawQty > 10000000) {
        showToast('Count quantity must be a positive finite number between 1 and 10,000,000.', 'error');
        return;
      }

      const sku = escapeCsvFormula(sanitizeClientString(rawSku, 64));
      const name = escapeCsvFormula(sanitizeClientString(rawName, 100));
      const barcode = escapeCsvFormula(sanitizeClientString(rawBarcode, 64));
      const zone = escapeCsvFormula(sanitizeClientString(rawZone, 50));
      const qty = rawQty;
      const uom = escapeCsvFormula(sanitizeClientString(rawUom, 16).toUpperCase());`;

content = content.replace(unlistedTarget.replace(/\r?\n/g, '\r\n'), unlistedReplacement.replace(/\r?\n/g, '\r\n'));
if (!content.includes('rawSku')) {
  content = content.replace(unlistedTarget.replace(/\r?\n/g, '\n'), unlistedReplacement.replace(/\r?\n/g, '\n'));
}

// 4. handleFileSelect file guards
const fileSelectTarget = `    function handleFileSelect(event) {
      const file = event.target.files[0];
      if (!file) return;
      window._lastUploadedFileName = file.name;`;

const fileSelectReplacement = `    function handleFileSelect(event) {
      const file = event.target.files[0];
      if (!file) return;

      // 1. Strict File Type & Extension Whitelist Verification
      const allowedExts = ['.xlsx', '.xls', '.csv'];
      const fileExtMatch = file.name.toLowerCase().match(/\\.[0-9a-z]+$/);
      const fileExt = fileExtMatch ? fileExtMatch[0] : '';
      if (!allowedExts.includes(fileExt)) {
        showToast(\`Unsafe file upload rejected: extension "\${fileExt || 'none'}" is not permitted. Only .xlsx, .xls, and .csv files are supported.\`, 'error', 6000);
        event.target.value = '';
        return;
      }

      // 2. Strict File Size Verification (Max 25 MB)
      const maxUploadBytes = 25 * 1024 * 1024;
      if (file.size <= 0) {
        showToast('The selected spreadsheet file is empty (0 bytes).', 'error');
        event.target.value = '';
        return;
      }
      if (file.size > maxUploadBytes) {
        showToast(\`File size (\${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the maximum allowed 25 MB threshold.\`, 'error', 6000);
        event.target.value = '';
        return;
      }

      window._lastUploadedFileName = file.name;`;

content = content.replace(fileSelectTarget.replace(/\r?\n/g, '\r\n'), fileSelectReplacement.replace(/\r?\n/g, '\r\n'));
if (!content.includes('allowedExts')) {
  content = content.replace(fileSelectTarget.replace(/\r?\n/g, '\n'), fileSelectReplacement.replace(/\r?\n/g, '\n'));
}

// 5. mapSpreadsheetRows formula sanitization & positive bounds
const mapRowsTarget = `        const sku = rawSku;
        const name = (nameKey && row[nameKey] !== undefined && String(row[nameKey]).trim()) ? String(row[nameKey]).trim() : sku;
        const barcode = (barcodeKey && row[barcodeKey] !== undefined && String(row[barcodeKey]).trim()) ? String(row[barcodeKey]).trim() : sku;
        const zone = (zoneKey && row[zoneKey] !== undefined && String(row[zoneKey]).trim()) ? String(row[zoneKey]).trim() : 'General';
        const uom = (uomKey && row[uomKey] !== undefined && String(row[uomKey]).trim()) ? String(row[uomKey]).trim() : 'PCS';
        
        let systemQtyStr = qtyKey && row[qtyKey] !== undefined ? String(row[qtyKey]).trim() : '0';
        const systemQty = parseFloat(systemQtyStr.replace(/[^0-9.-]/g, '')) || 0;`;

const mapRowsReplacement = `        const sku = escapeCsvFormula(sanitizeClientString(rawSku, 64));
        const name = escapeCsvFormula(sanitizeClientString((nameKey && row[nameKey] !== undefined && String(row[nameKey]).trim()) ? String(row[nameKey]).trim() : sku, 100));
        const barcode = escapeCsvFormula(sanitizeClientString((barcodeKey && row[barcodeKey] !== undefined && String(row[barcodeKey]).trim()) ? String(row[barcodeKey]).trim() : sku, 64));
        const zone = escapeCsvFormula(sanitizeClientString((zoneKey && row[zoneKey] !== undefined && String(row[zoneKey]).trim()) ? String(row[zoneKey]).trim() : 'General', 50));
        const uom = escapeCsvFormula(sanitizeClientString((uomKey && row[uomKey] !== undefined && String(row[uomKey]).trim()) ? String(row[uomKey]).trim() : 'PCS', 16));
        
        let systemQtyStr = qtyKey && row[qtyKey] !== undefined ? String(row[qtyKey]).trim() : '0';
        let systemQty = parseFloat(systemQtyStr.replace(/[^0-9.-]/g, '')) || 0;
        if (!Number.isFinite(systemQty) || systemQty < 0) systemQty = 0;
        if (systemQty > 10000000) systemQty = 10000000;`;

content = content.replace(mapRowsTarget.replace(/\r?\n/g, '\r\n'), mapRowsReplacement.replace(/\r?\n/g, '\r\n'));
if (!content.includes('escapeCsvFormula(sanitizeClientString(rawSku')) {
  content = content.replace(mapRowsTarget.replace(/\r?\n/g, '\n'), mapRowsReplacement.replace(/\r?\n/g, '\n'));
}

// 6. handleCreateUser guards
const userTarget = `      const username = document.getElementById('newUsername').value.trim();
      const fullName = document.getElementById('newFullName').value.trim();
      const email = document.getElementById('newEmail').value.trim();
      const password = document.getElementById('newPassword').value.trim();`;

const userReplacement = `      const username = document.getElementById('newUsername').value.trim();
      const fullName = document.getElementById('newFullName').value.trim();
      const email = document.getElementById('newEmail').value.trim();
      const password = document.getElementById('newPassword').value.trim();

      if (!/^[a-zA-Z0-9_\\-\\.]{3,32}$/.test(username) || checkClientMaliciousInput(username)) {
        showToast('Username must be 3-32 characters without script or injection tokens.', 'error');
        return;
      }
      if (fullName.length < 2 || fullName.length > 100 || checkClientMaliciousInput(fullName)) {
        showToast('Full name must be 2-100 characters without script or injection tokens.', 'error');
        return;
      }
      if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
        showToast('Password must be at least 8 characters and contain both letters and numbers.', 'error');
        return;
      }`;

content = content.replace(userTarget.replace(/\r?\n/g, '\r\n'), userReplacement.replace(/\r?\n/g, '\r\n'));
if (!content.includes('^[a-zA-Z0-9_\\-\\.]')) {
  content = content.replace(userTarget.replace(/\r?\n/g, '\n'), userReplacement.replace(/\r?\n/g, '\n'));
}

// 7. handleCreateSession guards
const sessionTarget = `      const title = document.getElementById('newSessionTitle').value.trim();
      const desc = document.getElementById('newSessionDesc').value.trim();
      const countType = document.getElementById('newSessionCountType').value;`;

const sessionReplacement = `      const title = document.getElementById('newSessionTitle').value.trim();
      const desc = document.getElementById('newSessionDesc').value.trim();
      const countType = document.getElementById('newSessionCountType').value;

      if (!title || title.length < 2 || title.length > 128 || checkClientMaliciousInput(title)) {
        showToast('Session title must be between 2 and 128 characters without injection tokens.', 'error');
        return;
      }
      if (desc.length > 500 || checkClientMaliciousInput(desc)) {
        showToast('Description cannot exceed 500 characters or contain injection tokens.', 'error');
        return;
      }
      const allowedCountTypes = ['BLIND_COUNT', 'BLIND_ALL', 'OPEN_COUNT'];
      if (!allowedCountTypes.includes(countType)) {
        showToast('Invalid count mode selected.', 'error');
        return;
      }`;

content = content.replace(sessionTarget.replace(/\r?\n/g, '\r\n'), sessionReplacement.replace(/\r?\n/g, '\r\n'));
if (!content.includes('allowedCountTypes')) {
  content = content.replace(sessionTarget.replace(/\r?\n/g, '\n'), sessionReplacement.replace(/\r?\n/g, '\n'));
}

fs.writeFileSync(indexPath, content, 'utf8');
console.log('Successfully applied all client-side security guards to index.html!');
