/* ============================================================
   db.js — seluruh akses SQLite.

   Memakai `node:sqlite` bawaan Node 24, jadi tidak ada modul native dan
   image tidak perlu toolchain build. Satu berkas basis data di /data
   supaya ikut volume container dan gampang di-backup.

   Bentuk datanya sengaja dua lapis:
   - `profiles` menyimpan profil pemain apa adanya sebagai JSON, persis
     bentuk yang sudah dipakai localStorage di client. Ini membuat sinkron
     jadi sepele dan client nyaris tidak berubah.
   - `matches` menyimpan tiap pertandingan secara terurai. Dasbor guru
     butuh agregat per topik ("kelas ini lemah di pecahan"), dan itu tidak
     bisa dijawab dari blob JSON tanpa memindai semua baris.
   ============================================================ */
'use strict';

const { DatabaseSync } = require('node:sqlite');
const crypto = require('node:crypto');

const DB_PATH = process.env.DB_PATH || '/data/coc.db';
const db = new DatabaseSync(DB_PATH);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS classes (
    id         INTEGER PRIMARY KEY,
    code       TEXT    NOT NULL UNIQUE,
    name       TEXT    NOT NULL,
    created_at TEXT    NOT NULL,
    archived   INTEGER NOT NULL DEFAULT 0
  );

  -- Sengaja tidak ada kolom nama lengkap, email, atau NIS. Yang disimpan
  -- hanya nama panggilan yang dipakai di papan peringkat — cukup untuk
  -- guru mengenali siswanya, dan sedikit mungkin data pribadi anak.
  CREATE TABLE IF NOT EXISTS students (
    id         INTEGER PRIMARY KEY,
    class_id   INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    name       TEXT    NOT NULL,
    ava        TEXT    NOT NULL DEFAULT '🦊',
    pin_hash   TEXT,
    created_at TEXT    NOT NULL,
    last_seen  TEXT,
    UNIQUE (class_id, name)
  );

  CREATE TABLE IF NOT EXISTS profiles (
    student_id INTEGER PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
    json       TEXT    NOT NULL,
    xp         INTEGER NOT NULL DEFAULT 0,
    version    INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT    NOT NULL
  );

  CREATE TABLE IF NOT EXISTS matches (
    id         INTEGER PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    ts         TEXT    NOT NULL,
    topic      TEXT    NOT NULL,
    level      INTEGER NOT NULL,
    mode       TEXT    NOT NULL,
    correct    INTEGER NOT NULL,
    total      INTEGER NOT NULL,
    score      INTEGER NOT NULL,
    result     TEXT    NOT NULL,
    ms_avg     INTEGER
  );

  CREATE TABLE IF NOT EXISTS assignments (
    id         INTEGER PRIMARY KEY,
    class_id   INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    topic      TEXT    NOT NULL,
    level      INTEGER NOT NULL,
    target     INTEGER NOT NULL DEFAULT 1,
    due        TEXT,
    note       TEXT,
    created_at TEXT    NOT NULL
  );

  -- Token sesi disimpan ter-hash, supaya berkas basis data yang bocor tidak
  -- langsung memberi akses ke akun siapa pun.
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT    PRIMARY KEY,
    kind       TEXT    NOT NULL,
    student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
    ua         TEXT,
    created_at TEXT    NOT NULL,
    expires_at TEXT    NOT NULL,
    last_seen  TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_matches_siswa  ON matches (student_id, ts);
  CREATE INDEX IF NOT EXISTS idx_students_kelas ON students (class_id);
  CREATE INDEX IF NOT EXISTS idx_assign_kelas   ON assignments (class_id);
