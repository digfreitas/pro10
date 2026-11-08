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
      if (salvo) { memoria = JSON.parse(salvo); if (Logica.garantirCodigos(Logica.criarDbMemoria(memoria))) salvarDemo(memoria); return memoria; }
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
    if (!Logica.SOMENTE_LEITURA[req.acao] || req.acao === 'entrar') salvarDemo(db.tabelas);
    return JSON.parse(JSON.stringify(r));
  }

  // "Ocupado" significa que o servidor não gravou nada, então é seguro tentar de novo sozinho.
  function chamar(acao, dados, tentativa) {
    return chamarUmaVez(acao, dados).then(function (r) {
      var n = tentativa || 0;
      if (demo || r.ok || !/ocupado/i.test(r.erro || '') || n >= 2) return r;
      return new Promise(function (ok) { setTimeout(ok, 2000 + Math.random() * 3000); }).then(function () { return chamar(acao, dados, n + 1); });
    });
  }

  function chamarUmaVez(acao, dados) {
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
  // A lista clicável existe só na demonstração. Com a planilha, o servidor não entrega nomes sem login.
  function pessoasDemo() {
    var lista = [];
    if (!demo) return lista;
    lista = (carregarDemo().Pessoas || []).filter(function (p) { return String(p.ativo).toLowerCase() === 'sim'; }).sort(function (a, b) { return a.nome.localeCompare(b.nome); });
    return lista;
  }

  return { demo: demo, chamar: chamar, reiniciarDemo: reiniciarDemo, pessoasDemo: pessoasDemo };
})();
