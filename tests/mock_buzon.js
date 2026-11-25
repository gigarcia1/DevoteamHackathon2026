'use strict';
// Mock local del buzón: valida el contrato y responde 502 la primera vez si MOCK_502=1 (prueba el reintento).
const http = require('http');
const port = process.env.MOCK_PORT || 9099;
let first = process.env.MOCK_502 === '1';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

http.createServer((req, res) => {
  let b = '';
  req.on('data', (c) => { b += c; });
  req.on('end', () => {
    if (first) { first = false; res.writeHead(502); return res.end('bad gateway'); }
    const errs = [];
    if (req.headers['x-clave'] !== (process.env.X_CLAVE || 'test-clave')) errs.push('x-clave');
    if (!/application\/json/.test(req.headers['content-type'] || '')) errs.push('content-type');
    let o = {};
    try { o = JSON.parse(b); } catch (_) { errs.push('json'); }
    if (o.schema_version !== '1.0') errs.push('schema_version');
    if (!UUID.test(o.order_id || '')) errs.push('order_id');
    if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?(Z|[+-]\d\d:\d\d)$/.test(o.created_at || '')) errs.push('created_at');
    const c = o.customer || {};
    if (!c.name || !c.email || !c.address) errs.push('customer');
    if (o.currency !== 'EUR') errs.push('currency');
    let sum = 0;
    for (const i of o.items || []) {
      if (!i.sku || !i.name || !Number.isInteger(i.quantity) || i.quantity < 1) errs.push('item');
      sum += Math.round(i.unit_price * 100) * i.quantity;
    }
    if (!(o.items || []).length) errs.push('items');
    if (Math.round(o.total * 100) !== sum) errs.push('total');
    console.log('MOCK', errs.length ? 'KO ' + errs.join(',') : 'OK', b);
    res.writeHead(errs.length ? 400 : 201, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: !errs.length, errores: errs }));
  });
}).listen(port, () => console.log('mock buzón en :' + port));
