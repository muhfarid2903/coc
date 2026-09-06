# COC — Clash of Champions Matematika

Teka-teki rantai operasi berbasis web: telusuri rantainya mundur, tentukan
nilai awal yang membuat hasil akhirnya pas. Dibuat dengan HTML, CSS, dan
JavaScript murni — tanpa proses build, tanpa dependensi, tanpa server. Cukup
buka `index.html` di peramban.

## Cara Bermain

Satu permainan berisi **3 soal**. Tiap soal adalah sebuah rantai operasi hitung
yang berujung pada satu nilai akhir:

```
? ··· ×9 ··· +9 ··· ×2 ··· +25 ··· −20% ··· 92
```

Yang ditanya bukan hasilnya, melainkan **nilai awalnya** — angka yang masuk di
ujung kiri. Jalannya dari kanan ke kiri: lawan tiap operasi dengan
kebalikannya sampai tiba di ujung.

Dua aturan yang membuatnya bisa dikerjakan:

1. Rantai dijalankan **berurutan dari kiri ke kanan**. Aturan urutan operasi
   matematika (kali dan bagi lebih dulu) **tidak berlaku** — justru itu yang
   membuat tiap langkah bisa dibalik satu per satu.
2. Rantainya selalu dibangkitkan maju dari sebuah bilangan bulat, jadi tiap
   nilai antara juga bulat. Tidak akan pernah ada pecahan di tengah jalan.

Tiap soal memberi **3 nyawa**. Salah menjawab mengurangi satu nyawa dan kamu
boleh langsung mencoba lagi. Soal berganti kalau jawabannya benar atau nyawanya
habis.

**Tidak ada hitung mundur.** Pikirkan selama yang kamu perlu — yang dinilai
ketelitian menelusuri rantai, bukan kecepatan mengetik.

Nilai per soal: **1.000** untuk rantai yang terpecahkan, ditambah **250** untuk
tiap nyawa yang masih utuh. Sekali tebak langsung benar bernilai 1.750; tebakan
ketiga yang akhirnya benar bernilai 1.250; nyawa habis bernilai 0. Nilai
tertinggi satu permainan **5.250**.

Jawaban **diketik** di papan angka pada layar, atau lewat papan ketik sungguhan.
Jawabannya selalu bilangan bulat, jadi tidak ada tombol koma maupun garis
pecahan.

## Tingkat Kesulitan

Soal dibangkitkan secara acak, jadi tidak pernah habis. Yang naik dua-duanya:
rantainya makin panjang dan operasinya makin beragam.

| Tingkat | Panjang | Operasi | Angka |
| --- | --- | --- | --- |
| **EASY** | 6 langkah | `+` `−` | 1–12 |
| **MEDIUM** | 10 langkah | `+` `−` `×` `÷` | 1–20 |
| **HARD** | 14 langkah | `+` `−` `×` `÷` `x²` `%` | 1–25 |

Pembaginya selalu angka yang habis membagi nilai berjalan, pengurangnya tidak
pernah menembus 1, dan persentasenya hanya yang menghasilkan bilangan bulat.
Kuadrat cuma boleh muncul sekali dalam satu rantai dan hanya pada nilai kecil —
dua kuadrat berturut-turut membuat angkanya meledak, dan akar dari angka besar
bukan lagi hitungan yang bisa dikejar di kepala.

Setiap soal yang selesai menampilkan telusuran majunya sebagai pembahasan.

## Progres Pemain

Enam tingkatan (Perunggu → Perak → Emas → Platina → Berlian → Sang Juara),
sembilan lencana, misi harian yang berganti tiap hari, papan peringkat, skor
tertinggi, dan riwayat 40 permainan terakhir.

