'use strict';
// Construye el pedido (precios recalculados en servidor, en céntimos enteros) y lo envía al buzón.
const crypto = require('crypto');

const BUZON_URL = process.env.BUZON_URL || 'https://hk-buzon-168798369712.europe-southwest1.run.app/api/pedido';

function isoWithOffset(d = new Date()) {
  // ISO 8601 con segundos y zona horaria (UTC, "Z"), igual que el ejemplo de la guía: 2026-11-25T16:42:10Z
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
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

async function attempt(order) {
  try {
    const r = await post(order);
    let body = '';
    try { body = await r.text(); } catch (_) { /* nada */ }
    return { status: r.status, body };
  } catch (_) { return { status: 0, body: '' }; } // red/timeout
}

// Envía al buzón; si responde 502 (o falla la red) reintenta UNA vez con el mismo order_id.
// Si el primer intento sí llegó a guardarse, el reintento da 422 por order_id repetido: eso cuenta como éxito.
async function send(order) {
  let r = await attempt(order);
  let retried = false;
  if (r.status === 502 || r.status === 0) {
    retried = true;
    r = await attempt(order);
  }
  const dup = retried && r.status === 422 && /order_id/i.test(r.body) && /(repet|duplic|exist|ya )/i.test(r.body);
  return { ok: (r.status >= 200 && r.status < 300) || dup, status: r.status, body: String(r.body).slice(0, 300) };
}

function validateCustomer(b) {
  const name = String(b.name || '').trim().slice(0, 120);
  const email = String(b.email || '').trim().slice(0, 160);
  const address = String(b.address || '').trim().slice(0, 300);
  const errors = [];
  if (!name) errors.push('Falta el nombre.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('El email no es válido (ejemplo: nombre@correo.com).');
  if (!address) errors.push('Falta la dirección de envío.');
  return { customer: { name, email, address }, errors };
}

module.exports = { buildOrder, send, validateCustomer, isoWithOffset };
