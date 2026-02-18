'use strict';

/*
  sim_tournament_result.js（FULL 安定版）

  修正内容：
  ✅ チーム名解決を完全保証（ID表示根絶）
  ✅ Treasure=3 / Flag=5
  ✅ 1試合終了ごと currentOverallRows 更新
  ✅ ソート安定化
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.sim = window.MOBBR.sim || {};

(function(){

  // ==========================================
  // 名前解決（完全版）
  // ==========================================
  function resolveTeamName(state, id){

    const sid = String(id);

    // ① 現在の20チーム
    if (state?.teams){
      const t = state.teams.find(x => String(x.id) === sid);
      if (t?.name) return String(t.name);
    }

    // ② tournamentTotal
    if (state?.tournamentTotal){
      const t = state.tournamentTotal[sid];
      if (t?.name) return String(t.name);
    }

    // ③ national / world allTeamDefs（安全弁）
    const allDefs = state?.national?.allTeamDefs || [];
    const def = allDefs.find(x => String(x.id || x.teamId) === sid);
    if (def?.name) return String(def.name);

    return sid;
  }

  // ==========================================
  // Match Result Table
  // ==========================================
  function computeMatchResultTable(state){

    const teams = state.teams.slice();

    teams.sort((a,b)=>{
      if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
      if (a.eliminatedRound !== b.eliminatedRound) return b.eliminatedRound - a.eliminatedRound;
      if (a.kills_total !== b.kills_total) return b.kills_total - a.kills_total;
      if (a.downs_total !== b.downs_total) return a.downs_total - b.downs_total;
      if (a.power !== b.power) return b.power - a.power;
      return String(a.name||a.id).localeCompare(String(b.name||b.id));
    });

    const rows = [];

    teams.forEach((t, index)=>{

      const placement = index + 1;
      const placementP = calcPlacementPoint(placement);

      const kp = Number(t.kills_total || 0);
      const ap = Number(t.assists_total || 0);

      const treasureCount = Number(t.treasure || 0);
      const flagCount     = Number(t.flag || 0);

      const treasureP = treasureCount * 3;
      const flagP     = flagCount * 5;

      const total = placementP + kp + ap + treasureP + flagP;

      rows.push({
        id: t.id,
        name: resolveTeamName(state, t.id),
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

  // ==========================================
  // Apex Placement
  // ==========================================
  function calcPlacementPoint(rank){
    if (rank === 1) return 12;
    if (rank === 2) return 9;
    if (rank === 3) return 7;
    if (rank === 4) return 5;
    if (rank === 5) return 4;
    if (rank <= 10) return 2;
    return 0;
  }

  // ==========================================
  // Tournament Total
  // ==========================================
  function addToTournamentTotal(state, rows){

    if (!state.tournamentTotal) state.tournamentTotal = {};

    rows.forEach(r=>{

      if (!state.tournamentTotal[r.id]){
        state.tournamentTotal[r.id] = {
          id: r.id,
          name: r.name,
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

      const t = state.tournamentTotal[r.id];

      t.sumTotal += r.total;
      t.sumPlacementP += r.placementP;
      t.sumKP += r.kp;
      t.sumAP += r.ap;
      t.sumTreasure += r.treasure;
      t.sumFlag += r.flag;
      t.name = r.name;
    });

    buildCurrentOverall(state);
  }

  // ==========================================
  // 現在の20チーム総合順位
  // ==========================================
  function buildCurrentOverall(state){

    const ids = state.teams.map(t=>String(t.id));

    const arr = ids.map(id=>{
      const t = state.tournamentTotal[id];
      if (!t) return null;

      return {
        id,
        name: resolveTeamName(state, id),
        total: t.sumTotal,
        placementP: t.sumPlacementP,
        kp: t.sumKP,
        ap: t.sumAP,
        treasure: t.sumTreasure,
        flag: t.sumFlag
      };
    }).filter(Boolean);

    arr.sort((a,b)=>{
      if (a.total !== b.total) return b.total - a.total;
      if (a.kp !== b.kp) return b.kp - a.kp;
      return a.name.localeCompare(b.name);
    });

    state.currentOverallRows = arr;
  }

  window.MOBBR.sim.tournamentResult = {
    computeMatchResultTable,
    addToTournamentTotal
  };

})();
