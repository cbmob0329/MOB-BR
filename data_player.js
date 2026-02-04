/* =========================================================
   MOB BR - data_player.js (FULL)
   - プレイヤーチーム定義
   - 初期キャラ3人（IGL / Attacker / Support）
   - パッシブ / ウルト（内部用）
========================================================= */

(function(){
  'use strict';

  const DataPlayer = {};
  window.DataPlayer = DataPlayer;

  /* =========================
     TEAM META
  ========================== */
  const TEAM_META = {
    teamId: 'player',
    name: 'PLAYER TEAM',
    image: 'assets/P1.png',
  };

  /* =========================
     PLAYER MEMBERS (初期確定)
  ========================== */
  const MEMBERS = [
    {
      id: 'A',
      role: 'IGL',
      name: 'アイス',
      hp: 100,
      armor: 100,
      stats: {
        aim: 70,
        mental: 60,
        agility: 30,
        tech: 20,
        support: 55,
        detect: 60,
        stamina: 100,
      },
      passive: {
        type: 'ARMOR_UP',
        value: 5,
        text: 'チームのアーマー+5',
      },
      ult: {
        type: 'FIGHT_BOOST',
        value: 2,
        text: 'FightBoost +2',
      },
    },
    {
      id: 'B',
      role: 'ATTACKER',
      name: 'ネコクー',
      hp: 100,
      armor: 100,
      stats: {
        aim: 76,
        mental: 55,
        agility: 32,
        tech: 23,
        support: 43,
        detect: 48,
        stamina: 100,
      },
      passive: {
        type: 'AGILITY_UP',
        value: 5,
        text: 'チームの敏捷性+5',
      },
      ult: {
        type: 'FIGHT_BOOST',
        value: 2,
        text: 'FightBoost +2',
      },
    },
    {
      id: 'C',
      role: 'SUPPORT',
      name: 'ドオーロック',
      hp: 90,
      armor: 100,
      stats: {
        aim: 66,
        mental: 50,
        agility: 37,
        tech: 33,
        support: 70,
        detect: 40,
        stamina: 90,
      },
      passive: {
        type: 'DETECT_UP',
        value: 5,
        text: 'チームの探知+5',
      },
      ult: {
        type: 'FIGHT_BOOST',
        value: 2,
        text: 'FightBoost +2',
      },
    },
  ];

  /* =========================
     PUBLIC API
  ========================== */

  // チーム全体（sim.js が参照）
  DataPlayer.getTeam = function(){
    return {
      isPlayer: true,
      teamId: TEAM_META.teamId,
      name: Storage.getTeamName() || TEAM_META.name,
      image: TEAM_META.image,
      members: clone(MEMBERS),
      // 試合用ステータス（初期化は sim.js 側）
      alive: 3,
      eliminated: false,
      kp: 0,
      ap: 0,
      treasure: 0,
      flag: 0,
      place: null,
    };
  };

  // 表示用チーム画像
  DataPlayer.getTeamImage = function(){
    return TEAM_META.image;
  };

  // 個別メンバー取得
  DataPlayer.getMembers = function(){
    return clone(MEMBERS);
  };

  // パッシブ合算（内部用）
  DataPlayer.calcTeamPassive = function(){
    const res = {
      armor: 0,
      agility: 0,
      detect: 0,
    };
    for(const m of MEMBERS){
      if(m.passive.type === 'ARMOR_UP') res.armor += m.passive.value;
      if(m.passive.type === 'AGILITY_UP') res.agility += m.passive.value;
      if(m.passive.type === 'DETECT_UP') res.detect += m.passive.value;
    }
    return res;
  };

  // ウルト使用可能数（内部用）
  DataPlayer.getUltCount = function(){
    return MEMBERS.length;
  };

  /* =========================
     UTIL
  ========================== */
  function clone(v){
    return JSON.parse(JSON.stringify(v));
  }

})();
