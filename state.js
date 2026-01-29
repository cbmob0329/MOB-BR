/* =========================================================
   state.js (FULL)
   - ゲーム進行の状態管理（週/フェーズ/メッセージ/UI選択）
   - localStorage にセーブ/ロード（任意）
   - game.js は window.STATE を参照して進行
   ========================================================= */

(() => {
  'use strict';

  const LS_KEY = 'mob_brsim_save_v1';

  // ----------------------------
  // ENUMS
  // ----------------------------
  const PHASE = Object.freeze({
    BOOT: 'BOOT',
    MAIN: 'MAIN',
    SHOP: 'SHOP',
    TRAINING: 'TRAINING',
    TOURNAMENT_INTRO: 'TOURNAMENT_INTRO',
    DROP: 'DROP',
    MOVE: 'MOVE',
    HEAL: 'HEAL',
    BATTLE: 'BATTLE',
    TOURNAMENT_RESULT: 'TOURNAMENT_RESULT',
  });

  const TOURNAMENT = Object.freeze({
    NONE: 'NONE',
    SP1_LOCAL: 'SP1_LOCAL',
    SP1_NATIONAL: 'SP1_NATIONAL',
    SP1_LASTCHANCE: 'SP1_LASTCHANCE',
    SP1_WORLD: 'SP1_WORLD',
    SP2_LOCAL: 'SP2_LOCAL',
    SP2_NATIONAL: 'SP2_NATIONAL',
    SP2_LASTCHANCE: 'SP2_LASTCHANCE',
    SP2_WORLD: 'SP2_WORLD',
    CHAMP_LOCAL: 'CHAMP_LOCAL',
    CHAMP_NATIONAL: 'CHAMP_NATIONAL',
    CHAMP_LASTCHANCE: 'CHAMP_LASTCHANCE',
    CHAMP_WORLD: 'CHAMP_WORLD',
  });

  // ----------------------------
  // 初期値（※細部は game.js / sim_rules が埋める）
  // ----------------------------
  function defaultState() {
    return {
      version: 1,

      // UI/進行
      phase: PHASE.BOOT,
      subphase: '',
      modal: null,          // {title,text,buttons:[{id,label}]} など
      toast: null,          // {text, t, ms}
      messageCenter: null,  // {text, ms, important:true}

      // 時間（週単位）
      calendar: {
        year: 1990,     // 大会スケジュール前提（必要なら game.js で変更）
        month: 1,       // 1-12
        weekInMonth: 1, // 1-4（固定運用）
        weekIndex: 0,   // 通算週（加算用）
      },

      // 所持金など
      economy: {
        gold: 0,
      },

      // 企業ランク/チーム名（ゲーム起動時に決めてもOK）
      company: {
        name: 'PLAYER COMPANY',
        rank: 10,
        teamName: 'PLAYER TEAM',
      },

      // プレイヤーチーム編成（data_players.js 参照で埋める想定）
      playerTeam: {
        members: ['unic', 'nekoku', 'doo'], // data_players.js の id を想定
        imageKey: 'P1',                     // assets.js のキー（P1）
        synergy: 20,                        // 初期は20固定
        synergyPairs: {                     // 連携A-Bなど（任意）
          // 'unic|nekoku': 20,
        },
      },

      // 所持品・装備
      inventory: {
        items: {},        // { itemId: count }
        coachSkills: [],  // 装備中コーチスキルID（最大5）
      },

      // 大会関連（進行中トーナメント）
      tournament: {
        active: false,
        type: TOURNAMENT.NONE,
        group: 'A',              // A/B/C/D（プレイヤーは基本A）
        stageLabel: '',          // 表示用
        canParticipate: true,    // 出場権の有無（ルールで切り替え）
        matchIndex: 0,           // 進行中試合番号
        totalMatches: 0,         // その大会での試合数（現状の実装範囲で）
        standings: null,         // 結果順位配列など（sim_tournament_core が入れる）
        lastResult: null,        // {rank, qualified:true/false, text}
      },

      // マッチ/バトル進行（sim）
      sim: {
        seed: 0,
        round: 1,
        aliveTeams: 20,
        currentAreaId: null,
        // battle
        battle: null, // {teams:[...], log:[...], resolved:true/false ...} を入れる想定
        // ログ（メイン画面にも流す）
        log: [],
      },

      // フラグ（チュートリアル等）
      flags: {
        firstBoot: true,
      },
    };
  }

  // ----------------------------
  // Helper
  // ----------------------------
  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  // 月4週固定：週送り
  function advanceWeek(cal) {
    cal.weekIndex++;
    cal.weekInMonth++;
    if (cal.weekInMonth > 4) {
      cal.weekInMonth = 1;
      cal.month++;
      if (cal.month > 12) {
        cal.month = 1;
        cal.year++;
      }
    }
  }

  function setCenterMessage(state, text, ms = 1800, important = true) {
    state.messageCenter = { text, ms, important, t: performance.now() };
  }

  function pushLog(state, text) {
    if (!text) return;
    state.sim.log.push({ t: Date.now(), text: String(text) });
    // ログ肥大防止（UI用）
    const MAX = 200;
    if (state.sim.log.length > MAX) state.sim.log.splice(0, state.sim.log.length - MAX);
  }

  // ----------------------------
  // Save / Load
  // ----------------------------
  function save(state) {
    try {
      const payload = JSON.stringify(state);
      localStorage.setItem(LS_KEY, payload);
      return true;
    } catch (e) {
      return false;
    }
  }

  function load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      return obj;
    } catch (e) {
      return null;
    }
  }

  function clearSave() {
    try {
      localStorage.removeItem(LS_KEY);
      return true;
    } catch (e) {
      return false;
    }
  }

  // ----------------------------
  // Public API
  // ----------------------------
  const STATE = {
    PHASE,
    TOURNAMENT,

    _state: defaultState(),

    resetAll() {
      this._state = defaultState();
      return this._state;
    },

    get() {
      return this._state;
    },

    // 破壊的更新を避けたい場合に使う
    snapshot() {
      return deepClone(this._state);
    },

    // フェーズ遷移
    setPhase(phase, subphase = '') {
      this._state.phase = phase;
      this._state.subphase = subphase || '';
    },

    // 中央メッセージ（大会当日など）
    centerMessage(text, ms, important) {
      setCenterMessage(this._state, text, ms, important);
    },

    toast(text, ms = 1200) {
      this._state.toast = { text: String(text), ms, t: performance.now() };
    },

    // ログ
    log(text) {
      pushLog(this._state, text);
    },

    // 週を進める（※大会週は game.js 側で制御）
    nextWeek() {
      advanceWeek(this._state.calendar);
    },

    // カレンダーを任意設定
    setCalendar(year, month, weekInMonth) {
      const c = this._state.calendar;
      if (typeof year === 'number') c.year = year | 0;
      if (typeof month === 'number') c.month = clamp(month | 0, 1, 12);
      if (typeof weekInMonth === 'number') c.weekInMonth = clamp(weekInMonth | 0, 1, 4);
    },

    // 大会開始/終了（中身は sim 側が埋める）
    startTournament(type, opts = {}) {
      const t = this._state.tournament;
      t.active = true;
      t.type = type;
      t.group = opts.group || 'A';
      t.stageLabel = opts.stageLabel || '';
      t.canParticipate = opts.canParticipate !== false;
      t.matchIndex = 0;
      t.totalMatches = opts.totalMatches || 0;
      t.standings = null;
      t.lastResult = null;

      this._state.sim.round = 1;
      this._state.sim.aliveTeams = 20;
      this._state.sim.battle = null;

      // 大会当日メッセージは game.js で呼ぶ想定だが、念のため
      if (opts.centerMessage) setCenterMessage(this._state, opts.centerMessage, 2200, true);
    },

    finishTournament(resultObj) {
      const t = this._state.tournament;
      t.active = false;
      t.lastResult = resultObj || null;
      // 次フェーズは game.js が決める
    },

    // 戦闘（sim_battle が使う）
    setBattle(battleObj) {
      this._state.sim.battle = battleObj || null;
    },

    clearBattle() {
      this._state.sim.battle = null;
    },

    // 所持金
    addGold(delta) {
      const e = this._state.economy;
      e.gold = Math.max(0, (e.gold | 0) + (delta | 0));
    },

    setGold(v) {
      this._state.economy.gold = Math.max(0, v | 0);
    },

    // インベントリ
    addItem(itemId, count = 1) {
      const inv = this._state.inventory.items;
      const k = String(itemId);
      inv[k] = (inv[k] | 0) + (count | 0);
      if (inv[k] <= 0) delete inv[k];
    },

    getItemCount(itemId) {
      const inv = this._state.inventory.items;
      return inv[String(itemId)] | 0;
    },

    // コーチスキル装備（最大5）
    equipCoachSkill(skillId) {
      const arr = this._state.inventory.coachSkills;
      const id = String(skillId);
      if (arr.includes(id)) return false;
      if (arr.length >= 5) return false;
      arr.push(id);
      return true;
    },

    unequipCoachSkill(skillId) {
      const arr = this._state.inventory.coachSkills;
      const id = String(skillId);
      const i = arr.indexOf(id);
      if (i >= 0) arr.splice(i, 1);
    },

    // セーブ/ロード
    save() {
      return save(this._state);
    },

    load() {
      const obj = load();
      if (!obj) return false;

      // 互換性：最低限の形を担保（足りないところは default を補完）
      const def = defaultState();
      this._state = merge(def, obj);
      return true;
    },

    clearSave() {
      return clearSave();
    },
  };

  // 深いマージ（default を壊さず補完）
  function merge(base, incoming) {
    if (incoming === null || incoming === undefined) return base;
    if (typeof base !== 'object' || base === null) return incoming;
    if (Array.isArray(base)) return Array.isArray(incoming) ? incoming : base;

    const out = {};
    const keys = new Set([...Object.keys(base), ...Object.keys(incoming || {})]);
    for (const k of keys) {
      const bv = base[k];
      const iv = incoming ? incoming[k] : undefined;
      if (iv === undefined) out[k] = bv;
      else if (typeof bv === 'object' && bv && !Array.isArray(bv)) out[k] = merge(bv, iv);
      else out[k] = iv;
    }
    return out;
  }

  // expose
  window.STATE = STATE;
})();
