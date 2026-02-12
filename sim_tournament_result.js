'use strict';

/*
  sim_tournament_result.js（フル）
  - v3.2.0 の「順位/ポイント/集計」担当
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

  function computePlacements(state){
    const teams = state.teams.slice();
    teams.sort((a,b)=>{
      const ae = a.eliminated ? 1 : 0;
      const be = b.eliminated ? 1 : 0;
      if (ae !== be) return ae - be;

      const ak = Number(a.kills_total||0);
      const bk = Number(b.kills_total||0);
      if (bk !== ak) return bk - ak;

      const ap = Number(a.power||0);
      const bp = Number(b.power||0);
      if (ap !== bp) return ap - bp;

      return String(a.name||'').localeCompare(String(b.name||''), 'ja');
    });

    for(let i=0;i<teams.length;i++){
      for(let j=i+1;j<teams.length;j++){
        const a = teams[i], b = teams[j];
        if (!!a.eliminated === !!b.eliminated &&
            (a.kills_total||0)===(b.kills_total||0) &&
            Number(a.power||0)===Number(b.power||0)){
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
