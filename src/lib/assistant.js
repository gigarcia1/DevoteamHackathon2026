'use strict';
// Asistente determinista (sin LLM): búsqueda en el catálogo + condiciones de venta. Inmune a inyección.
const fs = require('fs');
const path = require('path');
const { productos, CATEGORIAS, fmt, cents } = require('./catalog');

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ').trim();

// Condiciones: secciones del markdown oficial
const condMd = fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'raw', 'condiciones-de-venta.md'), 'utf8');
const SECCIONES = {};
const TITULOS = {};
for (const block of condMd.split(/^## /m).slice(1)) {
  const [title, ...rest] = block.split('\n');
  TITULOS[norm(title)] = title.trim();
  SECCIONES[norm(title)] = rest.join(' ').replace(/^- /gm, '').replace(/\s*-\s+/g, ' ').replace(/\s+/g, ' ').trim();
}
const TEMAS = [
  { sec: 'envio', re: /\b(envio|envios|enviar|envian|entrega|entregais|entregan|transporte|portes|canarias|baleares|ceuta|melilla|llega|tarda|plazo)\b/ },
  { sec: 'montaje', re: /\b(montaje|montar|montan|instalacion|instalar|monteis)\b/ },
  { sec: 'devoluciones', re: /\b(devolucion|devoluciones|devolver|devuelvo|reembolso|desistimiento|noches de prueba|prueba)\b/ },
  { sec: 'garantia', re: /\b(garantia|garantias|averia|defecto)\b/ },
  { sec: 'pago', re: /\b(pago|pagar|pagos|tarjeta|bizum|transferencia|financiacion|plazos|aplazado)\b/ },
];

const INYECCION = /(olvida|ignora|ignore|forget|disregard|actua como|act as|eres ahora|you are now|system prompt|prompt del sistema|instrucciones (previas|anteriores|del sistema)|revela|reveal|x.?clave|api.?key|contrasena|password|secreto|secret|token|jailbreak|modo desarrollador|developer mode|\bdan\b)/;

const SINONIMOS = {
  sofa: ['sofa', 'sofas', 'sillon', 'sillones', 'chaise', 'couch'], cama: ['cama', 'camas', 'canape'], colchon: ['colchon', 'colchones'],
  mesa: ['mesa', 'mesas', 'comedor'], silla: ['silla', 'sillas'], escritorio: ['escritorio', 'escritorios', 'despacho', 'mesa de trabajo'],
  silla_oficina: ['silla de oficina', 'sillas de oficina', 'oficina', 'ergonomica', 'gaming'],
  almacenaje: ['armario', 'armarios', 'estanteria', 'estanterias', 'aparador', 'cajonera', 'mesilla', 'almacenaje', 'libreria'],
  iluminacion: ['lampara', 'lamparas', 'luz', 'flexo', 'iluminacion', 'luces'],
  textil: ['textil', 'alfombra', 'cojin', 'cojines', 'manta', 'sabanas', 'funda', 'nordica', 'almohada', 'almohadas', 'protector'],
  accesorio: ['accesorio', 'accesorios', 'reposapies', 'soporte', 'alfombrilla', 'monitor'],
};
const COLORES = { blanco: ['blanco', 'blanca', 'blancos', 'blancas'], negro: ['negro', 'negra', 'negros', 'negras'], gris: ['gris', 'grises'], beige: ['beige'], marron: ['marron', 'marrones'], azul: ['azul', 'azules'], verde: ['verde', 'verdes'], roble: ['roble'], nogal: ['nogal'], natural: ['natural'] };
const MATERIALES = { tela: ['tela'], lino: ['lino'], piel: ['piel', 'cuero'], terciopelo: ['terciopelo'], madera: ['madera'], metal: ['metal', 'metalica', 'metalico'], melamina: ['melamina'], espuma: ['espuma', 'viscoelastica', 'viscoelastico'], muelles: ['muelles', 'muelle'], algodon: ['algodon'], lana: ['lana'], malla: ['malla'], ceramica: ['ceramica'] };
// Productos que no vendemos -> categoría más parecida
const PARECIDOS = {
  silla: ['taburete', 'banco', 'banqueta', 'puf'], sofa: ['futon', 'chaiselongue', 'butaca', 'divan'], cama: ['litera', 'cuna', 'somier', 'cabecero'],
  almacenaje: ['comoda', 'zapatero', 'vitrina', 'mueble tv', 'mueble de tv', 'baul', 'vestidor', 'perchero', 'recibidor', 'estante'],
  mesa: ['mesa de centro', 'mesita', 'velador'], iluminacion: ['aplique', 'bombilla', 'foco', 'plafon'], textil: ['cortina', 'cortinas', 'edredon', 'toalla', 'toallas', 'colcha'],
  accesorio: ['espejo', 'reloj', 'jarron', 'cuadro', 'planta', 'maceta'], escritorio: ['mesa gaming', 'mesa de ordenador'],
};

const has = (q, w) => new RegExp(`(^| )${w}( |$)`).test(q);
const STOP = new Set(['de', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas', 'y', 'o', 'en', 'con', 'para', 'por', 'que', 'tienes', 'teneis', 'tienen', 'hay', 'busco', 'quiero', 'precio', 'cuanto', 'cuesta', 'vale', 'me', 'mi', 'algun', 'alguna', 'del', 'al', 'es', 'se', 'su', 'tu', 'hola', 'buenas', 'necesito', 'cual', 'cuales', 'color', 'material', 'barato', 'barata', 'caro', 'cara', 'mas', 'menos', 'plazas', 'plaza', 'cm', 'euros', 'eur', 'vendeis', 'venden', 'tenes', 'disponible', 'stock', 'catalogo', 'producto', 'productos', 'si', 'no', 'a', 'mueble', 'muebles']);

function detect(map, q) { return Object.keys(map).filter((k) => map[k].some((w) => has(q, norm(w)))); }

function listar(ps, intro) {
  const top = ps.slice(0, 4);
  const lines = top.map((p) => `- ${p.nombre} (${p.color}, ${p.material}): ${fmt(cents(p))}${p.disponible ? '' : ' — sin stock'}. Ver /producto/${p.sku}`);
  let r = `${intro}\n${lines.join('\n')}`;
  if (ps.length > 4) r += `\nHay ${ps.length - 4} más en /categoria/${top[0].categoria}.`;
  return r;
}

function responder(preguntaRaw) {
  if (typeof preguntaRaw !== 'string' || !preguntaRaw.trim()) {
    return 'Hola, soy el asistente de la tienda. Pregúntame por productos (por ejemplo «sofá gris de lino» o «colchones») o por envío, montaje, devoluciones, garantía y formas de pago.';
  }
  const q = norm(preguntaRaw.slice(0, 500));
  if (INYECCION.test(q)) {
    return 'Solo puedo ayudarte con dudas de la tienda: productos, precios, envío, montaje, devoluciones, garantía y pago. ¿Qué mueble buscas?';
  }

  // 1) Condiciones de venta
  const temas = TEMAS.filter((t) => t.re.test(q)).map((t) => t.sec);
  const cats = detect(SINONIMOS, q);
  if (temas.length && !(cats.length && /\b(precio|cuesta|vale|cuanto)\b/.test(q))) {
    const out = temas.slice(0, 3).map((t) => `${TITULOS[t]}: ${SECCIONES[t]}`);
    if (temas.includes('devoluciones') || temas.includes('garantia')) {
      /* colchones ya incluido en el texto oficial */
    }
    return out.join('\n').slice(0, 1450);
  }

  // 2) Búsqueda en catálogo
  let categorias = cats;
  if (categorias.includes('silla_oficina')) categorias = categorias.filter((c) => c !== 'silla' && c !== 'escritorio' || has(q, 'escritorio'));
  const colores = detect(COLORES, q);
  const materiales = detect(MATERIALES, q);
  const palabras = q.split(' ').filter((w) => w.length > 2 && !STOP.has(w));

  // nombre propio (p. ej. "Aarhus", "Duero")
  const porNombre = productos.filter((p) => palabras.some((w) => norm(p.nombre).split(' ').includes(w) && !Object.values(SINONIMOS).flat().includes(w)));

  let cand = productos;
  if (porNombre.length) { const inCat = categorias.length ? porNombre.filter((p) => categorias.includes(p.categoria)) : porNombre; if (inCat.length) cand = inCat; }
  if (categorias.length) cand = cand.filter((p) => categorias.includes(p.categoria));
  if (colores.length) cand = cand.filter((p) => colores.includes(p.color));
  if (materiales.length) cand = cand.filter((p) => materiales.includes(p.material));
  const plazasM = q.match(/\b(\d|una|dos|tres|cuatro) plazas?\b/);
  if (plazasM) { const n = { una: 1, dos: 2, tres: 3, cuatro: 4 }[plazasM[1]] || parseInt(plazasM[1], 10); cand = cand.filter((p) => p.plazas === n); }
  const maxM = q.match(/\b(menos de|hasta|maximo|max|por debajo de) (\d+)/);
  if (maxM) cand = cand.filter((p) => p.precio <= parseInt(maxM[2], 10));

  const filtrado = categorias.length || colores.length || materiales.length || porNombre.length;
  if (filtrado && cand.length) {
    const barato = /\b(barato|barata|economico|economica|mas barato)\b/.test(q);
    cand = [...cand].sort((a, b) => (b.disponible - a.disponible) || (barato ? a.precio - b.precio : b.precio - a.precio));
    return listar(cand, `Tenemos ${cand.length} producto${cand.length > 1 ? 's' : ''} que encaja${cand.length > 1 ? 'n' : ''}:`).slice(0, 1450);
  }

  // 3) No encontrado: sugiere la categoría más parecida
  let sugerida = categorias[0] || null;
  if (!sugerida) for (const [cat, ws] of Object.entries(PARECIDOS)) if (ws.some((w) => q.includes(norm(w)))) { sugerida = cat; break; }
  if (!sugerida && (colores.length || materiales.length)) {
    const p = productos.find((x) => colores.includes(x.color) || materiales.includes(x.material));
    if (p) sugerida = p.categoria;
  }
  let r = 'No tenemos ese producto en el catálogo.';
  if (sugerida) {
    const alt = productos.filter((p) => p.categoria === sugerida && p.disponible).sort((a, b) => b.precio - a.precio).slice(0, 2);
    r += ` Lo más parecido está en ${CATEGORIAS[sugerida]} (/categoria/${sugerida})` + (alt.length ? `, por ejemplo: ${alt.map((p) => `${p.nombre} a ${fmt(cents(p))}`).join('; ')}.` : '.');
  } else {
    r += ' Puedes ver nuestras categorías: ' + Object.values(CATEGORIAS).join(', ') + '.';
  }
  return r;
}

module.exports = { responder };
