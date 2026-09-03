/* ============================================================
   guru.js — dasbor guru.

   Halaman terpisah dari aplikasi siswa dan tidak berbagi state dengannya:
   sesi guru memakai cookie sendiri, dan tidak ada apa pun dari dasbor ini
   yang tersimpan di localStorage. Membuka dasbor di komputer kelas karena
   itu tidak mengubah profil siswa yang sedang login di tab sebelah.
   ============================================================ */
(function (global) {
  'use strict';

  var D = global.COC_DATA;
  var isi, toastEl, toastTimer;
  var tampil = { layar: 'muat', kelas: null, detail: null };

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function toast(pesan) {
    toastEl.textContent = pesan;
    toastEl.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('on'); }, 2600);
  }

  function minta(metode, jalur, badan) {
    var opt = { method: metode, credentials: 'same-origin', headers: { 'Accept': 'application/json' } };
    if (badan !== undefined) {
      opt.headers['Content-Type'] = 'application/json';
      opt.body = JSON.stringify(badan);
    }
    return fetch('/api' + jalur, opt).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        return { ok: r.ok, status: r.status, data: j, pesan: j && j.error };
      });
    }).catch(function () {
      return { ok: false, status: 0, data: {}, pesan: 'Tidak tersambung ke server.' };
    });
  }

  /* ---------- Rumus tampilan bersama ---------- */
  function akurasi(benar, soal) { return soal ? Math.round(benar / soal * 100) : null; }

  function selAkurasi(benar, soal) {
    var a = akurasi(benar, soal);
    if (a === null) return '<span class="sunyi">—</span>';
    var kelas = a >= 75 ? 'baik' : a >= 55 ? 'sedang' : 'kurang';
    return '<span class="ak ' + kelas + '">' + a + '%</span>';
  }

  function waktuLalu(iso) {
    if (!iso) return '<span class="sunyi">belum pernah</span>';
    var d = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (d < 90) return 'baru saja';
    if (d < 3600) return Math.floor(d / 60) + ' menit lalu';
    if (d < 86400) return Math.floor(d / 3600) + ' jam lalu';
    var h = Math.floor(d / 86400);
    return h === 1 ? 'kemarin' : h + ' hari lalu';
  }

  /* ============================================================
     Layar: masuk
     ============================================================ */
  function layarMasuk(galat) {
    $('btnKeluar').hidden = true;
    isi.innerHTML =
      '<div class="card stack" style="max-width:440px;margin:40px auto">' +
        '<h2 class="h2">Masuk Dasbor</h2>' +
        '<p class="sub">Dasbor ini memperlihatkan data seluruh kelas, jadi terkunci frasa sandi.</p>' +
        '<input class="field" id="sandi" type="password" placeholder="Frasa sandi guru" autocomplete="current-password"/>' +
        (galat ? '<p class="sub" style="color:var(--red)">' + esc(galat) + '</p>' : '') +
        '<button class="btn" id="btnMasuk">Masuk</button>' +
      '</div>';
    var f = $('sandi');
    f.addEventListener('keydown', function (e) { if (e.key === 'Enter') masuk(); });
    $('btnMasuk').addEventListener('click', masuk);
    f.focus();
  }

  function masuk() {
    var v = $('sandi').value;
    if (!v) return;
    minta('POST', '/guru/masuk', { sandi: v }).then(function (r) {
      if (!r.ok) return layarMasuk(r.pesan || 'Gagal masuk.');
      muatKelas();
    });
  }

  /* ============================================================
     Layar: daftar kelas
     ============================================================ */
  function muatKelas() {
    minta('GET', '/guru/kelas').then(function (r) {
      if (r.status === 401) return layarMasuk('');
      if (!r.ok) return pesanGalat(r.pesan);
      /* Aliran baru dipasang di sini, bukan saat boot. EventSource yang
         dibalas 401 gagal permanen — ia tidak menyambung ulang seperti
         saat koneksi putus biasa. Memasangnya sebelum guru masuk berarti
         alirannya mati untuk seterusnya, dan panel sesi tidak pernah
         bergerak sepanjang sesi berlangsung. */
      pasangAliran();
      tampil.kelas = r.data.kelas;
      layarKelas();
    });
  }

  function layarKelas() {
    $('btnKeluar').hidden = false;
    var list = tampil.kelas || [];
    isi.innerHTML =
      '<div class="gaksi" style="justify-content:space-between;margin-bottom:16px">' +
        '<h2 class="h2">Kelas</h2>' +
        '<div class="gaksi">' +
          '<input class="field" id="namaKelas" placeholder="Nama kelas baru, mis. Kelas 7A" style="width:240px"/>' +
          '<button class="btn btn-sm" id="btnBuat">+ Buat Kelas</button>' +
        '</div>' +
      '</div>' +
      (list.length
        ? '<div class="gkelas">' + list.map(function (k) {
            return '<div class="card" data-kelas="' + k.id + '">' +
              '<h3 class="h2" style="font-size:17px">' + esc(k.name) + '</h3>' +
              '<p class="sub" style="margin-top:6px">' + k.jml_siswa + ' siswa · ' + k.jml_main + ' pertandingan</p>' +
              '<p class="sub" style="margin-top:8px;font-family:JetBrains Mono,monospace;color:var(--gold);letter-spacing:.12em">' +
                esc(k.code) + '</p>' +
            '</div>';
          }).join('') + '</div>'
        : '<div class="card center" style="padding:34px">' +
            '<p class="sub">Belum ada kelas. Buat satu, lalu tempel daftar nama siswa dari absen.</p></div>');

    $('btnBuat').addEventListener('click', buatKelas);
    $('namaKelas').addEventListener('keydown', function (e) { if (e.key === 'Enter') buatKelas(); });
    Array.prototype.forEach.call(isi.querySelectorAll('[data-kelas]'), function (el) {
      el.addEventListener('click', function () { bukaKelas(Number(el.dataset.kelas)); });
    });
  }

  function buatKelas() {
    var nama = ($('namaKelas').value || '').trim();
    if (!nama) { toast('Isi nama kelasnya dulu'); return; }
    minta('POST', '/guru/kelas', { nama: nama }).then(function (r) {
      if (!r.ok) { toast(r.pesan || 'Gagal membuat kelas'); return; }
      toast('Kelas dibuat — kode ' + r.data.kelas.code);
      muatKelas();
    });
  }

  /* ============================================================
     Layar: detail satu kelas
     ============================================================ */
  function bukaKelas(id) {
    minta('GET', '/guru/kelas/' + id).then(function (r) {
      if (r.status === 401) return layarMasuk('');
      if (!r.ok) return pesanGalat(r.pesan);
      tampil.detail = r.data;
      layarDetail();
    });
  }

  function layarDetail() {
    var d = tampil.detail;
    var k = d.kelas;
    var totalBenar = d.siswa.reduce(function (a, s) { return a + (s.benar || 0); }, 0);
    var totalSoal = d.siswa.reduce(function (a, s) { return a + (s.soal || 0); }, 0);
    var aktif = d.siswa.filter(function (s) { return s.main > 0; }).length;

    isi.innerHTML =
      '<button class="btn btn-ghost btn-sm" id="btnBalik">‹ Semua kelas</button>' +
      '<div class="gaksi" style="justify-content:space-between;margin:14px 0 18px">' +
        '<h2 class="h2">' + esc(k.name) + '</h2>' +
        '<button class="btn btn-ghost btn-sm" id="btnHapusKelas" style="color:var(--red)">Hapus kelas</button>' +
      '</div>' +

      '<div class="gkolom dua">' +
        '<div>' +
          '<div class="statgrid" style="margin-bottom:18px">' +
            '<div class="sbox"><span>Siswa</span><b>' + d.siswa.length + '</b></div>' +
            '<div class="sbox"><span>Sudah main</span><b>' + aktif + '</b></div>' +
            '<div class="sbox"><span>Akurasi kelas</span><b>' + (akurasi(totalBenar, totalSoal) === null ? '—' : akurasi(totalBenar, totalSoal) + '%') + '</b></div>' +
          '</div>' +
          tabelSiswa(d.siswa) +
        '</div>' +

        '<div class="stack">' +
          '<div class="card stack">' +
            '<span class="eyebrow">Kode Kelas</span>' +
            '<div class="kode">' + esc(k.code) + '</div>' +
            '<p class="sub">Tulis kode ini di papan tulis. Siswa memasukkannya di aplikasi, memilih namanya, lalu membuat PIN 4 angka sendiri.</p>' +
          '</div>' +
          '<div class="card stack" id="kotakSesi"></div>' +
          kartuTopik(d.topik) +
          kartuTambahSiswa() +
          kartuTugas(d.tugas) +
        '</div>' +
      '</div>';

    $('btnBalik').addEventListener('click', muatKelas);
    $('btnHapusKelas').addEventListener('click', hapusKelas);
    pasangAksiDetail();
    muatSesi(k.id);
  }

  function tabelSiswa(siswa) {
    if (!siswa.length) {
      return '<div class="card center" style="padding:30px"><p class="sub">Belum ada siswa. Tempel daftar namanya di panel sebelah.</p></div>';
    }
    return '<div class="card"><div class="gscroll"><table class="gtabel">' +
      '<thead><tr>' +
        '<th>#</th><th>Siswa</th><th class="num">XP</th><th class="num">Main</th>' +
        '<th class="num">Akurasi</th><th>Terakhir aktif</th><th></th>' +
      '</tr></thead><tbody>' +
      siswa.map(function (s, i) {
        return '<tr>' +
          '<td class="num sunyi">' + (i + 1) + '</td>' +
          '<td class="nama">' + s.ava + ' ' + esc(s.name) +
            (s.sudah_pin ? '' : '<br><small class="sunyi">belum pernah masuk</small>') + '</td>' +
          '<td class="num">' + s.xp + '</td>' +
          '<td class="num">' + s.main + '</td>' +
          '<td class="num">' + selAkurasi(s.benar, s.soal) + '</td>' +
          /* last_seen, bukan waktu pertandingan terakhir. Siswa yang
             baru saja membuka aplikasi tapi belum sempat bermain tadinya
             tertulis "belum pernah" — guru membacanya sebagai anak yang
             tidak pernah muncul sama sekali. */
          '<td class="nowrap">' + waktuLalu(s.last_seen) + '</td>' +
          '<td class="aksi">' +
            /* Reset PIN hanya berarti bagi siswa yang sudah punya PIN.
               Menampilkannya untuk yang belum pernah masuk cuma menambah
               tombol yang tidak melakukan apa-apa. */
            (s.sudah_pin
              ? '<button class="btn btn-ghost btn-sm" data-reset="' + s.id + '" title="Siswa lupa PIN-nya">Reset PIN</button>'
              : '') +
            '<button class="btn btn-ghost btn-sm" data-buang="' + s.id + '" data-nama="' + esc(s.name) + '" title="Keluarkan dari kelas" style="color:var(--red)">×</button>' +
          '</td>' +
        '</tr>';
      }).join('') +
      '</tbody></table></div></div>';
  }

  /* Topik diurutkan dari akurasi terendah oleh server — yang paling perlu
     diulang di kelas muncul paling atas. */
  function kartuTopik(topik) {
    if (!topik.length) {
      return '<div class="card"><span class="eyebrow">Penguasaan Materi</span>' +
        '<p class="sub" style="margin-top:8px">Belum ada data. Muncul setelah siswa mulai bermain.</p></div>';
    }
    return '<div class="card">' +
      '<span class="eyebrow">Penguasaan Materi</span>' +
      '<p class="sub" style="margin:6px 0 12px">Diurutkan dari yang paling sering salah.</p>' +
      '<table class="gtabel"><tbody>' +
      topik.map(function (t) {
        var top = D.topic(t.topic);
        var a = akurasi(t.benar, t.soal);
        return '<tr>' +
          '<td style="width:1%">' + top.icon + '</td>' +
          '<td>' + esc(top.name) + '<br><small class="sunyi">' + t.main + ' pertandingan</small></td>' +
          '<td style="width:40%"><div class="gbar"><i style="width:' + (a || 0) + '%"></i></div></td>' +
          '<td class="num">' + selAkurasi(t.benar, t.soal) + '</td>' +
        '</tr>';
      }).join('') +
      '</tbody></table></div>';
  }

  function kartuTambahSiswa() {
    return '<div class="card stack">' +
      '<span class="eyebrow">Tambah Siswa</span>' +
      '<p class="sub">Tempel dari daftar absen — satu nama per baris. Pakai nama panggilan saja.</p>' +
      '<textarea class="field" id="daftarNama" placeholder="Ahmad&#10;Bilqis&#10;Chandra"></textarea>' +
      '<button class="btn btn-sm" id="btnTambahSiswa">Tambahkan</button>' +
    '</div>';
  }

  function kartuTugas(tugas) {
    var opsiTopik = D.TOPICS.map(function (t) {
      return '<option value="' + t.id + '">' + t.icon + ' ' + t.name + '</option>';
    }).join('');
    var opsiLevel = D.LEVELS.map(function (l) {
      return '<option value="' + l.d + '"' + (l.d === 2 ? ' selected' : '') + '>' + l.d + ' · ' + l.name + '</option>';
    }).join('');

    return '<div class="card stack">' +
      '<span class="eyebrow">Tugas</span>' +
      ((tugas && tugas.length)
        ? '<table class="gtabel"><tbody>' + tugas.map(function (t) {
            var top = D.topic(t.topic);
            var lv = D.LEVELS[t.level - 1];
            return '<tr>' +
              '<td>' + top.icon + ' ' + esc(top.name) + ' · ' + esc(lv ? lv.name : t.level) +
                '<br><small class="sunyi">' + t.target + '× main' +
                (t.due ? ' · tenggat ' + esc(t.due) : '') +
                (t.note ? '<br>' + esc(t.note) : '') + '</small></td>' +
              '<td class="num">' +
                '<button class="btn btn-ghost btn-sm" data-rekap="' + t.id + '">Rekap</button> ' +
                '<button class="btn btn-ghost btn-sm" data-hapustugas="' + t.id + '" style="color:var(--red)">×</button>' +
              '</td></tr>';
          }).join('') + '</tbody></table>'
        : '<p class="sub">Belum ada tugas.</p>') +
      '<hr style="border:0;border-top:1px solid var(--line);margin:4px 0"/>' +
      '<select class="field" id="tTopik">' + opsiTopik + '</select>' +
      '<select class="field" id="tLevel">' + opsiLevel + '</select>' +
      '<div class="gaksi">' +
        '<input class="field" id="tTarget" type="number" min="1" max="20" value="3" style="width:90px"/>' +
        '<span class="sub">kali main</span>' +
      '</div>' +
      '<input class="field" id="tDue" type="date" placeholder="Tenggat"/>' +
      '<input class="field" id="tNote" maxlength="140" placeholder="Catatan singkat (opsional)"/>' +
      '<button class="btn btn-sm" id="btnBuatTugas">+ Beri Tugas</button>' +
    '</div>';
  }

  /* ---------- Aksi di layar detail ---------- */
  function pasangAksiDetail() {
    var id = tampil.detail.kelas.id;

    $('btnTambahSiswa').addEventListener('click', function () {
      var daftar = ($('daftarNama').value || '').trim();
      if (!daftar) { toast('Belum ada nama yang ditempel'); return; }
      minta('POST', '/guru/kelas/' + id + '/siswa', { daftar: daftar }).then(function (r) {
        if (!r.ok) { toast(r.pesan || 'Gagal menambah'); return; }
        var gagal = r.data.hasil.filter(function (h) { return !h.ok; });
        toast(gagal.length
          ? (r.data.hasil.length - gagal.length) + ' ditambah, ' + gagal.length + ' dilewati (nama sudah ada)'
          : r.data.hasil.length + ' siswa ditambahkan');
        bukaKelas(id);
      });
    });

    $('btnBuatTugas').addEventListener('click', function () {
      minta('POST', '/guru/kelas/' + id + '/tugas', {
        topic: $('tTopik').value,
        level: Number($('tLevel').value),
        target: Number($('tTarget').value) || 1,
        due: $('tDue').value || null,
        note: ($('tNote').value || '').trim() || null
      }).then(function (r) {
        if (!r.ok) { toast(r.pesan || 'Gagal membuat tugas'); return; }
        toast('Tugas dibuat');
        bukaKelas(id);
      });
    });

    Array.prototype.forEach.call(isi.querySelectorAll('[data-reset]'), function (el) {
      el.addEventListener('click', function () {
        minta('POST', '/guru/siswa/' + el.dataset.reset + '/reset-pin').then(function (r) {
          toast(r.ok ? 'PIN direset — siswa membuat PIN baru saat masuk lagi' : 'Gagal mereset');
          if (r.ok) bukaKelas(id);
        });
      });
    });

    Array.prototype.forEach.call(isi.querySelectorAll('[data-buang]'), function (el) {
      el.addEventListener('click', function () {
        if (!global.confirm('Hapus ' + el.dataset.nama + ' dari kelas? Seluruh progres dan riwayatnya ikut terhapus.')) return;
        minta('DELETE', '/guru/siswa/' + el.dataset.buang).then(function (r) {
          toast(r.ok ? 'Siswa dihapus' : 'Gagal menghapus');
          if (r.ok) bukaKelas(id);
        });
      });
    });

    Array.prototype.forEach.call(isi.querySelectorAll('[data-hapustugas]'), function (el) {
      el.addEventListener('click', function () {
        minta('DELETE', '/guru/tugas/' + el.dataset.hapustugas).then(function (r) {
          toast(r.ok ? 'Tugas dihapus' : 'Gagal menghapus');
          if (r.ok) bukaKelas(id);
        });
      });
    });

    Array.prototype.forEach.call(isi.querySelectorAll('[data-rekap]'), function (el) {
      el.addEventListener('click', function () { rekap(el.dataset.rekap); });
    });
  }

  function rekap(tugasId) {
    minta('GET', '/guru/tugas/' + tugasId + '/rekap').then(function (r) {
      if (!r.ok) { toast(r.pesan || 'Gagal memuat rekap'); return; }
      var t = r.data.tugas;
      var top = D.topic(t.topic);
      var lv = D.LEVELS[t.level - 1];
      var sudah = r.data.rekap.filter(function (x) { return x.selesai >= x.target; }).length;
      isi.innerHTML =
        '<button class="btn btn-ghost btn-sm" id="btnBalikDetail">‹ Kembali ke kelas</button>' +
        '<h2 class="h2" style="margin:14px 0 4px">Rekap Tugas</h2>' +
        '<p class="sub">' + top.icon + ' ' + esc(top.name) + ' · ' + esc(lv ? lv.name : t.level) +
          ' · ' + t.target + '× main' + (t.due ? ' · tenggat ' + esc(t.due) : '') + '</p>' +
        '<div class="statgrid" style="margin:16px 0">' +
          '<div class="sbox"><span>Tuntas</span><b>' + sudah + ' / ' + r.data.rekap.length + '</b></div>' +
        '</div>' +
        '<div class="card"><div class="gscroll"><table class="gtabel">' +
          '<thead><tr><th>Siswa</th><th class="num">Progres</th><th>Status</th></tr></thead><tbody>' +
          r.data.rekap.map(function (x) {
            var tuntas = x.selesai >= x.target;
            return '<tr>' +
              '<td>' + x.ava + ' ' + esc(x.name) + '</td>' +
              '<td class="num">' + Math.min(x.selesai, x.target) + ' / ' + x.target + '</td>' +
              '<td>' + (tuntas ? '<span class="ak baik">✓ tuntas</span>' :
                (x.selesai > 0 ? '<span class="ak sedang">sedang jalan</span>' : '<span class="sunyi">belum mulai</span>')) + '</td>' +
            '</tr>';
          }).join('') +
        '</tbody></table></div></div>';
      $('btnBalikDetail').addEventListener('click', function () { bukaKelas(t.class_id); });
    });
  }

  function hapusKelas() {
    var k = tampil.detail.kelas;
    if (!global.confirm('Hapus kelas "' + k.name + '"?\n\nSeluruh siswa, progres, riwayat, dan tugas di dalamnya ikut terhapus permanen.')) return;
    minta('DELETE', '/guru/kelas/' + k.id).then(function (r) {
      if (!r.ok) { toast(r.pesan || 'Gagal menghapus'); return; }
      toast('Kelas dihapus');
      muatKelas();
    });
  }

  function pesanGalat(pesan) {
    isi.innerHTML = '<div class="card center" style="padding:34px">' +
      '<p class="sub">' + esc(pesan || 'Terjadi gangguan.') + '</p></div>';
  }

  /* ---------- Aliran peristiwa langsung ----------
     Dasbor perlu tahu saat siswa bergabung dan saat papan berubah, tanpa
     guru menekan muat ulang di depan kelas. EventSource menyambung ulang
     sendiri kalau wifi sekolah putus sebentar. */
  var sumber = null;

  function pasangAliran() {
    if (sumber || !global.EventSource) return;
    try { sumber = new global.EventSource('/api/guru/live', { withCredentials: true }); }
    catch (e) { return; }

    ['sesi-peserta', 'sesi-mulai', 'sesi-soal', 'sesi-papan', 'sesi-usai', 'sesi-ada']
      .forEach(function (jenis) {
        sumber.addEventListener(jenis, function (e) {
          var d = {};
          try { d = JSON.parse(e.data || '{}'); } catch (err) { return; }
          /* Hanya menanggapi kelas yang sedang dibuka — guru bisa punya
             beberapa kelas sekaligus. */
          if (!tampil.detail || d.kelas !== tampil.detail.kelas.id) return;
          /* Keadaan ditarik ulang dari server, bukan disusun dari isi
             peristiwanya. Menyalin potongan keadaan ke variabel lokal di
             sini sekali sempat membuat panel macet di "Soal 1 dari 4":
             ada bidang yang diperbarui di satu tempat tapi dibaca dari
             tempat lain. Peristiwanya jarang — beberapa per menit — jadi
             satu permintaan tambahan jauh lebih murah daripada dua salinan
             keadaan yang bisa berbeda. */
          muatSesi(tampil.detail.kelas.id);
        });
      });
  }

  var liveSesi = { sesi: null, papan: [], peserta: 0, soalKe: -1, tahap: null };

  function muatSesi(classId) {
    return minta('GET', '/guru/kelas/' + classId + '/sesi').then(function (r) {
      liveSesi.sesi = (r.ok && r.data.sesi) || null;
      liveSesi.papan = (r.ok && r.data.papan) || [];
      liveSesi.peserta = liveSesi.sesi ? liveSesi.sesi.peserta : 0;
      liveSesi.soalKe = liveSesi.sesi ? liveSesi.sesi.soalKe : -1;
      liveSesi.tahap = liveSesi.sesi ? liveSesi.sesi.tahap : null;
      gambarSesi();
    });
  }

  function gambarSesi() {
    var kotak = $('kotakSesi');
    if (!kotak || !tampil.detail) return;
    kotak.innerHTML = isiSesi();
    pasangAksiSesi();
  }

  function isiSesi() {
    var id = tampil.detail.kelas.id;
    var s = liveSesi.sesi;

    if (!s || s.tahap === 'usai') {
      var opsiTopik = D.TOPICS.map(function (t) {
        return '<option value="' + t.id + '">' + t.icon + ' ' + t.name + '</option>';
      }).join('');
      var opsiLevel = D.LEVELS.map(function (l) {
        return '<option value="' + l.d + '"' + (l.d === 2 ? ' selected' : '') + '>' + l.d + ' · ' + l.name + '</option>';
      }).join('');
      return '<span class="eyebrow">Sesi Kelas Serentak</span>' +
        (s && s.tahap === 'usai' && liveSesi.papan.length
          ? '<p class="sub" style="margin-top:6px">Sesi terakhir sudah selesai.</p>' + papanHtml(liveSesi.papan) + '<hr style="border:0;border-top:1px solid var(--line);margin:12px 0"/>'
          : '<p class="sub" style="margin-top:6px">Seluruh kelas mengerjakan soal yang sama pada saat yang sama. Tayangkan halaman ini di proyektor.</p>') +
        '<select class="field" id="sTopik" style="margin-top:10px">' + opsiTopik + '</select>' +
        '<select class="field" id="sLevel" style="margin-top:8px">' + opsiLevel + '</select>' +
        '<div class="gaksi" style="margin-top:8px">' +
          '<input class="field" id="sJumlah" type="number" min="3" max="20" value="10" style="width:80px"/>' +
          '<span class="sub">soal</span>' +
          '<input class="field" id="sDetik" type="number" min="6" max="60" value="20" style="width:80px"/>' +
          '<span class="sub">detik per soal</span>' +
        '</div>' +
        '<button class="btn btn-sm" id="btnBuatSesi" style="margin-top:10px">▶ Siapkan Sesi</button>';
    }

    if (s.tahap === 'menunggu') {
      return '<span class="eyebrow">Sesi Kelas — menunggu siswa</span>' +
        '<div class="sesi-besar">' + liveSesi.peserta + '</div>' +
        '<p class="sub center">siswa sudah gabung</p>' +
        '<p class="sub" style="margin-top:10px">' + D.topic(s.topik).icon + ' ' + esc(D.topic(s.topik).name) +
          ' · ' + s.jumlah + ' soal · ' + Math.round(s.batasMs / 1000) + ' detik per soal</p>' +
        '<p class="sub">Minta siswa membuka aplikasi dan menekan <b>Gabung</b> di beranda.</p>' +
        '<div class="gaksi" style="margin-top:10px">' +
          '<button class="btn btn-sm" id="btnMulaiSesi">Mulai Sekarang</button>' +
          '<button class="btn btn-ghost btn-sm" id="btnAkhiriSesi" style="color:var(--red)">Batalkan</button>' +
        '</div>';
    }

    return '<span class="eyebrow">Sesi Kelas — berjalan</span>' +
      '<p class="sub" style="margin-top:6px">Soal <b>' + (liveSesi.soalKe + 1) + '</b> dari ' + s.jumlah +
        ' · ' + liveSesi.peserta + ' siswa</p>' +
      papanHtml(liveSesi.papan) +
      '<div class="gaksi" style="margin-top:10px">' +
        '<button class="btn btn-ghost btn-sm" id="btnLanjutSesi">Soal Berikutnya ›</button>' +
        '<button class="btn btn-ghost btn-sm" id="btnAkhiriSesi" style="color:var(--red)">Akhiri</button>' +
      '</div>';
  }

  function papanHtml(papan) {
    if (!papan || !papan.length) return '<p class="sub" style="margin-top:10px">Belum ada skor.</p>';
    return '<table class="gtabel" style="margin-top:10px"><tbody>' +
      papan.slice(0, 12).map(function (r, i) {
        return '<tr>' +
          '<td style="width:1%" class="sunyi">' + (i + 1) + '</td>' +
          '<td>' + r.ava + ' ' + esc(r.nama) + '</td>' +
          '<td class="num sunyi">' + r.benar + ' benar</td>' +
          '<td class="num"><b>' + r.skor + '</b></td>' +
        '</tr>';
      }).join('') + '</tbody></table>';
  }

  function pasangAksiSesi() {
    var id = tampil.detail.kelas.id;
    var b;
    if ((b = $('btnBuatSesi'))) b.addEventListener('click', function () {
      minta('POST', '/guru/kelas/' + id + '/sesi', {
        topic: $('sTopik').value,
        level: Number($('sLevel').value),
        jumlah: Number($('sJumlah').value) || 10,
        batasMs: (Number($('sDetik').value) || 20) * 1000
      }).then(function (r) {
        if (!r.ok) { toast(r.pesan || 'Gagal membuat sesi'); return; }
        toast('Sesi disiapkan — minta siswa menekan Gabung');
        muatSesi(id);
      });
    });
    if ((b = $('btnMulaiSesi'))) b.addEventListener('click', function () {
      minta('POST', '/guru/kelas/' + id + '/sesi/mulai').then(function (r) {
        if (!r.ok) { toast(r.pesan || 'Gagal memulai'); return; }
        muatSesi(id);
      });
    });
    if ((b = $('btnLanjutSesi'))) b.addEventListener('click', function () {
      minta('POST', '/guru/kelas/' + id + '/sesi/lanjut').then(function () { muatSesi(id); });
    });
    if ((b = $('btnAkhiriSesi'))) b.addEventListener('click', function () {
      minta('DELETE', '/guru/kelas/' + id + '/sesi').then(function () {
        toast('Sesi diakhiri');
        muatSesi(id);
      });
    });
  }

  /* ---------- Mulai ---------- */
  function boot() {
    isi = $('isi');
    toastEl = $('toast');
    $('btnKeluar').addEventListener('click', function () {
      minta('POST', '/guru/keluar').then(function () {
        if (sumber) { sumber.close(); sumber = null; }
        layarMasuk('');
      });
    });
    muatKelas();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