`);

const now = () => new Date().toISOString();
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

/* ── PIN siswa ───────────────────────────────────────────────
   PIN empat angka memang ruang tebakannya kecil (10.000). Itu pilihan
   sadar: ini permainan latihan di kelas, dan PIN panjang membuat siswa
   di lab komputer bersama menyerah sebelum masuk. Yang menahan tebakan
   beruntun adalah pembatasan laju di server.js, bukan panjang PIN.
   Scrypt tetap dipakai supaya basis data yang bocor tidak langsung
   memberi PIN semua siswa dalam bentuk terbaca. */
function hashPin(pin) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(String(pin), salt, 32);
  return salt.toString('hex') + ':' + key.toString('hex');
}

function pinOk(pin, stored) {
  if (!stored) return false;
  const [saltHex, keyHex] = String(stored).split(':');
  if (!saltHex || !keyHex) return false;
  let expected, actual;
  try {
    expected = Buffer.from(keyHex, 'hex');
    actual = crypto.scryptSync(String(pin), Buffer.from(saltHex, 'hex'), expected.length);
  } catch (e) { return false; }
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

/* ── Kode kelas ──────────────────────────────────────────────
   Huruf dan angka yang mudah dibedakan saat ditulis di papan tulis:
   tanpa 0/O, 1/I/L, 5/S, 8/B. Enam karakter, dibaca dari crypto. */
const ABJAD = 'ACDEFGHJKMNPQRTUVWXY2346789';

function kodeBaru() {
  for (let coba = 0; coba < 40; coba++) {
    const buf = crypto.randomBytes(6);
    let kode = '';
    for (let i = 0; i < 6; i++) kode += ABJAD[buf[i] % ABJAD.length];
    if (!db.prepare('SELECT 1 FROM classes WHERE code = ?').get(kode)) return kode;
  }
  throw new Error('gagal membuat kode kelas unik');
}

/* ── Kelas ─────────────────────────────────────────────────── */
function buatKelas(nama) {
  const kode = kodeBaru();
  const r = db.prepare('INSERT INTO classes (code, name, created_at) VALUES (?, ?, ?)')
    .run(kode, nama, now());
  return kelas(Number(r.lastInsertRowid));
}

function kelas(id) {
  return db.prepare('SELECT * FROM classes WHERE id = ?').get(id) || null;
}

function kelasByKode(kode) {
  return db.prepare('SELECT * FROM classes WHERE code = ? AND archived = 0')
    .get(String(kode || '').toUpperCase().replace(/[^A-Z0-9]/g, '')) || null;
}

function daftarKelas() {
  return db.prepare(`
    SELECT c.*,
           (SELECT COUNT(*) FROM students s WHERE s.class_id = c.id) AS jml_siswa,
           (SELECT COUNT(*) FROM matches m
              JOIN students s2 ON s2.id = m.student_id
             WHERE s2.class_id = c.id) AS jml_main
      FROM classes c
     ORDER BY c.archived, c.created_at DESC
  `).all();
}

function ubahKelas(id, nama, archived) {
  db.prepare('UPDATE classes SET name = ?, archived = ? WHERE id = ?')
    .run(nama, archived ? 1 : 0, id);
  return kelas(id);
}

function hapusKelas(id) {
  db.prepare('DELETE FROM classes WHERE id = ?').run(id);
}

/* ── Siswa ─────────────────────────────────────────────────── */
function tambahSiswa(classId, nama) {
  const bersih = String(nama).trim().slice(0, 20);
  if (!bersih) return null;
  try {
    const r = db.prepare('INSERT INTO students (class_id, name, created_at) VALUES (?, ?, ?)')
      .run(classId, bersih, now());
    return siswa(Number(r.lastInsertRowid));
  } catch (e) {
    return null; // nama sudah ada di kelas itu — UNIQUE(class_id, name)
  }
}

function siswa(id) {
  return db.prepare('SELECT * FROM students WHERE id = ?').get(id) || null;
}

/* Urutan nama.

   Banyak kelas memakai nomor absen sebagai identitas siswa, dan urutan
   teks biasa menyusunnya jadi 1, 10, 11, ... 2, 20 — kacau persis di
   tempat yang paling sering dilihat: daftar pilih nama dan tabel guru.

   CAST ke INTEGER menyelesaikannya tanpa merusak kelas bernama biasa:
   nama non-angka semuanya jadi 0, lalu diurutkan menurut abjad seperti
   sebelumnya. Kelas campuran menaruh nama lebih dulu, baru nomor. */
const URUT_NAMA = 'CAST(name AS INTEGER), name COLLATE NOCASE';

function siswaDiKelas(classId) {
  return db.prepare(
    'SELECT * FROM students WHERE class_id = ? ORDER BY ' + URUT_NAMA
  ).all(classId);
}

function cariSiswa(classId, nama) {
  return db.prepare('SELECT * FROM students WHERE class_id = ? AND name = ? COLLATE NOCASE')
    .get(classId, String(nama || '').trim()) || null;
}

function setPin(id, pin) {
  db.prepare('UPDATE students SET pin_hash = ? WHERE id = ?').run(hashPin(pin), id);
}

function resetPin(id) {
  db.prepare('UPDATE students SET pin_hash = NULL WHERE id = ?').run(id);
}

function setAva(id, ava) {
  db.prepare('UPDATE students SET ava = ? WHERE id = ?').run(String(ava).slice(0, 8), id);
}

function hapusSiswa(id) {
  db.prepare('DELETE FROM students WHERE id = ?').run(id);
}

function tandaiAktif(id) {
  db.prepare('UPDATE students SET last_seen = ? WHERE id = ?').run(now(), id);
}

/* ── Profil ────────────────────────────────────────────────── */
function profil(studentId) {
  const row = db.prepare('SELECT json, xp, version, updated_at FROM profiles WHERE student_id = ?')
    .get(studentId);
  if (!row) return null;
  try {
    return { data: JSON.parse(row.json), xp: row.xp, version: row.version, updatedAt: row.updated_at };
  } catch (e) {
    return null;
  }
}

/* Client mengirim profil utuh. `version` naik tiap tulis dan dikembalikan
   ke client supaya dua tab di perangkat yang sama tidak saling menimpa
   diam-diam — yang kalah adu versi akan menarik ulang dari server. */
function simpanProfil(studentId, data, versionKlien) {
  const skrg = db.prepare('SELECT version FROM profiles WHERE student_id = ?').get(studentId);
  const versiSkrg = skrg ? skrg.version : 0;
  if (versionKlien != null && Number(versionKlien) < versiSkrg) {
    return { bentrok: true, versi: versiSkrg };
  }
  const xp = Number(data && data.xp) || 0;
  const versi = versiSkrg + 1;
  db.prepare(`
    INSERT INTO profiles (student_id, json, xp, version, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (student_id) DO UPDATE
      SET json = excluded.json, xp = excluded.xp,
          version = excluded.version, updated_at = excluded.updated_at
  `).run(studentId, JSON.stringify(data), xp, versi, now());
  return { bentrok: false, versi };
}

/* ── Pertandingan ──────────────────────────────────────────── */
function catatMain(studentId, m) {
  db.prepare(`
    INSERT INTO matches (student_id, ts, topic, level, mode, correct, total, score, result, ms_avg)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    studentId, now(),
    String(m.topic || 'campuran'), Number(m.level) || 1, String(m.mode || 'latihan'),
    Number(m.correct) || 0, Number(m.total) || 0, Number(m.score) || 0,
    String(m.result || 'draw'), m.msAvg == null ? null : Number(m.msAvg)
  );
}

