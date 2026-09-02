/* ============================================================
   store.js — profil pemain, misi harian, dan papan peringkat.
   Semua disimpan di localStorage perangkat masing-masing.
   ============================================================ */
(function (global) {
  'use strict';

  var D = global.COC_DATA, Q = global.COC_Q;
  var KEY = 'coc.profil.v1';

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }

  function blank() {
    return {
      v: 1,
      name: '', ava: '🦊',
      xp: 0, coin: 150, gem: 3,
      played: 0, wins: 0, losses: 0, draws: 0, trophies: 0, perfects: 0,
      totalCorrect: 0, totalAnswered: 0, bestStreak: 0, fastest: 0,
      badges: [], sound: true,
      quests: null, board: null, boardDay: '',
      history: []
    };
  }

  var P = blank();

  function read() {
    try {
      var raw = global.localStorage.getItem(KEY);
      if (!raw) return null;
      var o = JSON.parse(raw);
      return (o && typeof o === 'object') ? o : null;
    } catch (e) { return null; }
  }

  function save() {
    try { global.localStorage.setItem(KEY, JSON.stringify(P)); } catch (e) { /* mode privat */ }
    return P;
  }

  /* ---------- Misi harian ---------- */
  function rollQuests() {
    var pool = D.QUESTS.slice();
    Q.shuffle(pool);
    return {
      date: today(),
      list: pool.slice(0, 3).map(function (q) { return { id: q.id, prog: 0, claimed: false }; })
    };
  }

  function questDef(id) {
    for (var i = 0; i < D.QUESTS.length; i++) if (D.QUESTS[i].id === id) return D.QUESTS[i];
    return null;
  }

  function syncQuests() {
    if (!P.quests || P.quests.date !== today()) { P.quests = rollQuests(); save(); }
    return P.quests;
  }

  /* Naikkan progres semua misi bertipe `kind`. Untuk 'streak', nilai
     dipakai sebagai capaian tertinggi, bukan penjumlahan. */
  function bump(kind, n) {
    syncQuests();
    if (!n) return;
    var changed = false;
    P.quests.list.forEach(function (q) {
      var def = questDef(q.id);
      if (!def || def.kind !== kind || q.prog >= def.goal) return;
      q.prog = kind === 'streak' ? Math.max(q.prog, n) : q.prog + n;
      if (q.prog > def.goal) q.prog = def.goal;
      changed = true;
    });
    if (changed) save();
  }

  function claim(id) {
    syncQuests();
    var def = questDef(id), got = null;
    P.quests.list.forEach(function (q) {
      if (q.id !== id || q.claimed || !def || q.prog < def.goal) return;
      q.claimed = true;
      P.coin += def.coin; P.gem += def.gem;
      got = def;
    });
    if (got) save();
    return got;
  }

  /* ---------- Papan peringkat ---------- */
  function seedBoard() {
    return D.RIVALS.map(function (r) {
      return { name: r.name, ava: r.ava, xp: Math.round(r.skill * 6200 + Q.ri(-450, 450)) };
    });
  }

  /* Bot ikut naik XP tiap hari supaya papan terasa hidup. */
  function syncBoard() {
    if (!P.board || !P.board.length) { P.board = seedBoard(); P.boardDay = today(); save(); return; }
    if (P.boardDay !== today()) {
      P.board.forEach(function (b) { b.xp += Q.ri(20, 160); });
      P.boardDay = today();
      save();
    }
  }

  function leaderboard() {
    syncBoard();
    var rows = P.board.map(function (b) { return { name: b.name, ava: b.ava, xp: b.xp, me: false }; });
    rows.push({ name: P.name || 'Kamu', ava: P.ava, xp: P.xp, me: true });
    rows.sort(function (a, b) { return b.xp - a.xp; });
    return rows;
  }

  function myRank() {
    var rows = leaderboard();
    for (var i = 0; i < rows.length; i++) if (rows[i].me) return i + 1;
    return rows.length;
  }

  /* ---------- Lencana ---------- */
  function checkBadges() {
    var baru = [];
    D.BADGES.forEach(function (b) {
      if (P.badges.indexOf(b.id) === -1 && b.check(P)) { P.badges.push(b.id); baru.push(b); }
    });
    if (baru.length) save();
    return baru;
  }

  /* ---------- Catat hasil satu pertandingan ---------- */
  function record(r) {
    P.played += 1;
    if (r.result === 'win') P.wins += 1;
    else if (r.result === 'lose') P.losses += 1;
    else if (r.result === 'draw') P.draws += 1;

    P.totalCorrect += r.correct;
    P.totalAnswered += r.total;
    if (r.streak > P.bestStreak) P.bestStreak = r.streak;
    if (r.fastest > 0 && (P.fastest === 0 || r.fastest < P.fastest)) P.fastest = r.fastest;
    if (r.correct === r.total && r.total > 0) P.perfects += 1;

    var tierBefore = D.tierOf(P.xp);
    P.xp += r.xp;
    P.coin += r.coin;
    P.gem += r.gem || 0;
    var tierAfter = D.tierOf(P.xp);

    P.history.unshift({
      t: Date.now(), topic: r.topic, level: r.level, mode: r.mode,
      me: r.myScore, op: r.opScore, result: r.result,
      correct: r.correct, total: r.total
    });
    if (P.history.length > 40) P.history.length = 40;

    bump('match', 1);
    bump('correct', r.correct);
    bump('fast', r.fastCount || 0);
    bump('streak', r.streak);
    if (r.result === 'win') bump('win', 1);

    save();
    return {
      naikTingkat: tierAfter.id !== tierBefore.id ? tierAfter : null,
      lencanaBaru: checkBadges()
    };
  }

  function trophy() { P.trophies += 1; save(); return checkBadges(); }

  function spend(coin, gem) {
    if (P.coin < (coin || 0) || P.gem < (gem || 0)) return false;
    P.coin -= (coin || 0); P.gem -= (gem || 0); save();
    return true;
  }

  function load() {
    var o = read();
    if (o) {
      var base = blank();
      for (var k in base) if (Object.prototype.hasOwnProperty.call(base, k) && o[k] !== undefined) base[k] = o[k];
      P = base;
    } else {
      P = blank();
    }
    syncQuests(); syncBoard();
    return P;
  }

  function reset() { P = blank(); syncQuests(); syncBoard(); save(); return P; }

  global.COC_STORE = {
    load: load, save: save, reset: reset,
    get p() { return P; },
    quests: syncQuests, questDef: questDef, bump: bump, claim: claim,
    leaderboard: leaderboard, myRank: myRank,
    record: record, trophy: trophy, spend: spend, checkBadges: checkBadges,
    today: today
  };
})(window);
