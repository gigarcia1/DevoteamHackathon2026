'use strict';
const fs = require('fs');
const path = require('path');
const { layout, card, esc } = require('./layout');
const { CATEGORIAS, fmt, cents, productos } = require('../src/lib/catalog');
const { packs } = require('../src/lib/packs');

const TRUST = `<section class="trust" aria-label="Ventajas">
  <ul>
    <li><strong>Envío gratis</strong> desde 500 €</li>
    <li><strong>Montaje gratis</strong> desde 1.500 €</li>
    <li><strong>Devolución</strong> en 30 días</li>
    <li><strong>3 años</strong> de garantía</li>
  </ul>
</section>`;

// "Más vendido": por estancia, el pack cuyos productos suman más unidades en historial-ventas.csv
const vendidas = new Map();
try {
  const idToSku = new Map();
  for (const p of productos) for (const id of p.ids_origen) idToSku.set(id, p.sku);
  const lines = fs.readFileSync(path.join(__dirname, '..', 'data', 'raw', 'historial-ventas.csv'), 'utf8').trim().split(/\r?\n/).slice(1);
  for (const l of lines) {
    const [, , id, q] = l.split(',');
    const s = idToSku.get(id);
    if (s) vendidas.set(s, (vendidas.get(s) || 0) + (parseInt(q, 10) || 0));
  }
} catch (_) { /* sin historial, sin badge */ }
const masVendido = new Set();
for (const e of new Set(packs.map((p) => p.estancia))) {
  const score = (pk) => pk.items.reduce((s, p) => s + (vendidas.get(p.sku) || 0), 0) / pk.items.length;
  const top = packs.filter((p) => p.estancia === e).sort((a, b) => score(b) - score(a))[0];
  if (top && score(top) > 0) masVendido.add(top.id);
}

function badges(pk) {
  const b = [];
  if (masVendido.has(pk.id)) b.push('<span class="badge badge-hot">Más vendido</span>');
  if (pk.total >= 50000) b.push('<span class="badge">Envío gratis</span>');
  if (pk.total >= 150000) b.push('<span class="badge">Montaje gratis</span>');
  return b.length ? `<p class="badges">${b.join('')}</p>` : '';
}

const CONSEJO = `<p class="consejo"><strong>Consejo:</strong> aprovecha tu presupuesto completo con un pack Casa completa — todo a precio de catálogo, envío y montaje gratis. <a href="/#h-Casa-completa">Ver packs Casa completa</a></p>`;

function packCard(pk, big = false) {
  return `<article class="pack${big ? ' pack-big' : ''}">
  ${badges(pk)}
  <h3>Pack ${esc(pk.estancia)} ${esc(pk.tramo)}</h3>
  <p class="pack-price">${fmt(pk.total)}</p>
  <p class="pack-count">${pk.items.length} productos incluidos · IVA incluido</p>
  <ul class="pack-items">${pk.items.map((p) => `<li><a href="/producto/${esc(p.sku)}">${esc(p.nombre)}</a> <span>${fmt(cents(p))}</span></li>`).join('')}</ul>
  <form method="post" action="/carrito/pack"><input type="hidden" name="pack" value="${esc(pk.id)}">
  <button type="submit" class="btn btn-big btn-primary btn-block" aria-label="Añadir pack completo al carrito: ${esc(pk.estancia)} ${esc(pk.tramo)}">Añadir pack completo al carrito</button></form>
</article>`;
}

