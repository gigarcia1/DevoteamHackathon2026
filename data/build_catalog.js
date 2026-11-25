'use strict';
// Genera data/catalogo.json a partir de data/raw/ (proveedor A CSV latin1 + proveedor B JSON).
const fs = require('fs');
const path = require('path');
const RAW = path.join(__dirname, 'raw');

const strip = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

const CAT_A = {
  'sofas y sillones': 'sofa', 'dormitorio / camas': 'cama', 'descanso': 'colchon', 'textil hogar': 'textil',
  'iluminacion': 'iluminacion', 'despacho - sillas': 'silla_oficina', 'despacho': 'escritorio',
  'comedor - mesas': 'mesa', 'comedor - sillas': 'silla', 'almacenaje': 'almacenaje',
};
const CAT_B = {
  sofa: 'sofa', bed: 'cama', mattress: 'colchon', textile: 'textil', lighting: 'iluminacion', office_chair: 'silla_oficina',
  desk: 'escritorio', dining_table: 'mesa', dining_chair: 'silla', storage: 'almacenaje', accessory: 'accesorio',
};
const COLOR = {
  blanco: 'blanco', white: 'blanco', negro: 'negro', black: 'negro', gris: 'gris', grey: 'gris', gray: 'gris',
  beige: 'beige', marron: 'marron', brown: 'marron', azul: 'azul', blue: 'azul', verde: 'verde', green: 'verde',
  roble: 'roble', oak: 'roble', nogal: 'nogal', walnut: 'nogal', natural: 'natural',
};
const MATERIAL = {
  tela: 'tela', fabric: 'tela', lino: 'lino', linen: 'lino', piel: 'piel', leather: 'piel', terciopelo: 'terciopelo',
  velvet: 'terciopelo', madera: 'madera', wood: 'madera', metal: 'metal', melamina: 'melamina', melamine: 'melamina',
  espuma: 'espuma', foam: 'espuma', muelles: 'muelles', 'pocket springs': 'muelles', springs: 'muelles',
  algodon: 'algodon', cotton: 'algodon', lana: 'lana', wool: 'lana', malla: 'malla', mesh: 'malla',
  ceramica: 'ceramica', ceramic: 'ceramica',
};
const NUM = { una: 1, un: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5 };
const UNIT = { mm: 0.1, cm: 1, m: 100 };

function mapOrThrow(map, v, what, id) {
  const k = strip(v);
  if (!(k in map)) throw new Error(`${what} desconocido "${v}" en ${id}`);
  return map[k];
}

// Precio sin IVA (céntimos) -> con IVA 21 %. Aritmética entera: neto*121/100 con half-up.
// Ajuste comercial validado con historial-ventas.csv (ver docs/02-datos.md): los netos del proveedor
// salen de un PVP redondo, así que un residuo de ±1 céntimo se devuelve al PVP original (35,01 -> 35,00).
function grossCents(netCents) {
  let c = Math.floor((netCents * 121 + 50) / 100);
  const r = c % 10;
  if (r === 1) c -= 1; else if (r === 9) c += 1;
  return c;
}
const toCents = (eurStr) => Math.round(parseFloat(String(eurStr).trim().replace(/\./g, '').replace(',', '.')) * 100);