Tanpa kelas, semua data hidup di `localStorage` peramban masing-masing dan
tidak dikirim ke mana pun. Di dalam kelas, profil ikut tersimpan di server
sekolah sendiri sehingga tidak hilang saat ganti perangkat — lihat
[Mode Kelas](#mode-kelas) di bawah.

## Mode Kelas

Selain dimainkan sendiri, COC bisa dipakai satu kelas sekaligus. Yang berubah
saat mode ini menyala:

| Tanpa kelas | Di dalam kelas |
| --- | --- |
| Papan peringkat berisi 12 nama bawaan | Papan peringkat berisi teman sekelas sungguhan |
| Progres hilang kalau ganti perangkat atau hapus data peramban | Progres tersimpan di server, ikut ke perangkat mana pun |
| Guru tidak melihat apa pun | Guru melihat siapa berlatih, akurasinya, dan di tingkat mana kelasnya tersendat |
| Tidak ada tugas | Guru bisa memberi tugas bertenggat, progresnya terhitung sendiri |
| — | Sesi kelas serentak: satu kelas, satu rantai, satu detik yang sama |

Mode kelas **tidak wajib**. Kalau server API tidak ada — misalnya versi yang
disajikan GitHub Pages — aplikasi berjalan persis seperti sebelumnya, dan
tombol masuk kelas tidak ditawarkan sama sekali.

### Sesi kelas serentak

**Soal bersemai.** Tiap perangkat membangkitkan rantainya sendiri, jadi dua
siswa tidak akan pernah mendapat soal yang sama — dan skor mereka tidak bisa
diadu dengan cara apa pun. Karena itu seluruh pabrik soal menarik angka acak
lewat satu pintu yang bisa disemai: satu angka semai menghasilkan rantai yang
sama persis di perangkat mana pun. Tidak ada soal yang dikirim lewat jaringan;
yang dikirim hanya semainya.

**Jalannya sesi.** Guru menyiapkan sesi, siswa menekan *Gabung*, lalu seluruh
kelas mengerjakan rantai yang sama pada detik yang sama, dengan papan peringkat
muncul di antara soal. Panel guru bisa ditayangkan di proyektor.

Berbeda dari permainan sendiri, sesi kelas **punya hitung mundur** — batasnya
disetel guru, bawaannya 90 detik per rantai. Tanpa jam, satu siswa yang diam
menahan seluruh kelas menunggu tanpa akhir. Nyawanya tetap tiga: salah boleh
dicoba ulang selama waktunya belum habis.

Jamnya dijalankan server, bukan masing-masing peramban: jam di tiap ponsel
tidak pernah cukup seragam untuk membuat satu kelas benar-benar serentak.

Peristiwa langsungnya lewat **SSE**, bukan WebSocket: Node tidak punya server
WebSocket bawaan, dan memakainya berarti menambah dependensi npm pertama di
proyek ini. Semua yang perlu didorong ke siswa searah saja, dan `EventSource`
menyambung ulang sendiri saat wifi sekolah putus sebentar.

### Cara siswa masuk

1. Guru menulis kode kelas enam karakter di papan tulis.
2. Siswa membuka aplikasi, mengetik kode itu, lalu **memilih namanya dari
   daftar** — bukan mengetiknya, supaya tidak ada salah eja yang membuat
   profil kembar.
3. Siswa membuat PIN 4 angka sendiri saat pertama masuk, dan memakai PIN itu
   seterusnya.

Ada centang **"Ini perangkatku sendiri — ingat aku"**. Kalau tidak dicentang,
sesi hanya berumur sehari; ini bawaannya, karena di lab komputer yang dipakai
bergantian sesi yang awet berarti siswa berikutnya membuka aplikasi dan
langsung menjadi orang lain. Tombol **Keluar dari Kelas** di layar Profil juga
membersihkan data di perangkat itu, bukan sekadar menutup sesi.

Kalau siswa lupa PIN-nya, guru meresetnya dari dasbor; siswa lalu membuat PIN
baru saat masuk berikutnya. PIN yang salah delapan kali mengunci nama itu
selama 15 menit.

### Dasbor guru

Ada di `/guru`, terkunci satu frasa sandi, dan menampilkan per kelas:

- **Kode kelas** dalam huruf besar, siap disalin ke papan tulis.
- **Tabel siswa** — XP, jumlah permainan, akurasi berwarna, dan kapan
  terakhir aktif. Siswa yang belum pernah masuk ditandai.
- **Penguasaan per tingkat** — persentase rantai yang berhasil dipecahkan di
  tiap tingkat, jadi terlihat di sebelah mana kelasnya mulai tersendat.
- **Tugas** — pilih tingkat, berapa kali harus dimainkan, dan tenggat.
  Progresnya dihitung dari permainan yang benar-benar cocok tingkatnya, dan
  hanya yang dimainkan setelah tugas dibuat.

Menambah siswa dilakukan dengan menempel daftar nama dari absen, satu nama per
baris. Pakai nama panggilan saja — server sengaja tidak punya kolom nama
lengkap, NIS, atau email, sehingga data pribadi siswa yang tersimpan seminimal
mungkin.

Tiap siswa baru langsung mendapat **avatar acak** yang belum terpakai di
kelasnya, jadi papan peringkat bisa dibaca sekilas tanpa menunggu anak-anak
mengganti sendiri. Kelasnya boleh lebih besar daripada 18 avatar yang tersedia;
lewat angka itu avatarnya mulai berulang. Siswa tetap bisa menggantinya kapan
saja di layar Profil.

### Mengelola kelas dari baris perintah

Selain lewat dasbor, ada `server/kelas.js` yang bicara langsung ke SQLite.
Ia **tidak** memerlukan frasa sandi guru — menyiapkan kelas di awal tahun jadi
tidak perlu menunggu dasbornya terbuka, dan orang yang membantu menyiapkan
data tidak perlu dititipi frasa sandi. Keamanannya bersandar pada akses ke
servernya sendiri, yang toh sudah cukup untuk membaca berkas basis datanya.

```bash
docker exec -i coc-api node kelas.js daftar
docker exec -i coc-api node kelas.js buat "Kelas 7"
docker exec -i coc-api node kelas.js siswa J2EE3Q < absen.txt
docker exec -i coc-api node kelas.js lihat J2EE3Q
docker exec -i coc-api node kelas.js ganti-nama J2EE3Q "7-05" "7-05 Bilqis"
docker exec -i coc-api node kelas.js reset-pin J2EE3Q "7-05"
```

Impor namanya membuang nomor urut di depan (`1. Ahmad`, `12 Bilqis`), karena
daftar yang disalin dari absen hampir selalu membawanya.

`ganti-nama` aman dipakai kapan saja: profil, riwayat pertandingan, progres
tugas, dan PIN semuanya tertaut ke id siswa, bukan namanya. Jadi kelas boleh
dimulai dengan nomor absen saja dan diberi nama panggilan belakangan tanpa ada
yang hilang.

### Menyalakan mode kelas di server

API-nya satu container Node tanpa dependensi (`node:sqlite` bawaan), berjalan
di sebelah situs statisnya pada origin yang sama.

```bash
# Cara termudah: satu perintah, dijalankan di server dengan terminal sungguhan.
# Frasa sandinya diketik dua kali tanpa gema, hash-nya ditulis ke deploy/.env
# dengan izin 600, container dijalankan ulang, lalu hasilnya diperiksa.
ssh -t root@SERVER 'bash /opt/coc/deploy/setup-guru.sh'
```

Kalau lebih suka manual, `node server/hash-passphrase.js` mencetak satu baris
`SANDI_GURU_SCRYPT=…` untuk ditempel sendiri ke `deploy/.env`.

Basis datanya satu berkas SQLite di `deploy/data/coc.db`. Itu satu-satunya
yang perlu di-backup, dan `deploy/.gitignore` menjaganya supaya tidak pernah
ikut masuk git bersama seluruh data siswa di dalamnya.

Tanpa `deploy/.env`, situs dan permainannya tetap jalan penuh — hanya seluruh
jalur `/api/guru` yang menolak, dan dasbornya terkunci.

## Menjalankan Secara Lokal

```bash
# cara paling sederhana — tanpa mode kelas
open index.html

# atau lewat server statis apa pun
npx http-server -p 8080

# lengkap dengan API kelas dan dasbor guru (butuh Node 24+)
node server/dev.js     # situs di :8080, dasbor di :8080/guru/
```

`server/dev.js` menirukan susunan produksi: berkas statis dan `/api` pada satu
origin, seperti yang dilakukan Traefik di server. Basis data ujinya ditulis ke
`server/dev-data/` dan tidak pernah bercampur dengan data sungguhan.

## Deploy

Tidak ada proses build dan tidak ada backend, jadi cukup sajikan isi repo apa
adanya. Semua path aset bersifat relatif, sehingga situs tetap jalan meski
disajikan dari sub-folder seperti `https://<user>.github.io/<repo>/`.

**GitHub Pages** — paling praktis karena kodenya sudah di sini:

1. Buka **Settings → Pages** di repositori ini.
2. **Source**: pilih *Deploy from a branch*.
3. **Branch**: pilih branch yang berisi berkas ini, folder **`/ (root)`**, lalu **Save**.
4. Tunggu satu-dua menit; URL-nya muncul di halaman yang sama.

Berkas `.nojekyll` di root mematikan pemrosesan Jekyll agar seluruh berkas
disajikan apa adanya.

**Alternatif** — Netlify, Vercel, atau Cloudflare Pages juga bisa: hubungkan
repositori, kosongkan *build command*, dan set *publish directory* ke `.` (root).
Di Netlify, folder ini bahkan bisa langsung diseret ke jendela *Deploy manually*.

### VPS Sendiri

Berkas pendukung ada di folder `deploy/`.

#### Cara yang dipakai sekarang: di belakang Traefik (Coolify)

VPS `balanglompo.com` menjalankan Coolify, dan container `coolify-proxy`
(Traefik) yang memegang port 80/443 sekaligus mengurus sertifikat Let's
Encrypt. Jadi situs ini dijalankan sebagai container `nginx:alpine` biasa yang
**tidak membuka port ke host** — Traefik yang mengarahkan trafik ke sana lewat
label di `deploy/docker-compose.yml`. Polanya sama dengan `jadwal-belajar` dan
`jurnal-balanglompo` di server yang sama.

Karena situs ini tanpa proses build, direktori hasil `git clone` dipasang
langsung sebagai akar web (read-only), sehingga memperbarui cukup `git pull`.

```bash
# pasang sekali
git clone https://github.com/muhfarid2903/coc.git /opt/coc
docker compose -f /opt/coc/deploy/docker-compose.yml up -d

# memperbarui setelah ada perubahan
bash /opt/coc/deploy/update.sh
```

DNS sudah beres sendiri: ada data wildcard `*.balanglompo.com` yang mengarah ke
IP VPS, jadi subdomain baru langsung hidup tanpa menambah data DNS. Sertifikat
diterbitkan otomatis oleh Traefik saat permintaan HTTPS pertama masuk.

Domainnya ditulis di label `Host(...)` dalam `deploy/docker-compose.yml`; untuk
memindahkannya, ubah nilai itu lalu `docker compose up -d --force-recreate`.

#### Kalau VPS-nya kosong: Nginx langsung di host

Bila tidak ada Traefik atau proxy lain yang memegang port 80, situs ini bisa
disajikan Nginx host apa adanya.

**Cara cepat.** Skrip `deploy/setup-vps.sh` mengerjakan seluruh langkah di bawah
sekaligus. Unduh, tinjau isinya, lalu jalankan:

```bash
curl -fsSL https://raw.githubusercontent.com/muhfarid2903/coc/main/deploy/setup-vps.sh -o setup-vps.sh
less setup-vps.sh                      # tinjau dulu sebelum menjalankan
sudo bash setup-vps.sh domainmu.com    # atau tanpa argumen untuk menyajikan lewat IP
```

Aman dijalankan berulang — pemanggilan berikutnya hanya memperbarui kode dan
memuat ulang Nginx.

**Atau manual.** Konfigurasi di `deploy/nginx.conf` ditujukan untuk dalam
container, jadi tambahkan sendiri `server_name domainmu.com;` dan ganti `root`
menjadi lokasi clone, lalu:

```bash
sudo apt update && sudo apt install -y nginx git certbot python3-certbot-nginx
sudo git clone https://github.com/muhfarid2903/coc.git /var/www/coc
sudo cp /var/www/coc/deploy/nginx.conf /etc/nginx/sites-available/coc
sudo $EDITOR /etc/nginx/sites-available/coc      # server_name + root
sudo ln -s /etc/nginx/sites-available/coc /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d domainmu.com
```

Arahkan lebih dulu data `A` domainmu ke IP VPS, dan pastikan dengan
`dig +short domainmu.com`.

#### Alternatif: Caddy

Kalau lebih suka yang ringkas, Caddy mengurus HTTPS sepenuhnya otomatis.
Seluruh `Caddyfile` yang dibutuhkan hanya ini:

```caddyfile
domainmu.com, www.domainmu.com {
    root * /var/www/coc
    encode gzip
    file_server
}
```

## Struktur Berkas

```
index.html          kerangka halaman
css/style.css       seluruh gaya tampilan
js/data.js          tingkatan pemain, tingkat kesulitan, misi, lencana
js/threads.js       pabrik rantai operasi + telusuran jawabannya
js/fx.js            efek suara (WebAudio), getaran, konfeti
js/store.js         profil, misi harian, papan peringkat (localStorage)
js/app.js           alur layar dan mesin permainan
js/net.js           penghubung ke API kelas (aman bila server tidak ada)
js/live.js          aliran peristiwa sesi kelas (SSE)

server/             API kelas — Node tanpa dependensi, SQLite bawaan
guru/               dasbor guru (halaman terpisah di /guru)
deploy/             berkas untuk menjalankannya di VPS
```

## Catatan Teknis

- Dirancang untuk layar **mendatar** — panggung batu satu layar penuh, seperti
  arena pertandingan. Di HP yang dipegang tegak muncul ajakan memutar layar yang
  tetap bisa dilewati (ada siswa yang kunci rotasinya menyala), dan tata letaknya
  turun jadi satu lajur dengan menu di bawah. Menghormati `prefers-reduced-motion`.
- Efek suara dibangkitkan lewat WebAudio — tidak ada berkas audio yang perlu diunduh.
- Satu-satunya sumber daya eksternal adalah Google Fonts; bila diblokir, tampilan
  otomatis memakai huruf sistem.
- Pintasan papan ketik saat bermain: angka `0`–`9` untuk mengetik jawaban,
  `Backspace` menghapus, `Enter` mengirim — lalu `Enter` sekali lagi untuk lanjut
  ke soal berikutnya.
