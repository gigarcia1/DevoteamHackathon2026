'use strict';
// Catálogo en memoria (se carga una vez al arrancar).
const fs = require('fs');
const path = require('path');

const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'catalogo.json'), 'utf8'));
const productos = raw.productos;
const bySku = new Map(productos.map((p) => [p.sku, p]));
const catalogJson = JSON.stringify({ productos });

const CATEGORIAS = {
  sofa: 'Sofás y sillones', cama: 'Camas', colchon: 'Colchones', mesa: 'Mesas', silla: 'Sillas de comedor',
  escritorio: 'Escritorios', silla_oficina: 'Sillas de oficina', almacenaje: 'Almacenaje', iluminacion: 'Iluminación',
  textil: 'Textil', accesorio: 'Accesorios',
};

const cents = (p) => Math.round(p.precio * 100);
const fmt = (c) => (c / 100).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' }) + ' €';

function byCategoria(cat) {
  return productos.filter((p) => p.categoria === cat).sort((a, b) => b.precio - a.precio);
}

// Venta cruzada: complementos por categoría + co-compras del historial
const COMPLEMENTOS = {
  sofa: ['textil', 'iluminacion', 'accesorio', 'almacenaje'], cama: ['colchon', 'textil', 'iluminacion', 'almacenaje'],
  colchon: ['textil', 'cama'], mesa: ['silla', 'iluminacion', 'textil'], silla: ['mesa', 'textil'],
  escritorio: ['silla_oficina', 'iluminacion', 'accesorio', 'almacenaje'], silla_oficina: ['escritorio', 'accesorio', 'iluminacion'],
  almacenaje: ['iluminacion', 'textil'], iluminacion: ['textil', 'accesorio'], textil: ['iluminacion', 'accesorio'],
  accesorio: ['iluminacion', 'silla_oficina'],
};
const coCompras = new Map(); // sku -> Map(sku -> n)
try {
  const idToSku = new Map();
  for (const p of productos) for (const id of p.ids_origen) idToSku.set(id, p.sku);
  const lines = fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'raw', 'historial-ventas.csv'), 'utf8').trim().split(/\r?\n/).slice(1);
  const pedidos = new Map();
  for (const l of lines) {
    const [ped, , id] = l.split(',');
    const s = idToSku.get(id);
    if (!s) continue;
    if (!pedidos.has(ped)) pedidos.set(ped, new Set());
    pedidos.get(ped).add(s);
  }
  for (const set of pedidos.values()) for (const a of set) for (const b of set) if (a !== b) {
    if (!coCompras.has(a)) coCompras.set(a, new Map());
    coCompras.get(a).set(b, (coCompras.get(a).get(b) || 0) + 1);
  }
} catch (_) { /* historial opcional */ }

function complementos(p, limit = 4) {
  const cats = COMPLEMENTOS[p.categoria] || [];
  const co = coCompras.get(p.sku) || new Map();
  return productos
    .filter((q) => q.sku !== p.sku && q.disponible && (cats.includes(q.categoria) || co.has(q.sku)))
    .sort((a, b) => (co.get(b.sku) || 0) - (co.get(a.sku) || 0) || cats.indexOf(a.categoria) - cats.indexOf(b.categoria))
    .slice(0, limit);
}

// Venta cruzada que puntúa: solo iluminación, textil, almacenaje y accesorios, disponibles,
// que quepan en lo que queda de presupuesto, de mayor a menor precio.
const CROSS_CATS = ['iluminacion', 'textil', 'almacenaje', 'accesorio'];
function ventaCruzada(restanteCents, excluir = new Set(), limit = 4) {
  return productos
    .filter((p) => CROSS_CATS.includes(p.categoria) && p.disponible && !excluir.has(p.sku) && cents(p) <= restanteCents)
    .sort((a, b) => b.precio - a.precio)
    .slice(0, limit);
}

module.exports = { productos, bySku, catalogJson, CATEGORIAS, cents, fmt, byCategoria, complementos, coCompras, ventaCruzada };
