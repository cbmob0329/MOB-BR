/* =====================================================
   state.js  (FULL)
   MOB Tournament Simulation
   ゲーム状態（年週 / 企業ランク / 所持G / チーム / 履歴）
   ===================================================== */

const State = {};
window.State = State;

/* =========================
   初期データ
   ========================= */

State.init = function () {
  // 基本状態
  State.gold = 0;

  // 企業ランク（1が最強…等は後で調整可能。今は初期10想定）
  State.companyRank = 10;

  // 時間（1989年スタート）
  State.time = {
    year: 1989,
    week: 1,
    nextTournament: { name: 'SP1 ローカル大会', date: '2月第1週' }
  };

  // 大会進行中情報（参加中の大会メニュー用）
  State.currentTournament = null;

  // 履歴（年ごとの大会結果・キル/アシスト集計などの土台）
  State.history = {
    tournaments: [], // {year, seasonKey, name, result}
    yearly: {}       // { [year]: { killsByPlayer:{}, assistsByPlayer:{}, finalCompanyRank } }
  };

  // プレイヤーチーム（3人）
  State.playerTeam = State.createInitialPlayerTeam();

  // 所持キャラ（オファーで増える想定）
  State.ownedPlayers = State.playerTeam.members.slice();

  // 所持アイテム・コーチスキル（後で本格実装）
  State.inventory = {
    items: {},        // { itemId: count }
    coachSkills: []   // [ skillId, ... ]
  };

  State.refreshNextTournamentInfo();
};

/* =========================
   初期チーム生成（P1想定）
   data_players.js が未確定でも動くように
   ========================= */

State.createInitialPlayerTeam = function () {
  // data_players.js が用意される前提だが、無くても落ちない
  const pool = (window.DATA_PLAYERS && Array.isArray(window.DATA_PLAYERS))
    ? window.DATA_PLAYERS
    : null;

  // 3人分
  const members = [];

  if (pool && pool.length >= 3) {
    for (let i = 0; i < 3; i++) {
      members.push(State.normalizePlayer(pool[i]));
    }
  } else {
    // プレースホルダ（後で差し替わる）
    members.push(State.normalizePlayer({
      id: 'P-001',
      name: 'プレイヤー1',
      stats: State.defaultStats(),
      passive: { name: '未設定', desc: '後で設定' },
      ability: { name: '未設定', desc: '後で設定', uses: 1 },
      ult: { name: '未設定', desc: '後で設定', uses: 1 }
    }));
    members.push(State.normalizePlayer({
      id: 'P-002',
      name: 'プレイヤー2',
      stats: State.defaultStats(),
      passive: { name: '未設定', desc: '後で設定' },
      ability: { name: '未設定', desc: '後で設定', uses: 1 },
      ult: { name: '未設定', desc: '後で設定', uses: 1 }
    }));
    members.push(State.normalizePlayer({
      id: 'P-003',
      name: 'プレイヤー3',
      stats: State.defaultStats(),
      passive: { name: '未設定', desc: '後で設定' },
      ability: { name: '未設定', desc: '後で設定', uses: 1 },
      ult: { name: '未設定', desc: '後で設定', uses: 1 }
    }));
  }

  return {
    id: 'PLAYER_TEAM',
    name: 'PLAYER TEAM',
    group: 'A',
    image: 'P1.png',
    members,
    // 連携（Synergy）は今は固定20スタート想定（最大200想定は後で）
    synergy: 20
  };
};

State.defaultStats = function () {
  return {
    HP: 60,
    Armor: 100,       // 仕様：基本100固定前提
    Mental: 60,
    Move: 60,
    Aim: 60,
    Agility: 60,
    Technique: 60,
    Support: 60,
    Hunt: 60
  };
};

