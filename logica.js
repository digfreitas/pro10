/*
 * Pro10 — regras do aplicativo (pontos, janelas, sorteio, quiz, apuração).
 *
 * Este mesmo arquivo roda em dois lugares:
 *   1. no navegador, quando o app está em modo demonstração (dados de exemplo no celular);
 *   2. no Google Apps Script, colado num arquivo chamado Logica.gs (dados na planilha).
 * Assim as regras são sempre as mesmas nos dois modos.
 */
var Logica = (function () {
  'use strict';

  var VERSAO = '1.0.0';
  var DIA = 86400000;
  var MIN = 60000;

  // ---------------------------------------------------------------------------
  // Estrutura das tabelas (abas da planilha)
  // ---------------------------------------------------------------------------
  var TABELAS = {
    Config: ['chave', 'valor', 'descricao'],
    Turnos: ['turno', 'janelas'],
    Pessoas: ['id', 'nome', 'turno', 'papel', 'pin', 'avatar', 'ativo', 'codigo', 'erros_pin', 'bloqueado_ate'],
    TiposEntrega: ['id', 'nome', 'categoria', 'pontos', 'referencia', 'formato_ref', 'dica_ref', 'ref_unica', 'sorteavel', 'max_por_dia', 'selo', 'ativo'],
    Registros: ['id', 'pessoa_id', 'tipo_id', 'data_execucao', 'criado_em', 'referencia', 'status', 'pontos', 'atrasada', 'sorteada', 'conferencia', 'alerta', 'validado_em', 'validado_por', 'celebrado', 'obs'],
    Perguntas: ['id', 'categoria', 'tipo', 'texto', 'a', 'b', 'c', 'd', 'correta', 'explicacao', 'fonte', 'trilha', 'ordem', 'abre_em', 'fecha_em', 'pontos', 'status', 'autor_id', 'criado_em'],
    Respostas: ['id', 'pessoa_id', 'pergunta_id', 'resposta', 'correta', 'pontos', 'modo', 'criado_em'],
    Apuracoes: ['id', 'inicio', 'fim', 'ranking', 'evoluiu', 'criado_por'],
    AoVivo: ['id', 'sessao', 'pergunta_id', 'pessoa_id', 'resposta', 'correta', 'pontos', 'criado_em']
  };

  // Campos guardados como data na planilha e campos que precisam ficar como texto
  var CAMPOS_DATA = { data_execucao: 1, criado_em: 1, validado_em: 1, abre_em: 1, fecha_em: 1, inicio: 1, fim: 1, bloqueado_ate: 1 };
  var CAMPOS_TEXTO = { id: 1, pin: 1, codigo: 1, referencia: 1, resposta: 1, correta: 1, pessoa_id: 1, tipo_id: 1, pergunta_id: 1, autor_id: 1, validado_por: 1, criado_por: 1, sessao: 1, turno: 1, chave: 1, valor: 1, formato_ref: 1, janelas: 1, ranking: 1, evoluiu: 1 };

  var AVATARES = ['rodeiro', 'capacete', 'engrenagem', 'chave', 'raio', 'lupa', 'locomotiva', 'trilho'];

  var TIPOS_ESPECIAIS = {
    bonus_coletivo: 'Meta coletiva batida',
    pergunta_aprovada: 'Sua pergunta foi aprovada no quiz'
  };

  var CONFIG_PADRAO = [
    ['nome_app', 'Pro10', 'Nome que aparece no app'],
    ['equipe', 'Equipe Confiabilidade', 'Nome da equipe'],
    ['slogan', 'O profissional nota 10 da manutenção', 'Frase que aparece na entrada do app'],
    ['msg_validada', 'Mandou bem!', 'Mensagem quando uma entrega é validada'],
    ['nivel_prefixo', 'Ponto', 'Nome dos níveis (ex.: Ponto, Nível, Fase)'],
    ['nivel_total', '8', 'Quantos níveis (de 3 a 10). O último é a meta do mês batida'],
    ['selo_quiz', 'Mestre do Quiz', 'Selo de quem mais pontua no quiz'],
    ['selo_trilha', 'Desbravador', 'Selo de quem mais pontua nas trilhas'],
    ['selo_prata', '3', 'Meses com o mesmo selo para chegar à prata'],
    ['selo_ouro', '6', 'Meses com o mesmo selo para chegar ao ouro'],
    ['fuso_minutos', '-180', 'Fuso horário em minutos (Brasil, horário de Brasília: -180)'],
    ['meta_mensal', '200', 'Meta mensal de pontos de cada pessoa (quem bate chega ao último nível)'],
    ['atraso_percentual', '50', 'Quanto vale uma entrega atrasada (% dos pontos)'],
    ['marcar_ate_dias', '3', 'Até quantos dias depois a pessoa pode marcar (cobre as folgas da escala)'],
    ['janelas_ativas', 'sim', 'Usar janelas de registro por turno (sim/nao)'],
    ['taxa_sorteio', '10', 'Chance de uma entrega ser sorteada para conferência (%)'],
    ['amostragem_adaptativa', 'nao', 'Aumentar a taxa para quem teve divergência nos últimos 30 dias (sim/nao)'],
    ['taxa_sorteio_reforcada', '30', 'Taxa reforçada de sorteio (%)'],
    ['limite_quiz_semana', '15', 'Máximo de pontos de quiz por semana'],
    ['repeticao_dias', '2', 'Depois de quantos dias a pergunta errada volta'],
    ['pontos_dominio', '2', 'Pontos ao acertar uma pergunta que tinha errado'],
    ['pontos_aovivo', '2', 'Pontos por acerto no quiz ao vivo'],
    ['pontos_sugestao', '5', 'Pontos para quem cria uma pergunta aprovada'],
    ['apuracao_data', '', 'Data do próximo Pit Stop (aaaa-mm-dd). Vazio: a definir'],
    ['apuracao_hora', '09:00', 'Hora do próximo Pit Stop'],
    ['mural_texto', '', 'Aviso do líder para a equipe'],
    ['mural_em', '', 'Uso interno: quando o aviso foi publicado'],
    ['top_publico', '5', 'Quantas posições ficam visíveis para todos'],
    ['premio_mes', '[PRÊMIO DEFINIDO PELA EQUIPE]', 'Prêmio do 1º lugar do mês'],
    ['premio_evolucao', '[RECONHECIMENTO]', 'Reconhecimento de quem mais evoluiu'],
    ['meta_coletiva_texto', 'Toda a equipe com treinamento em dia', 'Meta coletiva atual'],
    ['meta_coletiva_atual', '0', 'Quanto da meta coletiva já foi atingido'],
    ['meta_coletiva_total', '10', 'Total da meta coletiva'],
    ['meta_coletiva_bonus', '20', 'Bônus para todos quando a meta coletiva é batida'],
    ['meta_coletiva_batida', 'nao', 'Preenchido pelo app (sim/nao)'],
    ['pin_max_erros', '5', 'Quantos erros seguidos de PIN travam a entrada daquela pessoa'],
    ['pin_bloqueio_min', '15', 'Por quantos minutos a entrada fica travada'],
    ['modulo_quiz', 'sim', 'Módulo: quiz'],
    ['modulo_sorteio', 'sim', 'Módulo: sorteio de conferência'],
    ['modulo_apuracao', 'sim', 'Módulo: posições do Placar só no Pit Stop (apuração semanal)'],
    ['modulo_avatar', 'sim', 'Módulo: escolha de avatar'],
    ['modulo_celebracao', 'sim', 'Módulo: animação quando a entrega é validada'],
    ['modulo_aovivo', 'sim', 'Módulo: quiz ao vivo na reunião'],
    ['modulo_sugestoes', 'sim', 'Módulo: perguntas criadas pela equipe'],
    ['aovivo_sessao', '', 'Uso interno do quiz ao vivo'],
    ['aovivo_pergunta', '', 'Uso interno do quiz ao vivo'],
    ['aovivo_revelada', 'nao', 'Uso interno do quiz ao vivo']
  ];

  var EDITAVEIS = [
    { chave: 'apuracao_data', rotulo: 'Data do próximo Pit Stop', tipo: 'data', grupo: 'Placar e Pit Stop' },
    { chave: 'apuracao_hora', rotulo: 'Hora do próximo Pit Stop', tipo: 'hora', grupo: 'Placar e Pit Stop' },
    { chave: 'top_publico', rotulo: 'Posições visíveis para todos', tipo: 'numero', grupo: 'Placar e Pit Stop' },
    { chave: 'premio_mes', rotulo: 'Prêmio do 1º lugar do mês', tipo: 'texto', grupo: 'Placar e Pit Stop' },
    { chave: 'premio_evolucao', rotulo: 'Reconhecimento de quem mais evoluiu', tipo: 'texto', grupo: 'Placar e Pit Stop' },
    { chave: 'meta_mensal', rotulo: 'Meta mensal de pontos (= último nível)', tipo: 'numero', grupo: 'Regras da equipe' },
    { chave: 'marcar_ate_dias', rotulo: 'Pode marcar até quantos dias depois (0 a 14)', tipo: 'numero', grupo: 'Regras da equipe' },
    { chave: 'janelas_ativas', rotulo: 'Usar janelas de registro por turno', tipo: 'simnao', grupo: 'Regras da equipe' },
    // Daqui em diante, só o Administrador vê e altera
    { chave: 'nome_app', rotulo: 'Nome do app', tipo: 'texto', grupo: 'Identidade e níveis', admin: true },
    { chave: 'slogan', rotulo: 'Frase da entrada', tipo: 'texto', grupo: 'Identidade e níveis', admin: true },
    { chave: 'msg_validada', rotulo: 'Mensagem de entrega validada', tipo: 'texto', grupo: 'Identidade e níveis', admin: true },
    { chave: 'nivel_prefixo', rotulo: 'Nome dos níveis (ex.: Ponto)', tipo: 'texto', grupo: 'Identidade e níveis', admin: true },
    { chave: 'nivel_total', rotulo: 'Quantidade de níveis (3 a 10)', tipo: 'numero', grupo: 'Identidade e níveis', admin: true },
    { chave: 'atraso_percentual', rotulo: 'Entrega atrasada vale (%)', tipo: 'numero', grupo: 'Regras do programa', admin: true },
    { chave: 'taxa_sorteio', rotulo: 'Taxa de sorteio (%)', tipo: 'numero', grupo: 'Regras do programa', admin: true },
    { chave: 'amostragem_adaptativa', rotulo: 'Reforçar sorteio após divergência', tipo: 'simnao', grupo: 'Regras do programa', admin: true },
    { chave: 'taxa_sorteio_reforcada', rotulo: 'Taxa reforçada (%)', tipo: 'numero', grupo: 'Regras do programa', admin: true },
    { chave: 'limite_quiz_semana', rotulo: 'Limite do quiz por semana (pts)', tipo: 'numero', grupo: 'Regras do programa', admin: true },
    { chave: 'repeticao_dias', rotulo: 'Pergunta errada volta após (dias)', tipo: 'numero', grupo: 'Regras do programa', admin: true },
    { chave: 'selo_prata', rotulo: 'Meses com o mesmo selo para a prata', tipo: 'numero', grupo: 'Regras do programa', admin: true },
    { chave: 'selo_ouro', rotulo: 'Meses com o mesmo selo para o ouro', tipo: 'numero', grupo: 'Regras do programa', admin: true },
    { chave: 'pin_max_erros', rotulo: 'Erros seguidos de PIN até travar (3 a 20)', tipo: 'numero', grupo: 'Segurança', admin: true },
    { chave: 'pin_bloqueio_min', rotulo: 'Tempo travado, em minutos (1 a 1440)', tipo: 'numero', grupo: 'Segurança', admin: true },
    { chave: 'modulo_quiz', rotulo: 'Quiz', tipo: 'simnao', grupo: 'Módulos', admin: true },
    { chave: 'modulo_sorteio', rotulo: 'Sorteio de conferência', tipo: 'simnao', grupo: 'Módulos', admin: true },
    { chave: 'modulo_apuracao', rotulo: 'Posições só no Pit Stop', tipo: 'simnao', grupo: 'Módulos', admin: true },
    { chave: 'modulo_avatar', rotulo: 'Escolha de avatar', tipo: 'simnao', grupo: 'Módulos', admin: true },
    { chave: 'modulo_celebracao', rotulo: 'Celebração ao validar', tipo: 'simnao', grupo: 'Módulos', admin: true },
    { chave: 'modulo_aovivo', rotulo: 'Quiz ao vivo', tipo: 'simnao', grupo: 'Módulos', admin: true },
    { chave: 'modulo_sugestoes', rotulo: 'Perguntas criadas pela equipe', tipo: 'simnao', grupo: 'Módulos', admin: true }
  ];

  var DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  var DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

  // ---------------------------------------------------------------------------
  // Utilidades
  // ---------------------------------------------------------------------------
  function erro(msg) { var e = new Error(msg); e.amigavel = true; return e; }
  function txt(v) { return v === null || v === undefined ? '' : String(v).trim(); }
  function sim(v) {
    if (v === true) return true;
    var s = txt(v).toLowerCase();
    return s === 'sim' || s === 's' || s === 'true' || s === '1' || s === 'yes' || s === 'verdadeiro';
  }
  function num(v, padrao) {
    if (v === '' || v === null || v === undefined) return padrao;
    var n = Number(String(v).replace(',', '.'));
    return isNaN(n) ? padrao : n;
  }
  function json(v, padrao) {
    if (v && typeof v === 'object') return v;
    try { return v ? JSON.parse(v) : padrao; } catch (e) { return padrao; }
  }
  var contadorId = 0;
  function novoId(prefixo, agora) {
    contadorId = (contadorId + 1) % 1296;
    return prefixo + '_' + agora.toString(36) + contadorId.toString(36) + Math.random().toString(36).slice(2, 6);
  }
  function normalizar(s) {
    s = txt(s).toLowerCase();
    if (s.normalize) s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');
    return s.replace(/\s+/g, ' ');
  }
  function dois(n) { return (n < 10 ? '0' : '') + n; }

  function partes(ts, fuso) {
    var d = new Date(ts + fuso * MIN);
    return { a: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes(), sem: d.getUTCDay() };
  }
  function inicioDia(ts, fuso) { var p = partes(ts, fuso); return Date.UTC(p.a, p.m, p.d) - fuso * MIN; }
  function inicioSemana(ts, fuso) { var p = partes(ts, fuso); return inicioDia(ts, fuso) - ((p.sem + 6) % 7) * DIA; }
  function inicioMes(ts, fuso) { var p = partes(ts, fuso); return Date.UTC(p.a, p.m, 1) - fuso * MIN; }
  function fmtData(ts, fuso) { var p = partes(ts, fuso); return dois(p.d) + '/' + dois(p.m + 1); }
  function isoData(ts, fuso) { if (!ts) return ''; var p = partes(ts, fuso); return p.a + '-' + dois(p.m + 1) + '-' + dois(p.d); }
  function fmtHora(ts, fuso) { var p = partes(ts, fuso); return dois(p.h) + ':' + dois(p.mi); }
  function fmtMin(m) { return dois(Math.floor(m / 60) % 24) + ':' + dois(m % 60); }
  function fmtDiaData(ts, fuso) { return DIAS_CURTOS[partes(ts, fuso).sem] + ', ' + fmtData(ts, fuso); }
  function fmtQuando(ts, agora, fuso) {
    var hoje = inicioDia(agora, fuso);
    var dia = inicioDia(ts, fuso);
    if (dia === hoje) return 'hoje, ' + fmtHora(ts, fuso);
    if (dia === hoje - DIA) return 'ontem, ' + fmtHora(ts, fuso);
    return fmtDiaData(ts, fuso);
  }
  function lerData(v, fuso) {
    if (v === '' || v === null || v === undefined) return 0;
    if (typeof v === 'number') return v;
    if (Object.prototype.toString.call(v) === '[object Date]') return v.getTime();
    var s = String(v).trim();
    var m;
    if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/))) return Date.UTC(+m[1], +m[2] - 1, +m[3]) - (fuso || -180) * MIN;
    if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) return Date.UTC(+m[3], +m[2] - 1, +m[1]) - (fuso || -180) * MIN;
    if (/^\d{10,}$/.test(s)) return Number(s);
    var t = Date.parse(s);
    return isNaN(t) ? 0 : t;
  }
  function hhmm(s) {
    var m = txt(s).match(/^(\d{1,2})[:h](\d{2})$/);
    return m ? (+m[1]) * 60 + (+m[2]) : -1;
  }

  // ---------------------------------------------------------------------------
  // Banco de dados em memória (modo demonstração e testes)
  // ---------------------------------------------------------------------------
  function criarDbMemoria(dados) {
    var t = {};
    Object.keys(TABELAS).forEach(function (n) { t[n] = (dados && dados[n]) ? dados[n].slice() : []; });
    return {
      tabelas: t,
      ler: function (nome) { return t[nome].map(function (r) { return Object.assign({}, r); }); },
      inserir: function (nome, obj) { t[nome].push(Object.assign({}, obj)); },
      atualizar: function (nome, campo, valor, patch) {
        var linha = t[nome].filter(function (r) { return txt(r[campo]) === txt(valor); })[0];
        if (linha) Object.assign(linha, patch);
      }
    };
  }

  // ---------------------------------------------------------------------------
  // Contexto de cada chamada
  // ---------------------------------------------------------------------------
  function criarCtx(db, opcoes) {
    opcoes = opcoes || {};
    var cache = {};
    var ctx = {
      db: db,
      agora: opcoes.agora || Date.now(),
      rnd: opcoes.aleatorio || Math.random,
      adiarLogin: !!opcoes.adiarLogin,
      t: function (nome) { if (!cache[nome]) cache[nome] = db.ler(nome); return cache[nome]; },
      ins: function (nome, obj) { db.inserir(nome, obj); if (cache[nome]) cache[nome].push(Object.assign({}, obj)); },
      upd: function (nome, campo, valor, patch) {
        db.atualizar(nome, campo, valor, patch);
        if (cache[nome]) cache[nome].forEach(function (r) { if (txt(r[campo]) === txt(valor)) Object.assign(r, patch); });
      }
    };
    ctx.cfg = lerConfig(ctx);
    ctx.fuso = num(ctx.cfg.fuso_minutos, -180);
    return ctx;
  }

  function lerConfig(ctx) {
    var c = {};
    CONFIG_PADRAO.forEach(function (l) { c[l[0]] = l[1]; });
    ctx.t('Config').forEach(function (r) { var k = txt(r.chave); if (k) c[k] = r.valor === null || r.valor === undefined ? '' : r.valor; });
    return c;
  }
  function gravarConfig(ctx, chave, valor) {
    var existe = ctx.t('Config').some(function (r) { return txt(r.chave) === chave; });
    if (existe) ctx.upd('Config', 'chave', chave, { valor: String(valor) });
    else ctx.ins('Config', { chave: chave, valor: String(valor), descricao: '' });
    ctx.cfg[chave] = String(valor);
  }
  function modulos(ctx) {
    var c = ctx.cfg;
    return {
      quiz: sim(c.modulo_quiz), sorteio: sim(c.modulo_sorteio), apuracao: sim(c.modulo_apuracao),
      avatar: sim(c.modulo_avatar), celebracao: sim(c.modulo_celebracao), aovivo: sim(c.modulo_aovivo) && sim(c.modulo_quiz),
      sugestoes: sim(c.modulo_sugestoes) && sim(c.modulo_quiz)
    };
  }
  function exigirModulo(ctx, nome, rotulo) { if (!modulos(ctx)[nome]) throw erro('O módulo ' + rotulo + ' está desligado.'); }

  // ---------------------------------------------------------------------------
  // Pessoas, tipos e registros
  // ---------------------------------------------------------------------------
  function pessoasAtivas(ctx) { return ctx.t('Pessoas').filter(function (p) { return txt(p.id) && sim(p.ativo); }); }
  // Papéis: equipe, lider (o supervisor) e admin (tudo do líder, mais as regras do programa)
  function ehAdmin(p) { return txt(p.papel).toLowerCase() === 'admin'; }
  function ehLider(p) { var c = txt(p.papel).toLowerCase(); return c === 'lider' || c === 'admin'; }
  function daEquipe(p) { return !ehLider(p); }
  function pessoaPorId(ctx, id) { return ctx.t('Pessoas').filter(function (p) { return txt(p.id) === txt(id); })[0] || null; }
  function tipoPorId(ctx, id) { return ctx.t('TiposEntrega').filter(function (t) { return txt(t.id) === txt(id); })[0] || null; }
  function nomeTipo(ctx, id) { if (TIPOS_ESPECIAIS[id]) return TIPOS_ESPECIAIS[id]; var t = tipoPorId(ctx, id); return t ? txt(t.nome) : 'Entrega'; }
  function registroPorId(ctx, id) { return ctx.t('Registros').filter(function (r) { return txt(r.id) === txt(id); })[0] || null; }
  function perguntaPorId(ctx, id) { return ctx.t('Perguntas').filter(function (q) { return txt(q.id) === txt(id); })[0] || null; }
  function avatarDe(p) { var a = txt(p && p.avatar); return AVATARES.indexOf(a) >= 0 ? a : 'rodeiro'; }
  function pessoaPublica(p) { return { id: txt(p.id), nome: txt(p.nome), turno: txt(p.turno), papel: ehLider(p) ? 'lider' : 'equipe', avatar: avatarDe(p) }; }

  function turnosCadastrados(ctx) {
    var vistos = {};
    return ctx.t('Turnos').map(function (t) { return txt(t.turno); }).filter(function (t) { if (!t || vistos[t]) return false; vistos[t] = 1; return true; });
  }
  // Código da pessoa a partir do nome: "Ana Paula" vira "ana-paula" (ou "ana-paula-2" se já existir).
  function idPessoa(ctx, nome) {
    var base = normalizar(nome).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'pessoa';
    var usados = {};
    ctx.t('Pessoas').forEach(function (p) { usados[txt(p.id)] = 1; });
    var id = base, n = 2;
    while (usados[id]) id = base + '-' + n++;
    return id;
  }
  // PIN de 4 dígitos sorteado. Evita PINs fáceis (1111, 1234, 9876) e os que outra pessoa já usa.
  function pinFacil(pin) {
    if (/^(\d)\1{3}$/.test(pin)) return true;
    var d = pin.split('').map(Number), sobe = true, desce = true;
    for (var i = 1; i < 4; i++) { if (d[i] !== d[i - 1] + 1) sobe = false; if (d[i] !== d[i - 1] - 1) desce = false; }
    return sobe || desce || /^(19|20)\d\d$/.test(pin);
  }
  function gerarPin(ctx, idDono) {
    var usados = {};
    ctx.t('Pessoas').forEach(function (p) { if (txt(p.id) !== idDono && sim(p.ativo)) usados[txt(p.pin)] = 1; });
    for (var i = 0; i < 200; i++) {
      var pin = ('000' + Math.floor(ctx.rnd() * 10000)).slice(-4);
      if (!pinFacil(pin) && !usados[pin]) return pin;
    }
    throw erro('Não foi possível gerar um PIN. Tente de novo.');
  }

  // Código de acesso: 4 caracteres sorteados, sem os que se confundem (0/O, 1/I) e sem E,
  // para a planilha nunca ler um código como número. Não deriva do nome, para não revelar a pessoa.
  var LETRAS_CODIGO = '23456789ABCDFGHJKLMNPQRSTUVWXYZ';
  function normCodigo(c) { return txt(c).toUpperCase().replace(/\s+/g, ''); }
  function sortearCodigo(usados) {
    for (var i = 0; i < 200; i++) {
      var c = '';
      for (var j = 0; j < 4; j++) c += LETRAS_CODIGO.charAt(Math.floor(Math.random() * LETRAS_CODIGO.length));
      if (!usados[c]) return c;
    }
    throw erro('Não foi possível gerar um código. Tente de novo.');
  }
  function codigosUsados(pessoas) {
    var usados = {};
    pessoas.forEach(function (p) { if (txt(p.codigo)) usados[normCodigo(p.codigo)] = 1; });
    return usados;
  }
  // Dá código a quem ainda não tem (planilha antiga, linha digitada à mão, demonstração antiga).
  function garantirCodigos(db) {
    var pessoas = db.ler('Pessoas'), usados = codigosUsados(pessoas), n = 0;
    pessoas.forEach(function (p) {
      if (!txt(p.id) || txt(p.codigo)) return;
      var c = sortearCodigo(usados);
      usados[c] = 1;
      db.atualizar('Pessoas', 'id', txt(p.id), { codigo: c });
      n++;
    });
    // Planilha de versão anterior não tem Administrador: o primeiro líder da lista passa a ser
    if (!pessoas.some(ehAdmin)) {
      var primeiro = pessoas.filter(function (p) { return txt(p.id) && ehLider(p); })[0];
      if (primeiro) { db.atualizar('Pessoas', 'id', txt(primeiro.id), { papel: 'admin' }); n++; }
    }
    return n;
  }

  function erroLogin() { return erro('Código ou PIN incorreto.'); }
  function erroBloqueio(ate, agora) { return erro('Muitas tentativas erradas. Tente de novo em ' + Math.max(1, Math.ceil((ate - agora) / MIN)) + ' min.'); }

  // O login aceita só o código sorteado. O id não serve, porque vem do nome e é fácil de adivinhar.
  function autenticar(ctx, req) {
    var codigo = normCodigo(req.codigo_acesso);
    var p = codigo ? pessoasAtivas(ctx).filter(function (x) { return normCodigo(x.codigo) === codigo; })[0] : null;
    if (!p) throw erroLogin();
    var ate = lerData(p.bloqueado_ate, ctx.fuso);
    if (ate > ctx.agora) throw erroBloqueio(ate, ctx.agora);
    var erros = num(p.erros_pin, 0);
    var errado = txt(p.pin) === '' || txt(p.pin) !== txt(req.pin);
    if (!errado && !erros && !ate) return p;
    // Daqui em diante é preciso gravar na planilha. Chamadas só de leitura correm sem trava,
    // então pedem para repetir com a trava, senão tentativas simultâneas escapariam da contagem.
    if (ctx.adiarLogin) { var e = new Error('repetir'); e.repetirComTrava = true; throw e; }
    var id = txt(p.id);
    if (!errado) { ctx.upd('Pessoas', 'id', id, { erros_pin: 0, bloqueado_ate: '' }); return p; }
    erros++;
    if (erros >= Math.max(3, num(ctx.cfg.pin_max_erros, 5))) {
      var fim = ctx.agora + Math.max(1, num(ctx.cfg.pin_bloqueio_min, 15)) * MIN;
      ctx.upd('Pessoas', 'id', id, { erros_pin: 0, bloqueado_ate: fim });
      throw erroBloqueio(fim, ctx.agora);
    }
    ctx.upd('Pessoas', 'id', id, { erros_pin: erros, bloqueado_ate: '' });
    throw erroLogin();
  }

  function resumoRegistro(ctx, r) {
    var t = tipoPorId(ctx, r.tipo_id);
    return {
      id: txt(r.id), tipo: nomeTipo(ctx, r.tipo_id), status: txt(r.status), pontos: num(r.pontos, 0),
      pontos_tipo: t ? num(t.pontos, 0) : num(r.pontos, 0),
      quando: fmtQuando(lerData(r.data_execucao, ctx.fuso), ctx.agora, ctx.fuso),
      referencia: txt(r.referencia), sorteada: sim(r.sorteada), atrasada: sim(r.atrasada),
      conferencia: txt(r.conferencia), aguardando_ref: sim(r.sorteada) && !txt(r.referencia) && txt(r.status) === 'pendente'
    };
  }

  // ---------------------------------------------------------------------------
  // Pontos e ranking
  // ---------------------------------------------------------------------------
  function pontosDe(ctx, pessoaId, inicio, fim) {
    var e = 0, q = 0, fuso = ctx.fuso;
    ctx.t('Registros').forEach(function (r) {
      if (txt(r.pessoa_id) !== pessoaId || txt(r.status) !== 'validada') return;
      var ts = lerData(r.validado_em, fuso);
      if (ts >= inicio && ts < fim) e += num(r.pontos, 0);
    });
    ['Respostas', 'AoVivo'].forEach(function (tab) {
      ctx.t(tab).forEach(function (r) {
        if (txt(r.pessoa_id) !== pessoaId) return;
        var ts = lerData(r.criado_em, fuso);
        if (ts >= inicio && ts < fim) q += num(r.pontos, 0);
      });
    });
    return { entregas: e, quiz: q, total: e + q };
  }
  function pontosQuizSemana(ctx, pessoaId) {
    var ini = inicioSemana(ctx.agora, ctx.fuso);
    return pontosDe(ctx, pessoaId, ini, ctx.agora + 1).quiz;
  }
  function calcularRanking(ctx, inicio, fim) {
    var lista = pessoasAtivas(ctx).filter(daEquipe).map(function (p) {
      return { id: txt(p.id), nome: txt(p.nome), avatar: avatarDe(p), turno: txt(p.turno), pontos: pontosDe(ctx, txt(p.id), inicio, fim).total };
    });
    lista.sort(function (a, b) { return b.pontos - a.pontos || a.nome.localeCompare(b.nome); });
    var pos = 0, anterior = null;
    lista.forEach(function (x, i) { if (x.pontos !== anterior) { pos = i + 1; anterior = x.pontos; } x.pos = pos; });
    return lista;
  }
  function apuracoes(ctx) {
    return ctx.t('Apuracoes').map(function (a) {
      return { id: txt(a.id), inicio: lerData(a.inicio, ctx.fuso), fim: lerData(a.fim, ctx.fuso), ranking: json(a.ranking, {}), evoluiu: json(a.evoluiu, null) };
    }).filter(function (a) { return a.fim > 0; }).sort(function (a, b) { return a.fim - b.fim; });
  }
  function ultimaApuracao(ctx) { var l = apuracoes(ctx); return l.length ? l[l.length - 1] : null; }
  // O período vai do último Pit Stop até agora. No primeiro, conta desde o primeiro registro do app.
  function inicioPeriodo(ctx) {
    var u = ultimaApuracao(ctx);
    if (u) return u.fim;
    var primeiro = inicioSemana(ctx.agora, ctx.fuso);
    ['Registros', 'Respostas', 'AoVivo'].forEach(function (tab) {
      ctx.t(tab).forEach(function (r) { var ts = lerData(r.criado_em, ctx.fuso); if (ts && ts < primeiro) primeiro = ts; });
    });
    return primeiro;
  }
  function calcularEvolucao(semana, anterior) {
    if (!anterior) return null;
    var mapa = {};
    ((anterior.ranking && anterior.ranking.semana) || []).forEach(function (x) { mapa[x.id] = x.pontos; });
    var melhor = null;
    semana.forEach(function (x) {
      if (mapa[x.id] === undefined) return;
      var d = x.pontos - mapa[x.id];
      if (d > 0 && (!melhor || d > melhor.delta)) melhor = { id: x.id, nome: x.nome, avatar: x.avatar, delta: d };
    });
    return melhor;
  }
  function proximaApuracao(ctx) {
    var h = hhmm(ctx.cfg.apuracao_hora);
    if (h < 0) h = 540;
    var base = inicioDia(ctx.agora, ctx.fuso);
    var diaMarcado = txt(ctx.cfg.apuracao_data) ? lerData(ctx.cfg.apuracao_data, ctx.fuso) : 0;
    // Sem data, ou com a data já passada, o aviso fica "a definir" até o líder marcar outra
    if (!diaMarcado || diaMarcado < base) return { definida: false, texto: 'A definir', dia_nome: '', faltam_dias: null, faltam_texto: '' };
    var ts = diaMarcado + h * MIN;
    var faltam = Math.round((diaMarcado - base) / DIA);
    return {
      definida: true, ts: ts, texto: fmtDiaData(ts, ctx.fuso) + ' · ' + fmtMin(h),
      dia_nome: DIAS[partes(ts, ctx.fuso).sem], faltam_dias: faltam,
      faltam_texto: faltam === 0 ? 'hoje' : (faltam === 1 ? 'amanhã' : faltam + ' dias')
    };
  }
  function metaColetiva(ctx) {
    var c = ctx.cfg;
    var total = Math.max(1, num(c.meta_coletiva_total, 10));
    var atual = Math.max(0, num(c.meta_coletiva_atual, 0));
    return { texto: txt(c.meta_coletiva_texto), atual: atual, total: total, pct: Math.min(100, Math.round(atual / total * 100)), bonus: num(c.meta_coletiva_bonus, 20), batida: sim(c.meta_coletiva_batida) };
  }
  // Níveis do acelerador: do Ponto 1 ao Ponto 8. O Ponto 8 é a meta do mês batida.
  function nivelPonto(pontos, meta, total, prefixo) {
    total = Math.max(3, Math.min(10, Math.round(total || 8)));
    meta = Math.max(1, Math.round(meta));
    pontos = Math.max(0, pontos);
    var d = total - 1;
    var n = Math.min(total, 1 + Math.floor(pontos * d / meta));
    var limite = n < total ? Math.ceil(n * meta / d) : meta;
    var pre = prefixo || 'Ponto';
    return {
      nivel: n, total: total, prefixo: pre, nome: pre + ' ' + n, maximo: n === total,
      proximo: n < total ? n + 1 : null, proximo_nome: n < total ? pre + ' ' + (n + 1) : '',
      faltam: n < total ? Math.max(1, limite - pontos) : 0
    };
  }
  function nivelDe(ctx, pontos) {
    return nivelPonto(pontos, num(ctx.cfg.meta_mensal, 200), num(ctx.cfg.nivel_total, 8), txt(ctx.cfg.nivel_prefixo) || 'Ponto');
  }
  function appInfo(ctx) {
    return { nome: txt(ctx.cfg.nome_app) || 'Pro10', equipe: txt(ctx.cfg.equipe), slogan: txt(ctx.cfg.slogan), msg_validada: txt(ctx.cfg.msg_validada) || 'Mandou bem!' };
  }

  // Selos por atividade: no mês, cada pessoa leva o selo da atividade em que mais pontuou
  function atividades(ctx) {
    var l = ctx.t('TiposEntrega').filter(function (t) { return txt(t.id) && sim(t.ativo) && txt(t.selo); })
      .map(function (t) { return { chave: 'tipo:' + txt(t.id), selo: txt(t.selo), atividade: txt(t.nome) }; });
    if (modulos(ctx).quiz) {
      if (txt(ctx.cfg.selo_quiz)) l.push({ chave: 'quiz', selo: txt(ctx.cfg.selo_quiz), atividade: 'Quiz' });
      if (txt(ctx.cfg.selo_trilha)) l.push({ chave: 'trilha', selo: txt(ctx.cfg.selo_trilha), atividade: 'Trilhas do quiz' });
    }
    return l;
  }
  function pontosPorAtividade(ctx, inicio, fim) {
    var m = {}, fuso = ctx.fuso;
    function soma(p, k, v) { if (!v) return; m[p] = m[p] || {}; m[p][k] = (m[p][k] || 0) + v; }
    ctx.t('Registros').forEach(function (r) {
      if (txt(r.status) !== 'validada') return;
      var ts = lerData(r.validado_em, fuso);
      if (ts >= inicio && ts < fim) soma(txt(r.pessoa_id), 'tipo:' + txt(r.tipo_id), num(r.pontos, 0));
    });
    var cats = {};
    ctx.t('Perguntas').forEach(function (q) { cats[txt(q.id)] = txt(q.categoria); });
    ctx.t('Respostas').forEach(function (r) {
      var ts = lerData(r.criado_em, fuso);
      if (ts >= inicio && ts < fim) soma(txt(r.pessoa_id), cats[txt(r.pergunta_id)] === 'trilha' ? 'trilha' : 'quiz', num(r.pontos, 0));
    });
    ctx.t('AoVivo').forEach(function (r) {
      var ts = lerData(r.criado_em, fuso);
      if (ts >= inicio && ts < fim) soma(txt(r.pessoa_id), 'quiz', num(r.pontos, 0));
    });
    return m;
  }
  function seloDe(mapaPessoa, ativs) {
    var melhor = null;
    ativs.forEach(function (a) {
      var v = (mapaPessoa || {})[a.chave] || 0;
      if (v > 0 && (!melhor || v > melhor.pontos)) melhor = { selo: a.selo, atividade: a.atividade, chave: a.chave, pontos: v };
    });
    return melhor;
  }
  function destaquesPeriodo(ctx, inicio, fim) {
    var ativs = atividades(ctx), mapa = pontosPorAtividade(ctx, inicio, fim);
    var equipe = pessoasAtivas(ctx).filter(daEquipe);
    return ativs.map(function (a) {
      var top = null;
      equipe.forEach(function (p) {
        var v = (mapa[txt(p.id)] || {})[a.chave] || 0;
        if (v > 0 && (!top || v > top.pontos || (v === top.pontos && txt(p.nome).localeCompare(top.nome) < 0))) top = { id: txt(p.id), nome: txt(p.nome), avatar: avatarDe(p), pontos: v };
      });
      return top ? { selo: a.selo, atividade: a.atividade, pessoa: top } : null;
    }).filter(function (x) { return x; });
  }
  function selosDaPessoa(ctx, pessoaId) {
    var ativs = atividades(ctx);
    var primeiro = ctx.agora;
    ctx.t('Registros').forEach(function (r) {
      if (txt(r.pessoa_id) !== pessoaId) return;
      var ts = lerData(r.validado_em, ctx.fuso) || lerData(r.criado_em, ctx.fuso);
      if (ts && ts < primeiro) primeiro = ts;
    });
    var ini = inicioMes(primeiro, ctx.fuso), atualIni = inicioMes(ctx.agora, ctx.fuso), cont = {}, atual = null, voltas = 0;
    while (ini <= atualIni && voltas++ < 36) {
      var p = partes(ini, ctx.fuso);
      var prox = Date.UTC(p.a, p.m + 1, 1) - ctx.fuso * MIN;
      var s = seloDe(pontosPorAtividade(ctx, ini, prox)[pessoaId], ativs);
      if (s) { if (ini === atualIni) atual = s; else cont[s.chave] = (cont[s.chave] || 0) + 1; }
      ini = prox;
    }
    var prata = num(ctx.cfg.selo_prata, 3), ouro = num(ctx.cfg.selo_ouro, 6);
    return {
      atual: atual, prata: prata, ouro: ouro,
      colecao: ativs.map(function (a) {
        var v = cont[a.chave] || 0;
        return { selo: a.selo, atividade: a.atividade, vezes: v, nivel: v >= ouro ? 'ouro' : (v >= prata ? 'prata' : (v >= 1 ? 'bronze' : '')) };
      })
    };
  }
  function nivelEquipe(ctx) {
    var equipe = pessoasAtivas(ctx).filter(daEquipe);
    if (!equipe.length) return null;
    var ini = inicioMes(ctx.agora, ctx.fuso), soma = 0;
    equipe.forEach(function (p) { soma += pontosDe(ctx, txt(p.id), ini, ctx.agora + 1).total; });
    var media = Math.round(soma / equipe.length);
    var n = nivelDe(ctx, media);
    n.media = media;
    return n;
  }
  function mesChave(ctx) { var p = partes(ctx.agora, ctx.fuso); return p.a + '-' + dois(p.m + 1); }
  // Placar individual do quiz ao vivo em andamento. Conta os acertos, e não os pontos, para continuar
  // valendo para quem já bateu o limite semanal. A pergunta em aberto fica de fora até a resposta
  // ser mostrada, senão o placar entregaria quem acertou. Quem empata divide a posição.
  function placarAoVivo(ctx, sessao) {
    var aberta = sim(ctx.cfg.aovivo_revelada) ? '' : txt(ctx.cfg.aovivo_pergunta);
    var acertos = {};
    ctx.t('AoVivo').forEach(function (r) {
      if (txt(r.sessao) !== sessao || !sim(r.correta) || txt(r.pergunta_id) === aberta) return;
      acertos[txt(r.pessoa_id)] = (acertos[txt(r.pessoa_id)] || 0) + 1;
    });
    var lista = pessoasAtivas(ctx).filter(function (p) { return daEquipe(p) && acertos[txt(p.id)]; }).map(function (p) {
      return { id: txt(p.id), nome: txt(p.nome), avatar: avatarDe(p), acertos: acertos[txt(p.id)] };
    }).sort(function (a, b) { return b.acertos - a.acertos || a.nome.localeCompare(b.nome, 'pt-BR'); });
    lista.forEach(function (x, i) { x.pos = i && lista[i - 1].acertos === x.acertos ? lista[i - 1].pos : i + 1; });
    return lista;
  }
  // O que vai para a TV: só o topo, em no máximo 8 linhas. Quem ficou de fora por empate vira "+N empatados".
  function topoAoVivo(lista, ultimaPos) {
    var topo = lista.filter(function (x) { return x.pos <= ultimaPos; });
    return {
      lista: topo.slice(0, 8).map(function (x) { return { pos: x.pos, nome: x.nome, avatar: x.avatar, acertos: x.acertos }; }),
      mais: Math.max(0, topo.length - 8)
    };
  }

  // ---------------------------------------------------------------------------
  // Janelas de registro
  // ---------------------------------------------------------------------------
  function faixasDoTurno(ctx, turno) {
    var linha = ctx.t('Turnos').filter(function (t) { return txt(t.turno) === txt(turno); })[0];
    if (!linha) return [];
    return txt(linha.janelas).split(/[;,]/).map(function (f) {
      var m = f.trim().match(/^(\d{1,2}[:h]\d{2})\s*(?:-|–|às|a)\s*(\d{1,2}[:h]\d{2})$/);
      return m ? { ini: hhmm(m[1]), fim: hhmm(m[2]) } : null;
    }).filter(function (f) { return f && f.ini >= 0 && f.fim >= 0; });
  }
  function estadoJanela(ctx, pessoa) {
    if (!sim(ctx.cfg.janelas_ativas) || ehLider(pessoa)) return { aberta: true, livre: true };
    var faixas = faixasDoTurno(ctx, pessoa.turno);
    if (!faixas.length) return { aberta: true, livre: true };
    var p = partes(ctx.agora, ctx.fuso);
    var agoraMin = p.h * 60 + p.mi;
    var hoje = inicioDia(ctx.agora, ctx.fuso);
    var texto = faixas.map(function (f) { return fmtMin(f.ini) + '–' + fmtMin(f.fim); }).join(' e ');
    for (var i = 0; i < faixas.length; i++) {
      var f = faixas[i];
      var dentro = f.ini <= f.fim ? (agoraMin >= f.ini && agoraMin < f.fim) : (agoraMin >= f.ini || agoraMin < f.fim);
      if (dentro) return { aberta: true, ate: fmtMin(f.fim), turno: txt(pessoa.turno), faixas: texto };
    }
    var prox = null;
    for (var d = 0; d < 2; d++) {
      faixas.forEach(function (f) {
        var ts = hoje + d * DIA + f.ini * MIN;
        if (ts > ctx.agora && (!prox || ts < prox.ts)) prox = { ts: ts, f: f, d: d };
      });
    }
    var falta = Math.round((prox.ts - ctx.agora) / MIN);
    return {
      aberta: false, turno: txt(pessoa.turno), faixas: texto, proxima: prox.ts,
      proxima_texto: (prox.d === 0 ? 'hoje' : 'amanhã') + ', ' + fmtMin(prox.f.ini) + ' às ' + fmtMin(prox.f.fim),
      falta_texto: falta >= 60 ? Math.floor(falta / 60) + 'h' + dois(falta % 60) : falta + ' min'
    };
  }
  function diasParaMarcar(ctx) { return Math.max(0, Math.min(14, Math.floor(num(ctx.cfg.marcar_ate_dias, 3)))); }
  function exigirJanela(ctx, pessoa) {
    var j = estadoJanela(ctx, pessoa);
    if (!j.aberta) throw erro('O registro está fechado agora. Próxima janela: ' + j.proxima_texto + '.');
    return j;
  }

  // ---------------------------------------------------------------------------
  // Quiz
  // ---------------------------------------------------------------------------
  function respostasPorPergunta(ctx, pessoaId) {
    var mapa = {};
    ctx.t('Respostas').forEach(function (r) {
      if (txt(r.pessoa_id) !== pessoaId) return;
      (mapa[txt(r.pergunta_id)] = mapa[txt(r.pergunta_id)] || []).push(r);
    });
    Object.keys(mapa).forEach(function (k) { mapa[k].sort(function (a, b) { return lerData(a.criado_em) - lerData(b.criado_em); }); });
    return mapa;
  }
  function estadoPergunta(ctx, q, lista) {
    if (!lista || !lista.length) return { estado: 'nova' };
    if (lista.some(function (r) { return sim(r.correta); })) return { estado: 'acertou' };
    if (txt(q.tipo) === 'palavra') return { estado: 'tentar' };
    var ult = lista[lista.length - 1];
    var volta = inicioDia(lerData(ult.criado_em, ctx.fuso) + num(ctx.cfg.repeticao_dias, 2) * DIA, ctx.fuso);
    if (ctx.agora >= volta) return { estado: 'revisar' };
    return { estado: 'aguardando', volta: volta };
  }
  function dentroDoPrazo(ctx, q) {
    var ab = lerData(q.abre_em, ctx.fuso), fe = lerData(q.fecha_em, ctx.fuso);
    if (ab && ctx.agora < ab) return 'agendada';
    if (fe && ctx.agora >= inicioDia(fe, ctx.fuso) + DIA) return 'encerrada';
    return 'aberta';
  }
  function perguntasAtivas(ctx) { return ctx.t('Perguntas').filter(function (q) { return txt(q.status) === 'ativa'; }); }
  function trilhaDe(ctx, q) {
    var nome = txt(q.trilha) || 'Trilha';
    return perguntasAtivas(ctx).filter(function (x) { return txt(x.categoria) === 'trilha' && (txt(x.trilha) || 'Trilha') === nome && dentroDoPrazo(ctx, x) !== 'encerrada'; })
      .sort(function (a, b) { return num(a.ordem, 0) - num(b.ordem, 0); });
  }
  function itemQuiz(ctx, q, resp) {
    var e = estadoPergunta(ctx, q, resp[txt(q.id)]);
    var fe = lerData(q.fecha_em, ctx.fuso), ab = lerData(q.abre_em, ctx.fuso);
    return {
      id: txt(q.id), texto: txt(q.texto), tipo: txt(q.tipo) || 'multipla', categoria: txt(q.categoria),
      pontos: num(q.pontos, 5), estado: e.estado,
      volta_texto: e.volta ? DIAS[partes(e.volta, ctx.fuso).sem] + ', ' + fmtData(e.volta, ctx.fuso) : '',
      fecha_texto: fe ? fmtDiaData(fe, ctx.fuso) : '', abre_texto: ab ? fmtDiaData(ab, ctx.fuso) : ''
    };
  }
  function itensTrilha(ctx, qs, resp) {
    var anteriorRespondida = true;
    return qs.map(function (q) {
      var it = itemQuiz(ctx, q, resp);
      if (dentroDoPrazo(ctx, q) === 'agendada') it.estado = 'agendada';
      else if (!anteriorRespondida && it.estado === 'nova') it.estado = 'bloqueada';
      anteriorRespondida = ['nova', 'bloqueada', 'agendada'].indexOf(it.estado) < 0;
      return it;
    });
  }
  function acessoPergunta(ctx, q, pessoa) {
    if (!q || txt(q.status) !== 'ativa' || txt(q.categoria) === 'aovivo') throw erro('Pergunta indisponível.');
    var prazo = dentroDoPrazo(ctx, q);
    if (prazo === 'agendada') throw erro('Essa pergunta ainda não abriu.');
    if (prazo === 'encerrada') throw erro('Essa pergunta já fechou.');
    if (txt(q.categoria) === 'secreta' && !sim(ctx.cfg.meta_coletiva_batida)) throw erro('A pergunta secreta abre quando a equipe bater a meta coletiva.');
    if (txt(q.categoria) === 'trilha') {
      var resp = respostasPorPergunta(ctx, txt(pessoa.id));
      var it = itensTrilha(ctx, trilhaDe(ctx, q), resp).filter(function (x) { return x.id === txt(q.id); })[0];
      if (it && it.estado === 'bloqueada') throw erro('Responda as perguntas anteriores da trilha primeiro.');
    }
  }
  function alternativas(q) {
    return ['a', 'b', 'c', 'd'].filter(function (l) { return txt(q[l]); }).map(function (l) { return { letra: l.toUpperCase(), texto: txt(q[l]) }; });
  }

  // ---------------------------------------------------------------------------
  // Ações públicas (sem login)
  // ---------------------------------------------------------------------------
  var PUBLICAS = {
    inicio: function (ctx) {
      return {
        ok: true, versao: VERSAO,
        app: appInfo(ctx)
      };
    }
  };

  // ---------------------------------------------------------------------------
  // Ações da equipe
  // ---------------------------------------------------------------------------
  var EQUIPE = {
    entrar: function (ctx, req, pessoa) {
      return { ok: true, pessoa: pessoaPublica(pessoa), codigo: normCodigo(pessoa.codigo), modulos: modulos(ctx), app: appInfo(ctx) };
    },

    painel: function (ctx, req, pessoa) {
      var id = txt(pessoa.id), fuso = ctx.fuso, mods = modulos(ctx);
      var mesIni = inicioMes(ctx.agora, fuso);
      var pmes = pontosDe(ctx, id, mesIni, ctx.agora + 1).total;
      var pper = pontosDe(ctx, id, inicioPeriodo(ctx), ctx.agora + 1).total;
      var meus = ctx.t('Registros').filter(function (r) { return txt(r.pessoa_id) === id; });
      var dias = {};
      meus.forEach(function (r) {
        if (txt(r.status) === 'recusada' || TIPOS_ESPECIAIS[txt(r.tipo_id)]) return;
        var ts = lerData(r.data_execucao, fuso);
        if (ts >= mesIni) dias[inicioDia(ts, fuso)] = 1;
      });
      var meta = num(ctx.cfg.meta_mensal, 200);
      var celebrar = [];
      if (mods.celebracao) {
        meus.filter(function (r) { return txt(r.status) === 'validada' && !sim(r.celebrado); })
          .sort(function (a, b) { return lerData(b.validado_em) - lerData(a.validado_em); })
          .slice(0, 5)
          .forEach(function (r) {
            celebrar.push({ id: txt(r.id), titulo: nomeTipo(ctx, txt(r.tipo_id)), pontos: num(r.pontos, 0), atrasada: sim(r.atrasada), quando: fmtQuando(lerData(r.validado_em, fuso), ctx.agora, fuso) });
          });
      }
      var semana = null;
      if (mods.quiz) {
        var resp = respostasPorPergunta(ctx, id);
        var q = perguntasAtivas(ctx).filter(function (x) { return txt(x.categoria) === 'semana' && dentroDoPrazo(ctx, x) === 'aberta'; })[0];
        if (q) semana = itemQuiz(ctx, q, resp);
      }
      var recentes = meus.filter(function (r) { return !TIPOS_ESPECIAIS[txt(r.tipo_id)]; })
        .sort(function (a, b) { return lerData(b.criado_em) - lerData(a.criado_em); }).slice(0, 3)
        .map(function (r) { return resumoRegistro(ctx, r); });
      var aguardando = meus.filter(function (r) { return txt(r.status) === 'pendente' && sim(r.sorteada) && !txt(r.referencia); })
        .map(function (r) { return resumoRegistro(ctx, r); });
      return {
        ok: true, pessoa: pessoaPublica(pessoa), modulos: mods,
        app: appInfo(ctx),
        janela: estadoJanela(ctx, pessoa),
        pontos_mes: pmes, pontos_periodo: pper, dias_ativos: Object.keys(dias).length,
        meta_mensal: meta, meta_pct: Math.min(100, Math.round(pmes / Math.max(1, meta) * 100)),
        nivel: nivelDe(ctx, pmes), mes_chave: mesChave(ctx),
        proxima_apuracao: proximaApuracao(ctx), pergunta_semana: semana, meta_coletiva: metaColetiva(ctx),
        celebrar: celebrar, recentes: recentes, aguardando_ref: aguardando,
        aovivo_ativo: mods.aovivo && txt(ctx.cfg.aovivo_sessao) !== '',
        mural: txt(ctx.cfg.mural_texto) ? { texto: txt(ctx.cfg.mural_texto), data: lerData(ctx.cfg.mural_em, fuso) ? fmtData(lerData(ctx.cfg.mural_em, fuso), fuso) : '' } : null
      };
    },

    tipos: function (ctx, req, pessoa) {
      var tipos = ctx.t('TiposEntrega').filter(function (t) { return txt(t.id) && sim(t.ativo); }).map(function (t) {
        return {
          id: txt(t.id), nome: txt(t.nome), categoria: txt(t.categoria), pontos: num(t.pontos, 0),
          referencia: (txt(t.referencia).toLowerCase() || 'nao'), dica_ref: txt(t.dica_ref)
        };
      });
      var dias = [];
      for (var d = 0; d <= diasParaMarcar(ctx); d++) {
        dias.push({ atras: d, texto: d === 0 ? 'Hoje' : (d === 1 ? 'Ontem' : fmtDiaData(ctx.agora - d * DIA, ctx.fuso)) });
      }
      return { ok: true, tipos: tipos, janela: estadoJanela(ctx, pessoa), dias: dias, atraso_pct: num(ctx.cfg.atraso_percentual, 50) };
    },

    marcar: function (ctx, req, pessoa) {
      exigirJanela(ctx, pessoa);
      var tipo = tipoPorId(ctx, req.tipo_id);
      if (!tipo || !sim(tipo.ativo)) throw erro('Entrega não encontrada.');
      var atras = Math.floor(num(req.dias_atras, 0));
      if (atras < 0 || atras > diasParaMarcar(ctx)) throw erro('Só dá pra marcar entregas de até ' + diasParaMarcar(ctx) + ' dias atrás.');
      var dataExec = ctx.agora - atras * DIA;
      var exige = txt(tipo.referencia).toLowerCase() || 'nao';
      var ref = exige === 'nao' ? '' : txt(req.referencia).toUpperCase();
      if (exige === 'obrigatoria' && !ref) throw erro('Informe o número de referência (' + (txt(tipo.dica_ref) || 'ex.: nº da RAF') + ').');
      if (ref) validarFormatoRef(tipo, ref);
      var regs = ctx.t('Registros');
      var max = num(tipo.max_por_dia, 0);
      if (max > 0) {
        var dia = inicioDia(dataExec, ctx.fuso);
        var n = regs.filter(function (r) {
          return txt(r.pessoa_id) === txt(pessoa.id) && txt(r.tipo_id) === txt(tipo.id) && txt(r.status) !== 'recusada' && inicioDia(lerData(r.data_execucao, ctx.fuso), ctx.fuso) === dia;
        }).length;
        if (n >= max) throw erro('Você já marcou "' + txt(tipo.nome) + '" ' + (atras === 0 ? 'hoje' : (atras === 1 ? 'ontem' : 'nesse dia')) + '.');
      }
      var alerta = ref ? checarRefDuplicada(ctx, tipo, ref, pessoa, null) : '';
      var sorteada = false;
      if (modulos(ctx).sorteio && sim(tipo.sorteavel) && exige !== 'nao') sorteada = ctx.rnd() * 100 < taxaSorteio(ctx, pessoa);
      var reg = {
        id: novoId('r', ctx.agora), pessoa_id: txt(pessoa.id), tipo_id: txt(tipo.id), data_execucao: dataExec, criado_em: ctx.agora,
        referencia: ref, status: 'pendente', pontos: 0, atrasada: 'nao', sorteada: sorteada ? 'sim' : 'nao', conferencia: '',
        alerta: alerta, validado_em: '', validado_por: '', celebrado: 'nao', obs: ''
      };
      ctx.ins('Registros', reg);
      return { ok: true, sorteada: sorteada, precisa_referencia: sorteada && !ref, registro: resumoRegistro(ctx, reg) };
    },

    informarReferencia: function (ctx, req, pessoa) {
      var r = registroPorId(ctx, req.registro_id);
      if (!r || txt(r.pessoa_id) !== txt(pessoa.id)) throw erro('Registro não encontrado.');
      if (txt(r.status) !== 'pendente') throw erro('Esse registro já foi analisado pelo líder.');
      var tipo = tipoPorId(ctx, r.tipo_id);
      var ref = txt(req.referencia).toUpperCase();
      if (!ref) throw erro('Informe o número de referência.');
      validarFormatoRef(tipo, ref);
      var alerta = checarRefDuplicada(ctx, tipo, ref, pessoa, txt(r.id));
      ctx.upd('Registros', 'id', txt(r.id), { referencia: ref, alerta: alerta });
      return { ok: true };
    },

    quiz: function (ctx, req, pessoa) {
      exigirModulo(ctx, 'quiz', 'quiz');
      var id = txt(pessoa.id), mods = modulos(ctx);
      var resp = respostasPorPergunta(ctx, id);
      var ativas = perguntasAtivas(ctx);
      var semana = ativas.filter(function (q) { return txt(q.categoria) === 'semana' && dentroDoPrazo(ctx, q) === 'aberta'; })
        .map(function (q) { return itemQuiz(ctx, q, resp); });
      var nomes = [];
      ativas.forEach(function (q) { var n = txt(q.trilha) || 'Trilha'; if (txt(q.categoria) === 'trilha' && nomes.indexOf(n) < 0 && dentroDoPrazo(ctx, q) !== 'encerrada') nomes.push(n); });
      var trilhas = nomes.map(function (nome) {
        var qs = trilhaDe(ctx, { trilha: nome });
        var itens = itensTrilha(ctx, qs, resp);
        var acertos = itens.filter(function (i) { return i.estado === 'acertou'; }).length;
        var prox = itens.filter(function (i) { return i.estado === 'agendada'; })[0];
        return { nome: nome, total: itens.length, acertos: acertos, concluida: itens.length > 0 && acertos === itens.length, itens: itens, proxima_abre: prox ? prox.abre_texto : '' };
      });
      var desafios = ativas.filter(function (q) { return txt(q.categoria) === 'desafio' && dentroDoPrazo(ctx, q) === 'aberta'; })
        .map(function (q) { var it = itemQuiz(ctx, q, resp); it.enunciado = txt(q.texto); return it; });
      var meta = metaColetiva(ctx);
      var secretas = ativas.filter(function (q) { return txt(q.categoria) === 'secreta' && dentroDoPrazo(ctx, q) === 'aberta'; });
      var revisar = ativas.filter(function (q) { return txt(q.categoria) !== 'aovivo' && txt(q.tipo) !== 'palavra'; })
        .map(function (q) { return itemQuiz(ctx, q, resp); })
        .filter(function (i) { return i.estado === 'revisar' || i.estado === 'aguardando'; });
      var minhas = ctx.t('Perguntas').filter(function (q) { return txt(q.autor_id) === id; });
      return {
        ok: true, janela: estadoJanela(ctx, pessoa), limite: num(ctx.cfg.limite_quiz_semana, 15), pontos_semana: pontosQuizSemana(ctx, id),
        semana: semana, trilhas: trilhas, desafios: desafios, revisar: revisar,
        secreta: { existe: secretas.length > 0, liberada: meta.batida, itens: meta.batida ? secretas.map(function (q) { return itemQuiz(ctx, q, resp); }) : [], meta: meta },
        sugestoes: mods.sugestoes, minhas_sugestoes: minhas.length,
        aovivo_ativo: mods.aovivo && txt(ctx.cfg.aovivo_sessao) !== ''
      };
    },

    pergunta: function (ctx, req, pessoa) {
      exigirModulo(ctx, 'quiz', 'quiz');
      var q = perguntaPorId(ctx, req.id);
      acessoPergunta(ctx, q, pessoa);
      var resp = respostasPorPergunta(ctx, txt(pessoa.id));
      var it = itemQuiz(ctx, q, resp);
      it.alternativas = txt(q.tipo) === 'palavra' ? [] : alternativas(q);
      it.trilha = txt(q.trilha);
      if (txt(q.categoria) === 'trilha') {
        var qs = trilhaDe(ctx, q);
        it.posicao = (qs.map(function (x) { return txt(x.id); }).indexOf(txt(q.id)) + 1) + ' de ' + qs.length;
      }
      it.revisao = it.estado === 'revisar';
      it.pontos_valendo = it.revisao ? num(ctx.cfg.pontos_dominio, 2) : num(q.pontos, 5);
      return { ok: true, pergunta: it, janela: estadoJanela(ctx, pessoa), limite: num(ctx.cfg.limite_quiz_semana, 15), pontos_semana: pontosQuizSemana(ctx, txt(pessoa.id)) };
    },

    responder: function (ctx, req, pessoa) {
      exigirModulo(ctx, 'quiz', 'quiz');
      exigirJanela(ctx, pessoa);
      var q = perguntaPorId(ctx, req.pergunta_id);
      acessoPergunta(ctx, q, pessoa);
      var id = txt(pessoa.id);
      var lista = respostasPorPergunta(ctx, id)[txt(q.id)] || [];
      var e = estadoPergunta(ctx, q, lista);
      if (e.estado === 'acertou') throw erro('Você já acertou essa pergunta.');
      if (e.estado === 'aguardando') throw erro('Essa pergunta volta pra você em ' + fmtDiaData(e.volta, ctx.fuso) + '.');
      var palavra = txt(q.tipo) === 'palavra';
      var resposta = txt(req.resposta);
      if (!resposta) throw erro(palavra ? 'Digite a palavra.' : 'Escolha uma alternativa.');
      var correta = palavra ? normalizar(resposta) === normalizar(q.correta) : resposta.toUpperCase() === txt(q.correta).toUpperCase();
      var base = (lista.length === 0 || palavra) ? num(q.pontos, 5) : num(ctx.cfg.pontos_dominio, 2);
      var limite = num(ctx.cfg.limite_quiz_semana, 15);
      var pts = 0, limiteAtingido = false;
      if (correta) {
        var restante = limite - pontosQuizSemana(ctx, id);
        pts = Math.max(0, Math.min(base, restante));
        limiteAtingido = pts < base;
      }
      ctx.ins('Respostas', { id: novoId('q', ctx.agora), pessoa_id: id, pergunta_id: txt(q.id), resposta: palavra ? normalizar(resposta) : resposta.toUpperCase(), correta: correta ? 'sim' : 'nao', pontos: pts, modo: lista.length ? 'revisao' : 'normal', criado_em: ctx.agora });
      var out = { ok: true, correta: correta, pontos: pts, limite_atingido: limiteAtingido, revisao: lista.length > 0 && !palavra, palavra: palavra };
      if (!palavra || correta) { out.explicacao = txt(q.explicacao); out.fonte = txt(q.fonte); }
      if (!palavra) {
        out.correta_letra = txt(q.correta).toUpperCase();
        out.correta_texto = txt(q[txt(q.correta).toLowerCase()]);
        if (!correta) {
          var volta = inicioDia(ctx.agora + num(ctx.cfg.repeticao_dias, 2) * DIA, ctx.fuso);
          out.volta_texto = DIAS[partes(volta, ctx.fuso).sem] + ', ' + fmtData(volta, ctx.fuso);
        }
      }
      if (txt(q.categoria) === 'trilha' && correta) {
        var itens = itensTrilha(ctx, trilhaDe(ctx, q), respostasPorPergunta(ctx, id));
        if (itens.length && itens.every(function (i) { return i.estado === 'acertou'; })) out.trilha_concluida = txt(q.trilha) || 'Trilha';
      }
      return out;
    },

    sugerir: function (ctx, req, pessoa) {
      exigirModulo(ctx, 'sugestoes', 'perguntas criadas pela equipe');
      var texto = txt(req.texto);
      if (texto.length < 10) throw erro('Escreva a pergunta completa.');
      var alts = {};
      var n = 0;
      ['a', 'b', 'c', 'd'].forEach(function (l) { alts[l] = txt(req[l]); if (alts[l]) n++; });
      if (n < 2) throw erro('Preencha pelo menos duas alternativas.');
      var correta = txt(req.correta).toUpperCase();
      if (!correta || !alts[correta.toLowerCase()]) throw erro('Marque qual alternativa é a correta.');
      if (!txt(req.fonte)) throw erro('Diga onde está a resposta (documento e item).');
      ctx.ins('Perguntas', {
        id: novoId('p', ctx.agora), categoria: '', tipo: 'multipla', texto: texto, a: alts.a, b: alts.b, c: alts.c, d: alts.d,
        correta: correta, explicacao: txt(req.explicacao), fonte: txt(req.fonte), trilha: '', ordem: '', abre_em: '', fecha_em: '',
        pontos: 5, status: 'sugestao', autor_id: txt(pessoa.id), criado_em: ctx.agora
      });
      return { ok: true, pontos_aprovacao: num(ctx.cfg.pontos_sugestao, 5) };
    },

    ranking: function (ctx, req, pessoa) {
      var id = txt(pessoa.id), mods = modulos(ctx), top = Math.max(1, num(ctx.cfg.top_publico, 5));
      var out = { ok: true, apuracao_ativa: mods.apuracao, top: top, meta_coletiva: metaColetiva(ctx), nivel_equipe: nivelEquipe(ctx), premio_mes: txt(ctx.cfg.premio_mes), premio_evolucao: txt(ctx.cfg.premio_evolucao) };
      function minha(lista) { var x = (lista || []).filter(function (r) { return r.id === id; })[0]; return x ? { pos: x.pos, pontos: x.pontos } : null; }
      if (mods.apuracao) {
        var u = ultimaApuracao(ctx);
        out.ultima = u ? {
          data_texto: fmtData(u.fim, ctx.fuso), semana: (u.ranking.semana || []).slice(0, top), mes: (u.ranking.mes || []).slice(0, top),
          evoluiu: u.evoluiu, destaques: u.ranking.destaques || [], minha_semana: minha(u.ranking.semana), minha_mes: minha(u.ranking.mes)
        } : null;
        out.proxima = proximaApuracao(ctx);
        out.meus_pontos_periodo = pontosDe(ctx, id, inicioPeriodo(ctx), ctx.agora + 1).total;
      } else {
        var sem = calcularRanking(ctx, inicioSemana(ctx.agora, ctx.fuso), ctx.agora + 1);
        var mes = calcularRanking(ctx, inicioMes(ctx.agora, ctx.fuso), ctx.agora + 1);
        out.ao_vivo = { semana: sem.slice(0, top), mes: mes.slice(0, top), minha_semana: minha(sem), minha_mes: minha(mes) };
      }
      return out;
    },

    perfil: function (ctx, req, pessoa) {
      var id = txt(pessoa.id), fuso = ctx.fuso, mods = modulos(ctx);
      var mesIni = inicioMes(ctx.agora, fuso);
      var meus = ctx.t('Registros').filter(function (r) { return txt(r.pessoa_id) === id; });
      var reais = meus.filter(function (r) { return !TIPOS_ESPECIAIS[txt(r.tipo_id)]; });
      var validadas = reais.filter(function (r) { return txt(r.status) === 'validada'; });
      var mesVal = validadas.filter(function (r) { return lerData(r.validado_em, fuso) >= mesIni; });
      var noPrazo = mesVal.filter(function (r) { return !sim(r.atrasada); }).length;
      var aps = apuracoes(ctx);
      var u = aps.length ? aps[aps.length - 1] : null;
      var grafico = [];
      var ultimas = aps.slice(-3);
      ultimas.forEach(function (a) { var p = pontosDe(ctx, id, a.inicio, a.fim); grafico.push({ rotulo: fmtData(a.fim, fuso), entregas: p.entregas, quiz: p.quiz }); });
      var pa = pontosDe(ctx, id, inicioPeriodo(ctx), ctx.agora + 1);
      grafico.push({ rotulo: 'Atual', entregas: pa.entregas, quiz: pa.quiz, atual: true });
      var resp = ctx.t('Respostas').filter(function (r) { return txt(r.pessoa_id) === id; });
      var acertos = resp.filter(function (r) { return sim(r.correta); }).length;
      var mapaResp = respostasPorPergunta(ctx, id);
      var paraRevisar = perguntasAtivas(ctx).filter(function (q) {
        if (txt(q.tipo) === 'palavra' || txt(q.categoria) === 'aovivo') return false;
        var e = estadoPergunta(ctx, q, mapaResp[txt(q.id)]).estado;
        return e === 'revisar' || e === 'aguardando';
      }).length;
      var minhas = ctx.t('Perguntas').filter(function (q) { return txt(q.autor_id) === id; });
      var aprovadas = minhas.filter(function (q) { return txt(q.status) === 'ativa'; }).length;
      var podios = aps.filter(function (a) { var m = (a.ranking.semana || []).filter(function (x) { return x.id === id; })[0]; return m && m.pos <= 3; });
      var primeiros = aps.filter(function (a) { var m = (a.ranking.semana || []).filter(function (x) { return x.id === id; })[0]; return m && m.pos === 1; });
      var pmesP = pontosDe(ctx, id, mesIni, ctx.agora + 1).total, metaP = num(ctx.cfg.meta_mensal, 200);
      var conquistas = [
        { nome: (txt(ctx.cfg.nivel_prefixo) || 'Ponto') + ' ' + nivelDe(ctx, metaP).total + ' no mês', icone: 'estrela', conquistada: pmesP >= metaP, detalhe: 'meta de ' + metaP + ' pts' },
        { nome: 'Primeira entrega', icone: 'check', conquistada: validadas.length > 0, detalhe: '' },
        { nome: '10 entregas validadas', icone: 'estrela', conquistada: validadas.length >= 10, detalhe: Math.min(validadas.length, 10) + '/10' },
        { nome: 'Mês sem atraso', icone: 'relogio', conquistada: mesVal.length >= 5 && noPrazo === mesVal.length, detalhe: mesVal.length < 5 ? 'mín. 5 no mês' : '' },
        { nome: 'Pódio no Pit Stop', icone: 'trofeu', conquistada: podios.length > 0, detalhe: '' },
        { nome: '1º lugar no Pit Stop', icone: 'trofeu', conquistada: primeiros.length > 0, detalhe: '' }
      ];
      if (mods.quiz) {
        var nomes = [];
        perguntasAtivas(ctx).forEach(function (q) { var n = txt(q.trilha) || 'Trilha'; if (txt(q.categoria) === 'trilha' && nomes.indexOf(n) < 0) nomes.push(n); });
        nomes.forEach(function (n) {
          var itens = itensTrilha(ctx, trilhaDe(ctx, { trilha: n }), mapaResp);
          var ac = itens.filter(function (i) { return i.estado === 'acertou'; }).length;
          conquistas.push({ nome: 'Especialista: ' + n, icone: 'livro', conquistada: itens.length > 0 && ac === itens.length, detalhe: ac + '/' + itens.length });
        });
        if (mods.sugestoes) conquistas.push({ nome: 'Autor de pergunta', icone: 'pergunta', conquistada: aprovadas > 0, detalhe: '' });
      }
      var minhaPos = null;
      if (u) { var m = (u.ranking.semana || []).filter(function (x) { return x.id === id; })[0]; if (m) minhaPos = { pos: m.pos, de: (u.ranking.semana || []).length, data_texto: fmtData(u.fim, fuso) }; }
      return {
        ok: true, pessoa: pessoaPublica(pessoa), modulos: mods, avatares: AVATARES,
        pontos_mes: pmesP, nivel: nivelDe(ctx, pmesP), meta_mensal: metaP, selos: selosDaPessoa(ctx, id), entregas_mes: mesVal.length,
        no_prazo_pct: mesVal.length ? Math.round(noPrazo / mesVal.length * 100) : null,
        minha_posicao: minhaPos, grafico: grafico, conquistas: conquistas,
        quiz: { respostas: resp.length, acerto_pct: resp.length ? Math.round(acertos / resp.length * 100) : null, para_revisar: paraRevisar, criadas: minhas.length, aprovadas: aprovadas },
        historico: meus.sort(function (a, b) { return lerData(b.criado_em) - lerData(a.criado_em); }).slice(0, 8).map(function (r) { return resumoRegistro(ctx, r); })
      };
    },

    avatar: function (ctx, req, pessoa) {
      exigirModulo(ctx, 'avatar', 'avatar');
      var a = txt(req.avatar);
      if (AVATARES.indexOf(a) < 0) throw erro('Avatar inválido.');
      ctx.upd('Pessoas', 'id', txt(pessoa.id), { avatar: a });
      return { ok: true, avatar: a };
    },

    celebrado: function (ctx, req, pessoa) {
      (req.ids || []).forEach(function (rid) {
        var r = registroPorId(ctx, rid);
        if (r && txt(r.pessoa_id) === txt(pessoa.id)) ctx.upd('Registros', 'id', txt(r.id), { celebrado: 'sim' });
      });
      return { ok: true };
    },

    aoVivoEstado: function (ctx, req, pessoa) {
      var ativo = modulos(ctx).aovivo && txt(ctx.cfg.aovivo_sessao) !== '';
      if (!ativo) return { ok: true, ativo: false };
      var sessao = txt(ctx.cfg.aovivo_sessao);
      var q = perguntaPorId(ctx, ctx.cfg.aovivo_pergunta);
      if (!q) return { ok: true, ativo: true, pergunta: null };
      var revelada = sim(ctx.cfg.aovivo_revelada);
      var minha = ctx.t('AoVivo').filter(function (r) { return txt(r.sessao) === sessao && txt(r.pergunta_id) === txt(q.id) && txt(r.pessoa_id) === txt(pessoa.id); })[0];
      var eu = placarAoVivo(ctx, sessao).filter(function (x) { return x.id === txt(pessoa.id); })[0];
      var out = { ok: true, ativo: true, revelada: revelada, pergunta: { id: txt(q.id), texto: txt(q.texto), alternativas: alternativas(q) }, minha_resposta: minha ? txt(minha.resposta) : '', meu_placar: { acertos: eu ? eu.acertos : 0, pos: eu ? eu.pos : 0 } };
      if (revelada) {
        out.correta_letra = txt(q.correta).toUpperCase();
        out.acertei = !!minha && sim(minha.correta);
        out.pontos = minha ? num(minha.pontos, 0) : 0;
        out.explicacao = txt(q.explicacao);
        out.fonte = txt(q.fonte);
      }
      return out;
    },

    aoVivoResponder: function (ctx, req, pessoa) {
      exigirModulo(ctx, 'aovivo', 'quiz ao vivo');
      var sessao = txt(ctx.cfg.aovivo_sessao);
      if (!sessao) throw erro('O quiz ao vivo não está acontecendo agora.');
      if (txt(req.pergunta_id) !== txt(ctx.cfg.aovivo_pergunta)) throw erro('Essa pergunta já passou.');
      if (sim(ctx.cfg.aovivo_revelada)) throw erro('A resposta já foi mostrada.');
      var q = perguntaPorId(ctx, req.pergunta_id);
      if (!q) throw erro('Pergunta não encontrada.');
      var ja = ctx.t('AoVivo').some(function (r) { return txt(r.sessao) === sessao && txt(r.pergunta_id) === txt(q.id) && txt(r.pessoa_id) === txt(pessoa.id); });
      if (ja) throw erro('Você já respondeu essa.');
      var resposta = txt(req.resposta).toUpperCase();
      var correta = resposta === txt(q.correta).toUpperCase();
      var pts = 0;
      if (correta && daEquipe(pessoa)) {
        var base = num(ctx.cfg.pontos_aovivo, 2);
        pts = Math.max(0, Math.min(base, num(ctx.cfg.limite_quiz_semana, 15) - pontosQuizSemana(ctx, txt(pessoa.id))));
      }
      ctx.ins('AoVivo', { id: novoId('v', ctx.agora), sessao: sessao, pergunta_id: txt(q.id), pessoa_id: txt(pessoa.id), resposta: resposta, correta: correta ? 'sim' : 'nao', pontos: pts, criado_em: ctx.agora });
      return { ok: true };
    }
  };

  function respostasDaPergunta(ctx, id) {
    var n = 0;
    ['Respostas', 'AoVivo'].forEach(function (tab) { ctx.t(tab).forEach(function (r) { if (txt(r.pergunta_id) === id) n++; }); });
    return n;
  }
  function proximaOrdem(ctx, cat, trilha) {
    var maior = 0;
    ctx.t('Perguntas').forEach(function (x) {
      if (txt(x.categoria) === cat && txt(x.status) !== 'excluida' && (cat !== 'trilha' || txt(x.trilha) === trilha)) maior = Math.max(maior, num(x.ordem, 0));
    });
    return maior + 1;
  }
  // O formato do número aparece para o Administrador como opção simples; por dentro é um código
  function formatoDe(t) {
    var f = txt(t.formato_ref);
    if (!f) return { tipo: 'livre', min: '', max: '' };
    var m = f.match(/^\^\[0-9\]\{(\d+),(\d+)\}\$$/);
    return m ? { tipo: 'numeros', min: +m[1], max: +m[2] } : { tipo: 'personalizado', min: '', max: '' };
  }
  function validarFormatoRef(tipo, ref) {
    var f = txt(tipo && tipo.formato_ref);
    if (!f) return;
    var rx = null;
    try { rx = new RegExp(f, 'i'); } catch (e) { rx = null; }
    if (rx && !rx.test(ref)) throw erro('Número em formato inesperado.' + (txt(tipo.dica_ref) ? ' Use: ' + txt(tipo.dica_ref) + '.' : ''));
  }
  function checarRefDuplicada(ctx, tipo, ref, pessoa, ignorarId) {
    var iguais = ctx.t('Registros').filter(function (r) {
      return txt(r.id) !== ignorarId && txt(r.tipo_id) === txt(tipo.id) && txt(r.referencia).toUpperCase() === ref && txt(r.status) !== 'recusada';
    });
    if (iguais.some(function (r) { return txt(r.pessoa_id) === txt(pessoa.id); })) throw erro('Você já registrou esse número.');
    if (sim(tipo.ref_unica) && iguais.length) {
      var outro = pessoaPorId(ctx, iguais[0].pessoa_id);
      return 'Número já usado por ' + (outro ? txt(outro.nome) : 'outra pessoa');
    }
    return '';
  }
  function taxaSorteio(ctx, pessoa) {
    var taxa = num(ctx.cfg.taxa_sorteio, 10);
    if (sim(ctx.cfg.amostragem_adaptativa)) {
      var desde = ctx.agora - 30 * DIA;
      var divergiu = ctx.t('Registros').some(function (r) {
        return txt(r.pessoa_id) === txt(pessoa.id) && txt(r.conferencia) === 'nao_confere' && lerData(r.validado_em, ctx.fuso) >= desde;
      });
      if (divergiu) taxa = num(ctx.cfg.taxa_sorteio_reforcada, 30);
    }
    return Math.max(0, Math.min(100, taxa));
  }
  function conformidade(ctx) {
    var conf = ctx.t('Registros').filter(function (r) { return txt(r.conferencia) === 'confere' || txt(r.conferencia) === 'nao_confere'; });
    var ok = conf.filter(function (r) { return txt(r.conferencia) === 'confere'; }).length;
    var n = conf.length;
    var out = { conferidas: n, conferem: ok, pct: n ? Math.round(ok / n * 100) : null, ic: null };
    if (n) {
      // Intervalo de confiança de Wilson (95%)
      var z = 1.96, p = ok / n;
      var centro = (p + z * z / (2 * n)) / (1 + z * z / n);
      var margem = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / (1 + z * z / n);
      out.ic = [Math.max(0, Math.round((centro - margem) * 100)), Math.min(100, Math.round((centro + margem) * 100))];
    }
    return out;
  }
  function darBonus(ctx, pessoaId, tipoId, pontos, lider) {
    ctx.ins('Registros', {
      id: novoId('r', ctx.agora), pessoa_id: pessoaId, tipo_id: tipoId, data_execucao: ctx.agora, criado_em: ctx.agora, referencia: '',
      status: 'validada', pontos: pontos, atrasada: 'nao', sorteada: 'nao', conferencia: '', alerta: '', validado_em: ctx.agora,
      validado_por: lider ? txt(lider.id) : '', celebrado: 'nao', obs: ''
    });
  }
  function apurar(ctx) {
    var ini = inicioPeriodo(ctx);
    var semana = calcularRanking(ctx, ini, ctx.agora + 1);
    var mes = calcularRanking(ctx, inicioMes(ctx.agora, ctx.fuso), ctx.agora + 1);
    var evoluiu = calcularEvolucao(semana, ultimaApuracao(ctx));
    return { inicio: ini, semana: semana, mes: mes, evoluiu: evoluiu, destaques: destaquesPeriodo(ctx, ini, ctx.agora + 1) };
  }
  function perguntaCompleta(ctx, q) {
    var autor = q.autor_id ? pessoaPorId(ctx, q.autor_id) : null;
    return {
      id: txt(q.id), categoria: txt(q.categoria), tipo: txt(q.tipo) || 'multipla', texto: txt(q.texto), alternativas: alternativas(q),
      correta: txt(q.correta), explicacao: txt(q.explicacao), fonte: txt(q.fonte), trilha: txt(q.trilha), ordem: txt(q.ordem),
      status: txt(q.status), autor: autor ? { nome: txt(autor.nome), avatar: avatarDe(autor) } : null,
      a: txt(q.a), b: txt(q.b), c: txt(q.c), d: txt(q.d),
      abre_iso: isoData(lerData(q.abre_em, ctx.fuso), ctx.fuso), fecha_iso: isoData(lerData(q.fecha_em, ctx.fuso), ctx.fuso),
      abre_texto: lerData(q.abre_em, ctx.fuso) ? fmtDiaData(lerData(q.abre_em, ctx.fuso), ctx.fuso) : '',
      fecha_texto: lerData(q.fecha_em, ctx.fuso) ? fmtDiaData(lerData(q.fecha_em, ctx.fuso), ctx.fuso) : ''
    };
  }

  // ---------------------------------------------------------------------------
  // Ações do líder
  // ---------------------------------------------------------------------------
  var LIDER = {
    pendentes: function (ctx) {
      var lista = ctx.t('Registros').filter(function (r) { return txt(r.status) === 'pendente'; })
        .sort(function (a, b) { return lerData(a.criado_em) - lerData(b.criado_em); })
        .map(function (r) {
          var p = pessoaPorId(ctx, r.pessoa_id), t = tipoPorId(ctx, r.tipo_id);
          var base = resumoRegistro(ctx, r);
          base.pessoa = p ? { nome: txt(p.nome), avatar: avatarDe(p) } : { nome: '?', avatar: 'rodeiro' };
          base.pontos_metade = Math.round(base.pontos_tipo * num(ctx.cfg.atraso_percentual, 50) / 100);
          base.alerta = txt(r.alerta);
          base.dica = t ? txt(t.dica_ref) : '';
          return base;
        });
      return { ok: true, pendentes: lista, conformidade: conformidade(ctx), atraso_pct: num(ctx.cfg.atraso_percentual, 50), sorteio_ativo: modulos(ctx).sorteio, taxa_sorteio: num(ctx.cfg.taxa_sorteio, 10) };
    },

    validar: function (ctx, req, lider) {
      var r = registroPorId(ctx, req.id);
      if (!r) throw erro('Registro não encontrado.');
      if (txt(r.status) !== 'pendente') throw erro('Esse registro já foi analisado.');
      var decisao = txt(req.decisao);
      if (['validar', 'atrasada', 'recusar'].indexOf(decisao) < 0) throw erro('Decisão inválida.');
      var sorteada = sim(r.sorteada);
      var patch = { validado_em: ctx.agora, validado_por: txt(lider.id) };
      if (decisao === 'recusar') {
        patch.status = 'recusada';
        patch.pontos = 0;
        if (sorteada) patch.conferencia = txt(r.referencia) ? 'nao_confere' : '';
      } else {
        if (sorteada && !txt(r.referencia)) throw erro('Essa entrega foi sorteada e ainda está sem número de referência.');
        var t = tipoPorId(ctx, r.tipo_id);
        var pts = num(t && t.pontos, 0);
        if (decisao === 'atrasada') { pts = Math.round(pts * num(ctx.cfg.atraso_percentual, 50) / 100); patch.atrasada = 'sim'; }
        patch.status = 'validada';
        patch.pontos = pts;
        if (sorteada) patch.conferencia = 'confere';
      }
      ctx.upd('Registros', 'id', txt(r.id), patch);
      return { ok: true };
    },

    validarTodas: function (ctx, req, lider) {
      var n = 0;
      ctx.t('Registros').filter(function (r) { return txt(r.status) === 'pendente' && !sim(r.sorteada); }).forEach(function (r) {
        var t = tipoPorId(ctx, r.tipo_id);
        ctx.upd('Registros', 'id', txt(r.id), { status: 'validada', pontos: num(t && t.pontos, 0), validado_em: ctx.agora, validado_por: txt(lider.id) });
        n++;
      });
      return { ok: true, validadas: n };
    },

    perguntasLider: function (ctx) {
      var todas = ctx.t('Perguntas');
      function comContagem(q) { var x = perguntaCompleta(ctx, q); x.respostas = respostasDaPergunta(ctx, txt(q.id)); return x; }
      function por(status) { return todas.filter(function (q) { return txt(q.status) === status; }).map(comContagem); }
      var ativas = todas.filter(function (q) { return txt(q.status) === 'ativa'; });
      var cont = {};
      ativas.forEach(function (q) { var c = txt(q.categoria) || 'sem categoria'; cont[c] = (cont[c] || 0) + 1; });
      var trilhas = [];
      ativas.forEach(function (q) { var n = txt(q.trilha); if (txt(q.categoria) === 'trilha' && n && trilhas.indexOf(n) < 0) trilhas.push(n); });
      return {
        ok: true, sugestoes: por('sugestao'), rascunhos: por('rascunho'), revisar: por('revisar'),
        ativas: ativas.map(comContagem),
        contagem: cont, trilhas: trilhas, total_ativas: ativas.length, pontos_sugestao: num(ctx.cfg.pontos_sugestao, 5)
      };
    },

    moderar: function (ctx, req, lider) {
      var q = perguntaPorId(ctx, req.id);
      if (!q) throw erro('Pergunta não encontrada.');
      var decisao = txt(req.decisao);
      var patch = {};
      if (decisao === 'aprovar' || decisao === 'ativar') {
        var cat = txt(req.categoria) || txt(q.categoria);
        if (['semana', 'trilha', 'desafio', 'secreta', 'aovivo'].indexOf(cat) < 0) throw erro('Escolha onde a pergunta vai entrar.');
        patch.status = 'ativa';
        patch.categoria = cat;
        if (req.trilha !== undefined) patch.trilha = txt(req.trilha);
        if (cat === 'trilha' && !txt(patch.trilha !== undefined ? patch.trilha : q.trilha)) throw erro('Informe o nome da trilha.');
        if (req.abre_em) patch.abre_em = lerData(req.abre_em, ctx.fuso);
        if (req.fecha_em) patch.fecha_em = lerData(req.fecha_em, ctx.fuso);
        if ((cat === 'trilha' || cat === 'aovivo') && !txt(q.ordem)) patch.ordem = proximaOrdem(ctx, cat, txt(patch.trilha || q.trilha));
        var bonus = decisao === 'aprovar' && txt(q.status) === 'sugestao' && txt(q.autor_id);
        ctx.upd('Perguntas', 'id', txt(q.id), patch);
        if (bonus) darBonus(ctx, txt(q.autor_id), 'pergunta_aprovada', num(ctx.cfg.pontos_sugestao, 5), lider);
        return { ok: true };
      }
      if (decisao === 'recusar') { ctx.upd('Perguntas', 'id', txt(q.id), { status: 'recusada' }); return { ok: true }; }
      if (decisao === 'arquivar') { ctx.upd('Perguntas', 'id', txt(q.id), { status: 'arquivada' }); return { ok: true }; }
      throw erro('Decisão inválida.');
    },

    importarPerguntas: function (ctx, req) {
      var lista = req.perguntas;
      if (typeof lista === 'string') lista = json(lista, null);
      if (!lista || !lista.length) throw erro('Nenhuma pergunta encontrada no texto colado.');
      var ok = 0, erros = [];
      lista.forEach(function (p, i) {
        var tipo = txt(p.tipo) === 'palavra' ? 'palavra' : 'multipla';
        var correta = txt(p.correta);
        if (!txt(p.texto) || !correta) { erros.push('Pergunta ' + (i + 1) + ': falta texto ou resposta correta.'); return; }
        if (tipo === 'multipla') {
          correta = correta.toUpperCase();
          if (!txt(p[correta.toLowerCase()])) { erros.push('Pergunta ' + (i + 1) + ': a alternativa correta não existe.'); return; }
        }
        var cat = txt(p.categoria);
        ctx.ins('Perguntas', {
          id: novoId('p', ctx.agora), categoria: ['semana', 'trilha', 'desafio', 'secreta', 'aovivo'].indexOf(cat) >= 0 ? cat : 'trilha',
          tipo: tipo, texto: txt(p.texto), a: txt(p.a), b: txt(p.b), c: txt(p.c), d: txt(p.d), correta: correta,
          explicacao: txt(p.explicacao), fonte: txt(p.fonte), trilha: txt(p.trilha), ordem: txt(p.ordem),
          abre_em: lerData(p.abre_em, ctx.fuso) || '', fecha_em: lerData(p.fecha_em, ctx.fuso) || '',
          pontos: num(p.pontos, 5), status: 'rascunho', autor_id: '', criado_em: ctx.agora
        });
        ok++;
      });
      return { ok: true, importadas: ok, erros: erros };
    },

    docRevisado: function (ctx, req) {
      var cod = normalizar(req.codigo);
      if (cod.length < 3) throw erro('Informe o código do documento, por exemplo PRO-0412.');
      var n = 0;
      ctx.t('Perguntas').forEach(function (q) {
        if ((txt(q.status) === 'ativa' || txt(q.status) === 'rascunho') && normalizar(q.fonte).indexOf(cod) >= 0) {
          ctx.upd('Perguntas', 'id', txt(q.id), { status: 'revisar' });
          n++;
        }
      });
      return { ok: true, afetadas: n };
    },

    previaApuracao: function (ctx) {
      var a = apurar(ctx);
      return {
        ok: true, equipe: txt(ctx.cfg.equipe), inicio_texto: fmtData(a.inicio, ctx.fuso), fim_texto: fmtData(ctx.agora, ctx.fuso),
        semana: a.semana, mes: a.mes, evoluiu: a.evoluiu, destaques: a.destaques, meta_coletiva: metaColetiva(ctx), nivel_equipe: nivelEquipe(ctx),
        pendentes: ctx.t('Registros').filter(function (r) { return txt(r.status) === 'pendente'; }).length,
        top: Math.max(1, num(ctx.cfg.top_publico, 5)), premio_mes: txt(ctx.cfg.premio_mes), premio_evolucao: txt(ctx.cfg.premio_evolucao)
      };
    },

    fecharApuracao: function (ctx, req, lider) {
      var u = ultimaApuracao(ctx);
      if (u && ctx.agora - u.fim < 60 * MIN && !req.forcar) throw erro('Já existe um Pit Stop publicado há menos de uma hora.');
      var a = apurar(ctx);
      ctx.ins('Apuracoes', { id: novoId('a', ctx.agora), inicio: a.inicio, fim: ctx.agora, ranking: JSON.stringify({ semana: a.semana, mes: a.mes, destaques: a.destaques }), evoluiu: JSON.stringify(a.evoluiu), criado_por: txt(lider.id) });
      return { ok: true };
    },

    metaColetiva: function (ctx, req, lider) {
      var antes = metaColetiva(ctx);
      var texto = txt(req.texto) || antes.texto;
      var total = Math.max(1, num(req.total, antes.total));
      var atual = Math.max(0, num(req.atual, antes.atual));
      if (texto !== antes.texto) gravarConfig(ctx, 'meta_coletiva_batida', 'nao');
      gravarConfig(ctx, 'meta_coletiva_texto', texto);
      gravarConfig(ctx, 'meta_coletiva_total', total);
      gravarConfig(ctx, 'meta_coletiva_atual', atual);
      var bonusDado = false;
      if (atual >= total && !sim(ctx.cfg.meta_coletiva_batida)) {
        gravarConfig(ctx, 'meta_coletiva_batida', 'sim');
        var b = num(ctx.cfg.meta_coletiva_bonus, 20);
        pessoasAtivas(ctx).filter(daEquipe).forEach(function (p) { darBonus(ctx, txt(p.id), 'bonus_coletivo', b, lider); });
        bonusDado = true;
      }
      return { ok: true, bonus_dado: bonusDado, meta: metaColetiva(ctx) };
    },

    configLider: function (ctx, req, lider) {
      var valores = {}, admin = ehAdmin(lider);
      var campos = EDITAVEIS.filter(function (e) { return admin || !e.admin; });
      campos.forEach(function (e) { valores[e.chave] = ctx.cfg[e.chave]; });
      return {
        ok: true, admin: admin, campos: campos, valores: valores, meta_coletiva: metaColetiva(ctx),
        mural: txt(ctx.cfg.mural_texto),
        tipos: ctx.t('TiposEntrega').filter(function (t) { return txt(t.id); }).map(function (t) {
          return { id: txt(t.id), nome: txt(t.nome), pontos: num(t.pontos, 0), referencia: txt(t.referencia) || 'nao', sorteavel: sim(t.sorteavel), selo: txt(t.selo), ativo: sim(t.ativo) };
        }),
        turnos: ctx.t('Turnos').filter(function (t) { return txt(t.turno); }).map(function (t) { return { turno: txt(t.turno), janelas: txt(t.janelas) }; }),
        pessoas: ctx.t('Pessoas').filter(function (p) { return txt(p.id); }).map(function (p) { var x = pessoaPublica(p); x.ativo = sim(p.ativo); return x; })
      };
    },

    // ----- Cadastro da equipe pelo app -----
    equipeLider: function (ctx, req, lider) {
      var pessoas = ctx.t('Pessoas').filter(function (p) { return txt(p.id); }).map(function (p) {
        var x = pessoaPublica(p); x.ativo = sim(p.ativo); x.voce = txt(p.id) === txt(lider.id); x.admin = ehAdmin(p); x.codigo = normCodigo(p.codigo); x.bloqueado = lerData(p.bloqueado_ate, ctx.fuso) > ctx.agora; return x;
      }).sort(function (a, b) { return (b.ativo - a.ativo) || (b.papel === 'lider') - (a.papel === 'lider') || a.nome.localeCompare(b.nome, 'pt-BR'); });
      return { ok: true, pessoas: pessoas, turnos: turnosCadastrados(ctx), eu_admin: ehAdmin(lider) };
    },

    salvarPessoa: function (ctx, req, lider) {
      var nome = txt(req.nome).replace(/\s+/g, ' ');
      if (nome.length < 2) throw erro('Escreva o nome da pessoa.');
      if (nome.length > 40) throw erro('Use um nome com até 40 letras.');
      var papel = txt(req.papel) === 'admin' ? 'admin' : (txt(req.papel) === 'lider' ? 'lider' : 'equipe');
      if (papel === 'admin' && !ehAdmin(lider)) throw erro('Só o Administrador pode dar esse papel.');
      var turnos = turnosCadastrados(ctx);
      var turno = txt(req.turno);
      if (turnos.length && turnos.indexOf(turno) < 0) throw erro('Escolha um dos turnos cadastrados: ' + turnos.join(', ') + '.');
      var id = txt(req.id);
      var repetido = ctx.t('Pessoas').filter(function (p) { return txt(p.id) && txt(p.id) !== id && normalizar(p.nome) === normalizar(nome); })[0];
      if (repetido) throw erro('Já existe alguém com o nome "' + txt(repetido.nome) + '". Use um sobrenome ou apelido para diferenciar.');
      if (!id) {
        var pin = gerarPin(ctx, '');
        var novo = { id: idPessoa(ctx, nome), nome: nome, turno: turno, papel: papel, pin: pin, avatar: 'rodeiro', ativo: 'sim', codigo: sortearCodigo(codigosUsados(ctx.t('Pessoas'))), erros_pin: 0, bloqueado_ate: '' };
        ctx.ins('Pessoas', novo);
        return { ok: true, novo: true, id: novo.id, nome: nome, pin: pin, codigo: novo.codigo };
      }
      var p = pessoaPorId(ctx, id);
      if (!p) throw erro('Pessoa não encontrada.');
      if (ehAdmin(p) && !ehAdmin(lider)) throw erro('Só o Administrador pode alterar esse cadastro.');
      var ativo = req.ativo === undefined ? sim(p.ativo) : sim(req.ativo);
      if (id === txt(lider.id) && !ativo) throw erro('Você não pode desativar o seu próprio cadastro.');
      if (id === txt(lider.id) && papel === 'equipe') throw erro('Você não pode tirar o seu próprio papel de líder. Peça a outro líder.');
      if (id === txt(lider.id)) papel = txt(lider.papel).toLowerCase();
      ctx.upd('Pessoas', 'id', id, { nome: nome, turno: turno, papel: papel, ativo: ativo ? 'sim' : 'nao' });
      return { ok: true, novo: false, id: id, nome: nome };
    },

    novoPin: function (ctx, req, lider) {
      var p = pessoaPorId(ctx, req.id);
      if (!p) throw erro('Pessoa não encontrada.');
      if (ehAdmin(p) && !ehAdmin(lider)) throw erro('Só o Administrador pode gerar um PIN novo para esse cadastro.');
      var pin = gerarPin(ctx, txt(p.id));
      // Gerar PIN novo também destrava a pessoa e dá código a quem foi cadastrado à mão na planilha
      var codigo = normCodigo(p.codigo) || sortearCodigo(codigosUsados(ctx.t('Pessoas')));
      ctx.upd('Pessoas', 'id', txt(p.id), { pin: pin, codigo: codigo, erros_pin: 0, bloqueado_ate: '' });
      return { ok: true, id: txt(p.id), nome: txt(p.nome), pin: pin, codigo: codigo, proprio: txt(p.id) === txt(lider.id) };
    },

    // ----- Janelas por turno -----
    janelasLider: function (ctx) {
      return {
        ok: true,
        turnos: ctx.t('Turnos').filter(function (t) { return txt(t.turno); }).map(function (t) {
          return {
            turno: txt(t.turno),
            faixas: faixasDoTurno(ctx, t.turno).map(function (f) { return { ini: fmtMin(f.ini), fim: fmtMin(f.fim) }; }),
            pessoas: pessoasAtivas(ctx).filter(function (p) { return txt(p.turno) === txt(t.turno); }).length
          };
        })
      };
    },

    salvarTurno: function (ctx, req) {
      var nome = txt(req.turno).replace(/\s+/g, ' '), antigo = txt(req.antigo);
      if (!nome || nome.length > 20) throw erro('Dê um nome de até 20 letras ao turno.');
      var turnos = ctx.t('Turnos').filter(function (t) { return txt(t.turno); });
      if (antigo && !turnos.some(function (t) { return txt(t.turno) === antigo; })) throw erro('Turno não encontrado.');
      if (nome !== antigo && turnos.some(function (t) { return txt(t.turno) === nome; })) throw erro('Já existe um turno com esse nome.');
      var faixas = (req.faixas || []).filter(function (f) { return txt(f.ini) || txt(f.fim); });
      if (!faixas.length) throw erro('Informe ao menos uma janela, com início e fim.');
      if (faixas.length > 4) throw erro('Use no máximo 4 janelas por turno.');
      var janelas = faixas.map(function (f) {
        var i = hhmm(f.ini), j = hhmm(f.fim);
        if (i < 0 || j < 0 || i >= 1440 || j >= 1440) throw erro('Horário inválido. Use o formato 07:00.');
        if (i === j) throw erro('O início e o fim da janela não podem ser iguais.');
        return fmtMin(i) + '-' + fmtMin(j);
      }).join('; ');
      if (!antigo) { ctx.ins('Turnos', { turno: nome, janelas: janelas }); return { ok: true }; }
      ctx.upd('Turnos', 'turno', antigo, { turno: nome, janelas: janelas });
      if (nome !== antigo) {
        ctx.t('Pessoas').filter(function (p) { return txt(p.turno) === antigo; }).forEach(function (p) { ctx.upd('Pessoas', 'id', txt(p.id), { turno: nome }); });
      }
      return { ok: true };
    },

    removerTurno: function (ctx, req) {
      var turno = txt(req.turno);
      var turnos = ctx.t('Turnos').filter(function (t) { return txt(t.turno); });
      if (!turnos.some(function (t) { return txt(t.turno) === turno; })) throw erro('Turno não encontrado.');
      if (turnos.length === 1) throw erro('A equipe precisa de ao menos um turno.');
      if (pessoasAtivas(ctx).some(function (p) { return txt(p.turno) === turno; })) throw erro('Ainda há pessoas neste turno. Troque o turno delas antes de remover.');
      ctx.upd('Turnos', 'turno', turno, { turno: '', janelas: '' });
      return { ok: true };
    },

    // ----- Entregas, pontos e selos -----
    entregasLider: function (ctx, req, lider) {
      var selos = [];
      var entregas = ctx.t('TiposEntrega').filter(function (t) { return txt(t.id); }).map(function (t) {
        if (txt(t.selo) && selos.indexOf(txt(t.selo)) < 0) selos.push(txt(t.selo));
        return {
          id: txt(t.id), nome: txt(t.nome), categoria: txt(t.categoria), pontos: num(t.pontos, 0), referencia: txt(t.referencia).toLowerCase() || 'nao',
          dica_ref: txt(t.dica_ref), ref_unica: sim(t.ref_unica), sorteavel: sim(t.sorteavel), max_por_dia: num(t.max_por_dia, 0), selo: txt(t.selo), ativo: sim(t.ativo), formato: formatoDe(t)
        };
      }).sort(function (a, b) { return (b.ativo - a.ativo) || a.nome.localeCompare(b.nome, 'pt-BR'); });
      return { ok: true, admin: ehAdmin(lider), selos: selos, entregas: entregas };
    },

    salvarEntrega: function (ctx, req, lider) {
      var nome = txt(req.nome).replace(/\s+/g, ' ');
      if (nome.length < 3 || nome.length > 60) throw erro('Dê à entrega um nome de 3 a 60 letras.');
      var id = txt(req.id), atual = id ? tipoPorId(ctx, id) : null;
      if (id && !atual) throw erro('Entrega não encontrada.');
      if (ctx.t('TiposEntrega').some(function (t) { return txt(t.id) && txt(t.id) !== id && normalizar(t.nome) === normalizar(nome); })) throw erro('Já existe uma entrega com esse nome.');
      var pontos = num(req.pontos, -1);
      if (pontos < 0 || pontos > 1000 || pontos !== Math.floor(pontos)) throw erro('Os pontos vão de 0 a 1000, sem casas decimais.');
      var referencia = txt(req.referencia);
      if (['nao', 'opcional', 'obrigatoria'].indexOf(referencia) < 0) throw erro('Escolha se a entrega pede número de referência.');
      var max = num(req.max_por_dia, 0);
      if (max < 0 || max > 20 || max !== Math.floor(max)) throw erro('O máximo por dia vai de 0 (sem limite) a 20.');
      var patch = {
        nome: nome, categoria: txt(req.categoria) || 'Geral', pontos: pontos, referencia: referencia, dica_ref: referencia === 'nao' ? '' : txt(req.dica_ref),
        ref_unica: referencia !== 'nao' && sim(req.ref_unica) ? 'sim' : 'nao', sorteavel: referencia !== 'nao' && sim(req.sorteavel) ? 'sim' : 'nao',
        max_por_dia: max, selo: txt(req.selo), ativo: sim(req.ativo) ? 'sim' : 'nao'
      };
      if (ehAdmin(lider) && req.formato && req.formato.tipo !== 'personalizado') {
        if (req.formato.tipo === 'numeros') {
          var min = num(req.formato.min, 0), maxD = num(req.formato.max, 0);
          if (min < 1 || maxD > 20 || min > maxD || min !== Math.floor(min) || maxD !== Math.floor(maxD)) throw erro('Informe a quantidade de dígitos, de 1 a 20.');
          patch.formato_ref = '^[0-9]{' + min + ',' + maxD + '}$';
        } else {
          patch.formato_ref = '';
        }
      }
      if (atual) { ctx.upd('TiposEntrega', 'id', id, patch); return { ok: true, id: id }; }
      var base = normalizar(nome).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24) || 'entrega';
      var novoIdTipo = base, n = 2;
      while (tipoPorId(ctx, novoIdTipo) || TIPOS_ESPECIAIS[novoIdTipo]) novoIdTipo = base + '_' + n++;
      if (patch.formato_ref === undefined) patch.formato_ref = '';
      ctx.ins('TiposEntrega', Object.assign({ id: novoIdTipo }, patch));
      return { ok: true, id: novoIdTipo };
    },

    // ----- Perguntas escritas pelo líder -----
    salvarPergunta: function (ctx, req) {
      var id = txt(req.id), q = id ? perguntaPorId(ctx, id) : null;
      if (id && (!q || txt(q.status) === 'excluida')) throw erro('Pergunta não encontrada.');
      if (q && respostasDaPergunta(ctx, id)) throw erro('Essa pergunta já tem respostas e não pode mais ser editada. Se precisar, exclua e crie outra.');
      var cat = txt(req.categoria);
      if (['semana', 'trilha', 'desafio', 'secreta', 'aovivo'].indexOf(cat) < 0) throw erro('Escolha onde a pergunta vai entrar.');
      var texto = txt(req.texto);
      if (texto.length < 10 || texto.length > 500) throw erro('Escreva a pergunta com 10 a 500 letras.');
      var tipo = cat === 'desafio' ? 'palavra' : 'multipla';
      var correta = txt(req.correta);
      var patch = { categoria: cat, tipo: tipo, texto: texto, explicacao: txt(req.explicacao), fonte: txt(req.fonte), a: '', b: '', c: '', d: '' };
      if (tipo === 'palavra') {
        if (!correta) throw erro('Informe a palavra secreta.');
      } else {
        ['a', 'b', 'c', 'd'].forEach(function (l) { patch[l] = txt(req[l]); });
        if (!patch.a || !patch.b) throw erro('Preencha ao menos as alternativas A e B.');
        correta = correta.toUpperCase();
        if (!/^[ABCD]$/.test(correta) || !patch[correta.toLowerCase()]) throw erro('Marque qual alternativa é a certa.');
      }
      patch.correta = correta;
      patch.trilha = cat === 'trilha' ? txt(req.trilha) : '';
      if (cat === 'trilha' && !patch.trilha) throw erro('Informe o nome da trilha.');
      if (cat === 'trilha' || cat === 'aovivo') {
        var ordem = num(req.ordem, 0);
        patch.ordem = ordem > 0 ? Math.floor(ordem) : (q && txt(q.categoria) === cat && num(q.ordem, 0) > 0 ? num(q.ordem, 0) : proximaOrdem(ctx, cat, patch.trilha));
      } else {
        patch.ordem = '';
      }
      if (cat === 'semana') {
        var abre = lerData(req.abre_em, ctx.fuso), fecha = lerData(req.fecha_em, ctx.fuso);
        if (!abre || !fecha) throw erro('Informe as datas de abertura e de fechamento da pergunta da semana.');
        if (fecha < abre) throw erro('A data de fechamento não pode ser antes da abertura.');
        patch.abre_em = abre;
        patch.fecha_em = fecha + DIA - 1;
      }
      if (q) { ctx.upd('Perguntas', 'id', id, patch); return { ok: true, id: id }; }
      var novaId = novoId('p', ctx.agora);
      ctx.ins('Perguntas', Object.assign({ id: novaId, abre_em: '', fecha_em: '', pontos: cat === 'desafio' ? 3 : (cat === 'aovivo' ? 2 : 5), status: 'rascunho', autor_id: '', criado_em: ctx.agora }, patch));
      return { ok: true, id: novaId };
    },

    // Excluir só tira do app: a linha fica na planilha, para o histórico e as respostas continuarem íntegros
    excluirPergunta: function (ctx, req) {
      var id = txt(req.id), q = perguntaPorId(ctx, id);
      if (!q || txt(q.status) === 'excluida') throw erro('Pergunta não encontrada.');
      if (txt(ctx.cfg.aovivo_sessao) && txt(ctx.cfg.aovivo_pergunta) === id) throw erro('Essa pergunta está no ar no quiz ao vivo. Encerre o quiz antes de excluir.');
      ctx.upd('Perguntas', 'id', id, { status: 'excluida' });
      return { ok: true };
    },

    // ----- Mural de avisos -----
    salvarMural: function (ctx, req) {
      var texto = txt(req.texto);
      if (texto.length > 300) throw erro('Use um aviso de até 300 letras.');
      gravarConfig(ctx, 'mural_texto', texto);
      gravarConfig(ctx, 'mural_em', texto ? ctx.agora : '');
      return { ok: true };
    },

    salvarConfig: function (ctx, req, lider) {
      var v = req.valores || {};
      EDITAVEIS.forEach(function (e) {
        if (v[e.chave] === undefined) return;
        if (e.admin && !ehAdmin(lider)) throw erro('Só o Administrador pode alterar "' + e.rotulo + '".');
        var valor = v[e.chave];
        if (e.tipo === 'data') { valor = txt(valor); if (valor && !/^\d{4}-\d{2}-\d{2}$/.test(valor)) throw erro('Data inválida em "' + e.rotulo + '".'); }
        if (e.tipo === 'numero' || e.tipo === 'dia') { valor = num(valor, null); if (valor === null) throw erro('Valor inválido em "' + e.rotulo + '".'); }
        if (e.tipo === 'simnao') valor = sim(valor) ? 'sim' : 'nao';
        if (e.tipo === 'hora' && hhmm(valor) < 0) throw erro('Hora inválida em "' + e.rotulo + '". Use 09:00.');
        if (e.chave === 'nivel_total' && (valor < 3 || valor > 10)) throw erro('A quantidade de níveis vai de 3 a 10.');
        if (e.chave === 'nome_app' && !txt(valor)) throw erro('O nome do app não pode ficar vazio.');
        if (e.chave === 'marcar_ate_dias' && (valor < 0 || valor > 14)) throw erro('O prazo para marcar vai de 0 a 14 dias.');
        if (e.chave === 'pin_max_erros' && (valor < 3 || valor > 20)) throw erro('Os erros de PIN até travar vão de 3 a 20.');
        if (e.chave === 'pin_bloqueio_min' && (valor < 1 || valor > 1440)) throw erro('O tempo travado vai de 1 a 1440 minutos.');
        gravarConfig(ctx, e.chave, valor);
      });
      return { ok: true };
    },

    aoVivoPainel: function (ctx) {
      var sessao = txt(ctx.cfg.aovivo_sessao);
      var lista = perguntasAtivas(ctx).filter(function (q) { return txt(q.categoria) === 'aovivo'; })
        .sort(function (a, b) { return num(a.ordem, 0) - num(b.ordem, 0); })
        .map(function (q) { return { id: txt(q.id), texto: txt(q.texto) }; });
      var out = { ok: true, ativo: sessao !== '', lista: lista, participantes: pessoasAtivas(ctx).filter(daEquipe).length };
      var q = sessao ? perguntaPorId(ctx, ctx.cfg.aovivo_pergunta) : null;
      if (q) {
        var resp = ctx.t('AoVivo').filter(function (r) { return txt(r.sessao) === sessao && txt(r.pergunta_id) === txt(q.id); });
        var dist = {};
        alternativas(q).forEach(function (a) { dist[a.letra] = 0; });
        resp.forEach(function (r) { var l = txt(r.resposta).toUpperCase(); if (dist[l] !== undefined) dist[l]++; });
        var idx = lista.map(function (x) { return x.id; }).indexOf(txt(q.id));
        out.pergunta = perguntaCompleta(ctx, q);
        out.indice = idx + 1;
        out.total = lista.length;
        out.revelada = sim(ctx.cfg.aovivo_revelada);
        out.respostas = resp.length;
        out.acertos = resp.filter(function (r) { return sim(r.correta); }).length;
        out.distribuicao = dist;
        var topo = topoAoVivo(placarAoVivo(ctx, sessao), 5);
        out.placar = topo.lista;
        out.placar_mais = topo.mais;
        out.proxima_id = idx >= 0 && idx + 1 < lista.length ? lista[idx + 1].id : '';
      }
      return out;
    },

    aoVivoIniciar: function (ctx) {
      exigirModulo(ctx, 'aovivo', 'quiz ao vivo');
      var lista = perguntasAtivas(ctx).filter(function (q) { return txt(q.categoria) === 'aovivo'; }).sort(function (a, b) { return num(a.ordem, 0) - num(b.ordem, 0); });
      if (!lista.length) throw erro('Não há perguntas ativas na categoria "ao vivo".');
      gravarConfig(ctx, 'aovivo_sessao', novoId('s', ctx.agora));
      gravarConfig(ctx, 'aovivo_pergunta', txt(lista[0].id));
      gravarConfig(ctx, 'aovivo_revelada', 'nao');
      return { ok: true };
    },

    aoVivoAbrir: function (ctx, req) {
      if (!txt(ctx.cfg.aovivo_sessao)) throw erro('Inicie o quiz ao vivo primeiro.');
      var q = perguntaPorId(ctx, req.pergunta_id);
      if (!q) throw erro('Pergunta não encontrada.');
      gravarConfig(ctx, 'aovivo_pergunta', txt(q.id));
      gravarConfig(ctx, 'aovivo_revelada', 'nao');
      return { ok: true };
    },

    aoVivoRevelar: function (ctx) {
      if (!txt(ctx.cfg.aovivo_sessao)) throw erro('O quiz ao vivo não está ativo.');
      gravarConfig(ctx, 'aovivo_revelada', 'sim');
      return { ok: true };
    },

    aoVivoEncerrar: function (ctx) {
      var sessao = txt(ctx.cfg.aovivo_sessao);
      var podio = sessao ? topoAoVivo(placarAoVivo(ctx, sessao), 3) : { lista: [], mais: 0 };
      gravarConfig(ctx, 'aovivo_sessao', '');
      gravarConfig(ctx, 'aovivo_pergunta', '');
      gravarConfig(ctx, 'aovivo_revelada', 'nao');
      return { ok: true, podio: podio.lista, podio_mais: podio.mais };
    }
  };

  // Ações que só leem dados (não precisam de trava na planilha)
  var SOMENTE_LEITURA = { inicio: 1, entrar: 1, painel: 1, tipos: 1, quiz: 1, pergunta: 1, ranking: 1, perfil: 1, aoVivoEstado: 1, pendentes: 1, perguntasLider: 1, previaApuracao: 1, configLider: 1, aoVivoPainel: 1, equipeLider: 1, janelasLider: 1, entregasLider: 1 };

  // ---------------------------------------------------------------------------
  // Ponto de entrada
  // ---------------------------------------------------------------------------
  function executar(db, req, opcoes) {
    try {
      req = req || {};
      var ctx = criarCtx(db, opcoes);
      var acao = txt(req.acao);
      if (PUBLICAS[acao]) return PUBLICAS[acao](ctx, req);
      if (!EQUIPE[acao] && !LIDER[acao]) throw erro('Ação desconhecida: ' + acao);
      var pessoa = autenticar(ctx, req);
      if (EQUIPE[acao]) return EQUIPE[acao](ctx, req, pessoa);
      if (!ehLider(pessoa)) throw erro('Só o líder pode fazer isso.');
      return LIDER[acao](ctx, req, pessoa);
    } catch (e) {
      if (e && e.repetirComTrava) return { ok: false, repetir_com_trava: true };
      return { ok: false, erro: e && e.amigavel ? e.message : 'Erro inesperado: ' + (e && e.message ? e.message : e) };
    }
  }

  // ---------------------------------------------------------------------------
  // Dados iniciais (planilha nova ou modo demonstração)
  // ---------------------------------------------------------------------------
  function perguntasExemplo(agora, fuso, demo) {
    var st = demo ? 'ativa' : 'rascunho';
    var semIni = inicioSemana(agora, fuso), mesIni = inicioMes(agora, fuso);
    var ex = demo ? '' : '[EXEMPLO – revise] ';
    function p(o) {
      return Object.assign({ id: '', categoria: 'trilha', tipo: 'multipla', texto: '', a: '', b: '', c: '', d: '', correta: '', explicacao: '', fonte: '', trilha: '', ordem: '', abre_em: '', fecha_em: '', pontos: 5, status: st, autor_id: '', criado_em: agora }, o);
    }
    return [
      p({ id: 'p_semana1', categoria: 'semana', texto: ex + 'Antes de iniciar a troca do rodeiro, o que deve ser feito primeiro?', a: 'Soltar os parafusos da tampa da caixa de rolamento', b: 'Isolar e sinalizar o vagão, com calços nas rodas', c: 'Medir o diâmetro das rodas do rodeiro novo', d: 'Lubrificar o mancal do rodeiro novo', correta: 'B', explicacao: 'Antes de qualquer intervenção, o vagão precisa estar isolado e sinalizado, com as rodas calçadas. Só depois começa a desmontagem.', fonte: 'PRO-0412 · rev. 4 · item 5.1 (exemplo)', abre_em: semIni, fecha_em: semIni + (demo ? 6 : 4) * DIA }),
      p({ id: 'p_trilha1', trilha: 'Troca de rodeiro', ordem: 1, texto: ex + 'Qual documento define o passo a passo da troca de rodeiro na oficina?', a: 'O procedimento (PRO) da atividade', b: 'Só o manual do fabricante do vagão', c: 'A ordem de serviço', d: 'A última RAF da oficina', correta: 'A', explicacao: 'O PRO da atividade é a referência do passo a passo. Os outros documentos complementam.', fonte: 'PRO-0412 · rev. 4 (exemplo)', abre_em: mesIni }),
      p({ id: 'p_trilha2', trilha: 'Troca de rodeiro', ordem: 2, texto: ex + 'Ao receber um rodeiro novo, o que deve ser conferido antes da montagem?', a: 'Só a pintura', b: 'Identificação e medidas, conforme o PRO', c: 'O peso do vagão', d: 'Nada, ele já vem conferido', correta: 'B', explicacao: 'A identificação e as medidas do rodeiro são conferidas antes da montagem, conforme o procedimento.', fonte: 'PRO-0412 · rev. 4 · item 4.2 (exemplo)', abre_em: mesIni }),
      p({ id: 'p_trilha3', trilha: 'Troca de rodeiro', ordem: 3, texto: ex + 'O que fazer ao encontrar uma trinca no aro durante a inspeção?', a: 'Seguir a montagem e anotar depois', b: 'Segregar o rodeiro e registrar a não conformidade', c: 'Lixar a trinca e seguir', d: 'Pintar por cima', correta: 'B', explicacao: 'Rodeiro com trinca é segregado, e a não conformidade é registrada para análise.', fonte: 'PRO-0412 · rev. 4 · item 6.3 (exemplo)', abre_em: mesIni }),
      p({ id: 'p_trilha4', trilha: 'Troca de rodeiro', ordem: 4, texto: ex + 'Depois da troca, o que precisa ser registrado?', a: 'Nada', b: 'Só no caderno pessoal', c: 'A ordem de serviço com os dados do rodeiro aplicado', d: 'Uma foto no grupo da equipe', correta: 'C', explicacao: 'A ordem de serviço registra o rodeiro aplicado e garante a rastreabilidade.', fonte: 'PRO-0412 · rev. 4 · item 7.1 (exemplo)', abre_em: demo ? agora + 2 * DIA : mesIni }),
      p({ id: 'p_desafio1', categoria: 'desafio', tipo: 'palavra', pontos: 3, texto: ex + 'Abra o PRO-0412, item 5.3, e encontre a palavra secreta escrita no fim do item.', correta: 'calço', explicacao: 'O líder escreve a palavra secreta no fim do item do documento. Quem abriu o documento acha.', fonte: 'PRO-0412 · item 5.3 (exemplo)', abre_em: semIni }),
      p({ id: 'p_secreta1', categoria: 'secreta', texto: ex + 'Quem pode liberar o vagão para circular depois da manutenção?', a: 'Qualquer mantenedor', b: 'O responsável técnico designado, conforme o procedimento', c: 'O maquinista', d: 'O almoxarife', correta: 'B', explicacao: 'A liberação é feita pelo responsável designado no procedimento.', fonte: 'Procedimento de liberação de vagão (exemplo)' }),
      p({ id: 'p_vivo1', categoria: 'aovivo', ordem: 1, pontos: 2, texto: ex + 'Qual EPI é obrigatório no trabalho em altura acima de 2 metros?', a: 'Cinto de segurança tipo paraquedista', b: 'Cinto de segurança abdominal', c: 'Só o capacete com jugular', d: 'Luva de vaqueta', correta: 'A', explicacao: 'Para trabalho em altura com risco de queda, o cinto deve ser do tipo paraquedista.', fonte: 'NR-35 e PRO de trabalho em altura' }),
      p({ id: 'p_vivo2', categoria: 'aovivo', ordem: 2, pontos: 2, texto: ex + 'Qual é a primeira atitude ao ver uma condição insegura na oficina?', a: 'Ignorar, se não for comigo', b: 'Parar, sinalizar e comunicar o líder', c: 'Esperar o fim do turno', d: 'Resolver sozinho, sem avisar', correta: 'B', explicacao: 'Condição insegura se trata na hora: parar, sinalizar e comunicar.', fonte: 'Regras de segurança da área (exemplo)' }),
      p({ id: 'p_vivo3', categoria: 'aovivo', ordem: 3, pontos: 2, texto: ex + 'O que significa a sigla DDS?', a: 'Diálogo Diário de Segurança', b: 'Documento de Segurança', c: 'Divisão de Serviços', d: 'Dados do Sistema', correta: 'A', explicacao: 'DDS é o Diálogo Diário de Segurança, feito no início do turno.', fonte: 'Rotina de segurança da área' })
    ];
  }

  function dadosIniciais(agora, demo) {
    agora = agora || Date.now();
    var fuso = -180;
    var config = CONFIG_PADRAO.map(function (l) { return { chave: l[0], valor: l[1], descricao: l[2] }; });
    function cfg(chave, valor) { config.forEach(function (c) { if (c.chave === chave) c.valor = valor; }); }
    var dados = {
      Config: config,
      Turnos: [{ turno: 'A', janelas: '07:00-07:30; 17:30-18:00' }, { turno: 'B', janelas: '19:00-19:30; 05:30-06:00' }],
      TiposEntrega: [
        { id: 'dds', nome: 'Participação no DDS', categoria: 'Segurança', pontos: 5, referencia: 'nao', formato_ref: '', dica_ref: '', ref_unica: 'nao', sorteavel: 'nao', max_por_dia: 1, selo: '', ativo: 'sim' },
        { id: 'check', nome: 'Check de segurança do turno', categoria: 'Segurança', pontos: 10, referencia: 'opcional', formato_ref: '', dica_ref: 'nº do check-list, se houver', ref_unica: 'nao', sorteavel: 'sim', max_por_dia: 2, selo: 'Guardião da Segurança', ativo: 'sim' },
        { id: 'treinamento', nome: 'Treinamento concluído', categoria: 'Treinamento', pontos: 5, referencia: 'obrigatoria', formato_ref: '', dica_ref: 'código da turma ou do certificado', ref_unica: 'nao', sorteavel: 'sim', max_por_dia: 0, selo: 'Sempre Aprendendo', ativo: 'sim' },
        { id: 'periodico', nome: 'Exame periódico em dia', categoria: 'Saúde', pontos: 5, referencia: 'nao', formato_ref: '', dica_ref: '', ref_unica: 'nao', sorteavel: 'nao', max_por_dia: 1, selo: '', ativo: 'sim' },
        { id: 'inspecao', nome: 'Inspeção registrada', categoria: 'Qualidade', pontos: 5, referencia: 'obrigatoria', formato_ref: '^[0-9]{5,10}$', dica_ref: 'nº da OS ou nota, de 5 a 10 dígitos', ref_unica: 'sim', sorteavel: 'sim', max_por_dia: 0, selo: 'Olho Clínico', ativo: 'sim' },
        { id: 'defeito', nome: 'Defeito identificado (reboque evitado)', categoria: 'Qualidade', pontos: 10, referencia: 'obrigatoria', formato_ref: '', dica_ref: 'nº da nota de defeito ou da OS', ref_unica: 'sim', sorteavel: 'sim', max_por_dia: 0, selo: 'Caça-Defeito', ativo: 'sim' },
        { id: 'kaizen', nome: 'Kaizen implantado', categoria: 'Melhoria', pontos: 15, referencia: 'obrigatoria', formato_ref: '', dica_ref: 'nº do kaizen', ref_unica: 'sim', sorteavel: 'sim', max_por_dia: 0, selo: 'Melhoria Contínua', ativo: 'sim' },
        { id: 'raf', nome: 'RAF entregue', categoria: 'Qualidade', pontos: 10, referencia: 'obrigatoria', formato_ref: '^[0-9]{3,6}$', dica_ref: 'nº da RAF, ex.: 0457', ref_unica: 'sim', sorteavel: 'sim', max_por_dia: 0, selo: 'Investigador', ativo: 'sim' }
      ],
      Pessoas: [],
      Registros: [], Perguntas: perguntasExemplo(agora, fuso, demo), Respostas: [], Apuracoes: [], AoVivo: []
    };
    if (!demo) {
      cfg('meta_coletiva_atual', '0');
      dados.Pessoas = [
        { id: 'lider', nome: 'Diego (administrador)', turno: 'A', papel: 'admin', pin: '1234', avatar: 'locomotiva', ativo: 'sim' },
        { id: 'pessoa1', nome: 'Pessoa de exemplo', turno: 'A', papel: 'equipe', pin: '0000', avatar: 'rodeiro', ativo: 'sim' }
      ];
      garantirCodigos(criarDbMemoria(dados));
      return dados;
    }

    // ---- Modo demonstração: equipe fictícia e três semanas de histórico ----
    cfg('janelas_ativas', 'nao');
    cfg('meta_coletiva_atual', '8');
    var equipe = [
      ['carlos', 'Carlos Mendes', 'A', '1111', 'rodeiro', 0.92],
      ['ana', 'Ana Paula', 'A', '2222', 'capacete', 1.12],
      ['rafael', 'Rafael Souza', 'B', '3333', 'engrenagem', 1.02],
      ['joao', 'João Victor', 'B', '4444', 'chave', 0.98],
      ['marcio', 'Márcio Lima', 'A', '5555', 'raio', 0.95],
      ['paula', 'Paula Rocha', 'B', '6666', 'lupa', 0.9],
      ['bruno', 'Bruno Teixeira', 'A', '7777', 'locomotiva', 0.8],
      ['thiago', 'Thiago Alves', 'B', '8888', 'trilho', 0.78],
      ['lucas', 'Lucas Ferreira', 'A', '9999', 'capacete', 0.74],
      ['sergio', 'Sérgio Nunes', 'B', '1010', 'engrenagem', 0.7]
    ];
    // Próxima sexta, para o aviso do Pit Stop aparecer na demonstração
    for (var dd = 1; dd <= 7; dd++) { if (partes(agora + dd * DIA, fuso).sem === 5) { cfg('apuracao_data', isoData(agora + dd * DIA, fuso)); break; } }
    dados.Pessoas.push({ id: 'diego', nome: 'Diego (administrador)', turno: 'A', papel: 'admin', pin: '1234', avatar: 'locomotiva', ativo: 'sim' });
    dados.Pessoas.push({ id: 'supervisor', nome: 'Supervisor (líder)', turno: 'A', papel: 'lider', pin: '2468', avatar: 'capacete', ativo: 'sim' });
    equipe.forEach(function (e) { dados.Pessoas.push({ id: e[0], nome: e[1], turno: e[2], papel: 'equipe', pin: e[3], avatar: e[4], ativo: 'sim' }); });
    garantirCodigos(criarDbMemoria(dados));

    var semente = 20261116;
    function rnd() { semente = (semente * 1103515245 + 12345) % 2147483648; return semente / 2147483648; }
    var db = criarDbMemoria(dados);
    var hoje = inicioDia(agora, fuso);
    // Sextas às 09:00 das três últimas semanas
    var sextas = [];
    for (var i = 1; i <= 28 && sextas.length < 3; i++) {
      var ts = hoje - i * DIA + 9 * 60 * MIN;
      if (partes(ts, fuso).sem === 5 && ts < agora) sextas.push(ts);
    }
    sextas.reverse();
    var inicio = sextas.length ? sextas[0] - 7 * DIA : hoje - 21 * DIA;
    var plano = [['dds', 0.8], ['check', 0.62], ['raf', 0.14], ['treinamento', 0.09], ['inspecao', 0.16], ['defeito', 0.06], ['kaizen', 0.025]];
    var refs = 400;
    var seq = 0;
    for (var dia = inicioDia(inicio, fuso); dia < hoje; dia += DIA) {
      equipe.forEach(function (e) {
        plano.forEach(function (pl) {
          if (rnd() > pl[1] * e[5]) return;
          var exec = dia + (7 * 60 + Math.floor(rnd() * 600)) * MIN;
          var valid = exec + (2 + Math.floor(rnd() * 20)) * 60 * MIN;
          if (valid > agora - 60 * MIN) valid = agora - 60 * MIN;
          var tipo = db.tabelas.TiposEntrega.filter(function (t) { return t.id === pl[0]; })[0];
          var atrasada = (pl[0] === 'raf' || pl[0] === 'treinamento') && rnd() < 0.18;
          var exige = tipo.referencia !== 'nao';
          var sort = exige && rnd() < 0.1;
          var ref = '';
          if (pl[0] === 'raf') ref = String(refs++).padStart(4, '0');
          else if (pl[0] === 'inspecao') ref = String(4500000 + Math.floor(rnd() * 99999));
          else if (pl[0] === 'treinamento') ref = 'T' + (100 + Math.floor(rnd() * 50));
          else if (pl[0] === 'defeito') ref = 'ND' + (7000 + seq);
          else if (pl[0] === 'kaizen') ref = 'KZ' + (300 + seq);
          var pts = atrasada ? Math.round(tipo.pontos / 2) : tipo.pontos;
          var naoConfere = sort && rnd() < 0.06;
          seq++;
          db.inserir('Registros', {
            id: 'r_demo' + seq, pessoa_id: e[0], tipo_id: pl[0], data_execucao: exec, criado_em: exec, referencia: ref,
            status: naoConfere ? 'recusada' : 'validada', pontos: naoConfere ? 0 : pts, atrasada: atrasada ? 'sim' : 'nao',
            sorteada: sort ? 'sim' : 'nao', conferencia: sort ? (naoConfere ? 'nao_confere' : 'confere') : '', alerta: '',
            validado_em: valid, validado_por: 'diego', celebrado: 'sim', obs: ''
          });
        });
        // Algumas respostas de quiz por semana
        if (partes(dia, fuso).sem === 2 && rnd() < 0.8 * e[5]) {
          seq++;
          db.inserir('Respostas', { id: 'q_demo' + seq, pessoa_id: e[0], pergunta_id: 'p_semana_antiga', resposta: 'A', correta: 'sim', pontos: 5, modo: 'normal', criado_em: dia + 12 * 60 * MIN });
        }
        if (partes(dia, fuso).sem === 5 && rnd() < 0.7) {
          seq++;
          db.inserir('AoVivo', { id: 'v_demo' + seq, sessao: 's_demo' + dia, pergunta_id: 'p_vivo1', pessoa_id: e[0], resposta: 'A', correta: rnd() < 0.7 ? 'sim' : 'nao', pontos: 2, criado_em: dia + 9 * 60 * MIN + 30 * MIN });
        }
      });
    }
    // Apurações das sextas passadas
    sextas.forEach(function (sx) {
      var ctx = criarCtx(db, { agora: sx });
      var a = apurar(ctx);
      db.inserir('Apuracoes', { id: 'a_demo' + sx, inicio: a.inicio, fim: sx, ranking: JSON.stringify({ semana: a.semana, mes: a.mes, destaques: a.destaques }), evoluiu: JSON.stringify(a.evoluiu), criado_por: 'diego' });
    });
    // Hoje: entregas aguardando o líder e uma celebração para o Carlos
    var h = agora - 50 * MIN;
    function reg(id, pessoa, tipo, quando, ref, extra) {
      db.inserir('Registros', Object.assign({ id: id, pessoa_id: pessoa, tipo_id: tipo, data_execucao: quando, criado_em: quando, referencia: ref || '', status: 'pendente', pontos: 0, atrasada: 'nao', sorteada: 'nao', conferencia: '', alerta: '', validado_em: '', validado_por: '', celebrado: 'nao', obs: '' }, extra || {}));
    }
    reg('r_hoje1', 'carlos', 'check', h, '');
    reg('r_hoje2', 'paula', 'dds', h - 5 * MIN, '');
    reg('r_hoje3', 'ana', 'raf', h - 26 * 60 * MIN, '0462', { sorteada: 'sim' });
    reg('r_hoje4', 'joao', 'raf', h - 3 * DIA, '0449');
    reg('r_hoje5', 'rafael', 'inspecao', h - 2 * 60 * MIN, '', { sorteada: 'sim' });
    reg('r_hoje6', 'carlos', 'dds', h - 40 * MIN, '', { status: 'validada', pontos: 5, validado_em: agora - 20 * MIN, validado_por: 'diego', celebrado: 'nao' });
    // Quiz do Carlos: acertou 1 e 2 da trilha e errou a 3 há dois dias (volta hoje)
    db.inserir('Respostas', { id: 'q_c1', pessoa_id: 'carlos', pergunta_id: 'p_trilha1', resposta: 'A', correta: 'sim', pontos: 5, modo: 'normal', criado_em: hoje - 6 * DIA + 8 * 60 * MIN });
    db.inserir('Respostas', { id: 'q_c2', pessoa_id: 'carlos', pergunta_id: 'p_trilha2', resposta: 'B', correta: 'sim', pontos: 5, modo: 'normal', criado_em: hoje - 4 * DIA + 8 * 60 * MIN });
    db.inserir('Respostas', { id: 'q_c3', pessoa_id: 'carlos', pergunta_id: 'p_trilha3', resposta: 'A', correta: 'nao', pontos: 0, modo: 'normal', criado_em: hoje - 2 * DIA + 8 * 60 * MIN });
    // Uma sugestão de pergunta esperando o líder
    db.inserir('Perguntas', { id: 'p_sug1', categoria: '', tipo: 'multipla', texto: 'Qual foi a causa raiz da trinca no aro do rodeiro na RAF 0451?', a: 'Fadiga por sobrecarga térmica na frenagem', b: 'Defeito de pintura', c: 'Erro de digitação na OS', d: 'Falta de lubrificação do engate', correta: 'A', explicacao: 'A RAF 0451 apontou sobrecarga térmica na frenagem como causa raiz (exemplo).', fonte: 'RAF 0451, item 4 (exemplo)', trilha: '', ordem: '', abre_em: '', fecha_em: '', pontos: 5, status: 'sugestao', autor_id: 'carlos', criado_em: agora - DIA });
    return db.tabelas;
  }

  var api = {
    VERSAO: VERSAO, TABELAS: TABELAS, CAMPOS_DATA: CAMPOS_DATA, CAMPOS_TEXTO: CAMPOS_TEXTO, AVATARES: AVATARES,
    SOMENTE_LEITURA: SOMENTE_LEITURA, CONFIG_PADRAO: CONFIG_PADRAO,
    executar: executar, criarDbMemoria: criarDbMemoria, dadosIniciais: dadosIniciais, garantirCodigos: garantirCodigos,
    _interno: { nivelPonto: nivelPonto, selosDaPessoa: selosDaPessoa, inicioSemana: inicioSemana, inicioDia: inicioDia, partes: partes, lerData: lerData, estadoJanela: estadoJanela, criarCtx: criarCtx }
  };
  return api;
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Logica;