/* ── Papan peringkat sekelas ───────────────────────────────── */
function peringkatKelas(classId) {
  return db.prepare(`
    SELECT s.id, s.name, s.ava, COALESCE(p.xp, 0) AS xp, s.last_seen,
           (SELECT COUNT(*) FROM matches m WHERE m.student_id = s.id) AS main
      FROM students s
      LEFT JOIN profiles p ON p.student_id = s.id
     WHERE s.class_id = ?
     ORDER BY xp DESC, CAST(s.name AS INTEGER), s.name COLLATE NOCASE
  `).all(classId);
}

/* ── Dasbor guru ───────────────────────────────────────────── */
function ringkasKelas(classId) {
  const siswa = db.prepare(`
    SELECT s.id, s.name, s.ava, s.last_seen,
           (s.pin_hash IS NOT NULL) AS sudah_pin,
           COALESCE(p.xp, 0) AS xp,
           COALESCE(a.main, 0)    AS main,
           COALESCE(a.benar, 0)   AS benar,
           COALESCE(a.soal, 0)    AS soal,
           a.terakhir
      FROM students s
      LEFT JOIN profiles p ON p.student_id = s.id
      LEFT JOIN (
        SELECT student_id,
               COUNT(*)      AS main,
               SUM(correct)  AS benar,
               SUM(total)    AS soal,
               MAX(ts)       AS terakhir
          FROM matches GROUP BY student_id
      ) a ON a.student_id = s.id
     WHERE s.class_id = ?
     ORDER BY xp DESC, CAST(s.name AS INTEGER), s.name COLLATE NOCASE
  `).all(classId);

  /* Agregat per topik: inilah alasan tabel `matches` ada. Guru butuh tahu
     materi mana yang paling banyak salah, bukan sekadar siapa yang rajin. */
  const topik = db.prepare(`
    SELECT m.topic,
           COUNT(*)     AS main,
           SUM(m.correct) AS benar,
           SUM(m.total)   AS soal,
           AVG(m.ms_avg)  AS ms
      FROM matches m
      JOIN students s ON s.id = m.student_id
     WHERE s.class_id = ?
     GROUP BY m.topic
     ORDER BY (CAST(SUM(m.correct) AS REAL) / NULLIF(SUM(m.total), 0)) ASC
  `).all(classId);

  const harian = db.prepare(`
    SELECT substr(m.ts, 1, 10) AS hari, COUNT(*) AS main,
           COUNT(DISTINCT m.student_id) AS siswa
      FROM matches m
      JOIN students s ON s.id = m.student_id
     WHERE s.class_id = ? AND m.ts >= ?
     GROUP BY hari ORDER BY hari
  `).all(classId, new Date(Date.now() - 29 * 864e5).toISOString());

  return { siswa, topik, harian };
}

