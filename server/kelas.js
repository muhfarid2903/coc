#!/usr/bin/env node
/* ============================================================
   kelas.js — pengelola kelas lewat baris perintah.

   Alat ini bicara langsung ke SQLite, bukan lewat HTTP, jadi ia TIDAK
   memerlukan frasa sandi guru. Itu disengaja: menyiapkan kelas di awal
   tahun tidak perlu menunggu dasbor terbuka, dan orang yang membantu
   menyiapkan data tidak perlu dititipi frasa sandi.

   Keamanannya bersandar pada akses ke servernya sendiri — siapa pun yang
   bisa menjalankan perintah ini sudah bisa membaca berkas basis datanya
   langsung.

   Jalankan di dalam container:

     docker exec -i coc-api node kelas.js daftar
     docker exec -i coc-api node kelas.js buat "Kelas 7A"
     docker exec -i coc-api node kelas.js siswa ABC123 < absen-7a.txt
     docker exec -i coc-api node kelas.js lihat ABC123
     docker exec -i coc-api node kelas.js reset-pin ABC123 Raka
     docker exec -i coc-api node kelas.js hapus-siswa ABC123 Raka
   ============================================================ */
'use strict';

const DB = require('./db');

const argv = process.argv.slice(2);
const perintah = argv[0];

function keluar(pesan, kode) {
  console.error(pesan);
  process.exit(kode == null ? 1 : kode);
}

function bantuan() {
  console.log(`
Pengelola kelas COC

  daftar                          tampilkan semua kelas beserta kodenya
  buat "<nama kelas>"             buat kelas baru, cetak kodenya
  lihat <kode>                    tampilkan siswa di satu kelas
  siswa <kode>                    tambah siswa; nama dibaca dari stdin,
                                  satu nama per baris
  ganti-nama <kode> "<lama>" "<baru>"
                                  ganti nama siswa; progres, riwayat, dan
                                  PIN-nya ikut utuh
  reset-pin <kode> "<nama>"       kosongkan PIN satu siswa
  hapus-siswa <kode> "<nama>"     keluarkan siswa beserta seluruh progresnya
  hapus-kelas <kode>              hapus kelas beserta seluruh isinya

Contoh:
  docker exec -i coc-api node kelas.js siswa ABC123 < absen.txt
`.trim());
}

function kelasWajib(kode) {
  const k = DB.kelasByKode(kode);
  if (!k) keluar(`Kelas dengan kode "${kode}" tidak ada. Coba: kelas.js daftar`);
  return k;
}

/* Baca stdin sampai habis. Dipakai untuk daftar nama dari absen. */
function bacaStdin() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) return resolve('');
    let buf = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => { buf += c; });
    process.stdin.on('end', () => resolve(buf));
  });
}

function tabel(baris, kolom) {
  if (!baris.length) return '  (kosong)';
  const lebar = kolom.map((k, i) =>
    Math.max(k.length, ...baris.map((b) => String(b[i]).length)));
  const garis = (sel) => '  ' + sel.map((s, i) =>
    (i === 0 ? String(s).padEnd(lebar[i]) : String(s).padStart(lebar[i]))).join('  ');
  return [garis(kolom), '  ' + lebar.map((w) => '─'.repeat(w)).join('  '),
    ...baris.map(garis)].join('\n');
}

