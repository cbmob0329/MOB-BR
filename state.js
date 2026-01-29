// state.js (FULL) MOB BR
// ゲーム全体の状態管理（保存/読込・週進行・所持データの土台）
// ルール：勝手に仕様を省かない / ファイル名変更しない / ここは状態だけ担当

(() => {
  'use strict';

  const ST = (window.MOBBR_STATE = window.MOBBR_STATE || {});
  const LS_KEY = 'MOBBR_SAVE_V1';

  // =========================
  // Utils
  // =========================
  function clamp(v, a, b) {
    v = Number(v || 0);
    return Math.max(a, Math.min(b, v));
  }
  function deepCopy(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  // =========================
  // 初期ステータス（プレイヤー企業）
  // =========================
  function createDefaultPlayerMeta() {
    return {
      year: 1989,
      week: 1, // 第1週
      split: 'SP1', // SP1 / SP2 / CHAMP
      companyRank: 1,
      gold: 0,
      lastWeeklyIncome: 0,
      lastWeeklyIncomeMsg: '',
    };
  }

  // 週収入（確定）
  function calcWeeklyIncomeByRank(rank) {
    rank = Number(rank || 1);
    if (rank >= 31) return 3000;
    if (rank >= 21) return 2000;
    if (rank >= 11) return 1000;
    if (rank >= 6) return 800;
    return 500; // 1〜5
  }

  // =========================
  // 初期チームスロット（A/B/C）
  // =========================
  function createDefaultTeams() {
    // 初期はAに3人、B/Cは空でもOK（UIで編成する）
    // ただし「同じキャラは複数スロットに入れない」ルールはui側で制御
    return {
      A: { name: 'PLAYER TEAM', members: ['p_001', 'p_002', 'p_003'] },
      B: { name: 'PLAYER TEAM', members: [] },
      C: { name: 'PLAYER TEAM', members: [] },
    };
  }

  // =========================
  // 初期所持キャラ（プレイヤー初期3人）
  // data_players.js 側の定義を参照して埋める前提
  // stateは「所持と経験値」を管理
  // =========================
  function createDefaultRoster() {
    return {
      ownedIds: ['p_001', 'p_002', 'p_003'],
      // 経験値は「能力ごとに0〜19を保持し、20で+1上昇」の土台
      exp: {
        p_001: { HP: 0, Mental: 0, Move: 0, Aim: 0, Agility: 0, Technique: 0, Support: 0, Hunt: 0 },
        p_002: { HP: 0, Mental: 0, Move: 0, Aim: 0, Agility: 0, Technique: 0, Support: 0, Hunt: 0 },
        p_003: { HP: 0, Mental: 0, Move: 0, Aim: 0, Agility: 0, Technique: 0, Support: 0, Hunt: 0 },
      },
      // 装備（各キャラ最大5）
      equips: {
        p_001: [],
        p_002: [],
        p_003: [],
      },
    };
  }

  // =========================
  // 初期所持アイテム
  // =========================
  function createDefaultInventory() {
    return {
      items: {
        // itemId: count
      },
      coachSkills: {
        // coachSkillId: count
      },
    };
  }

  // =========================
  // 大会結果保存（履歴）
  // =========================
  function createDefaultRecords() {
    return {
      // 年ごとに保存
      years: {
        // 1989: { ... }
      },

      // 年間個人キル/アシスト合計（簡易：キャラID→数）
      yearlyStats: {
        // 1989: { kills:{}, assists:{} }
      },
    };
  }

  // =========================
  // 現在進行中の大会状況
  // =========================
  function createDefaultTournamentProgress() {
    return {
      active: null,
      // 例：
      // active: {
      //   type: 'LOCAL'|'NATIONAL'|'WORLD',
      //   year: 1989,
      //   split: 'SP1',
      //   weekTag: '2月第1週',
      //   teamsCount: 20 or 40,
      //   matchesDone: 0,
      //   totalMatches: 5,
      //   standings: [],
      // }
      lastShownMessage: '',
    };
  }

  // =========================
  // UI・表示用（保存してもOK）
  // =========================
  function createDefaultUIState() {
    return {
      playerOutfitIndex: 0, // 0=P1
      lastScreen: 'MAIN', // MAIN / TOURNAMENT / RESULT etc.
      toastQueue: [],
    };
  }

  // =========================
  // 全初期セーブデータ
  // =========================
  function createDefaultSave() {
    return {
      version: 1,
      meta: createDefaultPlayerMeta(),
      teams: createDefaultTeams(),
      roster: createDefaultRoster(),
      inventory: createDefaultInventory(),
      records: createDefaultRecords(),
      tourney: createDefaultTournamentProgress(),
      ui: createDefaultUIState(),
    };
  }

  // =========================
  // State Core
  // =========================
  ST.saveData = ST.saveData || createDefaultSave();

  ST.get = function get() {
    return ST.saveData;
  };

  ST.set = function set(newState) {
    ST.saveData = deepCopy(newState);
    return ST.saveData;
  };

  ST.reset = function reset() {
    ST.saveData = createDefaultSave();
    return ST.saveData;
  };

  // =========================
  // Save / Load
  // =========================
  ST.saveToLocalStorage = function saveToLocalStorage() {
    try {
      const json = JSON.stringify(ST.saveData);
      localStorage.setItem(LS_KEY, json);
      return { ok: true };
    } catch (e) {
      return { ok: false, err: String(e) };
    }
  };

  ST.loadFromLocalStorage = function loadFromLocalStorage() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return { ok: false, err: 'NO_SAVE' };

      const data = JSON.parse(raw);
      // 最低限の整合（足りないものを補完）
      const base = createDefaultSave();
      ST.saveData = mergeSave(base, data);
      return { ok: true, data: ST.saveData };
    } catch (e) {
      return { ok: false, err: String(e) };
    }
  };

  ST.deleteSave = function deleteSave() {
    try {
      localStorage.removeItem(LS_KEY);
      return { ok: true };
    } catch (e) {
      return { ok: false, err: String(e) };
    }
  };

  // baseにincomingを被せる（深めの保険）
  function mergeSave(base, incoming) {
    if (!incoming || typeof incoming !== 'object') return base;
    const out = deepCopy(base);

    // shallow merge + nested merge
    for (const k of Object.keys(incoming)) {
      if (incoming[k] && typeof incoming[k] === 'object' && !Array.isArray(incoming[k])) {
        out[k] = { ...(out[k] || {}), ...(incoming[k] || {}) };
      } else {
        out[k] = incoming[k];
      }
    }

    // nested required
    out.meta = { ...base.meta, ...(incoming.meta || {}) };
    out.teams = { ...base.teams, ...(incoming.teams || {}) };
    out.roster = { ...base.roster, ...(incoming.roster || {}) };
    out.inventory = { ...base.inventory, ...(incoming.inventory || {}) };
    out.records = { ...base.records, ...(incoming.records || {}) };
    out.tourney = { ...base.tourney, ...(incoming.tourney || {}) };
    out.ui = { ...base.ui, ...(incoming.ui || {}) };

    return out;
  }

  // =========================
  // Week Progress
  // =========================
  ST.addWeeklyIncome = function addWeeklyIncome() {
    const s = ST.saveData;
    const inc = calcWeeklyIncomeByRank(s.meta.companyRank);
    s.meta.gold += inc;
    s.meta.lastWeeklyIncome = inc;
    s.meta.lastWeeklyIncomeMsg = `${inc}G獲得！`;
    return inc;
  };

  ST.advanceWeek = function advanceWeek() {
    // 1回の行動＝1週消費（修行などの後に呼ばれる前提）
    const s = ST.saveData;

    // 週収入
    ST.addWeeklyIncome();

    // 週進行
    s.meta.week += 1;

    // 1年=12ヶ月、1ヶ月=4週、ただし大会スケジュールは rules側で判定する
    // ここは単純に「週カウントを進める」だけ
    if (s.meta.week > 48) {
      s.meta.week = 1;
      s.meta.year += 1;
    }

    return { year: s.meta.year, week: s.meta.week };
  };

  // =========================
  // Gold / Rank Helpers
  // =========================
  ST.addGold = function addGold(amount) {
    amount = Math.floor(Number(amount || 0));
    if (!Number.isFinite(amount)) amount = 0;
    ST.saveData.meta.gold += amount;
    if (ST.saveData.meta.gold < 0) ST.saveData.meta.gold = 0;
    return ST.saveData.meta.gold;
  };

  ST.spendGold = function spendGold(amount) {
    amount = Math.floor(Number(amount || 0));
    if (!Number.isFinite(amount)) amount = 0;
    if (amount <= 0) return { ok: true };

    if (ST.saveData.meta.gold >= amount) {
      ST.saveData.meta.gold -= amount;
      return { ok: true };
    }
    return { ok: false, err: 'NOT_ENOUGH_GOLD' };
  };

  ST.setCompanyRank = function setCompanyRank(rank) {
    rank = clamp(rank, 1, 999);
    ST.saveData.meta.companyRank = rank;
    return rank;
  };

  // =========================
  // Inventory Helpers
  // =========================
  ST.getItemCount = function getItemCount(itemId) {
    const inv = ST.saveData.inventory.items;
    return Number(inv[itemId] || 0);
  };

  ST.addItem = function addItem(itemId, count) {
    count = Math.floor(Number(count || 1));
    if (!itemId) return false;
    if (count <= 0) return false;

    const inv = ST.saveData.inventory.items;
    inv[itemId] = Number(inv[itemId] || 0) + count;
    return true;
  };

  ST.consumeItem = function consumeItem(itemId, count) {
    count = Math.floor(Number(count || 1));
    if (!itemId) return { ok: false, err: 'NO_ITEMID' };
    if (count <= 0) return { ok: true };

    const inv = ST.saveData.inventory.items;
    const have = Number(inv[itemId] || 0);
    if (have >= count) {
      inv[itemId] = have - count;
      if (inv[itemId] <= 0) delete inv[itemId];
      return { ok: true };
    }
    return { ok: false, err: 'NOT_ENOUGH_ITEMS' };
  };

  ST.getCoachSkillCount = function getCoachSkillCount(skillId) {
    const inv = ST.saveData.inventory.coachSkills;
    return Number(inv[skillId] || 0);
  };

  ST.addCoachSkill = function addCoachSkill(skillId, count) {
    count = Math.floor(Number(count || 1));
    if (!skillId) return false;
    if (count <= 0) return false;

    const inv = ST.saveData.inventory.coachSkills;
    inv[skillId] = Number(inv[skillId] || 0) + count;
    return true;
  };

  ST.consumeCoachSkill = function consumeCoachSkill(skillId, count) {
    count = Math.floor(Number(count || 1));
    if (!skillId) return { ok: false, err: 'NO_SKILLID' };
    if (count <= 0) return { ok: true };

    const inv = ST.saveData.inventory.coachSkills;
    const have = Number(inv[skillId] || 0);
    if (have >= count) {
      inv[skillId] = have - count;
      if (inv[skillId] <= 0) delete inv[skillId];
      return { ok: true };
    }
    return { ok: false, err: 'NOT_ENOUGH_SKILLS' };
  };

  // =========================
  // Roster / Equip
  // =========================
  ST.isOwned = function isOwned(charId) {
    return ST.saveData.roster.ownedIds.includes(charId);
  };

  ST.addCharacter = function addCharacter(charId) {
    if (!charId) return false;
    const r = ST.saveData.roster;
    if (!r.ownedIds.includes(charId)) {
      r.ownedIds.push(charId);
    }
    if (!r.exp[charId]) {
      r.exp[charId] = { HP: 0, Mental: 0, Move: 0, Aim: 0, Agility: 0, Technique: 0, Support: 0, Hunt: 0 };
    }
    if (!r.equips[charId]) {
      r.equips[charId] = [];
    }
    return true;
  };

  ST.removeCharacter = function removeCharacter(charId) {
    // 基本使わないが、編成外すなどは可能なのでキャラ削除自体は慎重に
    const r = ST.saveData.roster;
    r.ownedIds = r.ownedIds.filter((id) => id !== charId);
    delete r.exp[charId];
    delete r.equips[charId];
    return true;
  };

  ST.getEquips = function getEquips(charId) {
    const r = ST.saveData.roster;
    return r.equips[charId] ? r.equips[charId].slice() : [];
  };

  ST.setEquips = function setEquips(charId, arr) {
    const r = ST.saveData.roster;
    if (!r.equips[charId]) r.equips[charId] = [];
    const next = Array.isArray(arr) ? arr.slice(0, 5) : [];
    r.equips[charId] = next;
    return next;
  };

  // =========================
  // Training EXP Apply (土台)
  // 実際の「能力値上昇」は data_players.js の基礎値と合算するので
  // ここでは「exp加算→20で+1」をサポートするだけ
  // =========================
  ST.addExp = function addExp(charId, key, amount) {
    const r = ST.saveData.roster;
    if (!r.exp[charId]) {
      r.exp[charId] = { HP: 0, Mental: 0, Move: 0, Aim: 0, Agility: 0, Technique: 0, Support: 0, Hunt: 0 };
    }
    if (!r.exp[charId][key] && r.exp[charId][key] !== 0) r.exp[charId][key] = 0;
    amount = Math.floor(Number(amount || 0));
    if (!Number.isFinite(amount)) amount = 0;

    r.exp[charId][key] += amount;
    return r.exp[charId][key];
  };

  ST.consumeExpToLevelUp = function consumeExpToLevelUp(charId, key) {
    // expが20以上なら、何回でも繰り上げ（育成アイテム連打にも対応）
    const r = ST.saveData.roster;
    if (!r.exp[charId]) return 0;
    if (!Number.isFinite(r.exp[charId][key])) r.exp[charId][key] = 0;

    let up = 0;
    while (r.exp[charId][key] >= 20) {
      r.exp[charId][key] -= 20;
      up += 1;
    }
    return up;
  };

  // =========================
  // UI Toast
  // =========================
  ST.pushToast = function pushToast(text) {
    const ui = ST.saveData.ui;
    ui.toastQueue.push({ text: String(text || ''), t: Date.now() });
  };

  ST.popToast = function popToast() {
    const ui = ST.saveData.ui;
    return ui.toastQueue.shift() || null;
  };

  // =========================
  // Expose
  // =========================
  window.STATE = ST; // legacy alias (optional)

})();
