# COC — Clash of Champions Matematika

Arena turnamen matematika berbasis web. Dibuat dengan HTML, CSS, dan JavaScript
murni — tanpa proses build, tanpa dependensi, tanpa server. Cukup buka
`index.html` di peramban.

## Cara Bermain

| Mode | Isi |
| --- | --- |
| ⚔️ **Duel Cepat** | 10 soal melawan satu penantang. Siapa cepat dan tepat, dia menang. |
| 🏆 **Turnamen 8 Besar** | Bagan gugur tiga babak: perempat final, semifinal, final. |
| 🎯 **Latihan Santai** | 10 soal tanpa lawan. XP tetap didapat, separuh. |

Nilai per soal: **100** (jawaban benar) + **sisa waktu × 100** (bonus kecepatan)
+ **runtun × 20**, maksimal 100 (bonus beruntun). Jawaban salah atau kehabisan
waktu bernilai 0 dan memutus runtun.

Setiap pertandingan menyediakan dua kartu bantuan gratis: **Eliminasi**
(membuang dua pilihan salah) dan **Tambah Waktu** (+6 detik).

## Topik Soal

Soal dibangkitkan secara acak, jadi tidak pernah habis. Tujuh topik, masing-masing
dengan lima tingkat kesulitan:

- ⚡ **Hitung Kilat** — tambah, kurang, kali, bagi, urutan operasi
- 🧮 **Duel Aljabar** — persamaan linear satu variabel
- 📐 **Serbu Geometri** — luas, keliling, volume, luas permukaan
- 🍕 **Pecahan & Persen** — penyederhanaan, penjumlahan pecahan, diskon, untung-rugi
- 🔢 **Baca Pola** — deret aritmetika, geometri, kuadrat, Fibonacci
- 📖 **Soal Cerita** — belanja, kecepatan, rata-rata, perbandingan, bunga
- 🎲 **Serba-serbi** — semua topik diacak jadi satu

Setiap jawaban disertai langkah penyelesaian singkat.

## Progres Pemain

Enam tingkatan (Perunggu → Perak → Emas → Platina → Berlian → Sang Juara),
sembilan lencana, misi harian yang berganti tiap hari, papan peringkat, dan
riwayat 40 pertandingan terakhir.

Semua data disimpan di `localStorage` peramban masing-masing pemain. Tidak ada
data yang dikirim ke mana pun, dan tidak ada backend.

## Menjalankan

```bash
# cara paling sederhana
open index.html

# atau lewat server statis apa pun
npx http-server -p 8080
```

Untuk menerbitkannya, aktifkan GitHub Pages dari branch yang berisi berkas ini —
situsnya statis sepenuhnya.

## Struktur Berkas

```
index.html          kerangka halaman
css/style.css       seluruh gaya tampilan
js/data.js          tingkatan, topik, lawan, misi, lencana
js/questions.js     pabrik soal + penjelasan jawaban
js/fx.js            efek suara (WebAudio), getaran, konfeti
js/store.js         profil, misi harian, papan peringkat (localStorage)
js/app.js           alur layar, mesin duel, bagan turnamen
```

## Catatan Teknis

- Mobile-first, aman di layar 320 px ke atas, menghormati `prefers-reduced-motion`.
- Efek suara dibangkitkan lewat WebAudio — tidak ada berkas audio yang perlu diunduh.
- Satu-satunya sumber daya eksternal adalah Google Fonts; bila diblokir, tampilan
  otomatis memakai huruf sistem.
- Pintasan papan ketik saat bertanding: `A`–`D` atau `1`–`4` untuk menjawab,
  `Enter` untuk lanjut.
