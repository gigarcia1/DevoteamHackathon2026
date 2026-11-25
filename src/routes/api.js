'use strict';
const express = require('express');
const { catalogJson } = require('../lib/catalog');
const { responder } = require('../lib/assistant');

const router = express.Router();

router.get('/catalogo.json', (req, res) => {
  res.set('Cache-Control', 'public, max-age=300').type('application/json; charset=utf-8').send(catalogJson);
});

// JSON tolerante: cuerpo inválido o vacío -> 200 con mensaje de ayuda
router.post('/api/asistente', express.text({ type: '*/*', limit: '20kb' }), (req, res) => {
  let pregunta = '';
  try {
    const raw = typeof req.body === 'string' ? req.body : '';
    const j = raw ? JSON.parse(raw) : {};
    if (j && typeof j.pregunta === 'string') pregunta = j.pregunta;
  } catch (_) { pregunta = ''; }
  res.set('Cache-Control', 'no-store').json({ respuesta: responder(pregunta) });
});

module.exports = router;
