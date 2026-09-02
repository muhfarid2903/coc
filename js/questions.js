/* ============================================================
   questions.js — pabrik soal matematika
   Setiap generator mengembalikan { text, correct, dis[], explain }
   lalu difinalkan menjadi 4 pilihan yang sudah diacak.
   ============================================================ */
(function (global) {
  'use strict';

  /* ---------- utilitas ---------- */
  function ri(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
  function pick(a) { return a[ri(0, a.length - 1)]; }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
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

  /* Pengecoh numerik di sekitar jawaban benar. */
  function near(correct, count, spread) {
    var out = [], guard = 0;
    spread = Math.max(2, Math.round(spread || Math.abs(correct) * 0.15) || 3);
    while (out.length < count && guard++ < 300) {
      var step = ri(1, spread);
      var v = correct + (Math.random() < 0.5 ? -step : step);
      if (Math.random() < 0.22) v = correct + (Math.random() < 0.5 ? -1 : 1) * ri(spread + 1, spread * 3);
      if (v === correct) continue;
      if (correct >= 0 && v < 0) continue;
      if (out.indexOf(v) !== -1) continue;
      out.push(v);
    }
    var extra = 1;
    while (out.length < count) {
      var f = correct + extra * (correct >= 0 ? 1 : -1) + count;
      if (f !== correct && out.indexOf(f) === -1) out.push(f);
      extra++;
      if (extra > 60) break;
    }
    return out;
  }

  /* Pengecoh uang: dibulatkan ke kelipatan agar tetap terlihat wajar. */
  function nearMoney(correct, count) {
    var mag = Math.pow(10, Math.max(3, String(Math.round(correct)).length - 2));
    var step = Math.max(500, Math.round(correct * 0.08 / mag) * mag || mag);
    var out = [], guard = 0;
    while (out.length < count && guard++ < 200) {
      var v = correct + (Math.random() < 0.5 ? -1 : 1) * ri(1, 4) * step;
      if (v === correct || v <= 0 || out.indexOf(v) !== -1) continue;
      out.push(v);
    }
    var k = 1;
    while (out.length < count && k < 30) {
      var f = correct + k * step;
      if (out.indexOf(f) === -1) out.push(f);
      k++;
    }
    return out;
  }

  /* Bungkus mentahan generator jadi soal siap tampil. */
  function finalize(topic, raw) {
    var unit = raw.unit || '', pre = raw.prefix || '';
    var label = function (v) { return pre + (typeof v === 'number' ? fmt(v) : String(v)) + unit; };
    var right = label(raw.correct);
    var seen = {}; seen[right] = 1;
    var opts = [right];
    for (var i = 0; i < raw.dis.length && opts.length < 4; i++) {
      var s = label(raw.dis[i]);
      if (seen[s]) continue;
      seen[s] = 1; opts.push(s);
    }
    /* Jaring pengaman bila pengecoh bentrok setelah diformat. */
    var bump = 1, frac = /^(-?\d+)\/(\d+)$/.exec(String(raw.correct));
    while (opts.length < 4 && bump < 80) {
      var s2;
      if (typeof raw.correct === 'number') s2 = label(raw.correct + bump);
      else if (frac) s2 = pre + (parseInt(frac[1], 10) + bump) + '/' + frac[2] + unit;
      else s2 = String(raw.correct) + ' \u00b7' + bump;
      if (!seen[s2]) { seen[s2] = 1; opts.push(s2); }
      bump++;
    }
    var order = shuffle(opts.slice());
    return {
      topic: topic,
      text: raw.text,
      long: !!raw.long,
      options: order,
      correct: order.indexOf(right),
      answer: right,
      explain: raw.explain || ''
    };
  }

  /* ============================================================
     1. Hitung Kilat
     ============================================================ */
  function genKilat(d) {
    var a, b, c, v, t, e;
    if (d <= 1) {
      if (Math.random() < 0.5) {
        a = ri(4, 25); b = ri(3, 20); v = a + b;
        t = a + ' + ' + b; e = a + ' + ' + b + ' = ' + v;
      } else {
        a = ri(12, 40); b = ri(3, 11); v = a - b;
        t = a + ' − ' + b; e = a + ' − ' + b + ' = ' + v;
      }
    } else if (d === 2) {
      var r = ri(1, 3);
      if (r === 1) { a = ri(3, 9); b = ri(3, 9); v = a * b; t = a + ' × ' + b; e = 'Perkalian dasar: ' + a + ' × ' + b + ' = ' + v; }
      else if (r === 2) { a = ri(20, 70); b = ri(15, 40); v = a + b; t = a + ' + ' + b; e = a + ' + ' + b + ' = ' + v; }
      else { b = ri(3, 9); v = ri(3, 12); a = b * v; t = a + ' ÷ ' + b; e = a + ' ÷ ' + b + ' = ' + v; }
    } else if (d === 3) {
      var r3 = ri(1, 3);
      if (r3 === 1) { a = ri(6, 14); b = ri(6, 12); v = a * b; t = a + ' × ' + b; e = a + ' × ' + b + ' = ' + v; }
      else if (r3 === 2) { b = ri(4, 12); v = ri(4, 15); a = b * v; t = a + ' ÷ ' + b; e = a + ' ÷ ' + b + ' = ' + v; }
      else { a = ri(3, 9); b = ri(3, 9); c = ri(5, 30); v = a * b + c; t = a + ' × ' + b + ' + ' + c; e = 'Kali dulu: ' + a + ' × ' + b + ' = ' + (a * b) + ', lalu + ' + c + ' = ' + v; }
    } else if (d === 4) {
      var r4 = ri(1, 3);
      if (r4 === 1) { a = ri(11, 25); b = ri(6, 14); v = a * b; t = a + ' × ' + b; e = a + ' × ' + b + ' = ' + v; }
      else if (r4 === 2) { a = ri(4, 12); b = ri(4, 12); c = ri(3, 9); v = (a + b) * c; t = '(' + a + ' + ' + b + ') × ' + c; e = 'Kurung dulu: ' + (a + b) + ', lalu × ' + c + ' = ' + v; }
      else { a = ri(5, 12); v = a * a; t = a + '²'; e = a + ' × ' + a + ' = ' + v; }
    } else {
      var r5 = ri(1, 3);
      if (r5 === 1) { a = ri(6, 12); b = ri(6, 12); c = ri(6, 30); v = a * b - c; t = a + ' × ' + b + ' − ' + c; e = a + ' × ' + b + ' = ' + (a * b) + ', dikurangi ' + c + ' = ' + v; }
      else if (r5 === 2) { a = ri(20, 60); b = ri(3, 9); c = ri(3, 9); v = a + b * c; t = a + ' + ' + b + ' × ' + c; e = 'Perkalian didahulukan: ' + b + ' × ' + c + ' = ' + (b * c) + ', lalu + ' + a + ' = ' + v; }
      else { b = ri(4, 12); v = ri(6, 20); a = b * v; c = ri(3, 15); t = a + ' ÷ ' + b + ' + ' + c; v = v + c; e = a + ' ÷ ' + b + ' = ' + (v - c) + ', lalu + ' + c + ' = ' + v; }
    }
    return { text: t + ' = ?', correct: v, dis: near(v, 3, Math.max(3, Math.round(Math.abs(v) * 0.18))), explain: e };
  }

  /* ============================================================
     2. Duel Aljabar
     ============================================================ */
  function genAljabar(d) {
    var x, a, b, c, dd, t, e;
    if (d <= 1) {
      x = ri(2, 15); a = ri(2, 20); b = x + a;
      t = 'x + ' + a + ' = ' + b; e = 'x = ' + b + ' − ' + a + ' = ' + x;
    } else if (d === 2) {
      x = ri(2, 12); a = ri(2, 9); b = a * x;
      t = a + 'x = ' + b; e = 'x = ' + b + ' ÷ ' + a + ' = ' + x;
    } else if (d === 3) {
      x = ri(2, 12); a = ri(2, 9); b = ri(1, 20); c = a * x + b;
      t = a + 'x + ' + b + ' = ' + c;
      e = a + 'x = ' + c + ' − ' + b + ' = ' + (a * x) + ', jadi x = ' + (a * x) + ' ÷ ' + a + ' = ' + x;
    } else if (d === 4) {
      x = ri(2, 11); a = ri(3, 9); c = ri(1, a - 1); b = ri(1, 18);
      dd = a * x + b - c * x;
      t = a + 'x + ' + b + ' = ' + c + 'x + ' + dd;
      e = 'Pindahkan: ' + (a - c) + 'x = ' + dd + ' − ' + b + ' = ' + ((a - c) * x) + ', jadi x = ' + x;
    } else {
      if (Math.random() < 0.5) {
        x = ri(2, 10); a = ri(2, 7); b = ri(1, 9); c = a * (x + b);
        t = a + '(x + ' + b + ') = ' + c;
        e = 'x + ' + b + ' = ' + c + ' ÷ ' + a + ' = ' + (x + b) + ', jadi x = ' + x;
      } else {
        a = ri(2, 6); b = ri(1, 15);
        x = ri(2, 12) * a;      /* kelipatan a agar x/a bulat */
        c = x / a + b;
        t = 'x/' + a + ' + ' + b + ' = ' + c;
        e = 'x/' + a + ' = ' + c + ' − ' + b + ' = ' + (x / a) + ', jadi x = ' + (x / a) + ' × ' + a + ' = ' + x;
      }
    }
    return { text: t, correct: x, dis: near(x, 3, Math.max(2, Math.round(Math.abs(x) * 0.4) || 3)), explain: e };
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
    }
    if (d >= 3) {
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
    if (d >= 4) {
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
    }
    if (d >= 5) {
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
    raw.dis = near(raw.correct, 3, Math.max(3, Math.round(raw.correct * 0.2)));
    return raw;
  }

  /* ============================================================
     4. Pecahan & Persen
     ============================================================ */
  function genPecahan(d) {
    var a, b, n, p, v, e, txt;
    if (d <= 1) {
      p = pick([10, 20, 25, 50, 75]); n = pick([40, 60, 80, 100, 120, 200]);
      v = n * p / 100;
      return { text: p + '% dari ' + n + ' = ?', correct: v, dis: near(v, 3, Math.max(3, v * 0.3)),
        explain: p + '% × ' + n + ' = ' + fmt(p / 100) + ' × ' + n + ' = ' + v };
    }
    if (d === 2) {
      if (Math.random() < 0.5) {
        b = pick([2, 3, 4, 5]); n = b * ri(4, 20); v = n / b;
        return { text: '1/' + b + ' dari ' + n + ' = ?', correct: v, dis: near(v, 3, Math.max(2, v * 0.4)),
          explain: n + ' ÷ ' + b + ' = ' + v };
      }
      p = pick([15, 30, 40, 60]); n = pick([50, 100, 150, 200, 250]);
      v = n * p / 100;
      return { text: p + '% dari ' + n + ' = ?', correct: v, dis: near(v, 3, Math.max(3, v * 0.3)),
        explain: p + '/100 × ' + n + ' = ' + v };
    }
    if (d === 3) {
      if (Math.random() < 0.5) {
        b = pick([5, 6, 7, 8, 9, 10, 12]); a = ri(1, b - 2);
        var a2 = ri(1, b - a - 1);
        var num = a + a2, den = b, g = gcd(num, den);
        var right = (num / g) + '/' + (den / g);
        var wrong = [ num + '/' + (den * 2), (num + 1) + '/' + den, (num > 1 ? num - 1 : num + 2) + '/' + den ];
        return { text: a + '/' + b + ' + ' + a2 + '/' + b + ' = ?', correct: right, dis: wrong,
          explain: 'Penyebut sama: (' + a + ' + ' + a2 + ')/' + b + ' = ' + num + '/' + den +
            (g > 1 ? ' disederhanakan jadi ' + right : '') };
      }
      var k = ri(2, 9); var s1 = ri(1, 6); var s2 = s1 + ri(1, 5);
      var right2 = s1 + '/' + s2;
      return { text: 'Sederhanakan ' + (s1 * k) + '/' + (s2 * k), correct: right2,
        dis: [ (s1 * k) + '/' + s2, s1 + '/' + (s2 * k), (s1 + 1) + '/' + s2 ],
        explain: 'Bagi pembilang dan penyebut dengan ' + k + ': ' + (s1 * k) + '÷' + k + ' = ' + s1 + ', ' + (s2 * k) + '÷' + k + ' = ' + s2 };
    }
    if (d === 4) {
      if (Math.random() < 0.5) {
        var harga = pick([80, 120, 150, 200, 240, 300, 400]) * 1000;
        var dis1 = pick([10, 15, 20, 25, 30, 40]);
        v = harga - harga * dis1 / 100;
        return { text: 'Harga ' + rupiah(harga) + ' didiskon ' + dis1 + '%. Berapa harga akhirnya?',
          correct: v, prefix: 'Rp', dis: nearMoney(v, 3), long: true,
          explain: 'Potongan = ' + dis1 + '% × ' + rupiah(harga) + ' = ' + rupiah(harga * dis1 / 100) +
            ', sisa ' + rupiah(v) };
      }
      var d1 = pick([2, 3, 4]), d2 = pick([5, 6, 8]);
      var pemb = ri(1, d1 - 1), pemb2 = ri(1, d2 - 1);
      var nu = pemb * d2 + pemb2 * d1, de = d1 * d2, gg = gcd(nu, de);
      var res = (nu / gg) + '/' + (de / gg);
      return { text: pemb + '/' + d1 + ' + ' + pemb2 + '/' + d2 + ' = ?', correct: res,
        dis: [ (pemb + pemb2) + '/' + (d1 + d2), nu + '/' + (de + d1), (nu / gg + 1) + '/' + (de / gg) ],
        explain: 'Samakan penyebut jadi ' + de + ': ' + (pemb * d2) + '/' + de + ' + ' + (pemb2 * d1) + '/' + de +
          ' = ' + nu + '/' + de + (gg > 1 ? ' = ' + res : '') };
    }
    /* d === 5 */
    if (Math.random() < 0.5) {
      var modal = pick([150, 200, 250, 400, 500]) * 1000;
      var untung = pick([12, 15, 20, 25, 30]);
      v = modal + modal * untung / 100;
      return { text: 'Modal ' + rupiah(modal) + ' dijual untung ' + untung + '%. Berapa harga jualnya?',
        correct: v, prefix: 'Rp', dis: nearMoney(v, 3), long: true,
        explain: 'Untung = ' + untung + '% × ' + rupiah(modal) + ' = ' + rupiah(modal * untung / 100) +
          ', harga jual = ' + rupiah(v) };
    }
    var awal = pick([200, 300, 400, 500]) * 1000;
    var pot1 = pick([20, 25, 50]), pot2 = pick([10, 20]);
    var stg = awal * (100 - pot1) / 100;
    v = stg * (100 - pot2) / 100;
    return { text: 'Harga ' + rupiah(awal) + ' didiskon ' + pot1 + '% lalu ' + pot2 + '% lagi. Harga akhir?',
      correct: v, prefix: 'Rp', dis: [ awal * (100 - pot1 - pot2) / 100, stg, awal - awal * pot2 / 100 ], long: true,
      explain: 'Diskon bertingkat dihitung berurutan: ' + rupiah(awal) + ' → ' + rupiah(stg) + ' → ' + rupiah(v) };
  }

  /* ============================================================
     5. Baca Pola
     ============================================================ */
  function genPola(d) {
    var seq = [], v, e, i, a, b, r;
    var kind;
    if (d <= 1) kind = pick(['tambah', 'tambah']);
    else if (d === 2) kind = pick(['tambah', 'kurang', 'kali']);
    else if (d === 3) kind = pick(['kali', 'kuadrat', 'naikbeda']);
    else if (d === 4) kind = pick(['fibo', 'naikbeda', 'kuadrat', 'kali']);
    else kind = pick(['fibo', 'selang', 'naikbeda', 'pangkat']);

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
      dis: near(v, 3, Math.max(2, Math.round(Math.abs(v) * 0.2))),
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
        correct: v, prefix: 'Rp', dis: nearMoney(v, 3),
        explain: q + ' × ' + rupiah(h) + ' = ' + rupiah(v) };
    });
    bank.push(function () {
      var h = pick([12000, 15000, 18000, 25000]), q = ri(2, 6), bayar = pick([100000, 50000, 200000]);
      var total = h * q;
      if (bayar <= total) bayar = Math.ceil(total / 50000) * 50000 + 50000;
      var v = bayar - total;
      return { text: n1 + ' membeli ' + q + ' porsi bakso @ ' + rupiah(h) + ' dan membayar ' + rupiah(bayar) + '. Berapa kembaliannya?',
        correct: v, prefix: 'Rp', dis: nearMoney(v, 3), long: true,
        explain: 'Total = ' + rupiah(total) + '. Kembalian = ' + rupiah(bayar) + ' − ' + rupiah(total) + ' = ' + rupiah(v) };
    });
    bank.push(function () {
      var v0 = pick([40, 50, 60, 72, 80]), t = ri(2, 5), v = v0 * t;
      return { text: 'Sebuah mobil melaju ' + v0 + ' km/jam selama ' + t + ' jam. Berapa jarak yang ditempuh?',
        correct: v, unit: ' km', dis: near(v, 3, Math.round(v * 0.2)),
        explain: 'Jarak = kecepatan × waktu = ' + v0 + ' × ' + t + ' = ' + v + ' km' };
    });
    bank.push(function () {
      var total = ri(4, 12) * ri(3, 9), org = 0, per = 0;
      org = pick([3, 4, 5, 6]); per = ri(4, 15); total = org * per;
      return { text: total + ' permen dibagi rata kepada ' + org + ' anak. Berapa permen tiap anak?',
        correct: per, dis: near(per, 3, Math.max(2, Math.round(per * 0.5))),
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
          correct: v, dis: near(v, 3, 6), long: true,
          explain: 'Jumlah = ' + sum + ', dibagi ' + n + ' = ' + v };
      });
      bank.push(function () {
        var harga = pick([60, 80, 120, 150, 250]) * 1000, disk = pick([10, 20, 25, 50]);
        var v = harga - harga * disk / 100;
        return { text: n1 + ' membeli sepatu ' + rupiah(harga) + ' dengan diskon ' + disk + '%. Berapa yang dibayar?',
          correct: v, prefix: 'Rp', dis: nearMoney(v, 3), long: true,
          explain: 'Diskon = ' + rupiah(harga * disk / 100) + ', bayar = ' + rupiah(v) };
      });
    }
    if (d >= 3) {
      bank.push(function () {
        var umurA = ri(8, 16), selisih = ri(3, 12), thn = ri(2, 8);
        var v = umurA + selisih + thn;
        return { text: 'Umur ' + n1 + ' sekarang ' + umurA + ' tahun. ' + n2 + ' ' + selisih + ' tahun lebih tua. Berapa umur ' + n2 + ' ' + thn + ' tahun lagi?',
          correct: v, unit: ' tahun', dis: near(v, 3, 5), long: true,
          explain: 'Umur ' + n2 + ' sekarang = ' + umurA + ' + ' + selisih + ' = ' + (umurA + selisih) + ', ditambah ' + thn + ' tahun = ' + v };
      });
      bank.push(function () {
        var jarak = pick([120, 180, 240, 300, 360]), kec = pick([40, 60, 90]);
        while (jarak % kec !== 0) jarak = kec * ri(2, 6);
        var v = jarak / kec;
        return { text: 'Jarak ' + jarak + ' km ditempuh dengan kecepatan ' + kec + ' km/jam. Berapa lama perjalanannya?',
          correct: v, unit: ' jam', dis: near(v, 3, Math.max(1, Math.round(v * 0.6))), long: true,
          explain: 'Waktu = jarak ÷ kecepatan = ' + jarak + ' ÷ ' + kec + ' = ' + v + ' jam' };
      });
    }
    if (d >= 4) {
      bank.push(function () {
        var pekerja = ri(3, 8), hari = ri(4, 12), tambah = ri(1, 4);
        var totalKerja = pekerja * hari;
        var baru = pekerja + tambah;
        while (totalKerja % baru !== 0) { hari++; totalKerja = pekerja * hari; }
        var v = totalKerja / baru;
        return { text: 'Sebuah pekerjaan selesai dalam ' + hari + ' hari oleh ' + pekerja + ' orang. Jika dikerjakan ' + baru + ' orang, berapa hari selesainya?',
          correct: v, unit: ' hari', dis: near(v, 3, Math.max(1, Math.round(v * 0.5))), long: true,
          explain: 'Total beban = ' + pekerja + ' × ' + hari + ' = ' + totalKerja + ' hari-orang, dibagi ' + baru + ' orang = ' + v + ' hari' };
      });
      bank.push(function () {
        var modal = pick([250, 400, 600, 800]) * 1000, rugi = pick([10, 15, 20, 25]);
        var v = modal - modal * rugi / 100;
        return { text: 'Barang bermodal ' + rupiah(modal) + ' dijual rugi ' + rugi + '%. Berapa harga jualnya?',
          correct: v, prefix: 'Rp', dis: nearMoney(v, 3), long: true,
          explain: 'Rugi = ' + rupiah(modal * rugi / 100) + ', harga jual = ' + rupiah(v) };
      });
    }
    if (d >= 5) {
      bank.push(function () {
        var a = ri(2, 6), b = ri(3, 9), total = (a + b) * ri(4, 14);
        var v = total * a / (a + b);
        return { text: 'Uang ' + rupiah(total * 1000) + ' dibagi ' + n1 + ' dan ' + n2 + ' dengan perbandingan ' + a + ' : ' + b + '. Berapa bagian ' + n1 + '?',
          correct: v * 1000, prefix: 'Rp', dis: nearMoney(v * 1000, 3), long: true,
          explain: 'Bagian ' + n1 + ' = ' + a + '/' + (a + b) + ' × ' + rupiah(total * 1000) + ' = ' + rupiah(v * 1000) };
      });
      bank.push(function () {
        var tabung = pick([500, 800, 1200]) * 1000, bunga = pick([6, 8, 10, 12]), bulan = pick([6, 9, 12]);
        var v = tabung + tabung * bunga / 100 * bulan / 12;
        return { text: 'Tabungan ' + rupiah(tabung) + ' berbunga ' + bunga + '% per tahun. Berapa saldonya setelah ' + bulan + ' bulan?',
          correct: v, prefix: 'Rp', dis: nearMoney(v, 3), long: true,
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
    var raw = fn(Math.min(5, Math.max(1, d | 0)));
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

  global.COC_Q = { one: one, pack: pack, fmt: fmt, ri: ri, pick: pick, shuffle: shuffle };
})(window);
