/* ============================================================
   live.js — sesi kelas serentak.

   Semua keadaan di sini hidup di memori, bukan SQLite. Satu sesi kelas
   berumur satu jam pelajaran; menuliskannya ke basis data hanya menambah
   rumit tanpa memberi apa pun. Kalau server dijalankan ulang di tengah
   sesi, sesinya hilang — dan itu memang akibat yang benar. Hasil akhir
   yang perlu awet tetap lewat jalur /api/pertandingan yang sudah ada.

   Arah datanya dua macam:
   - client -> server lewat POST biasa (bergabung, mengirim jawaban)
   - server -> client lewat SSE, satu aliran per orang

   SSE dipilih, bukan WebSocket, karena Node tidak punya server WebSocket
   bawaan — memakainya berarti menambah dependensi npm pertama di proyek
   ini, atau menulis sendiri kerangka RFC 6455. Semua yang perlu didorong
   ke siswa searah saja, dan EventSource menyambung ulang sendiri saat
   wifi sekolah putus sebentar. Itu persis yang dibutuhkan.
   ============================================================ */
'use strict';

const crypto = require('node:crypto');

/* Skor tertinggi satu rantai menurut rumus di app.js:
   1.000 (terpecahkan) + 250 × 3 nyawa yang masih utuh. Dipakai untuk
   menolak angka mengada-ada yang dikirim dari peramban. */
const MAKS_POIN_SOAL = 1750;

const DETAK_MS = 25000;        // denyut SSE, menahan proxy memutus koneksi diam
const JEDA_SOAL_MS = 3500;     // waktu melihat papan di antara soal sesi kelas

const sekarang = () => Date.now();
const idBaru = () => crypto.randomBytes(8).toString('hex');
const semaiBaru = () => crypto.randomBytes(8).toString('hex');

/* ── Aliran SSE ──────────────────────────────────────────────
   Satu orang boleh punya lebih dari satu aliran: tab ganda, atau tab lama
   yang belum sempat ditutup saat yang baru menyambung. Karena itu tiap
   kunci memegang himpunan koneksi, bukan satu koneksi. */
const aliran = new Map();

const kSiswa = (id) => 'siswa:' + id;
const kGuru = () => 'guru';

function pasangAliran(kunci, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.write('retry: 3000\n\n');

  const detak = setInterval(() => {
    try { res.write(': detak\n\n'); } catch (e) { /* akan dibersihkan on close */ }
  }, DETAK_MS);
  detak.unref();

  const set = aliran.get(kunci) || new Set();
  set.add(res);
  aliran.set(kunci, set);

  const bersihkan = () => {
    clearInterval(detak);
    const s = aliran.get(kunci);
    if (s) { s.delete(res); if (!s.size) aliran.delete(kunci); }
  };
  res.on('close', bersihkan);
  res.on('error', bersihkan);
  return bersihkan;
}

function kirim(kunci, jenis, data) {
  const set = aliran.get(kunci);
  if (!set || !set.size) return false;
  const paket = `event: ${jenis}\ndata: ${JSON.stringify(data == null ? {} : data)}\n\n`;
  for (const res of set) {
    try { res.write(paket); } catch (e) { /* koneksi mati, on close membersihkan */ }
  }
  return true;
}

const kirimSiswa = (id, jenis, data) => kirim(kSiswa(id), jenis, data);
const tersambung = (id) => aliran.has(kSiswa(id));

/* ── Sesi kelas serentak ─────────────────────────────────────
   Satu kelas hanya boleh punya satu sesi hidup: dua sesi bersamaan di
   kelas yang sama membuat siswa tidak tahu harus ikut yang mana.

   Waktunya dijalankan server, bukan masing-masing peramban. Itu intinya:
   yang membuat sesi ini terasa satu kelas adalah semua orang melihat soal
   yang sama pada detik yang sama, dan jam di tiap perangkat tidak pernah
   cukup seragam untuk itu. */
