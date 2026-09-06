/* ============================================================
   live.js — aliran peristiwa langsung untuk duel dan sesi kelas.

   Menyambung ke /api/live lewat EventSource. Pilihan itu membawa satu
   keuntungan besar untuk wifi sekolah: peramban menyambung ulang sendiri
   saat koneksi putus, tanpa satu baris pun kode di sini. Yang perlu
   ditangani hanyalah keadaan permainan setelah sambungan pulih.

   Seperti net.js, berkas ini tidak pernah melempar error ke pemanggilnya.
   Tanpa server, atau di luar kelas, LIVE.hidup bernilai false dan seluruh
   fungsinya menjadi tidak berarti — bukan meledak.
   ============================================================ */
(function (global) {
  'use strict';

  var LIVE = { hidup: false, nyambung: false };
  var sumber = null;
  var pendengar = {};

  var JENIS = [
    'duel-mulai', 'duel-skor', 'duel-usai', 'antre-usai',
    'sesi-ada', 'sesi-mulai', 'sesi-soal', 'sesi-papan', 'sesi-usai', 'sesi-peserta'
  ];

  function pancar(jenis, data) {
    (pendengar[jenis] || []).forEach(function (fn) {
      try { fn(data); } catch (e) { /* satu pendengar rusak tidak boleh menjatuhkan sisanya */ }
    });
  }

  LIVE.on = function (jenis, fn) {
    (pendengar[jenis] = pendengar[jenis] || []).push(fn);
    return LIVE;
  };

  LIVE.mulai = function () {
    if (sumber || !global.EventSource) return;
    try {
      sumber = new global.EventSource('/api/live', { withCredentials: true });
    } catch (e) { return; }

    LIVE.hidup = true;

    sumber.onopen = function () {
      LIVE.nyambung = true;
      pancar('sambung', {});
    };

    /* EventSource menyambung ulang sendiri. Yang penting di sini hanya
       menandai keadaannya, supaya layar bisa memberi tahu siswa bahwa
       duelnya sedang tidak terhubung. */
    sumber.onerror = function () {
      LIVE.nyambung = false;
      pancar('putus', {});
    };

    JENIS.forEach(function (jenis) {
      sumber.addEventListener(jenis, function (e) {
        var data = {};
        try { data = JSON.parse(e.data || '{}'); } catch (err) { /* abaikan */ }
        pancar(jenis, data);
      });
    });
  };

  LIVE.tutup = function () {
    if (sumber) { sumber.close(); sumber = null; }
    LIVE.hidup = false;
    LIVE.nyambung = false;
  };

  function kirim(jalur, badan) {
    var opt = {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Accept': 'application/json' }
    };
    if (badan !== undefined) {
      opt.headers['Content-Type'] = 'application/json';
      opt.body = JSON.stringify(badan);
    }
    return fetch('/api' + jalur, opt).then(function (r) {
      return r.json().catch(function () { return {}; })
        .then(function (j) { return { ok: r.ok, status: r.status, data: j, pesan: j && j.error }; });
    }).catch(function () {
      return { ok: false, status: 0, data: {}, pesan: 'Tidak tersambung.' };
    });
  }

  /* ---------- Duel ---------- */
  LIVE.antre = function (topik, tingkat, jumlah) {
    return kirim('/duel/antre', { topik: topik, tingkat: tingkat, jumlah: jumlah });
  };
  LIVE.batalAntre = function () { return kirim('/duel/batal'); };

  /* Dikirim setiap kali satu soal tuntas. Kegagalannya sengaja diabaikan:
     satu paket skor yang hilang hanya membuat bar lawan tertinggal sesaat,
     dan paket berikutnya membawa angka kumulatif yang benar. */
  LIVE.jawab = function (soalKe, skor, benar) {
    return kirim('/duel/jawab', { soalKe: soalKe, skor: skor, benar: benar });
  };
  LIVE.selesaiDuel = function (skor, benar) {
    return kirim('/duel/selesai', { skor: skor, benar: benar });
  };
  LIVE.keluarDuel = function () { return kirim('/duel/keluar'); };

  /* ---------- Sesi kelas ---------- */
  LIVE.gabungSesi = function () { return kirim('/sesi/gabung'); };
  LIVE.jawabSesi = function (soalKe, poin, benar) {
    return kirim('/sesi/jawab', { soalKe: soalKe, poin: poin, benar: benar });
  };
  LIVE.lihatSesi = function () {
    return fetch('/api/sesi', { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .catch(function () { return { sesi: null }; });
  };

  global.COC_LIVE = LIVE;
})(window);
