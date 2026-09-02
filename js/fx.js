/* ============================================================
   fx.js — suara, getaran, dan partikel perayaan
   Semua bunyi dibangkitkan lewat WebAudio, tanpa berkas eksternal.
   ============================================================ */
(function (global) {
  'use strict';

  /* ---------- Suara ---------- */
  var ctx = null, on = true;

  function ac() {
    if (!ctx) {
      var C = global.AudioContext || global.webkitAudioContext;
      if (!C) return null;
      ctx = new C();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  /* Satu nada sederhana. */
  function tone(freq, dur, type, vol, delay) {
    if (!on) return;
    var a = ac(); if (!a) return;
    var t0 = a.currentTime + (delay || 0);
    var osc = a.createOscillator(), g = a.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.16, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(a.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.03);
  }

  /* Nada meluncur, untuk efek "wush". */
  function sweep(from, to, dur, type, vol) {
    if (!on) return;
    var a = ac(); if (!a) return;
    var t0 = a.currentTime;
    var osc = a.createOscillator(), g = a.createGain();
    osc.type = type || 'sawtooth';
    osc.frequency.setValueAtTime(from, t0);
    osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    g.gain.setValueAtTime(vol || 0.1, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(a.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.03);
  }

  var SFX = {
    tap:    function () { tone(520, 0.05, 'triangle', 0.07); },
    ok:     function () { tone(660, 0.1, 'triangle', 0.15); tone(880, 0.16, 'triangle', 0.14, 0.08); },
    combo:  function (n) {
      var base = 660 + Math.min(n, 8) * 60;
      tone(base, 0.09, 'triangle', 0.14);
      tone(base * 1.5, 0.14, 'triangle', 0.12, 0.07);
    },
    bad:    function () { tone(200, 0.2, 'sawtooth', 0.11); tone(150, 0.26, 'sawtooth', 0.09, 0.06); },
    tick:   function () { tone(1100, 0.035, 'square', 0.05); },
    hurry:  function () { tone(880, 0.05, 'square', 0.08); },
    start:  function () { sweep(220, 900, 0.4, 'sawtooth', 0.09); },
    match:  function () { tone(440, 0.1, 'square', 0.1); tone(660, 0.12, 'square', 0.1, 0.1); tone(880, 0.2, 'square', 0.1, 0.2); },
    win:    function () {
      [523, 659, 784, 1047].forEach(function (f, i) { tone(f, 0.3, 'triangle', 0.16, i * 0.11); });
    },
    lose:   function () {
      [440, 392, 330, 262].forEach(function (f, i) { tone(f, 0.28, 'sine', 0.13, i * 0.13); });
    },
    level:  function () {
      [659, 784, 988, 1319].forEach(function (f, i) { tone(f, 0.35, 'triangle', 0.15, i * 0.09); });
    },
    coin:   function () { tone(1046, 0.07, 'square', 0.1); tone(1568, 0.12, 'square', 0.09, 0.06); }
  };

  function setSound(v) { on = !!v; }
  function soundOn() { return on; }

  /* ---------- Getaran ---------- */
  function buzz(pattern) {
    if (!on) return;
    if (global.navigator && global.navigator.vibrate) {
      try { global.navigator.vibrate(pattern); } catch (e) { /* diabaikan */ }
    }
  }

  /* ---------- Partikel ---------- */
  var cv = null, cx = null, parts = [], raf = 0;

  function fit() {
    if (!cv) return;
    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    cv.width = global.innerWidth * dpr;
    cv.height = global.innerHeight * dpr;
    cv.style.width = global.innerWidth + 'px';
    cv.style.height = global.innerHeight + 'px';
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function init() {
    cv = document.getElementById('fx');
    if (!cv) return;
    cx = cv.getContext('2d');
    fit();
    global.addEventListener('resize', fit);
  }

  var COLORS = ['#ffc53d', '#ff9f1c', '#4d7cff', '#2ee6a0', '#ff5fa2', '#31e1ff', '#ffffff'];

  function loop() {
    raf = 0;
    if (!cx) return;
    cx.clearRect(0, 0, cv.width, cv.height);
    var alive = 0;
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (p.life <= 0) continue;
      alive++;
      p.vy += p.g;
      p.vx *= 0.995;
      p.x += p.vx; p.y += p.vy;
      p.rot += p.vr;
      p.life -= 1;
      cx.save();
      cx.globalAlpha = Math.max(0, Math.min(1, p.life / 45));
      cx.translate(p.x, p.y);
      cx.rotate(p.rot);
      cx.fillStyle = p.c;
      if (p.round) { cx.beginPath(); cx.arc(0, 0, p.w / 2, 0, 6.2832); cx.fill(); }
      else cx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      cx.restore();
    }
    if (alive) raf = requestAnimationFrame(loop);
    else { parts = []; cx.clearRect(0, 0, cv.width, cv.height); }
  }

  /* Ledakan konfeti. origin dalam rasio 0..1 dari layar. */
  function confetti(count, ox, oy, power) {
    if (!cx) init();
    if (!cx) return;
    count = count || 90;
    var x0 = (ox == null ? 0.5 : ox) * global.innerWidth;
    var y0 = (oy == null ? 0.35 : oy) * global.innerHeight;
    power = power || 1;
    for (var i = 0; i < count; i++) {
      var ang = Math.random() * Math.PI * 2;
      var sp = (2 + Math.random() * 7) * power;
      parts.push({
        x: x0, y: y0,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - 3 * power,
        g: 0.16 + Math.random() * 0.1,
        w: 5 + Math.random() * 7,
        h: 8 + Math.random() * 8,
        rot: Math.random() * 6.28,
        vr: (Math.random() - 0.5) * 0.3,
        c: COLORS[(Math.random() * COLORS.length) | 0],
        round: Math.random() < 0.25,
        life: 90 + Math.random() * 60
      });
    }
    if (parts.length > 500) parts = parts.slice(-500);
    if (!raf) raf = requestAnimationFrame(loop);
  }

  /* Percikan kecil di titik tertentu (koordinat piksel). */
  function burst(x, y, color, n) {
    if (!cx) init();
    if (!cx) return;
    for (var i = 0; i < (n || 14); i++) {
      var ang = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 4;
      parts.push({
        x: x, y: y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 1,
        g: 0.14, w: 4 + Math.random() * 4, h: 4 + Math.random() * 4,
        rot: 0, vr: 0.2, c: color || '#ffc53d', round: true, life: 40 + Math.random() * 25
      });
    }
    if (!raf) raf = requestAnimationFrame(loop);
  }

  global.COC_FX = {
    init: init, sfx: SFX, buzz: buzz, confetti: confetti, burst: burst,
    setSound: setSound, soundOn: soundOn
  };
})(window);