function home(cartCount) {
  const estancias = [...new Set(packs.map((p) => p.estancia))];
  const orden = ['Casa completa', ...estancias.filter((e) => e !== 'Casa completa')].filter((e) => estancias.includes(e));
  const sections = orden.map((e) => {
    const big = e === 'Casa completa';
    return `<section class="estancia${big ? ' estancia-top' : ''}" aria-labelledby="h-${esc(e).replace(/\s+/g, '-')}">
  <h2 id="h-${esc(e).replace(/\s+/g, '-')}">${big ? 'Casa completa: todo en un clic' : `Packs ${esc(e)}`}</h2>
  <div class="grid packs${big ? ' packs-big' : ''}">${packs.filter((p) => p.estancia === e).map((p) => packCard(p, big)).join('')}</div>
</section>`;
  }).join('\n');
  const cats = Object.entries(CATEGORIAS).map(([k, v]) => `<li><a href="/categoria/${k}">${esc(v)}</a></li>`).join('');
  return layout({
    title: 'Casa Guernica · Tienda de muebles online con packs por estancia',
    description: 'Muebles para salón, dormitorio, oficina y comedor. Packs completos por estancia, envío gratis desde 500 € y montaje gratis desde 1.500 €.',
    cartCount,
    body: `<section class="hero">
  <h1>Amuebla tu casa completa</h1>
  <p class="hero-sub">Envío gratis desde 500 €, montaje gratis desde 1.500 €.</p>
  <p class="lead">Elige un pack y añádelo al carrito con un clic. Todos los packs cuestan menos de 4.000 € y usan precios de catálogo.</p>
</section>
${TRUST}
${CONSEJO}
${sections}
<section aria-labelledby="h-cats"><h2 id="h-cats">Todas las categorías</h2><ul class="catlist">${cats}</ul></section>`,
  });
}

function categoria(cat, cartCount) {
  const ps = productos.filter((p) => p.categoria === cat).sort((a, b) => b.precio - a.precio);
  return layout({
    title: `${CATEGORIAS[cat]} · Casa Guernica`,
    description: `Catálogo de ${CATEGORIAS[cat].toLowerCase()} de Casa Guernica ordenado de mayor a menor precio, con IVA incluido.`,
    cartCount,
    body: `<p class="crumbs"><a href="/">Inicio</a> › ${esc(CATEGORIAS[cat])}</p>
<h1>${esc(CATEGORIAS[cat])}</h1>
<p>${ps.length} productos, ordenados de mayor a menor precio. Precios con IVA incluido.</p>
<div class="grid">${ps.map((p) => card(p)).join('')}</div>`,
  });
}

function producto(p, comps, cartCount, restante = 400000) {
  const buy = p.disponible
    ? `<form method="post" action="/carrito/anadir" class="buy">
  <input type="hidden" name="sku" value="${esc(p.sku)}">
  <label for="qty">Cantidad</label>
  <input id="qty" name="qty" type="number" min="1" max="20" value="1">
  <button type="submit" class="btn btn-big">Añadir al carrito</button>
</form>`
    : '<p class="nostock">Sin stock: este producto no se puede comprar ahora mismo.</p>';
  return layout({
    title: `${p.nombre} · ${fmt(cents(p))} · Casa Guernica`,
    description: `${p.nombre} en ${p.color}, ${p.material}, ${p.ancho_cm} cm de ancho. Precio ${fmt(cents(p))} con IVA incluido.`,
    cartCount,
    body: `<p class="crumbs"><a href="/">Inicio</a> › <a href="/categoria/${esc(p.categoria)}">${esc(CATEGORIAS[p.categoria])}</a> › ${esc(p.nombre)}</p>
<div class="product">
  <img src="/img/${esc(p.categoria)}.svg" alt="${esc(p.nombre)}, ${esc(p.color)}, ${esc(p.material)}" width="480" height="320">
  <div>
    <h1>${esc(p.nombre)}</h1>
    <p class="price big">${fmt(cents(p))}</p>
    <dl class="specs">
      <dt>Categoría</dt><dd>${esc(CATEGORIAS[p.categoria])}</dd>
      <dt>Color</dt><dd>${esc(p.color)}</dd>
      <dt>Material</dt><dd>${esc(p.material)}</dd>
      <dt>Ancho</dt><dd>${p.ancho_cm} cm</dd>
      ${p.plazas ? `<dt>Plazas</dt><dd>${p.plazas}</dd>` : ''}
      <dt>Referencia</dt><dd>${esc(p.sku)}</dd>
    </dl>
    ${buy}
  </div>
</div>
${TRUST}
${comps.length ? `<section aria-labelledby="h-comp"><h2 id="h-comp">Te quedan ${fmt(restante)} de presupuesto: completa tu casa</h2>
<p>Iluminación, textil, almacenaje y accesorios que caben en tu presupuesto de 4.000 €.</p>
<div class="grid">${comps.map((c) => card(c, { label: 'Añadir' })).join('')}</div></section>` : ''}`,
  });
}

