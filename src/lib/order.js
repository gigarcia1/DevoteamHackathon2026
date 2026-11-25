'use strict';
// Construye el pedido (precios recalculados en servidor, en céntimos enteros) y lo envía al buzón.
const crypto = require('crypto');

const BUZON_URL = process.env.BUZON_URL || 'https://hk-buzon-168798369712.europe-southwest1.run.app/api/pedido';

function isoWithOffset(d = new Date()) {
  // ISO 8601 con segundos y zona horaria explícita (UTC "+00:00")
  return d.toISOString().replace(/\.\d{3}Z$/, '+00:00');
}

function buildOrder(summary, customer) {
  const items = summary.lines.map((l) => ({
    sku: l.sku, name: l.p.nombre, quantity: l.quantity, unit_price: Number((l.unit / 100).toFixed(2)),
  }));
  const totalCents = summary.lines.reduce((s, l) => s + l.unit * l.quantity, 0);
  return {
    schema_version: '1.0',
    order_id: crypto.randomUUID(),
    created_at: isoWithOffset(),
    customer: { name: customer.name, email: customer.email, address: customer.address },
    items,
    currency: 'EUR',
    total: Number((totalCents / 100).toFixed(2)),
  };
}

async function post(order) {
  return fetch(BUZON_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-clave': process.env.X_CLAVE || '' },
    body: JSON.stringify(order),
    signal: AbortSignal.timeout(10000),
  });
}

// Envía al buzón; si responde 502 reintenta una vez.
async function send(order) {
  let res;
  try { res = await post(order); } catch (e) { res = { status: 0 }; }
  if (res.status === 502 || res.status === 0) {
    try { res = await post(order); } catch (e) { res = { status: 0 }; }
  }
  let body = null;
  try { body = res.text ? await res.text() : null; } catch (_) { /* nada */ }
  return { ok: res.status >= 200 && res.status < 300, status: res.status, body };
}

function validateCustomer(b) {
  const name = String(b.name || '').trim().slice(0, 120);
  const email = String(b.email || '').trim().slice(0, 160);
  const address = String(b.address || '').trim().slice(0, 300);
  const pago = ['tarjeta', 'bizum', 'transferencia'].includes(b.pago) ? b.pago : '';
  const errors = [];
  if (!name) errors.push('Escribe tu nombre.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Escribe un email válido.');
  if (!address) errors.push('Escribe tu dirección de envío.');
  if (!pago) errors.push('Elige un método de pago.');
  return { customer: { name, email, address }, pago, errors };
}

module.exports = { buildOrder, send, validateCustomer, isoWithOffset };