async function jalan() {
  switch (perintah) {
    case 'daftar': {
      const list = DB.daftarKelas();
      if (!list.length) {
        console.log('Belum ada kelas. Buat satu:\n  node kelas.js buat "Kelas 7A"');
        return;
      }
      console.log(tabel(
        list.map((k) => [k.name, k.code, k.jml_siswa, k.jml_main]),
        ['KELAS', 'KODE', 'SISWA', 'MAIN']));
      return;
    }

    case 'buat': {
      const nama = (argv[1] || '').trim();
      if (!nama) keluar('Nama kelas kosong.\n  node kelas.js buat "Kelas 7A"');
      const k = DB.buatKelas(nama.slice(0, 40));
      console.log(`Kelas "${k.name}" dibuat.`);
      console.log(`Kode kelas: ${k.code}`);
      console.log('\nTulis kode itu di papan tulis. Tambahkan siswanya:');
      console.log(`  node kelas.js siswa ${k.code} < absen.txt`);
      return;
    }

    case 'lihat': {
      const k = kelasWajib(argv[1]);
      const siswa = DB.siswaDiKelas(k.id);
      console.log(`${k.name}  (kode ${k.code})\n`);
      console.log(tabel(
        siswa.map((s) => [
          s.name,
          s.pin_hash ? 'sudah' : 'belum',
          (DB.profil(s.id) || {}).xp || 0
        ]),
        ['SISWA', 'PIN', 'XP']));
      return;
    }

    case 'siswa': {
      const k = kelasWajib(argv[1]);
      const teks = await bacaStdin();
      if (!teks.trim()) {
        keluar('Tidak ada nama di stdin.\n' +
          `  node kelas.js siswa ${k.code} < absen.txt\n` +
          '  printf "Ahmad\\nBilqis\\n" | node kelas.js siswa ' + k.code);
      }
      /* Nomor absen di depan nama ("1. Ahmad", "12 Bilqis") ikut dibuang —
         daftar yang disalin dari absen hampir selalu membawanya. */
      const nama = teks.split(/\r?\n/)
        .map((b) => b.replace(/^\s*\d+[.)]?\s+/, '').trim())
        .filter(Boolean);
      if (!nama.length) keluar('Tidak ada nama yang bisa dibaca.');

      let masuk = 0;
      const dilewati = [];
      for (const n of nama) {
        if (DB.tambahSiswa(k.id, n)) masuk += 1;
        else dilewati.push(n);
      }
      console.log(`${masuk} siswa ditambahkan ke ${k.name}.`);
      if (dilewati.length) {
        console.log(`${dilewati.length} dilewati karena namanya sudah ada: ${dilewati.join(', ')}`);
      }
      return;
    }

    case 'ganti-nama': {
      const k = kelasWajib(argv[1]);
      const s = DB.cariSiswa(k.id, argv[2] || '');
      if (!s) keluar(`Tidak ada siswa bernama "${argv[2]}" di ${k.name}.`);
      const baru = (argv[3] || '').trim();
      if (!baru) keluar('Nama baru kosong.\n  node kelas.js ganti-nama KODE "01" "01 Ahmad"');
      const hasil = DB.ubahNamaSiswa(s.id, baru);
      if (!hasil) keluar(`Gagal — "${baru}" sudah dipakai siswa lain di ${k.name}.`);
      console.log(`"${s.name}" sekarang bernama "${hasil.name}". Progresnya utuh.`);
      return;
    }

    case 'reset-pin': {
      const k = kelasWajib(argv[1]);
      const s = DB.cariSiswa(k.id, argv[2] || '');
      if (!s) keluar(`Tidak ada siswa bernama "${argv[2]}" di ${k.name}.`);
      DB.resetPin(s.id);
      console.log(`PIN ${s.name} dikosongkan. Dia membuat PIN baru saat masuk lagi.`);
      return;
    }

    case 'hapus-siswa': {
      const k = kelasWajib(argv[1]);
      const s = DB.cariSiswa(k.id, argv[2] || '');
      if (!s) keluar(`Tidak ada siswa bernama "${argv[2]}" di ${k.name}.`);
      DB.hapusSiswa(s.id);
      console.log(`${s.name} dikeluarkan dari ${k.name} beserta seluruh progresnya.`);
      return;
    }

    case 'hapus-kelas': {
      const k = kelasWajib(argv[1]);
      const jml = DB.siswaDiKelas(k.id).length;
      DB.hapusKelas(k.id);
      console.log(`Kelas "${k.name}" dihapus beserta ${jml} siswa dan seluruh riwayatnya.`);
      return;
    }

    default:
      bantuan();
      process.exit(perintah ? 1 : 0);
  }
}

jalan().catch((e) => keluar('Gagal: ' + (e && e.message || e)));
