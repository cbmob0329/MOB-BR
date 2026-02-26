'use strict';

/*
  MOB BR - data_player.js v4stat
  完全4ステ仕様固定版
*/

window.MOBBR = window.MOBBR || {};

(function(){

  const STAT_KEYS = ['hp','aim','tech','mental'];

  const DEFAULT_STATS = {
    A:{ hp:50, aim:25, tech:35, mental:40 }, // IGL
    B:{ hp:55, aim:35, tech:25, mental:30 }, // ATK
    C:{ hp:55, aim:20, tech:30, mental:30 }  // SUP
  };

  function clamp99(v){
    v = Number(v);
    if (!Number.isFinite(v)) return 0;
    return Math.max(0, Math.min(99, v));
  }

  function buildMember(id){
    return {
      id,
      role: id==='A'?'IGL':id==='B'?'アタッカー':'サポーター',
      name: id,

      stats:{ ...DEFAULT_STATS[id] },

      points:{ muscle:0, tech:0, mental:0 },

      upgradeCount:{ hp:0, aim:0, tech:0, mental:0 },

      skills:{} // { skillId:{ plus:0 } }
    };
  }

  function buildDefaultTeam(){
    return {
      teamId:'PLAYER',
      members:[
        buildMember('A'),
        buildMember('B'),
        buildMember('C')
      ]
    };
  }

  function normalizeTeam(team){
    if (!team || !Array.isArray(team.members)){
      return buildDefaultTeam();
    }

    team.members.forEach(m=>{

      // 旧不要キー削除
      delete m.agi;
      delete m.support;
      delete m.scan;
      delete m.exp;
      delete m.lv;
      delete m.passive;
      delete m.ult;
      delete m.trainPts;
      delete m.spirit;

      // stats
      m.stats = m.stats || {};
      STAT_KEYS.forEach(k=>{
        m.stats[k] = clamp99(m.stats[k]);
      });

      // points
      m.points = m.points || {};
      m.points.muscle = Number(m.points.muscle)||0;
      m.points.tech   = Number(m.points.tech)||0;
      m.points.mental = Number(m.points.mental)||0;

      // upgradeCount
      m.upgradeCount = m.upgradeCount || {};
      STAT_KEYS.forEach(k=>{
        m.upgradeCount[k] = Number(m.upgradeCount[k])||0;
      });

      // skills
      m.skills = m.skills || {};
      Object.keys(m.skills).forEach(sid=>{
        const p = Number(m.skills[sid]?.plus||0);
        m.skills[sid] = { plus: Math.max(0, Math.min(30,p)) };
      });
    });

    return team;
  }

  function calcTeamPower(team){
    if (!team?.members?.length) return 0;

    const memberAvg = team.members.map(m=>{
      const s = m.stats;
      return (s.hp+s.aim+s.tech+s.mental)/4;
    });

    return Math.round(
      memberAvg.reduce((a,b)=>a+b,0)/3
    );
  }

  window.MOBBR.data = window.MOBBR.data || {};
  window.MOBBR.data.player = {
    STAT_KEYS,
    buildDefaultTeam,
    normalizeTeam,
    calcTeamPower
  };

})();
