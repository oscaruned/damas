/* Voz (TTS), región aria-live y señales sonoras. Sin archivos externos. */
(function (global) {
  'use strict';

  var synth = global.speechSynthesis || null;
  var VoiceCtor = global.SpeechSynthesisUtterance || null;
  var voice = null;
  var enabled = true;
  var rate = 1;
  var liveEl = null;
  var liveTimer = null;

  function supported() { return !!(synth && VoiceCtor); }

  function pickVoice() {
    if (!supported()) return;
    var voices = synth.getVoices() || [];
    if (!voices.length) return;
    var spanish = voices.filter(function (v) { return /^es/i.test(v.lang || ''); });
    if (!spanish.length) { voice = null; return; }
    var preferred = spanish.filter(function (v) { return /^es[-_]ES/i.test(v.lang); })[0];
    voice = preferred || spanish[0];
  }

  function init() {
    if (!supported()) return;
    pickVoice();
    if (synth.addEventListener) synth.addEventListener('voiceschanged', pickVoice);
    else synth.onvoiceschanged = pickVoice;
  }

  function toSpeech(text) {
    return String(text)
      .replace(/([a-h][1-8])[xX]([a-h][1-8])/g, '$1 come $2')
      .replace(/([a-h][1-8])[-–]([a-h][1-8])/g, '$1 a $2')
      .replace(/×/g, ' come ')
      .replace(/=D/g, ' corona');
  }

  function setLive(text) {
    if (!liveEl) liveEl = global.document ? global.document.getElementById('anuncios') : null;
    if (!liveEl) return;
    if (liveTimer) global.clearTimeout(liveTimer);
    liveEl.textContent = '';
    liveTimer = global.setTimeout(function () { liveEl.textContent = text; }, 60);
  }

  function speak(text) {
    if (!enabled || !supported()) return;
    try {
      synth.cancel();
      var u = new VoiceCtor(text);
      u.lang = 'es-ES';
      u.rate = rate;
      u.pitch = 1;
      if (voice) u.voice = voice;
      synth.speak(u);
    } catch (e) { /* silencio */ }
  }

  function announce(text, opts) {
    var clean = String(text || '');
    setLive(clean);
    if (!opts || opts.speak !== false) speak(toSpeech(clean));
  }

  function repeatLast() { return last; }
  var last = '';
  function say(text, opts) { last = text; announce(text, opts); }

  function setEnabled(value) {
    enabled = !!value;
    if (!enabled && supported()) { try { synth.cancel(); } catch (e) {} }
  }

  function setRate(value) {
    var v = Number(value);
    if (isFinite(v) && v >= 0.5 && v <= 2) rate = v;
  }

  function stop() { if (supported()) { try { synth.cancel(); } catch (e) {} } }

  /* --- Señales sonoras ------------------------------------------------- */
  var audioCtx = null;
  var soundEnabled = true;

  function ensureAudio() {
    var Ctx = global.AudioContext || global.webkitAudioContext;
    if (!Ctx) return null;
    if (!audioCtx) {
      try { audioCtx = new Ctx(); } catch (e) { return null; }
    }
    if (audioCtx.state === 'suspended' && audioCtx.resume) audioCtx.resume();
    return audioCtx;
  }

  function tone(freq, when, dur, type, vol) {
    var ctx = ensureAudio();
    if (!ctx) return;
    var t0 = ctx.currentTime + when;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol || 0.12, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  var Sonido = {
    setEnabled: function (v) { soundEnabled = !!v; },
    isEnabled: function () { return soundEnabled; },
    desbloquear: function () { ensureAudio(); },
    mover: function () { if (!soundEnabled) return; tone(520, 0, 0.07, 'sine', 0.07); },
    comer: function () {
      if (!soundEnabled) return;
      tone(440, 0, 0.08, 'triangle', 0.09);
      tone(300, 0.07, 0.12, 'triangle', 0.09);
    },
    coronar: function () {
      if (!soundEnabled) return;
      tone(523, 0, 0.09, 'sine', 0.08);
      tone(659, 0.09, 0.09, 'sine', 0.08);
      tone(784, 0.18, 0.16, 'sine', 0.09);
    },
    soplo: function () {
      if (!soundEnabled) return;
      tone(680, 0, 0.09, 'triangle', 0.08);
      tone(420, 0.08, 0.12, 'triangle', 0.07);
      tone(260, 0.18, 0.18, 'sine', 0.06);
    },
    error: function () { if (!soundEnabled) return; tone(160, 0, 0.18, 'square', 0.05); },
    fin: function () {
      if (!soundEnabled) return;
      tone(392, 0, 0.12, 'sine', 0.08);
      tone(330, 0.13, 0.12, 'sine', 0.08);
      tone(262, 0.26, 0.24, 'sine', 0.08);
    },
    turno: function () { if (!soundEnabled) return; tone(660, 0, 0.05, 'sine', 0.045); }
  };

  init();

  global.Voz = {
    supported: supported,
    announce: announce,
    say: say,
    repeatLast: repeatLast,
    setEnabled: setEnabled,
    isEnabled: function () { return enabled; },
    setRate: setRate,
    stop: stop,
    toSpeech: toSpeech,
    init: init
  };
  global.Sonido = Sonido;
})(typeof window !== 'undefined' ? window : globalThis);
