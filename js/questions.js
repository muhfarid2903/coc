/* ============================================================
   questions.js — pabrik soal matematika
   Setiap generator menerima tingkat kesulitan d (1 EASY, 2 MEDIUM,
   3 HARD) dan mengembalikan { text, correct, explain }, lalu difinalkan
   jadi soal siap tampil dengan jawaban yang tinggal diketik.
   ============================================================ */
(function (global) {
  'use strict';

  /* ---------- sumber keacakan ----------
     Seluruh pabrik soal menarik angka acak lewat satu pintu ini, bukan
     Math.random langsung. Dengan begitu satu angka semai bisa membuat
     sepuluh soal yang sama persis di perangkat mana pun — syarat mutlak
     untuk mengadu dua siswa: skor tidak berarti apa-apa kalau soalnya
     berbeda.

     mulberry32 dipilih karena muat dalam enam baris, tidak menyimpan
     keadaan di luar closure-nya, dan sebarannya cukup rata untuk soal
     matematika. Ini bukan keacakan kriptografis, dan memang tidak perlu. */
  var acak = Math.random;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* Ubah teks semai apa pun menjadi bilangan 32-bit. Semai dari server
     berupa teks (mis. "d3f1a90c"), jadi perlu diringkas dulu. */
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
  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { var t = b; b = a % b; a = t; } return a || 1; }

  /* Format angka gaya Indonesia: 1.250 dan 3,5 */
  function fmt(n) {
    if (typeof n !== 'number') return String(n);
    var s = (Math.round(n * 100) / 100).toString().replace('.', ',');
    var p = s.split(',');
    p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return p.join(',');
  }
  function rupiah(n) { return 'Rp' + fmt(n); }

  /* Bungkus mentahan generator jadi soal siap tampil.

     Jawabannya disimpan dalam dua bentuk. `answer` untuk dibaca manusia:
     lengkap dengan "Rp", satuan, dan titik ribuan. `ketik` untuk
     dibandingkan dengan yang diketik siswa: tanpa hiasan itu semua,
     karena awalan dan satuan sudah tercetak tetap di kiri-kanan papan
     angka — tidak pernah ada yang mengetiknya. */
  function finalize(topic, raw) {
    var unit = raw.unit || '', pre = raw.prefix || '';
    var teks = typeof raw.correct === 'number' ? fmt(raw.correct) : String(raw.correct);
    return {
      topic: topic,
      text: raw.text,
      long: !!raw.long,
      prefix: pre,
      unit: unit,
      ketik: teks.replace(/\./g, ''),
      answer: pre + teks + unit,
      explain: raw.explain || ''
    };
  }

  /* Angka Indonesia jadi bilangan: "1.215" -> 1215, "7,5" -> 7,5.
     Pecahan sengaja ditolak (mengembalikan null) — lihat cocok(). */
  function keBilangan(s) {
    var t = String(s).replace(/\./g, '');
    if (!/^-?\d+(,\d+)?$/.test(t)) return null;
    return parseFloat(t.replace(',', '.'));
  }

  /* Apakah ketikan siswa sama dengan jawaban soal?

     Dibandingkan sebagai bilangan lebih dulu, supaya "07" dan "7,50"
     tetap diterima — siswa tidak boleh kehilangan poin gara-gara nol di
     depan. Pecahan justru dibandingkan sebagai teks: pada soal
     "Sederhanakan 8/14", jawaban "8/14" bernilai sama tetapi belum
     dikerjakan, jadi memang tidak boleh lolos. */
  function cocok(ketikan, q) {
    var a = String(ketikan == null ? '' : ketikan).trim().replace(/\./g, '');
    if (!a) return false;
    if (a === q.ketik) return true;
    var na = keBilangan(a), nb = keBilangan(q.ketik);
    return na !== null && nb !== null && Math.abs(na - nb) < 1e-9;
  }

  /* ============================================================
     1. Hitung Kilat
     ============================================================ */
  function genKilat(d) {
    var a, b, c, v, t, e, r;
    if (d <= 1) {
      r = ri(1, 4);
      if (r === 1) { a = ri(4, 25); b = ri(3, 20); v = a + b; t = a + ' + ' + b; e = a + ' + ' + b + ' = ' + v; }
      else if (r === 2) { a = ri(12, 40); b = ri(3, 11); v = a - b; t = a + ' − ' + b; e = a + ' − ' + b + ' = ' + v; }
      else if (r === 3) { a = ri(3, 9); b = ri(3, 9); v = a * b; t = a + ' × ' + b; e = 'Perkalian dasar: ' + a + ' × ' + b + ' = ' + v; }
      else { b = ri(3, 9); v = ri(3, 12); a = b * v; t = a + ' ÷ ' + b; e = a + ' ÷ ' + b + ' = ' + v; }
    } else if (d === 2) {
      r = ri(1, 4);
      if (r === 1) { a = ri(6, 14); b = ri(6, 12); v = a * b; t = a + ' × ' + b; e = a + ' × ' + b + ' = ' + v; }
      else if (r === 2) { b = ri(4, 12); v = ri(4, 15); a = b * v; t = a + ' ÷ ' + b; e = a + ' ÷ ' + b + ' = ' + v; }
      else if (r === 3) { a = ri(3, 9); b = ri(3, 9); c = ri(5, 30); v = a * b + c; t = a + ' × ' + b + ' + ' + c; e = 'Kali dulu: ' + a + ' × ' + b + ' = ' + (a * b) + ', lalu + ' + c + ' = ' + v; }
      else { a = ri(5, 12); v = a * a; t = a + '²'; e = a + ' × ' + a + ' = ' + v; }
    } else {
      r = ri(1, 5);
      if (r === 1) { a = ri(11, 25); b = ri(6, 14); v = a * b; t = a + ' × ' + b; e = a + ' × ' + b + ' = ' + v; }
      else if (r === 2) { a = ri(4, 12); b = ri(4, 12); c = ri(3, 9); v = (a + b) * c; t = '(' + a + ' + ' + b + ') × ' + c; e = 'Kurung dulu: ' + (a + b) + ', lalu × ' + c + ' = ' + v; }
      else if (r === 3) { a = ri(6, 12); b = ri(6, 12); c = ri(6, 30); v = a * b - c; t = a + ' × ' + b + ' − ' + c; e = a + ' × ' + b + ' = ' + (a * b) + ', dikurangi ' + c + ' = ' + v; }
      else if (r === 4) { a = ri(20, 60); b = ri(3, 9); c = ri(3, 9); v = a + b * c; t = a + ' + ' + b + ' × ' + c; e = 'Perkalian didahulukan: ' + b + ' × ' + c + ' = ' + (b * c) + ', lalu + ' + a + ' = ' + v; }
      else { b = ri(4, 12); v = ri(6, 20); a = b * v; c = ri(3, 15); t = a + ' ÷ ' + b + ' + ' + c; v = v + c; e = a + ' ÷ ' + b + ' = ' + (v - c) + ', lalu + ' + c + ' = ' + v; }
    }
    return { text: t + ' = ?', correct: v, explain: e };
  }

  /* ============================================================
     2. Duel Aljabar
     ============================================================ */
  function genAljabar(d) {
    var x, a, b, c, dd, t, e;
    if (d <= 1) {
      if (acak() < 0.5) {
        x = ri(2, 15); a = ri(2, 20); b = x + a;
        t = 'x + ' + a + ' = ' + b; e = 'x = ' + b + ' − ' + a + ' = ' + x;
      } else {
        x = ri(2, 12); a = ri(2, 9); b = a * x;
        t = a + 'x = ' + b; e = 'x = ' + b + ' ÷ ' + a + ' = ' + x;
      }
    } else if (d === 2) {
      if (acak() < 0.5) {
        x = ri(2, 12); a = ri(2, 9); b = ri(1, 20); c = a * x + b;
        t = a + 'x + ' + b + ' = ' + c;
        e = a + 'x = ' + c + ' − ' + b + ' = ' + (a * x) + ', jadi x = ' + (a * x) + ' ÷ ' + a + ' = ' + x;
      } else {
        a = ri(2, 6); b = ri(1, 15);
        x = ri(2, 12) * a;      /* kelipatan a agar x/a bulat */
        c = x / a + b;
        t = 'x/' + a + ' + ' + b + ' = ' + c;
        e = 'x/' + a + ' = ' + c + ' − ' + b + ' = ' + (x / a) + ', jadi x = ' + (x / a) + ' × ' + a + ' = ' + x;
      }
    } else {
      if (acak() < 0.5) {
        x = ri(2, 11); a = ri(3, 9); c = ri(1, a - 1); b = ri(1, 18);
        dd = a * x + b - c * x;
        t = a + 'x + ' + b + ' = ' + c + 'x + ' + dd;
        e = 'Pindahkan: ' + (a - c) + 'x = ' + dd + ' − ' + b + ' = ' + ((a - c) * x) + ', jadi x = ' + x;
      } else {
        x = ri(2, 10); a = ri(2, 7); b = ri(1, 9); c = a * (x + b);
        t = a + '(x + ' + b + ') = ' + c;
        e = 'x + ' + b + ' = ' + c + ' ÷ ' + a + ' = ' + (x + b) + ', jadi x = ' + x;
      }
    }
    return { text: t, correct: x, explain: e };
  }

  /* ============================================================
     3. Serbu Geometri
     ============================================================ */
  function genGeometri(d) {
    var s, p, l, t, r, a, tg, v, e, txt, unit;
    var bank = [];

    bank.push(function () {
      s = ri(3, 18); v = s * s;
      return { text: 'Luas persegi dengan sisi ' + s + ' cm?', correct: v, unit: ' cm²',
        explain: 'Luas = s × s = ' + s + ' × ' + s + ' = ' + v + ' cm²' };
    });
    bank.push(function () {
      s = ri(4, 25); v = 4 * s;
      return { text: 'Keliling persegi dengan sisi ' + s + ' cm?', correct: v, unit: ' cm',
        explain: 'Keliling = 4 × s = 4 × ' + s + ' = ' + v + ' cm' };
    });
    bank.push(function () {
      p = ri(5, 24); l = ri(3, 15); v = p * l;
      return { text: 'Luas persegi panjang ' + p + ' cm × ' + l + ' cm?', correct: v, unit: ' cm²',
        explain: 'Luas = p × l = ' + p + ' × ' + l + ' = ' + v + ' cm²' };
    });
    bank.push(function () {
      p = ri(6, 22); l = ri(4, 16); v = 2 * (p + l);
      return { text: 'Keliling persegi panjang ' + p + ' cm × ' + l + ' cm?', correct: v, unit: ' cm',
        explain: 'Keliling = 2 × (' + p + ' + ' + l + ') = ' + v + ' cm' };
    });
    bank.push(function () {
      a = ri(3, 12) * 2; tg = ri(4, 18); v = a * tg / 2;
      return { text: 'Luas segitiga dengan alas ' + a + ' cm dan tinggi ' + tg + ' cm?', correct: v, unit: ' cm²',
        explain: 'Luas = ½ × a × t = ½ × ' + a + ' × ' + tg + ' = ' + v + ' cm²' };
    });
    if (d >= 2) {
      bank.push(function () {
        a = ri(4, 16); tg = ri(3, 14); v = a * tg;
        return { text: 'Luas jajargenjang, alas ' + a + ' cm dan tinggi ' + tg + ' cm?', correct: v, unit: ' cm²',
          explain: 'Luas = a × t = ' + a + ' × ' + tg + ' = ' + v + ' cm²' };
      });
      bank.push(function () {
        s = ri(2, 12); v = s * s * s;
        return { text: 'Volume kubus dengan rusuk ' + s + ' cm?', correct: v, unit: ' cm³',
          explain: 'Volume = s³ = ' + s + ' × ' + s + ' × ' + s + ' = ' + v + ' cm³' };
      });
      bank.push(function () {
        p = ri(3, 12); l = ri(2, 10); tg = ri(2, 9); v = p * l * tg;
        return { text: 'Volume balok ' + p + ' × ' + l + ' × ' + tg + ' cm?', correct: v, unit: ' cm³',
          explain: 'Volume = p × l × t = ' + p + ' × ' + l + ' × ' + tg + ' = ' + v + ' cm³' };
      });
      bank.push(function () {
        r = pick([7, 14, 21]); v = 22 * r * r / 7;
        return { text: 'Luas lingkaran berjari-jari ' + r + ' cm (π = 22/7)?', correct: v, unit: ' cm²',
          explain: 'Luas = π r² = 22/7 × ' + r + '² = ' + v + ' cm²' };
      });
      bank.push(function () {
        r = pick([7, 14, 21, 28]); v = 2 * 22 * r / 7;
        return { text: 'Keliling lingkaran berjari-jari ' + r + ' cm (π = 22/7)?', correct: v, unit: ' cm',
          explain: 'Keliling = 2πr = 2 × 22/7 × ' + r + ' = ' + v + ' cm' };
      });
      bank.push(function () {
        s = ri(3, 14); v = 6 * s * s;
        return { text: 'Luas permukaan kubus dengan rusuk ' + s + ' cm?', correct: v, unit: ' cm²',
          explain: 'Luas permukaan = 6 × s² = 6 × ' + (s * s) + ' = ' + v + ' cm²' };
      });
    }
    if (d >= 3) {
      bank.push(function () {
        a = ri(4, 14); var b2 = a + ri(2, 10); tg = ri(2, 8) * 2; v = (a + b2) * tg / 2;
        return { text: 'Luas trapesium dengan sisi sejajar ' + a + ' cm dan ' + b2 + ' cm, tinggi ' + tg + ' cm?',
          correct: v, unit: ' cm²', long: true,
          explain: 'Luas = ½ × (' + a + ' + ' + b2 + ') × ' + tg + ' = ' + v + ' cm²' };
      });
      bank.push(function () {
        r = pick([7, 14]); tg = ri(4, 20); v = 22 * r * r * tg / 7;
        return { text: 'Volume tabung, jari-jari ' + r + ' cm dan tinggi ' + tg + ' cm (π = 22/7)?',
          correct: v, unit: ' cm³', long: true,
          explain: 'V = πr²t = 22/7 × ' + (r * r) + ' × ' + tg + ' = ' + v + ' cm³' };
      });
      bank.push(function () {
        a = ri(4, 12) * 2; tg = ri(3, 12); var tp = ri(5, 18); v = (a * tg / 2) * tp;
        return { text: 'Volume prisma segitiga: alas ' + a + ' cm, tinggi segitiga ' + tg + ' cm, tinggi prisma ' + tp + ' cm?',
          correct: v, unit: ' cm³', long: true,
          explain: 'Luas alas = ½ × ' + a + ' × ' + tg + ' = ' + (a * tg / 2) + ' cm², lalu × ' + tp + ' = ' + v + ' cm³' };
      });
      bank.push(function () {
        p = ri(5, 15); l = ri(4, 12); tg = ri(3, 10); v = 2 * (p * l + p * tg + l * tg);
        return { text: 'Luas permukaan balok ' + p + ' × ' + l + ' × ' + tg + ' cm?', correct: v, unit: ' cm²', long: true,
          explain: 'LP = 2(pl + pt + lt) = 2(' + (p * l) + ' + ' + (p * tg) + ' + ' + (l * tg) + ') = ' + v + ' cm²' };
      });
    }

    var raw = pick(bank)();
    return raw;
  }

  /* ============================================================
     4. Pecahan & Persen
     ============================================================ */
  function genPecahan(d) {
    var a, b, n, p, v, r;
    if (d <= 1) {
      if (acak() < 0.5) {
        p = pick([10, 20, 25, 50, 75]); n = pick([40, 60, 80, 100, 120, 200]);
        v = n * p / 100;
        return { text: p + '% dari ' + n + ' = ?', correct: v,
          explain: p + '% × ' + n + ' = ' + fmt(p / 100) + ' × ' + n + ' = ' + v };
      }
      b = pick([2, 3, 4, 5]); n = b * ri(4, 20); v = n / b;
      return { text: '1/' + b + ' dari ' + n + ' = ?', correct: v,
        explain: n + ' ÷ ' + b + ' = ' + v };
    }
    if (d === 2) {
      r = ri(1, 3);
      if (r === 1) {
        p = pick([15, 30, 40, 60]); n = pick([50, 100, 150, 200, 250]);
        v = n * p / 100;
        return { text: p + '% dari ' + n + ' = ?', correct: v,
          explain: p + '/100 × ' + n + ' = ' + v };
      }
      if (r === 2) {
        b = pick([5, 6, 7, 8, 9, 10, 12]); a = ri(1, b - 2);
        var a2 = ri(1, b - a - 1);
        var num = a + a2, den = b, g = gcd(num, den);
        var right = (num / g) + '/' + (den / g);
        return { text: a + '/' + b + ' + ' + a2 + '/' + b + ' = ?', correct: right,
          explain: 'Penyebut sama: (' + a + ' + ' + a2 + ')/' + b + ' = ' + num + '/' + den +
            (g > 1 ? ' disederhanakan jadi ' + right : '') };
      }
      var k = ri(2, 9); var s1 = ri(1, 6); var s2 = s1 + ri(1, 5);
      var right2 = s1 + '/' + s2;
      return { text: 'Sederhanakan ' + (s1 * k) + '/' + (s2 * k), correct: right2,
        explain: 'Bagi pembilang dan penyebut dengan ' + k + ': ' + (s1 * k) + '÷' + k + ' = ' + s1 + ', ' + (s2 * k) + '÷' + k + ' = ' + s2 };
    }
    /* d === 3 */
    r = ri(1, 4);
    if (r === 1) {
      var harga = pick([80, 120, 150, 200, 240, 300, 400]) * 1000;
      var dis1 = pick([10, 15, 20, 25, 30, 40]);
      v = harga - harga * dis1 / 100;
      return { text: 'Harga ' + rupiah(harga) + ' didiskon ' + dis1 + '%. Berapa harga akhirnya?',
        correct: v, prefix: 'Rp', long: true,
        explain: 'Potongan = ' + dis1 + '% × ' + rupiah(harga) + ' = ' + rupiah(harga * dis1 / 100) +
          ', sisa ' + rupiah(v) };
    }
    if (r === 2) {
      var d1 = pick([2, 3, 4]), d2 = pick([5, 6, 8]);
      var pemb = ri(1, d1 - 1), pemb2 = ri(1, d2 - 1);
      var nu = pemb * d2 + pemb2 * d1, de = d1 * d2, gg = gcd(nu, de);
      var res = (nu / gg) + '/' + (de / gg);
      return { text: pemb + '/' + d1 + ' + ' + pemb2 + '/' + d2 + ' = ?', correct: res,
        explain: 'Samakan penyebut jadi ' + de + ': ' + (pemb * d2) + '/' + de + ' + ' + (pemb2 * d1) + '/' + de +
          ' = ' + nu + '/' + de + (gg > 1 ? ' = ' + res : '') };
    }
    if (r === 3) {
      var modal = pick([150, 200, 250, 400, 500]) * 1000;
      var untung = pick([12, 15, 20, 25, 30]);
      v = modal + modal * untung / 100;
      return { text: 'Modal ' + rupiah(modal) + ' dijual untung ' + untung + '%. Berapa harga jualnya?',
        correct: v, prefix: 'Rp', long: true,
        explain: 'Untung = ' + untung + '% × ' + rupiah(modal) + ' = ' + rupiah(modal * untung / 100) +
          ', harga jual = ' + rupiah(v) };
    }
    var awal = pick([200, 300, 400, 500]) * 1000;
    var pot1 = pick([20, 25, 50]), pot2 = pick([10, 20]);
    var stg = awal * (100 - pot1) / 100;
    v = stg * (100 - pot2) / 100;
    return { text: 'Harga ' + rupiah(awal) + ' didiskon ' + pot1 + '% lalu ' + pot2 + '% lagi. Harga akhir?',
      correct: v, prefix: 'Rp', long: true,
      explain: 'Diskon bertingkat dihitung berurutan: ' + rupiah(awal) + ' → ' + rupiah(stg) + ' → ' + rupiah(v) };
  }

  /* ============================================================
     5. Baca Pola
     ============================================================ */
  function genPola(d) {
    var seq = [], v, e, i, a, b, r;
    var kind;
    if (d <= 1) kind = pick(['tambah', 'kurang']);
    else if (d === 2) kind = pick(['kali', 'kuadrat', 'naikbeda']);
    else kind = pick(['fibo', 'selang', 'naikbeda', 'pangkat', 'kuadrat']);

    if (kind === 'tambah') {
      a = ri(2, 12); b = ri(2, 9);
      for (i = 0; i < 5; i++) seq.push(a + b * i);
      v = a + b * 5; e = 'Setiap suku bertambah ' + b + '.';
    } else if (kind === 'kurang') {
      b = ri(3, 9); a = b * 6 + ri(2, 20);
      for (i = 0; i < 5; i++) seq.push(a - b * i);
      v = a - b * 5; e = 'Setiap suku berkurang ' + b + '.';
    } else if (kind === 'kali') {
      a = ri(1, 5); r = ri(2, 3);
      for (i = 0; i < 5; i++) seq.push(a * Math.pow(r, i));
      v = a * Math.pow(r, 5); e = 'Setiap suku dikali ' + r + '.';
    } else if (kind === 'kuadrat') {
      var st = ri(1, 5);
      for (i = 0; i < 5; i++) seq.push((st + i) * (st + i));
      v = (st + 5) * (st + 5); e = 'Deret bilangan kuadrat: ' + (st + 5) + '² = ' + v + '.';
    } else if (kind === 'naikbeda') {
      a = ri(1, 8); var beda = ri(2, 5), inc = ri(1, 3), cur = a;
      seq.push(cur);
      for (i = 0; i < 4; i++) { cur += beda; seq.push(cur); beda += inc; }
      v = cur + beda; e = 'Selisihnya bertambah ' + inc + ' tiap langkah, selisih berikutnya ' + beda + '.';
    } else if (kind === 'fibo') {
      a = ri(1, 6); b = ri(2, 9);
      seq = [a, b];
      for (i = 0; i < 3; i++) seq.push(seq[seq.length - 1] + seq[seq.length - 2]);
      v = seq[seq.length - 1] + seq[seq.length - 2];
      e = 'Setiap suku adalah jumlah dua suku sebelumnya: ' + seq[seq.length - 2] + ' + ' + seq[seq.length - 1] + ' = ' + v + '.';
    } else if (kind === 'selang') {
      a = ri(2, 9); b = ri(20, 40); var da = ri(2, 6), db = ri(2, 6);
      seq = [a, b, a + da, b - db, a + 2 * da];
      v = b - 2 * db; e = 'Ada dua deret berselang-seling: ganjil naik ' + da + ', genap turun ' + db + '.';
    } else {
      var base = ri(2, 4);
      for (i = 1; i <= 5; i++) seq.push(Math.pow(base, i));
      v = Math.pow(base, 6); e = 'Deret pangkat ' + base + ': ' + base + '⁶ = ' + v + '.';
    }

    return {
      text: seq.map(fmt).join(', ') + ', ...',
      correct: v,
      explain: e
    };
  }

  /* ============================================================
     6. Soal Cerita
     ============================================================ */
  function genCerita(d) {
    var bank = [];
    var nama = ['Rani', 'Bagas', 'Sinta', 'Doni', 'Ayu', 'Fajar', 'Nadia', 'Yoga', 'Kirana', 'Bimo'];
    var n1 = pick(nama), n2 = pick(nama);

    bank.push(function () {
      var h = pick([2500, 3000, 4500, 5000, 7500]), q = ri(3, 12), v = h * q;
      return { text: n1 + ' membeli ' + q + ' buku tulis seharga ' + rupiah(h) + ' per buah. Berapa total belanjanya?',
        correct: v, prefix: 'Rp',
        explain: q + ' × ' + rupiah(h) + ' = ' + rupiah(v) };
    });
    bank.push(function () {
      var h = pick([12000, 15000, 18000, 25000]), q = ri(2, 6), bayar = pick([100000, 50000, 200000]);
      var total = h * q;
      if (bayar <= total) bayar = Math.ceil(total / 50000) * 50000 + 50000;
      var v = bayar - total;
      return { text: n1 + ' membeli ' + q + ' porsi bakso @ ' + rupiah(h) + ' dan membayar ' + rupiah(bayar) + '. Berapa kembaliannya?',
        correct: v, prefix: 'Rp', long: true,
        explain: 'Total = ' + rupiah(total) + '. Kembalian = ' + rupiah(bayar) + ' − ' + rupiah(total) + ' = ' + rupiah(v) };
    });
    bank.push(function () {
      var v0 = pick([40, 50, 60, 72, 80]), t = ri(2, 5), v = v0 * t;
      return { text: 'Sebuah mobil melaju ' + v0 + ' km/jam selama ' + t + ' jam. Berapa jarak yang ditempuh?',
        correct: v, unit: ' km',
        explain: 'Jarak = kecepatan × waktu = ' + v0 + ' × ' + t + ' = ' + v + ' km' };
    });
    bank.push(function () {
      var total = ri(4, 12) * ri(3, 9), org = 0, per = 0;
      org = pick([3, 4, 5, 6]); per = ri(4, 15); total = org * per;
      return { text: total + ' permen dibagi rata kepada ' + org + ' anak. Berapa permen tiap anak?',
        correct: per,
        explain: total + ' ÷ ' + org + ' = ' + per };
    });
    if (d >= 2) {
      bank.push(function () {
        var n = 5, vals = [], sum = 0;
        for (var i = 0; i < n; i++) { var x = ri(6, 10) * 10; vals.push(x); sum += x; }
        var sisa = sum % n;
        if (sisa !== 0) { vals[0] += (n - sisa); sum += (n - sisa); }
        var v = sum / n;
        return { text: 'Nilai ulangan ' + n1 + ': ' + vals.join(', ') + '. Berapa rata-ratanya?',
          correct: v, long: true,
          explain: 'Jumlah = ' + sum + ', dibagi ' + n + ' = ' + v };
      });
      bank.push(function () {
        var harga = pick([60, 80, 120, 150, 250]) * 1000, disk = pick([10, 20, 25, 50]);
        var v = harga - harga * disk / 100;
        return { text: n1 + ' membeli sepatu ' + rupiah(harga) + ' dengan diskon ' + disk + '%. Berapa yang dibayar?',
          correct: v, prefix: 'Rp', long: true,
          explain: 'Diskon = ' + rupiah(harga * disk / 100) + ', bayar = ' + rupiah(v) };
      });
      bank.push(function () {
        var umurA = ri(8, 16), selisih = ri(3, 12), thn = ri(2, 8);
        var v = umurA + selisih + thn;
        return { text: 'Umur ' + n1 + ' sekarang ' + umurA + ' tahun. ' + n2 + ' ' + selisih + ' tahun lebih tua. Berapa umur ' + n2 + ' ' + thn + ' tahun lagi?',
          correct: v, unit: ' tahun', long: true,
          explain: 'Umur ' + n2 + ' sekarang = ' + umurA + ' + ' + selisih + ' = ' + (umurA + selisih) + ', ditambah ' + thn + ' tahun = ' + v };
      });
      bank.push(function () {
        var jarak = pick([120, 180, 240, 300, 360]), kec = pick([40, 60, 90]);
        while (jarak % kec !== 0) jarak = kec * ri(2, 6);
        var v = jarak / kec;
        return { text: 'Jarak ' + jarak + ' km ditempuh dengan kecepatan ' + kec + ' km/jam. Berapa lama perjalanannya?',
          correct: v, unit: ' jam', long: true,
          explain: 'Waktu = jarak ÷ kecepatan = ' + jarak + ' ÷ ' + kec + ' = ' + v + ' jam' };
      });
    }
    if (d >= 3) {
      bank.push(function () {
        var pekerja = ri(3, 8), hari = ri(4, 12), tambah = ri(1, 4);
        var totalKerja = pekerja * hari;
        var baru = pekerja + tambah;
        while (totalKerja % baru !== 0) { hari++; totalKerja = pekerja * hari; }
        var v = totalKerja / baru;
        return { text: 'Sebuah pekerjaan selesai dalam ' + hari + ' hari oleh ' + pekerja + ' orang. Jika dikerjakan ' + baru + ' orang, berapa hari selesainya?',
          correct: v, unit: ' hari', long: true,
          explain: 'Total beban = ' + pekerja + ' × ' + hari + ' = ' + totalKerja + ' hari-orang, dibagi ' + baru + ' orang = ' + v + ' hari' };
      });
      bank.push(function () {
        var modal = pick([250, 400, 600, 800]) * 1000, rugi = pick([10, 15, 20, 25]);
        var v = modal - modal * rugi / 100;
        return { text: 'Barang bermodal ' + rupiah(modal) + ' dijual rugi ' + rugi + '%. Berapa harga jualnya?',
          correct: v, prefix: 'Rp', long: true,
          explain: 'Rugi = ' + rupiah(modal * rugi / 100) + ', harga jual = ' + rupiah(v) };
      });
      bank.push(function () {
        var a = ri(2, 6), b = ri(3, 9), total = (a + b) * ri(4, 14);
        var v = total * a / (a + b);
        return { text: 'Uang ' + rupiah(total * 1000) + ' dibagi ' + n1 + ' dan ' + n2 + ' dengan perbandingan ' + a + ' : ' + b + '. Berapa bagian ' + n1 + '?',
          correct: v * 1000, prefix: 'Rp', long: true,
          explain: 'Bagian ' + n1 + ' = ' + a + '/' + (a + b) + ' × ' + rupiah(total * 1000) + ' = ' + rupiah(v * 1000) };
      });
      bank.push(function () {
        var tabung = pick([500, 800, 1200]) * 1000, bunga = pick([6, 8, 10, 12]), bulan = pick([6, 9, 12]);
        var v = tabung + tabung * bunga / 100 * bulan / 12;
        return { text: 'Tabungan ' + rupiah(tabung) + ' berbunga ' + bunga + '% per tahun. Berapa saldonya setelah ' + bulan + ' bulan?',
          correct: v, prefix: 'Rp', long: true,
          explain: 'Bunga = ' + bunga + '% × ' + rupiah(tabung) + ' × ' + bulan + '/12 = ' + rupiah(tabung * bunga / 100 * bulan / 12) + ', saldo = ' + rupiah(v) };
      });
    }

    var raw = pick(bank)();
    raw.long = true;
    return raw;
  }

  /* ============================================================
     Pembungkus
     ============================================================ */
  var GEN = {
    kilat: genKilat, aljabar: genAljabar, geometri: genGeometri,
    pecahan: genPecahan, pola: genPola, cerita: genCerita
  };
  var ALL = ['kilat', 'aljabar', 'geometri', 'pecahan', 'pola', 'cerita'];

  function one(topicId, d) {
    var id = topicId === 'campuran' ? pick(ALL) : topicId;
    var fn = GEN[id] || genKilat;
    var raw = fn(Math.min(3, Math.max(1, d | 0)));
    return finalize(id, raw);
  }

  /* Sekumpulan soal tanpa pengulangan teks. */
  function pack(count, topicId, d) {
    var out = [], seen = {}, guard = 0;
    while (out.length < count && guard++ < count * 40) {
      var q = one(topicId, d);
      if (seen[q.text]) continue;
      seen[q.text] = 1;
      out.push(q);
    }
    while (out.length < count) out.push(one(topicId, d));
    return out;
  }

  /* Satu set soal yang bisa diulang. Tanpa `semai`, hasilnya acak seperti
     dulu; dengan `semai`, dua perangkat mendapat sepuluh soal identik.
     Keadaan acaknya selalu dikembalikan ke Math.random setelah selesai,
     supaya set bersemai tidak diam-diam menentukan set berikutnya. */
  function packSemai(n, topic, level, semai) {
    if (semai == null) return pack(n, topic, level);
    semaikan(semai);
    try { return pack(n, topic, level); }
    finally { bebaskan(); }
  }

  global.COC_Q = {
    one: one, pack: pack, packSemai: packSemai, fmt: fmt, cocok: cocok,
    ri: ri, pick: pick, shuffle: shuffle
  };
})(window);
