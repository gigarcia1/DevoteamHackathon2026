'use strict';
const path = require('path');
const express = require('express');
const compression = require('compression');
const { securityHeaders, session } = require('./lib/security');
const views = require('../views/pages');

const app = express();
app.disable('x-powered-by');
app.disable('etag');
app.set('trust proxy', true);

// 1) Cabeceras de seguridad en TODAS las respuestas (incluidos estáticos y errores)
app.use(securityHeaders);
app.use(compression());

// 2) Estáticos SOLO desde public/, sin listados ni dotfiles
app.use(express.static(path.join(__dirname, '..', 'public'), {
  index: false, dotfiles: 'deny', redirect: false, maxAge: '7d', immutable: false,
}));

// 3) Sesión (cookie hk_sesion) + body parsers
app.use(session);
app.use(express.urlencoded({ extended: false, limit: '20kb' }));

app.use(require('./routes/api'));
app.use(require('./routes/pages'));
app.use(require('./routes/checkout'));

// 404 personalizado
app.use((req, res) => {
  res.status(404).type('html').set('Cache-Control', 'no-store').send(views.error(404, 0));
});
// 500 personalizado, sin trazas
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(JSON.stringify({ evt: 'error', msg: String(err && err.message) }));
  const code = err && (err.status === 400 || err.type === 'entity.parse.failed' || err.type === 'entity.too.large') ? 400 : 500;
  res.status(code).type('html').set('Cache-Control', 'no-store').send(views.error(code === 400 ? 404 : 500, 0).replace('(404)', '(400)'));
});

const port = process.env.PORT || 8080;
if (require.main === module) {
  const server = app.listen(port, () => console.log(`Tienda escuchando en :${port}`));
  server.keepAliveTimeout = 65000;
}
module.exports = app;
