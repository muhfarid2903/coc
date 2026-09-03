/* ============================================================
   net.js — penghubung ke API kelas.

   Aplikasi ini harus tetap utuh tanpa server. Versi di GitHub Pages,
   atau berkas yang dibuka langsung dari disk, tidak punya /api sama
   sekali — dan di situ COC wajib jalan persis seperti sebelumnya:
   profil di localStorage, papan peringkat berisi bot.

   Karena itu net.js tidak pernah melempar error ke pemanggilnya. Setiap
   fungsi mengembalikan objek hasil, dan `NET.mode` menyatakan keadaan:

     'luring'  — tidak ada server (atau tidak bisa dihubungi)
     'tamu'    — server ada, tapi belum masuk kelas
     'kelas'   — sudah masuk sebagai siswa

   Bagian lain aplikasi cukup melihat NET.mode untuk tahu harus memakai
   data server atau data lokal.
   ============================================================ */
(function (global) {
  'use strict';

  var NET = {
    mode: 'luring',
    aku: null,
    versiProfil: 0,
    siapKirim: false
  };

  function url(p) { return '/api' + p; }

  /* Semua permintaan lewat sini. Kegagalan jaringan tidak dilempar,
     melainkan jadi { ok:false, mati:true } supaya pemanggil bisa
     memilih diam dan memakai data lokal. */
  function minta(metode, jalur, badan) {
    var opt = {
      method: metode,
      credentials: 'same-origin',
      headers: { 'Accept': 'application/json' }
    };
    if (badan !== undefined) {
      opt.headers['Content-Type'] = 'application/json';
      opt.body = JSON.stringify(badan);
    }
    return fetch(url(jalur), opt).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        return { ok: r.ok, status: r.status, data: j, pesan: j && j.error };
      });
    }).catch(function () {
      return { ok: false, status: 0, mati: true, data: {}, pesan: 'Tidak tersambung ke server.' };
    });
  }

  /* ---------- Awal ----------
     Dipanggil sekali saat boot. Menetapkan NET.mode dan, kalau sudah
     ada sesi, mengembalikan profil milik siswa dari server. */
  NET.mulai = function () {
    return minta('GET', '/aku').then(function (r) {
      if (r.mati) { NET.mode = 'luring'; return null; }
      if (r.status === 401) { NET.mode = 'tamu'; return null; }
      if (!r.ok) { NET.mode = 'tamu'; return null; }
      NET.mode = 'kelas';
      NET.aku = r.data.aku;
      NET.versiProfil = (r.data.profil && r.data.profil.version) || 0;
      return r.data.profil ? r.data.profil.data : null;
    });
  };

  NET.cekKelas = function (kode) { return minta('POST', '/kelas/cek', { kode: kode }); };

  NET.masuk = function (kode, nama, pin, ava, ingat) {
    return minta('POST', '/masuk', { kode: kode, nama: nama, pin: pin, ava: ava, ingat: !!ingat })
      .then(function (r) {
        if (r.ok) {
          NET.mode = 'kelas';
          NET.aku = r.data.aku;
          NET.versiProfil = (r.data.profil && r.data.profil.version) || 0;
        }
        return r;
      });
  };

  NET.keluar = function () {
    return minta('POST', '/keluar').then(function (r) {
      NET.mode = 'tamu'; NET.aku = null; NET.versiProfil = 0;
      return r;
    });
  };

  /* ---------- Sinkron profil ----------
     Disatukan dan ditunda: satu pertandingan memicu beberapa save()
     berturut-turut (catat hasil, klaim misi, cek lencana), dan tidak ada
     gunanya mengirim tiga kali. 1,2 detik cukup untuk menangkap semuanya
     tanpa terasa lambat kalau siswa langsung menutup tab. */
  var timer = null, tertunda = null;

  NET.dorongProfil = function (data) {
    if (NET.mode !== 'kelas') return;
    tertunda = data;
    if (timer) return;
    timer = setTimeout(function () {
      timer = null;
      var kirim = tertunda; tertunda = null;
      if (kirim) NET.simpanProfil(kirim);
    }, 1200);
  };

  NET.simpanProfil = function (data) {
    if (NET.mode !== 'kelas') return Promise.resolve({ ok: false });
    return minta('PUT', '/profil', { data: data, versi: NET.versiProfil }).then(function (r) {
      if (r.ok) { NET.versiProfil = r.data.versi; return r; }
      /* 409 berarti perangkat lain menyimpan lebih dulu. Server menyertakan
         profil terbarunya; pemanggil yang memutuskan mau memakainya. */
      if (r.status === 409 && r.data.profil) {
        NET.versiProfil = r.data.profil.version;
        r.bentrok = r.data.profil.data;
      }
      if (r.status === 401) NET.mode = 'tamu';
      return r;
    });
  };

  /* Kirim sekarang juga, tanpa menunggu timer — dipakai saat halaman
     ditutup, lewat sendBeacon supaya tidak dibatalkan browser. */
  NET.dorongSekarang = function (data) {
    if (NET.mode !== 'kelas' || !data) return;
    if (timer) { clearTimeout(timer); timer = null; tertunda = null; }
    try {
      var blob = new Blob([JSON.stringify({ data: data, versi: NET.versiProfil })],
        { type: 'application/json' });
      /* sendBeacon selalu POST; /api/profil sengaja juga menerima POST
         untuk keperluan ini. */
      if (global.navigator && global.navigator.sendBeacon) {
        global.navigator.sendBeacon(url('/profil'), blob);
        return;
      }
    } catch (e) { /* jatuh ke cara biasa */ }
    NET.simpanProfil(data);
  };

  NET.catatMain = function (m) {
    if (NET.mode !== 'kelas') return Promise.resolve({ ok: false });
    return minta('POST', '/pertandingan', m);
  };

  /* Hasil terakhir disimpan supaya beranda bisa menampilkan peringkat kelas
     seketika saat dibuka, tanpa menunggu jaringan. Nilainya boleh sedikit
     basi — ia disegarkan di latar setiap kali beranda atau papan dibuka. */
  NET.papan = null;

  NET.peringkat = function () {
    return minta('GET', '/peringkat').then(function (r) {
      if (r.ok && r.data.peringkat) NET.papan = r.data.peringkat;
      return r;
    });
  };
  NET.tugas = function () { return minta('GET', '/tugas'); };

  global.COC_NET = NET;
})(window);
