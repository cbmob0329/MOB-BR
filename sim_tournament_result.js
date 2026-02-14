'use strict';

/*
  sim_tournament_result.js（フル）
  - v3.2.0 の「順位/ポイント/集計」担当
  ✅ 修正：
    - 「自分が負けた相手が下にいる」問題を H2H（state.h2h）で矯正
      ※同一試合内で AがBを倒しているなら、AはBより下にならない
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

  function computePlacements(state){
    const teams = state.teams.slice();

    teams.sort((a,b)=>{
      const ae = a.eliminated ? 1 : 0;
      const be = b.eliminated ? 1 : 0;
      if (ae !== be) return ae - be;

      // ✅ H2H（同一試合で勝ってる方が下にならない）
      // - とくに「両方 eliminated=true」の範囲で最優先で矯正する
      if (ae === 1 && be === 1){
        const aBeatB = h2hWins(state, a.id, b.id);
        const bBeatA = h2hWins(state, b.id, a.id);
        if (aBeatB > 0 && bBeatA === 0) return -1; // aが上
        if (bBeatA > 0 && aBeatB === 0) return  1; // bが上
      }

      const ak = Number(a.kills_total||0);
      const bk = Number(b.kills_total||0);
      if (bk !== ak) return bk - ak;

      // タイブレーク：downs_total（少ない方が上）
      const ad = Number(a.downs_total||0);
      const bd = Number(b.downs_total||0);
      if (ad !== bd) return ad - bd;

      const ap = Number(a.power||0);
      const bp = Number(b.power||0);
      if (ap !== bp) return ap - bp;

      return String(a.name||'').localeCompare(String(b.name||''), 'ja');
    });

    // 同率ランダム（最後の最後）
    for(let i=0;i<teams.length;i++){
      for(let j=i+1;j<teams.length;j++){
        const a = teams[i], b = teams[j];
        if (!!a.eliminated === !!b.eliminated &&
            (a.kills_total||0)===(b.kills_total||0) &&
            Number(a.downs_total||0)===Number(b.downs_total||0) &&
            Number(a.power||0)===Number(b.power||0)){
          // ここでも H2H があるなら尊重
          const aBeatB = h2hWins(state, a.id, b.id);
          const bBeatA = h2hWins(state, b.id, a.id);
          if (aBeatB > 0 && bBeatA === 0) continue;
          if (bBeatA > 0 && aBeatB === 0){ teams[i]=b; teams[j]=a; continue; }

          if (Math.random() < 0.5){ teams[i]=b; teams[j]=a; }
        }
      }
    }
    return teams.map((t, idx)=>({ id:t.id, name:t.name, placement: idx+1 }));
  }

  function getChampionName(state){
    const placements = computePlacements(state);
    const top = placements && placements[0];
    return top ? String(top.name || top.id || '') : '';
  }

  function computeMatchResultTable(state){
    const placements = computePlacements(state);
    const byId = new Map(state.teams.map(t=>[t.id,t]));

    return placements.map(p=>{
      const t = byId.get(p.id) || {};
      const KP = Number(t.kills_total||0);
      const AP = Number(t.assists_total||0);
      const Treasure = Number(t.treasure||0);
      const Flag = Number(t.flag||0);
      const PlacementP = PLACEMENT_P(p.placement);
      const Total = PlacementP + KP + AP + Treasure + (Flag*2);

      return { placement:p.placement, id:p.id, squad:p.name, KP, AP, Treasure, Flag, Total, PlacementP };
    });
  }

  function addToTournamentTotal(state, matchRows){
    const total = state.tournamentTotal;
    for(const r of matchRows){
      if (!total[r.id]){
        total[r.id] = { id:r.id, squad:r.squad, sumPlacementP:0, KP:0, AP:0, Treasure:0, Flag:0, sumTotal:0 };
      }
      total[r.id].sumPlacementP += r.PlacementP;
      total[r.id].KP += r.KP;
      total[r.id].AP += r.AP;
      total[r.id].Treasure += r.Treasure;
      total[r.id].Flag += r.Flag;
      total[r.id].sumTotal += r.Total;
    }
  }

  window.MOBBR.sim.tournamentResult = {
    PLACEMENT_P,
    computePlacements,
    getChampionName,
    computeMatchResultTable,
    addToTournamentTotal
  };

})();
