/* Motor de la máquina: minimax con poda alfa-beta y profundización iterativa. */
(function (global) {
  'use strict';

  var D = global.Damas;
  var INF = 1e9, MATE = 100000;

  var LEVELS = {
    facil: { maxDepth: 2, timeMs: 120, random: 0.35, label: 'Fácil' },
    medio: { maxDepth: 6, timeMs: 450, random: 0.06, label: 'Medio' },
    dificil: { maxDepth: 10, timeMs: 900, random: 0, label: 'Difícil' }
  };

  function evaluate(board, side) {
    var score = 0;
    for (var i = 0; i < 64; i++) {
      var p = board[i];
      if (p === 0) continue;
      var r = i >> 3, c = i & 7;
      var v;
      if (p === 1) {
        v = 100 + r * 5;
        if (r === 0) v += 10;
        if (c === 0 || c === 7) v -= 5;
        if (c >= 2 && c <= 5 && r >= 2 && r <= 5) v += 4;
      } else if (p === 2) {
        v = 330 + ((c >= 2 && c <= 5 && r >= 2 && r <= 5) ? 10 : 0);
      } else if (p === 3) {
        v = -(100 + (7 - r) * 5);
        if (r === 7) v -= 10;
        if (c === 0 || c === 7) v += 5;
        if (c >= 2 && c <= 5 && r >= 2 && r <= 5) v -= 4;
      } else {
        v = -(330 + ((c >= 2 && c <= 5 && r >= 2 && r <= 5) ? 10 : 0));
      }
      score += v;
    }
    return side === 'w' ? score : -score;
  }

  function moveScore(m) {
    return m.captures.length * 1000 + (m.promote ? 400 : 0) + (D.isKing(m.piece) ? 20 : 0);
  }

  function orderMoves(moves, preferred) {
    return moves.slice().sort(function (a, b) {
      if (preferred && a.from === preferred.from && a.to === preferred.to && a.captures.length === preferred.captures.length) return -1;
      if (preferred && b.from === preferred.from && b.to === preferred.to && b.captures.length === preferred.captures.length) return 1;
      return moveScore(b) - moveScore(a);
    });
  }

  function alphabeta(board, side, depth, alpha, beta, ply, ctx) {
    if (ctx.aborted) return 0;
    ctx.nodes++;
    if ((ctx.nodes & 255) === 0 && performance.now() > ctx.deadline) {
      ctx.aborted = true;
      return 0;
    }
    var moves = D.generateMoves(board, side);
    if (moves.length === 0) return -(MATE - ply);
    if (depth <= 0) {
      var forced = moves[0].captures.length > 0;
      if (!forced || ply >= ctx.quietLimit) return evaluate(board, side);
    }
    moves = orderMoves(moves);
    var best = -INF, k;
    for (k = 0; k < moves.length; k++) {
      var m = moves[k];
      D.makeMove(board, m);
      var score = -alphabeta(board, D.opposite(side), depth - 1, -beta, -alpha, ply + 1, ctx);
      D.unmakeMove(board, m);
      if (ctx.aborted) return 0;
      if (score > best) best = score;
      if (score > alpha) alpha = score;
      if (alpha >= beta) break;
    }
    return best;
  }

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function chooseMove(board, side, levelName) {
    var cfg = LEVELS[levelName] || LEVELS.medio;
    var rootMoves = D.generateMoves(board, side);
    if (!rootMoves.length) return null;
    if (rootMoves.length === 1) return D.cloneMove(rootMoves[0]);
    if (cfg.random && Math.random() < cfg.random) {
      return D.cloneMove(rootMoves[Math.floor(Math.random() * rootMoves.length)]);
    }

    var start = performance.now();
    var deadline = start + cfg.timeMs;
    var ordered = orderMoves(shuffle(rootMoves.slice()));
    var best = ordered[0];
    var bestScore = -INF;

    for (var depth = 1; depth <= cfg.maxDepth; depth++) {
      var ctx = { nodes: 0, deadline: deadline, quietLimit: depth + 6, aborted: false };
      var alpha = -INF;
      var iterBest = null;
      for (var k = 0; k < ordered.length; k++) {
        var m = ordered[k];
        D.makeMove(board, m);
        var score = -alphabeta(board, D.opposite(side), depth - 1, -INF, -alpha, 1, ctx);
        D.unmakeMove(board, m);
        if (ctx.aborted) break;
        if (iterBest === null || score > alpha) { alpha = score; iterBest = m; }
      }
      if (ctx.aborted) break;
      if (iterBest) {
        best = iterBest;
        bestScore = alpha;
        ordered = [best].concat(ordered.filter(function (x) { return x !== best; }));
      }
      if (performance.now() > deadline) break;
      if (Math.abs(bestScore) > MATE - 2000) break;
    }
    return D.cloneMove(best);
  }

  global.DamasAI = {
    chooseMove: chooseMove,
    evaluate: evaluate,
    LEVELS: LEVELS
  };
})(typeof window !== 'undefined' ? window : globalThis);
