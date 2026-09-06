/* ============================================================
   app.js — alur layar dan arena rantai operasi
   ============================================================ */
(function (global) {
  'use strict';

  var D = global.COC_DATA, Q = global.COC_Q, G = global.COC_GRID;
  var FX = global.COC_FX, S = global.COC_STORE;
  var NET = global.COC_NET;
  var LIVE = global.COC_LIVE;
  var scr, tabbar, modal, topbar;

  var state = {
    screen: 'home',
    tab: 'home',
    sel: { game: 'rantai', level: 2 },
    match: null
  };

  /* ---------- pembantu ---------- */
  /* Dua permainan. Id-nya tinggal di kolom `topic` yang sejak dulu ada di
     basis data — dulu diisi tetap 'rantai' waktu permainannya cuma satu.
     Kueri progres tugas sudah mencocokkan `topic` DAN `level`, jadi ia
     langsung bekerja untuk dua permainan tanpa satu baris pun berubah. */
  var GAME = {
    rantai: {
      id: 'rantai', icon: '🧮', nama: 'Rantai Operasi',
      ringkas: '3 rantai operasi · 3 nyawa tiap rantai',
      ajakan: 'Telusuri operasi, hitung mundur, tentukan nilai yang tepat!',
      satuan: 'rantai',
      aturan: [
        'Dalam satu permainan ada <b>3 soal</b> yang harus kamu selesaikan.',
        'Tiap soal berisi rantai operasi hitung dan satu nilai akhir. Kamu mencari <b>nilai awal</b> yang membuat hasil akhirnya pas.',
        'Operasinya dijalankan <b>berurutan</b> dari awal sampai akhir. Aturan urutan operasi matematika tidak berlaku di sini.',
        'Tiap soal kamu punya <b>3 nyawa</b>, berkurang satu setiap kali menjawab salah.',
        'Soal berganti kalau jawabanmu benar atau nyawamu habis.'
      ]
    },
    jumlah: {
      id: 'jumlah', icon: '🔢', nama: 'Jumlahkan Semua',
      ringkas: '3 ronde · papan angka makin rumit',
      ajakan: 'Jumlahkan semua angka di papan!',
      satuan: 'ronde',
      aturan: [
        'Dalam satu permainan ada <b>3 ronde</b> yang harus kamu selesaikan.',
        'Tiap ronde menampilkan satu papan angka. Yang dicari <b>jumlah seluruh isinya</b> — semua sel, tanpa kecuali.',
        'Ronde 1 kisi persegi, ronde 2 sarang lebah, ronde 3 sarang lebah berisi <b>hitungan</b> yang harus dikerjakan dulu sebelum dijumlahkan.',
        'Tiap ronde kamu punya <b>3 nyawa</b>, berkurang satu setiap kali jumlahmu salah.',
        'Ronde berganti kalau jumlahmu benar atau nyawamu habis.'
      ]
    }
  };

  function gameKini() { return GAME[state.sel.game] || GAME.rantai; }

  function namaGame(id) { return (GAME[id] || GAME.rantai).nama; }

  /* ============================================================
     Layar penuh

     Fullscreen API hanya boleh dipanggil dari dalam penanganan sentuhan
     pengguna; dipanggil dari mana pun selain itu, peramban menolaknya
     tanpa suara. Karena itu ia dinyalakan dari tombol Mulai dan dari
     tombol di kepala arena — bukan dari go() saat layarnya berganti.

     Safari di iPhone tidak punya API ini sama sekali untuk elemen biasa,
     hanya untuk video. Di sana tombolnya tidak digambar: lebih baik
     tidak ada tombol daripada tombol yang ditekan lalu tidak terjadi
     apa-apa. iPad dan Android tidak terpengaruh.
     ============================================================ */
  var FS = {
    didukung: function () {
      var e = document.documentElement;
      return !!(e.requestFullscreen || e.webkitRequestFullscreen);
    },
    aktif: function () {
      return !!(document.fullscreenElement || document.webkitFullscreenElement);
    },
    masuk: function () {
      var e = document.documentElement;
      var minta = e.requestFullscreen || e.webkitRequestFullscreen;
      if (!minta || FS.aktif()) return;
      try {
        var hasil = minta.call(e);
        if (hasil && hasil.then) hasil.then(FS.kunciMendatar, function () {});
        else FS.kunciMendatar();
      } catch (x) { /* ditolak peramban — biarkan bermain di jendela biasa */ }
    },
    keluar: function () {
      if (!FS.aktif()) return;
      var lepas = document.exitFullscreen || document.webkitExitFullscreen;
      try { if (lepas) lepas.call(document); } catch (x) { /* sudah keluar */ }
    },
    /* Penguncian orientasi hanya bekerja di dalam layar penuh, dan hanya
       di sebagian peramban — yang lain melemparkan galat alih-alih
       menolak diam-diam, jadi ia dibungkus dua lapis penjaga. */
    kunciMendatar: function () {
      try {
        var o = global.screen && global.screen.orientation;
        if (o && o.lock) { var j = o.lock('landscape'); if (j && j.catch) j.catch(function () {}); }
      } catch (x) { /* tidak didukung */ }
    },
    /* Dipanggil dari tombol yang memulai permainan — satu-satunya tempat
       yang sah menurut peramban. */
    mungkinMasuk: function () {
      if (S.p.layarPenuh !== false) FS.masuk();
    }
  };

  function tombolLayarPenuh() {
    if (!FS.didukung()) return '';
    return '<button class="quitbtn fsbtn' + (FS.aktif() ? ' on' : '') + '" id="fsBtn" ' +
      'data-act="layarPenuh" aria-label="' + (FS.aktif() ? 'Keluar layar penuh' : 'Layar penuh') +
      '">\u26f6</button>';
  }

  function catLayarPenuh() {
    var t = $('fsBtn');
    if (!t) return;
    t.classList.toggle('on', FS.aktif());
    t.setAttribute('aria-label', FS.aktif() ? 'Keluar layar penuh' : 'Layar penuh');
  }

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
    /* Layar penuh hanya untuk bermain. Menu, papan peringkat, dan profil
       kembali ke jendela biasa — di sana bilah peramban justru berguna. */
    if (name !== 'battle' && name !== 'sesi' && name !== 'result' && name !== 'setup') FS.keluar();
    state.screen = name;
    SCREENS[name](arg);
    var full = name === 'battle' || name === 'sesi';
    tabbar.hidden = full;
    /* Saat bermain, kepala panggung ikut menyingkir: di layar itu yang
       berlaku papan "Soal 1/3" dan nyawa, bukan dompet. */
    topbar.hidden = full;
    /* Panggung tidak lagi menggulir bersama halaman — yang menggulir
       hanya kotak layarnya, jadi posisi gulir itu yang perlu disetel
       ulang tiap ganti layar. */
    scr.scrollTop = 0;
    hud();
    var map = { home: 'home', setup: 'home', result: 'home', howto: 'home',
      masuk: 'home', sesi: 'home', battle: 'home', onboard: 'home',
      rank: 'rank', quest: 'quest', me: 'me' };
    var tab = map[name] || state.tab;
    state.tab = tab;
    Array.prototype.forEach.call(tabbar.querySelectorAll('.tab'), function (b) {
      b.classList.toggle('on', b.dataset.tab === tab);
    });
  }

  /* ============================================================
     Layar: Masuk Kelas

     Tiga langkah, sengaja dipisah: kode kelas -> pilih nama -> PIN.
     Di lab komputer bersama, siswa bergantian tiap jam pelajaran, jadi
     mengetik sesedikit mungkin lebih penting daripada satu formulir
     panjang. Nama dipilih dari daftar, bukan diketik, supaya tidak ada
     salah eja yang bikin profil kembar.
     ============================================================ */
  SCREENS.masuk = function () {
    var m = state.masuk || (state.masuk = { langkah: 'kode' });

    if (m.langkah === 'kode') {
      scr.innerHTML =
        '<div class="stack" style="padding-top:8px">' +
          '<div class="center" style="padding:14px 0">' +
            '<div style="font-size:56px;line-height:1">🏫</div>' +
            '<h1 class="h1" style="margin-top:6px">Masuk Kelas</h1>' +
            '<p class="sub" style="margin-top:4px">Ketik kode kelas dari gurumu supaya progresmu tersimpan dan kamu masuk papan peringkat kelas.</p>' +
          '</div>' +
          '<div class="card stack">' +
            '<div><span class="eyebrow">Kode Kelas</span></div>' +
            '<input class="field kodein" id="kodeIn" maxlength="8" placeholder="ABC123" ' +
              'autocomplete="off" autocapitalize="characters" spellcheck="false"/>' +
            (m.galat ? '<p class="sub" style="color:var(--red)">' + esc(m.galat) + '</p>' : '') +
          '</div>' +
          '<button class="btn btn-lg btn-block" data-act="cekKelas"><span class="shine"></span>Cari Kelas 🔎</button>' +
          '<button class="btn btn-ghost btn-sm btn-block" data-act="mainSendiri">Main sendiri dulu</button>' +
        '</div>';
      var k = $('kodeIn');
      k.addEventListener('keydown', function (e) { if (e.key === 'Enter') ACT.cekKelas(); });
      k.focus();
      return;
    }

    if (m.langkah === 'nama') {
      scr.innerHTML =
        '<button class="btn btn-ghost btn-sm" data-act="masukLangkah" data-val="kode">‹ Ganti kode</button>' +
        '<div class="sect"><h1 class="h1">' + esc(m.kelas.nama) + '</h1></div>' +
        '<p class="sub" style="margin-top:-6px">Pilih namamu di daftar ini.</p>' +
        (m.siswa.length ? '<div class="namagrid">' + m.siswa.map(function (sw, i) {
            return '<button class="namapick" data-act="pilihNama" data-val="' + i + '">' +
              '<span class="ava">' + sw.ava + '</span>' +
              '<b>' + esc(sw.nama) + '</b>' +
              '<small>' + (sw.sudahPin ? '🔒 punya PIN' : '✨ baru') + '</small></button>';
          }).join('') + '</div>'
        : '<div class="card center" style="padding:24px"><p class="sub">Belum ada nama di kelas ini. Minta gurumu menambahkan daftar siswa.</p></div>') +
        '<button class="btn btn-ghost btn-sm btn-block" data-act="mainSendiri" style="margin-top:14px">Main sendiri dulu</button>';
      return;
    }

    /* langkah 'pin' */
    var sw = m.pilih;
    scr.innerHTML =
      '<button class="btn btn-ghost btn-sm" data-act="masukLangkah" data-val="nama">‹ Ganti nama</button>' +
      '<div class="center" style="padding:18px 0 6px">' +
        '<div style="font-size:52px;line-height:1">' + sw.ava + '</div>' +
        '<h1 class="h1" style="margin-top:6px">' + esc(sw.nama) + '</h1>' +
        '<p class="sub" style="margin-top:4px">' + esc(m.kelas.nama) + '</p>' +
      '</div>' +
      '<div class="card stack">' +
        '<div><span class="eyebrow">' + (sw.sudahPin ? 'Masukkan PIN' : 'Buat PIN Baru') + '</span></div>' +
        '<input class="field pinin" id="pinIn" inputmode="numeric" pattern="[0-9]*" maxlength="4" ' +
          'placeholder="••••" autocomplete="off"/>' +
        '<p class="sub">' + (sw.sudahPin
          ? 'PIN 4 angka yang kamu buat waktu pertama masuk.'
          : 'Pilih 4 angka yang gampang kamu ingat. PIN ini yang menjaga profilmu supaya tidak dipakai orang lain.') + '</p>' +
        (m.galat ? '<p class="sub" style="color:var(--red)">' + esc(m.galat) + '</p>' : '') +
        '<label class="cek"><input type="checkbox" id="ingatIn"/> ' +
          '<span>Ini perangkatku sendiri — ingat aku</span></label>' +
        '<p class="sub" style="margin-top:-4px">Jangan dicentang kalau ini komputer sekolah yang dipakai bergantian.</p>' +
      '</div>' +
      '<button class="btn btn-lg btn-block" data-act="masukKelas" style="margin-top:12px">' +
        '<span class="shine"></span>' + (sw.sudahPin ? 'Masuk 🚀' : 'Buat PIN & Masuk 🚀') + '</button>';
    var pi = $('pinIn');
    pi.addEventListener('keydown', function (e) { if (e.key === 'Enter') ACT.masukKelas(); });
    pi.addEventListener('input', function () { pi.value = pi.value.replace(/\D/g, ''); });
    pi.focus();
  };

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
  /* Baris papan peringkat: hanya teman sekelas sungguhan. Di luar kelas
     papannya memang kosong — dulu ia diisi dua belas nama karangan, dan
     peringkat di antara nama karangan tidak mengukur apa pun. */
  function barisPapan() {
    if (NET.mode === 'kelas' && NET.papan) {
      return NET.papan.map(function (x) {
        return { name: x.nama, ava: x.ava, xp: x.xp, me: x.aku };
      });
    }
    return [];
  }

  function peringkatku(rows) {
    for (var i = 0; i < rows.length; i++) if (rows[i].me) return i + 1;
    return rows.length;
  }

  SCREENS.home = function () {
    var p = S.p;
    var akurasi = p.totalAnswered ? Math.round(p.totalCorrect / p.totalAnswered * 100) : 0;
    var papan = barisPapan();
    /* Peringkat hanya punya arti kalau ada orang lain di papannya: sebelum
       papan kelas termuat, dan di luar kelas sama sekali, ia dikosongkan. */
    var adaPapan = papan.length > 1;
    var rank = adaPapan ? peringkatku(papan) : '–';
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
          '<div class="hstat"><b>' + fmt(p.wins) + '</b><span>Tuntas</span></div>' +
          '<div class="hstat"><b>' + akurasi + '%</b><span>Akurasi</span></div>' +
          '<div class="hstat"><b>' + (adaPapan ? '#' + rank : '–') + '</b><span>Peringkat</span></div>' +
        '</div>' +
      '</section>' +

      spandukSesi() +

      '<div class="hiscore"><span>HIGH SCORE-MU</span><b>' + fmt(p.high || 0) + '</b></div>' +

      '<div class="sect"><span class="eyebrow">Pilih Permainan</span></div>' +
      '<div class="modes">' +
        modeCard('rantai', GAME.rantai.icon, GAME.rantai.nama, GAME.rantai.ringkas,
          'radial-gradient(60% 46% at 50% 16%,rgba(255,255,255,.55),transparent 70%),linear-gradient(180deg,#cdeefb,#7fd3f0 50%,#42aad4)',
          '#5ad0e6', '') +
        modeCard('jumlah', GAME.jumlah.icon, GAME.jumlah.nama, GAME.jumlah.ringkas,
          'radial-gradient(60% 46% at 50% 16%,rgba(255,255,255,.55),transparent 70%),linear-gradient(180deg,#f8e5ad,#e8b84b 50%,#b7862a)',
          '#e8b84b', '<span class="badge badge-hot">Baru</span>') +
      '</div>' +

      '<div class="sect"><h2 class="h2">🎯 Misi Hari Ini</h2>' +
        '<button class="link" data-act="tab" data-val="quest">Lihat semua' + (siapKlaim ? ' (' + siapKlaim + ')' : '') + '</button></div>' +
      questList(qs.list.slice(0, 2)) +

      (papan.length
        ? '<div class="sect"><h2 class="h2">📊 Papan Peringkat</h2>' +
          '<button class="link" data-act="tab" data-val="rank">Selengkapnya</button></div>' +
          rankList(papan.slice(0, 3), 1)
        : '') +

      '<div class="sect"><h2 class="h2">📜 Permainan Terakhir</h2></div>' +
      historyList(p.history.slice(0, 3)) +

      '<button class="btn btn-ghost btn-block btn-sm" data-act="howto" style="margin-top:16px">❓ Cara Bermain</button>';

    /* Segarkan papan kelas di latar. Teman sekelas bermain sepanjang jam
       pelajaran, jadi peringkat yang ditampilkan tanpa ini akan tertinggal
       selama satu sesi penuh. Digambar ulang hanya kalau urutannya benar-
       benar berubah, supaya layar tidak berkedip tiap kali beranda dibuka. */
    if (NET.mode === 'kelas') {
      var sebelum = JSON.stringify(NET.papan);
      NET.peringkat().then(function () {
        if (state.screen === 'home' && JSON.stringify(NET.papan) !== sebelum) go('home');
      });
    }
  };

  /* Sesi kelas yang sedang berjalan ditaruh paling atas di beranda:
     ia punya jam yang berdetak, dan siswa yang ketinggalan tidak bisa
     mengejar. Mode lain bisa menunggu. */
  function spandukSesi() {
    if (NET.mode !== 'kelas' || !state.sesiAda) return '';
    if (state.sesi && state.sesi.tahap !== 'usai') {
      return '<button class="mode sesi-spanduk" style="--mc:#77c341" data-act="tab" data-val="sesi">' +
        '<span class="mode-ic" style="background:radial-gradient(60% 46% at 50% 16%,rgba(255,255,255,.55),transparent 70%),linear-gradient(180deg,#b6e88a,#77c341 50%,#4b8f1c)">🏫</span>' +
        '<span class="mode-b"><h3>Sesi kelas sedang berjalan</h3><p>Kembali ke sesi</p></span>' +
        '<span class="mode-go">›</span></button>';
    }
    return '<button class="mode sesi-spanduk" style="--mc:#77c341" data-act="gabungSesi">' +
      '<span class="mode-ic" style="background:radial-gradient(60% 46% at 50% 16%,rgba(255,255,255,.55),transparent 70%),linear-gradient(180deg,#b6e88a,#77c341 50%,#4b8f1c)">🏫</span>' +
      '<span class="mode-b"><h3>Sesi Kelas — gabung sekarang</h3>' +
      '<p>' + esc(namaGame(state.sesiAda.topik)) + ' · ' + D.levelName(state.sesiAda.tingkat) +
      ' · seluruh kelas bersamaan</p></span>' +
      '<span class="mode-go">›</span></button>';
  }

  function modeCard(id, icon, title, desc, grad, color, badge) {
    return '<button class="mode" data-act="main" data-val="' + id + '" style="--mc:' + color + '">' +
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
    if (!rows.length) return '<div class="empty"><i>🧮</i>Belum ada permainan.<br/>Ayo pecahkan rantai pertamamu!</div>';
    return '<div class="list">' + rows.map(function (h) {
      return '<div class="item">' +
        '<span class="rank-no">' + (h.result === 'win' ? '🏅' : '💤') + '</span>' +
        '<div class="item-b"><h4>' + esc(namaGame(h.topic)) + ' · ' + D.levelName(h.level) + '</h4>' +
        '<p>' + h.correct + '/' + h.total + ' benar · ' + waktuLalu(h.t) + '</p></div>' +
        '<b class="mono" style="font-size:13px;color:' +
          (h.result === 'win' ? 'var(--green)' : 'var(--txt2)') + '">' + fmt(h.me) + '</b>' +
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
     Layar: Persiapan (pilih tingkat, lalu aturan main)
     ============================================================ */
  SCREENS.setup = function () {
    var lv = D.levelName(state.sel.level);
    var g = gameKini();
    scr.innerHTML =
      '<button class="btn btn-ghost btn-sm" data-act="tab" data-val="home">\u2039 Kembali</button>' +

      '<div class="sect"><span class="eyebrow">Tingkat Kesulitan</span></div>' +
      '<div class="lv">' +
        D.LEVELS.map(function (l) {
          return '<button class="pick' + (state.sel.level === l.d ? ' on' : '') +
            '" data-act="level" data-val="' + l.d + '">' + l.name + '</button>';
        }).join('') +
      '</div>' +

      '<div class="card card-gold" style="margin-top:14px;text-align:center">' +
        '<div style="font-size:38px">' + g.icon + '</div>' +
        '<h1 class="h1" style="margin-top:2px">' + esc(g.nama) + ' \u00b7 ' + lv + '</h1>' +
        '<p class="sub">' + esc(g.ajakan) + '</p>' +
      '</div>' +

      '<div class="sect"><span class="eyebrow">Aturan Main</span></div>' +
      '<ol class="aturan">' +
        g.aturan.map(function (a) { return '<li>' + a + '</li>'; }).join('') +
      '</ol>' +

      '<button class="btn btn-lg btn-block" data-act="start" style="margin-top:18px">' +
        '<span class="shine"></span>Mulai ' + g.icon + '</button>';
  };

  /* ============================================================
     Layar: Peringkat
     ============================================================ */
  SCREENS.rank = function () {
    /* Di dalam kelas, papan ini berisi teman sekelas sungguhan. Di luar
       kelas ia tetap berisi dua belas nama bawaan — itu jauh lebih baik
       daripada papan kosong bagi yang main sendiri. */
    if (NET.mode === 'kelas') {
      scr.innerHTML = kepalaPeringkat(NET.aku.kelas ? NET.aku.kelas.nama : 'Kelas') +
        '<div class="card center" style="padding:26px"><p class="sub">Memuat papan peringkat kelas…</p></div>';
      NET.peringkat().then(function (r) {
        if (state.screen !== 'rank') return;
        if (!r.ok) {
          scr.innerHTML = kepalaPeringkat(NET.aku.kelas ? NET.aku.kelas.nama : 'Kelas') +
            '<div class="card center" style="padding:22px">' +
              '<p class="sub">Papan peringkat kelas belum bisa dimuat.<br>Periksa sambungan internetmu.</p>' +
              '<button class="btn btn-sm" data-act="tab" data-val="rank" style="margin-top:12px">Coba Lagi</button>' +
            '</div>';
          return;
        }
        var rows = r.data.peringkat.map(function (x) {
          return { name: x.nama, ava: x.ava, xp: x.xp, main: x.main, me: x.aku };
        });
        var top = rows.slice(0, 3);
        scr.innerHTML = kepalaPeringkat(NET.aku.kelas ? NET.aku.kelas.nama : 'Kelas') +
          '<div class="card" style="margin-top:14px">' +
            '<div class="podium">' + podBox(top[1], 2) + podBox(top[0], 1) + podBox(top[2], 3) + '</div>' +
          '</div>' +
          '<div class="sect"><span class="eyebrow">Klasemen Lengkap</span></div>' +
          rankList(rows, 1);
      });
      return;
    }

    /* Di luar kelas tidak ada siapa-siapa untuk diperingkatkan. Daripada
       memajang papan berisi satu nama — atau nama karangan seperti dulu —
       layar ini menjelaskan apa yang membuatnya terisi. */
    scr.innerHTML =
      '<div class="sect" style="margin-top:2px"><h1 class="h1">📊 Papan Peringkat</h1></div>' +
      '<p class="sub" style="margin-top:-6px">Berisi teman sekelasmu, diurutkan menurut XP.</p>' +
      '<div class="empty" style="margin-top:14px"><i>🏫</i>' +
        'Papan peringkat baru terisi<br/>setelah kamu masuk kelas.</div>' +
      (NET.mode === 'tamu'
        ? '<div class="card ajak" style="margin-top:12px">' +
            '<p class="sub">Minta kode kelas ke gurumu, lalu masuk supaya progresmu tersimpan ' +
            'dan kamu muncul di papan peringkat kelas.</p>' +
            '<button class="btn btn-sm" data-act="keMasuk" style="margin-top:10px">🏫 Masuk Kelas</button>' +
          '</div>'
        : '<p class="sub" style="margin-top:12px">Aplikasi ini sedang berjalan tanpa server kelas, ' +
          'jadi papan peringkat tidak tersedia.</p>') +

      '<div class="sect"><span class="eyebrow">Catatanmu Sendiri</span></div>' +
      '<div class="statgrid">' +
        '<div class="sbox"><span>XP</span><b>' + fmt(S.p.xp) + '</b></div>' +
        '<div class="sbox"><span>Skor Tertinggi</span><b>' + fmt(S.p.high || 0) + '</b></div>' +
      '</div>';
  };

  function kepalaPeringkat(namaKelas) {
    return '<div class="sect" style="margin-top:2px"><h1 class="h1">📊 Papan Peringkat</h1></div>' +
      '<p class="sub" style="margin-top:-6px">' + esc(namaKelas) + ' — urutan berdasarkan XP.</p>';
  }

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
      (NET.mode === 'kelas' ? '<div id="tugasBox"></div>' : '') +
      '<div class="sect" style="margin-top:2px"><h1 class="h1">🎯 Misi Harian</h1></div>' +
      '<p class="sub" style="margin-top:-6px">Diperbarui otomatis setiap hari.</p>' +
      '<div style="margin-top:14px">' + questList(qs.list) + '</div>' +
      '<div class="sect"><span class="eyebrow">Dompet</span></div>' +
      '<div class="grid2">' +
        '<div class="sbox"><span>Koin</span><b>🪙 ' + fmt(S.p.coin) + '</b></div>' +
        '<div class="sbox"><span>Permata</span><b>💎 ' + fmt(S.p.gem) + '</b></div>' +
      '</div>' +
      '<div class="card" style="margin-top:14px">' +
        '<h3 class="h2">Nyawa</h3>' +
        '<p class="sub" style="margin-top:4px">Tiap soal memberimu <b>3 nyawa</b>. Salah menjawab ' +
        'mengurangi satu, dan kamu boleh langsung mencoba lagi. Makin banyak nyawa yang tersisa ' +
        'saat rantainya pecah, makin besar nilainya.</p>' +
      '</div>';

    if (NET.mode === 'kelas') muatTugas();
  };

  /* Tugas dari guru. Ditaruh di atas misi harian karena punya tenggat —
     misi harian selalu bisa diulang besok, tugas tidak. */
  function muatTugas() {
    NET.tugas().then(function (r) {
      var box = $('tugasBox');
      if (!box || state.screen !== 'quest') return;
      var list = (r.ok && r.data.tugas) || [];
      if (!list.length) { box.innerHTML = ''; return; }
      box.innerHTML =
        '<div class="sect" style="margin-top:2px"><h1 class="h1">📋 Tugas dari Guru</h1></div>' +
        '<div class="list" style="margin-top:10px">' + list.map(function (t) {
          var selesai = Math.min(t.selesai, t.target);
          var tuntas = selesai >= t.target;
          var pct = Math.round(selesai / t.target * 100);
          return '<button class="mode tugas' + (tuntas ? ' tuntas' : '') + '" ' +
              'style="--mc:#5ad0e6" ' +
              'data-act="kerjakanTugas" data-val="' + esc(t.topic) + '|' + t.level + '">' +
            '<span class="mode-ic" style="background:radial-gradient(60% 46% at 50% 16%,rgba(255,255,255,.55),transparent 70%),linear-gradient(180deg,#cdeefb,#7fd3f0 50%,#42aad4)">' +
              (GAME[t.topic] || GAME.rantai).icon + '</span>' +
            '<span class="mode-b">' +
              '<h3>' + esc(namaGame(t.topic)) + ' · ' + esc(D.levelName(t.level)) + '</h3>' +
              '<p>' + (t.note ? esc(t.note) + ' · ' : '') +
                selesai + '/' + t.target + ' selesai' +
                (t.due ? ' · tenggat ' + esc(tanggalPendek(t.due)) : '') + '</p>' +
              '<span class="mini-bar"><i style="width:' + pct + '%"></i></span>' +
            '</span>' +
            '<span class="mode-go">' + (tuntas ? '✅' : '›') + '</span>' +
          '</button>';
        }).join('') + '</div>';
    });
  }

  function tanggalPendek(iso) {
    var bulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    var d = new Date(iso + 'T00:00:00');
    if (isNaN(d)) return iso;
    return d.getDate() + ' ' + bulan[d.getMonth()];
  }

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

      kartuKelas() +

      '<div class="sect"><span class="eyebrow">Statistik</span></div>' +
      '<div class="statgrid">' +
        '<div class="sbox"><span>Permainan</span><b>' + fmt(p.played) + '</b></div>' +
        '<div class="sbox"><span>Tuntas 3/3</span><b>' + fmt(p.wins) + '</b></div>' +
        '<div class="sbox"><span>Akurasi</span><b>' + akurasi + '%</b></div>' +
        '<div class="sbox"><span>Skor Tertinggi</span><b>' + fmt(p.high || 0) + '</b></div>' +
        '<div class="sbox"><span>Rantai Terpecahkan</span><b>' + fmt(p.totalCorrect) + '</b></div>' +
        '<div class="sbox"><span>Rantai Tanpa Lecet</span><b>' + fmt(p.flawless || 0) + '</b></div>' +
      '</div>' +

      '<div class="sect"><span class="eyebrow">Lencana (' + p.badges.length + '/' + D.BADGES.length + ')</span></div>' +
      '<div class="badges">' + D.BADGES.map(function (b) {
        var got = p.badges.indexOf(b.id) !== -1;
        return '<div class="bdg' + (got ? ' got' : '') + '"><i>' + b.icon + '</i><b>' + b.name + '</b>' +
          '<small>' + b.desc + '</small></div>';
      }).join('') + '</div>' +

      '<div class="sect"><span class="eyebrow">Pengaturan</span></div>' +
      '<div class="card stack">' +
        /* Di dalam kelas, nama dikunci: papan peringkat dan dasbor guru
           memakai nama dari daftar absen, dan mengizinkan siswa menggantinya
           akan membuat gurunya tidak lagi mengenali siapa yang mana. */
        (NET.mode === 'kelas'
          ? '<label class="eyebrow" style="display:block">Nama Panggilan</label>' +
            '<div class="field terkunci">' + esc(p.name) + ' 🔒</div>' +
            '<p class="sub" style="margin-top:-4px">Nama diambil dari daftar kelas. Minta gurumu kalau mau diubah.</p>'
          : '<label class="eyebrow" style="display:block">Nama Panggilan</label>' +
            '<input class="field" id="nameEdit" maxlength="14" value="' + esc(p.name) + '"/>') +
        '<label class="eyebrow" style="display:block">Avatar</label>' +
        '<div class="avagrid">' + D.AVATARS.map(function (a) {
          return '<button class="avapick' + (a === p.ava ? ' on' : '') + '" data-act="ava2" data-val="' + a + '">' + a + '</button>';
        }).join('') + '</div>' +
        '<button class="btn btn-sm" data-act="saveProfile">Simpan Perubahan</button>' +
      '</div>' +

      '<div class="btn-row" style="margin-top:12px">' +
        '<button class="btn btn-ghost btn-sm" data-act="sound">' + (FX.soundOn() ? '🔊 Suara: Nyala' : '🔇 Suara: Mati') + '</button>' +
        (FS.didukung()
          ? '<button class="btn btn-ghost btn-sm" data-act="setelLayarPenuh">\u26f6 Layar Penuh: ' +
            (p.layarPenuh !== false ? 'Nyala' : 'Mati') + '</button>'
          : '') +
        '<button class="btn btn-ghost btn-sm" data-act="howto">❓ Cara Bermain</button>' +
      '</div>' +
      (NET.mode === 'kelas'
        ? '<button class="btn btn-ghost btn-sm btn-block" data-act="keluarKelas" style="margin-top:10px">🚪 Keluar dari Kelas</button>'
        : '<button class="btn btn-ghost btn-sm btn-block" data-act="reset" style="margin-top:10px;color:var(--red)">Hapus Semua Data</button>') +

      '<div class="sect"><span class="eyebrow">Riwayat</span></div>' +
      historyList(p.history.slice(0, 10));
  };

  /* Status keanggotaan kelas di layar Profil. Tiga keadaan: sudah di
     kelas, ada server tapi belum masuk, dan tidak ada server sama sekali
     (yang terakhir tidak menampilkan apa pun — tidak ada gunanya menawarkan
     sesuatu yang tak tersedia). */
  function kartuKelas() {
    if (NET.mode === 'kelas' && NET.aku && NET.aku.kelas) {
      return '<div class="card kelasbox" style="margin-top:12px">' +
        '<div class="mode-b"><h3>🏫 ' + esc(NET.aku.kelas.nama) + '</h3>' +
        '<p>Progresmu tersimpan di server. Papan peringkat berisi teman sekelasmu.</p></div>' +
      '</div>';
    }
    if (NET.mode === 'tamu') {
      return '<div class="card ajak" style="margin-top:12px">' +
        '<div class="mode-b"><h3>🏫 Belum masuk kelas</h3>' +
        '<p>Kalau gurumu memberi kode kelas, masuk supaya progresmu tersimpan dan kamu ikut papan peringkat kelas.</p></div>' +
        '<button class="btn btn-sm" data-act="keMasuk" style="margin-top:10px">Masuk Kelas</button>' +
      '</div>';
    }
    return '';
  }

  /* ============================================================
     Layar: Cara bermain
     ============================================================ */
  SCREENS.howto = function () {
    scr.innerHTML =
      '<button class="btn btn-ghost btn-sm" data-act="tab" data-val="home">‹ Kembali</button>' +
      '<div class="sect"><h1 class="h1">❓ Cara Bermain</h1></div>' +
      '<div class="steps">' +
        '<div class="step"><div><h4>Tiga rantai sekali main</h4><p>Satu permainan berisi 3 soal. Tiap soal adalah satu rantai operasi hitung yang berujung pada sebuah nilai akhir.</p></div></div>' +
        '<div class="step"><div><h4>Cari nilai awalnya</h4><p>Yang ditanya bukan hasilnya, melainkan angka yang dimasukkan di ujung sebelah kiri. Telusuri rantainya mundur: lawan tiap operasi dengan kebalikannya.</p></div></div>' +
        '<div class="step"><div><h4>Urutan operasi tidak berlaku</h4><p>Rantai dijalankan apa adanya dari kiri ke kanan. Kali dan bagi tidak didahulukan — justru itu yang membuatnya bisa dibalik satu per satu.</p></div></div>' +
        '<div class="step"><div><h4>Lihat dulu, baru jawab</h4><p>Layar pertama menampilkan rantainya saja — geser dengan tombol \u2039 dan \u203a sampai ke ujung kiri. Tekan SUBMIT untuk membuka papan angka, dan tombol bundar di pojok kiri bawah untuk kembali melihat rantainya.</p></div></div>' +
        '<div class="step"><div><h4>Tiga nyawa tiap soal</h4><p>Salah menjawab berarti kehilangan satu nyawa, dan kamu boleh mencoba lagi. Soal berganti kalau jawabanmu benar atau nyawamu habis.</p></div></div>' +
        '<div class="step"><div><h4>Tidak ada hitung mundur</h4><p>Tidak ada batas waktu — pikirkan selama yang kamu perlu. Yang dinilai ketelitian menelusuri rantai, bukan kecepatan mengetik.</p></div></div>' +
        '<div class="step"><div><h4>Kumpulkan XP dan naik tingkat</h4><p>Dari Perunggu sampai Sang Juara. XP juga menentukan posisimu di papan peringkat.</p></div></div>' +
      '</div>' +
      '<div class="card" style="margin-top:14px">' +
        '<h3 class="h2">Rumus Nilai</h3>' +
        '<p class="sub" style="margin-top:6px">' +
        'Nilai = <b>1.000</b> per rantai yang terpecahkan + <b>250</b> untuk tiap nyawa yang masih utuh.<br/>' +
        'Sekali tebak langsung benar bernilai 1.750; tebakan ketiga yang akhirnya benar bernilai 1.250. ' +
        'Rantai yang nyawanya habis bernilai 0.</p>' +
      '</div>';
  };

  /* ============================================================
     Mesin permainan

     Satu permainan: tiga rantai, tiga nyawa untuk tiap rantai, tanpa
     hitung mundur. Yang membatasi hanya nyawa — siswa boleh berpikir
     selama apa pun, jadi yang dinilai benar-benar ketelitian menelusuri
     rantai, bukan kecepatan mengetik.
     ============================================================ */
  var SOAL_PER_MAIN = 3;
  var NYAWA = 3;

  /* Skor satu rantai: 1.000 untuk yang terpecahkan, ditambah 250 untuk
     tiap nyawa yang masih utuh. Sekali tebak langsung benar bernilai
     1.750; tebakan ketiga yang akhirnya benar bernilai 1.250. */
  function poinRantai(sisaNyawa) { return 1000 + 250 * sisaNyawa; }

  /* cfg: { level, semai } */
  /* Satu set soal, permainan mana pun. Dengan semai dari server seluruh
     kelas membangkitkan soal yang sama persis di perangkat masing-masing —
     tidak ada soal yang dikirim lewat jaringan, dan skornya jadi
     sebanding. */
  function bikinSoal(game, level, semai) {
    if (game === 'jumlah') {
      return semai != null ? G.packSemai(level, semai) : G.pack(level);
    }
    return semai != null
      ? Q.packSemai(SOAL_PER_MAIN, level, semai)
      : Q.pack(SOAL_PER_MAIN, level);
  }

  function mulaiMain(cfg) {
    if (!GAME[cfg.game]) cfg.game = 'rantai';
    state.match = {
      cfg: cfg,
      qs: bikinSoal(cfg.game, cfg.level, cfg.semai),
      i: 0,
      my: 0,
      nyawa: NYAWA,
      /* 'telusur' menelusuri rantainya, 'jawab' mengetik nilai awalnya. */
      langkah: 'telusur',
      streak: 0, best: 0,
      correct: 0, utuh: 0,
      log: [],
      lock: false,
      ketik: '',
      mulaiPada: 0
    };
    FX.sfx.start();
    go('battle');
  }

  SCREENS.battle = function () { gambarSoal(); };

  /* ============================================================
     Papan angka

     Jawabannya selalu bilangan bulat — nilai awal sebuah rantai — jadi
     papan ini tidak pernah perlu koma maupun garis pecahan.
     ============================================================ */
  var KETIK_MAKS = 7;

  /* Titik ribuan dipasang sambil mengetik, supaya 1.250 terbaca sama
     seperti angka di dalam rantainya. */
  function hiasAngka(t) {
    if (!/^\d+$/.test(t)) return t;
    return t.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  function plakat(ketikan) {
    return '<div class="plate" id="plate">' +
      '<b id="plateVal"' + (ketikan ? '' : ' class="kosong"') + '>' +
        esc(ketikan ? hiasAngka(ketikan) : '0') + '</b>' +
      '</div>';
  }

  /* `act` menentukan layar mana yang menangani tekanannya — permainan
     sendiri atau sesi kelas — sehingga susunan papannya cuma ditulis
     sekali. */
  function papanAngka(act, ketikan, mati) {
    var d = mati ? ' disabled' : '';
    var tombol = '';
    for (var n = 1; n <= 9; n++) {
      tombol += '<button class="key" data-act="' + act + '" data-val="' + n + '"' + d + '>' + n + '</button>';
    }
    tombol +=
      '<button class="key key-del" data-act="' + act + '" data-val="hapus"' + d +
        ' aria-label="Hapus satu angka">⌫</button>' +
      '<button class="key" data-act="' + act + '" data-val="0"' + d + '>0</button>' +
      '<button class="key key-ok" data-act="' + act + '" data-val="kirim"' + d +
        ' aria-label="Kirim jawaban">➤</button>';
    return '<div class="jawab">' + plakat(ketikan) + '<div class="pad">' + tombol + '</div></div>';
  }

  function kunciPapan() {
    Array.prototype.forEach.call(document.querySelectorAll('.pad .key'), function (b) {
      b.disabled = true;
    });
  }

  /* Kedua permainan dijawab dengan satu bilangan bulat, jadi
     pencocokannya cukup satu. Titik ribuan yang ikut terketik tidak boleh
     membuat jawaban yang benar dianggap salah. */
  function cocokJawab(ketikan, q) {
    var a = String(ketikan == null ? '' : ketikan).trim().replace(/\./g, '');
    if (!a || !/^\d+$/.test(a)) return false;
    return parseInt(a, 10) === parseInt(q.ketik, 10);
  }

  function catPlakat(ketikan) {
    var el = $('plateVal');
    if (!el) return;
    el.textContent = ketikan ? hiasAngka(ketikan) : '0';
    el.classList.toggle('kosong', !ketikan);
  }

  /* Getar menolak: dipakai saat mengirim plakat kosong dan saat satu
     nyawa hilang. Kelasnya dilepas-pasang supaya animasinya bisa
     berjalan dua kali berturut-turut. */
  function goyangPlakat(kelas) {
    var pl = $('plate');
    if (!pl) return;
    pl.classList.remove('salah', 'benar');
    void pl.offsetWidth;
    pl.classList.add(kelas || 'salah');
  }

  /* Satu tekanan papan angka. Mengembalikan ketikan yang baru, atau
     null kalau tekanan itu memang harus diabaikan. */
  function tekanKe(ketikan, v) {
    if (v === 'hapus') return ketikan.slice(0, -1);
    if (ketikan.length >= KETIK_MAKS) return null;
    /* Nol di depan tidak menambah apa pun pada bilangan bulat, dan
       "007" hanya menghabiskan tempat di plakat. */
    if (v === '0' && !ketikan) return null;
    return ketikan + v;
  }

  /* ============================================================
     Rantai operasi

     Digambar mendatar dan bisa digeser: empat belas panah tidak akan
     pernah muat di layar ponsel, dan memaksanya muat berarti
     mengecilkan labelnya sampai tidak terbaca lagi.
     ============================================================ */
  function rantaiHtml(q) {
    return '<div class="thread" id="thread">' +
      '<span class="th-awal">?</span>' +
      q.ops.map(function (o) {
        return '<i class="th-dot"></i><span class="th-op">' + esc(o.label) + '</span>';
      }).join('') +
      '<i class="th-dot"></i>' +
      '<span class="th-akhir">' + fmt(q.akhir) + '</span>' +
    '</div>';
  }

  /* ============================================================
     Papan "Jumlahkan Semua"

     Ukuran selnya dihitung dari banyaknya baris, bukan dipatok: papan
     HARD sepuluh baris harus tetap muat di layar HP mendatar yang
     tingginya cuma ~380 piksel, sementara papan EASY enam baris boleh
     bernapas. Sarang lebahnya bertumpuk seperempat tinggi sel supaya
     barisnya bertautan, dan baris genap bergeser setengah sel.
     ============================================================ */
  function papanHtml(q) {
    var sarang = q.bentuk === 'sarang';
    var baris = q.baris.length;
    /* Sel sarang lebah bertumpuk, jadi tinggi efektif tiap barisnya cuma
       tiga perempat — ia boleh lebih besar untuk jumlah baris yang sama. */
    var muat = (sarang ? 62 : 47) / baris;
    var v = Math.min(sarang ? 12 : 10, muat);
    var lebar = q.ekspresi ? 2.6 : 1;
    var gaya = '--sel:clamp(17px,' + v.toFixed(2) + 'vmin,54px);--lebar:' + lebar;

    return '<div class="papan ' + (sarang ? 'sarang' : 'kisi') + '" style="' + gaya + '">' +
      q.baris.map(function (r, i) {
        return '<div class="pbaris' + (sarang && i % 2 ? ' geser' : '') + '">' +
          r.map(function (c) {
            return '<span class="psel">' + esc(c.teks) + '</span>';
          }).join('') +
        '</div>';
      }).join('') +
    '</div>';
  }

  function nyawaHtml(sisa) {
    var s = '';
    for (var i = 0; i < NYAWA; i++) s += '<i' + (i < sisa ? ' class="on"' : '') + '>❤</i>';
    return '<span class="lives" id="lives">' + s + '</span>';
  }

  function catNyawa(sisa) {
    var el = $('lives');
    if (!el) return;
    Array.prototype.forEach.call(el.children, function (h, i) {
      h.className = i < sisa ? 'on' : '';
    });
    el.classList.remove('hit');
    void el.offsetWidth;
    el.classList.add('hit');
  }

  /* Satu soal ditampilkan dalam dua langkah, seperti di arena acuan:
     menelusuri rantainya dulu di satu layar, baru mengetik jawabannya di
     layar berikutnya. Papan angka yang selalu terpampang memakan separuh
     lebar layar — padahal justru rantai itu yang perlu dibaca dari ujung
     ke ujung, dan tiap operasi yang muat sekaligus berarti satu langkah
     lebih sedikit yang harus diingat di kepala. */
  function tombolSubmit(ada) {
    if (!ada) return '';
    return '<button class="btn btn-lg" data-act="' +
      (state.screen === 'sesi' ? 'submitSesi' : 'submit') +
      '"><span class="shine"></span>SUBMIT</button>';
  }

  /* Layar pertama sebuah soal. Rantai operasi digulir mendatar dengan
     sepasang tombol geser; papan "Jumlahkan Semua" selalu muat utuh,
     jadi ia tidak perlu tombol apa pun untuk dilihat seluruhnya. */
  function telusurHtml(q, adaSubmit) {
    if (q.bentuk) {
      return '<div class="thread-kolom">' +
        '<p class="ask">Jumlahkan semua angka pada papan berikut!</p>' +
        papanHtml(q) +
        tombolSubmit(adaSubmit) +
      '</div>';
    }
    return '<div class="thread-kolom">' +
      '<p class="ask">Tentukan nilai awal dari rangkaian operasi berikut!</p>' +
      '<div class="thread-baris">' +
        '<button class="geser" data-act="geser" data-val="kiri" aria-label="Geser rantai ke kiri">\u2039</button>' +
        rantaiHtml(q) +
        '<button class="geser" data-act="geser" data-val="kanan" aria-label="Geser rantai ke kanan">\u203a</button>' +
      '</div>' +
      tombolSubmit(adaSubmit) +
    '</div>';
  }

  /* Gulirkan ke ujung kanan — nilai akhir itulah titik berangkat hitung
     mundurnya — lalu setel tombol gesernya. */
  function pasangGeser() {
    var th = $('thread');
    if (!th) return;   /* papan "Jumlahkan Semua" tidak digulir */
    th.scrollLeft = th.scrollWidth;
    th.addEventListener('scroll', catGeser, { passive: true });
    catGeser();
  }

  /* Tombol yang sudah mentok dimatikan, bukan dibiarkan menerima tekanan
     yang tidak menghasilkan apa-apa. */
  function catGeser() {
    var th = $('thread');
    if (!th) return;
    var kiri = document.querySelector('.geser[data-val="kiri"]');
    var kanan = document.querySelector('.geser[data-val="kanan"]');
    var mentokKanan = th.scrollLeft + th.clientWidth >= th.scrollWidth - 2;
    if (kiri) kiri.disabled = th.scrollLeft <= 2;
    if (kanan) kanan.disabled = mentokKanan;
  }

  function gambarSoal() {
    var m = state.match;
    if (!m) { go('home'); return; }

    m.lock = false;
    m.ketik = '';
    m.nyawa = NYAWA;
    m.langkah = 'telusur';
    m.mulaiPada = Date.now();
    gambarArena();
  }

  function gambarArena() {
    var m = state.match;
    if (!m) { go('home'); return; }
    var q = m.qs[m.i];
    /* Sesudah terkunci, papan angka tidak berguna lagi — yang perlu
       dilihat justru rantainya, bersama pembahasan di bawahnya. */
    var mengetik = m.langkah === 'jawab' && !m.lock;

    scr.innerHTML =
      '<div class="arena">' +
        '<div class="row">' +
          '<span class="round-tag">' + (GAME[m.cfg.game] || GAME.rantai).satuan.toUpperCase() +
            ' ' + (m.i + 1) + '/' + m.qs.length + '</span>' +
          '<span class="spacer"></span>' +
          nyawaHtml(m.nyawa) +
          '<span class="round-tag" id="scMe">Skor ' + fmt(m.my) + '</span>' +
          tombolLayarPenuh() +
          '<button class="quitbtn" data-act="quit" aria-label="Keluar dari permainan">✕</button>' +
        '</div>' +

        '<div class="arena-main">' +
          (mengetik
            ? papanAngka('tekan', m.ketik, false)
            : telusurHtml(q, !m.lock)) +
        '</div>' +

        (mengetik
          ? '<button class="bulat" data-act="kembaliTelusur" aria-label="Kembali ke soal">\u2190</button>'
          : '') +
        '<div id="post"></div>' +
      '</div>';

    if (!mengetik) pasangGeser();
  }

  function catSkor() {
    var el = $('scMe');
    if (el) el.textContent = 'Skor ' + fmt(state.match.my);
  }

  /* ---------- jawaban pemain ---------- */
  function jawab(ketikan) {
    var m = state.match;
    if (!m || m.lock) return;

    var q = m.qs[m.i];
    var benar = cocokJawab(ketikan, q);

    /* Salah tapi nyawa masih ada: soalnya belum berakhir. Plakat
       dikosongkan supaya siswa langsung bisa mengetik tebakan
       berikutnya tanpa menghapus satu-satu. */
    if (!benar) {
      m.nyawa -= 1;
      m.ketik = '';
      catPlakat('');
      catNyawa(m.nyawa);
      goyangPlakat('salah');
      FX.sfx.bad();
      FX.buzz([30, 40, 30]);
      if (m.nyawa > 0) {
        kilasan(false, 0, m.nyawa);
        return;
      }
    }

    m.lock = true;
    var pakai = Date.now() - m.mulaiPada;
    var dapat = 0;

    if (benar) {
      dapat = poinRantai(m.nyawa);
      m.my += dapat;
      m.correct += 1;
      m.streak += 1;
      if (m.streak > m.best) m.best = m.streak;
      if (m.nyawa === NYAWA) m.utuh += 1;
      kilasan(true, dapat, m.nyawa);
    } else {
      m.streak = 0;
    }
    m.log[m.i] = { ok: benar, ms: pakai, sisa: m.nyawa, ketik: benar ? String(ketikan) : '', q: q };

    /* Digambar ulang ke tampilan rantai: pembahasannya menyebut tiap
       langkah, dan membacanya tanpa rantai yang dibicarakan di layar
       sama saja dengan membaca peta tanpa jalannya. */
    gambarArena();

    var post = $('post');
    post.innerHTML =
      '<div class="explain" style="margin-top:12px">' +
        (benar
          ? '<b>Tepat!</b> '
          : '<b>Nyawamu habis.</b> ' +
            (q.bentuk ? 'Jumlahnya <b>' : 'Nilai awalnya <b>') + esc(q.answer) + '</b>. ') +
        esc(q.explain) +
      '</div>' +
      '<button class="btn btn-block" data-act="next" style="margin-top:10px">' +
        (m.i + 1 >= m.qs.length ? 'Lihat Hasil ›' : 'Soal Berikutnya ›') + '</button>';
  }

  /* Sapuan besar di tengah layar. Dipakai dua kali: saat rantai
     terpecahkan, dan saat satu nyawa hilang — yang kedua tanpa menutup
     rantainya, karena siswa masih harus melihatnya untuk mencoba lagi. */
  function kilasan(benar, dapat, sisa) {
    var d = document.createElement('div');
    d.className = 'feed ' + (benar ? 'ok' : 'no');
    if (benar) {
      var puji = sisa === NYAWA ? 'TANPA LECET! ' : '';
      d.innerHTML = '<em>RANTAI</em><b>TERPECAHKAN</b><small>' + puji + '+' + fmt(dapat) + ' poin</small>';
      FX.sfx.combo(state.match ? state.match.streak : 1);
      FX.buzz(20);
      FX.burst(global.innerWidth / 2, global.innerHeight * 0.5, '#77c341', 16);
    } else {
      d.innerHTML = '<em>BELUM</em><b>TEPAT</b><small>nyawa tersisa ' + sisa + '</small>';
    }
    document.body.appendChild(d);
    setTimeout(function () { d.remove(); }, 1000);
  }

  function lanjut() {
    var m = state.match;
    if (!m) return;
    m.i += 1;
    if (m.i >= m.qs.length) selesai();
    else gambarSoal();
  }

  function berhentiMatch() {
    state.match = null;
  }

  /* ---------- akhir permainan ---------- */
  function selesai() {
    var m = state.match;

    /* Tuntas berarti ketiga rantai terpecahkan. Tanpa lawan, itulah
       satu-satunya arti "menang" yang tersisa — dan riwayat, lencana,
       serta misi harian sudah memakai istilah itu sejak dulu. */
    var hasil = m.correct === m.qs.length ? 'win' : 'lose';
    var bintang = m.correct === m.qs.length ? (m.utuh === m.qs.length ? 3 : 2) : (m.correct >= 1 ? 1 : 0);

    var xp = Math.round(m.my / 25) + m.cfg.level * 10 + (hasil === 'win' ? 60 : 15);
    var koin = Math.round(m.my / 60) + (hasil === 'win' ? 40 : 12);
    var permata = (hasil === 'win' && m.utuh === m.qs.length) ? 1 : 0;

    /* Rerata waktu ikut dikirim: dasbor guru memakainya untuk membedakan
       "belum paham" dari "paham tapi lambat". */
    var rerataMs = m.log.length
      ? Math.round(m.log.reduce(function (a, l) { return a + l.ms; }, 0) / m.log.length)
      : null;

    var efek = S.record({
      result: hasil,
      mode: m.cfg.game, topic: m.cfg.game, level: m.cfg.level,
      myScore: m.my, opScore: 0,
      correct: m.correct, total: m.qs.length,
      streak: m.best, fastest: 0,
      flawless: m.utuh, hardClear: hasil === 'win' && m.cfg.level === 3,
      xp: xp, coin: koin, gem: permata, msAvg: rerataMs
    });

    go('result', {
      hasil: hasil, bintang: bintang, xp: xp, koin: koin, permata: permata,
      my: m.my, correct: m.correct, total: m.qs.length, utuh: m.utuh,
      rerata: m.log.length ? Math.round(rerataMs / 100) / 10 : 0,
      log: m.log.slice(), efek: efek, cfg: m.cfg
    });
  }

  SCREENS.result = function (res) {
    state.lastRes = res;

    if (res.hasil === 'win') { FX.sfx.win(); FX.confetti(120, 0.5, 0.3, 1.15); }
    else FX.sfx.lose();

    scr.innerHTML =
      '<div class="verdict ' + res.hasil + '">' +
        '<div class="verdict-ic">' + (res.hasil === 'win' ? '🏅' : '💪') + '</div>' +
        '<h2>' + (res.hasil === 'win' ? 'SEMUA TERPECAHKAN!' : 'BELUM TUNTAS') + '</h2>' +
        '<p>' + (res.hasil === 'win'
          ? 'Ketiga soal berhasil kamu selesaikan.'
          : 'Ada soal yang belum tertaklukkan. Coba lagi, ya.') + '</p>' +
        '<div class="stars">' + [0, 1, 2].map(function (i) {
          return '<span class="' + (i < res.bintang ? 'lit' : '') + '">★</span>';
        }).join('') + '</div>' +
        '<div class="scoreline solo"><b class="me">' + fmt(res.my) + '</b></div>' +
        '<div class="rewards">' +
          '<span class="reward">⭐ +' + fmt(res.xp) + ' XP</span>' +
          '<span class="reward">🪙 +' + fmt(res.koin) + '</span>' +
          (res.permata ? '<span class="reward">💎 +' + res.permata + '</span>' : '') +
        '</div>' +
      '</div>' +

      '<div class="sect"><span class="eyebrow">Rincian</span></div>' +
      '<div class="statgrid">' +
        '<div class="sbox"><span>Terpecahkan</span><b>' + res.correct + '/' + res.total + '</b></div>' +
        '<div class="sbox"><span>Nyawa Utuh</span><b>' + res.utuh + '/' + res.total + '</b></div>' +
        '<div class="sbox"><span>Tingkat</span><b>' + D.levelName(res.cfg.level) + '</b></div>' +
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

      '<div class="sect"><span class="eyebrow">Ulasan Rantai</span></div>' +
      '<div class="review">' + res.log.map(function (l, i) {
        var judul = l.q.bentuk
          ? esc(l.q.judul) + ' · ' + l.q.sel + ' sel'
          : esc(l.q.ops.map(function (o) { return o.label; }).join(' ')) + ' → ' + fmt(l.q.akhir);
        var kunci = l.q.bentuk ? 'Jumlahnya' : 'Nilai awal';
        return '<div class="rev"><i>' + (l.ok ? '✅' : '❌') + '</i><div class="rev-b">' +
          '<b>' + (i + 1) + '. ' + judul + '</b>' +
          '<span>' + (l.ok
            ? kunci + ' <em>' + esc(l.q.answer) + '</em> · sisa nyawa ' + l.sisa
            : 'Nyawa habis · ' + kunci.toLowerCase() + ' <em>' + esc(l.q.answer) + '</em>') +
          ' · ' + fmt(Math.round(l.ms / 100) / 10) + ' dtk</span></div></div>';
      }).join('') + '</div>' +

      '<div class="btn-row" style="margin-top:18px">' +
        '<button class="btn btn-ghost" data-act="tab" data-val="home">Beranda</button>' +
        '<button class="btn" data-act="ulang">Main Lagi</button>' +
      '</div>';

    if (res.efek.naikTingkat) { setTimeout(function () { FX.sfx.level(); FX.confetti(70, 0.5, 0.45); }, 700); }
  };

  var ACT = {
    tab: function (v) { FX.sfx.tap(); go(v); },

    /* ---- Masuk kelas ---- */
    masukLangkah: function (v) {
      state.masuk.langkah = v;
      state.masuk.galat = '';
      FX.sfx.tap();
      go('masuk');
    },
    mainSendiri: function () {
      FX.sfx.tap();
      go(S.p.name ? 'home' : 'onboard');
    },
    cekKelas: function () {
      var kode = ($('kodeIn').value || '').trim().toUpperCase();
      if (kode.length < 4) { toast('Kode kelas minimal 4 karakter'); return; }
      var m = state.masuk;
      m.galat = '';
      toast('Mencari kelas…');
      NET.cekKelas(kode).then(function (r) {
        if (!r.ok) { m.galat = r.pesan || 'Kelas tidak ditemukan.'; go('masuk'); return; }
        m.kode = r.data.kelas.kode;
        m.kelas = r.data.kelas;
        m.siswa = r.data.siswa;
        m.langkah = 'nama';
        FX.sfx.tap();
        go('masuk');
      });
    },
    pilihNama: function (v) {
      var m = state.masuk;
      m.pilih = m.siswa[Number(v)];
      m.galat = '';
      m.langkah = 'pin';
      FX.sfx.tap();
      go('masuk');
    },
    masukKelas: function () {
      var m = state.masuk;
      var pin = ($('pinIn').value || '').trim();
      if (!/^\d{4}$/.test(pin)) { toast('PIN harus 4 angka'); return; }
      var ingat = $('ingatIn') && $('ingatIn').checked;
      toast('Menghubungkan…');
      NET.masuk(m.kode, m.pilih.nama, pin, m.pilih.ava, ingat).then(function (r) {
        if (!r.ok) { m.galat = r.pesan || 'Gagal masuk.'; go('masuk'); return; }
        pakaiProfilServer(r.data.profil, r.data.aku);
        state.masuk = null;
        /* Tanpa ini, siswa yang baru masuk belum punya aliran langsung:
           server menganggapnya luring, sehingga ia dibuang dari antrean
           sesi kelas dan tidak pernah menerima peristiwanya. */
        nyalakanLive();
        LIVE.lihatSesi().then(function (r2) {
          if (r2 && r2.sesi && r2.sesi.tahap !== 'usai') {
            state.sesiAda = r2.sesi;
            if (state.screen === 'home') go('home');
          }
        });
        FX.sfx.level();
        go('home');
        toast('Halo, ' + S.p.name + '! Kamu di ' + (NET.aku.kelas ? NET.aku.kelas.nama : 'kelas'));
      });
    },
    keluarKelas: function () {
      dialog('Keluar dari kelas?',
        '<p>Progresmu sudah tersimpan di server dan akan kembali begitu kamu masuk lagi. ' +
        'Data di perangkat ini dibersihkan supaya tidak terbawa ke siswa berikutnya.</p>',
        [{ label: 'Batal', cls: 'btn btn-ghost' },
         { label: 'Keluar', cls: 'btn', fn: function () {
            NET.keluar().then(function () {
              LIVE.tutup();
              S.reset();
              state.masuk = null;
              state.sesi = null;
              state.sesiAda = null;
              go('masuk');
              toast('Sudah keluar. Giliran berikutnya!');
            });
         } }]);
    },
    keMasuk: function () { FX.sfx.tap(); state.masuk = { langkah: 'kode' }; go('masuk'); },
    kerjakanTugas: function (v) {
      var bagi = String(v).split('|');
      state.sel.game = GAME[bagi[0]] ? bagi[0] : 'rantai';
      state.sel.level = Number(bagi[1]) || 1;
      FX.sfx.tap();
      FS.mungkinMasuk();
      mulaiMain({ game: state.sel.game, level: state.sel.level });
    },
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
      /* Di dalam kelas medan nama tidak dirender sama sekali, jadi yang
         tersimpan hanya avatar. */
      var el = $('nameEdit');
      if (el) {
        var v = (el.value || '').trim();
        if (v.length < 2) { toast('Nama minimal 2 huruf'); return; }
        S.p.name = v.slice(0, 14);
      }
      S.save(); FX.sfx.coin();
      go('me'); toast('Profil tersimpan');
    },
    setelLayarPenuh: function () {
      S.p.layarPenuh = S.p.layarPenuh === false;
      S.save();
      FX.sfx.tap();
      if (!S.p.layarPenuh) FS.keluar();
      go('me');
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
        /* Satu-satunya tombol yang benar-benar menghapus tanpa bisa
           ditarik kembali, jadi pelatnya merah — bukan biru seperti
           tombol utama lain. */
        { label: 'Hapus', cls: 'btn btn-bad', fn: function () { S.reset(); go('onboard'); toast('Data dihapus'); } }
      ]);
    },

    layarPenuh: function () {
      FX.sfx.tap();
      if (FS.aktif()) FS.keluar(); else FS.masuk();
    },

    main: function (v) {
      if (GAME[v]) state.sel.game = v;
      FX.sfx.tap();
      go('setup');
    },
    level: function (v) { state.sel.level = parseInt(v, 10); FX.sfx.tap(); SCREENS.setup(); },

    start: function () {
      /* Dipanggil dari dalam sentuhan tombol Mulai — satu-satunya saat
         peramban mengizinkan layar penuh dinyalakan. */
      FS.mungkinMasuk();
      mulaiMain({ game: state.sel.game, level: state.sel.level });
    },

    gabungSesi: function () {
      FX.sfx.tap();
      FS.mungkinMasuk();
      LIVE.gabungSesi().then(function (r) {
        if (!r.ok) { toast(r.pesan || 'Sesi sudah tidak ada'); state.sesiAda = null; go('home'); return; }
        var info = r.data.sesi;
        /* Sesinya mungkin sudah berjalan — anak yang terlambat masuk
           kelas, HP-nya baru menyala, atau ia baru selesai membuat PIN.
           Keadaan sesi dari server karena itu diadopsi apa adanya, bukan
           dipaksa jadi 'menunggu': peristiwa sesi-mulai yang membawa
           semai sudah lewat dan tidak akan datang dua kali, jadi set
           soalnya harus dibangkitkan di sini juga. Tanpa ini ia terjebak
           di layar "menunggu guru memulai" sampai sesi berakhir. */
        var jalan = !!info.semai;
        state.sesi = {
          info: info,
          tahap: jalan ? 'nyusul' : 'menunggu',
          soalKe: jalan ? info.soalKe : -1,
          jawabKe: -1,
          skor: 0, benar: 0, runtun: 0,
          /* Dikumpulkan sepanjang sesi lalu dicatat sekali di akhir —
             lihat catatSesi(). */
          terbaik: 0, utuh: 0, dijawab: 0, hadir: 0, ms: 0, mulaiPada: 0, dicatat: false,
          nyawa: NYAWA, langkah: 'telusur',
          qs: jalan ? bikinSoal(info.topik, info.tingkat, info.semai) : null,
          ketik: '',
          papan: r.data.papan || [], raf: 0
        };
        go('sesi');
      });
    },
    submitSesi: function () {
      var S2 = state.sesi;
      if (!S2 || S2.tahap !== 'soal' || S2.jawabKe === S2.soalKe) return;
      FX.sfx.tap();
      S2.langkah = 'jawab';
      gambarSoalSesi();
    },
    kembaliSesi: function () {
      var S2 = state.sesi;
      if (!S2 || S2.jawabKe === S2.soalKe) return;
      FX.sfx.tap();
      S2.langkah = 'telusur';
      gambarSoalSesi();
    },
    keluarSesi: function () {
      FX.sfx.tap();
      if (state.sesi) {
        cancelAnimationFrame(state.sesi.raf);
        /* Yang keluar di tengah tetap membawa pulang soal yang sudah ia
           kerjakan — hanya sebanyak itu, bukan sepanjang sesinya. */
        catatSesi(state.sesi);
      }
      state.sesi = null;
      go('home');
    },
    /* Papan angka sesi kelas. Dipisah dari ACT.tekan karena keadaannya
       memang lain: di sesi tidak ada perisai, dan yang mengunci soal
       adalah jam server, bukan jawaban siswa. */
    tekanSesi: function (v) {
      var S2 = state.sesi;
      if (!S2 || S2.tahap !== 'soal' || S2.jawabKe === S2.soalKe || S2.nyawa <= 0) return;
      if (S2.ketik == null) S2.ketik = '';
      if (v === 'kirim') {
        if (S2.ketik) ACT.jawabSesi(S2.ketik);
        else { FX.sfx.bad(); goyangPlakat('salah'); }
        return;
      }
      var baru = tekanKe(S2.ketik, v);
      if (baru === null || baru === S2.ketik) return;
      S2.ketik = baru;
      FX.sfx.tap();
      catPlakat(S2.ketik);
    },

    jawabSesi: function (v) {
      var S2 = state.sesi;
      if (!S2 || S2.tahap !== 'soal' || S2.jawabKe === S2.soalKe || S2.nyawa <= 0) return;
      var q = S2.qs && S2.qs[S2.soalKe];
      if (!q) return;

      var benar = cocokJawab(v, q);

      /* Nyawanya bekerja persis seperti di permainan sendiri: salah berarti
         kehilangan satu dan boleh mencoba lagi. Bedanya hanya jam guru yang
         tetap berjalan di atasnya — habis waktu, habis pula kesempatan. */
      if (!benar) {
        S2.nyawa -= 1;
        S2.ketik = '';
        catPlakat('');
        catNyawa(S2.nyawa);
        goyangPlakat('salah');
        FX.sfx.bad();
        FX.buzz([30, 40, 30]);
        if (S2.nyawa > 0) return;
        S2.jawabKe = S2.soalKe;
        S2.runtun = 0;
        S2.dijawab += 1;
        S2.ms += Date.now() - (S2.mulaiPada || Date.now());
        LIVE.jawabSesi(S2.soalKe, 0, false);
        gambarSoalSesi();
        var post0 = $('post');
        if (post0) post0.innerHTML = '<p class="sub center" style="margin-top:10px">' +
          'Nyawamu habis · menunggu yang lain…</p>';
        return;
      }

      var poinDapat = poinRantai(S2.nyawa);
      S2.jawabKe = S2.soalKe;
      S2.runtun += 1;
      if (S2.runtun > S2.terbaik) S2.terbaik = S2.runtun;
      S2.benar += 1;
      S2.dijawab += 1;
      if (S2.nyawa === NYAWA) S2.utuh += 1;
      S2.ms += Date.now() - (S2.mulaiPada || Date.now());
      S2.skor += poinDapat;
      S2.runtun >= 2 ? FX.sfx.combo(S2.runtun) : FX.sfx.ok();
      FX.buzz(18);

      LIVE.jawabSesi(S2.soalKe, poinDapat, true);

      /* Plakatnya diwarnai lalu papan dikunci — nilai awalnya sengaja
         belum dibuka, supaya siswa yang menjawab cepat tidak bisa
         membisikkannya ke teman sebangku yang belum menjawab. */
      gambarSoalSesi();
      var post = $('post');
      if (post) post.innerHTML = '<p class="sub center" style="margin-top:10px">' +
        'Benar! +' + fmt(poinDapat) + ' · menunggu yang lain…</p>';
    },

    ulang: function () {
      var c = state.lastRes && state.lastRes.cfg;
      FS.mungkinMasuk();
      mulaiMain({ game: c ? c.game : state.sel.game, level: c ? c.level : state.sel.level });
    },

    /* Geser rantai. Satu tekanan memindahkan hampir satu layar penuh,
       menyisakan sedikit tumpang tindih supaya siswa tidak kehilangan
       jejak di mana ia tadi berada. */
    geser: function (v) {
      var th = $('thread');
      if (!th) return;
      FX.sfx.tap();
      th.scrollBy({ left: (v === 'kiri' ? -0.7 : 0.7) * th.clientWidth, behavior: 'smooth' });
    },
    submit: function () {
      var m = state.match;
      if (!m || m.lock) return;
      FX.sfx.tap();
      m.langkah = 'jawab';
      gambarArena();
    },
    kembaliTelusur: function () {
      var m = state.match;
      if (!m || m.lock) return;
      FX.sfx.tap();
      m.langkah = 'telusur';
      gambarArena();
    },

    tekan: function (v) {
      var m = state.match;
      if (!m || m.lock) return;
      if (v === 'kirim') {
        if (m.ketik) jawab(m.ketik);
        else { FX.sfx.bad(); goyangPlakat('salah'); }
        return;
      }
      var baru = tekanKe(m.ketik, v);
      if (baru === null || baru === m.ketik) return;
      m.ketik = baru;
      FX.sfx.tap();
      catPlakat(m.ketik);
    },
    next: function () { FX.sfx.tap(); lanjut(); },
    quit: function () {
      dialog('Keluar dari permainan?', '<p>Kemajuan permainan ini tidak akan disimpan.</p>', [
        { label: 'Lanjut Main', cls: 'btn btn-ghost' },
        { label: 'Keluar', cls: 'btn', fn: function () { berhentiMatch(); go('home'); } }
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
    }
  };

  /* Memasang profil milik siswa yang baru masuk.

     Kalau server belum punya profilnya (siswa baru), profil lokal WAJIB
     dikosongkan lebih dulu. Tanpa itu, di lab komputer bersama siswa
     berikutnya akan mewarisi XP, lencana, dan riwayat milik siswa
     sebelumnya yang masih tertinggal di localStorage. */
  function pakaiProfilServer(profil, aku) {
    if (profil && profil.data) {
      S.adopsi(profil.data);
    } else {
      S.reset();
    }
    if (aku) {
      if (!S.p.name) S.p.name = aku.nama;
      if (aku.ava) S.p.ava = aku.ava;
      S.save();
    }
    FX.setSound(S.p.sound !== false);
    hud();
  }

  /* ============================================================
     Layar: Sesi Kelas Serentak

     Seluruh kelas mengerjakan soal yang sama pada saat yang sama, dan
     jamnya dijalankan server. Itu disengaja: yang membuat sesi ini terasa
     satu kelas adalah semua orang melihat soal yang sama pada detik yang
     sama, dan jam di tiap ponsel tidak pernah cukup seragam untuk itu.
     ============================================================ */
  SCREENS.sesi = function () {
    var S2 = state.sesi;
    if (!S2) { go('home'); return; }

    if (S2.tahap === 'menunggu') {
      scr.innerHTML =
        '<div class="mm">' +
          '<div class="mm-scan"><span>🏫</span></div>' +
          '<div><h2 class="h1">Sesi Kelas</h2>' +
          '<p class="sub">Kamu sudah gabung. Menunggu gurumu memulai…</p></div>' +
          '<div class="card">' +
            '<p class="sub"><b>' + esc(namaGame(S2.info.topik)) + ' · ' +
            D.levelName(S2.info.tingkat) + '</b> · ' + S2.info.jumlah +
            ' soal · seluruh kelas mengerjakan soal yang sama.</p>' +
          '</div>' +
          '<button class="btn btn-ghost btn-block" data-act="keluarSesi">Keluar</button>' +
        '</div>';
      return;
    }

    if (S2.tahap === 'nyusul') {
      scr.innerHTML =
        '<div class="mm">' +
          '<div class="mm-scan"><span>🏫</span></div>' +
          '<div><h2 class="h1">Menyusul Sesi</h2>' +
          '<p class="sub">Kelas sudah mengerjakan soal ' + (S2.soalKe + 1) + '. ' +
          'Kamu ikut mulai dari soal berikutnya.</p></div>' +
          papanSesiHtml(S2.papan, null) +
          '<button class="btn btn-ghost btn-block" data-act="keluarSesi">Keluar</button>' +
        '</div>';
      return;
    }

    if (S2.tahap === 'jeda') {
      scr.innerHTML =
        '<div class="mm">' +
          '<div><h2 class="h1">Soal ' + (S2.soalKe + 1) + ' selesai</h2>' +
          '<p class="sub">Soal berikutnya sebentar lagi…</p></div>' +
          papanSesiHtml(S2.papan, S2.skor) +
        '</div>';
      return;
    }

    if (S2.tahap === 'usai') {
      var aku = (S2.papan || []).findIndex(function (r) { return r.nama === S.p.name; });
      scr.innerHTML =
        '<div class="stack" style="padding-top:6px">' +
          '<div class="center" style="padding:10px 0">' +
            '<div style="font-size:52px;line-height:1">🏁</div>' +
            '<h1 class="h1" style="margin-top:6px">Sesi Selesai</h1>' +
            '<p class="sub">' + (aku >= 0 ? 'Kamu di peringkat ' + (aku + 1) + ' dari ' + S2.papan.length : 'Terima kasih sudah ikut') + '</p>' +
          '</div>' +
          papanSesiHtml(S2.papan, S2.skor) +
          '<button class="btn btn-block" data-act="tab" data-val="home">Kembali ke Arena</button>' +
        '</div>';
      return;
    }

    gambarSoalSesi();
  };

  function papanSesiHtml(papan, skorku) {
    if (!papan || !papan.length) return '';
    return '<div class="card" style="margin-top:10px">' +
      '<span class="eyebrow">Papan Sesi</span>' +
      '<div class="list" style="margin-top:8px">' +
        papan.slice(0, 10).map(function (r, i) {
          var aku = r.nama === S.p.name;
          return '<div class="item' + (aku ? ' item-me' : '') + '">' +
            '<span class="rank-no rank-' + (i + 1) + '">' + (i + 1) + '</span>' +
            '<span class="ava ava-xs">' + r.ava + '</span>' +
            '<div class="item-b"><h4>' + esc(r.nama) + (aku ? ' (kamu)' : '') + '</h4>' +
            '<p>' + r.benar + ' benar</p></div>' +
            '<b class="mono">' + fmt(r.skor) + '</b>' +
          '</div>';
        }).join('') +
      '</div>' +
      (skorku != null ? '<p class="sub" style="margin-top:8px">Skormu: <b>' + fmt(skorku) + '</b></p>' : '') +
    '</div>';
  }

  function gambarSoalSesi() {
    var S2 = state.sesi;
    var q = S2.qs && S2.qs[S2.soalKe];
    if (!q) {
      scr.innerHTML = '<div class="mm"><div class="mm-scan"><span>⏳</span></div>' +
        '<p class="sub">Menyiapkan soal…</p></div>';
      return;
    }
    var sudah = S2.jawabKe === S2.soalKe;
    var mengetik = S2.langkah === 'jawab' && !sudah;

    scr.innerHTML =
      '<div class="arena">' +
        '<div class="row">' +
          '<span class="round-tag">' + (GAME[S2.info.topik] || GAME.rantai).satuan.toUpperCase() +
            ' ' + (S2.soalKe + 1) + '/' + S2.info.jumlah + '</span>' +
          '<span class="spacer"></span>' +
          nyawaHtml(S2.nyawa) +
          '<span class="round-tag" id="scMe">' + fmt(S2.skor) + '</span>' +
          '<span class="ring" id="ring"><b id="ringNum">–</b></span>' +
          tombolLayarPenuh() +
        '</div>' +

        '<div class="arena-main">' +
          (mengetik
            ? papanAngka('tekanSesi', S2.ketik || '', false)
            : telusurHtml(q, !sudah)) +
        '</div>' +

        (mengetik
          ? '<button class="bulat" data-act="kembaliSesi" aria-label="Kembali ke rantai">\u2190</button>'
          : '') +
        '<div id="post">' + (sudah
          ? '<p class="sub center" style="margin-top:10px">Jawabanmu terkirim. Menunggu yang lain…</p>' : '') +
        '</div>' +
      '</div>';

    if (!mengetik) pasangGeser();
    detakSesi();
  }

  /* Hitung mundur soal sesi. Tidak memakai jam server secara langsung:
     selisih jam antar perangkat lebih besar daripada waktu tempuh
     peristiwanya, jadi menghitung dari saat peristiwa tiba justru lebih
     akurat. */
  function detakSesi() {
    var S2 = state.sesi;
    cancelAnimationFrame(S2.raf);
    var ring = $('ringNum'), kotak = $('ring');
    if (!ring) return;

    var jalan = function () {
      var s = state.sesi;
      if (!s || state.screen !== 'sesi' || s.tahap !== 'soal') return;
      var sisa = Math.max(0, s.habisPada - Date.now());
      ring.textContent = Math.ceil(sisa / 1000);
      if (kotak) kotak.classList.toggle('warn', sisa <= 5000 && sisa > 0);
      if (sisa > 0) s.raf = requestAnimationFrame(jalan);
      else { ring.textContent = '0'; kunciPapan(); }
    };
    S2.raf = requestAnimationFrame(jalan);
  }

  /* ============================================================
     Peristiwa langsung dari server

     Yang tersisa di sini hanya sesi kelas. Duel — antrean, pasangan
     lawan, dan tarik-tambang skornya — sudah tidak ada lagi.
     ============================================================ */
  /* Pendengar peristiwa hanya boleh dipasang sekali. Kalau tidak, siswa
     yang keluar lalu masuk kelas lagi akan punya dua pendengar untuk tiap
     peristiwa, dan satu sesi-mulai membuat layar berpindah dua kali. */
  var liveTerpasang = false;

  function nyalakanLive() {
    if (!liveTerpasang) { pasangLive(); liveTerpasang = true; }
    LIVE.mulai();
  }

  function pasangLive() {
    LIVE.on('sesi-ada', function (d) {
      state.sesiAda = d;
      FX.sfx.match();
      toast('Gurumu memulai sesi kelas!');
      /* Sesi punya jam yang berdetak dan siswa yang ketinggalan tidak bisa
         mengejar, jadi tawarannya dibawa ke depan mata — kecuali kalau ia
         sedang bermain, yang tidak boleh diputus di tengah jalan. */
      var sibuk = state.screen === 'battle' || state.screen === 'sesi';
      if (!sibuk) go('home');
    });

    LIVE.on('sesi-mulai', function (d) {
      state.sesiAda = d;
      if (!state.sesi) return;               // tidak ikut gabung
      state.sesi.info = d;
      state.sesi.qs = bikinSoal(d.topik, d.tingkat, d.semai);
      state.sesi.ketik = '';
      state.sesi.tahap = 'jeda';
      state.sesi.soalKe = -1;
      if (state.screen === 'sesi') go('sesi');
    });

    LIVE.on('sesi-soal', function (d) {
      var S2 = state.sesi;
      if (!S2) return;
      S2.tahap = 'soal';
      S2.soalKe = d.soalKe;
      S2.ketik = '';
      S2.nyawa = NYAWA;
      S2.langkah = 'telusur';
      S2.mulaiPada = Date.now();
      /* Soal yang sempat terpampang di layarnya, dijawab atau tidak.
         Yang bergabung di tengah sesi hanya menghitung dari soal
         pertamanya, jadi ia tidak menanggung soal yang tidak pernah
         ia lihat. */
      S2.hadir += 1;
      S2.info.batasMs = d.batasMs;
      S2.habisPada = Date.now() + d.batasMs;
      if (state.screen !== 'sesi') go('sesi'); else gambarSoalSesi();
    });

    LIVE.on('sesi-papan', function (d) {
      var S2 = state.sesi;
      if (!S2) return;
      cancelAnimationFrame(S2.raf);
      S2.tahap = 'jeda';
      S2.papan = d.papan || [];
      if (state.screen === 'sesi') go('sesi');
    });

    LIVE.on('sesi-usai', function (d) {
      state.sesiAda = null;
      var S2 = state.sesi;
      if (!S2) return;
      cancelAnimationFrame(S2.raf);
      S2.tahap = 'usai';
      S2.papan = d.papan || [];
      catatSesi(S2);
      FX.confetti(70, 0.5, 0.4);
      if (state.screen === 'sesi') go('sesi');
    });

    }

  /* Satu sesi kelas dicatat sebagai satu permainan, sekali, di akhirnya.

     Sampai sekarang sesi tidak meninggalkan jejak apa pun: papan sesi
     hidup di memori server dan ikut hilang bersama sesinya, sehingga
     satu jam pelajaran penuh tidak menambah XP siswa dan tidak pernah
     muncul di rekap guru. Yang dikirim lewat jalur yang sama persis
     dengan permainan sendiri, supaya XP, lencana, misi, riwayat, dan
     agregat per tingkat di dasbor guru semuanya ikut terisi.

     Yang cuma menonton tanpa menjawab sekali pun tidak dicatat — sesi
     yang tidak ia kerjakan tidak boleh menurunkan akurasinya. */
  function catatSesi(S2) {
    if (!S2 || S2.dicatat || !S2.dijawab) return;
    S2.dicatat = true;

    /* Penyebutnya soal yang ia hadapi, bukan yang ia jawab. Soal yang
       dibiarkan sampai jamnya habis adalah soal yang tidak terpecahkan —
       menghitungnya sebagai tidak pernah ada akan membuat akurasi siswa
       yang menyerah terlihat sama bagusnya dengan yang mengerjakan. */
    var jumlah = Math.max(S2.hadir, S2.dijawab);
    var tingkat = Number(S2.info && S2.info.tingkat) || 1;
    var hasil = S2.benar === jumlah ? 'win' : 'lose';

    var xp = Math.round(S2.skor / 25) + tingkat * 10 + (hasil === 'win' ? 60 : 15);
    var koin = Math.round(S2.skor / 60) + (hasil === 'win' ? 40 : 12);
    var permata = (hasil === 'win' && S2.utuh === jumlah) ? 1 : 0;

    var efek = S.record({
      result: hasil,
      mode: 'sesi', topic: GAME[S2.info && S2.info.topik] ? S2.info.topik : 'rantai',
      level: tingkat,
      myScore: S2.skor, opScore: 0,
      correct: S2.benar, total: jumlah,
      streak: S2.terbaik, fastest: 0,
      flawless: S2.utuh, hardClear: hasil === 'win' && tingkat === 3,
      xp: xp, coin: koin, gem: permata,
      /* Rerata waktu dibagi soal yang benar-benar dikerjakan — yang
         dibiarkan lewat tidak punya waktu pengerjaan untuk dirata-rata. */
      msAvg: S2.dijawab ? Math.round(S2.ms / S2.dijawab) : null
    });

    hud();
    if (efek.naikTingkat) {
      setTimeout(function () {
        FX.sfx.level();
        toast('Naik tingkat: ' + efek.naikTingkat.name + '!');
      }, 1200);
    }
  }

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

    /* Ajakan memutar layar harus bisa dilewati: ada siswa yang kunci
       rotasinya menyala dan tidak boleh sampai terkurung di sana. */
    var lewatiRotasi = $('rotateSkip');
    if (lewatiRotasi) {
      lewatiRotasi.addEventListener('click', function () {
        FX.sfx.tap();
        document.body.classList.add('tetap-tegak');
      });
    }

    modal.addEventListener('click', function (e) { if (e.target === modal) modal.hidden = true; });

    /* Pintasan papan ketik: di lab komputer, mengetik jawaban lewat
       papan ketik sungguhan jauh lebih cepat daripada mengklik papan
       angka di layar. */
    document.addEventListener('keydown', function (e) {
      var diArena = state.screen === 'battle', diSesi = state.screen === 'sesi';
      if (!diArena && !diSesi) return;

      if (diArena && state.match && state.match.lock) {
        if (e.key === 'Enter') { e.preventDefault(); lanjut(); }
        return;
      }

      /* Di langkah menelusur, papan ketik menggeser rantainya; angka baru
         berarti sesuatu setelah papan angkanya terbuka. */
      var langkah = diArena ? (state.match && state.match.langkah)
                            : (state.sesi && state.sesi.langkah);
      if (langkah !== 'jawab') {
        if (e.key === 'ArrowLeft') { e.preventDefault(); ACT.geser('kiri'); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); ACT.geser('kanan'); }
        else if (e.key === 'Enter') { e.preventDefault(); (diArena ? ACT.submit : ACT.submitSesi)(); }
        return;
      }

      var aksi = diArena ? ACT.tekan : ACT.tekanSesi;
      if (e.key >= '0' && e.key <= '9') { e.preventDefault(); aksi(e.key); }
      else if (e.key === 'Backspace') { e.preventDefault(); aksi('hapus'); }
      else if (e.key === 'Enter') { e.preventDefault(); aksi('kirim'); }
      else if (e.key === 'Escape') { e.preventDefault(); (diArena ? ACT.kembaliTelusur : ACT.kembaliSesi)(); }
    });

    /* Keadaan layar penuh bisa berubah tanpa lewat tombol kita — tombol
       Esc, gestur peramban, atau sistem operasi. Ikonnya karena itu
       mengikuti keadaan sebenarnya, bukan mengingat tekanan terakhir. */
    document.addEventListener('fullscreenchange', catLayarPenuh);
    document.addEventListener('webkitfullscreenchange', catLayarPenuh);

    /* Bangunkan audio pada sentuhan pertama. */
    var buka = function () {
      FX.sfx.tap();
      document.removeEventListener('pointerdown', buka);
    };
    document.addEventListener('pointerdown', buka);

  }

  function boot() {
    scr = $('screen'); tabbar = $('tabbar'); modal = $('modal'); topbar = $('topbar');
    S.load();
    FX.init();
    FX.setSound(S.p.sound !== false);
    pasangPendengar();
    hud();

    /* Layar pertama digambar dari data lokal supaya aplikasi langsung
       terlihat, tanpa menunggu jaringan sekolah. Pemeriksaan sesi jalan
       di belakangnya dan baru mengubah layar kalau memang perlu. */
    go(S.p.name ? 'home' : 'onboard');

    NET.mulai().then(function (profilServer) {
      if (NET.mode === 'kelas') {
        pakaiProfilServer(profilServer ? { data: profilServer } : null, NET.aku);
        nyalakanLive();
        /* Sesi mungkin sudah berjalan sebelum siswa ini membuka aplikasi —
           misalnya ia terlambat masuk kelas, atau ponselnya baru menyala. */
        LIVE.lihatSesi().then(function (r) {
          if (r && r.sesi && r.sesi.tahap !== 'usai') {
            state.sesiAda = r.sesi;
            if (state.screen === 'home') go('home');
          }
        });
        go('home');
      } else if (NET.mode === 'tamu' && !S.p.name) {
        /* Ada server, dan pemain ini belum punya apa-apa: tawarkan masuk
           kelas lebih dulu. Yang sudah main sendiri tidak diganggu — bagi
           mereka pintu masuk kelas ada di layar Profil. */
        state.masuk = { langkah: 'kode' };
        go('masuk');
      }
      /* mode 'luring': tidak ada server sama sekali (mis. GitHub Pages).
         Aplikasi berjalan persis seperti sebelum ada API. */
    });

    /* Simpanan terakhir saat tab ditutup, supaya permainan yang baru
       saja selesai tidak hilang gara-gara timer 1,2 detik belum jatuh. */
    global.addEventListener('pagehide', function () { NET.dorongSekarang(S.p); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

})(window);
