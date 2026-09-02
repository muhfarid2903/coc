/* ============================================================
   data.js — konstanta dunia permainan
   ============================================================ */
(function (global) {
  'use strict';

  /* Tingkatan pemain. minXp menaik; tingkat terakhir tanpa batas atas. */
  var TIERS = [
    { id: 'perunggu', name: 'Perunggu',  icon: '🥉', minXp: 0,    color: '#c98a52' },
    { id: 'perak',    name: 'Perak',     icon: '🥈', minXp: 600,  color: '#c9d3ee' },
    { id: 'emas',     name: 'Emas',      icon: '🥇', minXp: 1600, color: '#ffc53d' },
    { id: 'platina',  name: 'Platina',   icon: '💠', minXp: 3200, color: '#31e1ff' },
    { id: 'berlian',  name: 'Berlian',   icon: '💎', minXp: 5600, color: '#7cf5c8' },
    { id: 'juara',    name: 'Sang Juara', icon: '👑', minXp: 9000, color: '#ff9f1c' }
  ];

  var AVATARS = [
    '🦊', '🐼', '🦉', '🐯', '🦁', '🐨',
    '🐺', '🦄', '🐸', '🦖', '🐙', '🦈',
    '🧑‍🚀', '🧙', '🥷', '🤖', '👾', '🐝'
  ];

  /* Topik soal. `gen` menunjuk fungsi di questions.js, `time` detik dasar. */
  var TOPICS = [
    { id: 'kilat',    name: 'Hitung Kilat',    icon: '⚡', time: 13,
      desc: 'Tambah, kurang, kali, bagi — adu kecepatan',
      grad: 'linear-gradient(135deg,#ffe08a,#ffc53d,#ff9f1c)', color: '#ffc53d' },
    { id: 'aljabar',  name: 'Duel Aljabar',    icon: '🧮', time: 22,
      desc: 'Cari nilai x sebelum waktu habis',
      grad: 'linear-gradient(135deg,#a6c0ff,#4d7cff,#2f5ce0)', color: '#4d7cff' },
    { id: 'geometri', name: 'Serbu Geometri',  icon: '📐', time: 26,
      desc: 'Luas, keliling, dan volume bangun',
      grad: 'linear-gradient(135deg,#c8a6ff,#9b6bff,#6a3fd6)', color: '#9b6bff' },
    { id: 'pecahan',  name: 'Pecahan & Persen', icon: '🍕', time: 22,
      desc: 'Potongan harga, rasio, dan pecahan',
      grad: 'linear-gradient(135deg,#ffb3cd,#ff5fa2,#e0257f)', color: '#ff5fa2' },
    { id: 'pola',     name: 'Baca Pola',       icon: '🔢', time: 22,
      desc: 'Tebak angka berikutnya dalam deret',
      grad: 'linear-gradient(135deg,#8ff5d5,#2ee6a0,#12b981)', color: '#2ee6a0' },
    { id: 'cerita',   name: 'Soal Cerita',     icon: '📖', time: 34,
      desc: 'Cerita sehari-hari yang perlu dihitung',
      grad: 'linear-gradient(135deg,#7ee8f5,#31e1ff,#1195c4)', color: '#31e1ff' },
    { id: 'campuran', name: 'Serba-serbi',     icon: '🎲', time: 24,
      desc: 'Semua topik diacak jadi satu',
      grad: 'linear-gradient(135deg,#ffd08a,#ff8a5c,#f2542d)', color: '#ff8a5c' }
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
