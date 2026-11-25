'use strict';
(function () {
  var form = document.getElementById('chat-form');
  var input = document.getElementById('pregunta');
  var log = document.getElementById('chat-log');
  if (!form || !input || !log) return;
  function add(cls, text) {
    var p = document.createElement('p');
    p.className = cls;
    p.textContent = text;
    log.appendChild(p);
    log.scrollTop = log.scrollHeight;
  }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var q = input.value.trim();
    if (!q) return;
    add('q', 'Tú: ' + q);
    input.value = '';
    fetch('/api/asistente', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pregunta: q })
    }).then(function (r) { return r.json(); })
      .then(function (j) { add('a', 'Asistente: ' + j.respuesta); })
      .catch(function () { add('a', 'Asistente: no he podido responder, inténtalo de nuevo.'); });
  });
})();