State.normalizePlayer = function (p) {
  const stats = Object.assign(State.defaultStats(), (p.stats || {}));
  // Armorは基本100（上書きされても最大100で丸めるのは後で battle 側でやる）
  if (stats.Armor === undefined || stats.Armor === null) stats.Armor = 100;

  return {
    id: p.id || ('P-' + Math.random().toString(36).slice(2)),
    name: p.name || '???',
    stats,
    passive: p.passive || { name: '未設定', desc: '' },
    ability: p.ability || { name: '未設定', desc: '', uses: 1 },
    ult: p.ult || { name: '未設定', desc: '', uses: 1 }
  };
};

/* =========================
   スケジュール関連
   ========================= */

State.getScheduleText = function () {
  // data_const.js で提供されるのが本命
  if (window.DATA_CONST && typeof window.DATA_CONST.scheduleText === 'string') {
    return window.DATA_CONST.scheduleText;
  }

  // fallback（あなたの仕様をそのまま文字化）
  return [
    '2月第1週',
    'SP1 ローカル大会',
    '',
    '3月第1週',
    'SP1 ナショナル大会',
    'A & B  C & D  A & C',
    '3月第2週',
    'B & C',
    'A & D',
    'B & D',
    '3月第3週',
    'ナショナル大会ラストチャンス',
    '4月第1週',
    'SP1 ワールドファイナル',
    '',
    '7月第1週',
    'SP2 ローカル大会',
    '',
    '8月第1週',
    'SP2 ナショナル大会',
    'A & B  C & D  A & C',
    '8月第2週',
    'B & C',
    'A & D',
    'B & D',
    '8月第3週',
    'SP2 ナショナル大会ラストチャンス',
    '9月第1週',
    'SP2 ワールドファイナル',
    '',
    '11月第1週',
    'チャンピオンシップ ローカル大会',
    '',
    '12月第1週',
    'チャンピオンシップ ナショナル大会',
    'A & B  C & D  A & C',
    '12月第2週',
    'B & C',
    'A & D',
    'B & D',
    '12月第3週',
    'チャンピオンシップ ナショナル大会ラストチャンス',
    '',
    '1月第2週',
    'チャンピオンシップ ワールドファイナル'
  ].join('\n');
};

/**
 * 現在の年週が「大会週」かどうか判定してイベントを返す
 * 返り値例： { key, name, tier, seasonKey }
 */
State.getTournamentAtCurrentTime = function () {
  // data_const.js がある場合はそれを優先
  if (window.DATA_CONST && Array.isArray(window.DATA_CONST.tournaments)) {
    return State.findTournamentFromConst();
  }

  // fallback：1989年固定＆週番号で仮判定（後で data_const.js に置き換え）
  // ※「今は動く」を優先。正確な週対応は data_const.js で確定させる。
  const w = State.time.week;

  // 仮：10週=SP1ローカル、14週=SP1ナショナル、18週=SP1ワールド…のように置く（暫定）
  if (w === 5)  return { key: 'SP1_LOCAL', name: 'SP1 ローカル大会', tier: 'LOCAL', seasonKey: 'SP1' };
  if (w === 9)  return { key: 'SP1_NATIONAL', name: 'SP1 ナショナル大会', tier: 'NATIONAL', seasonKey: 'SP1' };
  if (w === 13) return { key: 'SP1_WORLD', name: 'SP1 ワールドファイナル', tier: 'WORLD', seasonKey: 'SP1' };

  if (w === 25) return { key: 'SP2_LOCAL', name: 'SP2 ローカル大会', tier: 'LOCAL', seasonKey: 'SP2' };
  if (w === 29) return { key: 'SP2_NATIONAL', name: 'SP2 ナショナル大会', tier: 'NATIONAL', seasonKey: 'SP2' };
  if (w === 33) return { key: 'SP2_WORLD', name: 'SP2 ワールドファイナル', tier: 'WORLD', seasonKey: 'SP2' };

  if (w === 45) return { key: 'CHAMP_LOCAL', name: 'チャンピオンシップ ローカル大会', tier: 'LOCAL', seasonKey: 'CHAMP' };
  if (w === 49) return { key: 'CHAMP_NATIONAL', name: 'チャンピオンシップ ナショナル大会', tier: 'NATIONAL', seasonKey: 'CHAMP' };
  if (w === 2)  return { key: 'CHAMP_WORLD', name: 'チャンピオンシップ ワールドファイナル', tier: 'WORLD', seasonKey: 'CHAMP' };

  return null;
};

