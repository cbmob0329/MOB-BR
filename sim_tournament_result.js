'use strict';

/*
  sim_tournament_result.js（FULL 修正版）

  変更点：
  ✅ チーム名を必ず name 表示（ID表示バグ修正）
  ✅ Treasure=3 / Flag=5
  ✅ 1試合終了ごとに「現在の総合順位（その20チーム）」生成
  ✅ キル上限問題はここでは触らない（flow側で調整）
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.sim = window.MOBBR.sim || {};

(function(){

  // =========================
  // 表示名解決（ID対策）
  // =========================
  function resolveTeamName(state, id){
    if (!state || !state.teams) return id;

    const t =
      state.teams.find(x => String(x.id) === String(id)) ||
      (state.tournamentTotal && Object.values(state.tournamentTotal).find(x => String(x.id) === String(id)));

    if (t && t.name) return String(t.name);
    return String(id);
  }

  // =========================
  // Match Result Table
  // =========================
  function computeMatchResultTable(state){

    const teams = state.teams.slice();

    // 生存→eliminatedRound→kills→downs少→power高→name
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

      const treasureP = Number(t.treasure || 0) * 3; // ✅ 3
      const flagP     = Number(t.flag || 0) * 5;     // ✅ 5

      const total = placementP + kp + ap + treasureP + flagP;

      rows.push({
        id: t.id,
        name: resolveTeamName(state, t.id),
        placement,
        placementP,
        kp,
        ap,
        treasure: t.treasure || 0,
        flag: t.flag || 0,
        total
      });

    });

    return rows;
  }

  // =========================
  // Placement Point（Apex風）
  // =========================
  function calcPlacementPoint(rank){
    if (rank === 1) return 12;
    if (rank === 2) return 9;
    if (rank === 3) return 7;
    if (rank === 4) return 5;
    if (rank === 5) return 4;
    if (rank <= 10) return 2;
    return 0;
  }

  // =========================
  // Add to Tournament Total
  // =========================
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

    // ✅ 現在戦っている20チームのみで並び替え生成
    buildCurrentOverall(state);

  }

  // =========================
  // 現在の20チーム総合順位
  // =========================
  function buildCurrentOverall(state){

    const ids = state.teams.map(t=>String(t.id));

    const arr = ids.map(id=>{
      const t = state.tournamentTotal[id];
      if (!t) return null;
      return {
        id,
        name: t.name,
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

  // =========================
  // 公開
  // =========================
  window.MOBBR.sim.tournamentResult = {
    computeMatchResultTable,
    addToTournamentTotal
  };

})();
