/* Damas — controlador de la interfaz y del flujo de partida. */
(function () {
  'use strict';

  var D = window.Damas, AI = window.DamasAI, V = window.Voz, S = window.Sonido;
  var CLAVE = 'damas-espanolas-v1';

  var estado = {
    juego: null,
    movidas: [],
    seleccion: null,
    ocupado: false,
    token: 0,
    focoSq: 0,
    nivel: 'medio',
    espera: 5000,
    velocidad: 1,
    voz: true,
    sonido: true,
    soplo: false,
    reducido: false,
    ultimoAnuncio: ''
  };

  var el = {};
  var celdas = [];
  var fichasEl = new Map();
  var temporizadores = [];

  /* --- Construcción del tablero (SVG) ----------------------------------- */

  function crearTablero() {
    el.tablero.innerHTML = '';
    construirCapaTablero();
    celdas = new Array(64);
    for (var r = 7; r >= 0; r--) {
      var fila = document.createElement('div');
      fila.className = 'fila';
      fila.setAttribute('role', 'row');
      for (var c = 0; c < 8; c++) {
        var i = D.idxOf(r, c);
        var celda = document.createElement('div');
        celda.className = 'casilla ' + (D.isPlayable(i) ? 'oscura' : 'clara');
        celda.setAttribute('role', 'gridcell');
        celda.setAttribute('data-coord', D.squareName(i));
        celda.dataset.sq = String(i);
        celda.tabIndex = -1;
        celda.addEventListener('click', alPulsarCelda);
        celda.addEventListener('focus', alEnfocarCelda);
        celda.addEventListener('keydown', alTeclearCelda);
        fila.appendChild(celda);
        celdas[i] = celda;
      }
      el.tablero.appendChild(fila);
    }
    construirCapaFichas();
  }

  var NS_SVG = 'http://www.w3.org/2000/svg';
  var CORONA_PATH = 'M3 8.2l4.2 2.9L12 4.6l4.8 6.5L21 8.2l-1.7 9.6H4.7L3 8.2zm2 11.2h14v1.9H5v-1.9z';

  var DEFS_TABLERO =
    '<linearGradient id="gClara" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0" stop-color="#f6ebcd"/><stop offset="1" stop-color="#dfc89e"/></linearGradient>' +
    '<linearGradient id="gOscura" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0" stop-color="#7c4f30"/><stop offset="0.55" stop-color="#5b3a22"/><stop offset="1" stop-color="#432916"/></linearGradient>' +
    '<radialGradient id="gBrillo" cx="0.32" cy="0.26" r="0.95">' +
    '<stop offset="0" stop-color="#ffffff" stop-opacity="0.08"/><stop offset="0.65" stop-color="#ffffff" stop-opacity="0"/></radialGradient>' +
    '<radialGradient id="gBlanca" cx="0.35" cy="0.3" r="0.85">' +
    '<stop offset="0" stop-color="#fffdf4"/><stop offset="0.45" stop-color="#f3e6ca"/><stop offset="0.75" stop-color="#dcc49c"/><stop offset="1" stop-color="#b3945f"/></radialGradient>' +
    '<radialGradient id="gNegra" cx="0.35" cy="0.3" r="0.85">' +
    '<stop offset="0" stop-color="#737d8b"/><stop offset="0.42" stop-color="#333c46"/><stop offset="0.75" stop-color="#161c23"/><stop offset="1" stop-color="#05080b"/></radialGradient>' +
    '<linearGradient id="gCorona" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0" stop-color="#f8e08e"/><stop offset="1" stop-color="#c9971f"/></linearGradient>' +
    '<filter id="fSombra" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="3.2"/></filter>' +
    '<filter id="fVina" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="10"/></filter>' +
    '<clipPath id="clipTablero"><rect x="0" y="0" width="800" height="800" rx="10"/></clipPath>';

  function constructorSVG(tag, attrs) {
    var n = document.createElementNS(NS_SVG, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  function construirCapaTablero() {
    var svg = constructorSVG('svg', {
      viewBox: '0 0 800 800',
      'class': 'capa-tablero',
      'aria-hidden': 'true',
      focusable: 'false'
    });
    var defs = document.createElementNS(NS_SVG, 'defs');
    defs.innerHTML = DEFS_TABLERO;
    svg.appendChild(defs);

    /* Casillas */
    for (var r = 0; r < 8; r++) {
      for (var c = 0; c < 8; c++) {
        var i = D.idxOf(r, c);
        var y = (7 - r) * 100;
        svg.appendChild(constructorSVG('rect', {
          x: c * 100, y: y, width: 100, height: 100,
          fill: D.isPlayable(i) ? 'url(#gOscura)' : 'url(#gClara)'
        }));
        if (D.isPlayable(i)) {
          svg.appendChild(constructorSVG('rect', {
            x: c * 100, y: y, width: 100, height: 100, fill: 'url(#gBrillo)'
          }));
        }
      }
    }

    /* Viñeta interior, grano y borde */
    var g = constructorSVG('g', { 'clip-path': 'url(#clipTablero)' });
    g.appendChild(constructorSVG('rect', {
      x: 0, y: 0, width: 800, height: 800, rx: 10,
      fill: 'none', stroke: 'rgba(0,0,0,0.55)', 'stroke-width': 30, filter: 'url(#fVina)'
    }));
    g.appendChild(constructorSVG('rect', {
      x: 0, y: 0, width: 800, height: 800, filter: 'url(#fVina)',
      fill: '#000', opacity: 0.05
    }));
    var grano = constructorSVG('rect', {
      x: 0, y: 0, width: 800, height: 800,
      filter: 'url(#fVina)', fill: '#000', opacity: 0
    });
    grano.setAttribute('filter', 'none');
    grano.parentNode && g.appendChild(grano); /* placeholder eliminable */
    if (grano.parentNode) grano.parentNode.removeChild(grano);
    g.appendChild(grano);
    svg.appendChild(g);

    var borde = constructorSVG('rect', {
      x: 1, y: 1, width: 798, height: 798, rx: 9,
      fill: 'none', stroke: 'rgba(255,255,255,0.14)', 'stroke-width': 2
    });
    svg.appendChild(borde);

    /* Coordenadas: letras abajo, números a la izquierda */
    var FILES = 'abcdefgh';
    for (var cc = 0; cc < 8; cc++) {
      var oscura = D.isPlayable(D.idxOf(0, cc));
      var t = constructorSVG('text', {
        x: cc * 100 + 50, y: 794,
        'text-anchor': 'middle', 'font-size': 15,
        'font-family': '"Segoe UI", system-ui, sans-serif', 'font-weight': 600,
        fill: oscura ? 'rgba(244,230,205,0.6)' : 'rgba(90,64,38,0.6)'
      });
      t.textContent = FILES[cc];
      t.style.pointerEvents = 'none';
      svg.appendChild(t);
    }
    for (var rr = 0; rr < 8; rr++) {
      var osc = D.isPlayable(D.idxOf(rr, 0));
      var tn = constructorSVG('text', {
        x: 8, y: (7 - rr) * 100 + 18,
        'text-anchor': 'start', 'font-size': 15,
        'font-family': '"Segoe UI", system-ui, sans-serif', 'font-weight': 600,
        fill: osc ? 'rgba(244,230,205,0.6)' : 'rgba(90,64,38,0.6)'
      });
      tn.textContent = String(rr + 1);
      tn.style.pointerEvents = 'none';
      svg.appendChild(tn);
    }

    el.tablero.appendChild(svg);
    el.capaTablero = svg;
  }

  function construirCapaFichas() {
    var svg = constructorSVG('svg', {
      viewBox: '0 0 800 800',
      'class': 'capa-fichas',
      'aria-hidden': 'true',
      focusable: 'false'
    });
    el.tablero.appendChild(svg);
    el.capaFichas = svg;
  }

  function alEnfocarCelda(ev) {
    var i = Number(ev.currentTarget.dataset.sq);
    if (estado.focoSq !== i) {
      estado.focoSq = i;
      actualizarFoco();
    }
  }

  function alTeclearCelda(ev) {
    var i = Number(ev.currentTarget.dataset.sq);
    var k = ev.key;
    if (k === 'Enter' || k === ' ' || k === 'Spacebar') {
      ev.preventDefault();
      activarCasilla(i);
      return;
    }
    if (k === 'Escape') {
      ev.preventDefault();
      if (estado.seleccion != null) {
        estado.seleccion = null;
        actualizarCeldas();
        aviso('Selección cancelada.');
      }
      return;
    }
    var dr = 0, dc = 0;
    if (k === 'ArrowUp') dr = 1;
    else if (k === 'ArrowDown') dr = -1;
    else if (k === 'ArrowLeft') dc = -1;
    else if (k === 'ArrowRight') dc = 1;
    else if (k === 'Home') { ev.preventDefault(); enfocar(D.idxOf(D.rowOf(i), 0)); return; }
    else if (k === 'End') { ev.preventDefault(); enfocar(D.idxOf(D.rowOf(i), 7)); return; }
    if (!dr && !dc) return;
    ev.preventDefault();
    var r = D.rowOf(i) + dr, c = D.colOf(i) + dc;
    if (r < 0) r = 0; else if (r > 7) r = 7;
    if (c < 0) c = 0; else if (c > 7) c = 7;
    enfocar(D.idxOf(r, c));
  }

  function enfocar(i) {
    estado.focoSq = i;
    actualizarFoco();
    if (celdas[i]) celdas[i].focus();
  }

  function actualizarFoco() {
    for (var i = 0; i < 64; i++) celdas[i].tabIndex = i === estado.focoSq ? 0 : -1;
  }

  /* Con soplido se pueden elegir también movimientos simples aunque exista
     captura obligatoria: al ejecutarlos se produce una omisión. */
  function jugables() {
    if (!estado.soplo) return estado.movidas;
    return D.generatePermissiveMoves(estado.juego.board, estado.juego.turn);
  }

  function hayCaptura() {
    return estado.movidas.length > 0 && estado.movidas[0].captures.length > 0;
  }

  /* --- Pintado --------------------------------------------------------- */

  /* --- Fichas SVG ------------------------------------------------------- */

  function fichaPos(i) {
    return 'translate(' + (D.colOf(i) * 100) + 'px, ' + ((7 - D.rowOf(i)) * 100) + 'px)';
  }

  function crearFichaSvg(p) {
    var blanca = D.isWhite(p);
    var dama = D.isKing(p);
    var g = constructorSVG('g', {
      'class': 'fichaSvg ' + (blanca ? 'blanca' : 'negra') + (dama ? ' dama' : '')
    });
    var cuerpo = constructorSVG('g', { 'class': 'cuerpo' });

    /* Sombra proyectada */
    cuerpo.appendChild(constructorSVG('ellipse', {
      cx: 50, cy: 83, rx: 31, ry: 8,
      fill: '#000', opacity: blanca ? 0.32 : 0.45, filter: 'url(#fSombra)'
    }));

    /* Cuerpo con degradado */
    cuerpo.appendChild(constructorSVG('circle', {
      cx: 50, cy: 48, r: 37,
      fill: blanca ? 'url(#gBlanca)' : 'url(#gNegra)',
      stroke: blanca ? '#9c7f52' : '#0a0e12',
      'stroke-width': 2
    }));

    /* Surcos concéntricos */
    cuerpo.appendChild(constructorSVG('circle', {
      cx: 50, cy: 48, r: 29, fill: 'none',
      stroke: blanca ? 'rgba(120,88,44,0.28)' : 'rgba(255,255,255,0.12)',
      'stroke-width': 1.4
    }));
    cuerpo.appendChild(constructorSVG('circle', {
      cx: 50, cy: 48, r: 21, fill: 'none',
      stroke: blanca ? 'rgba(120,88,44,0.18)' : 'rgba(255,255,255,0.07)',
      'stroke-width': 1
    }));

    /* Reflejo especular */
    cuerpo.appendChild(constructorSVG('ellipse', {
      cx: 38, cy: 32, rx: 15, ry: 10,
      fill: '#fff', opacity: blanca ? 0.28 : 0.14,
      transform: 'rotate(-28 38 32)'
    }));

    if (dama) {
      cuerpo.appendChild(constructorSVG('circle', {
        cx: 50, cy: 48, r: 29, fill: 'none',
        stroke: 'url(#gCorona)', 'stroke-width': 2.5
      }));
      var corona = constructorSVG('g', { transform: 'translate(26,24) scale(2)' });
      corona.appendChild(constructorSVG('path', {
        d: CORONA_PATH,
        fill: 'url(#gCorona)',
        stroke: 'rgba(80,52,8,0.55)',
        'stroke-width': 0.8
      }));
      cuerpo.appendChild(corona);
    }

    g.appendChild(cuerpo);
    return g;
  }

  function pintarFichas() {
    el.capaFichas.innerHTML = '';
    fichasEl = new Map();
    for (var i = 0; i < 64; i++) {
      var p = estado.juego.board[i];
      if (!p) continue;
      var ficha = crearFichaSvg(p);
      ficha.style.transform = fichaPos(i);
      el.capaFichas.appendChild(ficha);
      fichasEl.set(i, ficha);
    }
  }

  /* --- Efectos ---------------------------------------------------------- */

  function anilloEfecto(sq, dur, color, sw) {
    if (estado.reducido) return;
    var r = constructorSVG('circle', {
      cx: D.colOf(sq) * 100 + 50,
      cy: (7 - D.rowOf(sq)) * 100 + 50,
      r: 26, fill: 'none', stroke: color, 'stroke-width': String(sw || 4)
    });
    r.style.opacity = '0.9';
    r.style.transformBox = 'fill-box';
    r.style.transformOrigin = 'center';
    el.capaFichas.appendChild(r);
    var anim = r.animate(
      [{ transform: 'scale(0.5)', opacity: 0.95 }, { transform: 'scale(2.4)', opacity: 0 }],
      { duration: dur || 450, easing: 'cubic-bezier(.2,.6,.35,1)', fill: 'forwards' }
    );
    anim.onfinish = function () { r.remove(); };
  }

  function animarCaptura(sq) {
    var ficha = fichasEl.get(sq);
    if (!ficha) return;
    fichasEl.delete(sq);
    el.capaFichas.appendChild(ficha);
    var cuerpo = ficha.querySelector('.cuerpo') || ficha;
    if (estado.reducido) { ficha.remove(); return; }
    anilloEfecto(sq, 470, '#f3c969', 4);
    var anim = cuerpo.animate([
      { transform: 'scale(1) rotate(0deg) translateY(0)', opacity: 1 },
      { transform: 'scale(1.14) rotate(9deg) translateY(-7px)', opacity: 1, offset: 0.32 },
      { transform: 'scale(0.1) rotate(-30deg) translateY(12px)', opacity: 0 }
    ], { duration: 440, easing: 'cubic-bezier(.4,.05,.55,.95)', fill: 'forwards' });
    anim.onfinish = function () { ficha.remove(); };
  }

  function destelloPromocion(sq) {
    anilloEfecto(sq, 520, '#f8e08e', 5);
  }

  /* --- Animación de movimiento ------------------------------------------ */

  function animar(movida) {
    return new Promise(function (resolve) {
      var ficha = fichasEl.get(movida.from);
      if (!ficha) { resolve(); return; }
      fichasEl.delete(movida.from);
      el.capaFichas.appendChild(ficha); /* por encima del resto */
      ficha.classList.add('moviendo');

      if (estado.reducido) {
        ficha.style.transition = 'none';
        ficha.style.transform = fichaPos(movida.to);
        ficha.classList.remove('moviendo');
        resolve();
        return;
      }

      var path = movida.path || [movida.from, movida.to];
      var k = 0;
      var animVuelo = null;

      function limpiarAnim() {
        if (animVuelo) {
          try { animVuelo.cancel(); } catch (e) { /* sin animación */ }
          animVuelo = null;
        }
      }

      function paso() {
        if (k >= path.length - 1) { fin(); return; }
        var desde = path[k], hasta = path[k + 1];
        var dist = Math.max(
          Math.abs(D.rowOf(hasta) - D.rowOf(desde)),
          Math.abs(D.colOf(hasta) - D.colOf(desde))
        ) || 1;
        var dur = Math.min(500, 200 + dist * 130);
        if (movida.captures && movida.captures.length > k && movida.captures[k] != null) {
          animarCaptura(movida.captures[k]);
        }
        ficha.style.transform = fichaPos(desde);
        ficha.style.transition = '';
        animVuelo = ficha.animate(
          [{ transform: fichaPos(desde) }, { transform: fichaPos(hasta) }],
          { duration: dur, easing: 'cubic-bezier(.3,.7,.25,1)', fill: 'forwards' }
        );
        var actual = animVuelo;
        actual.onfinish = function () {
          if (actual !== animVuelo) return;
          ficha.style.transform = fichaPos(hasta);
          limpiarAnim();
          k++;
          paso();
        };
      }

      function fin() {
        limpiarAnim();
        ficha.style.transform = fichaPos(movida.to);
        ficha.classList.remove('moviendo');
        ficha.style.transition = '';
        if (movida.promote) {
          destelloPromocion(movida.to);
          setTimeout(resolve, 480);
        } else {
          setTimeout(resolve, 40);
        }
      }

      paso();
    });
  }

  function actualizarCeldas() {
    var g = estado.juego;
    var destinos = {};
    var esCaptura = {};
    var esOmision = {};
    var lista = jugables();
    var obligatoria = hayCaptura();
    if (estado.seleccion != null) {
      for (var k = 0; k < lista.length; k++) {
        var m = lista[k];
        if (m.from !== estado.seleccion) continue;
        destinos[m.to] = true;
        if (m.captures.length) esCaptura[m.to] = true;
        else if (obligatoria) esOmision[m.to] = true;
      }
    }
    var ultima = g.lastMove;
    for (var i = 0; i < 64; i++) {
      var celda = celdas[i];
      var clases = 'casilla ' + (D.isPlayable(i) ? 'oscura' : 'clara');
      if (i === estado.seleccion) clases += ' seleccionada';
      if (destinos[i]) clases += ' jugada' + (esCaptura[i] ? ' captura' : esOmision[i] ? ' omision' : '');
      if (ultima && (i === ultima.from || i === ultima.to)) clases += ' ultima';
      if (celda.className !== clases) celda.className = clases;
      celda.tabIndex = i === estado.focoSq ? 0 : -1;
      var etiqueta = D.squareDescription(g.board, i, lista);
      if (estado.seleccion === i) etiqueta += ', seleccionada';
      if (destinos[i]) {
        etiqueta += esCaptura[i] ? ', captura legal'
          : esOmision[i] ? ', jugada sin captura, expuesta a soplido' : ', jugada legal';
      }
      if (ultima && (i === ultima.from || i === ultima.to)) etiqueta += ', última jugada';
      celda.setAttribute('aria-label', etiqueta);
      if (i === estado.seleccion) celda.setAttribute('aria-selected', 'true');
      else celda.removeAttribute('aria-selected');
      if (D.isPlayable(i)) celda.removeAttribute('aria-disabled');
      else celda.setAttribute('aria-disabled', 'true');
    }
  }

  function actualizarEstado(pensando) {
    var g = estado.juego;
    var txt;
    if (g.status === 'over') {
      txt = D.resultText(g) + ' ' + (g.reason ? '(' + g.reason + ')' : '');
    } else if (g.turn === 'b' || pensando || estado.ocupado) {
      txt = 'Turno de las negras · la máquina está pensando…';
    } else {
      txt = 'Tu turno · blancas ' + D.countPieces(g.board, 'w') + ' fichas · negras ' +
        D.countPieces(g.board, 'b') + ' fichas';
      if (hayCaptura()) txt += ' · captura obligatoria';
    }
    el.estado.textContent = txt;
    el.estado.classList.toggle('pensando', g.status !== 'over' && (g.turn === 'b' || pensando || estado.ocupado));
  }

  function pintarRegistro() {
    var g = estado.juego;
    var lineas = ['Damas españolas — Blancas (tú) vs Negras (máquina)', ''];
    for (var i = 0; i < g.history.length; i++) {
      lineas.push((i + 1) + '. ' + g.history[i].description);
      if (g.history[i].blowText) lineas.push('   ' + g.history[i].blowText);
    }
    if (g.status === 'over') {
      lineas.push('');
      lineas.push(D.resultText(g) + (g.reason ? ' (' + g.reason + ')' : ''));
    }
    el.registro.value = lineas.join('\n');
    if (document.activeElement !== el.registro) el.registro.scrollTop = el.registro.scrollHeight;
  }

  /* --- Mensajes -------------------------------------------------------- */

  function aviso(texto) {
    el.detalle.textContent = texto;
    el.error.textContent = '';
    anunciar(texto);
  }

  function mostrarError(texto) {
    el.error.textContent = texto;
    el.detalle.textContent = '';
    anunciar(texto);
    S.error();
    el.entrada.focus();
  }

  function limpiarError() {
    el.error.textContent = '';
  }

  function anunciar(texto) {
    estado.ultimoAnuncio = texto;
    V.say(texto);
  }

  /* --- Selección y jugadas --------------------------------------------- */

  function alPulsarCelda(ev) {
    activarCasilla(Number(ev.currentTarget.dataset.sq));
  }

  function activarCasilla(i) {
    if (estado.ocupado) { aviso('Espera un momento, la jugada está en curso.'); return; }
    var g = estado.juego;
    if (g.status === 'over') { aviso('La partida ha terminado. Pulsa Nueva partida para jugar otra vez.'); return; }
    if (g.turn !== 'w') { aviso('Espera, es el turno de las negras.'); return; }
    if (!D.isPlayable(i)) { aviso('La casilla ' + D.squareName(i) + ' es clara y no se usa en el juego.'); return; }

    var p = g.board[i];
    if (estado.seleccion == null) {
      if (!p) { aviso('La casilla ' + D.squareName(i) + ' está vacía.'); return; }
      if (!D.isWhite(p)) { aviso('Esa ficha es negra. Tú mueves con las blancas.'); return; }
      seleccionar(i);
      return;
    }
    if (i === estado.seleccion) {
      estado.seleccion = null;
      actualizarCeldas();
      aviso('Selección cancelada.');
      return;
    }
    if (p && D.isWhite(p)) { seleccionar(i); return; }

    var candidatas = [];
    var lista = jugables();
    for (var k = 0; k < lista.length; k++) {
      var m = lista[k];
      if (m.from === estado.seleccion && m.to === i) candidatas.push(m);
    }
    if (!candidatas.length) {
      explicarDestino(estado.seleccion, i);
      return;
    }
    if (candidatas.length > 1) {
      aviso('Esa jugada es ambigua. Escribe la ruta completa: ' +
        candidatas.map(D.notation).join(' o ') + '.');
      return;
    }
    estado.seleccion = null;
    actualizarCeldas();
    ejecutarJugadaUsuario(candidatas[0]);
  }

  function seleccionar(i) {
    var lista = jugables();
    var propias = [];
    for (var k = 0; k < lista.length; k++) {
      if (lista[k].from === i) propias.push(lista[k]);
    }
    if (!propias.length) {
      if (hayCaptura() && !estado.soplo) {
        aviso('Esa ficha no puede mover. Hay captura obligatoria: ' +
          D.listNotations(estado.movidas) + '.');
      } else {
        aviso('Esa ficha no tiene jugadas legales ahora mismo.');
      }
      return;
    }
    estado.seleccion = i;
    actualizarCeldas();
    var texto = D.squareDescription(estado.juego.board, i, lista) +
      '. Selecciona el destino o escribe la jugada.';
    var tieneQuieta = propias.some(function (m) { return m.captures.length === 0; });
    if (estado.soplo && hayCaptura() && tieneQuieta) {
      texto += ' Atención: hay captura obligatoria. Si no comes, la máquina podrá soplar ' +
        'la ficha que debía comer.';
    }
    aviso(texto);
  }

  function explicarDestino(desde, hasta) {
    var lista = jugables();
    var propias = [];
    for (var k = 0; k < lista.length; k++) {
      if (lista[k].from === desde) propias.push(lista[k]);
    }
    var msg;
    if (!propias.length) {
      msg = 'Esa ficha no tiene jugadas legales.';
    } else {
      var destinos = [];
      propias.forEach(function (m) {
        var n = D.squareName(m.to);
        if (destinos.indexOf(n) < 0) destinos.push(n);
      });
      msg = 'Desde ' + D.squareName(desde) + ' no puedes ir a ' + D.squareName(hasta) +
        '. Puedes ir a ' + destinos.join(', ') + '.';
    }
    mostrarError(msg);
  }

  function ejecutarJugadaUsuario(movida) {
    if (estado.ocupado) return;
    estado.ocupado = true;
    limpiarError();
    el.detalle.textContent = '';
    var t0 = now();

    var victimas = null;
    if (estado.soplo && D.isOmission(estado.juego.board, estado.juego.turn, movida)) {
      victimas = [];
      for (var k = 0; k < estado.movidas.length; k++) {
        var m = estado.movidas[k];
        if (m.captures.length && victimas.indexOf(m.from) < 0) victimas.push(m.from);
      }
    }

    var res = aplicarJugada(movida, victimas);
    anunciar(textoTrasJugada(res.entry));
    if (res.entry.blowText) el.detalle.textContent = res.entry.blowText;
    res.anim.then(function () {
      if (res.entry.blow) {
        desvanecerSoplada(res.entry, movida, function () {
          cerrarTurnoUsuario(res, t0);
        });
      } else {
        cerrarTurnoUsuario(res, t0);
      }
    });
  }

  function cerrarTurnoUsuario(res, t0) {
    pintarFichas();
    actualizarCeldas();
    actualizarFoco();
    estado.ocupado = false;
    if (estado.juego.status === 'over') { finalizar(); return; }
    programarMaquina(t0);
  }

  function desvanecerSoplada(entry, movida, callback) {
    var sq = entry.blow.sq;
    var ficha = sq === movida.to ? fichasEl.get(movida.from) : fichasEl.get(sq);
    if (!ficha || estado.reducido) { callback(); return; }
    fichasEl.delete(sq === movida.to ? movida.from : sq);
    el.capaFichas.appendChild(ficha);
    anilloEfecto(sq, 460, '#cfd8e3', 3);
    var cuerpo = ficha.querySelector('.cuerpo') || ficha;
    var anim = cuerpo.animate([
      { transform: 'scale(1) rotate(0deg)', opacity: 1 },
      { transform: 'scale(1.1)', opacity: 0.85, offset: 0.3 },
      { transform: 'scale(0.12) rotate(-22deg) translateY(10px)', opacity: 0 }
    ], { duration: 430, easing: 'ease-in', fill: 'forwards' });
    anim.onfinish = function () { ficha.remove(); setTimeout(callback, 60); };
  }

  function textoBlow(sq, pieza) {
    return 'Negras soplan la ficha de ' + D.squareName(sq) + ' (' +
      D.pieceName(pieza) + ' ' + D.pieceColorName(pieza) + ').';
  }

  function elegirSoplo(candidatas) {
    var mejor = null, mejorValor = -Infinity;
    for (var k = 0; k < candidatas.length; k++) {
      var sq = candidatas[k];
      var pieza = estado.juego.board[sq];
      if (!pieza) continue;
      estado.juego.board[sq] = D.EMPTY;
      var valor = AI.evaluate(estado.juego.board, 'b');
      estado.juego.board[sq] = pieza;
      if (valor > mejorValor) { mejorValor = valor; mejor = sq; }
    }
    return mejor;
  }

  function aplicarJugada(movida, victimas) {
    var anim = animar(movida);
    var entry = D.playMove(estado.juego, movida);

    if (victimas && victimas.length && !movida.captures.length) {
      entry.omission = true;
      entry.description += ' Omite la captura obligatoria.';
      var candidatas = [];
      for (var k = 0; k < victimas.length; k++) {
        var sq = victimas[k] === movida.from ? movida.to : victimas[k];
        if (candidatas.indexOf(sq) < 0) candidatas.push(sq);
      }
      var victima = elegirSoplo(candidatas);
      if (victima != null) {
        var pieza = estado.juego.board[victima];
        estado.juego.board[victima] = D.EMPTY;
        entry.blow = { sq: victima, piece: pieza };
        entry.blowText = textoBlow(victima, pieza);
        D.updateStatus(estado.juego);
      }
    }

    estado.movidas = D.generateMoves(estado.juego.board, estado.juego.turn);
    estado.seleccion = null;
    actualizarCeldas();
    actualizarEstado();
    pintarRegistro();
    guardar();
    if (entry.blow) S.soplo();
    else if (entry.move.captures.length) S.comer();
    else if (entry.move.promote) S.coronar();
    else S.mover();
    return { entry: entry, anim: anim };
  }

  function textoTrasJugada(entry) {
    var g = estado.juego;
    var txt = entry.description;
    if (entry.blowText) txt += ' ' + entry.blowText;
    if (g.status === 'over') {
      txt += ' ' + D.resultText(g) + (g.reason ? ' (' + g.reason + ').' : '');
    } else if (g.turn === 'b') {
      txt += ' Turno de negras. La máquina está pensando.';
    } else {
      txt += ' Tu turno.';
    }
    return txt;
  }

  function programarMaquina(t0) {
    var token = ++estado.token;
    var espera = estado.espera;
    estado.ocupado = true;
    actualizarEstado(true);
    temporizadores.push(setTimeout(function () {
      if (token !== estado.token) return;
      var movida = AI.chooseMove(estado.juego.board, 'b', estado.nivel);
      var restante = Math.max(0, t0 + espera - now());
      temporizadores.push(setTimeout(function () {
        if (token !== estado.token) return;
        if (!movida) {
          estado.ocupado = false;
          D.updateStatus(estado.juego);
          finalizar();
          return;
        }
        var res = aplicarJugada(movida);
        anunciar(textoTrasJugada(res.entry));
        res.anim.then(function () {
          pintarFichas();
          actualizarCeldas();
          actualizarFoco();
          estado.ocupado = false;
          if (estado.juego.status === 'over') finalizar();
          else { actualizarEstado(); S.turno(); }
        });
      }, restante));
    }, 70));
  }

  function finalizar() {
    estado.ocupado = false;
    actualizarEstado();
    actualizarCeldas();
    pintarRegistro();
    guardar();
    S.fin();
  }

  function now() {
    return (window.performance && performance.now) ? performance.now() : Date.now();
  }

  /* --- Nueva partida, deshacer ---------------------------------------- */

  function cancelarPendientes() {
    estado.token++;
    temporizadores.forEach(function (t) { clearTimeout(t); });
    temporizadores = [];
  }

  function nuevaPartida(silenciosa) {
    cancelarPendientes();
    estado.juego = D.createGame();
    estado.movidas = D.generateMoves(estado.juego.board, 'w');
    estado.seleccion = null;
    estado.ocupado = false;
    estado.focoSq = D.parseSquare('a1');
    pintarFichas();
    actualizarCeldas();
    actualizarFoco();
    pintarRegistro();
    actualizarEstado();
    guardar();
    if (!silenciosa) {
      aviso('Nueva partida. Juegas con blancas. Turno de blancas.' +
        (estado.soplo ? ' Soplido activado.' : '') +
        ' Escribe tu jugada o usa el tablero.');
      el.entrada.focus();
    }
  }

  function revivir(historial, total, soplos) {
    var g = D.createGame();
    for (var i = 0; i < total; i++) {
      var h = historial[i];
      var omision = D.isOmission(g.board, g.turn, h.move);
      var entry = D.playMove(g, D.cloneMove(h.move));
      if (omision) entry.description += ' Omite la captura obligatoria.';
      var sq = h.blow && h.blow.sq != null ? h.blow.sq : soplos ? soplos[i] : null;
      if (sq && typeof sq === 'object') sq = sq.sq;
      if (sq != null) {
        var pieza = g.board[sq];
        if (pieza) {
          g.board[sq] = D.EMPTY;
          entry.blow = { sq: sq, piece: pieza };
          entry.blowText = textoBlow(sq, pieza);
          D.updateStatus(g);
        }
      }
    }
    return g;
  }

  function deshacer() {
    if (estado.ocupado) { aviso('Espera a que termine la jugada en curso.'); return; }
    var historial = estado.juego.history;
    if (!historial.length) { aviso('No hay jugadas que deshacer.'); return; }
    cancelarPendientes();
    var ultima = historial[historial.length - 1];
    var quitar = ultima.side === 'w' ? 1 : 2;
    var total = Math.max(0, historial.length - quitar);
    var g = revivir(historial, total);
    estado.juego = g;
    estado.movidas = D.generateMoves(g.board, g.turn);
    estado.seleccion = null;
    estado.ocupado = false;
    estado.focoSq = D.parseSquare('a1');
    pintarFichas();
    actualizarCeldas();
    actualizarFoco();
    pintarRegistro();
    actualizarEstado();
    guardar();
    aviso('Jugada deshecha. ' + (g.turn === 'w' ? 'Tu turno.' : 'Turno de las negras.'));
  }

  /* --- Enganche con el DOM --------------------------------------------- */

  function enganchar() {
    el.tablero = document.getElementById('tablero');
    el.estado = document.getElementById('estado');
    el.detalle = document.getElementById('detalle');
    el.error = document.getElementById('error');
    el.entrada = document.getElementById('entrada');
    el.registro = document.getElementById('registro');
    el.form = document.getElementById('form-jugada');
    el.nivel = document.getElementById('nivel');
    el.espera = document.getElementById('espera');
    el.velocidad = document.getElementById('velocidad');
    el.voz = document.getElementById('chk-voz');
    el.sonido = document.getElementById('chk-sonido');
    el.soplo = document.getElementById('chk-soplo');
    el.panelAyuda = document.getElementById('panel-ayuda');
    el.panelReglas = document.getElementById('panel-reglas');

    el.form.addEventListener('submit', manejarEntrada);
    el.entrada.addEventListener('input', limpiarError);

    document.getElementById('btn-nueva').addEventListener('click', function () { nuevaPartida(); });
    document.getElementById('btn-reglas').addEventListener('click', leerReglas);
    document.getElementById('btn-copiar').addEventListener('click', copiarRegistro);
    document.getElementById('btn-exportar').addEventListener('click', exportarRegistro);

    el.nivel.addEventListener('change', function () { definirNivel(el.nivel.value); });
    el.espera.addEventListener('change', function () {
      estado.espera = Math.max(5000, Number(el.espera.value) || 5000);
      guardar();
      aviso('La máquina esperará ' + (estado.espera / 1000) + ' segundos.');
    });
    el.velocidad.addEventListener('change', function () {
      estado.velocidad = Number(el.velocidad.value) || 1;
      V.setRate(estado.velocidad);
      guardar();
    });
    el.voz.addEventListener('change', function () { activarVoz(el.voz.checked, true); });
    el.sonido.addEventListener('change', function () { activarSonido(el.sonido.checked, true); });
    if (el.soplo) el.soplo.addEventListener('change', function () { activarSoplo(el.soplo.checked, true); });

    document.addEventListener('pointerdown', desbloquearAudio, { once: true });
    document.addEventListener('keydown', desbloquearAudio, { once: true });
  }

  function desbloquearAudio() {
    S.desbloquear();
    V.init();
  }

  /* --- Arranque -------------------------------------------------------- */

  function arrancar() {
    var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    estado.reducido = !!(mq && mq.matches);
    enganchar();
    crearTablero();

    var recuperada = cargar();
    if (!recuperada) {
      estado.juego = D.createGame();
      estado.movidas = D.generateMoves(estado.juego.board, 'w');
    }
    estado.focoSq = D.parseSquare('a1');
    pintarFichas();
    actualizarCeldas();
    actualizarFoco();
    pintarRegistro();
    actualizarEstado();

    V.setEnabled(estado.voz);
    V.setRate(estado.velocidad);
    S.setEnabled(estado.sonido);

    el.entrada.focus();
    if (recuperada) {
      anunciar('Partida recuperada.' + (estado.soplo ? ' Regla del soplido activada.' : '') +
        ' ' + (estado.juego.turn === 'w' ? 'Tu turno.' : 'Turno de las negras.'));
    } else {
      aviso('Nueva partida. Juegas con blancas. Turno de blancas.' +
        (estado.soplo ? ' Regla del soplido activada.' : '') +
        ' Escribe tu jugada o usa el tablero.');
    }
  }

  /* --- Entrada de texto y comandos ------------------------------------- */

  function normalizarComando(t) {
    var s = String(t || '').toLowerCase().trim();
    if (s.normalize) s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return s.replace(/[.!?¡¿]+$/, '').replace(/\s+/g, ' ').trim();
  }

  function manejarEntrada(ev) {
    if (ev) ev.preventDefault();
    desbloquearAudio();
    var texto = el.entrada.value.trim();
    if (!texto) { el.entrada.focus(); return; }
    var cmd = normalizarComando(texto);
    if (ejecutarComando(cmd)) {
      el.entrada.value = '';
      el.entrada.focus();
      return;
    }
    if (estado.ocupado) { mostrarError('Espera un momento, hay una jugada en curso.'); return; }
    var g = estado.juego;
    if (g.status === 'over') { mostrarError('La partida ha terminado. Escribe nueva para empezar otra.'); return; }
    if (g.turn !== 'w') { mostrarError('Espera, es el turno de las negras.'); return; }
    var r = D.parseMoveText(texto, g, { soplido: estado.soplo });
    if (r.error) { mostrarError(r.error); return; }
    if (r.inspect != null) {
      el.entrada.value = '';
      inspeccionar(r.inspect);
      el.entrada.focus();
      return;
    }
    if (r.move) {
      el.entrada.value = '';
      ejecutarJugadaUsuario(r.move);
      el.entrada.focus();
    }
  }

  function ejecutarComando(cmd) {
    var m = /^casilla\s+([a-h][1-8])$/.exec(cmd);
    if (m) {
      var idx = D.parseSquare(m[1]);
      if (idx < 0) mostrarError('La casilla ' + m[1] + ' no es jugable: se juega sobre las oscuras.');
      else inspeccionar(idx);
      return true;
    }
    m = /^(?:dificultad|nivel)\s+(facil|medio|dificil)$/.exec(cmd);
    if (m) { definirNivel(m[1]); return true; }

    switch (cmd) {
      case 'ayuda': case '?': case 'help':
        cmdAyuda(); return true;
      case 'estado': case 'situacion': case 'turno': case 'como va':
        cmdEstado(); return true;
      case 'legales': case 'movimientos': case 'jugadas':
      case 'que puedo mover': case 'puedo mover': case 'opciones':
        cmdLegales(); return true;
      case 'deshacer': case 'atras': case 'undo': case 'deshaz':
        aviso('La opción deshacer no está disponible.'); return true;
      case 'nueva': case 'reiniciar': case 'nueva partida': case 'empezar': case 'reset':
        nuevaPartida(); return true;
      case 'reglas': case 'leer reglas':
        leerReglas(); return true;
      case 'repetir': case 'ultima': case 'otra vez': case 'repite':
        cmdRepetir(); return true;
      case 'voz': case 'silencio': case 'voz on': case 'voz off':
        activarVoz(!estado.voz, true); return true;
      case 'sonido': case 'sonidos':
        activarSonido(!estado.sonido, true); return true;
      case 'soplido': case 'soplo':
        activarSoplo(!estado.soplo, true); return true;
      case 'soplido on': case 'soplo on': case 'con soplido': case 'soplido si':
        activarSoplo(true, true); return true;
      case 'soplido off': case 'soplo off': case 'sin soplido': case 'soplido no':
        activarSoplo(false, true); return true;
      case 'registro': case 'partida':
        el.registro.focus();
        aviso('Registro de la partida.'); return true;
      case 'tablero':
        enfocar(estado.focoSq);
        aviso('Tablero.'); return true;
      case 'entrada': case 'campo':
        el.entrada.focus(); return true;
      case 'copiar': case 'copiar registro':
        copiarRegistro(); return true;
      case 'exportar': case 'guardar':
        exportarRegistro(); return true;
      case 'facil': definirNivel('facil'); return true;
      case 'medio': definirNivel('medio'); return true;
      case 'dificil': definirNivel('dificil'); return true;
      case 'dificultad': case 'nivel':
        aviso('Dificultad actual: ' + AI.LEVELS[estado.nivel].label + '.'); return true;
      case 'espera':
        aviso('La máquina espera ' + (estado.espera / 1000) + ' segundos.'); return true;
      default:
        return false;
    }
  }

  function cmdAyuda() {
    if (el.panelAyuda) el.panelAyuda.open = true;
    aviso('Ayuda. Mueve escribiendo c3-d4 y come con c3xe5. Comandos: estado, legales, deshacer, ' +
      'nueva, reglas, repetir, voz, sonido, soplido, registro, tablero. En el tablero, usa las flechas y Enter.');
  }

  function cmdEstado() {
    var g = estado.juego;
    var w = D.countPieces(g.board, 'w'), b = D.countPieces(g.board, 'b');
    var wk = D.countKings(g.board, 'w'), bk = D.countKings(g.board, 'b');
    var txt = 'Turno de ' + (g.turn === 'w' ? 'blancas' : 'negras') + '. ' +
      'Blancas: ' + w + ' fichas' + (wk ? ', ' + wk + (wk === 1 ? ' dama' : ' damas') : '') + '. ' +
      'Negras: ' + b + ' fichas' + (bk ? ', ' + bk + (bk === 1 ? ' dama' : ' damas') : '') + '.';
    if (g.history.length) {
      txt += ' Última jugada: ' + g.history[g.history.length - 1].description;
    }
    if (g.status === 'over') {
      txt += ' ' + D.resultText(g) + (g.reason ? ' (' + g.reason + ').' : '');
    } else if (g.turn === 'w' && estado.movidas.length && estado.movidas[0].captures.length) {
      txt += ' Captura obligatoria: ' + D.listNotations(estado.movidas) + '.';
      if (estado.soplo) txt += ' Con soplido puedes omitirla, pero expones la ficha a que la máquina la retire.';
    }
    if (estado.soplo) txt += ' Regla del soplido activada.';
    aviso(txt);
  }

  function cmdLegales() {
    if (estado.ocupado) { aviso('Espera a que termine la jugada en curso.'); return; }
    if (estado.juego.status === 'over') { aviso('La partida ha terminado.'); return; }
    if (estado.juego.turn !== 'w') { aviso('Espera, es el turno de las negras.'); return; }
    if (!estado.movidas.length) { aviso('No hay jugadas legales.'); return; }
    var captura = estado.movidas[0].captures.length > 0;
    if (captura && estado.soplo) {
      var simples = D.generatePermissiveMoves(estado.juego.board, 'w').filter(function (m) {
        return m.captures.length === 0;
      });
      var txt = 'Captura obligatoria: ' + estado.movidas.map(D.notation).join(', ') + '.';
      if (simples.length) {
        txt += ' Si omites y mueves en simple (' + simples.map(D.notation).join(', ') +
          '), la máquina podrá soplar la ficha que debía comer.';
      }
      aviso(txt);
      return;
    }
    aviso((captura ? 'Captura obligatoria. ' : '') + 'Jugadas legales: ' +
      estado.movidas.map(D.notation).join(', ') + '.');
  }

  function leerReglas() {
    if (el.panelReglas) el.panelReglas.open = true;
    aviso('Reglas de las damas españolas. Tablero de ocho por ocho sobre las casillas oscuras, ' +
      'doce peones por bando. Los peones avanzan y comen en diagonal solo hacia delante. ' +
      'Las damas se mueven y comen cualquier distancia en diagonal, adelante y atrás. ' +
      'La captura es obligatoria: hay que comer el máximo de fichas y, a igualdad, el máximo de damas. ' +
      (estado.soplo
        ? 'Con soplido activo puedes no comer; entonces la máquina retira la ficha que debía comer y después mueve. '
        : 'La regla del soplido está desactivada; puedes activarla en los ajustes. ') +
      'Al llegar a la última fila el peón corona y termina la jugada. Pierde quien se queda sin fichas ' +
      'o sin movimientos. Son tablas la repetición triple y las cuarenta jugadas de dama sin mover peón ni comer.');
  }

  function cmdRepetir() {
    aviso(estado.ultimoAnuncio || 'No hay nada que repetir todavía.');
  }

  function inspeccionar(i) {
    var txt = D.squareDescription(estado.juego.board, i, jugables());
    el.detalle.textContent = txt;
    el.error.textContent = '';
    anunciar(txt);
  }

  /* --- Ajustes --------------------------------------------------------- */

  function definirNivel(v) {
    if (!AI.LEVELS[v]) return;
    estado.nivel = v;
    if (el.nivel.value !== v) el.nivel.value = v;
    guardar();
    aviso('Dificultad ' + AI.LEVELS[v].label + '.');
  }

  function activarVoz(activa, avisarCambio) {
    if (avisarCambio && !activa) {
      V.setEnabled(true);
      V.say('Voz desactivada.');
    }
    estado.voz = !!activa;
    V.setEnabled(estado.voz);
    if (el.voz.checked !== estado.voz) el.voz.checked = estado.voz;
    guardar();
    if (avisarCambio && activa) aviso('Voz activada.');
  }

  function activarSonido(activo, avisarCambio) {
    estado.sonido = !!activo;
    S.setEnabled(estado.sonido);
    if (el.sonido.checked !== estado.sonido) el.sonido.checked = estado.sonido;
    guardar();
    if (avisarCambio) aviso(estado.sonido ? 'Señales sonoras activadas.' : 'Señales sonoras desactivadas.');
  }

  function activarSoplo(activo, avisarCambio) {
    estado.soplo = !!activo;
    if (el.soplo && el.soplo.checked !== estado.soplo) el.soplo.checked = estado.soplo;
    if (estado.juego) {
      estado.seleccion = null;
      actualizarCeldas();
      actualizarEstado();
    }
    guardar();
    if (avisarCambio) {
      aviso(estado.soplo
        ? 'Regla del soplido activada. Si puedes comer y no comes, la máquina retirará la ficha que debía comer y después hará su jugada.'
        : 'Regla del soplido desactivada. La captura vuelve a ser obligatoria.');
    }
  }

  /* --- Registro: copiar y exportar ------------------------------------- */

  function copiarRegistro() {
    var texto = el.registro.value;
    function ok() { aviso('Registro copiado al portapapeles.'); }
    function alternativa() {
      el.registro.focus();
      el.registro.select();
      try {
        document.execCommand('copy');
        ok();
      } catch (e) {
        mostrarError('No se pudo copiar automáticamente. El texto está seleccionado: pulsa Control C.');
      }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).then(ok, alternativa);
    } else {
      alternativa();
    }
  }

  function exportarRegistro() {
    try {
      var blob = new Blob([el.registro.value], { type: 'text/plain;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'partida-damas.txt';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
      aviso('Partida exportada como partida-damas.txt.');
    } catch (e) {
      mostrarError('No se pudo exportar el registro.');
    }
  }

  /* --- Persistencia ---------------------------------------------------- */

  function guardar() {
    try {
      localStorage.setItem(CLAVE, JSON.stringify({
        v: 1,
        movidas: estado.juego.history.map(function (h) { return D.cloneMove(h.move); }),
        soplos: estado.juego.history.map(function (h) { return h.blow ? h.blow.sq : null; }),
        soplo: estado.soplo,
        nivel: estado.nivel,
        espera: estado.espera,
        velocidad: estado.velocidad,
        voz: estado.voz,
        sonido: estado.sonido
      }));
    } catch (e) { /* sin almacenamiento */ }
  }

  function cargar() {
    var raw = null;
    try { raw = localStorage.getItem(CLAVE); } catch (e) { return false; }
    if (!raw) return false;
    try {
      var data = JSON.parse(raw);
      if (!data || !Array.isArray(data.movidas)) return false;
      var total = data.movidas.length;
      var historial = data.movidas.map(function (m) { return { move: m }; });
      var soplos = Array.isArray(data.soplos) ? data.soplos : [];

      var g = revivir(historial, total, soplos);
      if (g.status !== 'over' && g.turn === 'b' && g.history.length) {
        total = g.history.length - 1;
        g = revivir(historial, total, soplos);
      }
      estado.juego = g;
      estado.movidas = D.generateMoves(g.board, g.turn);
      if (typeof data.soplo === 'boolean') estado.soplo = data.soplo;
      if (data.nivel && AI.LEVELS[data.nivel]) estado.nivel = data.nivel;
      var esperas = { 5000: 1, 6000: 1, 8000: 1, 10000: 1 };
      if (esperas[data.espera]) estado.espera = Number(data.espera);
      if (data.velocidad) estado.velocidad = Number(data.velocidad) || 1;
      if (typeof data.voz === 'boolean') estado.voz = data.voz;
      if (typeof data.sonido === 'boolean') estado.sonido = data.sonido;
      el.nivel.value = estado.nivel;
      el.espera.value = String(estado.espera);
      el.velocidad.value = String(estado.velocidad);
      el.voz.checked = estado.voz;
      el.sonido.checked = estado.sonido;
      if (el.soplo) el.soplo.checked = estado.soplo;
      return true;
    } catch (e) {
      return false;
    }
  }

  window.__DamasApp = {
    estado: estado,
    arrancar: arrancar,
    nuevaPartida: nuevaPartida,
    deshacer: deshacer,
    guardar: guardar,
    render: function () { pintarFichas(); actualizarCeldas(); actualizarEstado(); pintarRegistro(); }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar);
  else arrancar();
})();