State.findTournamentFromConst = function () {
  const year = State.time.year;
  const week = State.time.week;

  // DATA_CONST.tournaments: [{year, week, key, name, tier, seasonKey, dateLabel}, ...]
  const list = window.DATA_CONST.tournaments;
  for (const t of list) {
    if (t.year === year && t.week === week) return t;
  }
  return null;
};

/* =========================
   次の大会表示更新
   ========================= */

State.refreshNextTournamentInfo = function () {
  // data_const.js がある場合：次の大会を検索
  if (window.DATA_CONST && Array.isArray(window.DATA_CONST.tournaments)) {
    const next = State.findNextTournamentFromConst();
    if (next) {
      State.time.nextTournament = {
        name: next.name,
        date: next.dateLabel || State.formatWeekLabel(next.monthLabel, next.weekLabel) || '---'
      };
      return;
    }
  }

  // fallback：固定表示（暫定）
  State.time.nextTournament = { name: 'SP1 ローカル大会', date: '2月第1週' };
};

State.findNextTournamentFromConst = function () {
  const year = State.time.year;
  const week = State.time.week;
  const list = window.DATA_CONST.tournaments;

  // 同年で次、なければ翌年最初
  let candidate = null;
  for (const t of list) {
    if (t.year === year && t.week > week) {
      if (!candidate || t.week < candidate.week) candidate = t;
    }
  }
  if (candidate) return candidate;

  // 翌年
  let nextYearCandidate = null;
  for (const t of list) {
    if (t.year === year + 1) {
      if (!nextYearCandidate || t.week < nextYearCandidate.week) nextYearCandidate = t;
    }
  }
  return nextYearCandidate;
};

State.formatWeekLabel = function (monthLabel, weekLabel) {
  if (!monthLabel || !weekLabel) return null;
  return `${monthLabel}第${weekLabel}週`;
};

/* =========================
   大会結果適用（履歴に保存）
   ========================= */

State.applyTournamentResult = function (result) {
  // result の中身は sim_tournament_core 側で整備される想定
  // ここでは「履歴に残す」ことを最優先に土台を作る

  const entry = {
    year: State.time.year,
    seasonKey: result.seasonKey || 'UNKNOWN',
    name: result.name || 'UNKNOWN',
    tier: result.tier || 'UNKNOWN',
    result
  };

  State.history.tournaments.push(entry);

  // 年間まとめの器
  const y = State.time.year;
  if (!State.history.yearly[y]) {
    State.history.yearly[y] = {
      killsByPlayer: {},
      assistsByPlayer: {},
      finalCompanyRank: State.companyRank
    };
  }

  // ここでキル・アシスト集計（結果形式は後で確定）
  // 例：result.playerStats = [{name,kills,assists},...]
  if (Array.isArray(result.playerStats)) {
    for (const ps of result.playerStats) {
      const n = ps.name || '???';
      State.history.yearly[y].killsByPlayer[n] = (State.history.yearly[y].killsByPlayer[n] || 0) + (ps.kills || 0);
      State.history.yearly[y].assistsByPlayer[n] = (State.history.yearly[y].assistsByPlayer[n] || 0) + (ps.assists || 0);
    }
  }

  // 企業ランク変動は「大会ロジック確定後」に sim_rules 側で扱う
  State.history.yearly[y].finalCompanyRank = State.companyRank;

  // 次の大会表示更新
  State.refreshNextTournamentInfo();
};

/* =========================
   ユーティリティ
   ========================= */

State.clamp = function (v, min, max) {
  if (v < min) return min;
  if (v > max) return max;
  return v;
};
