/* Pro10 — conversa com o servidor (planilha) ou com o modo demonstração */
var Api = (function () {
  'use strict';
  var url = ((window.EMDIA_CONFIG && window.EMDIA_CONFIG.API_URL) || '').trim();
  var demo = !url;
  var CHAVE = 'pro10_demo_v1';
  var memoria = null;

  function carregarDemo() {
    // Lê sempre do armazenamento, para que duas abas (TV e celular) vejam os mesmos dados
    try {
      var salvo = localStorage.getItem(CHAVE);
      if (salvo) { memoria = JSON.parse(salvo); return memoria; }
    } catch (e) { /* armazenamento indisponível: segue só na memória */ }
    if (memoria) return memoria;
    memoria = Logica.dadosIniciais(Date.now(), true);
    salvarDemo(memoria);
    return memoria;
  }
  function salvarDemo(dados) {
    memoria = dados;
    try { localStorage.setItem(CHAVE, JSON.stringify(dados)); } catch (e) { /* ignora */ }
  }
  function executarDemo(req) {
    var db = Logica.criarDbMemoria(carregarDemo());
    var r = Logica.executar(db, req, {});
    if (!Logica.SOMENTE_LEITURA[req.acao]) salvarDemo(db.tabelas);
    return JSON.parse(JSON.stringify(r));
  }

  function chamar(acao, dados) {
    var req = Object.assign({ acao: acao }, dados || {});
    if (demo) {
      return new Promise(function (ok) { setTimeout(function () { ok(executarDemo(req)); }, 120); });
    }
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(req),
      redirect: 'follow'
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).catch(function () {
      return { ok: false, rede: true, erro: 'Sem conexão com o servidor. Confira a internet e tente de novo.' };
    });
  }

  function reiniciarDemo() {
    memoria = null;
    try { localStorage.removeItem(CHAVE); } catch (e) { /* ignora */ }
  }
  function pinsDemo() {
    var mapa = {};
    if (!demo) return mapa;
    (carregarDemo().Pessoas || []).forEach(function (p) { mapa[p.id] = p.pin; });
    return mapa;
  }

  return { demo: demo, chamar: chamar, reiniciarDemo: reiniciarDemo, pinsDemo: pinsDemo };
})();
