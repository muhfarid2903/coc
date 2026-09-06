/* ============================================================
   grid.js — pabrik papan "Jumlahkan Semua"

   Satu permainan berisi tiga ronde, mengikuti lembar Clash of
   Champions yang jadi acuan: kisi persegi berisi angka, lalu sarang
   lebah berisi angka, lalu sarang lebah berisi ekspresi yang harus
   dihitung dulu sebelum bisa dijumlahkan.

   Yang dicari selalu satu bilangan: jumlah seluruh isi papan.

   Sarang lebahnya dibuat beraturan — baris berselang-seling dengan
   lebar n dan n−1. Lembar acuannya memakai tautan segi enam dan segi
   lima yang tidak beraturan; bentuk selnya bukan bagian dari aturan
   main (yang dijumlahkan tetap semua sel), sedangkan tesselasi tak
   beraturan perlu penempatan satu per satu yang rapuh begitu ukuran
   layar berubah.
   ============================================================ */
(function (global) {
  'use strict';

  /* ---------- sumber keacakan ----------
     Kembar dengan threads.js: satu pintu acak yang bisa disemai,
     supaya seluruh kelas mendapat papan yang sama persis dalam sesi
     serentak. Papannya tidak pernah dikirim lewat jaringan — yang
     dikirim hanya semainya. */
  var acak = Math.random;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function keAngka(semai) {
    if (typeof semai === 'number') return semai | 0;
    var h = 2166136261, t = String(semai);
    for (var i = 0; i < t.length; i++) {
      h ^= t.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h | 0;
  }

  function semaikan(semai) { acak = mulberry32(keAngka(semai)); }
  function bebaskan() { acak = Math.random; }

  function ri(a, b) { return Math.floor(acak() * (b - a + 1)) + a; }
  function pick(a) { return a[ri(0, a.length - 1)]; }

  function fmt(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  /* ---------- tingkat kesulitan ----------
     Sarang lebah ditakar lewat lebar dan jumlah barisnya, bukan lewat
     jumlah sel yang diinginkan. Menargetkan jumlah sel memaksa baris
     terakhir dipotong, dan sisa satu sel di baris sendirian terbaca
     seperti salah cetak, bukan sarang lebah. */
  var TINGKAT = {
    1: { kisi: 6,  sarang: [5, 5], rumus: [3, 3], maksRumus: 50 },
    2: { kisi: 8,  sarang: [7, 6], rumus: [4, 3], maksRumus: 120 },
    3: { kisi: 10, sarang: [8, 7], rumus: [4, 4], maksRumus: 210 }
  };

  function cfgTingkat(d) { return TINGKAT[Math.min(3, Math.max(1, d | 0))]; }

  function sel(nilai, teks) { return { nilai: nilai, teks: teks == null ? String(nilai) : teks }; }

  /* ---------- ronde 1: kisi persegi berisi angka ---------- */
  function kisiAngka(n) {
    var baris = [], i, j, r;
    for (i = 0; i < n; i++) {
      r = [];
      for (j = 0; j < n; j++) r.push(sel(ri(0, 9)));
      baris.push(r);
    }
    return { bentuk: 'kisi', kolom: n, baris: baris };
  }

  /* ---------- sarang lebah ----------
     Baris berselang-seling lebar `lebar` dan `lebar − 1`, seperti sarang
     lebah sungguhan: baris genap bergeser setengah sel. */
  function sarang(ukuran, isiSel) {
    var lebar = ukuran[0], jumlahBaris = ukuran[1], baris = [];
    for (var b = 0; b < jumlahBaris; b++) {
      var muat = (b % 2 === 0) ? lebar : lebar - 1;
      var r = [];
      for (var i = 0; i < muat; i++) r.push(isiSel());
      baris.push(r);
    }
    return { bentuk: 'sarang', lebar: lebar, baris: baris };
  }

  /* ---------- ronde 3: ekspresi ----------
     Bentuknya mengikuti lembar acuan: perkalian, pembagian, akar,
     pangkat dua, dan nilai mutlak. Besar nilainya dibatasi per tingkat —
     di EASY sampai 50, di HARD sampai 210, seperti nilai terbesar yang
     muncul di lembar aslinya (8 × 25 = 200). Yang naik bukan cuma jumlah
     selnya, tapi juga besar angka yang harus dijinjing sambil menjumlah. */
  var KUADRAT = [4, 9, 16, 25, 36, 49, 64, 81, 100, 121, 144];

  /* Bentuk yang nilainya kebesaran dibuang lalu diundi ulang; semuanya
     punya versi kecil, jadi undiannya tidak pernah berputar lama. */
  function rumus(maks) {
    for (var coba = 0; coba < 40; coba++) {
      var r = rumusSekali();
      if (r.nilai <= maks) return r;
    }
    return sel(ri(2, Math.min(40, maks)), '|−' + ri(2, Math.min(40, maks)) + '|');
  }

  function rumusSekali() {
    var a, b, n, v;
    switch (ri(1, 8)) {
      case 1:                                   /* a × b */
        a = ri(2, 15); b = ri(2, 14);
        return sel(a * b, a + ' × ' + b);
      case 2:                                   /* a ÷ b, selalu bulat */
        b = ri(2, 9); v = ri(2, 20); a = b * v;
        return sel(v, a + ' ÷ ' + b);
      case 3:                                   /* √n */
        n = pick(KUADRAT);
        return sel(Math.sqrt(n), '√' + n);
      case 4:                                   /* a² */
        a = ri(2, 12);
        return sel(a * a, a + '²');
      case 5:                                   /* a² + b² */
        a = ri(1, 9); b = ri(1, 9);
        return sel(a * a + b * b, a + '² + ' + b + '²');
      case 6:                                   /* √a + √b */
        a = pick(KUADRAT); b = pick(KUADRAT);
        return sel(Math.sqrt(a) + Math.sqrt(b), '√' + a + ' + √' + b);
      case 7:                                   /* |−a| */
        a = ri(2, 40);
        return sel(a, '|−' + a + '|');
      default:                                  /* √n − a, tidak pernah negatif */
        n = pick(KUADRAT); v = Math.sqrt(n); a = ri(1, v);
        return sel(v - a, '√' + n + ' − ' + a);
    }
  }

  /* ---------- satu papan utuh ---------- */
  function hitung(papan) {
    var total = 0, sub = [];
    for (var i = 0; i < papan.baris.length; i++) {
      var t = 0;
      for (var j = 0; j < papan.baris[i].length; j++) t += papan.baris[i][j].nilai;
      sub.push(t);
      total += t;
    }
    papan.subtotal = sub;
    papan.jumlah = total;
    return papan;
  }

  function bungkus(papan, judul) {
    hitung(papan);
    var n = 0;
    for (var i = 0; i < papan.baris.length; i++) n += papan.baris[i].length;
    papan.judul = judul;
    papan.sel = n;
    papan.ketik = String(papan.jumlah);
    papan.answer = fmt(papan.jumlah);
    /* Pembahasannya berupa jumlah per baris — itu memang cara paling
       masuk akal mengerjakannya, dan siswa yang salah bisa langsung
       melihat di baris mana hitungannya meleset. */
    papan.explain = 'Jumlah per baris: ' + papan.subtotal.join(' + ') +
      ' = ' + fmt(papan.jumlah) + '.';
    return papan;
  }

  /* Selnya berisi hitungan, bukan angka tunggal — penggambarnya perlu
     tahu supaya selnya dibuat lebih lebar. */
  function tandaiEkspresi(papan) { papan.ekspresi = true; return papan; }

  /* Tiga ronde satu permainan. */
  function pack(d) {
    var c = cfgTingkat(d);
    return [
      bungkus(kisiAngka(c.kisi), 'Kisi angka'),
      bungkus(sarang(c.sarang, function () { return sel(ri(0, 9)); }), 'Sarang lebah'),
      tandaiEkspresi(bungkus(sarang(c.rumus, function () { return rumus(c.maksRumus); }), 'Sarang berisi hitungan'))
    ];
  }

  function packSemai(d, semai) {
    if (semai == null) return pack(d);
    semaikan(semai);
    try { return pack(d); }
    finally { bebaskan(); }
  }

  global.COC_GRID = {
    pack: pack, packSemai: packSemai, fmt: fmt, TINGKAT: TINGKAT
  };
})(window);
