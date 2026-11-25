'use strict';
const express = require('express');
const views = require('../../views/pages');
const cart = require('../lib/cart');
const order = require('../lib/order');

const router = express.Router();
const confirmed = new Map(); // order_id -> pedido (solo para pintar la confirmación)
const html = (res, s, code = 200) => res.status(code).type('html').set('Cache-Control', 'no-store').send(s);

router.get('/checkout', (req, res) => {
  const s = cart.summary(req.sid);
  if (!s.lines.length) return res.redirect(303, '/carrito');
  html(res, views.checkout(s, s.count));
});

router.post('/checkout', async (req, res) => {
  try {
    const s = cart.summary(req.sid);
    if (!s.lines.length) return res.redirect(303, '/carrito');
    const { customer, errors } = order.validateCustomer(req.body || {});
    // Validación fallida: mismo formulario con mensaje claro (200, nunca 500)
    if (errors.length) return html(res, views.checkout(s, s.count, errors, req.body || {}));
    const o = order.buildOrder(s, customer); // precios recalculados desde el catálogo, en céntimos
    const r = await order.send(o); // se envía ANTES de enseñar la confirmación
    if (!r.ok) {
      console.error(JSON.stringify({ evt: 'buzon_error', status: r.status, body: r.body, order_id: o.order_id }));
      return html(res, views.pedidoError(s.count), 502);
    }
    console.log(JSON.stringify({ evt: 'pedido_ok', order_id: o.order_id, total: o.total }));
    cart.clear(req.sid);
    confirmed.set(o.order_id, o);
    if (confirmed.size > 5000) confirmed.delete(confirmed.keys().next().value);
    res.redirect(303, `/confirmacion?pedido=${o.order_id}`);
  } catch (e) {
    console.error(JSON.stringify({ evt: 'checkout_error', msg: String(e && e.message) }));
    html(res, views.pedidoError(0), 500);
  }
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
router.get('/confirmacion', (req, res) => {
  const id = String(req.query.pedido || '');
  if (!UUID.test(id)) return res.redirect(303, '/');
  // Si la petición cae en otra instancia de Cloud Run, se muestra igualmente el número de pedido
  html(res, views.confirmacion(confirmed.get(id) || { order_id: id }, 0));
});

module.exports = router;
