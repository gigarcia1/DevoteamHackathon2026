'use strict';
const express = require('express');
const fs = require('fs');
const path = require('path');
const views = require('../../views/pages');
const { bySku, CATEGORIAS, complementos, productos, cents } = require('../lib/catalog');
const cart = require('../lib/cart');
const { byId: packsById } = require('../lib/packs');
const { esc } = require('../lib/security');

const router = express.Router();
const html = (res, s, code = 200) => res.status(code).type('html').set('Cache-Control', 'no-store').send(s);

// Portada cacheada en memoria (una versión por nº de artículos en carrito)
const homeCache = new Map();
router.get('/', (req, res) => {
  const n = cart.summary(req.sid).count;
  if (!homeCache.has(n)) homeCache.set(n, views.home(n));
  html(res, homeCache.get(n));
});

router.get('/categoria/:cat', (req, res, next) => {
  if (!CATEGORIAS[req.params.cat]) return next();
  html(res, views.categoria(req.params.cat, cart.summary(req.sid).count));
});

router.get('/producto/:sku', (req, res, next) => {
  const p = bySku.get(req.params.sku);
  if (!p) return next();
  html(res, views.producto(p, complementos(p, 4), cart.summary(req.sid).count));
});

router.get('/carrito', (req, res) => {
  const s = cart.summary(req.sid);
  const enCarrito = new Set(s.lines.map((l) => l.sku));
  // Sugerencias: complementos de lo que hay en el carrito que quepan en lo que queda hasta 4.000 €
  const pool = new Map();
  for (const l of s.lines) for (const c of complementos(l.p, 8)) pool.set(c.sku, c);
  if (!pool.size) for (const p of productos) pool.set(p.sku, p);
  const sug = [...pool.values()]
    .filter((p) => p.disponible && !enCarrito.has(p.sku) && cents(p) <= s.restante)
    .sort((a, b) => b.precio - a.precio).slice(0, 4);
  html(res, views.carrito(s, sug, s.count, req.query.ok ? 'Añadido al carrito.' : ''));
});

router.post('/carrito/anadir', (req, res) => {
  cart.add(req.sid, String(req.body.sku || ''), req.body.qty);
  res.redirect(303, '/carrito?ok=1');
});
router.post('/carrito/pack', (req, res) => {
  const pk = packsById.get(String(req.body.pack || ''));
  if (pk) for (const p of pk.items) cart.add(req.sid, p.sku, 1);
  res.redirect(303, '/carrito?ok=1');
});
router.post('/carrito/actualizar', (req, res) => {
  cart.setQty(req.sid, String(req.body.sku || ''), req.body.qty);
  res.redirect(303, '/carrito');
});

// /ayuda: condiciones renderizadas desde el markdown oficial + widget de chat
const condMd = fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'raw', 'condiciones-de-venta.md'), 'utf8');
const condHtml = condMd.split(/\r?\n/).map((l) => {
  if (l.startsWith('## ')) return `<h3>${esc(l.slice(3))}</h3>`;
  if (l.startsWith('- ')) return `<p>${esc(l.slice(2))}</p>`;
  return '';
}).join('\n');
router.get('/ayuda', (req, res) => html(res, views.ayuda(cart.summary(req.sid).count, condHtml)));
// Fallback sin JS: el formulario hace POST y se redirige al JSON del asistente no es amigable -> usamos el chat JS
router.post('/ayuda', (req, res) => res.redirect(303, '/ayuda'));

module.exports = router;
