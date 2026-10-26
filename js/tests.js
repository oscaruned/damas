/* Pruebas del motor de damas españolas. Se ejecutan en tests.html. */
(function () {
  'use strict';

  var results = [];

  function assert(cond, msg) { if (!cond) throw new Error(msg || 'condición falsa'); }
  function eq(a, b, msg) {
    if (a !== b) throw new Error((msg ? msg + ': ' : '') + 'esperado ' + JSON.stringify(b) + ', obtenido ' + JSON.stringify(a));
  }
  function test(name, fn) {
    try { fn(); results.push({ name: name, ok: true }); }
    catch (e) { results.push({ name: name, ok: false, msg: e.message }); }
  }

  var CODES = { w: 1, W: 2, b: 3, B: 4 };

  function boardFrom(pieces) {
    var b = new Array(64).fill(0);
    Object.keys(pieces).forEach(function (sq) {
      var i = Damas.parseSquare(sq);
      if (i < 0) throw new Error('casilla de prueba no jugable: ' + sq);
      b[i] = CODES[pieces[sq]];
    });
    return b;
  }

  function gameWith(pieces, turn) {
    var g = Damas.createGame();
    g.board = boardFrom(pieces);
    g.turn = turn || 'w';
    g.repetition = {};
    g.repetition[Damas.positionKey(g.board, g.turn)] = 1;
    Damas.updateStatus(g);
    return g;
  }

  function notations(moves) {
    return moves.map(Damas.notation).sort().join(' ');
  }

  test('Posición inicial: 12 fichas por bando y 7 jugadas', function () {
    var g = Damas.createGame();
    eq(Damas.countPieces(g.board, 'w'), 12, 'blancas');
    eq(Damas.countPieces(g.board, 'b'), 12, 'negras');
    var moves = Damas.generateMoves(g.board, 'w');
    eq(moves.length, 7, 'jugadas iniciales');
    eq(notations(moves), 'a3-b4 c3-b4 c3-d4 e3-d4 e3-f4 g3-f4 g3-h4', 'notaciones');
  });

  test('Todas las piezas iniciales están en casillas oscuras', function () {
    var b = Damas.initialBoard();
    for (var i = 0; i < 64; i++) {
      if (b[i]) assert(Damas.isPlayable(i), 'ficha en casilla clara: ' + Damas.squareName(i));
    }
  });

  test('Captura obligatoria', function () {
    var g = gameWith({ c3: 'w', d4: 'b' });
    var moves = Damas.generateMoves(g.board, 'w');
    eq(moves.length, 1, 'solo la captura');
    eq(Damas.notation(moves[0]), 'c3xe5');
    eq(moves[0].captures.length, 1);
  });

  test('Ley de cantidad: hay que comer el máximo', function () {
    var g = gameWith({ a3: 'w', e3: 'w', b4: 'b', d6: 'b', f4: 'b' });
    var moves = Damas.generateMoves(g.board, 'w');
    eq(moves.length, 1, 'una sola jugada legal');
    eq(Damas.notation(moves[0]), 'a3xc5xe7');
    eq(moves[0].captures.length, 2, 'dos capturas');
  });

  test('Ley de calidad: a igual cantidad, más damas', function () {
    var g = gameWith({ a3: 'w', e3: 'w', b4: 'b', f4: 'B' });
    var moves = Damas.generateMoves(g.board, 'w');
    eq(moves.length, 1, 'una sola jugada legal');
    eq(Damas.notation(moves[0]), 'e3xg5', 'debe comer la dama');
    assert(Damas.isKing(g.board[moves[0].captures[0]]), 'la pieza comida es dama');
  });

  test('Dama voladora: elige cualquier casilla de aterrizaje', function () {
    var g = gameWith({ a1: 'W', d4: 'b' });
    var moves = Damas.generateMoves(g.board, 'w');
    eq(moves.length, 4, 'cuatro aterrizajes');
    eq(notations(moves), 'a1xe5 a1xf6 a1xg7 a1xh8');
    moves.forEach(function (m) { eq(m.captures.length, 1); });
  });

  test('La dama se mueve y captura también hacia atrás', function () {
    var g = gameWith({ d4: 'W' });
    var moves = Damas.generateMoves(g.board, 'w');
    eq(moves.length, 13, 'movimientos de dama sola');
    assert(moves.some(function (m) { return Damas.notation(m) === 'd4-a1'; }), 'puede ir atrás');
  });

  test('El peón no captura hacia atrás', function () {
    var g = gameWith({ d4: 'w', c3: 'b' });
    var moves = Damas.generateMoves(g.board, 'w');
    eq(moves.length, 2, 'solo movimientos simples');
    moves.forEach(function (m) { eq(m.captures.length, 0); });
  });

  test('La coronación corta la cadena de capturas', function () {
    var g = gameWith({ b6: 'w', c7: 'b', e7: 'b' });
    var moves = Damas.generateMoves(g.board, 'w');
    eq(moves.length, 1, 'una jugada');
    eq(Damas.notation(moves[0]), 'b6xd8');
    assert(moves[0].promote, 'corona');
    eq(moves[0].captures.length, 1, 'no sigue comiendo como dama');
  });

  test('Cadena de capturas con dama', function () {
    var g = gameWith({ a1: 'W', c3: 'b', f6: 'b' });
    var moves = Damas.generateMoves(g.board, 'w');
    eq(moves.length, 4, 'cuatro rutas');
    moves.forEach(function (m) { eq(m.captures.length, 2, 'dos capturas'); });
    assert(moves.some(function (m) { return Damas.notation(m) === 'a1xd4xg7'; }), 'ruta esperada');
  });

  test('Bloqueo: perder por no tener movimientos', function () {
    var g = gameWith({ a1: 'w', b2: 'b', c3: 'b' });
    eq(Damas.generateMoves(g.board, 'w').length, 0, 'sin jugadas');
    eq(g.status, 'over');
    eq(g.winner, 'b');
  });

  test('Sin fichas: derrota', function () {
    var g = gameWith({ a1: 'w' });
    eq(Damas.countPieces(g.board, 'b'), 0);
    g.turn = 'b';
    Damas.updateStatus(g);
    eq(g.status, 'over');
    eq(g.winner, 'w');
  });

  test('Regla de las 40 jugadas de dama', function () {
    var g = gameWith({ a1: 'W', h8: 'B' });
    g.idlePlies = 40;
    Damas.updateStatus(g);
    eq(g.status, 'over');
    eq(g.winner, null, 'tablas');
  });

  test('Dama contra dama es tablas', function () {
    var g = gameWith({ a1: 'W', h8: 'B' });
    Damas.updateStatus(g);
    eq(g.status, 'over');
    eq(g.winner, null);
  });

  test('Alternancia de turnos e historial', function () {
    var g = Damas.createGame();
    var m1 = Damas.generateMoves(g.board, 'w').filter(function (m) { return Damas.notation(m) === 'c3-d4'; })[0];
    Damas.playMove(g, m1);
    eq(g.turn, 'b');
    eq(g.history.length, 1);
    eq(g.history[0].notation, 'c3-d4');
    var m2 = Damas.generateMoves(g.board, 'b').filter(function (m) { return Damas.notation(m) === 'f6-e5'; })[0];
    Damas.playMove(g, m2);
    eq(g.turn, 'w');
    eq(g.history.length, 2);
  });

  test('Parseo: formatos equivalentes', function () {
    var g = gameWith({ c3: 'w' });
    ['c3-d4', 'C3-D4', 'c3 d4', 'c3 a d4', 'de c3 a d4', '  c3  a  d4  '].forEach(function (txt) {
      var r = Damas.parseMoveText(txt, g);
      assert(r.move, 'no parseó: ' + txt);
      eq(Damas.notation(r.move), 'c3-d4', txt);
    });
  });

  test('Parseo: captura con x y con dos puntos', function () {
    var g = gameWith({ c3: 'w', d4: 'b' });
    ['c3xe5', 'c3:e5', 'c3 e5'].forEach(function (txt) {
      var r = Damas.parseMoveText(txt, g);
      assert(r.move, 'no parseó: ' + txt);
      eq(Damas.notation(r.move), 'c3xe5', txt);
    });
  });

  test('Parseo: rechaza casilla clara', function () {
    var g = gameWith({ c3: 'w' });
    var r = Damas.parseMoveText('b3-b4', g);
    assert(r.error, 'debería fallar');
    assert(/no es jugable/.test(r.error), r.error);
  });

  test('Parseo: explica la captura obligatoria', function () {
    var g = gameWith({ c3: 'w', d4: 'b', a1: 'w' });
    var r = Damas.parseMoveText('a1-b2', g);
    assert(r.error, 'debería fallar');
    assert(/captura obligatoria/i.test(r.error), r.error);
  });

  test('Parseo: jugada ilegal con destino ocupado', function () {
    var g = gameWith({ c3: 'w', d4: 'b' });
    var r = Damas.parseMoveText('c3-d4', g);
    assert(r.error, 'debería fallar');
  });

  test('Casilla suelta devuelve inspección', function () {
    var g = gameWith({ c3: 'w' });
    var r = Damas.parseMoveText('c3', g);
    eq(r.inspect, Damas.parseSquare('c3'));
  });

  test('makeMove y unmakeMove restauran el tablero', function () {
    var g = gameWith({ a3: 'w', b4: 'b', d6: 'b', e3: 'w', f4: 'b' });
    var before = g.board.slice();
    var m = Damas.generateMoves(g.board, 'w')[0];
    Damas.makeMove(g.board, m);
    Damas.unmakeMove(g.board, m);
    eq(g.board.join(','), before.join(','), 'tablero restaurado');
  });

  test('La máquina elige una jugada legal', function () {
    var g = Damas.createGame();
    var m = DamasAI.chooseMove(g.board, 'w', 'medio');
    assert(m, 'sin jugada');
    var legal = Damas.generateMoves(g.board, 'w').some(function (x) {
      return x.from === m.from && x.to === m.to && x.captures.length === m.captures.length;
    });
    assert(legal, 'jugada no legal');
  });

  test('La máquina respeta la captura obligatoria', function () {
    var g = gameWith({ c3: 'w', d4: 'b' });
    var m = DamasAI.chooseMove(g.board, 'w', 'medio');
    eq(Damas.notation(m), 'c3xe5');
  });

  test('Partida automática de 12 jugadas sin errores', function () {
    var g = Damas.createGame();
    for (var i = 0; i < 12; i++) {
      if (g.status === 'over') break;
      var m = DamasAI.chooseMove(g.board, g.turn, 'facil');
      assert(m, 'sin jugada en el turno ' + i);
      var norm = Damas.notation(m);
      Damas.playMove(g, m);
      assert(g.history[g.history.length - 1].notation === norm, 'historial inconsistente');
    }
    assert(g.history.length >= 1);
  });

  test('La máquina no tarda más de 3 segundos en la posición inicial', function () {
    var g = Damas.createGame();
    var t0 = performance.now();
    DamasAI.chooseMove(g.board, 'w', 'dificil');
    var dt = performance.now() - t0;
    assert(dt < 3000, 'tardó ' + Math.round(dt) + ' ms');
  });

  test('Soplido: movimientos simples permitidos con captura obligatoria', function () {
    var g = gameWith({ c3: 'w', d4: 'b', a1: 'w' });
    var strict = Damas.generateMoves(g.board, 'w');
    eq(strict.length, 1, 'sin soplido solo se puede comer');
    var permisivas = Damas.generatePermissiveMoves(g.board, 'w');
    assert(permisivas.length > 1, 'con soplido hay más jugadas');
    assert(permisivas.some(function (m) { return Damas.notation(m) === 'a1-b2'; }), 'incluye la jugada simple');
    assert(permisivas.some(function (m) { return Damas.notation(m) === 'c3xe5'; }), 'incluye la captura');
    var simple = permisivas.filter(function (m) { return Damas.notation(m) === 'a1-b2'; })[0];
    assert(Damas.isOmission(g.board, 'w', simple), 'mover en simple es una omisión');
    assert(!Damas.isOmission(g.board, 'w', strict[0]), 'comer no es una omisión');
  });

  test('Soplido: no permite capturas por debajo del máximo', function () {
    var g = gameWith({ a3: 'w', e3: 'w', b4: 'b', d6: 'b', f4: 'b' });
    var permisivas = Damas.generatePermissiveMoves(g.board, 'w');
    var capturas = permisivas.filter(function (m) { return m.captures.length > 0; });
    eq(capturas.length, 1, 'una sola captura admitida');
    eq(Damas.notation(capturas[0]), 'a3xc5xe7', 'la captura máxima');
  });

  test('Soplido: el parseo acepta la omisión solo si está activo', function () {
    var g = gameWith({ c3: 'w', d4: 'b', a1: 'w' });
    var error = Damas.parseMoveText('a1-b2', g);
    assert(error.error, 'sin soplido debe rechazarse');
    var permitido = Damas.parseMoveText('a1-b2', g, { soplido: true });
    assert(permitido.move, 'con soplido debe aceptarse');
    eq(Damas.notation(permitido.move), 'a1-b2');
  });

  test('Sin captura obligatoria, ningún movimiento es omisión', function () {
    var g = gameWith({ c3: 'w' });
    var m = Damas.generateMoves(g.board, 'w')[0];
    assert(!Damas.isOmission(g.board, 'w', m), 'no hay omisión');
  });

  window.__testResults = results;
  window.runDamasTests = function () { return results; };

  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function () {
      var ok = 0, fail = 0;
      var cont = document.getElementById('resultado');
      if (!cont) return;
      results.forEach(function (r) {
        var li = document.createElement('li');
        li.className = r.ok ? 'ok' : 'fail';
        li.textContent = (r.ok ? '✓ ' : '✗ ') + r.name + (r.ok ? '' : ' — ' + r.msg);
        cont.appendChild(li);
        if (r.ok) ok++; else fail++;
      });
      var sum = document.getElementById('resumen');
      if (sum) sum.textContent = ok + ' correctas, ' + fail + ' fallidas.';
      document.title = (fail ? '✗ ' : '✓ ') + 'Pruebas de damas';
    });
  }
})();
