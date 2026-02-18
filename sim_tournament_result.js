'use strict';

/*
  sim_tournament_result.js（FULL / core連携対応版）
  - v3.3.0
  ✅ core.js の finishMatchAndBuildResult() 呼び出しに対応
  ✅ eliminatedRound / H2H / power符号修正維持
  ✅ matchResultRows / tournamentTotal を state に書き戻す
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.sim = window.MOBBR.sim || {};

(function(){

  const PLACEMENT_P = (placement)=>{
    if (placement === 1) return 12;
    if (placement === 2) return 8;
    if (placement === 3) return 5;
    if (placement === 4) return 3;
    if (placement === 5) return 2;
    if (placement >= 6 && placement <= 10) return 1;
    return 0;
  };

  function h2hWins(state, aId, bId){
    try{
      const h2h = state?.h2h;
      if (!h2h || typeof h2h !== 'object') return 0;
      const k = `${String(aId)}|${String(bId)}`;
      return Number(h2h[k]) || 0;
    }catch{
      return 0;
    }
  }

  function safeElimRound(t){
    const r = Number(t?.eliminatedRound || 0);
    if (r > 0) return r;
    return 1;
  }

  function computePlacements(state){
    const teams = (state?.teams || []).slice();

    teams.sort((a,b)=>{

      const ae = a.eliminated ? 1 : 0;
      const be = b.eliminated ? 1 : 0;
      if (ae !== be) return ae - be;

      const ar = ae ? safeElimRound(a) : 99;
      const br = be ? safeElimRound(b) : 99;
      if (ar !== br) return br - ar;

      const aBeatB = h2hWins(state, a.id, b.id);
      const bBeatA = h2hWins(state, b.id, a.id);
      if (aBeatB > 0 && bBeatA === 0) return -1;
      if (bBeatA > 0 && aBeatB === 0) return 1;

      const ak = Number(a.kills_total||0);
      const bk = Number(b.kills_total||0);
      if (bk !== ak) return bk - ak;

      const ad = Number(a.downs_total||0);
      const bd = Number(b.downs_total||0);
      if (ad !== bd) return ad - bd;

      const ap = Number(a.power||0);
      const bp = Number(b.power||0);
      if (bp !== ap) return bp - ap;

      return String(a.name||'').localeCompare(String(b.name||''), 'ja');
    });

    return teams.map((t, idx)=>({
      id:t.id,
      name:t.name,
      placement: idx+1
    }));
  }

  function getChampionName(state){
    const placements = computePlacements(state);
    const top = placements && placements[0];
    return top ? String(top.name || top.id || '') : '';
  }

  function computeMatchResultTable(state){
    const placements = computePlacements(state);
    const byId = new Map((state?.teams || []).map(t=>[t.id,t]));

    return placements.map(p=>{
      const t = byId.get(p.id) || {};
      const KP = Number(t.kills_total||0);
      const AP = Number(t.assists_total||0);
      const Treasure = Number(t.treasure||0);
      const Flag = Number(t.flag||0);
      const PlacementP = PLACEMENT_P(p.placement);
      const Total = PlacementP + KP + AP + Treasure + (Flag*2);

      return {
        placement:p.placement,
        id:p.id,
        squad:p.name,
        KP,
        AP,
        Treasure,
        Flag,
        PlacementP,
        Total
      };
    });
  }

  function addToTournamentTotal(state, matchRows){
    const total = state.tournamentTotal || {};
    for(const r of matchRows){
      if (!total[r.id]){
        total[r.id] = {
          id:r.id,
          squad:r.squad,
          sumPlacementP:0,
          KP:0,
          AP:0,
          Treasure:0,
          Flag:0,
          sumTotal:0
        };
      }
      total[r.id].sumPlacementP += r.PlacementP;
      total[r.id].KP += r.KP;
      total[r.id].AP += r.AP;
      total[r.id].Treasure += r.Treasure;
      total[r.id].Flag += r.Flag;
      total[r.id].sumTotal += r.Total;
    }
  }

  // ★★★★★★★★★★★★★★★★★★★★★★★★★★★
  // ✅ core 連携用（今回の超重要追加部分）
  // ★★★★★★★★★★★★★★★★★★★★★★★★★★★
  function finishMatchAndBuildResult(state){

    if (!state) return { rows:[], total:{} };

    const rows = computeMatchResultTable(state);

    state.lastMatchResultRows = rows;

    if (!state.tournamentTotal){
      state.tournamentTotal = {};
    }

    addToTournamentTotal(state, rows);

    // H2Hは試合単位なのでクリア
    state.h2h = {};

    return {
      rows,
      total: state.tournamentTotal
    };
  }

  window.MOBBR.sim.tournamentResult = {
    PLACEMENT_P,
    computePlacements,
    getChampionName,
    computeMatchResultTable,
    addToTournamentTotal,
    finishMatchAndBuildResult   // ← これが無かった
  };

})();
