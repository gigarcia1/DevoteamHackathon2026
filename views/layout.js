'use strict';
const fs = require('fs');
const { esc } = require('../src/lib/security');
const { CATEGORIAS, fmt, cents } = require('../src/lib/catalog');

function layout({ title, description, body, cartCount = 0, scripts = [] }) {
  const nav = Object.entries(CATEGORIAS).map(([k, v]) => `<li><a href="/categoria/${k}">${esc(v)}</a></li>`).join('');
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="icon" href="/img/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/css/styles.css">
</head>
<body>
<header class="site-header">
  <a class="logo" href="/">Casa Guernica · Muebles</a>
  <nav aria-label="Principal" class="main-nav">
    <a href="/">Inicio</a>
    <a href="/ayuda">Ayuda</a>
    <a href="/carrito" class="cart-link">Ver carrito (${cartCount})</a>
  </nav>
  <nav aria-label="Categorías"><ul class="cats">${nav}</ul></nav>
</header>
<main id="contenido">
${body}
</main>
<footer class="site-footer">
  <p>Envío gratis desde 500 € · Montaje gratis desde 1.500 € · Devolución en 30 días · 3 años de garantía</p>
  <p><a href="/ayuda">Ayuda y condiciones de venta</a> · <a href="/catalogo.json">Catálogo en JSON</a></p>
</footer>
${scripts.map((s) => `<script src="${s}" defer></script>`).join('\n')}
</body>
</html>`;
}

// Imagen de producto: public/img/productos/<sku>.webp > public/img/categorias/<cat>.webp > SVG de la categoría
const IMG_DIR = require("path").join(__dirname, "..", "public", "img");
const exists = (rel) => { try { return fs.statSync(require("path").join(IMG_DIR, rel)).isFile(); } catch (_) { return false; } };
const imgCache = new Map();
function imgSrc(p) {
  if (!imgCache.has(p.sku)) {
    const s = exists(`productos/${p.sku}.webp`) ? `/img/productos/${p.sku}.webp`
      : exists(`categorias/${p.categoria}.webp`) ? `/img/categorias/${p.categoria}.webp` : `/img/${p.categoria}.svg`;
    imgCache.set(p.sku, s);
  }
  return imgCache.get(p.sku);
}
function imgTag(p, { w = 420, h = 280, lazy = true } = {}) {
  return `<img src="${esc(imgSrc(p))}" alt="${esc(p.nombre)} en color ${esc(p.color)}, ${esc(p.material)}" width="${w}" height="${h}"${lazy ? ' loading="lazy" decoding="async"' : ''} class="pimg">`;
}

function card(p, { showAdd = true, label = "Añadir al carrito" } = {}) {
  const add = !p.disponible
    ? '<p class="nostock">Sin stock</p><button type="button" class="btn" disabled>Sin stock</button>'
    : showAdd
      ? `<form method="post" action="/carrito/anadir"><input type="hidden" name="sku" value="${esc(p.sku)}"><button type="submit" class="btn" aria-label="${label}: ${esc(p.nombre)}">${label}</button></form>`
      : '';
  return `<article class="card">
  <a href="/producto/${esc(p.sku)}">${imgTag(p)}</a>
  <h3><a href="/producto/${esc(p.sku)}">${esc(p.nombre)}</a></h3>
  <p class="meta">${esc(p.color)} · ${esc(p.material)}${p.plazas ? ` · ${p.plazas} plazas` : ''} · ${p.ancho_cm} cm</p>
  <p class="price">${fmt(cents(p))}</p>
  ${add}
</article>`;
}

module.exports = { layout, card, esc, imgTag };
