'use strict';

/*
  sim_tournament_result.js（FULL 修正版 v2.4.1 + 戦績保存追加）

  ※ v2.4.1 の内容は一切削っていません
  ※ 末尾に PLAYER 戦績保存処理のみ追加
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.sim = window.MOBBR.sim || {};

(function(){

  const HISTORY_KEY = 'mobbr_teamHistory_v1';

  // ==========================================
  // 名前解決（完全版）
  // ==========================================
  function resolveTeamName(state, id){
    const sid = String(id);

    try{
      if (state?.teams){
        const t = state.teams.find(x => String(x?.id) === sid);
        if (t?.name) return String(t.name);
      }
    }catch(_){}

    try{
      if (state?.tournamentTotal){
        const t = state.tournamentTotal[sid];
        if (t?.name) return String(t.name);
      }
    }catch(_){}

    try{
      const allDefs = state?.national?.allTeamDefs;

      if (allDefs){
        if (!Array.isArray(allDefs) && typeof allDefs === 'object'){
          const def = allDefs[sid];
          if (def?.name) return String(def.name);
          if (def && (def.id || def.teamId)){
            const nid = String(def.id || def.teamId);
            if (nid && nid !== sid){
              const def2 = allDefs[nid];
              if (def2?.name) return String(def2.name);
            }
          }
        }
        else if (Array.isArray(allDefs)){
          const def = allDefs.find(x => String(x?.id || x?.teamId) === sid);
          if (def?.name) return String(def.name);
        }
      }
    }catch(_){}

    return sid;
  }

  function calcPlacementPoint(rank){
    if (rank === 1) return 12;
    if (rank === 2) return 9;
    if (rank === 3) return 7;
    if (rank === 4) return 5;
    if (rank === 5) return 4;
    if (rank <= 10) return 2;
    return 0;
  }

  function computeMatchResultTable(state){
    const teams = (state?.teams ? state.teams.slice() : []);

    teams.sort((a,b)=>{
      if (!!a?.eliminated !== !!b?.eliminated) return a.eliminated ? 1 : -1;

      const ar = Number(a?.eliminatedRound || 0);
      const br = Number(b?.eliminatedRound || 0);
      if (ar !== br) return br - ar;

      const ak = Number(a?.kills_total || 0);
      const bk = Number(b?.kills_total || 0);
      if (ak !== bk) return bk - ak;

      const ad = Number(a?.downs_total || 0);
      const bd = Number(b?.downs_total || 0);
      if (ad !== bd) return ad - bd;

      const apow = Number(a?.power || 0);
      const bpow = Number(b?.power || 0);
      if (apow !== bpow) return bpow - apow;

      return String(a?.name||a?.id).localeCompare(String(b?.name||b?.id));
    });

    const rows = [];

    teams.forEach((t, index)=>{
      const placement = index + 1;
      const placementP = calcPlacementPoint(placement);

      const kp = Number(t?.kills_total || 0);
      const ap = Number(t?.assists_total || 0);

      const treasureCount = Number(t?.treasure || 0);
      const flagCount     = Number(t?.flag || 0);

      const treasureP = treasureCount * 3;
      const flagP     = flagCount * 5;

      const total = placementP + kp + ap + treasureP + flagP;

      rows.push({
        id: t?.id,
        name: resolveTeamName(state, t?.id),
        placement,
        placementP,
        kp,
        ap,
        treasure: treasureCount,
        flag: flagCount,
        total
      });
    });

    return rows;
  }

  function addToTournamentTotal(state, rows){
    if (!state) return;
    if (!state.tournamentTotal) state.tournamentTotal = {};

    const arr = Array.isArray(rows) ? rows : [];

    arr.forEach(r=>{
      const id = String(r?.id);
      if (!id) return;

      if (!state.tournamentTotal[id]){
        state.tournamentTotal[id] = {
          id,
          name: String(r?.name || id),
          sumTotal:0,
          sumPlacementP:0,
          sumKP:0,
          sumAP:0,
          sumTreasure:0,
          sumFlag:0,
          sumKills:0,
          sumAssists:0,
          sumDowns:0
        };
      }

      const t = state.tournamentTotal[id];

      t.sumTotal       += Number(r?.total || 0);
      t.sumPlacementP  += Number(r?.placementP || 0);
      t.sumKP          += Number(r?.kp || 0);
      t.sumAP          += Number(r?.ap || 0);
      t.sumTreasure    += Number(r?.treasure || 0);
      t.sumFlag        += Number(r?.flag || 0);

      t.sumKills        = t.sumKP;
      t.sumAssists      = t.sumAP;

      try{
        const team = state?.teams?.find(x => String(x?.id) === id);
        if (team){
          t.sumDowns += Number(team?.downs_total || 0);
        }
      }catch(_){}

      t.name = String(r?.name || t.name || id);
    });

    buildCurrentOverall(state);

    // ===== PLAYER戦績保存（大会終了時のみ）=====
    try{
      if (state.matchIndex === state.matchCount){
        const overall = state.currentOverallRows || [];
        const playerRow = overall.find(r => String(r.id) === 'PLAYER');
        if (!playerRow) return;

        const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');

        history.unshift({
          mode: state.mode || '',
          date: Date.now(),
          rank: overall.findIndex(r => r.id === 'PLAYER') + 1,
          total: playerRow.total
        });

        localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0,100)));
      }
    }catch(e){
      console.warn('戦績保存失敗', e);
    }
  }

  function buildCurrentOverall(state){
    if (!state) return;

    const ids = Array.isArray(state.teams) ? state.teams.map(t=>String(t?.id)) : [];

    const arr = ids.map(id=>{
      const t = state.tournamentTotal ? state.tournamentTotal[id] : null;
      if (!t) return null;

      return {
        id,
        name: resolveTeamName(state, id),
        total: Number(t.sumTotal || 0),
        placementP: Number(t.sumPlacementP || 0),
        kp: Number(t.sumKP || 0),
        ap: Number(t.sumAP || 0),
        treasure: Number(t.sumTreasure || 0),
        flag: Number(t.sumFlag || 0)
      };
    }).filter(Boolean);

    arr.sort((a,b)=>{
      if (a.total !== b.total) return b.total - a.total;
      if (a.placementP !== b.placementP) return b.placementP - a.placementP;
      if (a.kp !== b.kp) return b.kp - a.kp;
      if (a.ap !== b.ap) return b.ap - a.ap;
      if (a.treasure !== b.treasure) return b.treasure - a.treasure;
      if (a.flag !== b.flag) return b.flag - a.flag;
      return String(a.name||a.id).localeCompare(String(b.name||b.id));
    });

    state.currentOverallRows = arr;
  }

  function computeTournamentResultTable(state){
    if (!state) return [];
    const total = state.tournamentTotal || {};
    const ids = Object.keys(total);

    const rows = ids.map(id=>{
      const t = total[id] || {};
      return {
        id,
        name: resolveTeamName(state, id),
        total: Number(t.sumTotal || 0),
        placementP: Number(t.sumPlacementP || 0),
        kp: Number(t.sumKP || 0),
        ap: Number(t.sumAP || 0),
        treasure: Number(t.sumTreasure || 0),
        flag: Number(t.sumFlag || 0)
      };
    });

    rows.sort((a,b)=>{
      if (a.total !== b.total) return b.total - a.total;
      if (a.placementP !== b.placementP) return b.placementP - a.placementP;
      if (a.kp !== b.kp) return b.kp - a.kp;
      if (a.ap !== b.ap) return b.ap - a.ap;
      if (a.treasure !== b.treasure) return b.treasure - a.treasure;
      if (a.flag !== b.flag) return b.flag - a.flag;
      return String(a.name||a.id).localeCompare(String(b.name||b.id));
    });

    return rows;
  }

  function getChampionName(state){
    try{
      const rows = state?.lastMatchResultRows;
      if (Array.isArray(rows) && rows.length){
        const top = rows[0];
        if (top?.name) return String(top.name);
        if (top?.id) return resolveTeamName(state, top.id);
      }
      return '???';
    }catch(e){
      return '???';
    }
  }

  const api = {
    resolveTeamName,
    calcPlacementPoint,
    computeMatchResultTable,
    addToTournamentTotal,
    computeTournamentResultTable,
    getChampionName,
    buildMatchResultTable: computeMatchResultTable,
    buildMatchResultRows: computeMatchResultTable,
    addMatchToTotal: addToTournamentTotal,
    addMatchResultToTotal: addToTournamentTotal,
    buildTournamentResultTable: computeTournamentResultTable,
    buildCurrentOverall
  };

  window.MOBBR.sim.tournamentResult = api;

  try{
    if (window.MOBBR?.sim?._tcore){
      window.MOBBR.sim._tcore.R = api;
    }
  }catch(_){}

})();
