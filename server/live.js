/* ============================================================
   live.js — duel langsung dan sesi kelas serentak.

   Semua keadaan di sini hidup di memori, bukan SQLite. Satu duel
   berumur dua menit dan satu sesi kelas satu jam pelajaran; menuliskannya
   ke basis data hanya menambah rumit tanpa memberi apa pun. Kalau server
   dijalankan ulang di tengah duel, duelnya hilang — dan itu memang
   akibat yang benar. Hasil akhir yang perlu awet tetap lewat jalur
   /api/pertandingan yang sudah ada.

   Arah datanya dua macam:
   - client -> server lewat POST biasa (mendaftar antre, mengirim jawaban)
   - server -> client lewat SSE, satu aliran per orang

   SSE dipilih, bukan WebSocket, karena Node tidak punya server WebSocket
   bawaan — memakainya berarti menambah dependensi npm pertama di proyek
   ini, atau menulis sendiri kerangka RFC 6455. Semua yang perlu didorong
   ke siswa searah saja, dan EventSource menyambung ulang sendiri saat
   wifi sekolah putus sebentar. Itu persis yang dibutuhkan.
   ============================================================ */
'use strict';

const crypto = require('node:crypto');

/* Skor tertinggi satu soal menurut rumus di app.js:
   100 (benar) + 100 (bonus waktu penuh) + 100 (bonus runtun tertinggi). */
const MAKS_POIN_SOAL = 300;

const DETAK_MS = 25000;        // denyut SSE, menahan proxy memutus koneksi diam
const SEPI_MS = 45000;         // pemain sediam ini dianggap terputus
const ANTRE_MAKS_MS = 90000;   // berhenti mencari lawan setelah ini
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

/* ── Antrean duel ────────────────────────────────────────────
   Kunci antrean menyertakan kelas: siswa hanya diadu dengan teman
   sekelasnya, bukan dengan seluruh sekolah. Topik dan tingkat ikut,
   karena mengadu soal geometri melawan soal aljabar tidak berarti apa-apa. */
const antrean = new Map();
const antreanSaya = new Map();   // studentId -> kunci antrean

const kunciAntre = (classId, topic, level) => `${classId}|${topic}|${level}`;

/* ── Ruang duel ──────────────────────────────────────────────*/
const ruang = new Map();          // roomId -> ruang
const ruangSaya = new Map();      // studentId -> roomId

function bentukLawan(p) {
  return { nama: p.nama, ava: p.ava };
}

function pasangkan(a, b, topic, level, jumlah) {
  const id = idBaru();
  const r = {
    id,
    topic, level, jumlah,
    semai: semaiBaru(),
    mulai: sekarang(),
    usai: false,
    pemain: {
      [a.id]: { id: a.id, nama: a.nama, ava: a.ava, skor: 0, benar: 0, soalKe: 0, aktif: sekarang(), tuntas: false },
      [b.id]: { id: b.id, nama: b.nama, ava: b.ava, skor: 0, benar: 0, soalKe: 0, aktif: sekarang(), tuntas: false }
    }
  };
  ruang.set(id, r);
  ruangSaya.set(a.id, id);
  ruangSaya.set(b.id, id);

  const bekal = {
    ruang: id, semai: r.semai, topik: topic, tingkat: level, jumlah
  };
  kirimSiswa(a.id, 'duel-mulai', Object.assign({ lawan: bentukLawan(b) }, bekal));
  kirimSiswa(b.id, 'duel-mulai', Object.assign({ lawan: bentukLawan(a) }, bekal));
  return r;
}

/* Masuk antrean. Kalau sudah ada yang menunggu dengan kunci sama, langsung
   dipasangkan; kalau tidak, menunggu sampai ada atau menyerah. */
/* Baris basis data memakai kolom `name`, sedangkan entri antrean memakai
   `nama`. Menyeragamkannya di satu tempat, sebelum masuk ke antrean atau
   ke ruang, mencegah salah satu pemain muncul tanpa nama di layar lawannya. */