const sesiKelas = new Map();   // classId -> sesi

function ringkasSesi(s) {
  return {
    id: s.id, topik: s.topic, tingkat: s.level, jumlah: s.jumlah,
    tahap: s.tahap, soalKe: s.soalKe, batasMs: s.batasMs,
    peserta: s.peserta.size, semai: s.tahap === 'menunggu' ? null : s.semai
  };
}

function papanSesi(s) {
  return Array.from(s.peserta.values())
    .map((p) => ({ nama: p.nama, ava: p.ava, skor: p.skor, benar: p.benar }))
    .sort((a, b) => b.skor - a.skor || a.nama.localeCompare(b.nama, 'id', { numeric: true }));
}

function siarSesi(s, jenis, data) {
  for (const id of s.peserta.keys()) kirimSiswa(id, jenis, data);
  kirim(kGuru(), jenis, Object.assign({ kelas: s.classId }, data));
}

/* Diberitahukan ke seluruh kelas, bukan hanya yang sudah gabung — inilah
   yang membuat siswa tahu ada sesi untuk diikuti. */
function siarKelas(s, daftarIdSekelas, jenis, data) {
  for (const id of daftarIdSekelas) kirimSiswa(id, jenis, data);
  kirim(kGuru(), jenis, Object.assign({ kelas: s.classId }, data));
}

function buatSesi(classId, opsi, daftarIdSekelas) {
  const lama = sesiKelas.get(classId);
  if (lama && lama.tahap !== 'usai') return { error: 'Masih ada sesi berjalan di kelas ini. Akhiri dulu.' };

  const s = {
    id: idBaru(),
    classId,
    /* Topik sudah tidak ada sejak soal berbentuk rantai operasi. Medannya
       ditinggal supaya bentuk pesan sesi tidak berubah bagi peramban yang
       belum sempat memuat ulang. */
    topic: 'rantai',
    level: Number(opsi.level) || 2,
    jumlah: Math.max(3, Math.min(Number(opsi.jumlah) || 3, 20)),
    batasMs: Math.max(15000, Math.min(Number(opsi.batasMs) || 90000, 300000)),
    semai: semaiBaru(),
    tahap: 'menunggu',
    soalKe: -1,
    peserta: new Map(),
    jam: null
  };
  sesiKelas.set(classId, s);
  siarKelas(s, daftarIdSekelas || [], 'sesi-ada', ringkasSesi(s));
  return { sesi: ringkasSesi(s) };
}

function gabungSesi(siswa) {
  const s = sesiKelas.get(siswa.class_id);
  if (!s || s.tahap === 'usai') return { error: 'Tidak ada sesi yang sedang berjalan.' };
  if (!s.peserta.has(siswa.id)) {
    s.peserta.set(siswa.id, {
      id: siswa.id, nama: siswa.name, ava: siswa.ava,
      skor: 0, benar: 0, jawabKe: -1
    });
  }
  kirim(kGuru(), 'sesi-peserta', { kelas: s.classId, peserta: s.peserta.size, papan: papanSesi(s) });
  return { sesi: ringkasSesi(s), papan: papanSesi(s) };
}

function mulaiSesi(classId) {
  const s = sesiKelas.get(classId);
  if (!s) return { error: 'Tidak ada sesi.' };
  if (s.tahap !== 'menunggu') return { error: 'Sesi sudah dimulai.' };
  if (!s.peserta.size) return { error: 'Belum ada siswa yang gabung.' };
  s.tahap = 'jalan';
  siarSesi(s, 'sesi-mulai', ringkasSesi(s));
  majuSesi(classId);
  return { sesi: ringkasSesi(s) };
}

