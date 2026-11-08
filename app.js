/* Pro10 — telas do aplicativo */
(function () {
  'use strict';
  var I = Icones.icone, A = Icones.avatar;
  var $app = document.getElementById('app');
  var CHAVE_SESSAO = 'pro10_sessao_v1';
  var sessao = lerSessao();
  var estado = { acoes: {}, timers: [], teclas: null, app: null, nav: 0 };
  var DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

  var PROMPT_IA = [
    'Você vai criar perguntas de quiz para treinar uma equipe de manutenção ferroviária, a partir do documento que vou colar no fim.',
    '',
    'Regras:',
    '- Crie 5 perguntas de múltipla escolha, com 4 alternativas (a, b, c, d) e só uma correta.',
    '- A resposta de cada pergunta precisa estar escrita no documento. Não invente nada que não esteja no texto.',
    '- Em "fonte", coloque o código do documento, a revisão e o item onde está a resposta.',
    '- Em "explicacao", explique em 1 ou 2 frases por que a resposta está certa.',
    '- Use linguagem simples, do dia a dia da oficina.',
    '- Em "trilha", use o nome do tema (por exemplo, o nome do procedimento).',
    '',
    'Responda só com um JSON neste formato, sem nenhum texto antes ou depois:',
    '[{"categoria":"trilha","trilha":"NOME DA TRILHA","texto":"...","a":"...","b":"...","c":"...","d":"...","correta":"B","explicacao":"...","fonte":"PRO-XXXX rev. X item X.X"}]',
    '',
    'Documento:',
    '[COLE AQUI O TEXTO DO DOCUMENTO]'
  ].join('\n');

  // ---------------------------------------------------------------------------
  // Utilidades
  // ---------------------------------------------------------------------------
  function esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function lerSessao() { try { var s = JSON.parse(localStorage.getItem(CHAVE_SESSAO) || 'null'); return s && s.codigo ? s : null; } catch (e) { return null; } }
  function gravarSessao(s) {
    sessao = s;
    try { if (s) localStorage.setItem(CHAVE_SESSAO, JSON.stringify(s)); else localStorage.removeItem(CHAVE_SESSAO); } catch (e) { /* ignora */ }
  }
  function atualizarSessao(patch) { if (sessao) gravarSessao(Object.assign({}, sessao, patch)); }
  function primeiroNome(n) { return String(n || '').split(' ')[0]; }
  function curto(n) {
    var p = String(n || '').replace(/\s*\(.*\)\s*/, '').trim().split(/\s+/);
    return p.length > 1 && p[p.length - 1].length > 2 ? p[0] + ' ' + p[p.length - 1][0] + '.' : p.join(' ');
  }
  function saudacao() { var h = new Date().getHours(); return h < 12 ? 'Bom dia' : (h < 18 ? 'Boa tarde' : 'Boa noite'); }
  function ocupado(b, sim) { if (b) { b.disabled = !!sim; b.classList.toggle('ocupado', !!sim); } }
  function idSeguro(id) { return window.CSS && CSS.escape ? CSS.escape(id) : String(id).replace(/[^\w-]/g, ''); }

  function chamar(acao, dados) {
    var base = sessao ? { codigo_acesso: sessao.codigo, pin: sessao.pin } : {};
    var tela = estado.nav;
    return Api.chamar(acao, Object.assign(base, dados || {})).then(function (r) {
      // Se a pessoa já mudou de tela, ignora a resposta para não desenhar a tela antiga por cima
      if (tela !== estado.nav) return new Promise(function () {});
      if (!r || !r.ok) { var e = new Error((r && r.erro) || 'Algo deu errado.'); e.resposta = r; throw e; }
      return r;
    });
  }
  // Consulta repetida do quiz ao vivo. Com a planilha, as consultas são mais espaçadas, cada celular
  // começa num momento diferente e nunca há duas ao mesmo tempo, para o servidor aguentar a equipe toda.
  function consultarSempre(fn, msDemo, msServidor) {
    var emCurso = 0;
    function passo() {
      if (document.hidden || (emCurso && Date.now() - emCurso < 20000)) return;
      emCurso = Date.now();
      var fim = function () { emCurso = 0; };
      fn().then(fim, fim);
    }
    if (Api.demo) { estado.timers.push(setInterval(passo, msDemo)); return; }
    estado.timers.push(setTimeout(function () { estado.timers.push(setInterval(passo, msServidor)); }, Math.random() * msServidor));
  }

  function sessaoInvalida(e) {
    if (sessao && /Código ou PIN incorreto/.test(e && e.message)) {
      gravarSessao(null);
      toast('Entre de novo com o seu código e PIN.', 'erro');
      location.hash = '#/entrar';
      return true;
    }
    return false;
  }
  function falhou(e) { if (!sessaoInvalida(e)) toast(e.message, 'erro'); }

  function toast(msg, tipo) {
    var velho = document.querySelector('.toast');
    if (velho) velho.remove();
    var t = document.createElement('div');
    t.className = 'toast' + (tipo ? ' ' + tipo : '');
    t.setAttribute('role', tipo === 'erro' ? 'alert' : 'status');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, tipo === 'erro' ? 5000 : 3200);
  }

  function render(html, acoes) { $app.innerHTML = html; estado.acoes = acoes || {}; }
  function carregando() { estado.acoes = {}; $app.innerHTML = '<div class="carregando" role="status"><span class="giro"></span>Carregando…</div>'; }
  function telaErro(msg, tentar) {
    render(paginaSimples('<main class="conteudo" style="padding-top:48px"><div class="resultado"><span class="circulo" style="background:var(--vermelho-suave);color:var(--vermelho)">' + I('alerta', 34) + '</span><h2>Não deu certo</h2><p>' + esc(msg) + '</p><button type="button" class="botao" data-acao="tentar">Tentar de novo</button>' +
      (sessao ? '<button type="button" class="link-botao" data-acao="sair">Sair do app</button>' : '') + '</div></main>'), { tentar: tentar });
  }
  function comDados(acao, dados, desenhar) {
    carregando();
    chamar(acao, dados).then(function (r) {
      try { desenhar(r); } catch (e) { console.error(e); telaErro('Erro ao montar a tela: ' + e.message, function () { comDados(acao, dados, desenhar); }); }
    }).catch(function (e) {
      if (sessaoInvalida(e)) return;
      telaErro(e.message, function () { comDados(acao, dados, desenhar); });
    });
  }

  function logo() {
    var nome = (estado.app && estado.app.nome) || 'Pro10';
    var m = String(nome).match(/\d+/), marca = m ? m[0].slice(0, 2) : String(nome).charAt(0).toUpperCase();
    return '<span class="logo"><span class="logo-marca' + (marca.length > 1 ? ' dupla' : '') + '" aria-hidden="true">' + esc(marca) + '</span>' + esc(nome) + '</span>';
  }
  function stat(rot, val, sufixo) {
    return '<div class="stat"><span class="stat-rot">' + esc(rot) + '</span><span style="display:flex;align-items:baseline;gap:4px"><span class="num">' + esc(val) + '</span>' + (sufixo ? '<span class="stat-rot">' + esc(sufixo) + '</span>' : '') + '</span></div>';
  }
  function acelerador(n, escuro, texto) {
    if (!n) return '';
    var seg = '';
    var total = n.total || 8, pre = n.prefixo || 'Ponto';
    for (var i = 1; i <= total; i++) seg += '<span class="notch' + (i <= n.nivel ? ' cheio' : '') + (i === n.nivel ? ' atual' : '') + '" style="height:' + (6 + Math.round(i * 16 / total)) + 'px"></span>';
    var t = texto || (n.maximo ? 'Meta do mês batida. Aceleração máxima!' : 'Faltam ' + n.faltam + ' pts para o ' + n.proximo_nome);
    return '<div class="acelerador' + (escuro ? ' escuro' : '') + '" role="img" aria-label="' + esc(pre) + ' ' + n.nivel + ' de ' + total + '. ' + esc(t) + '"><div class="acel-cab"><span class="acel-nivel">' + esc(pre) + ' <b>' + n.nivel + '</b></span><span class="acel-txt">' + esc(t) + '</span></div><div class="notches" style="grid-template-columns:repeat(' + total + ',minmax(0,1fr))">' + seg + '</div></div>';
  }
  var CORES_SELO = { ouro: ['#FDF3D0', '#8A6100', 'Ouro'], prata: ['#ECEFF3', '#4A5560', 'Prata'], bronze: ['#F6E3D3', '#8A4B1E', 'Bronze'] };
  function seloHtml(nome, nivel, detalhe, tamanho) {
    var c = CORES_SELO[nivel] || ['var(--cinza-suave)', 'var(--muted)', ''];
    return '<div class="selo-card' + (nivel ? '' : ' bloq') + '"><span class="selo-medalha" style="background:' + c[0] + ';color:' + c[1] + (tamanho ? ';width:' + tamanho + 'px;height:' + tamanho + 'px' : '') + '">' + I(nivel ? 'estrela' : 'cadeado', 22) + '</span><span class="selo-nome">' + esc(nome) + '</span>' +
      (detalhe ? '<span class="selo-det">' + esc(detalhe) + '</span>' : '') + (nivel ? '<span class="selo-nivel" style="color:' + c[1] + '">' + c[2] + '</span>' : '') + '</div>';
  }
  function statClaro(val, rot) { return '<div class="stat-claro"><span class="num">' + esc(val) + '</span><span>' + esc(rot) + '</span></div>'; }
  function vazio(titulo, texto) { return '<div class="vazio">' + I('info', 32) + '<h2>' + esc(titulo) + '</h2><p>' + esc(texto) + '</p></div>'; }
  function barra(pct, classe) { return '<div class="barra' + (classe ? ' ' + classe : '') + '"><div style="width:' + Math.max(0, Math.min(100, pct)) + '%"></div></div>'; }
  function chipStatus(r) {
    if (r.status === 'pendente' && r.aguardando_ref) return '<span class="chip chip-laranja">Sorteada · falta o nº</span>';
    if (r.status === 'pendente' && r.sorteada) return '<span class="chip chip-azul">Sorteada · em conferência</span>';
    if (r.status === 'pendente') return '<span class="chip chip-azul">Aguardando validação</span>';
    if (r.status === 'validada') return '<span class="chip chip-verde">Validada' + (r.atrasada ? ' (atrasada)' : '') + '</span>';
    return '<span class="chip chip-vermelho">Recusada</span>';
  }
  function confetes(n) {
    var cores = ['#F97316', '#FACC15', '#4ADE80', '#60A5FA', '#FFFFFF'];
    var s = '';
    for (var i = 0; i < n; i++) {
      var w = 7 + (i * 3) % 6, redondo = i % 3 === 0;
      s += '<span class="confete" style="left:' + ((i * 61 + 7) % 100) + '%;width:' + w + 'px;height:' + (redondo ? w : w + 7) + 'px;border-radius:' + (redondo ? '50%' : '2px') +
        ';background:' + cores[i % cores.length] + ';animation-duration:' + (3 + (i % 5) * 0.3).toFixed(1) + 's;animation-delay:' + ((i * 0.37) % 3).toFixed(2) + 's"></span>';
    }
    return '<div class="confetes" aria-hidden="true">' + s + '</div>';
  }
  function celebrar(o, aoFechar) {
    var div = document.createElement('div');
    div.className = 'celebracao';
    div.setAttribute('role', 'dialog');
    div.setAttribute('aria-modal', 'true');
    div.setAttribute('aria-labelledby', 'cel-titulo');
    div.innerHTML = confetes(18) + '<div class="celebracao-corpo"><span class="selo-ok pop">' + I(o.icone || 'check', 60, '#FFFFFF', 2.6) + '</span>' +
      '<div class="subir" style="animation-delay:.3s;display:flex;flex-direction:column;gap:4px">' + (o.pontos ? '<div class="cel-pontos">+' + o.pontos + ' pts</div>' : '') +
      '<h2 id="cel-titulo">' + esc(o.titulo) + '</h2>' + (o.texto ? '<p>' + esc(o.texto) + '</p>' : '') + '</div>' + (o.extra || '') +
      '<button type="button" class="botao botao-grande subir" style="animation-delay:.8s">Continuar</button></div>';
    document.body.appendChild(div);
    var b = div.querySelector('button');
    b.focus();
    function teclou(e) { if (e.key === 'Escape') fechar(); }
    function fechar() { div.remove(); document.removeEventListener('keydown', teclou); if (aoFechar) aoFechar(); }
    b.addEventListener('click', fechar);
    document.addEventListener('keydown', teclou);
  }
  function copiar(texto) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(texto);
    return new Promise(function (ok, falha) {
      var t = document.createElement('textarea');
      t.value = texto; t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select();
      try { document.execCommand('copy') ? ok() : falha(); } catch (e) { falha(e); }
      t.remove();
    });
  }

  // ---------------------------------------------------------------------------
  // Páginas e navegação
  // ---------------------------------------------------------------------------
  function bannerDemo() {
    return Api.demo ? '<div class="demo-faixa">Modo demonstração · dados fictícios · <button type="button" data-acao="reiniciarDemo">recomeçar</button></div>' : '';
  }
  function nav(itens, atual, rotulo) {
    return '<nav class="nav" aria-label="' + rotulo + '">' + itens.map(function (i) {
      return '<a href="#/' + i[0] + '"' + (i[0] === atual ? ' aria-current="page"' : '') + '>' + I(i[2], 24) + '<span>' + i[1] + '</span></a>';
    }).join('') + '</nav>';
  }
  function navEquipe(atual) {
    var m = (sessao && sessao.modulos) || {};
    var itens = [['inicio', 'Início', 'inicio'], ['marcar', 'Marcar', 'marcar']];
    if (m.quiz !== false) itens.push(['quiz', 'Quiz', 'quiz']);
    itens.push(['ranking', 'Placar', 'trofeu'], ['perfil', 'Perfil', 'perfil']);
    return nav(itens, atual, 'Menu principal');
  }
  function navLider(atual) {
    var m = (sessao && sessao.modulos) || {};
    var itens = [['lider/validar', 'Validar', 'escudo']];
    if (m.quiz !== false) itens.push(['lider/perguntas', 'Perguntas', 'quiz']);
    itens.push(['lider/apuracao', 'Pit Stop', 'tv']);
    if (m.aovivo !== false) itens.push(['lider/aovivo', 'Ao vivo', 'vivo']);
    itens.push(['lider/config', 'Ajustes', 'ajustes']);
    return nav(itens, atual, 'Menu do líder');
  }
  function paginaEquipe(atual, html) {
    var faixa = sessao && sessao.papel === 'lider' ? '<div class="faixa-lider"><span>Você está vendo o app como a equipe</span><a href="#/lider/validar">Voltar</a></div>' : '';
    return bannerDemo() + faixa + '<div class="tela com-nav">' + html + '</div>' + navEquipe(atual);
  }
  function paginaLider(atual, html) { return bannerDemo() + '<div class="tela com-nav">' + html + '</div>' + navLider(atual); }
  function paginaSimples(html) { return bannerDemo() + '<div class="tela">' + html + '</div>'; }
  function cabLider(titulo, sub, icone) {
    return '<header class="cab-escuro" style="flex-direction:row;align-items:center;gap:12px;padding-bottom:16px"><span class="icone-q" style="background:rgba(255,255,255,.12);color:#fff">' + I(icone, 22) + '</span><div><h1 class="titulo" style="font-size:26px">' + esc(titulo) + '</h1><p class="sub-claro">' + esc(sub) + '</p></div></header>';
  }

  var ROTAS = {
    'entrar': telaEntrar, 'inicio': telaInicio, 'marcar': telaMarcar, 'quiz': telaQuiz, 'pergunta': telaPergunta,
    'sugerir': telaSugerir, 'ranking': telaRanking, 'perfil': telaPerfil, 'avatar': telaAvatar, 'aovivo': telaAoVivo,
    'lider/validar': telaValidar, 'lider/perguntas': telaPerguntasLider, 'lider/importar': telaImportar,
    'lider/apuracao': telaApuracao, 'lider/aovivo': telaAoVivoTV, 'lider/config': telaConfig, 'lider/equipe': telaEquipe,
    'lider/janelas': telaJanelas, 'lider/entregas': telaEntregas, 'lider/pergunta': telaEditarPergunta
  };

  function limpar() {
    estado.timers.forEach(clearInterval);
    estado.timers = [];
    if (estado.teclas) { document.removeEventListener('keydown', estado.teclas); estado.teclas = null; }
    document.querySelectorAll('.celebracao').forEach(function (d) { d.remove(); });
  }
  function navegar() {
    estado.nav++;
    limpar();
    var partes = location.hash.replace(/^#\/?/, '').split('/');
    var lider = partes[0] === 'lider';
    var rota = lider ? partes.slice(0, 2).join('/') : partes[0];
    var param = lider ? partes[2] : partes[1];
    if (!sessao) {
      if (rota !== 'entrar') { location.replace('#/entrar'); return; }
    } else if (!rota || rota === 'entrar') {
      location.replace(sessao.papel === 'lider' ? '#/lider/validar' : '#/inicio');
      return;
    }
    if (lider && sessao && sessao.papel !== 'lider') { location.replace('#/inicio'); return; }
    var fn = ROTAS[rota];
    if (!fn) { location.replace('#/'); return; }
    window.scrollTo(0, 0);
    fn(decodeURIComponent(param || ''));
  }
  function sair() { gravarSessao(null); location.hash = '#/entrar'; }

  var GLOBAIS = {
    sair: sair,
    reiniciarDemo: function () { Api.reiniciarDemo(); gravarSessao(null); toast('Demonstração recomeçada.', 'ok'); if (location.hash === '#/entrar') navegar(); else location.hash = '#/entrar'; }
  };
  $app.addEventListener('click', function (e) {
    var alvo = e.target.closest('[data-acao]');
    if (!alvo || !$app.contains(alvo)) return;
    var nome = alvo.getAttribute('data-acao');
    var fn = estado.acoes[nome] || GLOBAIS[nome];
    if (fn) { e.preventDefault(); fn(alvo, e); }
  });
  $app.addEventListener('submit', function (e) {
    var fn = estado.acoes['form:' + e.target.getAttribute('data-form')];
    if (fn) { e.preventDefault(); fn(e.target, e); }
  });
  $app.addEventListener('input', function (e) {
    var fn = estado.acoes['input:' + e.target.name];
    if (fn) fn(e.target, e);
  });

  // ---------------------------------------------------------------------------
  // Entrar
  // ---------------------------------------------------------------------------
  function telaEntrar() {
    comDados('inicio', {}, function (r) {
      estado.app = r.app;
      var pessoas = Api.pessoasDemo();
      var sel = null, erroPin = '', codigoDigitado = '';
      function focarPin() { var i = document.getElementById('pin'); if (i) i.focus(); }
      function entrar(f, codigo, pin) {
        ocupado(f.querySelector('[type=submit]'), true);
        chamar('entrar', { codigo_acesso: codigo, pin: pin }).then(function (x) {
          gravarSessao({ pessoa_id: x.pessoa.id, codigo: x.codigo, pin: pin, nome: x.pessoa.nome, papel: x.pessoa.papel, avatar: x.pessoa.avatar, modulos: x.modulos });
          estado.app = x.app;
          location.hash = x.pessoa.papel === 'lider' ? '#/lider/validar' : '#/inicio';
        }).catch(function (e) {
          erroPin = e.message; desenhar();
          focarPin();
        });
      }
      function desenhar() {
        var corpo;
        if (!Api.demo) {
          corpo = '<form class="cartao" data-form="login" novalidate style="gap:14px;padding:24px 16px"><h2 class="h2">Entrar</h2>' +
            '<div class="campo"><label for="codigo">Seu código</label><input id="codigo" name="codigo" class="entrada" style="text-transform:uppercase;letter-spacing:4px" type="text" autocapitalize="characters" autocorrect="off" spellcheck="false" autocomplete="username" maxlength="8" value="' + esc(codigoDigitado) + '"></div>' +
            '<div class="campo"><label for="pin">Seu PIN</label><input id="pin" name="pin" class="entrada entrada-pin" type="password" inputmode="numeric" autocomplete="current-password" maxlength="8">' +
            (erroPin ? '<span class="erro-campo" role="alert">' + esc(erroPin) + '</span>' : '') + '</div>' +
            '<button class="botao botao-grande" type="submit">Entrar</button><p class="muted" style="text-align:center;font-size:14px">Não tem ou esqueceu? Peça ao líder.</p></form>';
        } else if (!sel) {
          corpo = '<h2 class="h2">Quem é você?</h2>' + (pessoas.length ? '<div class="lista-pessoas">' + pessoas.map(function (p) {
            return '<button type="button" class="pessoa" data-acao="escolher" data-id="' + esc(p.id) + '">' + A(p.avatar, 48) + '<span class="pessoa-nome">' + esc(p.nome) + '</span>' +
              (p.papel !== 'equipe' ? '<span class="chip chip-escuro">' + (p.papel === 'admin' ? 'Administrador' : 'Líder') + '</span>' : '<span class="pessoa-turno">Turno ' + esc(p.turno || '–') + '</span>') +
              '<span class="pessoa-dica">PIN ' + esc(p.pin) + '</span></button>';
          }).join('') + '</div>' : vazio('Ninguém cadastrado ainda', 'Peça ao líder para cadastrar a equipe na aba Pessoas da planilha.'));
        } else {
          corpo = '<form class="cartao" data-form="pin" novalidate style="align-items:center;text-align:center;gap:14px;padding:24px 16px">' + A(sel.avatar, 72) +
            '<div><p class="h2">' + esc(sel.nome) + '</p><p class="muted">' + (sel.papel !== 'equipe' ? (sel.papel === 'admin' ? 'Administrador' : 'Líder') : 'Turno ' + esc(sel.turno)) + '</p></div>' +
            '<div class="campo" style="width:100%"><label for="pin">Seu PIN</label><input id="pin" name="pin" class="entrada entrada-pin" type="password" inputmode="numeric" autocomplete="current-password" maxlength="8">' +
            (erroPin ? '<span class="erro-campo" role="alert">' + esc(erroPin) + '</span>' : '') + '</div>' +
            '<button class="botao botao-grande" type="submit">Entrar</button><button class="link-botao" type="button" data-acao="trocar">Não é você? Escolher outra pessoa</button></form>' +
            '<p class="muted" style="text-align:center">Modo demonstração: o PIN de ' + esc(primeiroNome(sel.nome)) + ' é ' + esc(sel.pin) + '.</p>';
        }
        render(paginaSimples('<header class="cab-escuro entrar-cab"><div><h1 class="titulo-grande">' + esc(r.app.nome) + '</h1>' + (r.app.slogan ? '<p style="margin-top:8px;font-size:17px;font-weight:600;color:#FDBA74">' + esc(r.app.slogan) + '</p>' : '') + '<p class="sub-claro" style="margin-top:4px">' + esc(r.app.equipe) + '</p></div></header><main class="conteudo">' + corpo + '</main>'), {
          escolher: function (b) {
            sel = pessoas.filter(function (p) { return p.id === b.getAttribute('data-id'); })[0];
            erroPin = '';
            desenhar();
            focarPin();
          },
          trocar: function () { sel = null; desenhar(); },
          'form:pin': function (f) {
            var pin = f.pin.value.trim();
            if (!pin) { erroPin = 'Digite o PIN.'; desenhar(); return; }
            entrar(f, sel.codigo, pin);
          },
          'form:login': function (f) {
            var pin = f.pin.value.trim();
            codigoDigitado = f.codigo.value.trim();
            if (!codigoDigitado || !pin) { erroPin = 'Digite o código e o PIN.'; desenhar(); return; }
            entrar(f, codigoDigitado, pin);
          }
        });
      }
      desenhar();
    });
  }

  // ---------------------------------------------------------------------------
  // Início
  // ---------------------------------------------------------------------------
  function telaInicio() {
    comDados('painel', {}, function (r) {
      estado.app = r.app;
      atualizarSessao({ nome: r.pessoa.nome, avatar: r.pessoa.avatar, modulos: r.modulos });
      var m = r.modulos, j = r.janela;
      var linhaJanela = j.livre ? '<p class="janela"><span class="ponto"></span>' + esc(r.app.equipe) + '</p>'
        : (j.aberta ? '<p class="janela"><span class="ponto"></span>Turno ' + esc(j.turno) + ' · registro aberto até ' + esc(j.ate) + '</p>'
          : '<p class="janela fechada"><span class="ponto"></span>Registro fechado · abre ' + esc(j.proxima_texto) + '</p>');
      var hora = (r.proxima_apuracao.texto.split(' · ')[1] || '').replace(':00', 'h');
      var cab = '<header class="cab-escuro"><div class="cab-topo">' + logo() + '</div>' +
        '<div class="saudacao">' + A(r.pessoa.avatar, 52, true) + '<div><h1 class="titulo">' + saudacao() + ', ' + esc(primeiroNome(r.pessoa.nome)) + '</h1>' + linhaJanela + '</div></div>' +
        '<div class="cartao-vidro"><div class="grid3">' + stat('Pontos no mês', r.pontos_mes) + stat(m.apuracao ? 'Desde o Pit Stop' : 'No período', r.pontos_periodo) + stat('Dias ativos', r.dias_ativos) + '</div>' +
        acelerador(r.nivel, true) +
        (m.apuracao ? '<div class="painel-rodape">' + I('trofeu', 18, '#FDBA74') + '<span>' + (r.proxima_apuracao.definida ? 'Sua posição sai no Pit Stop de ' + esc(r.proxima_apuracao.dia_nome) + ', ' + esc(hora) : 'Próximo Pit Stop a definir') + '</span></div>' : '') +
        '</div></header>';

      var blocos = [];
      r.aguardando_ref.forEach(function (a) {
        blocos.push('<form class="cartao-azul" style="flex-direction:column" data-form="ref" data-id="' + esc(a.id) + '"><div style="display:flex;gap:12px;align-items:flex-start"><span class="icone-q cheio-azul">' + I('escudo', 22) + '</span><div class="texto-flex"><span class="nome">Entrega sorteada para conferência</span><span style="font-size:14px">' + esc(a.tipo) + ' (' + esc(a.quando) + '). Informe o número para o líder conferir no sistema.</span></div></div>' +
          '<div style="display:flex;gap:8px"><label class="visualmente-oculto" for="ref-' + esc(a.id) + '">Número de referência</label><input id="ref-' + esc(a.id) + '" name="ref" class="entrada" autocomplete="off" placeholder="Número de referência"><button class="botao botao-azul botao-inline" type="submit">Enviar</button></div></form>');
      });
      if (r.aovivo_ativo) blocos.push(cartaoAoVivo());
      if (r.mural) blocos.push('<div class="cartao-laranja mural"><div style="display:flex;gap:10px">' + I('alerta', 22, '#9A3412') + '<div class="texto-flex"><span class="rotulo laranja">Aviso do líder' + (r.mural.data ? ' · ' + esc(r.mural.data) : '') + '</span><span style="font-size:15px;white-space:pre-line">' + esc(r.mural.texto) + '</span></div></div></div>');
      blocos.push(j.aberta ? '<a class="botao botao-grande" href="#/marcar">' + I('marcar', 22) + 'Marcar entrega</a>'
        : '<a class="botao botao-grande botao-leve" href="#/marcar">' + I('cadeado', 20) + 'Registro abre ' + esc(j.proxima_texto) + '</a>');
      if (r.pergunta_semana) {
        var q = r.pergunta_semana, feito = q.estado === 'acertou';
        blocos.push('<div class="cartao linha-flex cartao-destaque"><span class="icone-q ' + (feito ? 'verde' : 'cheio') + '">' + I(feito ? 'check' : 'quiz', 22) + '</span><div class="texto-flex"><span class="rotulo laranja">Pergunta da semana</span><span class="nome">' + (feito ? 'Você já acertou esta semana' : esc(q.texto)) + '</span>' + (q.fecha_texto && !feito ? '<span class="muted">até ' + esc(q.fecha_texto) + '</span>' : '') + '</div>' +
          (feito ? '' : '<a class="botao botao-peq botao-contorno" href="#/pergunta/' + encodeURIComponent(q.id) + '">Responder</a>') + '</div>');
      }
      blocos.push(cartaoMeta(r.meta_coletiva));
      if (r.recentes.length) {
        blocos.push('<section class="secao"><h2 class="h2">Suas últimas entregas</h2><div class="lista">' + r.recentes.map(function (x) {
          return '<div class="item"><div class="texto-flex"><span class="nome">' + esc(x.tipo) + '</span><span style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">' + chipStatus(x) + '<span class="muted">' + esc(x.quando) + '</span></span></div><span class="num" style="font-size:18px;color:' + (x.status === 'validada' ? 'var(--verde)' : 'var(--muted)') + '">+' + (x.status === 'validada' ? x.pontos : x.pontos_tipo) + '</span></div>';
        }).join('') + '</div></section>');
      }
      render(paginaEquipe('inicio', cab + '<main class="conteudo">' + blocos.join('') + '</main>'), {
        'form:ref': function (f) {
          var b = f.querySelector('button'); ocupado(b, true);
          chamar('informarReferencia', { registro_id: f.getAttribute('data-id'), referencia: f.ref.value }).then(function () { toast('Número enviado. Obrigado!', 'ok'); telaInicio(); }).catch(function (e) { ocupado(b, false); falhou(e); });
        }
      });
      var subiu = checarNivel(r);
      function celebrarNivel() {
        if (!subiu) return;
        celebrar({
          titulo: subiu.nome + '!', icone: 'subindo',
          texto: subiu.maximo ? 'Aceleração máxima: você bateu a meta do mês.' : 'Seu acelerador subiu. Faltam ' + subiu.faltam + ' pts para o ' + subiu.proximo_nome + '.',
          extra: '<div class="cartao-vidro subir" style="width:100%;animation-delay:.55s">' + acelerador(subiu, true) + '</div>'
        });
      }
      if (!r.celebrar.length) celebrarNivel();
      if (r.celebrar.length) {
        var total = r.celebrar.reduce(function (s, c) { return s + c.pontos; }, 0);
        var um = r.celebrar.length === 1 ? r.celebrar[0] : null;
        var especial = um && /^(Meta coletiva|Sua pergunta)/.test(um.titulo);
        celebrar({
          pontos: total,
          titulo: especial ? um.titulo + '!' : (r.app.msg_validada || 'Mandou bem!'),
          texto: especial ? '' : (um ? um.titulo + ' · validada ' + um.quando + (um.atrasada ? ' · fora do prazo, valeu metade' : '') : r.celebrar.length + ' entregas validadas: ' + r.celebrar.map(function (c) { return c.titulo; }).join(', ')),
          icone: especial ? 'estrela' : 'check',
          extra: '<div class="cartao-vidro subir" style="width:100%;animation-delay:.55s">' + acelerador(r.nivel, true, r.pontos_mes + ' de ' + r.meta_mensal + ' pts no mês') + '</div>'
        }, function () { chamar('celebrado', { ids: r.celebrar.map(function (c) { return c.id; }) }).catch(function () {}); celebrarNivel(); });
      }
    });
  }
  // Guarda no aparelho o último nível visto, para comemorar quando a pessoa sobe de ponto
  function checarNivel(r) {
    if (!r.nivel || !r.mes_chave) return null;
    var chave = 'pro10_nivel_' + r.pessoa.id + '_' + r.mes_chave, antes = null;
    try { var v = localStorage.getItem(chave); antes = v === null ? null : Number(v); localStorage.setItem(chave, String(r.nivel.nivel)); } catch (e) { return null; }
    return antes !== null && r.nivel.nivel > antes ? r.nivel : null;
  }
  function cartaoMeta(mc) {
    return '<div class="cartao"><div style="display:flex;align-items:center;gap:10px"><span class="icone-q verde" style="width:36px;height:36px">' + I('pessoas', 20) + '</span><div class="texto-flex"><span class="rotulo verde">Meta coletiva' + (mc.batida ? ' · batida' : '') + '</span><span class="nome">' + esc(mc.texto) + '</span></div></div>' +
      barra(mc.pct, 'verde') + '<div class="barra-rot"><span>' + mc.atual + ' de ' + mc.total + '</span><span>' + (mc.batida ? 'Bônus de +' + mc.bonus + ' pts entregue' : '+' + mc.bonus + ' pts para todos') + '</span></div></div>';
  }
  function cartaoAoVivo() {
    return '<a class="cartao-escuro" href="#/aovivo" style="text-decoration:none;flex-direction:row;align-items:center;gap:12px"><span class="icone-q cheio pulso">' + I('vivo', 22) + '</span><span class="texto-flex"><span class="nome">Quiz ao vivo acontecendo agora</span><span class="sub-claro" style="font-size:13px">Toque para participar</span></span>' + I('seta', 22) + '</a>';
  }

  // ---------------------------------------------------------------------------
  // Marcar entrega
  // ---------------------------------------------------------------------------
  function cabMarcar(janela) {
    return '<header class="cab-claro"><h1 class="titulo">Marcar entrega</h1><p class="sub">Escolha o que você fez. O líder valida depois.</p>' +
      (janela && !janela.livre && janela.aberta ? '<div class="faixa-janela">' + I('relogio', 18) + '<span>Registro aberto até ' + esc(janela.ate) + ' · Turno ' + esc(janela.turno) + '</span></div>' : '') + '</header>';
  }
  function telaMarcar() {
    comDados('tipos', {}, function (r) {
      if (!r.janela.aberta) {
        render(paginaEquipe('marcar', '<header class="cab-claro"><h1 class="titulo">Marcar entrega</h1><p class="sub">Fora do horário de registro</p></header><main class="conteudo">' +
          '<div class="resultado"><span class="circulo" style="background:var(--cinza-suave);color:var(--navy-2)">' + I('cadeado', 34) + '</span><h2>Registro fechado agora</h2><p>Por segurança, o app só aceita registros no início e no fim do turno, em local seguro.</p>' +
          '<div class="cartao-escuro" style="width:100%;flex-direction:row;align-items:center;justify-content:space-between;text-align:left"><div class="texto-flex"><span class="rotulo pessego">Próxima janela</span><span style="font-size:17px;font-weight:700">' + esc(r.janela.proxima_texto) + '</span></div><span class="chip chip-claro num" style="font-size:16px">em ' + esc(r.janela.falta_texto) + '</span></div></div>' +
          '<div class="lista"><div class="item">' + '<span class="icone-q azul">' + I('relogio', 20) + '</span><div class="texto-flex"><span class="nome">Esqueceu de marcar algo?</span><span class="muted">' + (r.dias.length > 1 ? 'Você pode registrar até ' + (r.dias.length - 1) + (r.dias.length === 2 ? ' dia' : ' dias') + ' depois, na próxima janela.' : 'Só dá para registrar no mesmo dia.') + '</span></div></div>' +
          '<div class="item"><span class="icone-q">' + I('quiz', 20) + '</span><div class="texto-flex"><span class="nome">O quiz também abre só na janela</span><span class="muted">Ler o manual pode ser a qualquer hora. Responder, só no horário do turno.</span></div></div></div>' +
          '<a class="botao botao-contorno" href="#/perfil">Ver meus pontos</a></main>'));
        return;
      }
      var f = { tipo: null, atras: 0, ref: '', erro: '' };
      function tipoSel() { return r.tipos.filter(function (t) { return t.id === f.tipo; })[0]; }
      function desenhar(rolar) {
        var t = tipoSel();
        var lista = '<div class="tipos" role="group" aria-label="Entregas">' + r.tipos.map(function (x) {
          var s = x.id === f.tipo;
          return '<button type="button" class="tipo" data-acao="tipo" data-id="' + esc(x.id) + '" aria-pressed="' + s + '"><span class="tipo-pts">+' + x.pontos + '</span><span class="texto-flex"><span class="nome">' + esc(x.nome) + '</span><span class="muted">' + esc(x.categoria) +
            (x.referencia === 'obrigatoria' ? ' · pede nº de referência' : '') + '</span></span><span class="marca">' + (s ? I('check', 14, '#fff', 3) : '') + '</span></button>';
        }).join('') + '</div>';
        if (!r.tipos.length) lista = vazio('Nenhuma entrega cadastrada', 'O líder cadastra as entregas em Ajustes.');
        var det = '';
        if (t) {
          det = '<div class="detalhe-tipo">';
          if (t.referencia !== 'nao') {
            det += '<div class="campo"><label for="ref">Número de referência' + (t.referencia === 'opcional' ? ' <span class="muted">(opcional)</span>' : '') + '</label><input id="ref" name="ref" class="entrada" autocomplete="off" value="' + esc(f.ref) + '" placeholder="' + esc(t.dica_ref || 'Ex.: nº da RAF') + '">' +
              '<span class="muted">' + (t.dica_ref ? 'Informe o ' + esc(t.dica_ref) + '. ' : '') + 'O líder pode conferir no sistema oficial.</span></div>';
          }
          if (r.dias.length > 1) det += '<div class="campo"><label for="dia">Quando foi feita</label><select id="dia" name="dia" class="entrada">' + r.dias.map(function (d) { return '<option value="' + d.atras + '"' + (d.atras === f.atras ? ' selected' : '') + '>' + esc(d.texto) + '</option>'; }).join('') + '</select></div>';
          det += '<p class="muted">Se passar do prazo da entrega, ela vale ' + r.atraso_pct + '% dos pontos.</p>';
          if (f.erro) det += '<p class="erro-campo" role="alert">' + esc(f.erro) + '</p>';
          det += '</div>';
        }
        var rodape = '<div class="rodape-fixo">' + (t ? '<button type="button" class="botao botao-grande" data-acao="enviar">Marcar como feita (+' + t.pontos + ' pts)</button>' : '<button type="button" class="botao botao-grande" disabled aria-disabled="true">Escolha uma entrega</button>') + '</div>';
        render(paginaEquipe('marcar', cabMarcar(r.janela) + '<main class="conteudo">' + lista + det + '</main>' + rodape), {
          tipo: function (b) { f.tipo = b.getAttribute('data-id'); f.erro = ''; desenhar(true); },
          'input:dia': function (i) { f.atras = Number(i.value) || 0; },
          'input:ref': function (i) { f.ref = i.value; },
          enviar: function (b) {
            ocupado(b, true);
            chamar('marcar', { tipo_id: f.tipo, dias_atras: f.atras, referencia: f.ref }).then(function (x) { window.scrollTo(0, 0); resultadoMarcar(x, tipoSel(), r.janela); })
              .catch(function (e) { if (sessaoInvalida(e)) return; f.erro = e.message; desenhar(true); });
          }
        });
        if (rolar) { var d = $app.querySelector('.detalhe-tipo'); if (d && d.scrollIntoView) d.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
      }
      desenhar();
    });
  }
  function resultadoMarcar(x, t, janela) {
    var reg = x.registro, corpo;
    if (x.precisa_referencia) {
      corpo = '<form class="resultado" data-form="refSorteio"><span class="circulo" style="background:var(--azul-suave);color:var(--azul)">' + I('escudo', 34) + '</span><h2>Entrega sorteada para conferência</h2>' +
        '<p>Como acontece com qualquer pessoa, o líder vai conferir esta entrega no sistema oficial. Informe o número de referência agora ou até a próxima janela.</p>' +
        '<div class="campo" style="width:100%;text-align:left"><label for="ref2">Número de referência</label><input id="ref2" name="ref" class="entrada" autocomplete="off" placeholder="' + esc((t && t.dica_ref) || 'Número de referência') + '"></div>' +
        '<p class="erro-campo" role="alert" id="erro-ref"></p><button class="botao botao-grande botao-azul" type="submit">Enviar número</button></form>';
    } else if (x.sorteada) {
      corpo = '<div class="resultado"><span class="circulo" style="background:var(--azul-suave);color:var(--azul)">' + I('escudo', 34) + '</span><h2>Enviada e sorteada para conferência</h2><p>O líder vai conferir o nº ' + esc(reg.referencia) + ' no sistema oficial. Você não precisa fazer mais nada.</p><span class="chip chip-azul" style="font-size:14px;padding:6px 12px">Em conferência · +' + reg.pontos_tipo + ' pts</span></div>';
    } else {
      corpo = '<div class="resultado"><span class="circulo" style="background:var(--azul-suave);color:var(--azul)">' + I('relogio', 34) + '</span><h2>Entrega enviada</h2><p>' + esc(reg.tipo) + ' está aguardando a validação do líder. Quando os pontos entrarem, você vê uma comemoração na tela inicial.</p><span class="chip chip-azul" style="font-size:14px;padding:6px 12px">Aguardando validação · +' + reg.pontos_tipo + ' pts</span></div>';
    }
    var rodape = '<div class="rodape-fixo"><div class="botoes"><a class="botao botao-contorno" href="#/inicio">Início</a><button type="button" class="botao" data-acao="outra">Marcar outra</button></div></div>';
    render(paginaEquipe('marcar', cabMarcar(janela) + '<main class="conteudo">' + corpo + '</main>' + rodape), {
      outra: function () { telaMarcar(); },
      'form:refSorteio': function (f) {
        var b = f.querySelector('[type=submit]'); ocupado(b, true);
        chamar('informarReferencia', { registro_id: reg.id, referencia: f.ref.value }).then(function () {
          toast('Número enviado. Obrigado!', 'ok');
          x.precisa_referencia = false;
          reg.referencia = f.ref.value.trim().toUpperCase();
          resultadoMarcar(x, t, janela);
        }).catch(function (e) { ocupado(b, false); if (!sessaoInvalida(e)) document.getElementById('erro-ref').textContent = e.message; });
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Quiz
  // ---------------------------------------------------------------------------
  function rotuloEstado(it) {
    return { acertou: 'acertou', nova: 'liberada', revisar: 'pode responder de novo', aguardando: 'volta ' + it.volta_texto, bloqueada: 'bloqueada', agendada: 'abre ' + it.abre_texto, tentar: 'tente de novo' }[it.estado] || it.estado;
  }
  function telaQuiz() {
    comDados('quiz', {}, function (r) {
      var erros = {};
      function desenhar() {
        var pct = Math.min(100, Math.round(r.pontos_semana / Math.max(1, r.limite) * 100));
        var cab = '<header class="cab-claro"><h1 class="titulo">Quiz</h1><p class="sub">Estude os manuais e ganhe pontos</p>' +
          '<div class="stat-claro" style="margin-top:10px;gap:6px"><div class="barra-rot" style="color:var(--navy)"><span style="font-weight:600">Pontos de quiz nesta semana</span><span><b class="num" style="font-size:18px">' + r.pontos_semana + '</b> de ' + r.limite + '</span></div>' + barra(pct) +
          '<span>O quiz vale no máximo ' + r.limite + ' pts por semana, para não pesar mais que as entregas.</span></div>' +
          (r.janela.aberta ? '' : '<div class="faixa-janela" style="background:var(--laranja-suave);color:var(--laranja-esc)">' + I('cadeado', 18) + '<span>Responder só na janela do turno: ' + esc(r.janela.proxima_texto) + '</span></div>') + '</header>';
        var blocos = [];
        if (r.aovivo_ativo) blocos.push(cartaoAoVivo());
        r.semana.forEach(function (q) { blocos.push(cartaoSemana(q)); });
        r.trilhas.forEach(function (t) { blocos.push(cartaoTrilha(t)); });
        r.desafios.forEach(function (d) { blocos.push(cartaoDesafio(d, erros[d.id])); });
        if (r.revisar.length) blocos.push(cartaoRevisar(r.revisar));
        if (r.secreta.existe) blocos.push(cartaoSecreta(r.secreta));
        if (r.sugestoes) blocos.push('<div class="cartao"><div style="display:flex;gap:12px;align-items:center"><span class="icone-q">' + I('docmais', 22) + '</span><div class="texto-flex"><span class="nome">Crie uma pergunta</span><span class="muted">Transforme uma RAF em lição aprendida. Você ganha pontos quando o líder aprovar.</span></div></div><a class="botao botao-contorno" href="#/sugerir">Criar pergunta</a></div>');
        if (!r.semana.length && !r.trilhas.length && !r.desafios.length && !r.revisar.length && !r.secreta.existe) blocos.unshift(vazio('Nenhuma pergunta aberta agora', 'Quando o líder liberar perguntas, elas aparecem aqui.'));
        render(paginaEquipe('quiz', cab + '<main class="conteudo">' + blocos.join('') + '</main>'), {
          'form:palavra': function (f) {
            var id = f.getAttribute('data-id'), b = f.querySelector('button');
            ocupado(b, true);
            chamar('responder', { pergunta_id: id, resposta: f.palavra.value }).then(function (x) {
              if (x.correta) celebrar({ pontos: x.pontos, titulo: 'Achou a palavra!', texto: x.limite_atingido ? 'Você já chegou ao limite de pontos de quiz da semana.' : (x.fonte || ''), icone: 'livro' }, telaQuiz);
              else { erros[id] = 'Ainda não. Confira o item no documento e tente de novo.'; desenhar(); }
            }).catch(function (e) { if (sessaoInvalida(e)) return; erros[id] = e.message; desenhar(); });
          }
        });
      }
      desenhar();
    });
  }
  function cartaoSemana(q) {
    var acao;
    if (q.estado === 'acertou') acao = '<p class="janela">' + I('check', 18, '#4ADE80') + ' Você já acertou esta.</p>';
    else if (q.estado === 'aguardando') acao = '<p class="sub-claro">Você errou. Ela volta pra você ' + esc(q.volta_texto) + '.</p>';
    else acao = '<span class="sub-claro" style="font-size:13px">' + (q.estado === 'revisar' ? 'Vale ponto de domínio' : '+' + q.pontos + ' pts no primeiro acerto') + ' · sem limite de tempo</span><a class="botao" href="#/pergunta/' + encodeURIComponent(q.id) + '">' + (q.estado === 'revisar' ? 'Responder de novo' : 'Responder') + '</a>';
    return '<div class="cartao-escuro"><div class="secao-cab" style="align-items:center"><span class="rotulo pessego">Pergunta da semana</span>' + (q.fecha_texto ? '<span class="chip chip-claro" style="min-height:0;padding:3px 8px">até ' + esc(q.fecha_texto) + '</span>' : '') + '</div>' +
      '<p class="num" style="font-size:22px;line-height:1.2">' + esc(q.texto) + '</p>' + acao + '</div>';
  }
  function cartaoTrilha(t) {
    var proxIdx = -1;
    var passos = t.itens.map(function (it, i) {
      var cont;
      if (it.estado === 'acertou') cont = I('check', 14, '#fff', 3);
      else if (it.estado === 'bloqueada') cont = I('cadeado', 13, null, 2.2);
      else if (it.estado === 'agendada') cont = I('relogio', 13, null, 2.2);
      else if (it.estado === 'revisar' || it.estado === 'aguardando') cont = I('repetir', 14, null, 2.2);
      else cont = String(i + 1);
      var rot = 'Pergunta ' + (i + 1) + ': ' + rotuloEstado(it);
      var clicavel = it.estado === 'nova' || it.estado === 'revisar';
      if (clicavel && proxIdx < 0) proxIdx = i;
      return clicavel ? '<a class="passo ' + it.estado + '" href="#/pergunta/' + encodeURIComponent(it.id) + '" aria-label="' + esc(rot) + '">' + cont + '</a>'
        : '<span class="passo ' + it.estado + '" role="img" aria-label="' + esc(rot) + '">' + cont + '</span>';
    }).join('');
    return '<div class="cartao"><div class="texto-flex"><span class="rotulo">Trilha</span><span class="h3" style="font-size:17px">' + esc(t.nome) + '</span></div>' +
      '<div class="passos" style="--n:' + Math.max(1, Math.min(t.itens.length, 8)) + '">' + passos + '</div>' +
      '<p class="muted">' + t.acertos + ' de ' + t.total + ' acertadas' + (t.proxima_abre ? ' · a próxima abre ' + esc(t.proxima_abre) : '') + '</p>' +
      (proxIdx >= 0 ? '<a class="botao botao-contorno" href="#/pergunta/' + encodeURIComponent(t.itens[proxIdx].id) + '">' + (t.itens[proxIdx].estado === 'revisar' ? 'Responder de novo a ' : 'Responder a ') + (proxIdx + 1) + 'ª pergunta</a>' : '') +
      '<div class="selo' + (t.concluida ? ' ganho' : '') + '">' + I('estrela', 20) + '<span>' + (t.concluida ? 'Selo conquistado: Especialista em ' + esc(t.nome) : 'Ao concluir: selo Especialista em ' + esc(t.nome)) + '</span></div></div>';
  }
  function cartaoDesafio(d, erro) {
    var corpo = d.estado === 'acertou' ? '<div class="selo ganho">' + I('check', 18) + '<span>Você achou a palavra.</span></div>'
      : '<form data-form="palavra" data-id="' + esc(d.id) + '" class="secao" style="gap:6px"><label for="pal-' + esc(d.id) + '" style="font-weight:600;font-size:14px">Palavra secreta</label><div style="display:flex;gap:8px"><input id="pal-' + esc(d.id) + '" name="palavra" class="entrada" autocomplete="off" autocapitalize="off"><button class="botao botao-escuro botao-inline" type="submit">Conferir</button></div>' +
        (erro ? '<span class="erro-campo" role="alert">' + esc(erro) + '</span>' : '') + '</form>';
    return '<div class="cartao"><div class="secao-cab"><span class="rotulo">Desafio do manual</span><span class="rotulo laranja">+' + d.pontos + ' pts</span></div>' +
      '<div style="display:flex;gap:12px;align-items:flex-start"><span class="icone-q azul">' + I('livro', 22) + '</span><p style="font-size:15px">' + esc(d.enunciado) + '</p></div>' + corpo + '</div>';
  }
  function cartaoRevisar(lista) {
    return '<div class="cartao-azul" style="flex-direction:column"><div style="display:flex;gap:12px;align-items:center"><span class="icone-q cheio-azul">' + I('repetir', 22) + '</span><div class="texto-flex"><span class="nome">' + lista.length + (lista.length === 1 ? ' pergunta para revisar' : ' perguntas para revisar') + '</span><span style="font-size:13px">As que você errou voltam depois de alguns dias. Acertando, ganha ponto de domínio.</span></div></div>' +
      lista.map(function (q) {
        return '<div class="cartao compacto linha-flex" style="width:100%"><span class="texto-flex"><span style="font-size:14px;font-weight:600">' + esc(q.texto) + '</span><span class="muted">' + (q.estado === 'revisar' ? 'Já pode responder de novo' : 'Volta ' + esc(q.volta_texto)) + '</span></span>' +
          (q.estado === 'revisar' ? '<a class="botao botao-peq botao-azul" href="#/pergunta/' + encodeURIComponent(q.id) + '">Responder</a>' : '') + '</div>';
      }).join('') + '</div>';
  }
  function cartaoSecreta(s) {
    if (!s.liberada) {
      return '<div class="cartao-tracejado"><div style="display:flex;align-items:center;gap:12px"><span class="icone-q cinza">' + I('bau', 22) + '</span><div class="texto-flex"><span class="nome">Pergunta secreta</span><span class="muted">Abre quando a equipe bater a meta coletiva</span></div></div>' +
        barra(s.meta.pct, 'verde') + '<span class="muted">' + s.meta.atual + ' de ' + s.meta.total + ' · ' + esc(s.meta.texto) + '</span></div>';
    }
    return '<div class="cartao cartao-destaque"><div style="display:flex;align-items:center;gap:12px"><span class="icone-q cheio">' + I('bau', 22) + '</span><div class="texto-flex"><span class="rotulo laranja">Pergunta secreta liberada</span><span class="muted">A equipe bateu a meta coletiva</span></div></div>' +
      s.itens.map(function (q) {
        return q.estado === 'acertou' ? '<div class="selo ganho">' + I('check', 18) + '<span>' + esc(q.texto) + '</span></div>'
          : '<a class="botao botao-contorno" href="#/pergunta/' + encodeURIComponent(q.id) + '">Responder a pergunta secreta</a>';
      }).join('') + '</div>';
  }
  function feedback(x) {
    var topo = x.correta
      ? '<div class="cartao-verde subir"><span class="avatar" style="width:40px;height:40px;background:var(--verde)">' + I('check', 22, '#fff', 2.6) + '</span><div class="texto-flex"><span class="num" style="font-size:22px;color:var(--verde)">Certo! +' + x.pontos + ' pts</span><span style="font-size:13px">' +
        (x.limite_atingido ? 'Você chegou ao limite de pontos de quiz da semana.' : (x.revisao ? 'Ponto de domínio: agora você aprendeu de vez.' : 'Boa! Continue estudando.')) + '</span></div></div>'
      : '<div class="cartao-vermelho subir"><span class="avatar" style="width:40px;height:40px;background:var(--vermelho)">' + I('repetir', 22, '#fff', 2.2) + '</span><div class="texto-flex"><span class="num" style="font-size:22px;color:var(--vermelho)">Não foi dessa vez</span><span style="font-size:13px">' +
        (x.volta_texto ? 'Ela volta pra você ' + esc(x.volta_texto) + ', valendo ponto de domínio.' : 'Leia o documento e tente de novo.') + '</span></div></div>';
    var porque = (x.explicacao || x.fonte) ? '<div class="cartao subir" style="animation-delay:.15s"><span class="rotulo">Por quê</span>' + (x.explicacao ? '<p style="font-size:15px;line-height:1.45">' + esc(x.explicacao) + '</p>' : '') +
      (x.fonte ? '<div class="fonte-doc">' + I('doc', 22, '#3B5168', 1.8) + '<span>' + esc(x.fonte) + '</span></div>' : '') + '</div>' : '';
    return topo + porque;
  }
  function telaPergunta(id) {
    comDados('pergunta', { id: id }, function (r) {
      var q = r.pergunta, escolha = null, res = null, erro = '';
      function rotulo() {
        if (q.revisao) return 'Revisão · ponto de domínio';
        return { semana: 'Pergunta da semana', trilha: 'Trilha ' + q.trilha + (q.posicao ? ' · ' + q.posicao : ''), secreta: 'Pergunta secreta', desafio: 'Desafio do manual' }[q.categoria] || 'Quiz';
      }
      function desenhar() {
        var cab = '<header class="cab-claro"><a class="voltar" href="#/quiz">' + I('voltar', 20) + 'Quiz</a><span class="rotulo laranja">' + esc(rotulo()) + '</span><h1 class="num" style="font-size:25px;line-height:1.2;margin-top:4px">' + esc(q.texto) + '</h1></header>';
        var corpo = '', rodape = '';
        if (!res && q.estado === 'acertou') {
          corpo = '<div class="cartao-verde"><span class="avatar" style="width:40px;height:40px;background:var(--verde)">' + I('check', 22, '#fff', 2.6) + '</span><span class="nome">Você já acertou esta pergunta.</span></div>';
          rodape = '<a class="botao botao-grande botao-escuro" href="#/quiz">Voltar ao quiz</a>';
        } else if (!res && q.estado === 'aguardando') {
          corpo = '<div class="cartao-azul">' + I('repetir', 22, '#1D5FA8') + '<span>Você errou esta. Ela volta pra você ' + esc(q.volta_texto) + ', valendo ponto de domínio.</span></div>';
          rodape = '<a class="botao botao-grande botao-escuro" href="#/quiz">Voltar ao quiz</a>';
        } else if (q.tipo === 'palavra') {
          corpo = res && res.correta ? feedback(res) : '<form class="cartao" data-form="palavra"><label for="palavra" style="font-weight:600">Palavra secreta</label><input id="palavra" name="palavra" class="entrada" autocomplete="off" autocapitalize="off">' +
            (erro ? '<span class="erro-campo" role="alert">' + esc(erro) + '</span>' : '') + '<button class="botao botao-escuro" type="submit">Conferir</button></form>';
          rodape = res && res.correta ? '<a class="botao botao-grande botao-escuro" href="#/quiz">Voltar ao quiz</a>' : '';
        } else {
          corpo = '<div class="alternativas" role="group" aria-label="Alternativas">' + q.alternativas.map(function (a) {
            var cls = '', tag = '';
            if (res) {
              if (a.letra === res.correta_letra) { cls = ' certa'; tag = '<br><span class="tag-alt" style="background:var(--verde)">' + (a.letra === escolha ? 'Correta · sua resposta' : 'Correta') + '</span>'; }
              else if (a.letra === escolha) { cls = ' errada'; tag = '<br><span class="tag-alt" style="background:var(--vermelho)">Sua resposta</span>'; }
              else cls = ' apagada';
            }
            return '<button type="button" class="alternativa' + cls + '" data-acao="alt" data-l="' + a.letra + '" aria-pressed="' + (!res && escolha === a.letra) + '"' + (res ? ' disabled' : '') + '><span class="letra">' + a.letra + '</span><span class="alt-txt">' + esc(a.texto) + tag + '</span></button>';
          }).join('') + '</div>';
          if (!res) corpo += '<p class="muted" style="text-align:center">Sem pressa: só o acerto conta, não o tempo. Vale +' + q.pontos_valendo + ' pts.</p>';
          if (erro) corpo += '<p class="erro-campo" role="alert">' + esc(erro) + '</p>';
          if (res) corpo += feedback(res);
          rodape = res ? '<a class="botao botao-grande botao-escuro" href="#/quiz">Voltar ao quiz</a>'
            : '<button type="button" class="botao botao-grande" data-acao="confirmar"' + (escolha ? '' : ' disabled aria-disabled="true"') + '>' + (escolha ? 'Confirmar resposta' : 'Escolha uma alternativa') + '</button>';
        }
        render(paginaSimples(cab + '<main class="conteudo">' + corpo + '</main>' + (rodape ? '<div class="rodape-fixo">' + rodape + '</div>' : '')), {
          alt: function (b) { escolha = b.getAttribute('data-l'); erro = ''; desenhar(); },
          confirmar: function (b) {
            ocupado(b, true);
            chamar('responder', { pergunta_id: q.id, resposta: escolha }).then(function (x) {
              res = x; desenhar();
              if (x.trilha_concluida) setTimeout(function () { celebrar({ titulo: 'Trilha concluída!', texto: 'Você ganhou o selo Especialista em ' + x.trilha_concluida + '.', icone: 'estrela' }); }, 600);
            }).catch(function (e) { if (sessaoInvalida(e)) return; erro = e.message; desenhar(); });
          },
          'form:palavra': function (f) {
            ocupado(f.querySelector('button'), true);
            chamar('responder', { pergunta_id: q.id, resposta: f.palavra.value }).then(function (x) {
              if (x.correta) { res = x; desenhar(); } else { erro = 'Ainda não. Confira o item no documento e tente de novo.'; desenhar(); }
            }).catch(function (e) { if (sessaoInvalida(e)) return; erro = e.message; desenhar(); });
          }
        });
      }
      desenhar();
    });
  }
  function telaSugerir() {
    var erro = '';
    function desenhar() {
      var alts = ['A', 'B', 'C', 'D'].map(function (l) {
        return '<div style="display:flex;align-items:center;gap:4px"><label for="r' + l + '" style="width:44px;height:48px;display:flex;align-items:center;justify-content:center;flex-shrink:0"><input id="r' + l + '" type="radio" name="correta" value="' + l + '" aria-label="' + l + ' é a correta" style="width:22px;height:22px;margin:0;accent-color:#C2410C"></label>' +
          '<input name="' + l.toLowerCase() + '" class="entrada" aria-label="Alternativa ' + l + '" placeholder="Alternativa ' + l + (l > 'B' ? ' (opcional)' : '') + '"></div>';
      }).join('');
      render(paginaSimples('<header class="cab-claro"><a class="voltar" href="#/quiz">' + I('voltar', 20) + 'Quiz</a><h1 class="titulo">Criar pergunta</h1><p class="sub">Transforme uma RAF em lição aprendida para a equipe</p></header>' +
        '<form class="conteudo" data-form="sugerir" style="gap:16px">' +
        '<div class="campo"><label for="base">Baseada em</label><input id="base" name="base" class="entrada" placeholder="Ex.: RAF 0451 · trinca no aro do rodeiro"></div>' +
        '<div class="campo"><label for="texto">Pergunta</label><textarea id="texto" name="texto" class="entrada" rows="3" placeholder="Ex.: Qual foi a causa raiz da trinca no aro do rodeiro na RAF 0451?"></textarea></div>' +
        '<div class="campo"><span class="lbl">Alternativas <span class="muted">· marque a correta</span></span>' + alts + '</div>' +
        '<div class="campo"><label for="fonte">Onde está a resposta</label><input id="fonte" name="fonte" class="entrada" placeholder="Ex.: RAF 0451, item 4 · causa raiz"></div>' +
        '<div class="campo"><label for="explicacao">Explicação <span class="muted">(opcional)</span></label><textarea id="explicacao" name="explicacao" class="entrada" rows="2" placeholder="Por que essa é a resposta certa"></textarea></div>' +
        '<div class="cartao-azul">' + I('escudo', 20, '#1D5FA8') + '<span style="font-size:14px">O líder revisa antes de publicar. Você ganha pontos quando a pergunta for aprovada.</span></div>' +
        (erro ? '<p class="erro-campo" role="alert">' + esc(erro) + '</p>' : '') +
        '<button class="botao botao-grande" type="submit">Enviar para aprovação</button></form>'), {
        'form:sugerir': function (f) {
          ocupado(f.querySelector('[type=submit]'), true);
          var fonte = f.fonte.value.trim() || f.base.value.trim();
          chamar('sugerir', { texto: f.texto.value, a: f.a.value, b: f.b.value, c: f.c.value, d: f.d.value, correta: f.correta.value, fonte: fonte, explicacao: f.explicacao.value }).then(function (x) {
            render(paginaSimples('<main class="conteudo" style="padding-top:40px"><div class="resultado"><span class="circulo" style="background:var(--verde-suave);color:var(--verde)">' + I('check', 34) + '</span><h2>Pergunta enviada</h2><p>O líder vai revisar. Se for aprovada, você ganha +' + x.pontos_aprovacao + ' pts e ela entra no quiz da equipe.</p><a class="botao" href="#/quiz">Voltar ao quiz</a></div></main>'));
          }).catch(function (e) { if (sessaoInvalida(e)) return; erro = e.message; desenhar(); });
        }
      });
    }
    desenhar();
  }

  // ---------------------------------------------------------------------------
  // Quiz ao vivo (celular da equipe)
  // ---------------------------------------------------------------------------
  function telaAoVivo() {
    var ultimo = '', enviando = '';
    var atual = null, ultimoPlacar = null;
    function textoPlacar(m) {
      return m.acertos ? 'Você: ' + m.acertos + (m.acertos === 1 ? ' acerto' : ' acertos') + ' · ' + m.pos + 'º lugar' : 'Você ainda não pontuou neste quiz';
    }
    function desenhar(r) {
      atual = r;
      if (r.meu_placar) ultimoPlacar = r.meu_placar;
      var chave = JSON.stringify(r) + '|' + enviando;
      if (chave === ultimo) return;
      ultimo = chave;
      var corpo, titulo = '';
      if (!r.ativo && ultimoPlacar) {
        corpo = '<div class="resultado"><span class="circulo" style="background:var(--cinza-suave);color:var(--navy-2)">' + I('trofeu', 34) + '</span><h2>Quiz encerrado</h2><p>' + esc(ultimoPlacar.acertos ? textoPlacar(ultimoPlacar) + '. Confira o pódio na TV.' : 'Valeu por participar! Confira o pódio na TV.') + '</p><a class="botao botao-contorno" href="#/quiz">Voltar ao quiz</a></div>';
      } else if (!r.ativo) {
        corpo = '<div class="resultado"><span class="circulo" style="background:var(--cinza-suave);color:var(--navy-2)">' + I('vivo', 34) + '</span><h2>Nenhum quiz ao vivo agora</h2><p>Na reunião, quando o líder abrir o quiz, as perguntas aparecem aqui sozinhas.</p><a class="botao botao-contorno" href="#/quiz">Voltar ao quiz</a></div>';
      } else if (!r.pergunta) {
        corpo = '<div class="resultado"><span class="giro"></span><h2>Aguardando a próxima pergunta</h2><p>Fique de olho na TV.</p></div>';
      } else {
        titulo = '<h1 class="num" style="font-size:25px;line-height:1.2">' + esc(r.pergunta.texto) + '</h1>';
        var minha = r.minha_resposta || enviando;
        corpo = '<div class="alternativas" role="group" aria-label="Alternativas">' + r.pergunta.alternativas.map(function (a) {
          var cls = '';
          if (r.revelada) cls = a.letra === r.correta_letra ? ' certa' : (a.letra === minha ? ' errada' : ' apagada');
          var travado = !!minha || r.revelada;
          return '<button type="button" class="alternativa' + cls + '" data-acao="responder" data-l="' + a.letra + '" aria-pressed="' + (!r.revelada && a.letra === minha) + '"' + (travado ? ' disabled' : '') + '><span class="letra">' + a.letra + '</span><span class="alt-txt">' + esc(a.texto) + '</span></button>';
        }).join('') + '</div>';
        if (!r.revelada) corpo += minha ? '<div class="cartao-azul">' + I('relogio', 22, '#1D5FA8') + '<span>Resposta enviada. Aguarde o líder mostrar a resposta na TV.</span></div>' : '<p class="muted" style="text-align:center">Toque na alternativa para responder. Só o acerto conta, não a velocidade.</p>';
        else if (!r.minha_resposta) corpo += '<div class="cartao-azul">' + I('info', 22, '#1D5FA8') + '<span>Você não respondeu esta.</span></div>';
        else corpo += feedback({ correta: r.acertei, pontos: r.pontos, explicacao: r.explicacao, fonte: r.fonte });
        if (r.revelada && r.meu_placar) corpo += '<div class="cartao-azul">' + I('trofeu', 22, '#1D5FA8') + '<span>' + esc(textoPlacar(r.meu_placar)) + '</span></div>';
      }
      render(paginaSimples('<header class="cab-escuro"><a class="voltar" style="color:#fff" href="#/quiz">' + I('voltar', 20) + 'Quiz</a><span class="rotulo pessego">Quiz ao vivo</span>' + titulo + '</header><main class="conteudo">' + corpo + '</main>'), {
        responder: function (b) {
          if (!atual || !atual.pergunta) return;
          enviando = b.getAttribute('data-l');
          desenhar(atual);
          // Com a planilha, as respostas saem um pouco espalhadas, porque todos tocam quase ao mesmo tempo
          var pergunta = atual.pergunta.id, letra = enviando;
          if (Api.demo) enviarResposta(pergunta, letra, 0);
          else estado.timers.push(setTimeout(function () { enviarResposta(pergunta, letra, 0); }, Math.random() * 4000));
        }
      });
    }
    function enviarResposta(pergunta, letra, tentativa) {
      chamar('aoVivoResponder', { pergunta_id: pergunta, resposta: letra }).then(Api.demo ? atualizar : function () {}).catch(function (e) {
        // Se a tentativa anterior chegou ao servidor, a resposta já está guardada
        if (/já respondeu/.test(e.message)) return;
        if (e.resposta && e.resposta.rede && tentativa < 3) {
          estado.timers.push(setTimeout(function () { enviarResposta(pergunta, letra, tentativa + 1); }, 2000 + Math.random() * 3000));
          return;
        }
        enviando = ''; ultimo = ''; falhou(e); atualizar();
      });
    }
    function atualizar() {
      return chamar('aoVivoEstado').then(function (r) {
        if (r.pergunta && atual && atual.pergunta && atual.pergunta.id !== r.pergunta.id) enviando = '';
        desenhar(r);
      }).catch(function (e) { sessaoInvalida(e); });
    }
    carregando();
    atualizar();
    consultarSempre(atualizar, 3000, 6000);
  }

  // ---------------------------------------------------------------------------
  // Placar da Oficina (ranking)
  // ---------------------------------------------------------------------------
  function podio(lista) {
    if (!lista.length) return '<p class="sub-claro" style="padding:8px 0 20px">O pódio aparece aqui depois do primeiro Pit Stop.</p>';
    var ordem = [lista[1], lista[0], lista[2]];
    return '<div class="podio" style="margin-top:4px">' + ordem.map(function (p, i) {
      if (!p) return '<div></div>';
      var eu = sessao && p.id === sessao.pessoa_id;
      var cls = i === 1 ? 'p1' : (i === 0 ? 'p2' : 'p3');
      return '<div class="podio-col">' + (i === 1 ? I('estrela', 24, '#F97316') : '') + A(p.avatar, i === 1 ? 64 : 54, true) +
        '<span class="nome-p">' + esc(curto(p.nome)) + (eu ? ' <span style="color:var(--pessego);font-weight:500">(você)</span>' : '') + '</span><span class="pts-p">' + p.pontos + ' pts</span><div class="pedestal ' + cls + '">' + p.pos + 'º</div></div>';
    }).join('') + '</div>';
  }
  function telaRanking() {
    comDados('ranking', {}, function (r) {
      var aba = 'semana';
      function desenhar() {
        var fonte = r.apuracao_ativa ? r.ultima : r.ao_vivo;
        var lista = fonte ? (fonte[aba] || []) : [];
        var minha = fonte ? fonte['minha_' + aba] : null;
        var sub = r.apuracao_ativa ? (r.ultima ? 'Resultado do Pit Stop de ' + r.ultima.data_texto : 'Ainda sem Pit Stop') : 'Atualizado agora';
        var cab = '<header class="cab-escuro" style="padding-bottom:0"><div class="secao-cab" style="align-items:flex-end"><div><h1 class="titulo">Placar da Oficina</h1><p class="sub-claro">' + esc(sub) + '</p></div>' +
          '<div class="abas" role="group" aria-label="Período"><button type="button" data-acao="aba" data-v="semana" aria-pressed="' + (aba === 'semana') + '">Período</button><button type="button" data-acao="aba" data-v="mes" aria-pressed="' + (aba === 'mes') + '">Mês</button></div></div>';
        if (r.apuracao_ativa) {
          cab += '<div class="cartao-vidro"><div class="secao-cab" style="align-items:center"><div class="texto-flex"><span class="rotulo pessego">Próximo Pit Stop</span><span style="font-size:17px;font-weight:700">' + (r.proxima.definida ? esc(r.proxima.texto) + ', na reunião' : 'A definir pelo líder') + '</span><span class="sub-claro" style="font-size:13px">As posições só aparecem no Pit Stop</span></div>' +
            (r.proxima.definida ? '<div style="display:flex;flex-direction:column;align-items:center;padding:6px 12px;border-radius:12px;background:rgba(255,255,255,.1)">' + (r.proxima.faltam_dias === 0 ? '<span class="num" style="font-size:22px">hoje</span>' : '<span class="num" style="font-size:34px">' + r.proxima.faltam_dias + '</span><span class="stat-rot">' + (r.proxima.faltam_dias === 1 ? 'dia' : 'dias') + '</span>') + '</div>' : '') + '</div>' +
            '<div class="barra-rot" style="padding-top:10px;border-top:1px solid rgba(255,255,255,.14);align-items:baseline"><span>Seus pontos desde o último Pit Stop</span><b class="num" style="font-size:22px;color:#fff">' + r.meus_pontos_periodo + '</b></div></div>';
        }
        cab += '<span class="rotulo" style="color:var(--claro);margin-top:4px">' + (aba === 'semana' ? 'Desde o Pit Stop anterior' : 'Mês até o Pit Stop') + '</span>' + podio(lista) + '</header>';
        var blocos = [];
        var resto = lista.slice(3);
        if (resto.length) {
          blocos.push('<div class="secao">' + resto.map(function (p) {
            var eu = sessao && p.id === sessao.pessoa_id;
            return '<div class="cartao compacto linha-flex"' + (eu ? ' style="border-color:var(--laranja)"' : '') + '><span class="pos">' + p.pos + 'º</span>' + A(p.avatar, 40) + '<span class="nome" style="flex:1">' + esc(p.nome) + (eu ? ' (você)' : '') + '</span><span class="num" style="font-size:18px">' + p.pontos + ' <span style="font-family:var(--fonte);font-size:13px;font-weight:500;color:var(--muted)">pts</span></span></div>';
          }).join('') + '</div>');
        }
        if (minha && minha.pos > lista.length) {
          blocos.push('<div class="cartao linha-flex"><span class="pos" style="color:var(--navy)">' + minha.pos + 'º</span><div class="texto-flex"><span class="nome">Sua posição · ' + minha.pontos + ' pts</span><span class="muted">' + I('cadeado', 12) + ' Só você vê</span></div></div>');
        }
        if (r.apuracao_ativa && lista.length) blocos.push('<p class="muted" style="padding:0 4px">As demais posições aparecem só para a própria pessoa.</p>');
        if (aba === 'semana' && fonte && fonte.evoluiu) {
          blocos.push('<div class="cartao linha-flex">' + A(fonte.evoluiu.avatar, 44) + '<div class="texto-flex"><span class="rotulo verde">Quem mais evoluiu</span><span class="nome" style="font-size:16px">' + esc(fonte.evoluiu.nome) + '</span><span class="muted">+' + fonte.evoluiu.delta + ' pts em relação ao Pit Stop anterior</span></div></div>');
        }
        if (aba === 'semana' && fonte && fonte.destaques && fonte.destaques.length) {
          blocos.push('<div class="cartao"><span class="rotulo">Destaques por atividade no Pit Stop</span><div class="lista" style="border:0">' + fonte.destaques.map(function (d) {
            var eu = sessao && d.pessoa.id === sessao.pessoa_id;
            return '<div class="item" style="padding:10px 0">' + A(d.pessoa.avatar, 36) + '<div class="texto-flex"><span class="nome">' + esc(d.selo) + '</span><span class="muted">' + esc(d.pessoa.nome) + (eu ? ' (você)' : '') + ' · ' + esc(d.atividade) + '</span></div><span class="num" style="font-size:16px;color:var(--laranja-esc)">' + d.pessoa.pontos + ' pts</span></div>';
          }).join('') + '</div></div>');
        }
        if (r.nivel_equipe) blocos.push('<div class="cartao"><span class="rotulo">Acelerador da equipe</span>' + acelerador(r.nivel_equipe, false, 'média de ' + r.nivel_equipe.media + ' pts por pessoa no mês') + '</div>');
        blocos.push('<div class="cartao linha-flex"><span class="icone-q">' + I('presente', 22) + '</span><div class="texto-flex"><span class="rotulo laranja">Reconhecimento do mês</span><span class="nome">1º lugar: ' + esc(r.premio_mes) + '</span><span class="muted">Mais evoluiu: ' + esc(r.premio_evolucao) + '</span></div></div>');
        blocos.push(cartaoMeta(r.meta_coletiva));
        render(paginaEquipe('ranking', cab + '<main class="conteudo">' + blocos.join('') + '</main>'), {
          aba: function (b) { aba = b.getAttribute('data-v'); desenhar(); }
        });
      }
      desenhar();
    });
  }

  // ---------------------------------------------------------------------------
  // Perfil e avatar
  // ---------------------------------------------------------------------------
  function telaPerfil() {
    comDados('perfil', {}, function (r) {
      atualizarSessao({ avatar: r.pessoa.avatar, modulos: r.modulos });
      var m = r.modulos;
      var max = Math.max.apply(null, r.grafico.map(function (g) { return g.entregas + g.quiz; }).concat([1]));
      var desc = r.grafico.map(function (g) { return g.rotulo + ': ' + (g.entregas + g.quiz) + ' pontos (' + g.entregas + ' de entregas e ' + g.quiz + ' de quiz)'; }).join('; ');
      var cols = r.grafico.map(function (g) {
        var he = Math.round(g.entregas / max * 90), hq = Math.round(g.quiz / max * 90);
        return '<div class="grafico-col"><span style="font-size:13px;font-weight:600">' + (g.entregas + g.quiz) + '</span><div class="pilha"' + (g.atual ? ' style="opacity:.7"' : '') + '>' +
          (hq ? '<div style="height:' + hq + 'px;background:var(--laranja);border-radius:4px 4px 0 0"></div>' : '') + '<div style="height:' + Math.max(he, 2) + 'px;background:var(--navy-2);' + (hq ? '' : 'border-radius:4px 4px 0 0') + '"></div></div></div>';
      }).join('');
      var iconeConq = { check: 'check', estrela: 'estrela', relogio: 'relogio', trofeu: 'trofeu', livro: 'livro', pergunta: 'quiz' };
      var html = '<header class="cab-claro" style="gap:14px"><h1 class="titulo">Perfil</h1><div style="display:flex;align-items:center;gap:14px">' + A(r.pessoa.avatar, 64) +
        '<div class="texto-flex"><span style="font-size:18px;font-weight:700">' + esc(r.pessoa.nome) + '</span><span class="sub">' + (r.pessoa.papel === 'lider' ? 'Líder' : 'Turno ' + esc(r.pessoa.turno)) +
        (r.minha_posicao ? ' · ' + r.minha_posicao.pos + 'º no Pit Stop de ' + esc(r.minha_posicao.data_texto) : '') + '</span>' +
        (m.avatar ? '<a class="link-botao" style="align-self:flex-start;min-height:36px;padding:0" href="#/avatar">Trocar avatar</a>' : '') + '</div></div>' +
        '<div class="cartao" style="padding:12px">' + acelerador(r.nivel) + '</div>' +
        '<div class="grid3">' + statClaro(r.pontos_mes, 'pontos no mês') + statClaro(r.entregas_mes, 'entregas no mês') + statClaro(r.no_prazo_pct === null ? '–' : r.no_prazo_pct + '%', 'no prazo') + '</div></header>';
      html += '<main class="conteudo">';
      html += '<div class="cartao"><div class="secao-cab" style="align-items:center"><h2 class="h3">Pontos por Pit Stop</h2><div class="legenda"><span><i style="background:var(--navy-2)"></i>Entregas</span><span><i style="background:var(--laranja)"></i>Quiz</span></div></div>' +
        '<div class="grafico" role="img" aria-label="' + esc(desc) + '" style="--n:' + r.grafico.length + '">' + cols + '</div><div class="grafico-rot" style="--n:' + r.grafico.length + '">' +
        r.grafico.map(function (g) { return '<span' + (g.atual ? ' style="font-weight:600;color:var(--navy)"' : '') + '>' + esc(g.rotulo) + '</span>'; }).join('') + '</div></div>';
      var ganhas = r.conquistas.filter(function (c) { return c.conquistada; }).length;
      html += '<section class="secao"><div class="secao-cab"><h2 class="h3">Conquistas</h2><span class="muted">' + ganhas + ' de ' + r.conquistas.length + '</span></div><div class="conquistas">' + r.conquistas.map(function (c) {
        return '<div class="conquista' + (c.conquistada ? '' : ' bloq') + '"><span class="circ">' + I(c.conquistada ? (iconeConq[c.icone] || 'estrela') : 'cadeado', 20) + '</span><span>' + esc(c.nome) + (c.detalhe && !c.conquistada ? ' · ' + esc(c.detalhe) : '') + '</span></div>';
      }).join('') + '</div></section>';
      if (r.selos && r.selos.colecao.length) {
        var at = r.selos.atual;
        html += '<section class="secao"><div class="secao-cab"><h2 class="h3">Selos por atividade</h2><span class="muted">prata ' + r.selos.prata + ' meses · ouro ' + r.selos.ouro + '</span></div>' +
          (at ? '<div class="cartao linha-flex cartao-destaque"><span class="icone-q cheio">' + I('estrela', 22) + '</span><div class="texto-flex"><span class="rotulo laranja">Seu selo do mês (em disputa)</span><span class="nome" style="font-size:16px">' + esc(at.selo) + '</span><span class="muted">' + at.pontos + ' pts em ' + esc(at.atividade) + '. O selo fica com a atividade em que você mais pontuar até o fim do mês.</span></div></div>'
            : '<p class="muted">Pontue em alguma atividade para disputar o selo do mês.</p>') +
          '<div class="conquistas">' + r.selos.colecao.map(function (c) { return seloHtml(c.selo, c.nivel, c.vezes ? c.vezes + (c.vezes === 1 ? ' mês' : ' meses') : c.atividade); }).join('') + '</div></section>';
      }
      if (m.quiz) {
        html += '<div class="cartao"><div class="secao-cab" style="align-items:center"><h2 class="h3">Meu quiz</h2><span class="muted" style="display:flex;gap:4px;align-items:center">' + I('cadeado', 14) + 'só você vê</span></div><div class="grid3">' +
          statClaro(r.quiz.acerto_pct === null ? '–' : r.quiz.acerto_pct + '%', 'de acerto') + statClaro(r.quiz.para_revisar, 'para revisar') + statClaro(r.quiz.aprovadas + '/' + r.quiz.criadas, 'perguntas aprovadas') + '</div></div>';
      }
      if (r.historico.length) {
        html += '<section class="secao"><h2 class="h3">Últimas entregas</h2><div class="lista">' + r.historico.map(function (x) {
          return '<div class="item"><div class="texto-flex"><span class="nome">' + esc(x.tipo) + '</span><span style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">' + chipStatus(x) + '<span class="muted">' + esc(x.quando) + '</span></span></div><span class="num" style="font-size:18px;color:' + (x.status === 'validada' ? 'var(--verde)' : 'var(--muted)') + '">+' + (x.status === 'validada' ? x.pontos : x.pontos_tipo) + '</span></div>';
        }).join('') + '</div></section>';
      }
      html += '<button type="button" class="botao botao-leve" data-acao="sair">' + I('sair', 20) + 'Sair do app</button></main>';
      render(paginaEquipe('perfil', html));
    });
  }
  function telaAvatar() {
    var sel = (sessao && sessao.avatar) || 'rodeiro';
    var lista = Object.keys(Icones.AVATARES);
    function desenhar() {
      var a = Icones.AVATARES[sel];
      render(paginaSimples('<header class="cab-claro"><a class="voltar" href="#/perfil">' + I('voltar', 20) + 'Perfil</a><h1 class="titulo">Escolha seu avatar</h1></header><main class="conteudo" style="gap:20px">' +
        '<div style="display:flex;flex-direction:column;align-items:center;gap:8px"><span class="pop" style="display:inline-flex;border-radius:50%;box-shadow:0 0 0 4px #fff,0 0 0 6px var(--linha)">' + A(sel, 104) + '</span><span style="font-size:20px;font-weight:700">' + esc(sessao.nome) + '</span><span class="muted">O nome vem do cadastro da equipe · avatar: ' + esc(a.nome) + '</span></div>' +
        '<div class="galeria" role="group" aria-label="Galeria de avatares">' + lista.map(function (id) {
          return '<button type="button" data-acao="escolher" data-id="' + id + '" aria-pressed="' + (id === sel) + '" aria-label="' + esc(Icones.AVATARES[id].nome) + '">' + A(id, 52) + '<span>' + esc(Icones.AVATARES[id].nome) + '</span></button>';
        }).join('') + '</div>' +
        '<div class="cartao-azul">' + I('escudo', 20, '#1D5FA8') + '<span style="font-size:14px">Sem fotos pessoais: os avatares vêm da galeria do app. Isso evita imagens impróprias e questões de LGPD.</span></div></main>' +
        '<div class="rodape-fixo"><button type="button" class="botao botao-grande" data-acao="salvar">Salvar avatar</button></div>'), {
        escolher: function (b) { sel = b.getAttribute('data-id'); desenhar(); },
        salvar: function (b) {
          ocupado(b, true);
          chamar('avatar', { avatar: sel }).then(function () { atualizarSessao({ avatar: sel }); toast('Avatar salvo.', 'ok'); location.hash = '#/perfil'; }).catch(function (e) { ocupado(b, false); falhou(e); });
        }
      });
    }
    desenhar();
  }

  // ---------------------------------------------------------------------------
  // Líder: validar entregas
  // ---------------------------------------------------------------------------
  function telaValidar() {
    comDados('pendentes', {}, function (r) {
      function recarregar() { chamar('pendentes').then(function (n) { r = n; desenhar(); }).catch(falhou); }
      function desenhar() {
        var cab = cabLider('Validar entregas', (estado.app && estado.app.equipe) || 'Área do líder', 'escudo');
        var normais = r.pendentes.filter(function (p) { return !p.sorteada; });
        var c = r.conformidade, blocos = [];
        if (r.sorteio_ativo && c.conferidas) {
          blocos.push('<div class="cartao linha-flex"><span class="icone-q azul">' + I('escudo', 22) + '</span><div class="texto-flex"><span class="rotulo">Conformidade da amostragem</span><span class="nome">' + c.conferem + ' de ' + c.conferidas + ' conferem (' + c.pct + '%)</span><span class="muted">Intervalo de confiança de 95%: ' + c.ic[0] + '% a ' + c.ic[1] + '% · sorteio de ' + r.taxa_sorteio + '% das entregas</span></div></div>');
        }
        if (!r.pendentes.length) {
          blocos.push('<div class="resultado"><span class="circulo" style="background:var(--verde-suave);color:var(--verde)">' + I('check', 34, null, 2.4) + '</span><h2>Tudo validado</h2><p>Os pontos já entraram. As posições aparecem no Pit Stop.</p><a class="botao botao-escuro" href="#/lider/apuracao">Preparar o Pit Stop</a></div>');
        } else {
          blocos.push('<div class="secao-cab" style="align-items:center"><div class="texto-flex"><h2 class="h2">' + r.pendentes.length + (r.pendentes.length === 1 ? ' entrega aguardando' : ' entregas aguardando') + '</h2><span class="muted">Os pontos só entram depois da validação</span></div>' +
            (normais.length > 1 ? '<button type="button" class="botao botao-peq botao-verde" data-acao="todas">Validar ' + normais.length + '</button>' : '') + '</div>');
          r.pendentes.forEach(function (p) {
            var botoes;
            if (p.sorteada && p.aguardando_ref) botoes = '<button type="button" class="botao botao-peq botao-leve" data-acao="decidir" data-id="' + esc(p.id) + '" data-d="recusar">Recusar</button>';
            else if (p.sorteada) botoes = '<button type="button" class="botao botao-peq botao-leve" style="color:var(--vermelho)" data-acao="decidir" data-id="' + esc(p.id) + '" data-d="recusar">Não confere</button><button type="button" class="botao botao-peq botao-leve" data-acao="decidir" data-id="' + esc(p.id) + '" data-d="atrasada">Confere · atrasada</button><button type="button" class="botao botao-peq botao-verde" data-acao="decidir" data-id="' + esc(p.id) + '" data-d="validar">Confere</button>';
            else botoes = '<button type="button" class="botao botao-peq botao-leve" data-acao="decidir" data-id="' + esc(p.id) + '" data-d="recusar">Recusar</button><button type="button" class="botao botao-peq botao-leve" data-acao="decidir" data-id="' + esc(p.id) + '" data-d="atrasada">Atrasada (+' + p.pontos_metade + ')</button><button type="button" class="botao botao-peq botao-verde" data-acao="decidir" data-id="' + esc(p.id) + '" data-d="validar">Validar</button>';
            blocos.push('<div class="cartao"><div style="display:flex;gap:12px;align-items:center">' + A(p.pessoa.avatar, 40) + '<div class="texto-flex"><span class="muted">' + esc(p.pessoa.nome) + ' · ' + esc(p.quando) + '</span><span class="nome">' + esc(p.tipo) + '</span>' +
              (p.referencia ? '<span style="font-size:13px">Nº ' + esc(p.referencia) + '</span>' : '') + '</div><span class="num" style="font-size:18px;color:var(--laranja-esc)">+' + p.pontos_tipo + '</span></div>' +
              (p.alerta ? '<p class="alerta">' + I('alerta', 18) + '<span>' + esc(p.alerta) + '</span></p>' : '') +
              (p.sorteada ? '<div class="cartao-azul" style="padding:10px;align-items:center">' + I(p.aguardando_ref ? 'relogio' : 'escudo', 20, '#1D5FA8') + '<span style="font-size:13px">' +
                (p.aguardando_ref ? 'Sorteada para conferência. Aguardando a pessoa informar o número.' : '<b>Sorteada para conferência.</b> Confira o nº ' + esc(p.referencia) + ' no sistema oficial' + (p.dica ? ' (' + esc(p.dica) + ')' : '') + '.') + '</span></div>' : '') +
              '<div class="acoes-validar">' + botoes + '</div></div>');
          });
        }
        render(paginaLider('lider/validar', cab + '<main class="conteudo">' + blocos.join('') + '</main>'), {
          decidir: function (b) {
            var id = b.getAttribute('data-id'), d = b.getAttribute('data-d');
            b.closest('.cartao').classList.add('ocupado');
            chamar('validar', { id: id, decisao: d }).then(function () {
              toast(d === 'recusar' ? 'Entrega recusada.' : 'Entrega validada.', 'ok');
              r.pendentes = r.pendentes.filter(function (p) { return p.id !== id; });
              desenhar();
              recarregar();
            }).catch(function (e) { falhou(e); recarregar(); });
          },
          todas: function (b) {
            ocupado(b, true);
            chamar('validarTodas').then(function (x) { toast(x.validadas + ' entregas validadas.', 'ok'); recarregar(); }).catch(function (e) { ocupado(b, false); falhou(e); });
          }
        });
      }
      desenhar();
    });
  }

  // ---------------------------------------------------------------------------
  // Líder: perguntas do quiz
  // ---------------------------------------------------------------------------
  var CATEGORIAS = [['semana', 'Pergunta da semana'], ['trilha', 'Trilha'], ['desafio', 'Desafio do manual'], ['secreta', 'Pergunta secreta'], ['aovivo', 'Quiz ao vivo']];
  function nomeCategoria(c) { var x = CATEGORIAS.filter(function (k) { return k[0] === c; })[0]; return x ? x[1] : (c || 'sem categoria'); }
  function telaPerguntasLider() {
    comDados('perguntasLider', {}, function (r) {
      function recarregar() { chamar('perguntasLider').then(function (n) { r = n; desenhar(); }).catch(falhou); }
      function botaoExcluir(q) { return '<button type="button" class="botao botao-peq botao-leve" data-acao="excluir" data-id="' + esc(q.id) + '" data-n="' + (q.respostas || 0) + '">Excluir</button>'; }
      function blocoPergunta(q, tipo) {
        var alts = q.tipo === 'palavra' ? '<p style="font-size:14px">Palavra secreta: <b>' + esc(q.correta) + '</b></p>'
          : '<div class="pergunta-alts">' + q.alternativas.map(function (a) { return '<span class="' + (a.letra === q.correta ? 'certa' : '') + '">' + a.letra + ') ' + esc(a.texto) + (a.letra === q.correta ? ' ✓' : '') + '</span>'; }).join('') + '</div>';
        var cat = q.categoria || 'trilha';
        var trilha = q.trilha || (tipo === 'sugestao' ? 'Lições de RAF' : '');
        var controles = '<div class="grid2"><div class="campo"><label for="cat-' + esc(q.id) + '">Onde entra</label><select id="cat-' + esc(q.id) + '" class="entrada" data-cat="' + esc(q.id) + '">' +
          CATEGORIAS.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === cat ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div>' +
          '<div class="campo"><label for="tri-' + esc(q.id) + '">Trilha</label><input id="tri-' + esc(q.id) + '" class="entrada" list="lista-trilhas" data-tri="' + esc(q.id) + '" value="' + esc(trilha) + '"></div></div>';
        var editar = q.respostas ? '' : '<a class="botao botao-peq botao-leve" href="#/lider/pergunta/' + encodeURIComponent(q.id) + '">Editar</a>';
        var botoes = tipo === 'sugestao'
          ? editar + '<button type="button" class="botao botao-peq botao-leve" data-acao="moderar" data-id="' + esc(q.id) + '" data-d="recusar">Recusar</button><button type="button" class="botao botao-peq botao-verde" data-acao="moderar" data-id="' + esc(q.id) + '" data-d="aprovar">Aprovar (+' + r.pontos_sugestao + ' pts ao autor)</button>'
          : editar + botaoExcluir(q) + '<button type="button" class="botao botao-peq botao-verde" data-acao="moderar" data-id="' + esc(q.id) + '" data-d="ativar">' + (tipo === 'revisar' ? 'Revisei, reativar' : 'Ativar') + '</button>';
        return '<div class="cartao">' + (q.autor ? '<div style="display:flex;align-items:center;gap:10px">' + A(q.autor.avatar, 36) + '<span class="muted"><b style="color:var(--navy)">' + esc(q.autor.nome) + '</b> · sugestão da equipe</span></div>' : '') +
          '<span class="nome" style="font-size:16px;line-height:1.35">' + esc(q.texto) + '</span>' + alts + '<span class="muted">Fonte: ' + esc(q.fonte || '—') + '</span>' + controles + '<div class="botoes">' + botoes + '</div></div>';
      }
      function desenhar() {
        var cab = cabLider('Perguntas do quiz', r.total_ativas + ' ativas · ' + r.trilhas.length + (r.trilhas.length === 1 ? ' trilha' : ' trilhas'), 'quiz');
        var b = ['<datalist id="lista-trilhas">' + r.trilhas.concat(['Lições de RAF']).map(function (t) { return '<option value="' + esc(t) + '">'; }).join('') + '</datalist>',
          '<a class="botao botao-grande" href="#/lider/pergunta">' + I('docmais', 22) + 'Nova pergunta</a>'];
        if (r.revisar.length) {
          b.push('<div class="cartao-laranja"><div style="display:flex;gap:10px">' + I('alerta', 22, '#9A3412') + '<div class="texto-flex"><span class="nome" style="color:var(--laranja-esc)">' + r.revisar.length + ' perguntas fora do ar para revisão</span><span style="font-size:14px">O documento delas mudou de revisão. Confira a resposta e reative.</span></div></div></div>');
          r.revisar.forEach(function (q) { b.push(blocoPergunta(q, 'revisar')); });
        }
        b.push('<section class="secao"><div class="texto-flex"><h2 class="h2">Sugestões da equipe (' + r.sugestoes.length + ')</h2><span class="muted">O autor ganha +' + r.pontos_sugestao + ' pts quando você aprova</span></div>' +
          (r.sugestoes.length ? r.sugestoes.map(function (q) { return blocoPergunta(q, 'sugestao'); }).join('') : '<p class="muted">Nenhuma sugestão esperando.</p>') + '</section>');
        if (r.rascunhos.length) {
          b.push('<section class="secao"><div class="texto-flex"><h2 class="h2">Rascunhos para revisar (' + r.rascunhos.length + ')</h2><span class="muted">Perguntas importadas ou de exemplo. Nada vai ao ar sem a sua revisão.</span></div>' + r.rascunhos.map(function (q) { return blocoPergunta(q, 'rascunho'); }).join('') + '</section>');
        }
        b.push('<div class="cartao"><h2 class="h2">Gerar perguntas com IA</h2><p class="muted" style="font-size:14px">Copie a instrução, cole no Claude junto com o texto do PRO ou do manual e traga de volta o resultado. As perguntas entram como rascunho para você revisar.</p>' +
          '<div class="botoes"><button type="button" class="botao botao-peq botao-leve" data-acao="copiarPrompt">' + I('copiar', 18) + 'Copiar instrução</button><a class="botao botao-peq botao-escuro" href="#/lider/importar">Colar perguntas</a></div></div>');
        b.push('<form class="cartao" data-form="doc"><h2 class="h2">Documento mudou de revisão?</h2><p class="muted" style="font-size:14px">Informe o código. As perguntas que citam esse documento saem do ar até você revisar.</p><div style="display:flex;gap:8px"><label class="visualmente-oculto" for="codigo">Código do documento</label><input id="codigo" name="codigo" class="entrada" placeholder="Ex.: PRO-0412"><button class="botao botao-escuro botao-inline" type="submit">Tirar do ar</button></div></form>');
        b.push('<details class="cartao"><summary>Ver as ' + r.total_ativas + ' perguntas ativas</summary>' + (r.ativas.length ? '<div class="lista" style="margin-top:8px">' + r.ativas.map(function (q) {
          return '<div class="item"><div class="texto-flex"><span style="font-size:14px;font-weight:600">' + esc(q.texto) + '</span><span class="muted">' + esc(nomeCategoria(q.categoria)) + (q.trilha ? ' · ' + esc(q.trilha) : '') + (q.fecha_texto ? ' · até ' + esc(q.fecha_texto) : '') + (q.respostas ? ' · ' + q.respostas + (q.respostas === 1 ? ' resposta' : ' respostas') : '') + '</span></div><div style="display:flex;gap:6px">' + (q.respostas ? '' : '<a class="botao botao-peq botao-leve" href="#/lider/pergunta/' + encodeURIComponent(q.id) + '">Editar</a>') + botaoExcluir(q) + '</div></div>';
        }).join('') + '</div>' : '<p class="muted">Nenhuma pergunta ativa.</p>') + '</details>');
        render(paginaLider('lider/perguntas', cab + '<main class="conteudo">' + b.join('') + '</main>'), {
          moderar: function (bt) {
            var id = bt.getAttribute('data-id'), d = bt.getAttribute('data-d');
            var sc = $app.querySelector('[data-cat="' + idSeguro(id) + '"]'), st = $app.querySelector('[data-tri="' + idSeguro(id) + '"]');
            ocupado(bt, true);
            chamar('moderar', { id: id, decisao: d, categoria: sc ? sc.value : '', trilha: st ? st.value : undefined }).then(function () {
              toast({ aprovar: 'Pergunta aprovada. O autor ganhou pontos.', ativar: 'Pergunta ativada.', recusar: 'Sugestão recusada.', arquivar: 'Pergunta arquivada.' }[d], 'ok');
              recarregar();
            }).catch(function (e) { ocupado(bt, false); falhou(e); });
          },
          excluir: function (bt) {
            var n = Number(bt.getAttribute('data-n')) || 0;
            var aviso = n ? (n === 1 ? 'Esta pergunta já tem 1 resposta.' : 'Esta pergunta já tem ' + n + ' respostas.') + ' Ela sai do app para todos, e os pontos já ganhos continuam valendo. Excluir?' : 'Excluir esta pergunta?';
            if (!window.confirm(aviso)) return;
            ocupado(bt, true);
            chamar('excluirPergunta', { id: bt.getAttribute('data-id') }).then(function () { toast('Pergunta excluída.', 'ok'); recarregar(); }).catch(function (e) { ocupado(bt, false); falhou(e); });
          },
          copiarPrompt: function () { copiar(PROMPT_IA).then(function () { toast('Instrução copiada. Cole no Claude com o texto do documento.', 'ok'); }).catch(function () { location.hash = '#/lider/importar'; }); },
          'form:doc': function (f) {
            chamar('docRevisado', { codigo: f.codigo.value }).then(function (x) { toast(x.afetadas + ' perguntas saíram do ar para revisão.', 'ok'); recarregar(); }).catch(falhou);
          }
        });
      }
      desenhar();
    });
  }
  // Escrever ou corrigir uma pergunta. Pergunta já respondida não se edita, para não mudar o sentido das respostas.
  function telaEditarPergunta(id) {
    comDados('perguntasLider', {}, function (r) {
      var q = id ? r.sugestoes.concat(r.rascunhos, r.revisar, r.ativas).filter(function (x) { return x.id === id; })[0] : null;
      var voltar = '<a class="voltar" href="#/lider/perguntas">' + I('voltar', 20) + 'Perguntas</a>';
      if (id && !q) { telaErro('Pergunta não encontrada.', function () { location.hash = '#/lider/perguntas'; }); return; }
      if (q && q.respostas) {
        render(paginaSimples('<header class="cab-claro">' + voltar + '<h1 class="titulo">Editar pergunta</h1></header><main class="conteudo"><div class="resultado"><span class="circulo" style="background:var(--cinza-suave);color:var(--navy-2)">' + I('cadeado', 34) + '</span><h2>Já tem respostas</h2><p>Depois de respondida, a pergunta não pode mais mudar. Se precisar, exclua e crie outra.</p><a class="botao botao-contorno" href="#/lider/perguntas">Voltar</a></div></main>'));
        return;
      }
      var v = q || { categoria: 'aovivo', a: '', b: '', c: '', d: '', texto: '', correta: '', explicacao: '', fonte: '', trilha: '', ordem: '', abre_iso: '', fecha_iso: '' };
      function campoTexto(nome, rotulo, valor, classe, extra) { return '<div class="campo ' + (classe || '') + '"><label for="q-' + nome + '">' + esc(rotulo) + '</label><input id="q-' + nome + '" name="' + nome + '" class="entrada" value="' + esc(valor) + '" ' + (extra || '') + '></div>'; }
      var letra = v.tipo === 'palavra' ? '' : v.correta;
      var html = '<form class="secao" data-form="pergunta" style="gap:14px" novalidate>' +
        '<div class="campo"><label for="q-categoria">Onde entra</label><select id="q-categoria" name="categoria" class="entrada">' + CATEGORIAS.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === v.categoria ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div>' +
        campoTexto('trilha', 'Nome da trilha', v.trilha, 'so-trilha', 'list="trilhas-form"') + '<datalist id="trilhas-form">' + r.trilhas.map(function (t) { return '<option value="' + esc(t) + '">'; }).join('') + '</datalist>' +
        '<div class="grid2 so-semana">' + campoTexto('abre_em', 'Abre em', v.abre_iso, '', 'type="date"') + campoTexto('fecha_em', 'Fecha em', v.fecha_iso, '', 'type="date"') + '</div>' +
        '<div class="campo"><label for="q-texto">Pergunta</label><textarea id="q-texto" name="texto" class="entrada" rows="3" maxlength="500">' + esc(v.texto) + '</textarea></div>' +
        '<div class="secao so-multipla" style="gap:10px">' + ['a', 'b', 'c', 'd'].map(function (l) { return campoTexto(l, 'Alternativa ' + l.toUpperCase() + (l > 'b' ? ' (opcional)' : ''), v[l]); }).join('') +
        '<div class="campo"><label for="q-letra">Alternativa certa</label><select id="q-letra" name="letra" class="entrada"><option value="">Escolha</option>' + ['A', 'B', 'C', 'D'].map(function (l) { return '<option value="' + l + '"' + (l === letra ? ' selected' : '') + '>' + l + '</option>'; }).join('') + '</select></div></div>' +
        campoTexto('palavra', 'Palavra secreta', v.tipo === 'palavra' ? v.correta : '', 'so-palavra') +
        campoTexto('ordem', 'Ordem em que aparece', v.ordem, 'so-ordem', 'type="number" min="1" inputmode="numeric" placeholder="Deixe em branco para ir por último"') +
        '<div class="campo"><label for="q-explicacao">Explicação da resposta</label><textarea id="q-explicacao" name="explicacao" class="entrada" rows="2">' + esc(v.explicacao) + '</textarea></div>' +
        campoTexto('fonte', 'Fonte (documento, revisão e item)', v.fonte, '', 'placeholder="PRO-0412 rev. 4 item 5.1"') +
        '<p class="erro-campo" role="alert" id="erro-q"></p><button class="botao botao-grande" type="submit">Salvar pergunta</button>' +
        (q ? '' : '<p class="muted" style="text-align:center">Ela entra como rascunho e só vai ao ar quando você ativar.</p>') + '</form>';
      function ajustar(cat) {
        function mostrar(classe, sim) { $app.querySelectorAll('.' + classe).forEach(function (el) { el.style.display = sim ? '' : 'none'; }); }
        mostrar('so-trilha', cat === 'trilha');
        mostrar('so-semana', cat === 'semana');
        mostrar('so-multipla', cat !== 'desafio');
        mostrar('so-palavra', cat === 'desafio');
        mostrar('so-ordem', cat === 'trilha' || cat === 'aovivo');
      }
      render(paginaSimples('<header class="cab-claro">' + voltar + '<h1 class="titulo">' + (q ? 'Editar pergunta' : 'Nova pergunta') + '</h1></header><main class="conteudo">' + html + '</main>'), {
        'input:categoria': function (i) { ajustar(i.value); },
        'form:pergunta': function (f) {
          var erro = document.getElementById('erro-q');
          erro.textContent = '';
          ocupado(f.querySelector('[type=submit]'), true);
          var cat = f.categoria.value;
          chamar('salvarPergunta', {
            id: q ? q.id : '', categoria: cat, texto: f.texto.value, a: f.a.value, b: f.b.value, c: f.c.value, d: f.d.value,
            correta: cat === 'desafio' ? f.palavra.value : f.letra.value, trilha: f.trilha.value, ordem: f.ordem.value,
            abre_em: f.abre_em.value, fecha_em: f.fecha_em.value, explicacao: f.explicacao.value, fonte: f.fonte.value
          }).then(function () { toast(q ? 'Pergunta salva.' : 'Pergunta salva como rascunho.', 'ok'); location.hash = '#/lider/perguntas'; })
            .catch(function (e) { if (sessaoInvalida(e)) return; ocupado(f.querySelector('[type=submit]'), false); erro.textContent = e.message; });
        }
      });
      ajustar(v.categoria);
    });
  }
  function telaImportar() {
    render(paginaSimples('<header class="cab-claro"><a class="voltar" href="#/lider/perguntas">' + I('voltar', 20) + 'Perguntas</a><h1 class="titulo">Colar perguntas da IA</h1><p class="sub">Elas entram como rascunho para você revisar</p></header>' +
      '<main class="conteudo"><ol class="cartao" style="padding-left:34px;gap:6px;font-size:15px"><li>Copie a instrução abaixo.</li><li>No Claude, cole a instrução e o texto do PRO ou do manual.</li><li>Copie a resposta inteira e cole no campo de baixo.</li></ol>' +
      '<div class="campo"><label for="prompt">Instrução para a IA</label><textarea id="prompt" class="entrada" rows="6" readonly>' + esc(PROMPT_IA) + '</textarea><button type="button" class="botao botao-leve" data-acao="copiar">' + I('copiar', 18) + 'Copiar instrução</button></div>' +
      '<form class="campo" data-form="importar"><label for="json">Resposta da IA</label><textarea id="json" name="json" class="entrada" rows="8" placeholder="[{&quot;texto&quot;: ...}]"></textarea><p class="erro-campo" role="alert" id="erro-imp"></p><button class="botao botao-grande" type="submit">Importar perguntas</button></form></main>'), {
      copiar: function () { var t = document.getElementById('prompt'); t.select(); copiar(PROMPT_IA).then(function () { toast('Instrução copiada.', 'ok'); }).catch(function () { toast('Selecione o texto e copie manualmente.'); }); },
      'form:importar': function (f) {
        var txt = f.json.value, i = txt.indexOf('['), j = txt.lastIndexOf(']');
        var erro = document.getElementById('erro-imp');
        if (i < 0 || j < i) { erro.textContent = 'Não encontrei a lista de perguntas. Cole a resposta completa da IA, começando com [.'; return; }
        var lista;
        try { lista = JSON.parse(txt.slice(i, j + 1)); } catch (e) { erro.textContent = 'O texto colado não está no formato esperado. Peça à IA para responder só com o JSON.'; return; }
        ocupado(f.querySelector('[type=submit]'), true);
        chamar('importarPerguntas', { perguntas: lista }).then(function (x) {
          toast(x.importadas + (x.importadas === 1 ? ' pergunta importada' : ' perguntas importadas') + ' como rascunho.' + (x.erros.length ? ' ' + x.erros.length + ' com problema.' : ''), 'ok');
          location.hash = '#/lider/perguntas';
        }).catch(function (e) { ocupado(f.querySelector('[type=submit]'), false); erro.textContent = e.message; });
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Líder: Pit Stop na TV (apuração)
  // ---------------------------------------------------------------------------
  function telaApuracao() {
    comDados('previaApuracao', {}, function (r) {
      var n = Math.min(5, r.top, r.semana.length);
      var top = r.semana.slice(0, n);
      var passo = 0, publicado = false;
      function desenhar() {
        var final = passo >= n;
        var proximo = n - passo;
        var linhas = top.map(function (p, i) {
          var pos = i + 1;
          if (pos > n - passo) {
            return '<div class="tv-linha' + (pos === n - passo + 1 ? ' entra' : '') + (pos === 1 ? ' primeiro' : '') + '"><span class="tv-pos">' + p.pos + 'º</span>' + A(p.avatar, 44, true) + '<span class="tv-nome">' + esc(p.nome) + '</span><span class="tv-pts">' + p.pontos + ' <span style="font-family:var(--fonte);font-size:.55em;font-weight:500">pts</span></span></div>';
          }
          var prox = !final && pos === proximo;
          return '<div class="tv-linha oculta' + (prox ? ' pulso' : '') + '"><span class="tv-pos">' + pos + 'º</span><span class="avatar" style="width:44px;height:44px;background:rgba(255,255,255,.1);font-family:var(--fonte-num);font-size:24px;font-weight:700">?</span><span class="tv-nome" style="font-weight:500">' + (prox ? 'Próximo a ser revelado' : 'Aguardando') + '</span></div>';
        }).join('');
        if (!n) linhas = '<p class="tv-sub">Ninguém pontuou neste período ainda.</p>';
        var lado;
        if (!final) {
          lado = (r.pendentes && passo === 0 ? '<div class="tv-info" style="border-color:var(--pessego)">' + I('alerta', 28, '#FDBA74') + '<span style="font-size:18px">Ainda há ' + r.pendentes + ' entregas sem validar. <a href="#/lider/validar">Validar antes</a> para entrarem neste Pit Stop.</span></div>' : '') +
            '<div class="tv-cartao"><span class="tv-rot" style="color:var(--claro)">Próximo a revelar</span><span class="tv-grande pulso">' + proximo + 'º</span><span class="tv-sub">lugar</span><button type="button" class="botao tv-botao" data-acao="revelar" style="margin-top:14px">Revelar ' + proximo + 'º lugar</button><span class="tv-sub" style="font-size:14px;margin-top:6px">ou aperte a barra de espaço</span></div>';
        } else {
          var mc = r.meta_coletiva, lm = r.mes[0];
          lado = (top[0] ? '<div class="tv-destaque pop">' + A(top[0].avatar, 64) + '<div class="texto-flex"><span class="rotulo laranja" style="font-size:15px">Destaque da semana</span><span class="num" style="font-size:clamp(26px,3vw,36px)">' + esc(top[0].nome) + ' · ' + top[0].pontos + ' pts</span></div></div>' : '') +
            (r.evoluiu ? '<div class="tv-info pop" style="animation-delay:.2s">' + A(r.evoluiu.avatar, 56) + '<div class="texto-flex"><span class="rotulo verde" style="color:#86EFAC;font-size:15px">Quem mais evoluiu</span><span style="font-size:clamp(20px,2.2vw,26px);font-weight:700">' + esc(r.evoluiu.nome) + ' · +' + r.evoluiu.delta + ' pts</span></div></div>' : '') +
            '<div class="tv-info' + (mc.batida ? ' verde' : '') + ' pop" style="animation-delay:.4s"><span class="avatar" style="width:56px;height:56px;background:rgba(255,255,255,.18)">' + I('pessoas', 28, '#fff', 1.8) + '</span><div class="texto-flex"><span class="rotulo" style="color:#fff;font-size:15px">' + (mc.batida ? 'Meta coletiva batida' : 'Meta coletiva') + '</span><span style="font-size:clamp(18px,2vw,24px);font-weight:700">' + esc(mc.texto) + ' · ' + (mc.batida ? '+' + mc.bonus + ' pts para todos' : mc.atual + ' de ' + mc.total) + '</span></div></div>' +
            '<p class="tv-sub pop" style="animation-delay:.6s">' + (r.nivel_equipe ? 'Acelerador da equipe: <b style="color:#fff">' + esc(r.nivel_equipe.nome) + '</b>' : '') + (r.nivel_equipe && lm ? ' · ' : '') + (lm ? 'Líder do mês: <b style="color:#fff">' + esc(lm.nome) + '</b> · ' + lm.pontos + ' pts' : '') + '</p>' +
            '<div class="tv-acoes">' + (r.destaques && r.destaques.length ? '<button type="button" class="botao tv-botao" style="flex:1" data-acao="revelar">Destaques por atividade</button>' : (publicado ? '<span class="chip chip-verde" style="font-size:16px;padding:10px 16px">' + I('check', 18) + 'Publicado no app</span>' : '<button type="button" class="botao tv-botao" style="flex:1" data-acao="publicar">Publicar no app</button>')) +
            '<button type="button" class="botao botao-claro tv-botao" style="flex:1" data-acao="recomecar">Recomeçar</button></div>';
        }
        if (passo > n) {
          render('<div class="tv">' + confetes(12) + '<a class="tv-sair" href="#/lider/validar">Sair da TV</a>' +
            '<div class="tv-cab"><div style="display:flex;flex-direction:column;gap:6px"><span class="tv-rot">Pit Stop · ' + esc(r.equipe) + '</span><h1 class="tv-titulo">Destaques por atividade</h1><span class="tv-sub">Quem mais pontuou em cada atividade no período</span></div></div>' +
            '<div class="tv-selos">' + r.destaques.map(function (d, i) {
              return '<div class="tv-selo pop" style="animation-delay:' + (i * 0.12).toFixed(2) + 's"><span class="selo-medalha" style="background:#FDF3D0;color:#8A6100;width:52px;height:52px">' + I('estrela', 26) + '</span><div class="texto-flex"><span class="tv-selo-nome">' + esc(d.selo) + '</span><span class="tv-selo-pessoa">' + esc(d.pessoa.nome) + ' · ' + d.pessoa.pontos + ' pts</span><span class="tv-selo-ativ">' + esc(d.atividade) + '</span></div></div>';
            }).join('') + '</div>' +
            '<div class="tv-acoes" style="justify-content:flex-end">' + (publicado ? '<span class="chip chip-verde" style="font-size:16px;padding:10px 16px">' + I('check', 18) + 'Publicado no app</span>' : '<button type="button" class="botao tv-botao" style="width:auto;padding:0 28px" data-acao="publicar">Publicar no app</button>') +
            '<button type="button" class="botao botao-claro tv-botao" style="width:auto;padding:0 28px" data-acao="voltarPlacar">Voltar ao placar</button></div></div>', {
            publicar: publicar, voltarPlacar: function () { passo = n; desenhar(); }, recomecar: function () { passo = 0; desenhar(); }
          });
          return;
        }
        render('<div class="tv">' + (final && n ? confetes(16) : '') + '<a class="tv-sair" href="#/lider/validar">Sair da TV</a>' +
          '<div class="tv-cab"><div style="display:flex;flex-direction:column;gap:6px"><span class="tv-rot">Pit Stop · ' + esc(r.equipe) + '</span><h1 class="tv-titulo">Placar do período</h1><span class="tv-sub">' + esc(r.inicio_texto) + ' a ' + esc(r.fim_texto) + ' · entregas + quiz</span></div></div>' +
          '<div class="tv-grade"><div class="tv-lista">' + linhas + '</div><div class="tv-lado">' + lado + '</div></div></div>', {
          revelar: revelar,
          recomecar: function () { passo = 0; desenhar(); },
          publicar: publicar
        });
      }
      function publicar(b) {
        ocupado(b, true);
        chamar('fecharApuracao').then(function () { publicado = true; toast('Placar publicado. A equipe já vê o resultado no app.', 'ok'); desenhar(); }).catch(function (e) { ocupado(b, false); falhou(e); });
      }
      function revelar() { var max = n + (r.destaques && r.destaques.length ? 1 : 0); if (passo < max) { passo++; desenhar(); } }
      estado.teclas = function (e) {
        if (e.target && /^(BUTTON|INPUT|TEXTAREA|SELECT|A)$/.test(e.target.tagName)) return;
        if (e.key === ' ' || e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); revelar(); }
      };
      document.addEventListener('keydown', estado.teclas);
      desenhar();
    });
  }

  // ---------------------------------------------------------------------------
  // Líder: quiz ao vivo na TV
  // ---------------------------------------------------------------------------
  function telaAoVivoTV() {
    var ultimo = '', atual = null, verPlacar = '', podio = null;
    // Linhas do placar. No pódio, as posições aparecem de baixo para cima, até o 1º lugar.
    function linhasPlacar(lista, mais, deBaixoParaCima) {
      if (!lista.length) return '<p class="tv-pergunta" style="font-size:clamp(22px,3vw,34px);text-align:center">Ninguém pontuou ainda</p>';
      return '<div class="tv-lista">' + lista.map(function (p, i) {
        var atraso = deBaixoParaCima ? (lista.length - 1 - i) * 0.7 : i * 0.12;
        return '<div class="tv-linha entra' + (p.pos === 1 ? ' primeiro' : '') + '" style="animation-delay:' + atraso + 's"><span class="tv-pos">' + p.pos + 'º</span>' + A(p.avatar, 44) + '<span class="tv-nome">' + esc(p.nome) + '</span><span class="tv-pts">' + p.acertos + (p.acertos === 1 ? ' acerto' : ' acertos') + '</span></div>';
      }).join('') + (mais ? '<p class="tv-sub" style="text-align:center">+' + mais + ' empatados</p>' : '') + '</div>';
    }
    function desenharPodio() {
      render('<div class="tv">' + (podio.podio.length ? confetes(16) : '') + '<a class="tv-sair" href="#/lider/validar">Sair da TV</a><div class="tv-cab"><div style="display:flex;flex-direction:column;gap:6px"><span class="tv-rot">Quiz ao vivo · resultado final</span><h1 class="tv-titulo">Pódio do quiz</h1></div></div>' +
        '<div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:16px;width:100%;max-width:900px;margin:0 auto">' + linhasPlacar(podio.podio, podio.podio_mais, true) + '</div>' +
        '<div class="tv-rodape"><span>Os pontos já entraram no Placar da Oficina</span><div class="tv-acoes"><button type="button" class="botao tv-botao" style="width:auto;padding:0 28px" data-acao="fecharPodio">Concluir</button></div></div></div>', {
        fecharPodio: function () { podio = null; ultimo = ''; atualizar(); }
      });
    }
    function desenhar(r) {
      atual = r;
      if (podio) return;
      var k = JSON.stringify(r) + '|' + verPlacar;
      if (k === ultimo) return;
      ultimo = k;
      var html;
      if (!r.ativo) {
        html = '<div class="tv-cab"><div style="display:flex;flex-direction:column;gap:6px"><span class="tv-rot">Pit Stop</span><h1 class="tv-titulo">Quiz ao vivo</h1><span class="tv-sub">' + r.lista.length + ' perguntas prontas · ' + r.participantes + ' pessoas na equipe</span></div></div>' +
          '<div class="tv-cartao" style="flex:1;justify-content:center;max-width:900px;margin:0 auto;width:100%">' + I('vivo', 64, '#FDBA74', 1.6) +
          '<p class="tv-pergunta" style="font-size:clamp(24px,3vw,38px)">Peça para todos abrirem o app no celular: Quiz › Quiz ao vivo</p><p class="tv-sub">Todos respondem no próprio celular. Pontos só pelo acerto, sem bônus de velocidade.</p>' +
          (r.lista.length ? '<button type="button" class="botao tv-botao" style="max-width:420px;margin-top:16px" data-acao="iniciar">Iniciar quiz ao vivo</button>' : '<p class="tv-sub" style="color:var(--pessego)">Ainda não há perguntas na categoria Quiz ao vivo. Cadastre em Perguntas.</p>') + '</div>';
      } else if (!r.pergunta) {
        html = '<div class="tv-cartao" style="flex:1;justify-content:center"><span class="giro"></span><p class="tv-sub">Carregando a pergunta…</p></div>';
      } else if (r.revelada && verPlacar === r.pergunta.id) {
        html = '<div class="tv-cab"><div style="display:flex;flex-direction:column;gap:6px"><span class="tv-rot">Quiz ao vivo · pergunta ' + r.indice + ' de ' + r.total + '</span><h1 class="tv-titulo">Placar do quiz</h1></div></div>' +
          '<div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:16px;width:100%;max-width:900px;margin:0 auto">' + linhasPlacar(r.placar, r.placar_mais, false) + '</div>' +
          '<div class="tv-rodape"><span>Só o acerto conta, sem bônus de velocidade</span><div class="tv-acoes">' +
          (r.proxima_id ? '<button type="button" class="botao tv-botao" style="width:auto;padding:0 28px" data-acao="proxima">Próxima pergunta</button><button type="button" class="botao botao-claro tv-botao" style="width:auto;padding:0 28px" data-acao="encerrar">Encerrar quiz</button>' : '<button type="button" class="botao tv-botao" style="width:auto;padding:0 28px" data-acao="encerrar">Ver pódio final</button>') +
          '</div></div>';
      } else {
        var q = r.pergunta, tot = Math.max(1, r.respostas);
        var opcoes = q.alternativas.map(function (a) {
          var certa = a.letra === q.correta, cnt = r.distribuicao[a.letra] || 0, pct = Math.round(cnt / tot * 100);
          var cls = r.revelada ? (certa ? ' certa' : ' apagada') : '';
          return '<div class="tv-opcao' + cls + '"><div style="display:flex;align-items:center;gap:18px"><span class="tv-letra">' + a.letra + '</span><span class="tv-alt" style="flex:1">' + esc(a.texto) + '</span>' + (r.revelada && certa ? I('check', 40, '#fff', 2.6) : '') + '</div>' +
            (r.revelada ? '<div style="display:flex;align-items:center;gap:14px"><div style="flex:1;height:14px;border-radius:7px;background:rgba(255,255,255,.15);overflow:hidden"><div class="cresce" style="height:14px;border-radius:7px;width:' + Math.max(pct, 2) + '%;background:' + (certa ? '#fff' : 'var(--claro)') + '"></div></div><span style="width:210px;text-align:right;font-size:19px;font-weight:600">' + cnt + (cnt === 1 ? ' resposta' : ' respostas') + ' · ' + pct + '%</span></div>' : '') + '</div>';
        }).join('');
        var rodape = r.revelada
          ? '<span class="subir" style="display:flex;align-items:center;gap:10px">' + I('doc', 26, '#FDBA74', 1.8) + 'Fonte: ' + esc(q.fonte || '—') + ' · ' + r.acertos + ' de ' + r.respostas + ' acertaram</span>'
          : '<span style="display:flex;gap:22px;flex-wrap:wrap"><span>' + r.respostas + ' de ' + r.participantes + ' responderam</span><span>Pontos só pelo acerto, sem bônus de velocidade</span></span>';
        var botoes = r.revelada
          ? '<button type="button" class="botao tv-botao" style="width:auto;padding:0 28px" data-acao="verPlacar">Ver placar</button>'
          : '<button type="button" class="botao tv-botao" style="width:auto;padding:0 28px" data-acao="revelar">Mostrar resposta</button>';
        html = '<div class="tv-cab" style="align-items:center"><div style="display:flex;align-items:center;gap:14px"><span class="chip" style="background:var(--laranja);color:#fff;font-size:16px;padding:8px 14px;letter-spacing:1px;text-transform:uppercase">Quiz ao vivo</span><span class="tv-sub">Pergunta ' + r.indice + ' de ' + r.total + '</span></div></div>' +
          '<h1 class="tv-pergunta">' + esc(q.texto) + '</h1><div class="tv-opcoes">' + opcoes + '</div><div class="tv-rodape">' + rodape + '<div class="tv-acoes">' + botoes + '</div></div>';
      }
      render('<div class="tv"><a class="tv-sair" href="#/lider/validar">Sair da TV</a>' + html + '</div>', {
        iniciar: function (b) { ocupado(b, true); chamar('aoVivoIniciar').then(atualizar).catch(function (e) { ocupado(b, false); falhou(e); }); },
        revelar: function (b) { ocupado(b, true); chamar('aoVivoRevelar').then(atualizar).catch(falhou); },
        proxima: function (b) { ocupado(b, true); chamar('aoVivoAbrir', { pergunta_id: atual.proxima_id }).then(atualizar).catch(falhou); },
        verPlacar: function () { verPlacar = atual.pergunta.id; desenhar(atual); },
        encerrar: function (b) { ocupado(b, true); chamar('aoVivoEncerrar').then(function (x) { podio = x; verPlacar = ''; desenharPodio(); }).catch(falhou); }
      });
    }
    function atualizar() { return chamar('aoVivoPainel').then(desenhar).catch(function (e) { if (!sessaoInvalida(e) && !atual) telaErro(e.message, telaAoVivoTV); }); }
    carregando();
    atualizar();
    consultarSempre(atualizar, 2500, 4000);
  }

  // ---------------------------------------------------------------------------
  // Líder: ajustes
  // ---------------------------------------------------------------------------
  function telaConfig() {
    comDados('configLider', {}, function (r) {
      var grupos = [], porGrupo = {};
      var grupoAdmin = {};
      r.campos.forEach(function (c) { if (!porGrupo[c.grupo]) { porGrupo[c.grupo] = []; grupos.push(c.grupo); } porGrupo[c.grupo].push(c); if (c.admin) grupoAdmin[c.grupo] = true; });
      function controle(c) {
        var v = r.valores[c.chave], id = 'cfg-' + c.chave;
        if (c.tipo === 'simnao') return '<label class="interruptor"><input type="checkbox" role="switch" id="' + id + '" name="' + c.chave + '"' + (/^(sim|s|true|1)$/i.test(String(v)) ? ' checked' : '') + '><span></span></label>';
        if (c.tipo === 'dia') return '<select id="' + id + '" name="' + c.chave + '" class="entrada" style="width:140px">' + DIAS.map(function (d, i) { return '<option value="' + i + '"' + (String(i) === String(v) ? ' selected' : '') + '>' + d + '</option>'; }).join('') + '</select>';
        if (c.tipo === 'hora') return '<input id="' + id + '" name="' + c.chave + '" type="time" class="entrada" style="width:120px" value="' + esc(v) + '">';
        if (c.tipo === 'data') return '<input id="' + id + '" name="' + c.chave + '" type="date" class="entrada" style="width:160px" value="' + esc(v) + '">';
        if (c.tipo === 'numero') return '<input id="' + id + '" name="' + c.chave + '" type="number" inputmode="numeric" min="0" class="entrada" style="width:96px" value="' + esc(v) + '">';
        return '<input id="' + id + '" name="' + c.chave + '" class="entrada" value="' + esc(v) + '">';
      }
      var form = '<form class="secao" data-form="config" style="gap:18px">' + grupos.map(function (g) {
        return '<section class="secao"><h2 class="h2">' + esc(g) + (grupoAdmin[g] ? ' <span class="chip chip-escuro" style="vertical-align:middle">Administrador</span>' : '') + '</h2><div class="lista">' + porGrupo[g].map(function (c) {
          return c.tipo === 'texto' ? '<div class="item" style="flex-direction:column;align-items:stretch;gap:6px"><label for="cfg-' + c.chave + '" style="font-size:15px">' + esc(c.rotulo) + '</label>' + controle(c) + '</div>'
            : '<div class="item"><label for="cfg-' + c.chave + '" style="flex:1;font-size:15px">' + esc(c.rotulo) + '</label>' + controle(c) + '</div>';
        }).join('') + '</div></section>';
      }).join('') + '<button class="botao botao-grande" type="submit">Salvar ajustes</button></form>';
      var mc = r.meta_coletiva;
      var meta = '<form class="cartao" data-form="meta"><h2 class="h2">Meta coletiva</h2><p class="muted" style="font-size:14px">Quando a equipe bater a meta, todos ganham +' + mc.bonus + ' pts e a pergunta secreta é liberada.' + (mc.batida ? ' <b style="color:var(--verde)">Meta atual já foi batida.</b>' : '') + '</p>' +
        '<div class="campo"><label for="mt">Meta</label><input id="mt" name="texto" class="entrada" value="' + esc(mc.texto) + '"></div><div class="grid2"><div class="campo"><label for="ma">Já atingido</label><input id="ma" name="atual" type="number" min="0" class="entrada" value="' + mc.atual + '"></div><div class="campo"><label for="mtot">Total</label><input id="mtot" name="total" type="number" min="1" class="entrada" value="' + mc.total + '"></div></div>' +
        '<button class="botao botao-verde" type="submit">Atualizar meta</button></form>';
      function atalho(href, icone, titulo, sub) { return '<a class="cartao linha-flex" href="' + href + '" style="text-decoration:none;color:inherit"><span class="icone-q">' + I(icone, 22) + '</span><span class="texto-flex"><span class="nome">' + esc(titulo) + '</span><span class="muted">' + esc(sub) + '</span></span>' + I('seta', 22) + '</a>'; }
      var atalhos = atalho('#/lider/entregas', 'marcar', 'Entregas, pontos e selos', 'Cadastrar, ajustar e liberar para a equipe') + atalho('#/lider/janelas', 'relogio', 'Janelas de registro', 'Horários em que a equipe pode marcar');
      var mural = '<form class="cartao" data-form="mural"><h2 class="h2">Mural de avisos</h2><p class="muted" style="font-size:14px">O aviso aparece na tela inicial de todos, até você trocar ou apagar.</p><div class="campo"><label for="mural">Aviso</label><textarea id="mural" name="texto" class="entrada" rows="3" maxlength="300">' + esc(r.mural) + '</textarea></div>' +
        '<div class="botoes">' + (r.mural ? '<button type="button" class="botao botao-leve" data-acao="limparMural">Apagar aviso</button>' : '') + '<button class="botao" type="submit">Publicar aviso</button></div></form>';
      var ativos = r.pessoas.filter(function (p) { return p.ativo; }).length;
      var equipe = '<a class="cartao linha-flex" href="#/lider/equipe" style="text-decoration:none;color:inherit"><span class="icone-q">' + I('pessoas', 22) + '</span><span class="texto-flex"><span class="nome">Equipe</span><span class="muted">' + ativos + (ativos === 1 ? ' pessoa ativa' : ' pessoas ativas') + ' · cadastrar, editar e gerar PIN</span></span>' + I('seta', 22) + '</a>';
      var fim = '<section class="secao"><a class="botao botao-leve" href="#/inicio">Ver o app como a equipe</a><button type="button" class="botao botao-leve" data-acao="sair">' + I('sair', 20) + 'Sair do app</button>' +
        (Api.demo ? '<button type="button" class="botao botao-leve" data-acao="reiniciarDemo">Recomeçar a demonstração</button>' : '') + '</section>';
      render(paginaLider('lider/config', cabLider('Ajustes', 'Regras, metas e módulos', 'ajustes') + '<main class="conteudo" style="gap:22px">' + equipe + atalhos + mural + meta + form + fim + '</main>'), {
        'form:mural': function (f) {
          ocupado(f.querySelector('[type=submit]'), true);
          chamar('salvarMural', { texto: f.texto.value }).then(function () { toast(f.texto.value.trim() ? 'Aviso publicado.' : 'Aviso apagado.', 'ok'); telaConfig(); }).catch(function (e) { ocupado(f.querySelector('[type=submit]'), false); falhou(e); });
        },
        limparMural: function (b) {
          ocupado(b, true);
          chamar('salvarMural', { texto: '' }).then(function () { toast('Aviso apagado.', 'ok'); telaConfig(); }).catch(function (e) { ocupado(b, false); falhou(e); });
        },
        'form:config': function (f) {
          var valores = {};
          r.campos.forEach(function (c) { var el = f.elements[c.chave]; if (!el) return; valores[c.chave] = c.tipo === 'simnao' ? (el.checked ? 'sim' : 'nao') : el.value; });
          ocupado(f.querySelector('[type=submit]'), true);
          chamar('salvarConfig', { valores: valores }).then(function () { return chamar('entrar'); }).then(function (x) {
            atualizarSessao({ modulos: x.modulos });
            toast('Ajustes salvos.', 'ok');
            telaConfig();
          }).catch(function (e) { ocupado(f.querySelector('[type=submit]'), false); falhou(e); });
        },
        'form:meta': function (f) {
          ocupado(f.querySelector('[type=submit]'), true);
          chamar('metaColetiva', { texto: f.texto.value, atual: f.atual.value, total: f.total.value }).then(function (x) {
            toast(x.bonus_dado ? 'Meta batida! Todos ganharam +' + x.meta.bonus + ' pts.' : 'Meta atualizada.', 'ok');
            telaConfig();
          }).catch(function (e) { ocupado(f.querySelector('[type=submit]'), false); falhou(e); });
        }
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Líder: cadastro da equipe
  // ---------------------------------------------------------------------------
  function telaEquipe(_, aviso) {
    comDados('equipeLider', {}, function (r) {
      function opcoesTurno(sel) {
        if (!r.turnos.length) return '<option value="">(sem turnos)</option>';
        return r.turnos.map(function (t) { return '<option value="' + esc(t) + '"' + (t === sel ? ' selected' : '') + '>Turno ' + esc(t) + '</option>'; }).join('');
      }
      function opcoesPapel(sel) {
        return '<option value="equipe"' + (sel === 'equipe' ? ' selected' : '') + '>Equipe</option><option value="lider"' + (sel === 'lider' ? ' selected' : '') + '>Líder</option>' + (r.eu_admin ? '<option value="admin"' + (sel === 'admin' ? ' selected' : '') + '>Administrador</option>' : '');
      }
      function cargo(p) { return p.admin ? 'admin' : p.papel; }
      var blocos = [];
      if (aviso && aviso.pin) {
        blocos.push('<div class="cartao-verde" style="flex-direction:column;align-items:stretch;gap:10px" role="status">' +
          '<span class="rotulo verde">' + (aviso.novo ? 'Cadastro feito' : 'PIN novo gerado') + '</span>' +
          '<span class="nome">Acesso de ' + esc(aviso.nome) + '</span>' +
          '<span class="rotulo">Código</span><span class="codigo-acesso" style="font-size:36px;font-weight:700;letter-spacing:8px">' + esc(aviso.codigo) + '</span>' +
          '<span class="rotulo">PIN</span><span class="num" style="font-size:44px;letter-spacing:10px">' + esc(aviso.pin) + '</span>' +
          '<span style="font-size:14px">Anote e entregue só para a pessoa. Por segurança, este PIN não aparece de novo. Se ela esquecer, gere outro aqui.</span>' +
          '<button type="button" class="botao botao-verde" data-acao="anotei">Pronto, anotei</button></div>');
      }
      blocos.push('<form class="cartao" data-form="nova" style="gap:12px"><h2 class="h2">Cadastrar pessoa</h2>' +
        '<div class="campo"><label for="np-nome">Nome que aparece no app</label><input id="np-nome" name="nome" class="entrada" maxlength="40" autocomplete="off" required></div>' +
        '<div class="grid2"><div class="campo"><label for="np-turno">Turno</label><select id="np-turno" name="turno" class="entrada">' + opcoesTurno(r.turnos[0]) + '</select></div>' +
        '<div class="campo"><label for="np-papel">Papel</label><select id="np-papel" name="papel" class="entrada">' + opcoesPapel('equipe') + '</select></div></div>' +
        '<button class="botao" type="submit">Cadastrar e gerar PIN</button></form>');
      var ativos = r.pessoas.filter(function (p) { return p.ativo; }).length;
      blocos.push('<section class="secao"><h2 class="h2">Pessoas · ' + ativos + (ativos === 1 ? ' ativa' : ' ativas') + '</h2>' + r.pessoas.map(function (p) {
        var chips = (p.papel === 'lider' ? '<span class="chip chip-escuro">' + (p.admin ? 'Administrador' : 'Líder') + '</span>' : '<span class="chip chip-cinza">Turno ' + esc(p.turno || '–') + '</span>') +
          '<span class="chip chip-cinza">Código ' + esc(p.codigo || '–') + '</span>' +
          (p.voce ? '<span class="chip chip-azul">Você</span>' : '') + (p.ativo ? '' : '<span class="chip chip-vermelho">Desativada</span>') +
          (p.bloqueado ? '<span class="chip chip-vermelho">Travada</span>' : '');
        return '<details class="cartao"' + (p.ativo ? '' : ' style="opacity:.75"') + '><summary style="gap:10px">' + A(p.avatar, 36) + '<span class="texto-flex"><span class="nome">' + esc(p.nome) + '</span><span style="display:flex;gap:6px;flex-wrap:wrap">' + chips + '</span></span></summary>' +
          (p.admin && !r.eu_admin ? '<p class="muted" style="margin-top:12px;font-size:14px">Só o Administrador pode alterar este cadastro.</p></details>' : '<form data-form="pessoa" data-id="' + esc(p.id) + '" style="display:flex;flex-direction:column;gap:12px;margin-top:12px">' +
          '<div class="campo"><label for="pn-' + esc(p.id) + '">Nome</label><input id="pn-' + esc(p.id) + '" name="nome" class="entrada" maxlength="40" value="' + esc(p.nome) + '" required></div>' +
          '<div class="grid2"><div class="campo"><label for="pt-' + esc(p.id) + '">Turno</label><select id="pt-' + esc(p.id) + '" name="turno" class="entrada">' + opcoesTurno(p.turno) + '</select></div>' +
          '<div class="campo"><label for="pp-' + esc(p.id) + '">Papel</label><select id="pp-' + esc(p.id) + '" name="papel" class="entrada"' + (p.voce ? ' disabled' : '') + '>' + opcoesPapel(cargo(p)) + '</select></div></div>' +
          '<div class="item" style="padding:0;min-height:44px"><label for="pa-' + esc(p.id) + '" style="flex:1;font-size:15px">Ativa no app</label><label class="interruptor"><input type="checkbox" role="switch" id="pa-' + esc(p.id) + '" name="ativo"' + (p.ativo ? ' checked' : '') + (p.voce ? ' disabled' : '') + '><span></span></label></div>' +
          (p.voce ? '<p class="muted" style="font-size:13px">Você não pode desativar o seu cadastro nem deixar de ser líder.</p>' : '') +
          '<div class="grid2"><button class="botao" type="submit">Salvar</button><button type="button" class="botao botao-contorno" data-acao="novoPin" data-id="' + esc(p.id) + '">Gerar novo PIN</button></div>' +
          '</form></details>');
      }).join('') + '</section>');
      blocos.push('<p class="muted" style="font-size:14px">Ninguém é excluído. Quem sai da equipe fica desativado: some do app, e o histórico continua guardado para os dados do TCC.</p>' +
        '<a class="botao botao-leve" href="#/lider/config">' + I('voltar', 20) + 'Voltar aos ajustes</a>');
      render(paginaLider('lider/config', cabLider('Equipe', 'Cadastro, turno e PIN', 'pessoas') + '<main class="conteudo" style="gap:18px">' + blocos.join('') + '</main>'), {
        anotei: function () { telaEquipe(); },
        'form:nova': function (f) {
          ocupado(f.querySelector('[type=submit]'), true);
          chamar('salvarPessoa', { nome: f.nome.value, turno: f.turno.value, papel: f.papel.value }).then(function (x) {
            telaEquipe('', { novo: true, nome: x.nome, pin: x.pin, codigo: x.codigo });
          }).catch(function (e) { ocupado(f.querySelector('[type=submit]'), false); falhou(e); });
        },
        'form:pessoa': function (f) {
          var id = f.getAttribute('data-id');
          var p = r.pessoas.filter(function (x) { return x.id === id; })[0] || {};
          ocupado(f.querySelector('[type=submit]'), true);
          chamar('salvarPessoa', { id: id, nome: f.nome.value, turno: f.turno.value, papel: p.voce ? cargo(p) : f.papel.value, ativo: p.voce ? 'sim' : (f.ativo.checked ? 'sim' : 'nao') }).then(function () {
            toast('Cadastro salvo.', 'ok');
            telaEquipe();
          }).catch(function (e) { ocupado(f.querySelector('[type=submit]'), false); falhou(e); });
        },
        novoPin: function (b) {
          ocupado(b, true);
          chamar('novoPin', { id: b.getAttribute('data-id') }).then(function (x) {
            if (x.proprio) atualizarSessao({ pin: x.pin, codigo: x.codigo });
            telaEquipe('', { nome: x.nome, pin: x.pin, codigo: x.codigo });
          }).catch(function (e) { ocupado(b, false); falhou(e); });
        }
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Líder: janelas de registro
  // ---------------------------------------------------------------------------
  function telaJanelas() {
    comDados('janelasLider', {}, function (r) {
      function formTurno(t, chave) {
        var faixas = t ? t.faixas.slice() : [];
        while (faixas.length < 3) faixas.push({ ini: '', fim: '' });
        return '<form class="secao" data-form="turno" data-antigo="' + esc(t ? t.turno : '') + '" style="gap:12px;margin-top:12px">' +
          '<div class="campo"><label for="tn-' + chave + '">Nome do turno</label><input id="tn-' + chave + '" name="turno" class="entrada" maxlength="20" value="' + esc(t ? t.turno : '') + '"></div>' +
          faixas.map(function (f, i) {
            return '<div class="grid2"><div class="campo"><label for="ti-' + chave + i + '">Janela ' + (i + 1) + ': início</label><input id="ti-' + chave + i + '" data-faixa="ini" type="time" class="entrada" value="' + esc(f.ini) + '"></div><div class="campo"><label for="tf-' + chave + i + '">Fim</label><input id="tf-' + chave + i + '" data-faixa="fim" type="time" class="entrada" value="' + esc(f.fim) + '"></div></div>';
          }).join('') +
          '<div class="botoes">' + (t ? '<button type="button" class="botao botao-leve" data-acao="removerTurno" data-t="' + esc(t.turno) + '">Remover</button>' : '') + '<button class="botao" type="submit">' + (t ? 'Salvar' : 'Adicionar turno') + '</button></div></form>';
      }
      var html = '<p class="muted" style="font-size:14px">A equipe só consegue marcar entregas e responder ao quiz dentro destes horários. Janela que passa da meia-noite é aceita. Deixe em branco as que não usar.</p>' +
        r.turnos.map(function (t, i) {
          return '<details class="cartao"' + (r.turnos.length === 1 ? ' open' : '') + '><summary style="gap:10px"><span class="texto-flex"><span class="nome">Turno ' + esc(t.turno) + '</span><span class="muted">' + esc(t.faixas.map(function (f) { return f.ini + '–' + f.fim; }).join(' e ') || 'Sem janelas') + ' · ' + t.pessoas + (t.pessoas === 1 ? ' pessoa' : ' pessoas') + '</span></span></summary>' + formTurno(t, 't' + i) + '</details>';
        }).join('') +
        '<details class="cartao"><summary><span class="nome">Adicionar turno</span></summary>' + formTurno(null, 'novo') + '</details>' +
        '<a class="botao botao-leve" href="#/lider/config">' + I('voltar', 20) + 'Voltar aos ajustes</a>';
      render(paginaLider('lider/config', cabLider('Janelas', 'Horários de registro por turno', 'relogio') + '<main class="conteudo" style="gap:14px">' + html + '</main>'), {
        'form:turno': function (f) {
          var inis = f.querySelectorAll('[data-faixa="ini"]'), fins = f.querySelectorAll('[data-faixa="fim"]'), faixas = [];
          for (var i = 0; i < inis.length; i++) faixas.push({ ini: inis[i].value, fim: fins[i].value });
          ocupado(f.querySelector('[type=submit]'), true);
          chamar('salvarTurno', { antigo: f.getAttribute('data-antigo'), turno: f.turno.value, faixas: faixas }).then(function () { toast('Janelas salvas.', 'ok'); telaJanelas(); }).catch(function (e) { ocupado(f.querySelector('[type=submit]'), false); falhou(e); });
        },
        removerTurno: function (b) {
          if (!window.confirm('Remover este turno?')) return;
          ocupado(b, true);
          chamar('removerTurno', { turno: b.getAttribute('data-t') }).then(function () { toast('Turno removido.', 'ok'); telaJanelas(); }).catch(function (e) { ocupado(b, false); falhou(e); });
        }
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Líder: entregas, pontos e selos
  // ---------------------------------------------------------------------------
  function telaEntregas() {
    comDados('entregasLider', {}, function (r) {
      function chave(c, nome, rotulo, ligado) { return '<div class="item" style="padding:0;min-height:44px"><label for="' + nome + '-' + c + '" style="flex:1;font-size:15px">' + esc(rotulo) + '</label><label class="interruptor"><input type="checkbox" role="switch" id="' + nome + '-' + c + '" name="' + nome + '"' + (ligado ? ' checked' : '') + '><span></span></label></div>'; }
      function formEntrega(e, c) {
        var v = e || { nome: '', categoria: '', pontos: 5, referencia: 'nao', dica_ref: '', ref_unica: false, sorteavel: false, max_por_dia: 0, selo: '', ativo: false, formato: { tipo: 'livre', min: '', max: '' } };
        var refs = [['nao', 'Não pede'], ['opcional', 'Opcional'], ['obrigatoria', 'Obrigatório']];
        var formato = !r.admin ? '' :
          '<div class="campo"><label for="fm-' + c + '">Formato do número <span class="chip chip-escuro">Administrador</span></label><select id="fm-' + c + '" name="formato" class="entrada"><option value="livre"' + (v.formato.tipo === 'livre' ? ' selected' : '') + '>Livre</option><option value="numeros"' + (v.formato.tipo === 'numeros' ? ' selected' : '') + '>Somente números</option>' + (v.formato.tipo === 'personalizado' ? '<option value="personalizado" selected>Personalizado (mantido)</option>' : '') + '</select></div>' +
          '<div class="grid2"><div class="campo"><label for="fa-' + c + '">Mínimo de dígitos</label><input id="fa-' + c + '" name="fmin" type="number" min="1" max="20" class="entrada" value="' + esc(v.formato.min) + '"></div><div class="campo"><label for="fb-' + c + '">Máximo de dígitos</label><input id="fb-' + c + '" name="fmax" type="number" min="1" max="20" class="entrada" value="' + esc(v.formato.max) + '"></div></div>';
        return '<form data-form="entrega" data-id="' + esc(e ? e.id : '') + '" style="display:flex;flex-direction:column;gap:12px;margin-top:12px">' +
          '<div class="campo"><label for="en-' + c + '">Nome da entrega</label><input id="en-' + c + '" name="nome" class="entrada" maxlength="60" value="' + esc(v.nome) + '"></div>' +
          '<div class="grid2"><div class="campo"><label for="ec-' + c + '">Categoria</label><input id="ec-' + c + '" name="categoria" class="entrada" placeholder="Qualidade" value="' + esc(v.categoria) + '"></div><div class="campo"><label for="ep-' + c + '">Pontos</label><input id="ep-' + c + '" name="pontos" type="number" min="0" max="1000" inputmode="numeric" class="entrada" value="' + v.pontos + '"></div></div>' +
          '<div class="grid2"><div class="campo"><label for="er-' + c + '">Número de referência</label><select id="er-' + c + '" name="referencia" class="entrada">' + refs.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === v.referencia ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div><div class="campo"><label for="em-' + c + '">Máximo por dia (0 = sem limite)</label><input id="em-' + c + '" name="max_por_dia" type="number" min="0" max="20" inputmode="numeric" class="entrada" value="' + v.max_por_dia + '"></div></div>' +
          '<div class="campo"><label for="ed-' + c + '">Dica para o número</label><input id="ed-' + c + '" name="dica_ref" class="entrada" placeholder="nº da RAF, ex.: 0457" value="' + esc(v.dica_ref) + '"></div>' +
          '<div class="campo"><label for="es-' + c + '">Selo (em branco: não dá selo)</label><input id="es-' + c + '" name="selo" class="entrada" list="selos-form" value="' + esc(v.selo) + '"></div>' + formato +
          chave(c, 'sorteavel', 'Pode cair no sorteio de conferência', v.sorteavel) + chave(c, 'ref_unica', 'Avisar se o número se repetir entre pessoas', v.ref_unica) + chave(c, 'ativo', 'Disponível para a equipe', v.ativo) +
          '<button class="botao" type="submit">' + (e ? 'Salvar entrega' : 'Cadastrar entrega') + '</button></form>';
      }
      var html = '<p class="muted" style="font-size:14px">Mudar os pontos vale só para as próximas validações. Para retirar uma entrega, deixe-a indisponível.</p>' +
        '<datalist id="selos-form">' + r.selos.map(function (s) { return '<option value="' + esc(s) + '">'; }).join('') + '</datalist>' +
        '<details class="cartao"><summary><span class="nome">Cadastrar nova entrega</span></summary>' + formEntrega(null, 'nova') + '<p class="muted" style="font-size:13px;margin-top:8px">Ela fica indisponível até você ligar a opção acima.</p></details>' +
        '<section class="secao"><h2 class="h2">Entregas · ' + r.entregas.length + '</h2>' + r.entregas.map(function (e, i) {
          return '<details class="cartao"' + (e.ativo ? '' : ' style="opacity:.75"') + '><summary style="gap:10px"><span class="texto-flex"><span class="nome">' + esc(e.nome) + '</span><span style="display:flex;gap:6px;flex-wrap:wrap"><span class="chip chip-laranja">+' + e.pontos + ' pts</span>' + (e.selo ? '<span class="chip chip-cinza">' + esc(e.selo) + '</span>' : '') + (e.ativo ? '' : '<span class="chip chip-vermelho">Indisponível</span>') + '</span></span></summary>' + formEntrega(e, 'e' + i) + '</details>';
        }).join('') + '</section>' +
        '<a class="botao botao-leve" href="#/lider/config">' + I('voltar', 20) + 'Voltar aos ajustes</a>';
      render(paginaLider('lider/config', cabLider('Entregas', 'Entregas, pontos e selos', 'marcar') + '<main class="conteudo" style="gap:14px">' + html + '</main>'), {
        'form:entrega': function (f) {
          var dados = { id: f.getAttribute('data-id'), nome: f.nome.value, categoria: f.categoria.value, pontos: f.pontos.value, referencia: f.referencia.value, dica_ref: f.dica_ref.value, max_por_dia: f.max_por_dia.value, selo: f.selo.value, sorteavel: f.sorteavel.checked ? 'sim' : 'nao', ref_unica: f.ref_unica.checked ? 'sim' : 'nao', ativo: f.ativo.checked ? 'sim' : 'nao' };
          if (f.formato) dados.formato = { tipo: f.formato.value, min: f.fmin.value, max: f.fmax.value };
          ocupado(f.querySelector('[type=submit]'), true);
          chamar('salvarEntrega', dados).then(function () { toast('Entrega salva.', 'ok'); telaEntregas(); }).catch(function (e) { ocupado(f.querySelector('[type=submit]'), false); falhou(e); });
        }
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Início do app
  // ---------------------------------------------------------------------------
  window.addEventListener('hashchange', navegar);
  navegar();
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(function () { /* sem cache offline */ });
  }
})();