function carrito(s, sugerencias, cartCount, msg) {
  const pct = Math.min(100, Math.round((s.total / 400000) * 100));
  const rows = s.lines.map((l) => `<tr>
  <td><a href="/producto/${esc(l.sku)}">${esc(l.p.nombre)}</a></td>
  <td>${fmt(l.unit)}</td>
  <td><form method="post" action="/carrito/actualizar" class="inline"><input type="hidden" name="sku" value="${esc(l.sku)}">
    <label for="q-${esc(l.sku)}" class="sr-only">Cantidad de ${esc(l.p.nombre)}</label>
    <input id="q-${esc(l.sku)}" name="qty" type="number" min="0" max="20" value="${l.quantity}">
    <button type="submit" class="btn-small">Actualizar</button></form></td>
  <td>${fmt(l.line)}</td>
  <td><form method="post" action="/carrito/actualizar" class="inline"><input type="hidden" name="sku" value="${esc(l.sku)}"><input type="hidden" name="qty" value="0"><button type="submit" class="btn-small" aria-label="Quitar ${esc(l.p.nombre)}">Quitar</button></form></td>
</tr>`).join('');
  const body = s.lines.length ? `
<div class="checkout-top"><p class="total">Total: <strong>${fmt(s.total)}</strong></p><a class="btn btn-big btn-primary" href="/checkout">Comprar ahora</a></div>
<div class="budget" role="status">
  <p>Te quedan <strong>${fmt(Math.max(0, s.restante))}</strong> de 4.000 €</p>
  <div class="bar"><div class="fill w${Math.round(pct / 5) * 5}"></div></div>
  ${s.restante < 0 ? '<p class="warn">Has superado los 4.000 € de presupuesto.</p>' : ''}
</div>
${s.faltaMontaje > 0 ? `<p class="hint">Te faltan <strong>${fmt(s.faltaMontaje)}</strong> para el montaje gratis (desde 1.500 €).</p>` : '<p class="ok">Tienes montaje gratis.</p>'}
${s.faltaEnvio > 0 ? `<p class="hint">Te faltan <strong>${fmt(s.faltaEnvio)}</strong> para el envío gratis (desde 500 €).</p>` : '<p class="ok">Tienes envío gratis.</p>'}
<div class="table-wrap"><table>
<caption class="sr-only">Productos en el carrito</caption>
<thead><tr><th scope="col">Producto</th><th scope="col">Precio</th><th scope="col">Cantidad</th><th scope="col">Subtotal</th><th scope="col">Quitar</th></tr></thead>
<tbody>${rows}</tbody></table></div>
<p class="total">Total: <strong>${fmt(s.total)}</strong> (IVA incluido)</p>
<p class="iva-note">Precios con IVA incluido. Envío gratis desde 500 €, montaje gratis desde 1.500 €.</p>
<p><a class="btn btn-big btn-primary btn-block" href="/checkout">Finalizar compra</a></p>
${sugerencias.length ? `<section aria-labelledby="h-sug"><h2 id="h-sug">Te quedan ${fmt(Math.max(0, s.restante))} de presupuesto: completa tu casa</h2><p>Iluminación, textil, almacenaje y accesorios que caben en lo que te queda.</p><div class="grid">${sugerencias.map((p) => card(p, { label: 'Añadir' })).join('')}</div></section>` : ''}`
    : `<p>Tu carrito está vacío.</p><p><a class="btn" href="/">Ver packs en la portada</a></p>`;
  return layout({
    title: `Tu carrito (${s.count}) · Casa Guernica`,
    description: 'Revisa los productos de tu carrito, el total con IVA y lo que te queda para envío y montaje gratis.',
    cartCount,
    body: `<h1>Tu carrito</h1>
${CONSEJO}
<p class="iva-note">Precios con IVA incluido. Envío gratis desde 500 €, montaje gratis desde 1.500 €.</p>${msg ? `<p class="ok" role="status">${esc(msg)}</p>` : ''}${body}`,
  });
}

