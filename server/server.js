/* ============================================================
   server.js — API kelas untuk COC.

   Disajikan pada origin yang sama dengan situsnya (Traefik meneruskan
   /api ke sini), jadi tidak ada CORS dan cookie sesi cukup SameSite=Lax.

   Dua jenis sesi:
   - siswa : kode kelas + nama + PIN 4 angka. Cepat, karena dipakai anak
             di lab komputer yang bergantian tiap 40 menit.
   - guru  : satu frasa sandi, hash scrypt-nya ada di env. Tidak ada
             pendaftaran guru lewat jaringan sama sekali.
   ============================================================ */
'use strict';

const http = require('node:http');
const crypto = require('node:crypto');
const DB = require('./db');
const LIVE = require('./live');

const PORT = Number(process.env.PORT) || 8080;
const COOKIE_SISWA = 'coc_siswa';
const COOKIE_GURU = 'coc_guru';

/* Sesi singkat itu default: di lab komputer bersama, cookie yang awet
   berarti siswa berikutnya membuka aplikasi dan langsung jadi orang lain.
   "Ingat saya" hanya dipakai kalau siswa menyatakan ini perangkat sendiri. */
const HARI_SINGKAT = 1;
const HARI_INGAT = 120;
const HARI_GURU = 7;

/* ── Frasa sandi guru ────────────────────────────────────────
   Formatnya `salt:hash` heksadesimal, dibuat oleh hash-passphrase.js.
   Tanpa env ini, seluruh jalur /api/guru menolak — bukan terbuka. */
const SANDI_GURU = process.env.SANDI_GURU_SCRYPT || '';

function sandiGuruOk(input) {
  if (!SANDI_GURU) return false;
  const [saltHex, hashHex] = SANDI_GURU.split(':');
  if (!saltHex || !hashHex) return false;
  let expected, actual;
  try {
    expected = Buffer.from(hashHex, 'hex');
    actual = crypto.scryptSync(String(input || ''), Buffer.from(saltHex, 'hex'), expected.length);
  } catch (e) { return false; }
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

/* ── Pembatasan laju ─────────────────────────────────────────
   PIN empat angka hanya aman kalau menebaknya mahal. Hitungannya per IP
   dan per kunci logis, dengan jendela geser sederhana di memori — cukup
   untuk satu instans, dan hilang saat restart (yang juga berarti tidak
   mengunci siapa pun selamanya). */
const gagal = new Map();

function ipKlien(req) {
  const f = req.headers['x-forwarded-for'];
  if (f) return String(f).split(',')[0].trim();
  return req.socket.remoteAddress || '?';
}

function terkunci(kunci, batas, menit) {
  const e = gagal.get(kunci);
  if (!e) return false;
  if (Date.now() - e.sejak > menit * 60000) { gagal.delete(kunci); return false; }
  return e.n >= batas;
}

function catatGagal(kunci, menit) {
  const e = gagal.get(kunci);
  if (!e || Date.now() - e.sejak > menit * 60000) gagal.set(kunci, { n: 1, sejak: Date.now() });
  else e.n += 1;
}

function bersihGagal(kunci) { gagal.delete(kunci); }

/* ── Bantu HTTP ──────────────────────────────────────────────*/
function kirim(res, status, obj, headers = {}) {
  const body = JSON.stringify(obj == null ? {} : obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    ...headers
  });
  res.end(body);
}

/* 256 KB cukup untuk profil terbesar (riwayat dibatasi 40 pertandingan di
   client) dan menutup upaya menghabiskan memori lewat badan permintaan.

   Setelah batas terlampaui, potongan berikutnya dibuang tetapi aliran tetap
   dibiarkan mengalir sampai habis. Memutus soket di sini terasa lebih tegas,
   tapi akibatnya balasan 413 ikut hilang dan client cuma melihat koneksi
   putus tanpa tahu sebabnya. Ada batas kedua yang jauh lebih longgar untuk
   menghentikan aliran yang benar-benar tidak ada habisnya. */
function bacaBody(req) {
  return new Promise((resolve, reject) => {
    let n = 0;
    let kelebihan = false;
    const potong = [];
    req.on('data', (c) => {
      n += c.length;
      if (n > 262144) {
        if (!kelebihan) { kelebihan = true; reject(new Error('terlalu besar')); }
        if (n > 4194304) req.destroy();
        return;
      }
      potong.push(c);
    });
    req.on('end', () => {
      if (kelebihan) return;
      if (!potong.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(potong).toString('utf8'))); }
      catch (e) { reject(new Error('json tidak sah')); }
    });
    req.on('error', (e) => { if (!kelebihan) reject(e); });
  });
}

