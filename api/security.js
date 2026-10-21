/**
 * Lina Manufacturing · Enterprise Security & Integrity Kernel
 * Vercel Serverless Function & Security Kernel Bridge
 */

const security = require('../lib/security');

// Handler function if invoked as a Serverless Function endpoint by Vercel
function handler(req, res) {
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint not found' }));
}

// Attach all security utilities directly onto the exported handler function
// for transparent backward compatibility with require('./security')
Object.assign(handler, security);

module.exports = handler;