function seragamkan(siswa) {
  return { id: siswa.id, nama: siswa.name, ava: siswa.ava, sejak: sekarang() };
}

function antre(siswaRow, topic, level, jumlah) {
  const siswa = seragamkan(siswaRow);
  siswa.class_id = siswaRow.class_id;

  batalAntre(siswa.id);
  if (ruangSaya.has(siswa.id)) return { status: 'sudah-di-ruang', ruang: ruangSaya.get(siswa.id) };

  const kunci = kunciAntre(siswa.class_id, topic, level);
  const baris = antrean.get(kunci) || [];

  /* Buang penunggu yang alirannya sudah putus — mereka menutup tab tanpa
     sempat memberi tahu, dan memasangkan siswa dengan mereka membuat
     duel yang tidak pernah dimulai. */
  while (baris.length) {
    const calon = baris[0];
    if (calon.id === siswa.id || !tersambung(calon.id) || sekarang() - calon.sejak > ANTRE_MAKS_MS) {
      baris.shift();
      antreanSaya.delete(calon.id);
      continue;
    }
    break;
  }

  if (baris.length) {
    const lawan = baris.shift();
    antreanSaya.delete(lawan.id);
    antrean.set(kunci, baris);
    const r = pasangkan(lawan, siswa, topic, level, jumlah);
    return { status: 'cocok', ruang: r.id };
  }

  baris.push({ id: siswa.id, nama: siswa.nama, ava: siswa.ava, sejak: sekarang() });
  antrean.set(kunci, baris);
  antreanSaya.set(siswa.id, kunci);
  return { status: 'antre' };
}

function batalAntre(studentId) {
  const kunci = antreanSaya.get(studentId);
  if (!kunci) return false;
  antreanSaya.delete(studentId);
  const baris = antrean.get(kunci);
  if (baris) {
    const sisa = baris.filter((x) => x.id !== studentId);
    if (sisa.length) antrean.set(kunci, sisa); else antrean.delete(kunci);
  }
  return true;
}

/* Berapa teman sekelas yang sedang online — dipakai layar antre untuk
   memberi tahu siswa apakah menunggu itu ada gunanya. */
function onlineSekelas(classId, daftarIdSekelas, kecuali) {
  let n = 0;
  for (const id of daftarIdSekelas) {
    if (id === kecuali) continue;
    if (tersambung(id)) n += 1;
  }
  return n;
}

function jawabDuel(studentId, data) {
  const roomId = ruangSaya.get(studentId);
  if (!roomId) return { error: 'Tidak sedang bertanding.' };
  const r = ruang.get(roomId);
  if (!r || r.usai) return { error: 'Duel sudah selesai.' };

  const aku = r.pemain[studentId];
  if (!aku) return { error: 'Bukan pemain di ruang ini.' };

  const soalKe = Number(data.soalKe) || 0;
  const skor = Number(data.skor) || 0;

  /* Batas atas yang jelas. Skor dihitung di perangkat siswa, jadi angka
     yang masuk tidak bisa dipercaya sepenuhnya; yang bisa dilakukan server
     tanpa ikut menghitung waktu tiap orang adalah menolak yang mustahil. */
  const maks = Math.min(soalKe + 1, r.jumlah) * MAKS_POIN_SOAL;
  aku.skor = Math.max(0, Math.min(skor, maks));
  aku.benar = Math.max(0, Math.min(Number(data.benar) || 0, r.jumlah));
  aku.soalKe = Math.max(0, Math.min(soalKe, r.jumlah));
  aku.aktif = sekarang();

  for (const id of Object.keys(r.pemain)) {
    if (Number(id) === studentId) continue;
    kirimSiswa(Number(id), 'duel-skor', {
      skor: aku.skor, benar: aku.benar, soalKe: aku.soalKe
    });
  }
  return { ok: true };
}

