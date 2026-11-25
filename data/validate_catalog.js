'use strict';
// Valida data/catalogo.json: vocabulario exacto, sin duplicados, precios con 2 decimales.
const path = require('path');
const { productos } = require(path.join(__dirname, 'catalogo.json'));

const CATS = ['sofa', 'cama', 'colchon', 'mesa', 'silla', 'escritorio', 'silla_oficina', 'almacenaje', 'iluminacion', 'textil', 'accesorio'];
const COLORS = ['blanco', 'negro', 'gris', 'beige', 'marron', 'azul', 'verde', 'roble', 'nogal', 'natural'];
const MATS = ['tela', 'lino', 'piel', 'terciopelo', 'madera', 'metal', 'melamina', 'espuma', 'muelles', 'algodon', 'lana', 'malla', 'ceramica'];
const errors = [];
const skus = new Set();
const ids = new Set();
const names = new Set();
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\b\d+\s+plazas?\b|\btres plazas\b/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

for (const p of productos) {
  const e = (m) => errors.push(`${p.sku}: ${m}`);
  if (!CATS.includes(p.categoria)) e(`categoria ${p.categoria}`);
  if (!COLORS.includes(p.color)) e(`color ${p.color}`);
  if (!MATS.includes(p.material)) e(`material ${p.material}`);
  if (typeof p.precio !== 'number' || !/^\d+(\.\d{1,2})?$/.test(String(p.precio)) || Math.round(p.precio * 100) / 100 !== p.precio) e(`precio ${p.precio}`);
  if (p.categoria === 'sofa' ? !Number.isInteger(p.plazas) : p.plazas !== null) e(`plazas ${p.plazas}`);
  if (!Number.isInteger(p.ancho_cm) || p.ancho_cm <= 0) e(`ancho_cm ${p.ancho_cm}`);
  if (!Array.isArray(p.ids_origen) || !p.ids_origen.length) e('ids_origen vacío');
  if (skus.has(p.sku)) e('sku duplicado');
  skus.add(p.sku);
  for (const id of p.ids_origen) { if (ids.has(id)) e(`id ${id} repetido`); ids.add(id); }
  const n = p.categoria + '|' + norm(p.nombre);
  if (names.has(n)) e('nombre duplicado');
  names.add(n);
}
for (const bad of ['A-2337', 'B-82541', 'B-21589', 'B-94642']) if (ids.has(bad)) errors.push(`descatalogado ${bad} presente`);

if (errors.length) { console.error('KO\n' + errors.join('\n')); process.exit(1); }
console.log(`OK: ${productos.length} productos, vocabulario, duplicados y precios correctos`);
