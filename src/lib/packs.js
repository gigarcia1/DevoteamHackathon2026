'use strict';
// Packs por estancia: todos los SKU existen en el catálogo, a precio de catálogo, sin productos sin stock, ≤ 4.000 €.
const { bySku, cents } = require('./catalog');

const LIMITE = 400000;
const DEF = [
  { id: 'salon-basico', estancia: 'Salón', tramo: 'Básico', skus: ['sofa-cama-turku-2-plazas', 'alfombra-de-salon-160x230', 'lampara-de-pie-arco', 'pack-4-cojines-decorativos', 'manta-para-sofa'] },
  { id: 'salon-confort', estancia: 'Salón', tramo: 'Confort', skus: ['sofa-nordico-3-plazas', 'sillon-viena-1-plaza', 'alfombra-de-salon-160x230', 'lampara-de-pie-arco', 'aparador-3-puertas', 'pack-4-cojines-decorativos', 'manta-para-sofa'] },
  { id: 'salon-premium', estancia: 'Salón', tramo: 'Premium', skus: ['sofa-aarhus-3-plazas', 'sillon-viena-1-plaza', 'aparador-3-puertas', 'alfombra-de-salon-160x230', 'lampara-de-pie-arco', 'lampara-de-techo-trenzada', 'estanteria-libreria-5-baldas', 'pack-4-cojines-decorativos', 'manta-para-sofa'] },
  { id: 'dormitorio-basico', estancia: 'Dormitorio', tramo: 'Básico', skus: ['cama-nube-90x190', 'colchon-basic-90x190', 'mesilla-de-noche-1-cajon', 'lampara-de-mesilla-ceramica', 'pack-2-almohadas-viscoelasticas'] },
  { id: 'dormitorio-confort', estancia: 'Dormitorio', tramo: 'Confort', skus: ['cama-roca-135x190', 'colchon-firme-135x190', 'armario-2-puertas-correderas', 'mesilla-de-noche-1-cajon', 'lampara-de-mesilla-ceramica', 'pack-2-almohadas-viscoelasticas'] },
  { id: 'dormitorio-premium', estancia: 'Dormitorio', tramo: 'Premium', skus: ['cama-brisa-150x200-tapizada', 'colchon-confort-150x200', 'armario-2-puertas-correderas', 'mesilla-de-noche-1-cajon', 'lampara-de-mesilla-ceramica', 'lampara-de-techo-trenzada', 'funda-nordica-150-todo-el-ano', 'juego-de-sabanas-150', 'protector-de-colchon-impermeable-150', 'pack-2-almohadas-viscoelasticas'] },
  { id: 'oficina-basico', estancia: 'Oficina', tramo: 'Básico', skus: ['escritorio-compacto-100-cm', 'silla-de-oficina-basic', 'flexo-led-regulable', 'alfombrilla-protectora-para-silla'] },
  { id: 'oficina-confort', estancia: 'Oficina', tramo: 'Confort', skus: ['escritorio-trabajo-140-cm', 'silla-de-oficina-ergonomica-de-malla', 'cajonera-con-ruedas-3-cajones', 'flexo-led-regulable', 'soporte-de-monitor-de-madera', 'reposapies-ergonomico', 'alfombrilla-protectora-para-silla'] },
  { id: 'oficina-premium', estancia: 'Oficina', tramo: 'Premium', skus: ['escritorio-elevable-electrico-160-cm', 'sillon-de-direccion-ejecutivo', 'estanteria-libreria-5-baldas', 'cajonera-con-ruedas-3-cajones', 'flexo-led-regulable', 'soporte-de-monitor-de-madera', 'reposapies-ergonomico', 'alfombrilla-protectora-para-silla'] },
  { id: 'comedor-basico', estancia: 'Comedor', tramo: 'Básico', skus: ['mesa-de-cocina-sil-plegable', 'pack-2-sillas-industrial', 'lampara-de-techo-trenzada'] },
  { id: 'comedor-confort', estancia: 'Comedor', tramo: 'Confort', skus: ['mesa-de-comedor-tajo', 'pack-4-sillas-de-comedor-arena', 'lampara-de-techo-trenzada', 'alfombra-de-salon-160x230'] },
  { id: 'comedor-premium', estancia: 'Comedor', tramo: 'Premium', skus: ['mesa-de-comedor-duero-redonda', 'pack-6-sillas-de-comedor-nogal', 'aparador-3-puertas', 'lampara-de-techo-trenzada', 'alfombra-de-salon-160x230'] },
];
// Hogar completo: une los packs Confort de las 4 estancias (sin repetir SKU) mientras quepa en 4.000 €
const hogar = [];
for (const id of ['salon-confort', 'dormitorio-confort', 'comedor-confort', 'oficina-confort']) {
  for (const s of DEF.find((d) => d.id === id).skus) if (!hogar.includes(s)) hogar.push(s);
}
DEF.push({ id: 'hogar-completo', estancia: 'Casa completa', tramo: 'Todo incluido', skus: hogar });

const packs = DEF.map((d) => {
  const items = [];
  let total = 0;
  for (const sku of d.skus) {
    const p = bySku.get(sku);
    if (!p || !p.disponible) continue; // sin stock: fuera del pack
    if (total + cents(p) > LIMITE) continue; // nunca superar 4.000 €
    items.push(p);
    total += cents(p);
  }
  return { ...d, items, total };
}).filter((p) => p.items.length >= 2);

const byId = new Map(packs.map((p) => [p.id, p]));
module.exports = { packs, byId };
