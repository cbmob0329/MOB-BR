'use strict';

/*
  sim_tournament_result.js（FULL 安定版） v2.2

  修正内容：
  ✅ チーム名解決を完全保証（ID表示根絶）
  ✅ Treasure=3 / Flag=5
  ✅ 1試合終了ごと currentOverallRows 更新
  ✅ ソート安定化
  ✅ ★追加：R.getChampionName(state) を実装（core_step v4.4 と整合）
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
  // Match Result Table
  // ==========================================
  function computeMatchResultTable(state){

    const teams = (state?.teams ? state.teams.slice() : []);

    teams.sort((a,b)=>{
      if (!!a.eliminated !== !!b.eliminated) return a.eliminated ? 1 : -1;
      if (Number(a.eliminatedRound||0) !== Number(b.eliminatedRound||0)) return Number(b.eliminatedRound||0) - Number(a.eliminatedRound||0);
      if (Number(a.kills_total||0) !== Number(b.kills_total||0)) return Number(b.kills_total||0) - Number(a.kills_total||0);
      if (Number(a.downs_total||0) !== Number(b.downs_total||0)) return Number(a.downs_total||0) - Number(b.downs_total||0);
      if (Number(a.power||0) !== Number(b.power||0)) return Number(b.power||0) - Number(a.power||0);
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
  // Tournament Total
  // ==========================================
  function addToTournamentTotal(state, rows){

    if (!state.tournamentTotal) state.tournamentTotal = {};

    (rows || []).forEach(r=>{

      const rid = String(r.id);

      if (!state.tournamentTotal[rid]){
        state.tournamentTotal[rid] = {
          id: rid,
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

      const t = state.tournamentTotal[rid];

      t.sumTotal += Number(r.total||0);
      t.sumPlacementP += Number(r.placementP||0);
      t.sumKP += Number(r.kp||0);
      t.sumAP += Number(r.ap||0);
      t.sumTreasure += Number(r.treasure||0);
      t.sumFlag += Number(r.flag||0);

      // 表示名は常に最新で上書き
      t.name = r.name;
    });

    buildCurrentOverall(state);
  }

  // ==========================================
  // 現在の20チーム総合順位
  // ==========================================
  function buildCurrentOverall(state){

    const ids = (state?.teams ? state.teams.map(t=>String(t.id)) : []);

    const arr = ids.map(id=>{
      const t = state.tournamentTotal ? state.tournamentTotal[String(id)] : null;
      if (!t) return null;

      return {
        id: String(id),
        name: resolveTeamName(state, id),
        total: Number(t.sumTotal||0),
        placementP: Number(t.sumPlacementP||0),
        kp: Number(t.sumKP||0),
        ap: Number(t.sumAP||0),
        treasure: Number(t.sumTreasure||0),
        flag: Number(t.sumFlag||0)
      };
    }).filter(Boolean);

    arr.sort((a,b)=>{
      if (a.total !== b.total) return b.total - a.total;
      // タイブレーク：KP → AP → 名前（安定）
      if (a.kp !== b.kp) return b.kp - a.kp;
      if (a.ap !== b.ap) return b.ap - a.ap;
      return String(a.name||a.id).localeCompare(String(b.name||b.id));
    });

    state.currentOverallRows = arr;
  }

  // ==========================================
  // ✅ Champion Name（core_step v4.4 と整合）
  // - lastMatchResultRows があればそれを優先
  // - 無ければ computeMatchResultTable(state) から推定
  // - それも無理なら「生存チームのpower最大」→最後は '???'
  // ==========================================
  function getChampionName(state){
    try{
      // ① finishMatchAndBuildResult() 後の確定行があれば最優先
      const rows = Array.isArray(state?.lastMatchResultRows) ? state.lastMatchResultRows : null;
      if (rows && rows.length){
        const top = rows.find(r => Number(r.placement) === 1) || rows[0];
        const name = top?.name || resolveTeamName(state, top?.id);
        if (name) return String(name);
      }

      // ② 今のstate.teamsから試合順位を推定して1位
      const rows2 = computeMatchResultTable(state);
      if (rows2 && rows2.length){
        const top2 = rows2.find(r => Number(r.placement) === 1) || rows2[0];
        const name2 = top2?.name || resolveTeamName(state, top2?.id);
        if (name2) return String(name2);
      }

      // ③ それでも無理なら「生存 & power最大」
      const teams = Array.isArray(state?.teams) ? state.teams : [];
      let best = null;
      for (const t of teams){
        if (!t) continue;
        if (t.eliminated) continue;
        if (!best || Number(t.power||0) > Number(best.power||0)) best = t;
      }
      if (best){
        const nm = best.name || resolveTeamName(state, best.id);
        if (nm) return String(nm);
      }
    }catch(e){}

    return '???';
  }

  window.MOBBR.sim.tournamentResult = {
    resolveTeamName,
    calcPlacementPoint,
    computeMatchResultTable,
    addToTournamentTotal,
    buildCurrentOverall,
    getChampionName
  };

})();
