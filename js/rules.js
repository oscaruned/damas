/* Damas españolas: motor de reglas.
   Tablero 8x8, se juega sobre las casillas oscuras (a1 es oscura).
   Índice 0..63 = fila * 8 + columna, con fila 0 = rango 1 (abajo). */
(function (global) {
  'use strict';

  var EMPTY = 0, WM = 1, WK = 2, BM = 3, BK = 4;
  var WHITE = 'w', BLACK = 'b';
  var FILES = 'abcdefgh';
  var DIRS = [[1, -1], [1, 1], [-1, -1], [-1, 1]];
  var PROMO_ROW = { w: 7, b: 0 };

  function isWhite(p) { return p === WM || p === WK; }
  function isBlack(p) { return p === BM || p === BK; }
  function isKing(p) { return p === WK || p === BK; }
  function sideOf(p) { return p === EMPTY ? null : (isWhite(p) ? WHITE : BLACK); }
  function opposite(side) { return side === WHITE ? BLACK : WHITE; }

  function idxOf(row, col) { return row * 8 + col; }
  function rowOf(i) { return i >> 3; }
  function colOf(i) { return i & 7; }
  function onBoard(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }
  function isPlayable(i) { return ((rowOf(i) + colOf(i)) & 1) === 0; }
  function squareName(i) { return FILES[colOf(i)] + (rowOf(i) + 1); }

  function indexOfName(name) {
    var m = /^([a-h])([1-8])$/i.exec(String(name || '').trim());
    if (!m) return -1;
    return idxOf(parseInt(m[2], 10) - 1, FILES.indexOf(m[1].toLowerCase()));
  }

  function parseSquare(name) {
    var i = indexOfName(name);
    return i >= 0 && isPlayable(i) ? i : -1;
  }

  function initialBoard() {
    var b = new Array(64);
    for (var i = 0; i < 64; i++) b[i] = EMPTY;
    for (var r = 0; r < 8; r++) {
      for (var c = 0; c < 8; c++) {
        var idx = idxOf(r, c);
        if (!isPlayable(idx)) continue;
        if (r < 3) b[idx] = WM;
        else if (r > 4) b[idx] = BM;
      }
    }
    return b;
  }

  function countPieces(board, side) {
    var n = 0;
    for (var i = 0; i < 64; i++) if (sideOf(board[i]) === side) n++;
    return n;
  }

  function countKings(board, side) {
    var n = 0;
    for (var i = 0; i < 64; i++) if (board[i] !== EMPTY && sideOf(board[i]) === side && isKing(board[i])) n++;
    return n;
  }

  /* --- Generación de jugadas ------------------------------------------- */

  function cloneMove(m) {
    return {
      from: m.from, to: m.to, piece: m.piece,
      captures: m.captures.slice(), path: m.path.slice(),
      promote: !!m.promote
    };
  }

  function generateMoves(board, side) {
    var captures = [];
    for (var i = 0; i < 64; i++) {
      var p = board[i];
      if (p !== EMPTY && sideOf(p) === side) collectCaptures(board, i, p, side, captures);
    }
    if (captures.length) return filterRules(board, captures);
    return generateQuietMoves(board, side);
  }

  /* Movimientos admitidos con la regla del soplido: las capturas legales
     (con cantidad y calidad) más los movimientos simples, aunque exista
     captura obligatoria. Mover en simple en ese caso es una omisión. */
  function generatePermissiveMoves(board, side) {
    var captures = [];
    for (var i = 0; i < 64; i++) {
      var p = board[i];
      if (p !== EMPTY && sideOf(p) === side) collectCaptures(board, i, p, side, captures);
    }
    var legal = captures.length ? filterRules(board, captures) : [];
    return legal.concat(generateQuietMoves(board, side));
  }

  function isOmission(board, side, move) {
    if (!move || move.captures.length) return false;
    var moves = generateMoves(board, side);
    return moves.length > 0 && moves[0].captures.length > 0;
  }

  function collectCaptures(board, start, piece, side, out) {
    var king = isKing(piece);
    var captured = [];
    var taken = {};
    var path = [start];
    var seen = {};

    function dfs(pos) {
      var jumps = findJumps(board, pos, piece, side, taken);
      if (jumps.length === 0) {
        if (captured.length) {
          var move = {
            from: start, to: pos, piece: piece,
            captures: captured.slice(), path: path.slice(),
            promote: !king && rowOf(pos) === PROMO_ROW[side]
          };
          var key = move.from + '|' + move.path.join(',');
          if (!seen[key]) { seen[key] = 1; out.push(move); }
        }
        return;
      }
      for (var k = 0; k < jumps.length; k++) {
        var j = jumps[k];
        if (!king && rowOf(j.land) === PROMO_ROW[side]) {
          captured.push(j.over); path.push(j.land);
          var m = {
            from: start, to: j.land, piece: piece,
            captures: captured.slice(), path: path.slice(), promote: true
          };
          var kk = m.from + '|' + m.path.join(',');
          if (!seen[kk]) { seen[kk] = 1; out.push(m); }
          path.pop(); captured.pop();
          continue;
        }
        captured.push(j.over); taken[j.over] = 1; path.push(j.land);
        dfs(j.land);
        path.pop(); delete taken[j.over]; captured.pop();
      }
    }
    dfs(start);
  }

  function findJumps(board, pos, piece, side, taken) {
    var res = [];
    var r = rowOf(pos), c = colOf(pos);
    var dr, dc, k;
    if (!isKing(piece)) {
      dr = side === WHITE ? 1 : -1;
      for (k = -1; k <= 1; k += 2) {
        dc = k;
        var mr = r + dr, mc = c + dc, lr = r + dr * 2, lc = c + dc * 2;
        if (!onBoard(lr, lc)) continue;
        var mid = idxOf(mr, mc), land = idxOf(lr, lc);
        var mp = board[mid];
        if (mp === EMPTY || sideOf(mp) === side || taken[mid]) continue;
        if (board[land] !== EMPTY) continue;
        res.push({ over: mid, land: land });
      }
      return res;
    }
    for (k = 0; k < DIRS.length; k++) {
      dr = DIRS[k][0]; dc = DIRS[k][1];
      var br = r + dr, bc = c + dc;
      while (onBoard(br, bc) && board[idxOf(br, bc)] === EMPTY) { br += dr; bc += dc; }
      if (!onBoard(br, bc)) continue;
      var over = idxOf(br, bc), op = board[over];
      if (op === EMPTY || sideOf(op) === side || taken[over]) continue;
      var fr = br + dr, fc = bc + dc;
      while (onBoard(fr, fc) && board[idxOf(fr, fc)] === EMPTY) {
        res.push({ over: over, land: idxOf(fr, fc) });
        fr += dr; fc += dc;
      }
    }
    return res;
  }

  function filterRules(board, moves) {
    var maxCount = 0, i;
    for (i = 0; i < moves.length; i++) if (moves[i].captures.length > maxCount) maxCount = moves[i].captures.length;
    var list = moves.filter(function (m) { return m.captures.length === maxCount; });
    if (list.length < 2) return list;
    var maxKings = 0;
    for (i = 0; i < list.length; i++) {
      var n = 0;
      for (var k = 0; k < list[i].captures.length; k++) if (isKing(board[list[i].captures[k]])) n++;
      if (n > maxKings) maxKings = n;
    }
    return list.filter(function (m) {
      var n = 0;
      for (var k = 0; k < m.captures.length; k++) if (isKing(board[m.captures[k]])) n++;
      return n === maxKings;
    });
  }

  function generateQuietMoves(board, side) {
    var out = [];
    for (var i = 0; i < 64; i++) {
      var p = board[i];
      if (p === EMPTY || sideOf(p) !== side) continue;
      var r = rowOf(i), c = colOf(i), k, nr, nc, j;
      if (!isKing(p)) {
        var dr = side === WHITE ? 1 : -1;
        for (k = -1; k <= 1; k += 2) {
          nr = r + dr; nc = c + k;
          if (!onBoard(nr, nc)) continue;
          j = idxOf(nr, nc);
          if (board[j] !== EMPTY) continue;
          out.push({ from: i, to: j, piece: p, captures: [], path: [i, j], promote: rowOf(j) === PROMO_ROW[side] });
        }
      } else {
        for (k = 0; k < DIRS.length; k++) {
          nr = r + DIRS[k][0]; nc = c + DIRS[k][1];
          while (onBoard(nr, nc) && board[idxOf(nr, nc)] === EMPTY) {
            j = idxOf(nr, nc);
            out.push({ from: i, to: j, piece: p, captures: [], path: [i, j], promote: false });
            nr += DIRS[k][0]; nc += DIRS[k][1];
          }
        }
      }
    }
    return out;
  }

  /* --- Aplicar y deshacer ---------------------------------------------- */

  function makeMove(board, move) {
    var undo = [];
    for (var k = 0; k < move.captures.length; k++) {
      var i = move.captures[k];
      undo.push([i, board[i]]);
      board[i] = EMPTY;
    }
    board[move.from] = EMPTY;
    board[move.to] = move.promote ? (isWhite(move.piece) ? WK : BK) : move.piece;
    move._undo = undo;
  }

  function unmakeMove(board, move) {
    board[move.to] = EMPTY;
    board[move.from] = move.piece;
    var undo = move._undo || [];
    for (var k = 0; k < undo.length; k++) board[undo[k][0]] = undo[k][1];
    move._undo = null;
  }

  /* --- Notación y descripción ------------------------------------------ */

  function notation(move) {
    var sep = move.captures.length ? 'x' : '-';
    return move.path.map(squareName).join(sep);
  }

  function pieceName(p) { return isKing(p) ? 'dama' : 'peón'; }
  function pieceColorName(p) {
    if (isKing(p)) return isWhite(p) ? 'blanca' : 'negra';
    return isWhite(p) ? 'blanco' : 'negro';
  }

  function describeMove(boardBefore, move) {
    var side = sideOf(move.piece) === WHITE ? 'Blancas' : 'Negras';
    var txt = side + ': ' + pieceName(move.piece) + ' de ' + squareName(move.from) +
      ' a ' + squareName(move.to);
    if (move.captures.length) {
      var parts = move.captures.map(function (i) {
        return pieceName(boardBefore[i]) + ' ' + pieceColorName(boardBefore[i]) + ' en ' + squareName(i);
      });
      txt += ', come ' + (move.captures.length === 1 ? '1 ficha' : move.captures.length + ' fichas') +
        ' (' + parts.join(', ') + ')';
    }
    if (move.promote) txt += ', corona y se convierte en dama';
    return txt + '.';
  }

  function shortDescription(boardBefore, move) {
    var txt = squareName(move.from) + ' a ' + squareName(move.to);
    if (move.captures.length) txt += ', come ' + move.captures.length;
    if (move.promote) txt += ', corona';
    return txt;
  }

  /* --- Partida --------------------------------------------------------- */

  function positionKey(board, turn) { return board.join('') + turn; }

  function createGame() {
    var board = initialBoard();
    var game = {
      board: board, turn: WHITE, ply: 0, idlePlies: 0,
      history: [], status: 'playing', winner: null, reason: '',
      repetition: {}, lastMove: null
    };
    game.repetition[positionKey(board, WHITE)] = 1;
    return game;
  }

  function playMove(game, move) {
    var before = game.board.slice();
    var mover = sideOf(move.piece);
    var wasMan = !isKing(move.piece);
    makeMove(game.board, move);
    game.ply += 1;
    game.turn = opposite(mover);
    if (move.captures.length || wasMan) game.idlePlies = 0;
    else game.idlePlies += 1;
    var entry = {
      ply: game.ply, side: mover, move: move,
      notation: notation(move),
      description: describeMove(before, move),
      short: shortDescription(before, move)
    };
    game.history.push(entry);
    game.lastMove = move;
    var key = positionKey(game.board, game.turn);
    game.repetition[key] = (game.repetition[key] || 0) + 1;
    updateStatus(game);
    return entry;
  }

  function updateStatus(game) {
    var moves = generateMoves(game.board, game.turn);
    if (moves.length === 0) {
      game.status = 'over';
      game.winner = opposite(game.turn);
      game.reason = countPieces(game.board, game.turn) === 0 ? 'sin fichas' : 'bloqueo, sin movimientos posibles';
      return;
    }
    if (countPieces(game.board, opposite(game.turn)) === 0) {
      game.status = 'over';
      game.winner = game.turn;
      game.reason = 'sin fichas';
      return;
    }
    if (game.idlePlies >= 40) {
      game.status = 'over'; game.winner = null;
      game.reason = '40 jugadas de dama sin mover peón ni comer';
      return;
    }
    var key = positionKey(game.board, game.turn);
    if ((game.repetition[key] || 0) >= 3) {
      game.status = 'over'; game.winner = null;
      game.reason = 'repetición triple de la posición';
      return;
    }
    var total = countPieces(game.board, WHITE) + countPieces(game.board, BLACK);
    if (total === 2 && countKings(game.board, WHITE) === 1 && countKings(game.board, BLACK) === 1) {
      game.status = 'over'; game.winner = null;
      game.reason = 'dama contra dama, sin progreso posible';
    }
  }

  function resultText(game) {
    if (game.status !== 'over') return '';
    if (game.winner === WHITE) return 'Ganaron las blancas.';
    if (game.winner === BLACK) return 'Ganaron las negras.';
    return 'Tablas.';
  }

  /* --- Entrada de texto ------------------------------------------------ */

  function normalizeText(t) {
    var s = String(t == null ? '' : t).toLowerCase().trim();
    if (s.normalize) s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    s = s.replace(/[×✕✖]/g, 'x').replace(/->|=>|—|–/g, '-');
    s = s.replace(/^(?:muevo|mueve|juego|juega|jugada|de|desde)\s+/, '');
    s = s.replace(/\s+(?:a|hacia|hasta)\s+/g, '-');
    return s.replace(/\s+/g, ' ');
  }

  function listNotations(moves, limit) {
    var list = moves.slice(0, limit || 12).map(notation);
    return list.join(', ');
  }

  function parseMoveText(text, game, options) {
    var norm = normalizeText(text);
    if (!norm) return { error: 'Escribe una jugada, por ejemplo c3-d4.' };

    var tokens = norm.match(/[a-h][1-8]/g) || [];
    if (!tokens.length) return { error: 'No he encontrado ninguna casilla en lo que has escrito.' };

    var rest = norm.replace(/[a-h][1-8]/g, ' ');
    if (/[^\s\-x:.,]/.test(rest)) {
      return { error: 'Formato no reconocido. Usa por ejemplo c3-d4 o c3xd5.' };
    }

    var idxs = [];
    for (var i = 0; i < tokens.length; i++) {
      var idx = indexOfName(tokens[i]);
      if (idx < 0 || !isPlayable(idx)) {
        return { error: 'La casilla ' + tokens[i] + ' no es jugable: se juega sobre las casillas oscuras.' };
      }
      idxs.push(idx);
    }

    var soplido = !!(options && options.soplido);
    var moves = soplido
      ? generatePermissiveMoves(game.board, game.turn)
      : generateMoves(game.board, game.turn);

    if (idxs.length === 1) {
      return { inspect: idxs[0] };
    }

    var from = idxs[0], to = idxs[idxs.length - 1], k;
    var candidates = [];

    if (idxs.length === 2) {
      for (k = 0; k < moves.length; k++) {
        if (moves[k].from === from && moves[k].to === to) candidates.push(moves[k]);
      }
    } else {
      for (k = 0; k < moves.length; k++) {
        var m = moves[k];
        if (m.from !== from || m.to !== to) continue;
        if (m.path.length === idxs.length && m.path.every(function (p, n) { return p === idxs[n]; })) {
          candidates.push(m);
        }
      }
      if (!candidates.length) {
        for (k = 0; k < moves.length; k++) {
          if (moves[k].from === from && moves[k].to === to && moves[k].captures.length === 0) candidates.push(moves[k]);
        }
      }
    }

    if (candidates.length === 1) return { move: candidates[0] };

    if (candidates.length > 1) {
      var quiereCaptura = /x/.test(norm);
      var quiereQuieta = /-/.test(norm);
      if (quiereCaptura) {
        var soloCapturas = candidates.filter(function (m) { return m.captures.length > 0; });
        if (soloCapturas.length) candidates = soloCapturas;
      } else if (quiereQuieta) {
        var soloQuietas = candidates.filter(function (m) { return m.captures.length === 0; });
        if (soloQuietas.length) candidates = soloQuietas;
      }
      if (candidates.length === 1) return { move: candidates[0] };
      return {
        error: 'Esa jugada es ambigua. Escribe la ruta completa: ' +
          candidates.map(notation).join(' o ') + '.'
      };
    }

    var fromMoves = moves.filter(function (m) { return m.from === from; });
    if (!fromMoves.length) {
      if (game.board[from] === EMPTY) {
        return { error: 'La casilla ' + squareName(from) + ' está vacía. No hay ninguna ficha ahí.' };
      }
      if (sideOf(game.board[from]) !== game.turn) {
        return { error: 'La ficha de ' + squareName(from) + ' es de ' + (game.turn === WHITE ? 'las negras' : 'las blancas') + '.' };
      }
      var anyCapture = moves.some(function (m) { return m.captures.length > 0; });
      if (anyCapture && !soplido) {
        return { error: 'Esa ficha no puede mover. Hay captura obligatoria: ' + listNotations(moves) + '.' };
      }
      return { error: 'Esa ficha no tiene jugadas legales ahora mismo.' };
    }

    var dests = fromMoves.map(function (m) { return squareName(m.to); });
    var unique = dests.filter(function (d, n) { return dests.indexOf(d) === n; });
    return {
      error: 'Desde ' + squareName(from) + ' puedes ir a ' + unique.join(', ') + '. ' +
        'Jugadas legales: ' + listNotations(fromMoves) + '.'
    };
  }

  /* --- Utilidades de presentación -------------------------------------- */

  function squareDescription(board, idx, moves) {
    var name = squareName(idx);
    if (!isPlayable(idx)) return name + ', casilla clara, no jugable';
    var p = board[idx];
    var base;
    if (p === EMPTY) base = name + ', vacía';
    else base = name + ', ' + pieceName(p) + ' ' + pieceColorName(p);
    if (moves) {
      var fromMoves = moves.filter(function (m) { return m.from === idx; });
      if (fromMoves.length) {
        var dests = fromMoves.map(function (m) { return squareName(m.to); });
        var unique = dests.filter(function (d, n) { return dests.indexOf(d) === n; });
        base += '. Puede mover a ' + unique.join(', ');
        if (fromMoves[0].captures.length) base += '. Captura obligatoria';
      }
    }
    return base;
  }

  global.Damas = {
    EMPTY: EMPTY, WM: WM, WK: WK, BM: BM, BK: BK,
    WHITE: WHITE, BLACK: BLACK,
    isWhite: isWhite, isBlack: isBlack, isKing: isKing, sideOf: sideOf, opposite: opposite,
    idxOf: idxOf, rowOf: rowOf, colOf: colOf, isPlayable: isPlayable,
    squareName: squareName, parseSquare: parseSquare, indexOfName: indexOfName,
    initialBoard: initialBoard, countPieces: countPieces, countKings: countKings,
    generateMoves: generateMoves, generatePermissiveMoves: generatePermissiveMoves,
    isOmission: isOmission,
    makeMove: makeMove, unmakeMove: unmakeMove,
    cloneMove: cloneMove, notation: notation, describeMove: describeMove,
    pieceName: pieceName, pieceColorName: pieceColorName,
    shortDescription: shortDescription, createGame: createGame, playMove: playMove,
    updateStatus: updateStatus, resultText: resultText, positionKey: positionKey,
    parseMoveText: parseMoveText, normalizeText: normalizeText,
    squareDescription: squareDescription, listNotations: listNotations
  };
})(typeof window !== 'undefined' ? window : globalThis);
