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

  /* Topik soal. `gen` menunjuk fungsi di questions.js, `time` detik dasar. */
  var TOPICS = [
    { id: 'kilat',    name: 'Hitung Kilat',    icon: '⚡', time: 13,
      desc: 'Tambah, kurang, kali, bagi — adu kecepatan',
      grad: 'radial-gradient(60% 46% at 50% 16%,rgba(255,255,255,.55),transparent 70%),linear-gradient(180deg,#f8e5ad,#e8b84b 50%,#b7862a)', color: '#e8b84b' },
    { id: 'aljabar',  name: 'Duel Aljabar',    icon: '🧮', time: 22,
      desc: 'Cari nilai x sebelum waktu habis',
      grad: 'radial-gradient(60% 46% at 50% 16%,rgba(255,255,255,.55),transparent 70%),linear-gradient(180deg,#cfe0ff,#7f9ff0 50%,#3a5cb8)', color: '#7f9ff0' },
    { id: 'geometri', name: 'Serbu Geometri',  icon: '📐', time: 26,
      desc: 'Luas, keliling, dan volume bangun',
      grad: 'radial-gradient(60% 46% at 50% 16%,rgba(255,255,255,.55),transparent 70%),linear-gradient(180deg,#ddd0ff,#a888ec 50%,#6a45c0)', color: '#a888ec' },
    { id: 'pecahan',  name: 'Pecahan & Persen', icon: '🍕', time: 22,
      desc: 'Potongan harga, rasio, dan pecahan',
      grad: 'radial-gradient(60% 46% at 50% 16%,rgba(255,255,255,.55),transparent 70%),linear-gradient(180deg,#ffd0e0,#f07aa8 50%,#b8306a)', color: '#f07aa8' },
    { id: 'pola',     name: 'Baca Pola',       icon: '🔢', time: 22,
      desc: 'Tebak angka berikutnya dalam deret',
      grad: 'radial-gradient(60% 46% at 50% 16%,rgba(255,255,255,.55),transparent 70%),linear-gradient(180deg,#b6e88a,#77c341 50%,#4b8f1c)', color: '#77c341' },
    { id: 'cerita',   name: 'Soal Cerita',     icon: '📖', time: 34,
      desc: 'Cerita sehari-hari yang perlu dihitung',
      grad: 'radial-gradient(60% 46% at 50% 16%,rgba(255,255,255,.55),transparent 70%),linear-gradient(180deg,#cdeefb,#7fd3f0 50%,#42aad4)', color: '#5ad0e6' },
    { id: 'campuran', name: 'Serba-serbi',     icon: '🎲', time: 24,
      desc: 'Semua topik diacak jadi satu',
      grad: 'radial-gradient(60% 46% at 50% 16%,rgba(255,255,255,.55),transparent 70%),linear-gradient(180deg,#ffdcb0,#f0a05c 50%,#b85f22)', color: '#f0a05c' }
  ];

  var LEVELS = [
    { d: 1, name: 'Pemanasan' },
    { d: 2, name: 'Mudah' },
    { d: 3, name: 'Sedang' },
    { d: 4, name: 'Sulit' },
    { d: 5, name: 'Maut' }
  ];

  /* Kumpulan lawan komputer. skill = peluang dasar menjawab benar. */
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

  /* Misi harian: kind dipakai app.js untuk menaikkan progres. */
  var QUESTS = [
    { id: 'main3',    kind: 'match',   goal: 3,  coin: 60,  gem: 1, text: 'Selesaikan 3 pertandingan' },
    { id: 'benar25',  kind: 'correct', goal: 25, coin: 80,  gem: 1, text: 'Jawab 25 soal dengan benar' },
    { id: 'menang2',  kind: 'win',     goal: 2,  coin: 100, gem: 2, text: 'Menangkan 2 duel' },
    { id: 'runtun5',  kind: 'streak',  goal: 5,  coin: 70,  gem: 1, text: 'Capai runtun 5 jawaban benar' },
    { id: 'kilat10',  kind: 'fast',    goal: 10, coin: 90,  gem: 1, text: 'Jawab 10 soal di bawah 5 detik' }
  ];

  /* Lencana. `check(p)` menerima profil dan mengembalikan boolean. */
  var BADGES = [
    { id: 'debut',   icon: '🎬', name: 'Debut',        desc: 'Main 1 pertandingan',
      check: function (p) { return p.played >= 1; } },
    { id: 'menang1', icon: '🎖️', name: 'Kemenangan Perdana', desc: 'Menang sekali',
      check: function (p) { return p.wins >= 1; } },
    { id: 'runtun10',icon: '🔥', name: 'Panas',         desc: 'Runtun 10 benar',
      check: function (p) { return p.bestStreak >= 10; } },
    { id: 'sempurna',icon: '💯', name: 'Nilai Penuh',   desc: 'Satu duel tanpa salah',
      check: function (p) { return p.perfects >= 1; } },
    { id: 'kilat',   icon: '⚡', name: 'Secepat Kilat', desc: 'Jawab benar < 2 detik',
      check: function (p) { return p.fastest > 0 && p.fastest < 2000; } },
    { id: 'juara',   icon: '🏆', name: 'Juara Turnamen', desc: 'Menangi 1 turnamen',
      check: function (p) { return p.trophies >= 1; } },
    { id: 'veteran', icon: '🛡️', name: 'Veteran',       desc: 'Main 25 pertandingan',
      check: function (p) { return p.played >= 25; } },
    { id: 'sarjana', icon: '🎓', name: 'Sarjana Angka', desc: '250 jawaban benar',
      check: function (p) { return p.totalCorrect >= 250; } },
    { id: 'sultan',  icon: '👑', name: 'Sang Juara',    desc: 'Capai tingkat tertinggi',
      check: function (p) { return p.xp >= 9000; } }
  ];

  /* Nama babak turnamen, dari 8 besar ke final. */
  var ROUNDS = ['Perempat Final', 'Semifinal', 'Final'];

  global.COC_DATA = {
    TIERS: TIERS, AVATARS: AVATARS, TOPICS: TOPICS, LEVELS: LEVELS,
    RIVALS: RIVALS, QUESTS: QUESTS, BADGES: BADGES, ROUNDS: ROUNDS,

    tierOf: function (xp) {
      var t = TIERS[0];
      for (var i = 0; i < TIERS.length; i++) if (xp >= TIERS[i].minXp) t = TIERS[i];
      return t;
    },
    nextTier: function (xp) {
      for (var i = 0; i < TIERS.length; i++) if (xp < TIERS[i].minXp) return TIERS[i];
      return null;
    },
    topic: function (id) {
      for (var i = 0; i < TOPICS.length; i++) if (TOPICS[i].id === id) return TOPICS[i];
      return TOPICS[0];
    }
  };
})(window);
