/* Pro10 — ícones e avatares (traços simples em SVG) */
var Icones = (function () {
  'use strict';
  var P = {
    inicio: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    marcar: '<circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.8 2.8L16.5 9"/>',
    quiz: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.4c-.6.3-1 .8-1 1.5v.4"/><path d="M12 16.8v.2"/>',
    trofeu: '<path d="M8 4h8v6a4 4 0 0 1-8 0z"/><path d="M8 6H5v1a3 3 0 0 0 3 3"/><path d="M16 6h3v1a3 3 0 0 1-3 3"/><path d="M12 14v3"/><path d="M8 21h8"/><path d="M9.5 17h5"/>',
    perfil: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    escudo: '<path d="M12 3 4.5 6v5.5c0 4.5 3.2 8 7.5 9.5 4.3-1.5 7.5-5 7.5-9.5V6z"/><path d="m9 12 2.2 2.2L15 10.5"/>',
    tv: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8"/><path d="M12 16v4"/>',
    ajustes: '<path d="M4 6h9"/><path d="M17 6h3"/><circle cx="15" cy="6" r="2"/><path d="M4 12h3"/><path d="M11 12h9"/><circle cx="9" cy="12" r="2"/><path d="M4 18h11"/><path d="M19 18h1"/><circle cx="17" cy="18" r="2"/>',
    vivo: '<circle cx="12" cy="12" r="2.5"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4"/><path d="M16.2 7.8a6 6 0 0 1 0 8.4"/><path d="M5 5a10 10 0 0 0 0 14"/><path d="M19 5a10 10 0 0 1 0 14"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
    x: '<path d="M6 6l12 12"/><path d="M18 6 6 18"/>',
    relogio: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    cadeado: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    voltar: '<path d="m15 6-6 6 6 6"/>',
    seta: '<path d="m9 6 6 6-6 6"/>',
    doc: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/><path d="M10 12h5"/><path d="M10 16h5"/>',
    docmais: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/><path d="M12 11v6"/><path d="M9 14h6"/>',
    livro: '<path d="M4 5a2 2 0 0 1 2-2h5v17H6a2 2 0 0 0-2 2z"/><path d="M20 5a2 2 0 0 0-2-2h-5v17h5a2 2 0 0 1 2 2z"/>',
    repetir: '<path d="M20 11a8 8 0 0 0-14.5-4.5L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.5 4.5L20 16"/><path d="M20 20v-4h-4"/>',
    bau: '<rect x="3" y="9" width="18" height="11" rx="1.5"/><path d="M3 9a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4"/><path d="M3 13h18"/><rect x="10.5" y="11.5" width="3" height="4" rx="1"/>',
    estrela: '<path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6L12 16.7l-5.4 2.9 1.1-6-4.5-4.2 6.1-.8z"/>',
    pessoas: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 4.8a3.2 3.2 0 0 1 0 6.2"/><path d="M18 14.5a5.5 5.5 0 0 1 3 5.5"/>',
    subindo: '<path d="M3 17 9 11l4 4 8-8"/><path d="M15 7h6v6"/>',
    presente: '<path d="M4 11h16v9H4z"/><path d="M3 7h18v4H3z"/><path d="M12 7v13"/><path d="M12 7c-1.5-3-5-3-5-1s3 1 5 1c2 0 5 1 5-1s-3.5-2-5 1"/>',
    alerta: '<path d="M12 3 2 20h20z"/><path d="M12 10v4"/><path d="M12 17v.2"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8v.2"/>',
    sair: '<path d="M15 4h4v16h-4"/><path d="M10 8l-4 4 4 4"/><path d="M6 12h10"/>',
    copiar: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/>',
    capacete: '<path d="M3 17h18"/><path d="M5 17v-2a7 7 0 0 1 14 0v2"/><path d="M10 8V5h4v3"/>',
    mais: '<path d="M12 5v14"/><path d="M5 12h14"/>'
  };

  var AVATARES = {
    rodeiro: { nome: 'Rodeiro', cor: '#C2410C', d: 'M3 7a2 2 0 0 1 4 0v10a2 2 0 0 1-4 0zM17 7a2 2 0 0 1 4 0v10a2 2 0 0 1-4 0zM7 12h10' },
    capacete: { nome: 'Capacete', cor: '#1F7A4D', d: 'M3 17h18M5 17v-2a7 7 0 0 1 14 0v2M10 8V5h4v3' },
    engrenagem: { nome: 'Engrenagem', cor: '#3B5168', d: 'M15.5 12a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0zM12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1' },
    chave: { nome: 'Chave', cor: '#1D5FA8', d: 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z' },
    raio: { nome: 'Elétrica', cor: '#6D4C9F', d: 'M13 3 5 14h6l-1 7 8-11h-6z' },
    lupa: { nome: 'Inspeção', cor: '#8A5A2B', d: 'M17 11a6 6 0 1 1-12 0 6 6 0 0 1 12 0zM20 20l-4.5-4.5' },
    locomotiva: { nome: 'Locomotiva', cor: '#14212E', d: 'M3 7h14v9H3zM17 10h3l1 3v3h-4M6 7V4h5v3M9 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM17 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0z' },
    trilho: { nome: 'Trilho', cor: '#5B6670', d: 'M7 3v18M17 3v18M5 7h14M5 12h14M5 17h14' }
  };

  function icone(nome, tam, cor, largura) {
    tam = tam || 24;
    return '<svg aria-hidden="true" width="' + tam + '" height="' + tam + '" viewBox="0 0 24 24" fill="none" stroke="' + (cor || 'currentColor') +
      '" stroke-width="' + (largura || 1.9) + '" stroke-linecap="round" stroke-linejoin="round">' + (P[nome] || '') + '</svg>';
  }
  function avatar(id, tam, anel) {
    var a = AVATARES[id] || AVATARES.rodeiro;
    tam = tam || 40;
    var t = Math.round(tam * 0.52);
    return '<span class="avatar' + (anel ? ' anel' : '') + '" style="width:' + tam + 'px;height:' + tam + 'px;background:' + a.cor + '">' +
      '<svg aria-hidden="true" width="' + t + '" height="' + t + '" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="' + a.d + '"/></svg></span>';
  }
  return { icone: icone, avatar: avatar, AVATARES: AVATARES };
})();
