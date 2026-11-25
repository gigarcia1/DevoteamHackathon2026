'use strict';
const express = require('express');
const views = require('../../views/pages');
const cart = require('../lib/cart');
const order = require('../lib/order');

const router = express.Router();
const confirmed = new Map(); // sid -> último pedido (solo para mostrar su propia confirmación)
const html = (res, s, code = 200) => res.status(code).type('html').set('Cache-Control', 'no-store').send(s);

router.get('/checkout', (req, res) => {
  const s = cart.summary(req.sid);
  if (!s.lines.length) return res.redirect(303, '/carrito');
  html(res, views.checkout(s, s.count));
});

router.post('/checkout', async (req, res, next) => {
  try {
    const s = cart.summary(req.sid);
    if (!s.lines.length) return res.redirect(303, '/carrito');
    const { customer, errors } = order.validateCustomer(req.body || {});
    if (errors.length) return html(res, views.checkout(s, s.count, errors, req.body), 400);
    const o = order.buildOrder(s, customer); // precios recalculados desde el catálogo
    const r = await order.send(o);
    if (!r.ok) {
      console.error(JSON.stringify({ evt: 'buzon_error', status: r.status, order_id: o.order_id }));
      return html(res, views.checkout(s, s.count, ['No hemos podido registrar el pedido. Inténtalo de nuevo en unos segundos.'], req.body), 502);
    }
    console.log(JSON.stringify({ evt: 'pedido_ok', order_id: o.order_id, total: o.total }));
    cart.clear(req.sid);
    confirmed.set(req.sid, o);
    res.redirect(303, '/confirmacion');
  } catch (e) { next(e); }
});

router.get('/confirmacion', (req, res) => {
  const o = confirmed.get(req.sid);
  if (!o) return res.redirect(303, '/');
  html(res, views.confirmacion(o, 0));
});

module.exports = router;