function plazasFrom(text) {
  const m = strip(text).match(/\b(\d+|una|un|uno|dos|tres|cuatro|cinco)\s+plazas?\b/);
  if (!m) return null;
  return /\d/.test(m[1]) ? parseInt(m[1], 10) : NUM[m[1]];
}
function anchoFrom(medidas) {
  const s = strip(medidas).replace(/,/g, '.');
  const m = s.match(/([\d.]+)\s*x\s*([\d.]+)\s*x\s*([\d.]+)\s*(mm|cm|m)\b/);
  if (!m) return null;
  return Math.round(parseFloat(m[1]) * UNIT[m[4]]);
}
function niceName(s) {
  s = String(s).replace(/\s+/g, ' ').trim();
  if (s === s.toUpperCase()) { s = s.toLowerCase(); s = s.charAt(0).toUpperCase() + s.slice(1); }
  return s;
}
// Clave de duplicado: categoría + nombre normalizado (sin tildes, mayúsculas ni "N plazas")
function dupKey(cat, name) {
  return cat + '|' + strip(name).replace(/\b(\d+|una|un|uno|dos|tres|cuatro|cinco)\s+plazas?\b/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function loadA() {
  const lines = fs.readFileSync(path.join(RAW, 'proveedor-a.csv'), 'latin1').split(/\r?\n/).filter((l) => l.trim());
  return lines.slice(1).map((l) => {
    const [ref, desc, fam, pvp, ivaIncl, medidas, color, acabado, estado, fact] = l.split(';');
    const [d, m, y] = fact.trim().split('/');
    const net = toCents(pvp);
    const cat = mapOrThrow(CAT_A, fam, 'familia', ref);
    return {
      id: ref.trim(), nombre: niceName(desc), categoria: cat,
      color: mapOrThrow(COLOR, color, 'color', ref), material: mapOrThrow(MATERIAL, acabado, 'material', ref),
      precio_cents: ivaIncl.trim().toUpperCase() === 'S' ? net : grossCents(net),
      plazas: cat === 'sofa' ? plazasFrom(desc) : null, ancho_cm: anchoFrom(medidas),
      activo: strip(estado) === 'activo', stock: null, updated: Date.parse(`${y}-${m}-${d}T00:00:00Z`),
    };
  });
}
function loadB() {
  const j = JSON.parse(fs.readFileSync(path.join(RAW, 'proveedor-b.json'), 'utf8'));
  return j.products.map((p) => {
    const cat = mapOrThrow(CAT_B, p.category, 'categoria', p.id);
    const ancho = p.dimensions
      ? Math.round(p.dimensions.w * UNIT[p.dimensions.unit])
      : anchoFrom((String(p.description).match(/Medidas:\s*([^()]+)/) || [])[1] || '');
    return {
      id: p.id, nombre: niceName(p.title), categoria: cat,
      color: mapOrThrow(COLOR, p.color, 'color', p.id), material: mapOrThrow(MATERIAL, p.material, 'material', p.id),
      precio_cents: p.tax_included ? p.price_cents : grossCents(p.price_cents),
      plazas: cat === 'sofa' ? (plazasFrom(p.title) || plazasFrom(p.description)) : null, ancho_cm: ancho,
      activo: p.status === 'active', stock: typeof p.stock === 'number' ? p.stock : null, updated: Date.parse(p.updated_at),
    };
  });
}

const slug = (s) => strip(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function build() {
  const groups = new Map();
  for (const r of [...loadA(), ...loadB()]) {
    const k = dupKey(r.categoria, r.nombre);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  const productos = [];
  const log = [];
  for (const [k, recs] of groups) {
    recs.sort((a, b) => b.updated - a.updated);
    const w = recs[0];
    if (recs.length > 1) {
      const anchos = new Set(recs.map((r) => r.ancho_cm));
      log.push(`DUP ${recs.map((r) => r.id).join(' + ')} -> gana ${w.id}${anchos.size > 1 ? ' (OJO anchos distintos)' : ''}`);
    }
    if (!w.activo) { log.push(`DESCATALOGADO ${w.id} ${w.nombre}`); continue; }
    const plazas = w.categoria === 'sofa' ? (w.plazas ?? recs.map((r) => r.plazas).find((p) => p) ?? null) : null;
    let nombre = w.nombre;
    if (plazas && !/plaza/i.test(nombre)) nombre += ` ${plazas} plaza${plazas > 1 ? 's' : ''}`;
    const stockRec = recs.find((r) => r.stock !== null);
    const stock = stockRec ? stockRec.stock : null; // A no informa stock: se asume disponible
    productos.push({
      sku: slug(nombre), ids_origen: recs.map((r) => r.id).sort(), nombre, categoria: w.categoria,
      color: w.color, material: w.material, precio: Number((w.precio_cents / 100).toFixed(2)),
      plazas, ancho_cm: w.ancho_cm, stock, disponible: stock === null || stock > 0,
    });
  }
  productos.sort((a, b) => a.categoria.localeCompare(b.categoria) || b.precio - a.precio);
  return { productos, log };
}

if (require.main === module) {
  const { productos, log } = build();
  fs.writeFileSync(path.join(__dirname, 'catalogo.json'), JSON.stringify({ productos }, null, 2));
  console.log(log.join('\n'));
  console.log(`${productos.length} productos -> data/catalogo.json`);
}
module.exports = { build, grossCents };
