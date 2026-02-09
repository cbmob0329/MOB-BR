/* =========================================================
   MOB BR - data_tournament.js (FULL / SINGLE SOURCE)
   ---------------------------------------------------------
   役割：
   ・大会ルール／構成／年間スケジュールの唯一の定義元
   ・ポイント計算／賞金／企業ランクUP定義
   ・sim / ui から参照される「正」
   ---------------------------------------------------------
   注意：
   ・試合処理、戦闘ロジック、UI処理は一切しない
   ・数値や構成を変える場合は必ずこのファイルのみ修正
========================================================= */

(function(){
  'use strict';

  const DataTournament = {};
  window.DataTournament = DataTournament;

  /* =========================
     共通ルール
  ========================== */
  DataTournament.COMMON = {
    playerGroup: 'A',           // プレイヤーは常にA固定
    teamsPerMatch: 20,
    maxTeamsLocal: 20,
    maxTeamsLarge: 40,
    matchesPerPhase: 5
  };

  /* =========================
     ポイント定義
  ========================== */
  DataTournament.POINT = {
    placement: {
      1:12, 2:8, 3:6, 4:5, 5:4,
      6:3, 7:2, 8:1, 9:1, 10:1
      // 11〜20 = 0
    },
    kill: 1,
    assist: 1,
    treasure: 1,
    flag: 2
  };

  /* =========================
     賞金 & 企業ランクUP
  ========================== */
  DataTournament.REWARD = {
    local: {
      1:{ gold:50000,  corp:3 },
      2:{ gold:30000,  corp:2 },
      3:{ gold:10000,  corp:1 },
      4:{ gold:3000,   corp:0 },
      5:{ gold:3000,   corp:0 },
      6:{ gold:3000,   corp:0 }
    },
    national: {
      1:{ gold:300000, corp:5 },
      2:{ gold:150000, corp:3 },
      3:{ gold:50000,  corp:2 },
      4:{ gold:10000,  corp:1 },
      5:{ gold:10000,  corp:1 },
      6:{ gold:10000,  corp:1 }
    },
    world: {
      1:{ gold:1000000, corp:30 },
      2:{ gold:500000,  corp:15 },
      3:{ gold:300000,  corp:10 },
      4:{ gold:100000,  corp:3 },
      5:{ gold:100000,  corp:3 },
      6:{ gold:100000,  corp:3 }
    },
    championship: {
      1:{ gold:3000000, corp:50 },
      2:{ gold:1000000, corp:30 },
      3:{ gold:500000,  corp:15 },
      4:{ gold:250000,  corp:5 },
      5:{ gold:250000,  corp:5 },
      6:{ gold:250000,  corp:5 }
    }
  };

  /* =========================
     大会フェーズ定義
  ========================== */
  DataTournament.PHASE = {
    LOCAL: {
      key: 'local',
      teams: 20,
      matches: 5,
      advance: { top:10 },
      failMessage: '総合〇位となり敗退…次に向けて頑張ろう！'
    },

    NATIONAL: {
      key: 'national',
      teams: 40,
      phases: [
        { name:'序盤 A&B', groups:['A','B'], matches:5 },
        { name:'序盤 C&D', groups:['C','D'], matches:5 },
        { name:'中盤 A&C', groups:['A','C'], matches:5 },
        { name:'終盤 B&C', groups:['B','C'], matches:5 },
        { name:'終盤 A&D', groups:['A','D'], matches:5 },
        { name:'終盤 B&D', groups:['B','D'], matches:5 }
      ],
      advance: {
        world: { top:8 },
        lastChance: { from:9, to:28 }
      }
    },

    LAST_CHANCE: {
      key: 'lastChance',
      teamsFrom: { from:9, to:28 },
      matches: 5,
      advance: { top:2 }
    },

    WORLD: {
      key: 'world',
      teams: 40,
      groups: ['A','B','C','D'],
      phases: [
        { name:'予選1', pairs:[['A','B'],['C','D']], matches:5 },
        { name:'予選2', pairs:[['A','C'],['B','D']], matches:5 },
        { name:'予選3', pairs:[['A','D'],['B','C']], matches:5 }
      ],
      split: {
        winners: { top:20 },
        losers:  { bottom:20 }
      }
    },

    WINNERS: {
      key: 'winners',
      matches:5,
      advance: { final:10, losers2:10 }
    },

    LOSERS: {
      key: 'losers',
      matches:5,
      advance: { losers2:10 }
    },

    LOSERS2: {
      key: 'losers2',
      matches:5,
      advance: { final:10 }
    },

    FINAL: {
      key: 'final',
      winPoint: 80
    }
  };

  /* =========================
     年間スケジュール
  ========================== */
  DataTournament.SCHEDULE = [
    { month:2,  week:1, type:'local' },
    { month:3,  week:1, type:'national' },
    { month:3,  week:2, type:'national_cont' },
    { month:3,  week:3, type:'lastChance' },
    { month:4,  week:1, type:'world' },

    { month:7,  week:1, type:'local' },
    { month:8,  week:1, type:'national' },
    { month:8,  week:2, type:'national_cont' },
    { month:8,  week:3, type:'lastChance' },
    { month:9,  week:1, type:'world' },

    { month:11, week:1, type:'local' },
    { month:12, week:1, type:'national' },
    { month:12, week:2, type:'national_cont' },
    { month:12, week:3, type:'lastChance' },
    { month:1,  week:2, type:'championship' }
  ];

})();