/* ── Tugas ─────────────────────────────────────────────────── */
function buatTugas(classId, t) {
  const r = db.prepare(`
    INSERT INTO assignments (class_id, topic, level, target, due, note, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    classId, String(t.topic), Number(t.level) || 1, Number(t.target) || 1,
    t.due || null, t.note ? String(t.note).slice(0, 140) : null, now()
  );
  return db.prepare('SELECT * FROM assignments WHERE id = ?').get(Number(r.lastInsertRowid));
}

function hapusTugas(id) {
  db.prepare('DELETE FROM assignments WHERE id = ?').run(id);
}

function tugasKelas(classId) {
  return db.prepare('SELECT * FROM assignments WHERE class_id = ? ORDER BY created_at DESC').all(classId);
}

/* Progres tugas dihitung dari `matches`, bukan disimpan terpisah: hanya
   pertandingan setelah tugas dibuat, dengan topik dan level yang cocok,
   yang dihitung. Jadi tugas tidak bisa "sudah selesai" oleh latihan lama. */
function progresTugas(classId, studentId) {
  return db.prepare(`
    SELECT a.*,
           (SELECT COUNT(*) FROM matches m
             WHERE m.student_id = ? AND m.topic = a.topic
               AND m.level = a.level AND m.ts >= a.created_at) AS selesai
      FROM assignments a
     WHERE a.class_id = ?
     ORDER BY (a.due IS NULL), a.due, a.created_at DESC
  `).all(studentId, classId);
}

function rekapTugas(classId, assignmentId) {
  return db.prepare(`
    SELECT s.id, s.name, s.ava,
           (SELECT COUNT(*) FROM matches m
             WHERE m.student_id = s.id AND m.topic = a.topic
               AND m.level = a.level AND m.ts >= a.created_at) AS selesai,
           a.target
      FROM students s
      CROSS JOIN assignments a
     WHERE s.class_id = ? AND a.id = ?
     ORDER BY selesai DESC, CAST(s.name AS INTEGER), s.name COLLATE NOCASE
  `).all(classId, assignmentId);
}

/* ── Sesi ──────────────────────────────────────────────────── */
function buatSesi(kind, studentId, ua, hari) {
  const token = crypto.randomBytes(32).toString('base64url');
  const exp = new Date(Date.now() + hari * 864e5).toISOString();
  db.prepare(`
    INSERT INTO sessions (token_hash, kind, student_id, ua, created_at, expires_at, last_seen)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(sha256(token), kind, studentId, String(ua || '').slice(0, 200), now(), exp, now());
  return { token, exp };
}

function sesi(token) {
  if (!token) return null;
  const row = db.prepare('SELECT * FROM sessions WHERE token_hash = ?').get(sha256(token));
  if (!row) return null;
  if (row.expires_at < now()) { hapusSesi(token); return null; }
  db.prepare('UPDATE sessions SET last_seen = ? WHERE token_hash = ?').run(now(), row.token_hash);
  return row;
}

function hapusSesi(token) {
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
}

function sapuSesi() {
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now());
}

module.exports = {
  db, now, pinOk, setPin, resetPin,
  buatKelas, kelas, kelasByKode, daftarKelas, ubahKelas, hapusKelas,
  tambahSiswa, siswa, siswaDiKelas, cariSiswa, setAva, hapusSiswa, tandaiAktif,
  profil, simpanProfil, catatMain, peringkatKelas, ringkasKelas,
  buatTugas, hapusTugas, tugasKelas, progresTugas, rekapTugas,
  buatSesi, sesi, hapusSesi, sapuSesi
};
