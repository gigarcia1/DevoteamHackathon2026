'use strict';
// Carrito en memoria del servidor, indexado por hk_sesion. Solo guarda sku -> cantidad;
// los precios SIEMPRE se recalculan desde el catálogo.
const { bySku, cents } = require('./catalog');

const carts = new Map();
const MAX_QTY = 20;
const PRESUPUESTO_CENTS = 400000;
const ENVIO_GRATIS = 50000;
const MONTAJE_GRATIS = 150000;

function get(sid) {
  if (!carts.has(sid)) carts.set(sid, new Map());
  return carts.get(sid);
}
function add(sid, sku, qty = 1) {
  const p = bySku.get(sku);
  if (!p || !p.disponible) return false;
  const c = get(sid);
  const q = Math.min(MAX_QTY, (c.get(sku) || 0) + Math.max(1, parseInt(qty, 10) || 1));
  c.set(sku, q);
  return true;
}
function setQty(sid, sku, qty) {
  const c = get(sid);
  const q = parseInt(qty, 10);
  if (!q || q < 1) c.delete(sku); else if (bySku.has(sku)) c.set(sku, Math.min(MAX_QTY, q));
}
function clear(sid) { carts.delete(sid); }

function summary(sid) {
  const lines = [];
  let total = 0;
  for (const [sku, quantity] of get(sid)) {
    const p = bySku.get(sku);
    if (!p || !p.disponible) continue;
    const unit = cents(p);
    total += unit * quantity;
    lines.push({ p, sku, quantity, unit, line: unit * quantity });
  }
  const count = lines.reduce((s, l) => s + l.quantity, 0);
  return {
    lines, total, count,
    restante: PRESUPUESTO_CENTS - total,
    faltaEnvio: Math.max(0, ENVIO_GRATIS - total),
    faltaMontaje: Math.max(0, MONTAJE_GRATIS - total),
  };
}

module.exports = { add, setQty, clear, summary, get, PRESUPUESTO_CENTS, ENVIO_GRATIS, MONTAJE_GRATIS };
