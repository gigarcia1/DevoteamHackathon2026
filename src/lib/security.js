'use strict';
const crypto = require('crypto');

const HEADERS = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
};

// Se monta el primero: aplica a TODAS las respuestas (páginas, API, estáticos, 404 y 500).
function securityHeaders(req, res, next) {
  for (const [k, v] of Object.entries(HEADERS)) res.setHeader(k, v);
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');
  next();
}

const COOKIE = 'hk_sesion';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

// Sesión: cookie hk_sesion (uuid v4) en la primera visita a cualquier página (incluida /).
function session(req, res, next) {
  const c = parseCookies(req.headers.cookie)[COOKIE];
  if (c && UUID_RE.test(c)) { req.sid = c; return next(); }
  req.sid = crypto.randomUUID();
  res.append('Set-Cookie', `${COOKIE}=${req.sid}; Path=/; Max-Age=2592000; Secure; HttpOnly; SameSite=Lax`);
  next();
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

module.exports = { securityHeaders, session, esc, parseCookies };
