/* ============================================================
   app.js — alur layar, arena duel, dan turnamen
   ============================================================ */
(function (global) {
  'use strict';

  var D = global.COC_DATA, Q = global.COC_Q, FX = global.COC_FX, S = global.COC_STORE;
  var scr, tabbar, modal;

  var state = {
    screen: 'home',
    tab: 'home',
    sel: { topic: 'campuran', level: 2 },
    match: null,
    tour: null
  };

  /* ---------- pembantu ---------- */
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmt(n) { return Q.fmt(n); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  var toastTimer = 0;
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('on'); }, 2200);
  }

  function dialog(title, bodyHtml, buttons) {
    modal.hidden = false;
    $('modalTitle').textContent = title;
    $('modalBody').innerHTML = bodyHtml;
    var foot = $('modalFoot');
    foot.innerHTML = '';
    (buttons || [{ label: 'Oke', cls: 'btn' }]).forEach(function (b) {
      var el = document.createElement('button');
      el.className = b.cls || 'btn btn-ghost';
      el.textContent = b.label;
      el.onclick = function () { modal.hidden = true; if (b.fn) b.fn(); };
      foot.appendChild(el);
    });
  }

  function hud() {
    $('hudCoin').textContent = fmt(S.p.coin);
    $('hudGem').textContent = fmt(S.p.gem);
  }

  function tierChip(xp) {
    var t = D.tierOf(xp);
    return '<span class="tier" style="color:' + t.color + '">' + t.icon + ' ' + t.name + '</span>';
  }

  function xpBar(xp) {
    var t = D.tierOf(xp), n = D.nextTier(xp);
    var pct = n ? clamp((xp - t.minXp) / (n.minXp - t.minXp) * 100, 0, 100) : 100;
    return '<div class="xpbar">' +
      '<div class="xpbar-track"><div class="xpbar-fill" style="width:' + pct.toFixed(1) + '%"></div></div>' +
      '<div class="xpbar-meta"><span>' + t.icon + ' ' + t.name.toUpperCase() + '</span>' +
      '<span>' + (n ? fmt(xp) + ' / ' + fmt(n.minXp) + ' XP' : fmt(xp) + ' XP · TERTINGGI') + '</span></div></div>';
  }

  /* ============================================================
     Navigasi
     ============================================================ */
  var SCREENS = {};

  function go(name, arg) {
    state.screen = name;
    SCREENS[name](arg);
    var full = name === 'battle' || name === 'mm';
    tabbar.hidden = full;
    if (!full) global.scrollTo(0, 0);
    hud();
    var map = { home: 'home', setup: 'home', bracket: 'home', result: 'home', champion: 'home',
      howto: 'home', rank: 'rank', quest: 'quest', me: 'me' };
    var tab = map[name] || state.tab;
    state.tab = tab;
    Array.prototype.forEach.call(tabbar.querySelectorAll('.tab'), function (b) {
      b.classList.toggle('on', b.dataset.tab === tab);
    });
  }

  /* ============================================================
     Layar: Kenalan (nama & avatar)
     ============================================================ */
  SCREENS.onboard = function () {
    scr.innerHTML =
      '<div class="stack" style="padding-top:8px">' +
        '<div class="center" style="padding:14px 0">' +
          '<div style="font-size:56px;line-height:1">🏆</div>' +
          '<h1 class="h1" style="margin-top:6px">Selamat datang di Arena</h1>' +
          '<p class="sub" style="margin-top:4px">Buat identitas jagoanmu dulu, ya.</p>' +
        '</div>' +
        '<div class="card stack">' +
          '<div><span class="eyebrow">Nama Panggilan</span></div>' +
          '<input class="field" id="nameIn" maxlength="14" placeholder="Contoh: Raka" autocomplete="off"/>' +
          '<div><span class="eyebrow">Pilih Avatar</span></div>' +
          '<div class="avagrid" id="avaGrid">' +
            D.AVATARS.map(function (a, i) {
              return '<button class="avapick' + (i === 0 ? ' on' : '') + '" data-act="ava" data-val="' + a + '">' + a + '</button>';
            }).join('') +
          '</div>' +
        '</div>' +
        '<button class="btn btn-lg btn-block" data-act="saveName"><span class="shine"></span>Masuk Arena 🚀</button>' +
      '</div>';
    state.pickAva = D.AVATARS[0];
    var inp = $('nameIn');
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') ACT.saveName(); });
  };

  /* ============================================================
     Layar: Arena (beranda)
     ============================================================ */
  SCREENS.home = function () {
    var p = S.p;
    var akurasi = p.totalAnswered ? Math.round(p.totalCorrect / p.totalAnswered * 100) : 0;
    var rank = S.myRank();
    var qs = S.quests();
    var siapKlaim = qs.list.filter(function (q) {
      var def = S.questDef(q.id); return def && !q.claimed && q.prog >= def.goal;
    }).length;

    scr.innerHTML =
      '<section class="hero">' +
        '<div class="hero-top">' +
          '<div class="ava">' + p.ava + '</div>' +
          '<div class="hero-id">' +
            '<div class="hero-name">' + esc(p.name || 'Petarung') + '</div>' +
            tierChip(p.xp) +
          '</div>' +
          '<button class="btn btn-ghost btn-sm" data-act="tab" data-val="me">Ubah</button>' +
        '</div>' +
        xpBar(p.xp) +
        '<div class="hero-stats">' +
          '<div class="hstat"><b>' + fmt(p.wins) + '</b><span>Menang</span></div>' +
          '<div class="hstat"><b>' + akurasi + '%</b><span>Akurasi</span></div>' +
          '<div class="hstat"><b>#' + rank + '</b><span>Peringkat</span></div>' +
        '</div>' +
      '</section>' +

      '<div class="sect"><span class="eyebrow">Pilih Pertandingan</span></div>' +
      '<div class="modes">' +
        modeCard('duel', '⚔️', 'Duel Cepat', '10 soal lawan satu penantang', 'linear-gradient(135deg,#ffe08a,#ffc53d,#ff9f1c)', '#ffc53d', '<span class="badge badge-hot">Populer</span>') +
        modeCard('tour', '🏆', 'Turnamen 8 Besar', 'Menang 3 babak untuk jadi juara', 'linear-gradient(135deg,#a6c0ff,#4d7cff,#2f5ce0)', '#4d7cff', '') +
        modeCard('solo', '🎯', 'Latihan Santai', 'Tanpa lawan, fokus asah kemampuan', 'linear-gradient(135deg,#8ff5d5,#2ee6a0,#12b981)', '#2ee6a0', '') +
      '</div>' +

      '<div class="sect"><h2 class="h2">🎯 Misi Hari Ini</h2>' +
        '<button class="link" data-act="tab" data-val="quest">Lihat semua' + (siapKlaim ? ' (' + siapKlaim + ')' : '') + '</button></div>' +
      questList(qs.list.slice(0, 2)) +

      '<div class="sect"><h2 class="h2">📊 Papan Peringkat</h2>' +
        '<button class="link" data-act="tab" data-val="rank">Selengkapnya</button></div>' +
      rankList(S.leaderboard().slice(0, 3), 1) +

      '<div class="sect"><h2 class="h2">📜 Pertandingan Terakhir</h2></div>' +
      historyList(p.history.slice(0, 3)) +

      '<button class="btn btn-ghost btn-block btn-sm" data-act="howto" style="margin-top:16px">❓ Cara Bermain</button>';
  };

  function modeCard(id, icon, title, desc, grad, color, badge) {
    return '<button class="mode" data-act="mode" data-val="' + id + '" style="--mc:' + color + '">' +
      '<span class="mode-ic" style="background:' + grad + '">' + icon + '</span>' +
      '<span class="mode-b"><h3>' + title + badge + '</h3><p>' + desc + '</p></span>' +
      '<span class="mode-go">›</span></button>';
  }

  function questList(list) {
    if (!list.length) return '<div class="empty"><i>🌙</i>Belum ada misi</div>';
    return '<div class="list">' + list.map(function (q) {
      var def = S.questDef(q.id);
      if (!def) return '';
      var beres = q.prog >= def.goal;
      var pct = clamp(q.prog / def.goal * 100, 0, 100);
      return '<div class="item' + (beres ? ' done' : '') + '">' +
        '<div class="item-b">' +
          '<h4>' + def.text + '</h4>' +
          '<p>' + q.prog + ' / ' + def.goal + ' · 🪙' + def.coin + ' 💎' + def.gem + '</p>' +
          '<div class="mini-bar"><i style="width:' + pct + '%"></i></div>' +
        '</div>' +
        (q.claimed
          ? '<span class="tick">✓</span>'
          : (beres
            ? '<button class="btn btn-sm" data-act="claim" data-val="' + q.id + '">Ambil</button>'
            : '')) +
      '</div>';
    }).join('') + '</div>';
  }

  function rankList(rows, from) {
    return '<div class="list">' + rows.map(function (r, i) {
      var no = from + i;
      var cls = no <= 3 ? ' rank-' + no : '';
      return '<div class="item' + (r.me ? ' item-me' : '') + '">' +
        '<span class="rank-no' + cls + '">' + no + '</span>' +
        '<span class="ava ava-xs">' + r.ava + '</span>' +
        '<div class="item-b"><h4>' + esc(r.name) + (r.me ? ' <span style="color:var(--gold)">(kamu)</span>' : '') + '</h4>' +
        '<p>' + D.tierOf(r.xp).icon + ' ' + D.tierOf(r.xp).name + '</p></div>' +
        '<b class="mono" style="font-size:13px">' + fmt(r.xp) + '</b>' +
      '</div>';
    }).join('') + '</div>';
  }

  function historyList(rows) {
    if (!rows.length) return '<div class="empty"><i>🎮</i>Belum ada pertandingan.<br/>Ayo mulai duel pertamamu!</div>';
    var ikon = { win: '🏅', lose: '💤', draw: '🤝', solo: '🎯' };
    return '<div class="list">' + rows.map(function (h) {
      var t = D.topic(h.topic);
      return '<div class="item">' +
        '<span class="rank-no">' + (ikon[h.result] || '🎮') + '</span>' +
        '<div class="item-b"><h4>' + t.name + ' · ' + (D.LEVELS[h.level - 1] ? D.LEVELS[h.level - 1].name : '') + '</h4>' +
        '<p>' + h.correct + '/' + h.total + ' benar · ' + waktuLalu(h.t) + '</p></div>' +
        '<b class="mono" style="font-size:13px;color:' +
          (h.result === 'win' ? 'var(--green)' : h.result === 'lose' ? 'var(--red)' : 'var(--txt2)') + '">' +
          fmt(h.me) + (h.mode === 'solo' ? '' : ' : ' + fmt(h.op)) + '</b>' +
      '</div>';
    }).join('') + '</div>';
  }

  function waktuLalu(t) {
    var d = Math.floor((Date.now() - t) / 1000);
    if (d < 60) return 'baru saja';
    if (d < 3600) return Math.floor(d / 60) + ' menit lalu';
    if (d < 86400) return Math.floor(d / 3600) + ' jam lalu';
    return Math.floor(d / 86400) + ' hari lalu';
  }

  /* ============================================================
     Layar: Persiapan (pilih topik & tingkat)
     ============================================================ */
  var MODE_INFO = {
    duel: { title: 'Duel Cepat', icon: '⚔️', desc: '10 soal, siapa cepat dan tepat dia menang.' },
    tour: { title: 'Turnamen 8 Besar', icon: '🏆', desc: 'Tiga babak: perempat final, semifinal, final.' },
    solo: { title: 'Latihan Santai', icon: '🎯', desc: '10 soal tanpa lawan. XP tetap dapat, separuh.' }
  };

  SCREENS.setup = function (mode) {
    state.sel.mode = mode || state.sel.mode || 'duel';
    var info = MODE_INFO[state.sel.mode];
    scr.innerHTML =
      '<button class="btn btn-ghost btn-sm" data-act="tab" data-val="home">‹ Kembali</button>' +
      '<div class="card card-gold" style="margin-top:12px;text-align:center">' +
        '<div style="font-size:40px">' + info.icon + '</div>' +
        '<h1 class="h1" style="margin-top:4px">' + info.title + '</h1>' +
        '<p class="sub">' + info.desc + '</p>' +
      '</div>' +

      '<div class="sect"><span class="eyebrow">Topik Soal</span></div>' +
      '<div class="modes">' +
        D.TOPICS.map(function (t) {
          var on = state.sel.topic === t.id;
          return '<button class="mode" data-act="topic" data-val="' + t.id + '" style="--mc:' + t.color +
            (on ? ';border-color:' + t.color + ';box-shadow:0 0 0 2px ' + t.color + '33' : '') + '">' +
            '<span class="mode-ic" style="background:' + t.grad + '">' + t.icon + '</span>' +
            '<span class="mode-b"><h3>' + t.name + '</h3><p>' + t.desc + '</p></span>' +
            '<span class="mode-go">' + (on ? '✓' : '›') + '</span></button>';
        }).join('') +
      '</div>' +

      '<div class="sect"><span class="eyebrow">Tingkat Kesulitan</span></div>' +
      '<div class="lv">' +
        D.LEVELS.map(function (l) {
          return '<button class="pick' + (state.sel.level === l.d ? ' on' : '') + '" data-act="level" data-val="' + l.d + '">' +
            '<b style="display:block;font-size:15px">' + l.d + '</b>' + l.name + '</button>';
        }).join('') +
      '</div>' +

      '<button class="btn btn-lg btn-block" data-act="start" style="margin-top:20px">' +
        '<span class="shine"></span>Mulai ' + info.icon + '</button>';
  };

  /* ============================================================
     Layar: Peringkat
     ============================================================ */
  SCREENS.rank = function () {
    var rows = S.leaderboard();
    var top = rows.slice(0, 3);
    scr.innerHTML =
      '<div class="sect" style="margin-top:2px"><h1 class="h1">📊 Papan Peringkat</h1></div>' +
      '<p class="sub" style="margin-top:-6px">Poin pengalaman (XP) menentukan urutan.</p>' +
      '<div class="card" style="margin-top:14px">' +
        '<div class="podium">' +
          podBox(top[1], 2) + podBox(top[0], 1) + podBox(top[2], 3) +
        '</div>' +
      '</div>' +
      '<div class="sect"><span class="eyebrow">Klasemen Lengkap</span></div>' +
      rankList(rows, 1);
  };

  function podBox(r, no) {
    if (!r) return '<div class="pod"></div>';
    return '<div class="pod pod-' + no + '">' +
      (no === 1 ? '<span class="crown">👑</span>' : '') +
      '<span class="ava">' + r.ava + '</span>' +
      '<span class="pod-name">' + esc(r.name) + '</span>' +
      '<span class="pod-base">' + no + '</span></div>';
  }

  /* ============================================================
     Layar: Misi
     ============================================================ */
  SCREENS.quest = function () {
    var qs = S.quests();
    scr.innerHTML =
      '<div class="sect" style="margin-top:2px"><h1 class="h1">🎯 Misi Harian</h1></div>' +
      '<p class="sub" style="margin-top:-6px">Diperbarui otomatis setiap hari.</p>' +
      '<div style="margin-top:14px">' + questList(qs.list) + '</div>' +
      '<div class="sect"><span class="eyebrow">Dompet</span></div>' +
      '<div class="grid2">' +
        '<div class="sbox"><span>Koin</span><b>🪙 ' + fmt(S.p.coin) + '</b></div>' +
        '<div class="sbox"><span>Permata</span><b>💎 ' + fmt(S.p.gem) + '</b></div>' +
      '</div>' +
      '<div class="card" style="margin-top:14px">' +
        '<h3 class="h2">Kartu Bantuan</h3>' +
        '<p class="sub" style="margin-top:4px">Di setiap pertandingan kamu dapat dua kartu gratis: ' +
        '<b>Eliminasi</b> membuang dua pilihan salah, <b>Tambah Waktu</b> menambah 6 detik. ' +
        'Pakai di saat yang tepat!</p>' +
      '</div>';
  };

  /* ============================================================
     Layar: Profil
     ============================================================ */
  SCREENS.me = function () {
    var p = S.p;
    var akurasi = p.totalAnswered ? Math.round(p.totalCorrect / p.totalAnswered * 100) : 0;
    var t = D.tierOf(p.xp);
    var tIdx = D.TIERS.indexOf(t);

    scr.innerHTML =
      '<div class="sect" style="margin-top:2px"><h1 class="h1">🧑‍🚀 Profil</h1></div>' +
      '<div class="card card-gold">' +
        '<div class="hero-top">' +
          '<div class="ava">' + p.ava + '</div>' +
          '<div class="hero-id"><div class="hero-name">' + esc(p.name || 'Petarung') + '</div>' + tierChip(p.xp) + '</div>' +
        '</div>' +
        '<div class="tierline">' + D.TIERS.map(function (_, i) {
          return '<i class="' + (i <= tIdx ? 'on' : '') + '"></i>';
        }).join('') + '</div>' +
        '<div style="margin-top:10px">' + xpBar(p.xp) + '</div>' +
      '</div>' +

      '<div class="sect"><span class="eyebrow">Statistik</span></div>' +
      '<div class="statgrid">' +
        '<div class="sbox"><span>Pertandingan</span><b>' + fmt(p.played) + '</b></div>' +
        '<div class="sbox"><span>Menang</span><b>' + fmt(p.wins) + '</b></div>' +
        '<div class="sbox"><span>Akurasi</span><b>' + akurasi + '%</b></div>' +
        '<div class="sbox"><span>Runtun Terbaik</span><b>' + fmt(p.bestStreak) + '</b></div>' +
        '<div class="sbox"><span>Jawaban Benar</span><b>' + fmt(p.totalCorrect) + '</b></div>' +
        '<div class="sbox"><span>Piala Turnamen</span><b>' + fmt(p.trophies) + '</b></div>' +
      '</div>' +

      '<div class="sect"><span class="eyebrow">Lencana (' + p.badges.length + '/' + D.BADGES.length + ')</span></div>' +
      '<div class="badges">' + D.BADGES.map(function (b) {
        var got = p.badges.indexOf(b.id) !== -1;
        return '<div class="bdg' + (got ? ' got' : '') + '"><i>' + b.icon + '</i><b>' + b.name + '</b>' +
          '<small>' + b.desc + '</small></div>';
      }).join('') + '</div>' +

      '<div class="sect"><span class="eyebrow">Pengaturan</span></div>' +
      '<div class="card stack">' +
        '<label class="eyebrow" style="display:block">Nama Panggilan</label>' +
        '<input class="field" id="nameEdit" maxlength="14" value="' + esc(p.name) + '"/>' +
        '<label class="eyebrow" style="display:block">Avatar</label>' +
        '<div class="avagrid">' + D.AVATARS.map(function (a) {
          return '<button class="avapick' + (a === p.ava ? ' on' : '') + '" data-act="ava2" data-val="' + a + '">' + a + '</button>';
        }).join('') + '</div>' +
        '<button class="btn btn-sm" data-act="saveProfile">Simpan Perubahan</button>' +
      '</div>' +

      '<div class="btn-row" style="margin-top:12px">' +
        '<button class="btn btn-ghost btn-sm" data-act="sound">' + (FX.soundOn() ? '🔊 Suara: Nyala' : '🔇 Suara: Mati') + '</button>' +
        '<button class="btn btn-ghost btn-sm" data-act="howto">❓ Cara Bermain</button>' +
      '</div>' +
      '<button class="btn btn-ghost btn-sm btn-block" data-act="reset" style="margin-top:10px;color:var(--red)">Hapus Semua Data</button>' +

      '<div class="sect"><span class="eyebrow">Riwayat</span></div>' +
      historyList(p.history.slice(0, 10));
  };

  /* ============================================================
     Layar: Cara bermain
     ============================================================ */
  SCREENS.howto = function () {
    scr.innerHTML =
      '<button class="btn btn-ghost btn-sm" data-act="tab" data-val="home">‹ Kembali</button>' +
      '<div class="sect"><h1 class="h1">❓ Cara Bermain</h1></div>' +
      '<div class="steps">' +
        '<div class="step"><div><h4>Pilih pertandingan</h4><p>Duel Cepat untuk satu lawan satu, Turnamen untuk tiga babak menuju piala, atau Latihan untuk berlatih santai.</p></div></div>' +
        '<div class="step"><div><h4>Tentukan topik & tingkat</h4><p>Ada tujuh topik, dari Hitung Kilat sampai Soal Cerita, dengan lima tingkat kesulitan.</p></div></div>' +
        '<div class="step"><div><h4>Jawab sebelum waktu habis</h4><p>Nilai dasar 100 per jawaban benar, ditambah bonus kecepatan hingga 100 dan bonus runtun hingga 100.</p></div></div>' +
        '<div class="step"><div><h4>Pakai kartu bantuan</h4><p>Eliminasi membuang dua pilihan salah. Tambah Waktu memberi 6 detik ekstra. Masing-masing sekali per pertandingan.</p></div></div>' +
        '<div class="step"><div><h4>Kumpulkan XP dan naik tingkat</h4><p>Dari Perunggu sampai Sang Juara. XP juga menentukan posisimu di papan peringkat.</p></div></div>' +
      '</div>' +
      '<div class="card" style="margin-top:14px">' +
        '<h3 class="h2">Rumus Nilai</h3>' +
        '<p class="sub" style="margin-top:6px">' +
        'Nilai = <b>100</b> (benar) + <b>sisa waktu × 100</b> (kecepatan) + <b>runtun × 20</b> (maksimal 100).<br/>' +
        'Jawaban salah atau kehabisan waktu bernilai 0 dan memutus runtun.</p>' +
      '</div>';
  };

  /* ============================================================
     Mesin pertandingan
     ============================================================ */
  var RING_C = 157.08;      /* keliling lingkaran r = 25 */
  var SOAL_PER_MATCH = 10;

  function poin(sisaRasio, runtun) {
    return 100 + Math.round(100 * clamp(sisaRasio, 0, 1)) + Math.min(runtun, 5) * 20;
  }

  function lawanAcak(level) {
    var pool = D.RIVALS.filter(function (r) {
      return Math.abs(r.skill - (0.5 + level * 0.07)) < 0.2;
    });
    return Q.pick(pool.length ? pool : D.RIVALS);
  }

  /* cfg: { topic, level, mode, rival, roundName, onDone } */
  function mulaiDuel(cfg) {
    var topik = D.topic(cfg.topic);
    var batas = Math.max(9, topik.time - (cfg.level - 1) * 1.2) * 1000;

    state.match = {
      cfg: cfg,
      qs: Q.pack(SOAL_PER_MATCH, cfg.topic, cfg.level),
      i: 0,
      my: 0, op: 0,
      streak: 0, best: 0, opStreak: 0,
      correct: 0, fast: 0, fastest: 0,
      log: [],
      lock: true,
      pw: { fifty: true, time: true },
      opState: null,
      botPlan: null,
      baseMs: batas, limitMs: batas, endAt: 0,
      raf: 0, botT: 0, nextT: 0, lastTick: -1
    };
    FX.sfx.start();
    go('battle');
  }

  SCREENS.battle = function () { gambarSoal(); };

  function gambarSoal() {
    var m = state.match;
    if (!m) { go('home'); return; }
    var q = m.qs[m.i];
    var solo = m.cfg.mode === 'solo';
    var topik = D.topic(q.topic);
    var lawan = m.cfg.rival;

    m.lock = false;
    m.opState = null;
    m.limitMs = m.baseMs;
    m.endAt = Date.now() + m.limitMs;
    m.lastTick = -1;

    var titik = m.qs.map(function (_, idx) {
      var st = m.log[idx];
      var c = idx === m.i ? 'now' : (st ? (st.ok ? 'ok' : 'no') : '');
      return '<i class="' + c + '"></i>';
    }).join('');

    scr.innerHTML =
      '<div class="duel">' +
        '<div class="row">' +
          '<span class="round-tag">Soal ' + (m.i + 1) + '/' + m.qs.length + '</span>' +
          '<span class="spacer"></span>' +
          '<span class="round-tag">' + (m.cfg.roundName || topik.name) + '</span>' +
          '<button class="quitbtn" data-act="quit" aria-label="Keluar dari pertandingan">✕</button>' +
        '</div>' +

        '<div class="duel-hud">' +
          '<div class="fighter" id="fMe">' +
            '<span class="ava ava-sm">' + S.p.ava + '</span>' +
            '<span class="fighter-b"><h5>' + esc(S.p.name || 'Kamu') + '</h5><b id="scMe">' + fmt(m.my) + '</b></span>' +
            '<span class="answered" id="anMe"></span>' +
          '</div>' +
          '<div class="ring" id="ring">' +
            '<svg viewBox="0 0 60 60" aria-hidden="true">' +
              '<circle class="bg" cx="30" cy="30" r="25"/>' +
              '<circle class="fg" cx="30" cy="30" r="25" stroke-dasharray="' + RING_C + '" stroke-dashoffset="0"/>' +
            '</svg><b id="ringNum">' + Math.ceil(m.limitMs / 1000) + '</b>' +
          '</div>' +
          (solo
            ? '<div class="fighter r"><span class="ava ava-sm">🎯</span>' +
              '<span class="fighter-b"><h5>Benar</h5><b id="scOp">' + m.correct + '/' + m.qs.length + '</b></span></div>'
            : '<div class="fighter r" id="fOp">' +
              '<span class="ava ava-sm">' + lawan.ava + '</span>' +
              '<span class="fighter-b"><h5>' + esc(lawan.name) + '</h5><b id="scOp">' + fmt(m.op) + '</b></span>' +
              '<span class="answered" id="anOp"></span>' +
            '</div>') +
        '</div>' +

        (solo ? '' : '<div class="tug"><i class="me" id="tugMe"></i><i class="op" id="tugOp"></i></div>') +
        '<div class="progress-dots">' + titik + '</div>' +

        '<div class="qcard">' +
          '<span class="qtopic">' + topik.icon + ' ' + topik.name + '</span>' +
          '<div class="qtext' + (q.long ? ' long' : '') + '">' + esc(q.text) + '</div>' +
          (m.streak >= 2 ? '<span class="streak-flag">🔥 Runtun ' + m.streak + '</span>' : '') +
        '</div>' +

        '<div class="opts" id="opts">' +
          q.options.map(function (o, idx) {
            return '<button class="opt' + (o.length > 9 ? ' long' : '') + '" data-act="jawab" data-val="' + idx + '">' +
              '<small>' + 'ABCD'[idx] + '</small>' + esc(o) + '</button>';
          }).join('') +
        '</div>' +

        '<div class="powers">' +
          '<button class="power" data-act="pw" data-val="fifty"' + (m.pw.fifty ? '' : ' disabled') + '>✂️ Eliminasi</button>' +
          '<button class="power" data-act="pw" data-val="time"' + (m.pw.time ? '' : ' disabled') + '>⏱️ +6 detik</button>' +
        '</div>' +

        '<div id="post"></div>' +
      '</div>';

    catHud();
    rencanaBot();
    m.raf = requestAnimationFrame(detak);
  }

  function catHud() {
    var m = state.match;
    if (!m) return;
    var a = $('scMe'), b = $('scOp');
    if (a) a.textContent = fmt(m.my);
    if (b) b.textContent = m.cfg.mode === 'solo' ? (m.correct + '/' + m.qs.length) : fmt(m.op);
    var tm = $('tugMe'), to = $('tugOp');
    if (tm && to) {
      var tot = m.my + m.op;
      var pct = tot ? m.my / tot * 100 : 50;
      tm.style.width = pct + '%';
      to.style.width = (100 - pct) + '%';
    }
  }

  function detak() {
    var m = state.match;
    if (!m || state.screen !== 'battle') return;
    var left = Math.max(0, m.endAt - Date.now());
    var num = $('ringNum'), ring = $('ring');
    if (!num) return;
    var det = Math.ceil(left / 1000);
    num.textContent = det;
    var rasio = clamp(left / m.limitMs, 0, 1);
    var fg = ring.querySelector('.fg');
    fg.style.strokeDashoffset = (1 - rasio) * RING_C;
    ring.classList.toggle('warn', left <= 5000 && left > 0);
    if (det !== m.lastTick && det <= 5 && det > 0 && !m.lock) { FX.sfx.hurry(); m.lastTick = det; }
    if (left <= 0) { if (!m.lock) jawab(-1); return; }
    m.raf = requestAnimationFrame(detak);
  }

  /* ---------- lawan komputer ---------- */
  function rencanaBot() {
    var m = state.match;
    if (m.cfg.mode === 'solo') return;
    var skill = clamp(m.cfg.rival.skill - (m.cfg.level - 3) * 0.06, 0.3, 0.95);
    var benar = Math.random() < skill;
    var frac = benar ? (0.18 + Math.random() * 0.5) : (0.4 + Math.random() * 0.55);
    var at = Math.min(m.limitMs * frac, m.limitMs - 150);
    m.botPlan = { ok: benar, at: at, done: false };
    clearTimeout(m.botT);
    m.botT = setTimeout(function () { jalankanBot(); }, at);
  }

  function jalankanBot() {
    var m = state.match;
    if (!m || !m.botPlan || m.botPlan.done) return;
    m.botPlan.done = true;
    var p = m.botPlan;
    if (p.ok) {
      m.op += poin(1 - p.at / m.limitMs, m.opStreak);
      m.opStreak += 1;
    } else {
      m.opStreak = 0;
    }
    m.opState = p.ok ? 'ok' : 'no';
    var badge = $('anOp');
    if (badge) { badge.className = 'answered show ' + (p.ok ? 'ok' : 'no'); badge.textContent = p.ok ? '✓' : '✕'; }
    var f = $('fOp');
    if (f) { f.classList.add(p.ok ? 'score-up' : 'hit'); setTimeout(function () { f.classList.remove('score-up', 'hit'); }, 420); }
    catHud();
  }

  /* ---------- jawaban pemain ---------- */
  function jawab(idx) {
    var m = state.match;
    if (!m || m.lock) return;
    m.lock = true;
    cancelAnimationFrame(m.raf);

    var q = m.qs[m.i];
    var left = Math.max(0, m.endAt - Date.now());
    var pakai = m.limitMs - left;
    var benar = idx === q.correct;
    var dapat = 0;

    if (benar) {
      dapat = poin(left / m.limitMs, m.streak);
      m.my += dapat;
      m.streak += 1;
      if (m.streak > m.best) m.best = m.streak;
      m.correct += 1;
      if (pakai < 5000) m.fast += 1;
      if (m.fastest === 0 || pakai < m.fastest) m.fastest = pakai;
    } else {
      m.streak = 0;
    }
    m.log[m.i] = { ok: benar, ms: pakai, pilih: idx, q: q };

    /* tandai pilihan */
    var opts = $('opts').children;
    for (var i = 0; i < opts.length; i++) {
      opts[i].disabled = true;
      if (i === q.correct) opts[i].classList.add('ok');
      else if (i === idx) opts[i].classList.add('no');
      else opts[i].classList.add('dim');
    }

    var badge = $('anMe');
    if (badge) { badge.className = 'answered show ' + (benar ? 'ok' : 'no'); badge.textContent = benar ? '✓' : '✕'; }
    var fm = $('fMe');
    if (fm) { fm.classList.add(benar ? 'score-up' : 'hit'); setTimeout(function () { fm.classList.remove('score-up', 'hit'); }, 420); }

    umpanBalik(benar, dapat, idx === -1);
    catHud();

    /* pastikan lawan menyelesaikan gilirannya sebelum lanjut */
    clearTimeout(m.botT);
    setTimeout(jalankanBot, 260);

    var post = $('post');
    post.innerHTML =
      '<div class="explain" style="margin-top:12px">' +
        (benar ? '<b>Tepat!</b> ' : (idx === -1 ? '<b>Waktu habis.</b> Jawabannya <b>' + esc(q.answer) + '</b>. ' :
          '<b>Belum tepat.</b> Jawabannya <b>' + esc(q.answer) + '</b>. ')) +
        esc(q.explain) +
      '</div>' +
      '<button class="btn btn-ghost btn-block btn-sm" data-act="next" style="margin-top:10px">' +
        (m.i + 1 >= m.qs.length ? 'Lihat Hasil ›' : 'Soal Berikutnya ›') + '</button>';

    m.nextT = setTimeout(lanjut, benar ? 2000 : 3200);
  }

  function umpanBalik(benar, dapat, habis) {
    var d = document.createElement('div');
    d.className = 'feed ' + (benar ? 'ok' : 'no');
    var m = state.match;
    if (benar) {
      var judul = m.streak >= 5 ? 'LUAR BIASA!' : m.streak >= 3 ? 'HEBAT!' : 'BENAR!';
      d.innerHTML = judul + '<small>+' + fmt(dapat) + ' poin' + (m.streak >= 2 ? ' · runtun ' + m.streak : '') + '</small>';
      FX.sfx.combo(m.streak);
      FX.buzz(20);
      FX.burst(global.innerWidth / 2, global.innerHeight * 0.38, '#2ee6a0', 16);
    } else {
      d.innerHTML = (habis ? 'WAKTU HABIS' : 'SALAH') + '<small>runtun terputus</small>';
      FX.sfx.bad();
      FX.buzz([30, 40, 30]);
    }
    document.body.appendChild(d);
    setTimeout(function () { d.remove(); }, 1000);
  }

  function lanjut() {
    var m = state.match;
    if (!m) return;
    clearTimeout(m.nextT);
    clearTimeout(m.botT);
    jalankanBot();
    m.i += 1;
    if (m.i >= m.qs.length) selesai();
    else gambarSoal();
  }

  function berhentiMatch() {
    var m = state.match;
    if (!m) return;
    cancelAnimationFrame(m.raf);
    clearTimeout(m.botT);
    clearTimeout(m.nextT);
  }

  /* ---------- akhir pertandingan ---------- */
  function selesai() {
    var m = state.match;
    berhentiMatch();

    var solo = m.cfg.mode === 'solo';
    var hasil;
    if (solo) hasil = m.correct / m.qs.length >= 0.6 ? 'win' : 'lose';
    else hasil = m.my > m.op ? 'win' : (m.my < m.op ? 'lose' : 'draw');

    var akurasi = m.correct / m.qs.length;
    var bintang = akurasi >= 0.9 ? 3 : akurasi >= 0.7 ? 2 : akurasi >= 0.4 ? 1 : 0;

    var xp = Math.round(m.my / 10) + m.cfg.level * 6 +
      (hasil === 'win' ? 60 : hasil === 'draw' ? 30 : 15);
    var koin = Math.round(m.my / 25) + (hasil === 'win' ? 40 : 12);
    var permata = (hasil === 'win' && m.correct === m.qs.length) ? 1 : 0;
    if (solo) { xp = Math.round(xp * 0.5); koin = Math.round(koin * 0.5); permata = 0; }

    var efek = S.record({
      result: solo ? 'solo' : hasil,
      mode: m.cfg.mode, topic: m.cfg.topic, level: m.cfg.level,
      myScore: m.my, opScore: m.op,
      correct: m.correct, total: m.qs.length,
      streak: m.best, fastest: m.fastest, fastCount: m.fast,
      xp: xp, coin: koin, gem: permata
    });

    var res = {
      hasil: hasil, bintang: bintang, xp: xp, koin: koin, permata: permata,
      my: m.my, op: m.op, correct: m.correct, total: m.qs.length,
      best: m.best, akurasi: Math.round(akurasi * 100),
      rerata: m.log.length ? Math.round(m.log.reduce(function (s, l) { return s + l.ms; }, 0) / m.log.length / 100) / 10 : 0,
      log: m.log.slice(), efek: efek, cfg: m.cfg
    };

    if (m.cfg.mode === 'tour') selesaiBabak(res);
    else go('result', res);
  }

  SCREENS.result = function (res) {
    state.lastRes = res;
    var judul = { win: 'MENANG!', lose: 'BELUM BERUNTUNG', draw: 'SERI!' };
    var ikon = { win: '🏅', lose: '💪', draw: '🤝' };
    var pesan = {
      win: 'Kamu unggul di arena kali ini.',
      lose: 'Coba lagi, kamu pasti bisa lebih baik.',
      draw: 'Sama kuat! Rematch, yuk.'
    };
    var solo = res.cfg.mode === 'solo';

    if (res.hasil === 'win') { FX.sfx.win(); FX.confetti(120, 0.5, 0.3, 1.15); }
    else if (res.hasil === 'draw') FX.sfx.match();
    else FX.sfx.lose();

    scr.innerHTML =
      '<div class="verdict ' + res.hasil + '">' +
        '<div class="verdict-ic">' + (solo ? '🎯' : ikon[res.hasil]) + '</div>' +
        '<h2>' + (solo ? 'LATIHAN SELESAI' : judul[res.hasil]) + '</h2>' +
        '<p>' + (solo ? 'Nilai akhir latihanmu.' : pesan[res.hasil]) + '</p>' +
        '<div class="stars">' + [0, 1, 2].map(function (i) {
          return '<span class="' + (i < res.bintang ? 'lit' : '') + '">★</span>';
        }).join('') + '</div>' +
        (solo ? '' :
          '<div class="scoreline"><b class="me">' + fmt(res.my) + '</b><i>VS</i><b class="op">' + fmt(res.op) + '</b></div>') +
        '<div class="rewards">' +
          '<span class="reward">⭐ +' + fmt(res.xp) + ' XP</span>' +
          '<span class="reward">🪙 +' + fmt(res.koin) + '</span>' +
          (res.permata ? '<span class="reward">💎 +' + res.permata + '</span>' : '') +
        '</div>' +
      '</div>' +

      '<div class="sect"><span class="eyebrow">Rincian</span></div>' +
      '<div class="statgrid">' +
        '<div class="sbox"><span>Jawaban Benar</span><b>' + res.correct + '/' + res.total + '</b></div>' +
        '<div class="sbox"><span>Akurasi</span><b>' + res.akurasi + '%</b></div>' +
        '<div class="sbox"><span>Runtun Terbaik</span><b>' + res.best + '</b></div>' +
        '<div class="sbox"><span>Rerata Waktu</span><b>' + fmt(res.rerata) + ' dtk</b></div>' +
      '</div>' +

      (res.efek.naikTingkat
        ? '<div class="card card-gold" style="margin-top:12px;text-align:center">' +
          '<div style="font-size:34px">' + res.efek.naikTingkat.icon + '</div>' +
          '<h3 class="h2">Naik Tingkat!</h3><p class="sub">Kamu sekarang <b>' + res.efek.naikTingkat.name + '</b></p></div>'
        : '') +
      (res.efek.lencanaBaru && res.efek.lencanaBaru.length
        ? '<div class="card" style="margin-top:12px"><span class="eyebrow">Lencana Baru</span>' +
          '<div class="rewards" style="margin-top:10px">' + res.efek.lencanaBaru.map(function (b) {
            return '<span class="reward">' + b.icon + ' ' + b.name + '</span>';
          }).join('') + '</div></div>'
        : '') +

      '<div class="sect"><span class="eyebrow">Ulasan Soal</span></div>' +
      '<div class="review">' + res.log.map(function (l, i) {
        return '<div class="rev"><i>' + (l.ok ? '✅' : '❌') + '</i><div class="rev-b">' +
          '<b>' + (i + 1) + '. ' + esc(l.q.text) + '</b>' +
          '<span>' + (l.ok ? 'Benar' : 'Jawaban: <em>' + esc(l.q.answer) + '</em>') +
          ' · ' + fmt(Math.round(l.ms / 100) / 10) + ' dtk</span></div></div>';
      }).join('') + '</div>' +

      (res.cfg.mode === 'tour'
        ? '<button class="btn btn-lg btn-block" data-act="turLanjut" style="margin-top:18px">' +
            (res.tourNext === 'lanjut'
              ? 'Lanjut ke ' + (D.ROUNDS[state.tour.round + 1] || 'Babak Berikutnya') + ' \u203a'
              : res.tourNext === 'juara' ? 'Lihat Podium \ud83c\udfc6' : 'Lihat Hasil Turnamen \u203a') +
          '</button>'
        : '<div class="btn-row" style="margin-top:18px">' +
            '<button class="btn btn-ghost" data-act="tab" data-val="home">Beranda</button>' +
            '<button class="btn" data-act="ulang">Main Lagi</button>' +
          '</div>');

    if (res.efek.naikTingkat) { setTimeout(function () { FX.sfx.level(); FX.confetti(70, 0.5, 0.45); }, 700); }
  };

  /* ============================================================
     Layar: Mencari lawan
     ============================================================ */
  SCREENS.mm = function (cfg) {
    var topik = D.topic(cfg.topic);
    scr.innerHTML =
      '<div class="mm">' +
        '<span class="eyebrow" style="justify-content:center">' + topik.icon + ' ' + topik.name + '</span>' +
        '<div class="mm-scan"><span>🔍</span></div>' +
        '<div><h2 class="h1">Mencari lawan…</h2>' +
        '<p class="sub">Menjodohkan dengan petarung sepadan</p></div>' +
      '</div>';
    FX.sfx.tap();
    setTimeout(function () {
      if (state.screen !== 'mm') return;
      var lawan = cfg.rival || lawanAcak(cfg.level);
      cfg.rival = lawan;
      FX.sfx.match();
      scr.innerHTML =
        '<div class="mm">' +
          '<span class="eyebrow" style="justify-content:center">Lawan ditemukan!</span>' +
          '<div class="vs-wrap">' +
            '<div class="vs-side vs-l"><span class="ava">' + S.p.ava + '</span>' +
              '<h4>' + esc(S.p.name || 'Kamu') + '</h4><small>' + D.tierOf(S.p.xp).name + '</small></div>' +
            '<div class="vs-badge">VS</div>' +
            '<div class="vs-side vs-r"><span class="ava">' + lawan.ava + '</span>' +
              '<h4>' + esc(lawan.name) + '</h4><small>' + gelarBot(lawan.skill) + '</small></div>' +
          '</div>' +
          '<p class="sub">' + (cfg.roundName || 'Duel dimulai sebentar lagi…') + '</p>' +
        '</div>';
      setTimeout(function () {
        if (state.screen !== 'mm') return;
        mulaiDuel(cfg);
      }, 1500);
    }, 1200);
  };

  function gelarBot(skill) {
    if (skill >= 0.88) return 'Sang Juara';
    if (skill >= 0.8) return 'Berlian';
    if (skill >= 0.72) return 'Platina';
    if (skill >= 0.63) return 'Emas';
    if (skill >= 0.55) return 'Perak';
    return 'Perunggu';
  }

  /* ============================================================
     Turnamen 8 besar
     ============================================================ */
  function pasangan(list) {
    var out = [];
    for (var i = 0; i < list.length; i += 2) {
      out.push({ a: list[i], b: list[i + 1], sa: null, sb: null, winner: null, done: false });
    }
    return out;
  }

  function buatTurnamen(topic, level) {
    var aku = { name: S.p.name || 'Kamu', ava: S.p.ava, skill: 0.7, me: true };
    var lawan = Q.shuffle(D.RIVALS.slice()).slice(0, 7).map(function (r) {
      return { name: r.name, ava: r.ava, skill: r.skill };
    });
    var peserta = Q.shuffle([aku].concat(lawan));
    return { topic: topic, level: level, round: 0, rounds: [pasangan(peserta)], out: false, champion: null, awarded: false };
  }

  function matchKu() {
    var t = state.tour;
    if (!t) return null;
    var r = t.rounds[t.round];
    for (var i = 0; i < r.length; i++) if (r[i].a.me || r[i].b.me) return r[i];
    return null;
  }

  function skorBot(p) {
    return Math.max(220, Math.round((0.35 + p.skill * 0.8) * 1350 + Q.ri(-190, 190)));
  }

  function putuskan(m) {
    if (m.sa === m.sb) { if (Math.random() < 0.5) m.sa += 10; else m.sb += 10; }
    m.winner = m.sa > m.sb ? m.a : m.b;
    m.done = true;
  }

  /* Selesaikan semua laga di satu babak yang belum dimainkan. */
  function simSisa(r) {
    r.forEach(function (m) {
      if (m.done) return;
      m.sa = skorBot(m.a); m.sb = skorBot(m.b);
      putuskan(m);
    });
  }

  function selesaiBabak(res) {
    var t = state.tour, m = matchKu();
    if (m) {
      if (m.a.me) { m.sa = res.my; m.sb = res.op; } else { m.sb = res.my; m.sa = res.op; }
      putuskan(m);
    }
    simSisa(t.rounds[t.round]);
    var menang = m && m.winner.me;
    if (!menang) t.out = true;
    res.tourNext = menang ? (t.rounds[t.round].length === 1 ? 'juara' : 'lanjut') : 'gugur';
    go('result', res);
  }

  function lanjutTurnamen() {
    var t = state.tour, r = t.rounds[t.round];
    if (r.length === 1) { t.champion = r[0].winner; go('champion'); return; }
    t.rounds.push(pasangan(r.map(function (m) { return m.winner; })));
    t.round += 1;
    go('bracket');
  }

  function tuntaskanTurnamen() {
    var t = state.tour, guard = 0;
    simSisa(t.rounds[t.round]);
    while (t.rounds[t.round].length > 1 && guard++ < 6) {
      t.rounds.push(pasangan(t.rounds[t.round].map(function (m) { return m.winner; })));
      t.round += 1;
      simSisa(t.rounds[t.round]);
    }
    t.champion = t.rounds[t.round][0].winner;
    go('champion');
  }

  SCREENS.bracket = function () {
    var t = state.tour;
    var m = matchKu();
    scr.innerHTML =
      '<button class="btn btn-ghost btn-sm" data-act="keluarTur">‹ Keluar Turnamen</button>' +
      '<div class="sect"><h1 class="h1">🏆 Turnamen 8 Besar</h1></div>' +
      '<p class="sub" style="margin-top:-6px">' + D.topic(t.topic).name + ' · ' +
        (D.LEVELS[t.level - 1] ? D.LEVELS[t.level - 1].name : '') + '</p>' +

      '<div class="bracket" style="margin-top:16px">' +
        t.rounds.map(function (r, ri) {
          return '<div class="bround"><span class="eyebrow">' + (D.ROUNDS[ri] || 'Babak ' + (ri + 1)) + '</span>' +
            r.map(function (mm) {
              var live = ri === t.round && (mm.a.me || mm.b.me) && !mm.done;
              return '<div class="match' + (live ? ' live' : '') + '">' +
                slot(mm, 'a') + '<div class="mvs">VS</div>' + slot(mm, 'b') + '</div>';
            }).join('') + '</div>';
        }).join('') +
      '</div>' +

      (m && !m.done
        ? '<button class="btn btn-lg btn-block" data-act="mainBabak" style="margin-top:20px">' +
          '<span class="shine"></span>Mainkan ' + (D.ROUNDS[t.round] || 'Babak') + ' ⚔️</button>'
        : '<button class="btn btn-lg btn-block" data-act="tuntas" style="margin-top:20px">Lihat Hasil Akhir ›</button>');
  };

  function slot(m, key) {
    var p = m[key], skor = key === 'a' ? m.sa : m.sb;
    var menang = m.done && m.winner === p;
    var cls = 'mslot' + (key === 'b' ? ' r' : '') + (p.me ? ' me' : '') +
      (m.done ? (menang ? ' win' : ' out') : '');
    return '<div class="' + cls + '"><span class="ava ava-xs">' + p.ava + '</span>' +
      '<span>' + esc(p.name) + '</span>' +
      (skor == null ? '' : '<em>' + fmt(skor) + '</em>') + '</div>';
  }

  SCREENS.champion = function () {
    var t = state.tour;
    var juara = t.champion;
    var final = t.rounds[t.rounds.length - 1][0];
    var runner = final.winner === final.a ? final.b : final.a;
    var semi = t.rounds[t.rounds.length - 2];
    var ketiga = null;
    if (semi) {
      var kalah = semi.map(function (m) { return m.winner === m.a ? m.b : m.a; });
      kalah.sort(function (x, y) { return y.skill - x.skill; });
      ketiga = kalah[0];
    }
    var akuJuara = !!juara.me;

    if (akuJuara && !t.awarded) {
      t.awarded = true;
      S.p.xp += 250; S.p.coin += 200; S.p.gem += 3; S.save();
      S.trophy();
      FX.sfx.win();
      FX.confetti(160, 0.5, 0.3, 1.3);
      setTimeout(function () { FX.confetti(90, 0.25, 0.4); }, 400);
      setTimeout(function () { FX.confetti(90, 0.75, 0.4); }, 800);
    } else if (!t.awarded) {
      t.awarded = true;
      FX.sfx.lose();
    }

    scr.innerHTML =
      '<div class="verdict ' + (akuJuara ? 'win' : 'draw') + '">' +
        '<div class="verdict-ic">' + (akuJuara ? '🏆' : '🎬') + '</div>' +
        '<h2>' + (akuJuara ? 'JUARA!' : 'Turnamen Selesai') + '</h2>' +
        '<p>' + (akuJuara
          ? 'Kamu menaklukkan tiga babak sekaligus.'
          : 'Juara turnamen kali ini: ' + esc(juara.name) + '.') + '</p>' +
        (akuJuara
          ? '<div class="rewards"><span class="reward">⭐ +250 XP</span>' +
            '<span class="reward">🪙 +200</span><span class="reward">💎 +3</span></div>'
          : '') +
        '<div class="podium">' +
          podBox({ name: runner.name, ava: runner.ava }, 2) +
          podBox({ name: juara.name, ava: juara.ava }, 1) +
          (ketiga ? podBox({ name: ketiga.name, ava: ketiga.ava }, 3) : '<div class="pod"></div>') +
        '</div>' +
      '</div>' +

      '<div class="sect"><span class="eyebrow">Bagan Akhir</span></div>' +
      '<div class="bracket">' +
        state.tour.rounds.map(function (r, ri) {
          return '<div class="bround"><span class="eyebrow">' + (D.ROUNDS[ri] || 'Babak ' + (ri + 1)) + '</span>' +
            r.map(function (mm) {
              return '<div class="match">' + slot(mm, 'a') + '<div class="mvs">VS</div>' + slot(mm, 'b') + '</div>';
            }).join('') + '</div>';
        }).join('') +
      '</div>' +

      '<div class="btn-row" style="margin-top:18px">' +
        '<button class="btn btn-ghost" data-act="tab" data-val="home">Beranda</button>' +
        '<button class="btn" data-act="turBaru">Turnamen Lagi</button>' +
      '</div>';
  };

  /* ============================================================
     Aksi
     ============================================================ */
  var ACT = {
    tab: function (v) { FX.sfx.tap(); go(v); },
    howto: function () { FX.sfx.tap(); go('howto'); },

    ava: function (v, el) {
      state.pickAva = v;
      Array.prototype.forEach.call(el.parentNode.children, function (c) { c.classList.remove('on'); });
      el.classList.add('on');
      FX.sfx.tap();
    },
    saveName: function () {
      var v = ($('nameIn').value || '').trim();
      if (v.length < 2) { toast('Isi nama minimal 2 huruf ya'); return; }
      S.p.name = v.slice(0, 14);
      S.p.ava = state.pickAva || S.p.ava;
      S.save();
      FX.sfx.level();
      go('home');
      toast('Selamat datang, ' + S.p.name + '!');
    },
    ava2: function (v, el) {
      S.p.ava = v;
      Array.prototype.forEach.call(el.parentNode.children, function (c) { c.classList.remove('on'); });
      el.classList.add('on');
      FX.sfx.tap();
    },
    saveProfile: function () {
      var v = ($('nameEdit').value || '').trim();
      if (v.length < 2) { toast('Nama minimal 2 huruf'); return; }
      S.p.name = v.slice(0, 14);
      S.save(); FX.sfx.coin();
      go('me'); toast('Profil tersimpan');
    },
    sound: function () {
      S.p.sound = !FX.soundOn();
      FX.setSound(S.p.sound);
      S.save();
      if (S.p.sound) FX.sfx.ok();
      go('me');
    },
    reset: function () {
      dialog('Hapus semua data?', '<p>Nama, XP, koin, lencana, dan riwayat akan hilang permanen dari perangkat ini.</p>', [
        { label: 'Batal', cls: 'btn btn-ghost' },
        { label: 'Hapus', cls: 'btn', fn: function () { S.reset(); go('onboard'); toast('Data dihapus'); } }
      ]);
    },

    mode: function (v) { FX.sfx.tap(); go('setup', v); },
    topic: function (v) { state.sel.topic = v; FX.sfx.tap(); SCREENS.setup(state.sel.mode); },
    level: function (v) { state.sel.level = parseInt(v, 10); FX.sfx.tap(); SCREENS.setup(state.sel.mode); },

    start: function () {
      var s = state.sel;
      if (s.mode === 'tour') {
        state.tour = buatTurnamen(s.topic, s.level);
        FX.sfx.start();
        go('bracket');
      } else {
        go('mm', { topic: s.topic, level: s.level, mode: s.mode });
      }
    },
    ulang: function () {
      var c = state.lastRes && state.lastRes.cfg;
      if (!c) { go('home'); return; }
      if (c.mode === 'solo') { mulaiDuel({ topic: c.topic, level: c.level, mode: 'solo' }); }
      else go('mm', { topic: c.topic, level: c.level, mode: c.mode });
    },

    jawab: function (v) { jawab(parseInt(v, 10)); },
    next: function () { FX.sfx.tap(); lanjut(); },
    pw: function (v, el) {
      var m = state.match;
      if (!m || m.lock || !m.pw[v]) return;
      m.pw[v] = false;
      el.disabled = true;
      if (v === 'fifty') {
        var q = m.qs[m.i], buang = [], i;
        for (i = 0; i < q.options.length; i++) if (i !== q.correct) buang.push(i);
        Q.shuffle(buang);
        buang.slice(0, 2).forEach(function (idx) {
          var b = $('opts').children[idx];
          b.classList.add('gone'); b.disabled = true;
        });
        FX.sfx.coin();
        toast('Dua pilihan salah dibuang!');
      } else {
        m.endAt += 6000;
        FX.sfx.ok();
        toast('+6 detik!');
      }
    },
    quit: function () {
      dialog('Keluar dari pertandingan?', '<p>Kemajuan pertandingan ini tidak akan disimpan.</p>', [
        { label: 'Lanjut Main', cls: 'btn btn-ghost' },
        { label: 'Keluar', cls: 'btn', fn: function () { berhentiMatch(); state.match = null; go('home'); } }
      ]);
    },

    claim: function (v) {
      var def = S.claim(v);
      if (!def) return;
      FX.sfx.coin();
      FX.confetti(40, 0.5, 0.5, 0.7);
      toast('Hadiah diambil: 🪙' + def.coin + ' 💎' + def.gem);
      hud();
      go(state.screen === 'quest' ? 'quest' : 'home');
    },

    mainBabak: function () {
      var t = state.tour, m = matchKu();
      if (!m) return;
      var lawan = m.a.me ? m.b : m.a;
      go('mm', {
        topic: t.topic, level: t.level, mode: 'tour',
        rival: lawan, roundName: D.ROUNDS[t.round] || 'Babak ' + (t.round + 1)
      });
    },
    tuntas: function () { tuntaskanTurnamen(); },
    keluarTur: function () {
      dialog('Keluar turnamen?', '<p>Kemajuan turnamen ini akan hilang.</p>', [
        { label: 'Batal', cls: 'btn btn-ghost' },
        { label: 'Keluar', cls: 'btn', fn: function () { state.tour = null; go('home'); } }
      ]);
    },
    turLanjut: function () {
      var next = state.lastRes && state.lastRes.tourNext;
      if (next === 'lanjut') lanjutTurnamen();
      else if (next === 'juara') { state.tour.champion = state.tour.rounds[state.tour.round][0].winner; go('champion'); }
      else tuntaskanTurnamen();
    },
    turBaru: function () {
      state.tour = buatTurnamen(state.sel.topic, state.sel.level);
      go('bracket');
    }
  };

  /* ============================================================
     Mulai
     ============================================================ */
  function pasangPendengar() {
    scr.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('[data-act]') : null;
      if (!t || t.disabled) return;
      var fn = ACT[t.dataset.act];
      if (fn) fn(t.dataset.val, t, e);
    });

    tabbar.addEventListener('click', function (e) {
      var t = e.target.closest('.tab');
      if (!t) return;
      FX.sfx.tap();
      go(t.dataset.tab);
    });

    $('brandBtn').addEventListener('click', function () { FX.sfx.tap(); go('home'); });

    modal.addEventListener('click', function (e) { if (e.target === modal) modal.hidden = true; });

    /* Pintasan papan ketik saat bertanding. */
    document.addEventListener('keydown', function (e) {
      if (state.screen !== 'battle' || !state.match) return;
      var k = e.key.toUpperCase();
      var idx = 'ABCD'.indexOf(k);
      if (idx === -1 && k >= '1' && k <= '4') idx = parseInt(k, 10) - 1;
      if (idx >= 0) { e.preventDefault(); jawab(idx); }
      else if (e.key === 'Enter' && state.match.lock) { e.preventDefault(); lanjut(); }
    });

    /* Bangunkan audio pada sentuhan pertama. */
    var buka = function () {
      FX.sfx.tap();
      document.removeEventListener('pointerdown', buka);
    };
    document.addEventListener('pointerdown', buka);

    /* Hentikan hitung mundur bila tab disembunyikan. */
    document.addEventListener('visibilitychange', function () {
      var m = state.match;
      if (!m || state.screen !== 'battle') return;
      if (document.hidden) { cancelAnimationFrame(m.raf); m.hiddenAt = Date.now(); }
      else if (m.hiddenAt && !m.lock) {
        m.endAt += Date.now() - m.hiddenAt;
        m.hiddenAt = 0;
        m.raf = requestAnimationFrame(detak);
      }
    });
  }

  function boot() {
    scr = $('screen'); tabbar = $('tabbar'); modal = $('modal');
    S.load();
    FX.init();
    FX.setSound(S.p.sound !== false);
    pasangPendengar();
    hud();
    go(S.p.name ? 'home' : 'onboard');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

})(window);