function checkout(s, cartCount, errors = [], values = {}) {
  const v = (k) => esc(values[k] || '');
  const resumen = s.lines.map((l) => `<li>${l.quantity} × ${esc(l.p.nombre)} <span>${fmt(l.line)}</span></li>`).join('');
  return layout({
    title: 'Comprar ahora como invitado · Casa Guernica',
    description: 'Compra como invitado en un solo paso: nombre, email y dirección. Pago simulado, no se cobra nada.',
    cartCount,
    body: `<h1>Comprar ahora</h1>
<p>Total del pedido: <strong>${fmt(s.total)}</strong> (${s.count} artículos, IVA incluido). <a href="/carrito">Volver al carrito</a></p>
${errors.length ? `<div class="errors" role="alert"><p><strong>Revisa estos datos:</strong></p><ul>${errors.map((e) => `<li>${esc(e)}</li>`).join('')}</ul></div>` : ''}
<form method="post" action="/checkout" class="checkout">
  <label for="name">Nombre</label>
  <input id="name" name="name" type="text" autocomplete="name" required value="${v('name')}">
  <label for="email">Email</label>
  <input id="email" name="email" type="email" autocomplete="email" required value="${v('email')}">
  <label for="address">Dirección</label>
  <input id="address" name="address" type="text" autocomplete="street-address" required value="${v('address')}">
  <p class="pago-sim">Pago simulado, no se cobra nada.</p>
  <button type="submit" class="btn btn-big btn-primary btn-block">Comprar ahora</button>
</form>
<section aria-labelledby="h-res"><h2 id="h-res">Resumen</h2><ul class="pack-items">${resumen}</ul></section>`,
  });
}

function confirmacion(o, cartCount) {
  const detalle = o.items
    ? `<ul class="pack-items">${o.items.map((i) => `<li>${i.quantity} × ${esc(i.name)} <span>${fmt(Math.round(i.unit_price * 100) * i.quantity)}</span></li>`).join('')}</ul>
<p class="total">Total: <strong>${fmt(Math.round(o.total * 100))}</strong> (IVA incluido)</p>`
    : '<p>Hemos recibido tu pedido correctamente.</p>';
  return layout({
    title: `Pedido confirmado ${o.order_id.slice(0, 8)} · Casa Guernica`,
    description: 'Tu pedido se ha confirmado correctamente. Aquí tienes el número de pedido y el resumen de la compra.',
    cartCount,
    body: `<h1>✓ Pedido confirmado</h1>
<p class="ok">Número de pedido: <strong id="order-id">${esc(o.order_id)}</strong></p>
${detalle}
<p><a href="/">Volver a la tienda</a></p>`,
  });
}

function pedidoError(cartCount) {
  return layout({
    title: 'No hemos podido registrar el pedido · Casa Guernica',
    description: 'No hemos podido registrar tu pedido. Tu carrito se conserva: vuelve a intentarlo en unos segundos.',
    cartCount,
    body: `<h1>No hemos podido registrar tu pedido</h1>
<p class="warn">No se ha cobrado nada y tu carrito sigue guardado. Vuelve a intentarlo en unos segundos.</p>
<p><a class="btn btn-big btn-primary" href="/checkout">Intentar de nuevo</a> <a href="/carrito">Ver carrito</a></p>`,
  });
}

function ayuda(cartCount, condHtml) {
  return layout({
    title: 'Ayuda y asistente de compra · Casa Guernica',
    description: 'Pregunta al asistente por productos, precios, envío, montaje, devoluciones, garantía y formas de pago.',
    cartCount,
    scripts: ['/js/chat.js'],
    body: `<h1>Ayuda</h1>
<section aria-labelledby="h-chat"><h2 id="h-chat">Asistente de la tienda</h2>
<div id="chat-log" class="chat-log" aria-live="polite"></div>
<form id="chat-form" method="post" action="/ayuda" class="chat-form">
  <label for="pregunta">Tu pregunta</label>
  <input id="pregunta" name="pregunta" type="text" maxlength="500" required placeholder="Ej.: ¿tenéis sofás de lino?">
  <button type="submit" class="btn">Preguntar</button>
</form></section>
<section aria-labelledby="h-cond"><h2 id="h-cond">Condiciones de venta</h2>${condHtml}</section>`,
  });
}

function error(code, cartCount) {
  const t = code === 404 ? 'Página no encontrada' : 'Algo ha fallado';
  return layout({
    title: `${t} (${code}) · Casa Guernica`,
    description: code === 404 ? 'La página que buscas no existe. Vuelve a la portada o navega por categorías.' : 'Ha ocurrido un error inesperado. Inténtalo de nuevo en unos segundos.',
    cartCount,
    body: `<h1>${t}</h1><p><a href="/">Volver a la portada</a></p>`,
  });
}

module.exports = { home, categoria, producto, carrito, checkout, confirmacion, pedidoError, ayuda, error };