function selesaiDuel(studentId, data) {
  const roomId = ruangSaya.get(studentId);
  if (!roomId) return { error: 'Tidak sedang bertanding.' };
  const r = ruang.get(roomId);
  if (!r) return { error: 'Ruang tidak ada.' };

  const aku = r.pemain[studentId];
  if (aku) {
    aku.tuntas = true;
    aku.aktif = sekarang();
    if (data && data.skor != null) {
      aku.skor = Math.max(0, Math.min(Number(data.skor) || 0, r.jumlah * MAKS_POIN_SOAL));
    }
    if (data && data.benar != null) aku.benar = Number(data.benar) || 0;
  }

  const semua = Object.values(r.pemain);
  if (semua.every((p) => p.tuntas)) tutupRuang(r, 'tuntas');
  return { ok: true };
}

function tutupRuang(r, alasan) {
  if (r.usai) return;
  r.usai = true;
  const semua = Object.values(r.pemain);
  for (const p of semua) {
    const lawan = semua.find((x) => x.id !== p.id);
    kirimSiswa(p.id, 'duel-usai', {
      alasan,
      skorku: p.skor,
      skorLawan: lawan ? lawan.skor : 0,
      lawan: lawan ? bentukLawan(lawan) : null,
      hasil: !lawan ? 'menang'
        : (p.skor > lawan.skor ? 'menang' : p.skor < lawan.skor ? 'kalah' : 'seri')
    });
    ruangSaya.delete(p.id);
  }
  ruang.delete(r.id);
}

function keluarDuel(studentId) {
  const roomId = ruangSaya.get(studentId);
  if (!roomId) return false;
  const r = ruang.get(roomId);
  if (r) {
    const p = r.pemain[studentId];
    if (p) p.skor = p.skor; // skor terakhir dipertahankan apa adanya
    tutupRuang(r, 'lawan-keluar');
  }
  ruangSaya.delete(studentId);
  return true;
}

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
    topic: String(opsi.topic || 'campuran'),
    level: Number(opsi.level) || 2,
    jumlah: Math.max(3, Math.min(Number(opsi.jumlah) || 10, 20)),
    batasMs: Math.max(6000, Math.min(Number(opsi.batasMs) || 20000, 60000)),
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

  s.jam = setTimeout(() => {
    const skrg = sesiKelas.get(classId);
    if (!skrg || skrg.tahap !== 'jalan') return;
    siarSesi(skrg, 'sesi-papan', { soalKe: skrg.soalKe, papan: papanSesi(skrg) });
    skrg.jam = setTimeout(() => majuSesi(classId), JEDA_SOAL_MS);
    skrg.jam.unref && skrg.jam.unref();
  }, s.batasMs + 700);
  s.jam.unref && s.jam.unref();
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

/* ── Penyapu ─────────────────────────────────────────────────
   Wifi sekolah putus tanpa memberi tahu siapa pun. Tanpa penyapu, lawan
   yang menghilang membuat pemain lain menunggu selamanya di layar duel. */
setInterval(() => {
  const t = sekarang();
  for (const r of Array.from(ruang.values())) {
    if (r.usai) continue;
    const semua = Object.values(r.pemain);
    const hilang = semua.find((p) => t - p.aktif > SEPI_MS && !p.tuntas && !tersambung(p.id));
    if (hilang) tutupRuang(r, 'lawan-terputus');
  }
  for (const [kunci, baris] of Array.from(antrean.entries())) {
    const sisa = baris.filter((x) => tersambung(x.id) && t - x.sejak <= ANTRE_MAKS_MS);
    for (const x of baris) {
      if (!sisa.includes(x)) {
        antreanSaya.delete(x.id);
        kirimSiswa(x.id, 'antre-usai', { alasan: 'sepi' });
      }
    }
    if (sisa.length) antrean.set(kunci, sisa); else antrean.delete(kunci);
  }
}, 5000).unref();

module.exports = {
  pasangAliran, kSiswa, kGuru, kirim, kirimSiswa, tersambung,
  antre, batalAntre, onlineSekelas, jawabDuel, selesaiDuel, keluarDuel,
  buatSesi, gabungSesi, mulaiSesi, majuSesi, jawabSesi, akhiriSesi, keadaanSesi,
  ruangSaya
};