function majuSesi(classId) {
  const s = sesiKelas.get(classId);
  if (!s || s.tahap !== 'jalan') return;
  if (s.jam) { clearTimeout(s.jam); s.jam = null; }

  s.soalKe += 1;
  if (s.soalKe >= s.jumlah) return akhiriSesi(classId);

  siarSesi(s, 'sesi-soal', {
    soalKe: s.soalKe, jumlah: s.jumlah, batasMs: s.batasMs,
    mulaiPada: sekarang()
  });

  s.jam = setTimeout(() => tutupSoal(classId), s.batasMs + 700);
  s.jam.unref && s.jam.unref();
}

/* Tutup soal yang sedang berjalan: tunjukkan papannya, lalu lanjut.
   Dipanggil dua arah — oleh jam yang habis, dan oleh jawaban terakhir
   yang masuk. */
function tutupSoal(classId) {
  const s = sesiKelas.get(classId);
  if (!s || s.tahap !== 'jalan') return;
  if (s.jam) { clearTimeout(s.jam); s.jam = null; }
  siarSesi(s, 'sesi-papan', { soalKe: s.soalKe, papan: papanSesi(s) });
  s.jam = setTimeout(() => majuSesi(classId), JEDA_SOAL_MS);
  s.jam.unref && s.jam.unref();
}

/* Sudahkah semua yang masih tersambung menjawab soal ini?

   Yang terputus sengaja tidak dihitung: ia tidak akan pernah menjawab,
   dan menunggunya berarti satu anak yang menutup tab menahan seluruh
   kelas sampai jamnya habis. */
function semuaSudahJawab(s) {
  let hadir = 0;
  for (const p of s.peserta.values()) {
    if (!tersambung(p.id)) continue;
    hadir += 1;
    if (p.jawabKe !== s.soalKe) return false;
  }
  return hadir > 0;
}

function jawabSesi(studentId, classId, data) {
  const s = sesiKelas.get(classId);
  if (!s || s.tahap !== 'jalan') return { error: 'Sesi tidak berjalan.' };
  const p = s.peserta.get(studentId);
  if (!p) return { error: 'Belum gabung sesi.' };

  const soalKe = Number(data.soalKe);
  if (soalKe !== s.soalKe) return { error: 'Soal sudah lewat.' };
  if (p.jawabKe === soalKe) return { error: 'Sudah menjawab soal ini.' };

  p.jawabKe = soalKe;
  const tambah = Math.max(0, Math.min(Number(data.poin) || 0, MAKS_POIN_SOAL));
  p.skor += tambah;
  if (data.benar) p.benar += 1;

  /* Kalau seluruh kelas sudah menjawab, jangan habiskan sisa jamnya:
     satu rantai diberi waktu semenit setengah karena ada yang perlu
     selama itu, bukan supaya yang sudah selesai duduk menunggu. */
  if (semuaSudahJawab(s)) tutupSoal(classId);

  return { ok: true, skor: p.skor };
}

function akhiriSesi(classId) {
  const s = sesiKelas.get(classId);
  if (!s) return { error: 'Tidak ada sesi.' };
  if (s.jam) { clearTimeout(s.jam); s.jam = null; }
  s.tahap = 'usai';
  siarSesi(s, 'sesi-usai', { papan: papanSesi(s), jumlah: s.jumlah });
  /* Dibiarkan sebentar supaya papan akhirnya masih bisa diambil ulang oleh
     tab yang baru menyambung, lalu dibuang. */
  setTimeout(() => {
    const skrg = sesiKelas.get(classId);
    if (skrg && skrg.id === s.id) sesiKelas.delete(classId);
  }, 300000).unref();
  return { sesi: ringkasSesi(s), papan: papanSesi(s) };
}

function keadaanSesi(classId) {
  const s = sesiKelas.get(classId);
  if (!s) return null;
  return { sesi: ringkasSesi(s), papan: papanSesi(s) };
}

module.exports = {
  pasangAliran, kSiswa, kGuru, kirim, kirimSiswa, tersambung,
  buatSesi, gabungSesi, mulaiSesi, majuSesi, jawabSesi, akhiriSesi, keadaanSesi
};
