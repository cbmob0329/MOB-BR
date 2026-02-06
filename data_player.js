'use strict';

/*
  MOB BR - data_player.js v14
  役割：
  - プレイヤーチーム（3人）の確定データ（A/B/C）
  - ステータス共通フォーマット
  - パッシブ/ウルト共通フォーマット
  - 育成EXP/Lvの土台

  重要ルール：
  - 「％、勝率、補正値」は表示しない（UI側で非表示設計）
*/

window.MOBBR = window.MOBBR || {};

(function(){
  const STAT_KEYS = [
    'hp',
    'mental',
    'aim',
    'agi',
    'tech',
    'support',
    'scan'
  ];

  const STAT_LABEL = {
    hp: '体力',
    mental: 'メンタル',
    aim: 'エイム',
    agi: '敏捷性',
    tech: '技術',
    support: 'サポート',
    scan: '探知'
  };

  const DEFAULT_BASE_STATS = {
    A: { hp: 65, mental: 70, aim: 55, agi: 50, tech: 60, support: 55, scan: 60 },
    B: { hp: 60, mental: 55, aim: 70, agi: 65, tech: 55, support: 45, scan: 50 },
    C: { hp: 70, mental: 60, aim: 50, agi: 45, tech: 55, support: 70, scan: 65 }
  };

  function buildEmptyExp(){
    const exp = {};
    for (const k of STAT_KEYS) exp[k] = 0;
    return exp;
  }
  function buildDefaultLv(){
    const lv = {};
    for (const k of STAT_KEYS) lv[k] = 1;
    return lv;
  }

  function buildDefaultMembers(){
    return [
      {
        id: 'A',
        slot: 1,
        role: 'IGL',
        displayNameDefault: 'A',
        name: 'A',
        stats: { ...DEFAULT_BASE_STATS.A },
        exp: buildEmptyExp(),
        lv: buildDefaultLv(),
        passive: 'チームのアーマー+5',
        ult: 'FightBoost +2'
      },
      {
        id: 'B',
        slot: 2,
        role: 'アタッカー',
        displayNameDefault: 'B',
        name: 'B',
        stats: { ...DEFAULT_BASE_STATS.B },
        exp: buildEmptyExp(),
        lv: buildDefaultLv(),
        passive: 'チームの敏捷性+5',
        ult: 'FightBoost +2'
      },
      {
        id: 'C',
        slot: 3,
        role: 'サポーター',
        displayNameDefault: 'C',
        name: 'C',
        stats: { ...DEFAULT_BASE_STATS.C },
        exp: buildEmptyExp(),
        lv: buildDefaultLv(),
        passive: 'チームの探知+5',
        ult: 'FightBoost +2'
      }
    ];
  }

  function buildDefaultTeam(){
    return {
      teamId: 'PLAYER',
      members: buildDefaultMembers(),
      coachSkills: {
        maxSlots: 5,
        equipped: [null, null, null, null, null]
      },
      records: []
    };
  }

  function cloneTeam(team){
    return JSON.parse(JSON.stringify(team));
  }

  function normalizeStats(stats){
    const out = {};
    for (const k of STAT_KEYS){
      const v = Number(stats?.[k]);
      out[k] = Number.isFinite(v) ? v : 0;
    }
    return out;
  }

  function normalizeExp(exp){
    const out = {};
    for (const k of STAT_KEYS){
      const v = Number(exp?.[k]);
      out[k] = Number.isFinite(v) ? v : 0;
    }
    return out;
  }

  function normalizeLv(lv){
    const out = {};
    for (const k of STAT_KEYS){
      const v = Number(lv?.[k]);
      out[k] = Number.isFinite(v) ? v : 1;
    }
    return out;
  }

  window.MOBBR.data = window.MOBBR.data || {};
  window.MOBBR.data.player = {
    STAT_KEYS,
    STAT_LABEL,

    buildDefaultTeam,
    cloneTeam,
    normalizeStats,
    normalizeExp,
    normalizeLv
  };
})();
