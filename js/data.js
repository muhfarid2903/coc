/* ============================================================
   data.js — konstanta dunia permainan
   ============================================================ */
(function (global) {
  'use strict';

  /* Tingkatan pemain. minXp menaik; tingkat terakhir tanpa batas atas. */
  var TIERS = [
    { id: 'perunggu', name: 'Perunggu',  icon: '🥉', minXp: 0,    color: '#d3a06a' },
    { id: 'perak',    name: 'Perak',     icon: '🥈', minXp: 600,  color: '#dbe5ef' },
    { id: 'emas',     name: 'Emas',      icon: '🥇', minXp: 1600, color: '#e8b84b' },
    { id: 'platina',  name: 'Platina',   icon: '💠', minXp: 3200, color: '#5ad0e6' },
    { id: 'berlian',  name: 'Berlian',   icon: '💎', minXp: 5600, color: '#a9e9ff' },
    { id: 'juara',    name: 'Sang Juara', icon: '👑', minXp: 9000, color: '#f0a05c' }
  ];

  /* Kembar dengan AVATAR di server/db.js, yang memakainya untuk memberi
     avatar awal acak tiap siswa baru. Keduanya harus tetap sama isinya:
     avatar dari server yang tidak ada di sini akan membuat seorang siswa
     melihat avatarnya sendiri hilang dari kisi pilihan. */
  var AVATARS = [
    '🦊', '🐼', '🦉', '🐯', '🦁', '🐨',
    '🐺', '🦄', '🐸', '🦖', '🐙', '🦈',
    '🧑‍🚀', '🧙', '🥷', '🤖', '👾', '🐝'
  ];

  /* Tiga tingkat kesulitan, kembar dengan `d` yang diterima pabrik rantai
     di threads.js. Riwayat lama sempat menyimpan level 4 dan 5; angka itu
     tidak punya nama lagi, jadi pencariannya lewat levelName() yang punya
     jalan mundur. */
  var LEVELS = [
    { d: 1, name: 'EASY' },
    { d: 2, name: 'MEDIUM' },
    { d: 3, name: 'HARD' }
  ];

  /* Penghuni papan peringkat di luar kelas. Sejak duel dihapus mereka
     tidak pernah dihadapi siapa pun; `skill` tinggal dipakai store.js
     untuk menebar XP awal mereka supaya papannya tidak rata. */
  var RIVALS = [
    { name: 'Bagas',   ava: '🐯', skill: 0.55 },
    { name: 'Nadia',   ava: '🦉', skill: 0.60 },
    { name: 'Reyhan',  ava: '🦊', skill: 0.64 },
    { name: 'Kirana',  ava: '🐼', skill: 0.68 },
    { name: 'Dimas',   ava: '🐺', skill: 0.71 },
    { name: 'Salsa',   ava: '🦄', skill: 0.74 },
    { name: 'Fajar',   ava: '🦖', skill: 0.77 },
    { name: 'Anindya', ava: '🐙', skill: 0.80 },
    { name: 'Bimo',    ava: '🥷', skill: 0.83 },
    { name: 'Hana',    ava: '🧙', skill: 0.86 },
    { name: 'Yudha',   ava: '🤖', skill: 0.89 },
    { name: 'Callista',ava: '👾', skill: 0.92 }
  ];

  /* Misi harian: kind dipakai app.js untuk menaikkan progres.
     Angkanya ditakar untuk permainan 3 soal — misi lama yang meminta 25
     jawaban benar dulu setara tiga pertandingan, sekarang setara
     sembilan. */
  var QUESTS = [
    { id: 'main3',   kind: 'match',   goal: 3, coin: 60,  gem: 1, text: 'Selesaikan 3 permainan' },
    { id: 'benar6',  kind: 'correct', goal: 6, coin: 80,  gem: 1, text: 'Pecahkan 6 rantai' },
    { id: 'menang2', kind: 'win',     goal: 2, coin: 100, gem: 2, text: 'Tuntaskan 2 permainan penuh' },
    { id: 'runtun3', kind: 'streak',  goal: 3, coin: 70,  gem: 1, text: 'Pecahkan 3 rantai berturut-turut' },
    { id: 'utuh3',   kind: 'utuh',    goal: 3, coin: 90,  gem: 1, text: 'Pecahkan 3 rantai tanpa kehilangan nyawa' }
  ];

  /* Lencana. `check(p)` menerima profil dan mengembalikan boolean.
     Id-nya sengaja dipertahankan walau artinya berubah: lencana yang
     sudah dikoleksi siswa disimpan sebagai daftar id, dan mengganti id
     berarti mencabut lencana yang sudah mereka dapat. */
  var BADGES = [
    { id: 'debut',   icon: '🎬', name: 'Debut',          desc: 'Main 1 permainan',
      check: function (p) { return p.played >= 1; } },
    { id: 'menang1', icon: '🎖️', name: 'Tuntas Perdana', desc: 'Tuntaskan satu permainan penuh',
      check: function (p) { return p.wins >= 1; } },
    { id: 'runtun10',icon: '🔥', name: 'Lima Tuntas',    desc: 'Tuntaskan 5 permainan',
      check: function (p) { return p.wins >= 5; } },
    { id: 'sempurna',icon: '💯', name: 'Nilai Penuh',    desc: 'Satu permainan 3 dari 3',
      check: function (p) { return p.perfects >= 1; } },
    { id: 'kilat',   icon: '❤️', name: 'Tanpa Lecet',    desc: 'Pecahkan rantai tanpa kehilangan nyawa',
      check: function (p) { return p.flawless >= 1; } },
    { id: 'juara',   icon: '🏆', name: 'Penakluk HARD',  desc: 'Tuntaskan satu permainan HARD',
      check: function (p) { return p.hardClear >= 1; } },
    { id: 'veteran', icon: '🛡️', name: 'Veteran',        desc: 'Main 25 permainan',
      check: function (p) { return p.played >= 25; } },
    { id: 'sarjana', icon: '🎓', name: 'Sarjana Angka',  desc: '60 rantai terpecahkan',
      check: function (p) { return p.totalCorrect >= 60; } },
    { id: 'sultan',  icon: '👑', name: 'Sang Juara',     desc: 'Capai tingkat tertinggi',
      check: function (p) { return p.xp >= 9000; } }
  ];

  global.COC_DATA = {
    TIERS: TIERS, AVATARS: AVATARS, LEVELS: LEVELS,
    RIVALS: RIVALS, QUESTS: QUESTS, BADGES: BADGES,

    tierOf: function (xp) {
      var t = TIERS[0];
      for (var i = 0; i < TIERS.length; i++) if (xp >= TIERS[i].minXp) t = TIERS[i];
      return t;
    },
    nextTier: function (xp) {
      for (var i = 0; i < TIERS.length; i++) if (xp < TIERS[i].minXp) return TIERS[i];
      return null;
    },
    levelName: function (d) {
      for (var i = 0; i < LEVELS.length; i++) if (LEVELS[i].d === d) return LEVELS[i].name;
      return 'Tingkat ' + d;
    }
  };
})(window);
