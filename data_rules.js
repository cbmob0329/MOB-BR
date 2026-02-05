/* =========================================================
   MOB BR - data_rules.js (FULL / MASTER RULES)
   フォルダ構成対応：
   - 画像直下：P1.png / main.png / ido.png / map.png / shop.png / battle.png / winner.png
   - エリア背景：maps/*.png
   - CPU画像：cpu/*.png
========================================================= */

(function(){
  'use strict';

  const RULES = {};
  window.RULES = RULES;

  /* =========================
     GAME BASIC
  ========================== */
  RULES.GAME = {
    teamSize: 3,
    totalTeams: 20,
    rounds: 6,
    autoMs: 3000
  };

  /* =========================
     SCREEN IMAGES（GitHub直下）
     ※コンセプト.txt 準拠
  ========================== */
  RULES.MAP = {
    screens: {
      main1:  'main.png',
      map:    'map.png',
      ido:    'ido.png',
      shop:   'shop.png',
      battle: 'battle.png',
      winner: 'winner.png'
    },

    // ラウンドごとの移動先エリア（mapについて.txt の並びを尊重）
    // ※R6は Area25 固定
    roundAreas: {
      R1: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16],
      R2: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16],
      R3: [17,18,19,20],
      R4: [21,22],
      R5: [23,24],
      R6: [25]
    },

    // エリア画像（maps/ 配下）
    areaImgBase: 'maps/'
  };

  /* =========================
     MATCH FLOW（試合の流れ.txt）
  ========================== */
  RULES.MATCH = {
    fightsPerRound: { 1:4, 2:4, 3:4, 4:4, 5:2, 6:1 },
    playerFightRate: { 1:100, 2:70, 3:75, 4:80, 5:85, 6:100 },
    eventsPerRound: { 1:1, 2:2, 3:2, 4:2, 5:2, 6:0 }
  };

  /* =========================
     RESPAWN
  ========================== */
  RULES.RESPAWN = {
    normal: {
      1: { revive: 1 },
      2: { revive70: 2, revive30: 1 }
    },
    final: {
      reviveAllIfDB: true
    }
  };

  /* =========================
     BATTLE（戦闘仕様）
  ========================== */
  RULES.BATTLE = {
    winRate: { base: 50, diffMul: 1.8, min: 22, max: 78 },
    alive2Boost: 1.4,
    winnerDB: { none:55, one:35, two:10 },
    ult: { fightBoost: 2, oncePerBattle: true }
  };

  /* =========================
     RESULT（ポイント）
  ========================== */
  RULES.RESULT = {
    placementPoint(place){
      if(place === 1) return 12;
      if(place === 2) return 8;
      if(place === 3) return 5;
      if(place === 4) return 3;
      if(place === 5) return 2;
      if(place >= 6 && place <= 10) return 1;
      return 0;
    },
    totalOf({ place, kp, ap, treasure, flag }){
      return (
        this.placementPoint(place) +
        (kp || 0) +
        (ap || 0) +
        (treasure || 0) +
        (flag || 0) * 2
      );
    }
  };

})();
