/* Pro10 — guarda os arquivos do site no celular para abrir rápido.
 * Ao publicar uma versão nova, aumente o número em VERSAO. */
var VERSAO = 'pro10-v4';
var ARQUIVOS = [
  './', 'index.html', 'manifest.webmanifest', 'estilo.css?v=4',
  'config.js?v=4', 'logica.js?v=4', 'icones.js?v=4', 'api.js?v=4', 'app.js?v=4',
  'icone.svg', 'icone-192.png', 'icone-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSAO).then(function (c) { return c.addAll(ARQUIVOS); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (nomes) {
    return Promise.all(nomes.filter(function (n) { return n !== VERSAO; }).map(function (n) { return caches.delete(n); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);
  // Só arquivos do próprio site. Chamadas ao servidor (planilha) sempre vão para a internet.
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Rede primeiro (pega versões novas); se estiver sem internet, usa a cópia guardada.
  e.respondWith(
    fetch(e.request).then(function (resp) {
      var copia = resp.clone();
      caches.open(VERSAO).then(function (c) { c.put(e.request, copia); });
      return resp;
    }).catch(function () {
      return caches.match(e.request).then(function (r) { return r || caches.match('index.html'); });
    })
  );
});
