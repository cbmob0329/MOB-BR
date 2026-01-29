/* =========================================================
  state.js (FULL)
  - 週/年/所持G/企業ランク/進行状況
  - Save/Load（localStorage）
  - game.js から参照して使うための “単一の状態ソース”
========================================================= */

(function () {
  "use strict";

  // -------------------------------------------------------
  // Versioned Save Key
  // -------------------------------------------------------
  const SAVE_KEY = "mob_apex_sim_save_v1";

  // -------------------------------------------------------
  // Company Ranks
  // 週給（毎週の収入）のみここで確定
  // ※詳細のランクアップ条件などは後で拡張
  // -------------------------------------------------------
  const COMPANY_RANKS = [
    { name: "D", weeklyGold: 80 },
    { name: "C", weeklyGold: 120 },
    { name: "B", weeklyGold: 180 },
    { name: "A", weeklyGold: 260 },
    { name: "S", weeklyGold: 360 },
  ];

  function findRank(name) {
    return COMPANY_RANKS.find((r) => r.name === name) || COMPANY_RANKS[0];
  }

  // -------------------------------------------------------
  // Default State (初期状態)
  // -------------------------------------------------------
  function makeDefaultState() {
    return {
      // time
      year: 1,
      week: 1,

      // economy / org
      gold: 200,
      companyName: "MOB COMPANY",
      companyRank: "D",

      // team
      teamName: "PLAYER TEAM",

      // tournament / progress
      nextTournament: "SP1 ローカルリーグ",
      statusText: "準備中",

      // roster / inventory (後で拡張)
      roster: [],        // data_players.js で初期注入
      inventory: [],     // data_items.js で扱う想定
      coachSkills: [],   // data_coachskills.js で扱う想定

      // runtime cache（試合中などの一時状態：セーブ対象に含めてもOK）
      run: {
        lastMatch: null,     // 直近の試合結果（簡易）
        lastTournament: null // 直近の大会結果（簡易）
      },
    };
  }

  const STATE = makeDefaultState();

  // -------------------------------------------------------
  // Merge Load Helper（互換性維持）
  // -------------------------------------------------------
  function deepMerge(dst, src) {
    if (!src || typeof src !== "object") return dst;
    for (const k of Object.keys(src)) {
      const sv = src[k];
      const dv = dst[k];
      if (sv && typeof sv === "object" && !Array.isArray(sv)) {
        if (!dv || typeof dv !== "object" || Array.isArray(dv)) dst[k] = {};
        deepMerge(dst[k], sv);
      } else {
        dst[k] = sv;
      }
    }
    return dst;
  }

  // -------------------------------------------------------
  // Public API
  // -------------------------------------------------------
  function resetToDefault() {
    const d = makeDefaultState();
    // 参照を保つため、STATEオブジェクト自体は置き換えずに中身を差し替え
    for (const k of Object.keys(STATE)) delete STATE[k];
    deepMerge(STATE, d);
    return true;
  }

  function save(meta = {}) {
    const payload = {
      v: 1,
      t: Date.now(),
      meta: meta || {},
      state: STATE,
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
      return true;
    } catch (e) {
      return false;
    }
  }

  function load() {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    try {
      const obj = JSON.parse(raw);
      if (!obj || !obj.state) return false;

      // default → saved を merge（不足キーを補う）
      const d = makeDefaultState();
      for (const k of Object.keys(STATE)) delete STATE[k];
      deepMerge(STATE, d);
      deepMerge(STATE, obj.state);

      // 企業ランクは必ず正規化
      STATE.companyRank = findRank(STATE.companyRank).name;

      return true;
    } catch (e) {
      return false;
    }
  }

  function clearSave() {
    try {
      localStorage.removeItem(SAVE_KEY);
      return true;
    } catch (e) {
      return false;
    }
  }

  // 1週進める（週給も入る）
  function advanceWeek() {
    const r = findRank(STATE.companyRank);
    STATE.gold += r.weeklyGold;

    STATE.week += 1;
    if (STATE.week > 52) {
      STATE.week = 1;
      STATE.year += 1;
    }
    STATE.statusText = "進行中";
    return { weeklyGold: r.weeklyGold };
  }

  // 企業ランクを設定（存在しない値は丸める）
  function setCompanyRank(rankName) {
    STATE.companyRank = findRank(rankName).name;
    return STATE.companyRank;
  }

  // ゴールドの加算/減算（不足は止めたいケースが多いので戻り値を返す）
  function addGold(amount) {
    const a = Number(amount) || 0;
    STATE.gold += a;
    if (STATE.gold < 0) STATE.gold = 0;
    return STATE.gold;
  }

  function spendGold(cost) {
    const c = Math.max(0, Number(cost) || 0);
    if (STATE.gold < c) return false;
    STATE.gold -= c;
    return true;
  }

  // -------------------------------------------------------
  // Export
  // -------------------------------------------------------
  window.MOB_STATE = {
    SAVE_KEY,
    COMPANY_RANKS,
    STATE,

    resetToDefault,
    save,
    load,
    clearSave,

    advanceWeek,
    setCompanyRank,
    addGold,
    spendGold,
    findRank,
  };
})();
