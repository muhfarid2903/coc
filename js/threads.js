/* ============================================================
   threads.js — pabrik rantai operasi

   Satu soal berupa rantai operasi hitung dan satu nilai akhir. Yang
   dicari bukan hasilnya, melainkan nilai awalnya: siswa menelusuri
   rantai itu mundur dari ujung.

   Rantainya selalu dibangkitkan MAJU dari sebuah nilai awal, lalu yang
   ditampilkan hanya operasi dan hasil akhirnya. Itu yang menjamin tiap
   soal punya jawaban bulat dan bisa dihitung mundur — membangkitkan
   operasi acak lalu berharap hasilnya bulat akan sering gagal, terutama
   pada pembagian dan persen.

   Urutan operasi matematika sengaja tidak berlaku: rantai dijalankan
   apa adanya dari kiri ke kanan. Tanpa aturan itu, "÷2" di tengah
   rantai tidak bisa dibalik satu per satu.
   ============================================================ */
(function (global) {
  'use strict';

  /* ---------- sumber keacakan ----------
     Seluruh pabrik menarik angka acak lewat satu pintu ini, bukan
     Math.random langsung, sehingga satu angka semai menghasilkan
     rantai yang sama persis di perangkat mana pun — syarat mutlak
     untuk sesi kelas serentak: skor tidak berarti apa-apa kalau
     soalnya berbeda. */
  var acak = Math.random;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* Semai dari server berupa teks (mis. "d3f1a90c"), jadi diringkas
     dulu jadi bilangan 32-bit. */
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

  /* ---------- utilitas ---------- */
  function ri(a, b) { return Math.floor(acak() * (b - a + 1)) + a; }
  function pick(a) { return a[ri(0, a.length - 1)]; }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(acak() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* Format angka gaya Indonesia: 1.250 */
  function fmt(n) {
    if (typeof n !== 'number') return String(n);
    var s = (Math.round(n * 100) / 100).toString().replace('.', ',');
    var p = s.split(',');
    p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return p.join(',');
  }

  /* ---------- tingkat kesulitan ----------
     Yang naik dua-duanya: rantainya makin panjang dan operasinya makin
     beragam. `maks` menahan nilai berjalan supaya tidak membengkak jadi
     angka yang melelahkan dihitung, bukan menantang. */
  var TINGKAT = {
    1: { langkah: 6,  jenis: ['+', '-'],                                 maks: 99,   angka: 12, awal: [2, 20] },
    2: { langkah: 10, jenis: ['+', '-', '×', '÷'],                       maks: 600,  angka: 20, awal: [2, 25] },
    3: { langkah: 14, jenis: ['+', '-', '×', '÷', 'kuadrat', 'persen'],  maks: 2500, angka: 25, awal: [2, 30] }
  };

  var PERSEN = [10, 20, 25, 50];

  function cfgTingkat(d) { return TINGKAT[Math.min(3, Math.max(1, d | 0))]; }

  /* Coba bangun satu operasi yang sah dari nilai berjalan `v`.
     Mengembalikan null kalau jenis itu memang tidak mungkin di sini —
     mis. "÷" saat nilainya bilangan prima besar. Pemanggilnya tinggal
     mencoba jenis lain. */
  function operasi(jenis, v, cfg, bolehKuadrat) {
    var n, m, d, kandidat, i, p, hasil;

    if (jenis === '+') {
      n = ri(1, cfg.angka);
      if (v + n > cfg.maks) return null;
      return { label: '+' + n, nilai: v + n };
    }

    if (jenis === '-') {
      if (v < 3) return null;
      n = ri(1, Math.min(cfg.angka, v - 1));
      return { label: '−' + n, nilai: v - n };
    }

    if (jenis === '×') {
      m = ri(2, 9);
      if (v * m > cfg.maks) return null;
      return { label: '×' + m, nilai: v * m };
    }

    if (jenis === '÷') {
      kandidat = [];
      for (d = 2; d <= 9; d++) if (v % d === 0 && v / d >= 1) kandidat.push(d);
      if (!kandidat.length) return null;
      d = pick(kandidat);
      return { label: '÷' + d, nilai: v / d };
    }

    /* Kuadrat cuma boleh sekali dalam satu rantai, dan hanya pada nilai
       kecil. Dua kuadrat berturut-turut membuat angkanya meledak, dan
       akar dari angka besar bukan lagi hitungan yang bisa dikejar
       di kepala. */
    if (jenis === 'kuadrat') {
      if (!bolehKuadrat || v < 2 || v > 9 || v * v > cfg.maks) return null;
      return { label: 'x²', nilai: v * v, kuadrat: true };
    }

    /* Persen hanya yang hasilnya bulat: 25% dari 40 boleh, 25% dari 41
       tidak. */
    if (jenis === 'persen') {
      kandidat = [];
      for (i = 0; i < PERSEN.length; i++) {
        p = PERSEN[i];
        if ((v * p) % 100 !== 0) continue;
        if (v + v * p / 100 <= cfg.maks) kandidat.push({ p: p, naik: true });
        if (v - v * p / 100 >= 1) kandidat.push({ p: p, naik: false });
      }
      if (!kandidat.length) return null;
      var k = pick(kandidat);
      hasil = k.naik ? v + v * k.p / 100 : v - v * k.p / 100;
      return { label: (k.naik ? '+' : '−') + k.p + '%', nilai: hasil };
    }

    return null;
  }

  /* Satu rantai utuh. */
  function satu(d) {
    var cfg = cfgTingkat(d);
    var awal = ri(cfg.awal[0], cfg.awal[1]);
    var v = awal, ops = [], jejak = [awal];
    var bolehKuadrat = true;
    var jaga = 0;

    while (ops.length < cfg.langkah && jaga++ < cfg.langkah * 60) {
      var op = operasi(pick(cfg.jenis), v, cfg, bolehKuadrat);
      if (!op) continue;
      if (op.kuadrat) bolehKuadrat = false;
      ops.push({ label: op.label });
      v = op.nilai;
      jejak.push(v);
    }

    /* Rantai yang lebih pendek dari targetnya berarti nilainya terjebak
       di tempat yang tidak punya operasi sah — sangat jarang, tapi lebih
       baik diulang daripada menyajikan soal yang bukan seperti janjinya. */
    if (ops.length < cfg.langkah) return satu(d);

    var langkah = ops.map(function (o, i) {
      return o.label + ' → ' + fmt(jejak[i + 1]);
    }).join(' · ');

    return {
      level: cfg === TINGKAT[1] ? 1 : (cfg === TINGKAT[2] ? 2 : 3),
      ops: ops,
      awal: awal,
      akhir: v,
      ketik: String(awal),
      answer: String(awal),
      explain: 'Mulai dari ' + fmt(awal) + ': ' + langkah + '.'
    };
  }

  /* Sekumpulan rantai tanpa pengulangan. Dua soal dengan nilai akhir
     dan rantai yang sama akan terasa seperti salah cetak. */
  function pack(count, d) {
    var out = [], seen = {}, jaga = 0;
    while (out.length < count && jaga++ < count * 40) {
      var q = satu(d);
      var kunci = q.akhir + '|' + q.ops.map(function (o) { return o.label; }).join(',');
      if (seen[kunci]) continue;
      seen[kunci] = 1;
      out.push(q);
    }
    while (out.length < count) out.push(satu(d));
    return out;
  }

  /* Set yang bisa diulang. Tanpa `semai` hasilnya acak seperti biasa;
     dengan `semai`, dua perangkat mendapat set yang identik. Keadaan
     acaknya selalu dikembalikan ke Math.random setelah selesai, supaya
     set bersemai tidak diam-diam menentukan set berikutnya. */
  function packSemai(n, d, semai) {
    if (semai == null) return pack(n, d);
    semaikan(semai);
    try { return pack(n, d); }
    finally { bebaskan(); }
  }

  /* Jawaban selalu bilangan bulat, jadi titik ribuan yang ikut terketik
     tidak boleh membuatnya dianggap salah. */
  function cocok(ketikan, q) {
    var a = String(ketikan == null ? '' : ketikan).trim().replace(/\./g, '');
    if (!a || !/^\d+$/.test(a)) return false;
    return parseInt(a, 10) === q.awal;
  }

  global.COC_Q = {
    satu: satu, pack: pack, packSemai: packSemai,
    cocok: cocok, fmt: fmt, ri: ri, pick: pick, shuffle: shuffle,
    TINGKAT: TINGKAT
  };
})(window);
