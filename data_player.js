'use strict';

/*
  MOB BR - data_player.js v13
  役割：
  - プレイヤーチーム（3人）の確定データ（A/B/C）
  - ステータス共通フォーマット
  - パッシブ/ウルト共通フォーマット
  - 今後ガチャ等で人数が増えても同形式で追加できる土台

  重要ルール：
  - 「％、勝率、補正値」は表示しない（UI側で非表示設計）
*/

window.MOBBR = window.MOBBR || {};

(function(){
  // ===== Status keys (表示順もこの並びを基準にする) =====
  const STAT_KEYS = [
    'hp',       // 体力
    'mental',   // メンタル
    'aim',      // エイム
    'agi',      // 敏捷性
    'tech',     // 技術
    'support',  // サポート
    'scan'      // 探知
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

  // ===== 初期値（今後バランス調整しやすいように中央管理）=====
  // ※ 数値は「数値表示OK」なので保持する。%や勝率などの概念は持たない。
  const DEFAULT_BASE_STATS = {
    // A（IGL）
    A: { hp: 65, mental: 70, aim: 55, agi: 50, tech: 60, support: 55, scan: 60 },
    // B（アタッカー）
    B: { hp: 60, mental: 55, aim: 70, agi: 65, tech: 55, support: 45, scan: 50 },
    // C（サポーター）
    C: { hp: 70, mental: 60, aim: 50, agi: 45, tech: 55, support: 70, scan: 65 }
  };

  // ===== 初期3人の確定役割/パッシブ/ウルト（ユーザー確定仕様）=====
  // 【確定】A(IGL)：パッシブ「チームのアーマー+5」／ウルト「FightBoost +2」
  // 【確定】B(アタッカー)：パッシブ「チームの敏捷性+5」／ウルト「FightBoost +2」
  // 【確定】C(サポーター)：パッシブ「チームの探知+5」／ウルト「FightBoost +2」
  function buildDefaultMembers(){
    return [
      {
        id: 'A',
        slot: 1,
        role: 'IGL',
        displayNameDefault: 'A',
        stats: { ...DEFAULT_BASE_STATS.A },
        passive: 'チームのアーマー+5',
        ult: 'FightBoost +2'
      },
      {
        id: 'B',
        slot: 2,
        role: 'アタッカー',
        displayNameDefault: 'B',
        stats: { ...DEFAULT_BASE_STATS.B },
        passive: 'チームの敏捷性+5',
        ult: 'FightBoost +2'
      },
      {
        id: 'C',
        slot: 3,
        role: 'サポーター',
        displayNameDefault: 'C',
        stats: { ...DEFAULT_BASE_STATS.C },
        passive: 'チームの探知+5',
        ult: 'FightBoost +2'
      }
    ];
  }

  // ===== チームデータ（将来拡張用）=====
  // コーチスキル装備枠：最大5枠、装備/解除のみ、効果数値はUIで非表示（文章のみ）
  function buildDefaultTeam(){
    return {
      teamId: 'PLAYER',
      members: buildDefaultMembers(),

      coachSkills: {
        maxSlots: 5,
        equipped: [null, null, null, null, null] // 文章IDや名称を入れる想定。今は空。
      },

      // 戦績（終了した大会のみ表示ルールはUIで）
      records: [] // { tourName, totalRank, totalPoint, yearKills, yearAssists, yearEndRank }
    };
  }

  // ===== ユーティリティ =====
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

  // ===== export =====
  window.MOBBR.data = window.MOBBR.data || {};
  window.MOBBR.data.player = {
    STAT_KEYS,
    STAT_LABEL,

    buildDefaultTeam,
    cloneTeam,
    normalizeStats
  };
})();
