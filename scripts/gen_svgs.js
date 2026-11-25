'use strict';
// Genera los placeholders SVG locales por categoría en public/img/
const fs = require('fs');
const path = require('path');
const out = path.join(__dirname, '..', 'public', 'img');
const CATS = {
  sofa: ['Sofá', '#8c7b6b'], cama: ['Cama', '#6b7b8c'], colchon: ['Colchón', '#9aa6b2'], mesa: ['Mesa', '#8a6a4a'],
  silla: ['Silla', '#a07850'], escritorio: ['Escritorio', '#5c6b5a'], silla_oficina: ['Silla de oficina', '#4a4f57'],
  almacenaje: ['Almacenaje', '#7d6a55'], iluminacion: ['Iluminación', '#c9a227'], textil: ['Textil', '#b07a8a'], accesorio: ['Accesorio', '#6a8a8a'],
};
fs.mkdirSync(out, { recursive: true });
for (const [k, [label, color]] of Object.entries(CATS)) {
  fs.writeFileSync(path.join(out, `${k}.svg`), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 320" width="480" height="320" role="img" aria-label="${label}"><rect width="480" height="320" fill="#efe6da"/><rect x="90" y="110" width="300" height="120" rx="18" fill="${color}"/><rect x="110" y="230" width="20" height="40" fill="${color}"/><rect x="350" y="230" width="20" height="40" fill="${color}"/><text x="240" y="70" font-family="sans-serif" font-size="32" text-anchor="middle" fill="#2b2118">${label}</text></svg>\n`);
}
fs.writeFileSync(path.join(out, 'favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#7a3e12"/><text x="16" y="23" font-family="sans-serif" font-size="20" text-anchor="middle" fill="#fff">G</text></svg>\n');
console.log('SVGs generados');