function cookie(req, nama) {
  const raw = req.headers.cookie;
  if (!raw) return null;
  for (const bagian of raw.split(';')) {
    const i = bagian.indexOf('=');
    if (i < 0) continue;
    if (bagian.slice(0, i).trim() === nama) return decodeURIComponent(bagian.slice(i + 1).trim());
  }
  return null;
}

function setCookie(nama, token, hari) {
  const umur = Math.round(hari * 86400);
  return `${nama}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${umur}`;
}

const hapusCookie = (nama) => `${nama}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

/* ── Penjaga sesi ────────────────────────────────────────────*/
function sesiSiswa(req) {
  const s = DB.sesi(cookie(req, COOKIE_SISWA));
  if (!s || s.kind !== 'siswa' || !s.student_id) return null;
  const siswa = DB.siswa(s.student_id);
  return siswa ? { sesi: s, siswa } : null;
}

function sesiGuru(req) {
  const s = DB.sesi(cookie(req, COOKIE_GURU));
  return s && s.kind === 'guru' ? s : null;
}

function bentukAku(siswa) {
  const kelas = DB.kelas(siswa.class_id);
  return {
    id: siswa.id, nama: siswa.name, ava: siswa.ava,
    kelas: kelas ? { id: kelas.id, nama: kelas.name, kode: kelas.code } : null
  };
}

/* ── Perutean ────────────────────────────────────────────────*/
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const jalur = url.pathname.replace(/\/+$/, '') || '/';
  const M = req.method;
  const ip = ipKlien(req);

  try {
    if (jalur === '/api/sehat') return kirim(res, 200, { ok: true, guru: !!SANDI_GURU });

    /* ---------- Masuk siswa ---------- */

    // Daftar nama di kelas. Sengaja tidak butuh sesi: siswa harus bisa
    // melihat namanya sebelum masuk. Yang dibocorkan hanya nama panggilan
    // dan avatar, dan itu pun cuma bagi yang tahu kode kelasnya.
    if (jalur === '/api/kelas/cek' && M === 'POST') {
      if (terkunci('kode:' + ip, 20, 10)) return kirim(res, 429, { error: 'Terlalu banyak percobaan. Tunggu sebentar.' });
      const b = await bacaBody(req);
      const kelas = DB.kelasByKode(b.kode);
      if (!kelas) { catatGagal('kode:' + ip, 10); return kirim(res, 404, { error: 'Kode kelas tidak ditemukan.' }); }
      bersihGagal('kode:' + ip);
      return kirim(res, 200, {
        kelas: { nama: kelas.name, kode: kelas.code },
        siswa: DB.siswaDiKelas(kelas.id).map((s) => ({ nama: s.name, ava: s.ava, sudahPin: !!s.pin_hash }))
      });
    }

    if (jalur === '/api/masuk' && M === 'POST') {
      const b = await bacaBody(req);
      const kelas = DB.kelasByKode(b.kode);
      if (!kelas) return kirim(res, 404, { error: 'Kode kelas tidak ditemukan.' });

      const siswa = DB.cariSiswa(kelas.id, b.nama);
      if (!siswa) return kirim(res, 404, { error: 'Namamu tidak ada di daftar kelas ini. Tanya gurumu.' });

      const kunci = `pin:${siswa.id}`;
      if (terkunci(kunci, 8, 15)) {
        return kirim(res, 429, { error: 'PIN salah terlalu sering. Coba lagi 15 menit lagi, atau minta gurumu mereset PIN-mu.' });
      }

      const pin = String(b.pin || '');
      if (!/^\d{4}$/.test(pin)) return kirim(res, 400, { error: 'PIN harus 4 angka.' });

      if (!siswa.pin_hash) {
        // Login pertama sekaligus menetapkan PIN. Siapa pun yang tahu kode
        // kelas bisa mengklaim nama yang belum pernah dipakai — itu risiko
        // yang diterima; gurunya bisa mereset PIN lewat dasbor.
        DB.setPin(siswa.id, pin);
      } else if (!DB.pinOk(pin, siswa.pin_hash)) {
        catatGagal(kunci, 15);
        return kirim(res, 401, { error: 'PIN salah.' });
      }
      bersihGagal(kunci);

      if (b.ava) DB.setAva(siswa.id, b.ava);
      DB.tandaiAktif(siswa.id);

      const hari = b.ingat ? HARI_INGAT : HARI_SINGKAT;
      const { token } = DB.buatSesi('siswa', siswa.id, req.headers['user-agent'], hari);
      const segar = DB.siswa(siswa.id);
      return kirim(res, 200,
        { aku: bentukAku(segar), profil: DB.profil(siswa.id) },
        { 'Set-Cookie': setCookie(COOKIE_SISWA, token, hari) });
    }

    if (jalur === '/api/keluar' && M === 'POST') {
      DB.hapusSesi(cookie(req, COOKIE_SISWA));
      return kirim(res, 200, { ok: true }, { 'Set-Cookie': hapusCookie(COOKIE_SISWA) });
    }

    /* ---------- Guru: masuk ---------- */
    if (jalur === '/api/guru/masuk' && M === 'POST') {
      if (terkunci('guru:' + ip, 6, 20)) return kirim(res, 429, { error: 'Terlalu banyak percobaan. Tunggu 20 menit.' });
      const b = await bacaBody(req);
      if (!SANDI_GURU) return kirim(res, 503, { error: 'Frasa sandi guru belum dipasang di server.' });
      if (!sandiGuruOk(b.sandi)) { catatGagal('guru:' + ip, 20); return kirim(res, 401, { error: 'Frasa sandi salah.' }); }
      bersihGagal('guru:' + ip);
      const { token } = DB.buatSesi('guru', null, req.headers['user-agent'], HARI_GURU);
      return kirim(res, 200, { ok: true }, { 'Set-Cookie': setCookie(COOKIE_GURU, token, HARI_GURU) });
    }

    if (jalur === '/api/guru/keluar' && M === 'POST') {
      DB.hapusSesi(cookie(req, COOKIE_GURU));
      return kirim(res, 200, { ok: true }, { 'Set-Cookie': hapusCookie(COOKIE_GURU) });
    }

    /* ---------- Jalur guru (butuh sesi guru) ---------- */
    if (jalur.startsWith('/api/guru/')) {
      if (!sesiGuru(req)) return kirim(res, 401, { error: 'Perlu masuk sebagai guru.' });

      // Aliran peristiwa untuk dasbor: peserta bergabung, papan berubah.
      // Ditangani sebelum apa pun yang memakai kirim(), karena SSE tidak
      // boleh punya Content-Length.
      if (jalur === '/api/guru/live' && M === 'GET') {
        LIVE.pasangAliran(LIVE.kGuru(), res);
        return;
      }

      if (jalur === '/api/guru/kelas' && M === 'GET') {
        return kirim(res, 200, { kelas: DB.daftarKelas() });
      }
      if (jalur === '/api/guru/kelas' && M === 'POST') {
        const b = await bacaBody(req);
        const nama = String(b.nama || '').trim().slice(0, 40);
        if (!nama) return kirim(res, 400, { error: 'Nama kelas kosong.' });
        return kirim(res, 200, { kelas: DB.buatKelas(nama) });
      }

      let m;
      if ((m = jalur.match(/^\/api\/guru\/kelas\/(\d+)$/))) {
        const id = Number(m[1]);
        if (!DB.kelas(id)) return kirim(res, 404, { error: 'Kelas tidak ada.' });
        if (M === 'GET') {
          const k = DB.kelas(id);
          return kirim(res, 200, { kelas: k, ...DB.ringkasKelas(id), tugas: DB.tugasKelas(id) });
        }
        if (M === 'PATCH') {
          const b = await bacaBody(req);
          const k = DB.kelas(id);
          return kirim(res, 200, { kelas: DB.ubahKelas(id, String(b.nama || k.name).trim().slice(0, 40), b.arsip) });
        }
        if (M === 'DELETE') { DB.hapusKelas(id); return kirim(res, 200, { ok: true }); }
      }

      if ((m = jalur.match(/^\/api\/guru\/kelas\/(\d+)\/siswa$/)) && M === 'POST') {
        const id = Number(m[1]);
        if (!DB.kelas(id)) return kirim(res, 404, { error: 'Kelas tidak ada.' });
        const b = await bacaBody(req);
        // Guru menempel satu daftar nama dari absen; satu nama per baris.
        const nama = String(b.daftar || b.nama || '').split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
        if (!nama.length) return kirim(res, 400, { error: 'Tidak ada nama.' });
        if (nama.length > 60) return kirim(res, 400, { error: 'Maksimal 60 nama sekali tambah.' });
        const hasil = nama.map((n) => ({ nama: n, ok: !!DB.tambahSiswa(id, n) }));
        return kirim(res, 200, { hasil, siswa: DB.siswaDiKelas(id) });
      }

      if ((m = jalur.match(/^\/api\/guru\/siswa\/(\d+)$/)) && M === 'DELETE') {
        DB.hapusSiswa(Number(m[1]));
        return kirim(res, 200, { ok: true });
      }
      if ((m = jalur.match(/^\/api\/guru\/siswa\/(\d+)\/reset-pin$/)) && M === 'POST') {
        DB.resetPin(Number(m[1]));
        return kirim(res, 200, { ok: true });
      }

      if ((m = jalur.match(/^\/api\/guru\/kelas\/(\d+)\/tugas$/)) && M === 'POST') {
        const id = Number(m[1]);
        if (!DB.kelas(id)) return kirim(res, 404, { error: 'Kelas tidak ada.' });
        const b = await bacaBody(req);
        if (!b.topic) return kirim(res, 400, { error: 'Topik belum dipilih.' });
        return kirim(res, 200, { tugas: DB.buatTugas(id, b) });
      }
      /* ---- Sesi kelas serentak ---- */
      if ((m = jalur.match(/^\/api\/guru\/kelas\/(\d+)\/sesi$/))) {
        const id = Number(m[1]);
        if (!DB.kelas(id)) return kirim(res, 404, { error: 'Kelas tidak ada.' });
        if (M === 'GET') return kirim(res, 200, LIVE.keadaanSesi(id) || { sesi: null });
        if (M === 'POST') {
          const b = await bacaBody(req);
          const idSekelas = DB.siswaDiKelas(id).map((x) => x.id);
          const r = LIVE.buatSesi(id, b, idSekelas);
          return kirim(res, r.error ? 409 : 200, r);
        }
        if (M === 'DELETE') return kirim(res, 200, LIVE.akhiriSesi(id));
      }
      if ((m = jalur.match(/^\/api\/guru\/kelas\/(\d+)\/sesi\/(mulai|lanjut)$/)) && M === 'POST') {
        const id = Number(m[1]);
        if (m[2] === 'mulai') {
          const r = LIVE.mulaiSesi(id);
          return kirim(res, r.error ? 409 : 200, r);
        }
        LIVE.majuSesi(id);
        return kirim(res, 200, LIVE.keadaanSesi(id) || {});
      }

      if ((m = jalur.match(/^\/api\/guru\/tugas\/(\d+)$/)) && M === 'DELETE') {
        DB.hapusTugas(Number(m[1]));
        return kirim(res, 200, { ok: true });
      }
      if ((m = jalur.match(/^\/api\/guru\/tugas\/(\d+)\/rekap$/)) && M === 'GET') {
        const t = DB.db.prepare('SELECT * FROM assignments WHERE id = ?').get(Number(m[1]));
        if (!t) return kirim(res, 404, { error: 'Tugas tidak ada.' });
        return kirim(res, 200, { tugas: t, rekap: DB.rekapTugas(t.class_id, t.id) });
      }

      return kirim(res, 404, { error: 'Rute guru tidak dikenal.' });
    }

    /* ---------- Jalur siswa (butuh sesi siswa) ---------- */
    const sesi = sesiSiswa(req);
    if (!sesi) return kirim(res, 401, { error: 'Belum masuk.' });
    const { siswa } = sesi;

    /* Aliran peristiwa langsung. Harus sebelum rute lain yang memakai
       kirim(), karena SSE menulis kepalanya sendiri dan tidak boleh
       membawa Content-Length. */
    if (jalur === '/api/live' && M === 'GET') {
      LIVE.pasangAliran(LIVE.kSiswa(siswa.id), res);
      DB.tandaiAktif(siswa.id);
      return;
    }

    /* ---- Duel langsung ---- */
    if (jalur === '/api/duel/antre' && M === 'POST') {
      const b = await bacaBody(req);
      const r = LIVE.antre(siswa, String(b.topik || 'campuran'), Number(b.tingkat) || 2, Number(b.jumlah) || 10);
      const sekelas = DB.siswaDiKelas(siswa.class_id).map((x) => x.id);
      return kirim(res, 200, Object.assign(r, {
        online: LIVE.onlineSekelas(siswa.class_id, sekelas, siswa.id)
      }));
    }
    if (jalur === '/api/duel/batal' && M === 'POST') {
      LIVE.batalAntre(siswa.id);
      return kirim(res, 200, { ok: true });
    }
    if (jalur === '/api/duel/jawab' && M === 'POST') {
      const b = await bacaBody(req);
      const r = LIVE.jawabDuel(siswa.id, b);
      return kirim(res, r.error ? 409 : 200, r);
    }
    if (jalur === '/api/duel/selesai' && M === 'POST') {
      const b = await bacaBody(req);
      const r = LIVE.selesaiDuel(siswa.id, b);
      return kirim(res, r.error ? 409 : 200, r);
    }
    if (jalur === '/api/duel/keluar' && M === 'POST') {
      LIVE.keluarDuel(siswa.id);
      return kirim(res, 200, { ok: true });
    }

    /* ---- Sesi kelas ---- */
    if (jalur === '/api/sesi' && M === 'GET') {
      return kirim(res, 200, LIVE.keadaanSesi(siswa.class_id) || { sesi: null });
    }
    if (jalur === '/api/sesi/gabung' && M === 'POST') {
      const r = LIVE.gabungSesi(siswa);
      return kirim(res, r.error ? 409 : 200, r);
    }
    if (jalur === '/api/sesi/jawab' && M === 'POST') {
      const b = await bacaBody(req);
      const r = LIVE.jawabSesi(siswa.id, siswa.class_id, b);
      return kirim(res, r.error ? 409 : 200, r);
    }

    if (jalur === '/api/aku' && M === 'GET') {
      DB.tandaiAktif(siswa.id);
      return kirim(res, 200, { aku: bentukAku(siswa), profil: DB.profil(siswa.id) });
    }

    /* POST diterima selain PUT khusus untuk navigator.sendBeacon, yang
       dipakai client saat halaman ditutup dan hanya bisa mengirim POST. */
    if (jalur === '/api/profil' && (M === 'PUT' || M === 'POST')) {
      const b = await bacaBody(req);
      if (!b.data || typeof b.data !== 'object') return kirim(res, 400, { error: 'Profil kosong.' });
      if (b.data.ava) DB.setAva(siswa.id, b.data.ava);
      const r = DB.simpanProfil(siswa.id, b.data, b.versi);
      if (r.bentrok) return kirim(res, 409, { bentrok: true, versi: r.versi, profil: DB.profil(siswa.id) });
      return kirim(res, 200, { versi: r.versi });
    }

    if (jalur === '/api/pertandingan' && M === 'POST') {
      const b = await bacaBody(req);
      DB.catatMain(siswa.id, b);
      DB.tandaiAktif(siswa.id);
      return kirim(res, 200, { ok: true });
    }

    if (jalur === '/api/peringkat' && M === 'GET') {
      const rows = DB.peringkatKelas(siswa.class_id)
        .map((r) => ({ nama: r.name, ava: r.ava, xp: r.xp, main: r.main, aku: r.id === siswa.id }));
      return kirim(res, 200, { peringkat: rows });
    }

    if (jalur === '/api/tugas' && M === 'GET') {
      return kirim(res, 200, { tugas: DB.progresTugas(siswa.class_id, siswa.id) });
    }

    return kirim(res, 404, { error: 'Rute tidak dikenal.' });
  } catch (e) {
    const pesan = String(e && e.message || e);
    if (pesan === 'terlalu besar') return kirim(res, 413, { error: 'Data terlalu besar.' });
    if (pesan === 'json tidak sah') return kirim(res, 400, { error: 'Format tidak sah.' });
    console.error('[coc-api]', pesan);
    return kirim(res, 500, { error: 'Gangguan di server.' });
  }
});

setInterval(() => { try { DB.sapuSesi(); } catch (e) { /* abaikan */ } }, 3600000).unref();

server.listen(PORT, () => {
  console.log(`[coc-api] siap di :${PORT}` + (SANDI_GURU ? '' : ' — PERINGATAN: SANDI_GURU_SCRYPT belum dipasang, dasbor guru terkunci'));
});
