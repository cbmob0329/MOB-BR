'use strict';

/*
  sim_tournament_result.js（フル / 統合修正版）
  - v3.2.0 の「順位/ポイント/集計」担当を維持
  ✅ 修正1：eliminatedRound を最優先（遅く落ちた方が上）
  ✅ 修正2：「自分が負けた相手が下にいる」問題を H2H（state.h2h）で矯正（同ラウンド内の最優先補正）
  ✅ 修正3：power 比較の符号ミス修正（高い方が上になるように）
  ✅ 継続：downs_total タイブレーク（少ない方が上）
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

  // eliminatedRound が無い/0 の個体を「早期脱落扱い」に寄せる（下に行きやすくする）
  function safeElimRound(t){
    const r = Number(t?.eliminatedRound || 0);
    // eliminated=true なのに eliminatedRound が無い個体は最悪扱い（=1相当）
    if (r > 0) return r;
    return 1;
  }

  function computePlacements(state){
    const teams = (state?.teams || []).slice();

    teams.sort((a,b)=>{

      // ① 生存優先（eliminated=false が上）
      const ae = a.eliminated ? 1 : 0;
      const be = b.eliminated ? 1 : 0;
      if (ae !== be) return ae - be;

      // ② eliminatedRound（遅く落ちた方が上）
      //    - 生存者は round=99 扱いで常に上
      const ar = ae ? safeElimRound(a) : 99;
      const br = be ? safeElimRound(b) : 99;
      if (ar !== br) return br - ar;

      // ③ H2H（同じ eliminatedRound の範囲で最優先矯正）
      //    ※同一試合内で AがBを倒しているなら、AはBより下にならない
      //    ※「両方 eliminated=true」だけでなく、同じround帯の比較なら適用してOK
      const aBeatB = h2hWins(state, a.id, b.id);
      const bBeatA = h2hWins(state, b.id, a.id);
      if (aBeatB > 0 && bBeatA === 0) return -1; // aが上
      if (bBeatA > 0 && aBeatB === 0) return  1; // bが上

      // ④ キル数（多い方が上）
      const ak = Number(a.kills_total||0);
      const bk = Number(b.kills_total||0);
      if (bk !== ak) return bk - ak;

      // ⑤ タイブレーク：downs_total（少ない方が上）
      const ad = Number(a.downs_total||0);
      const bd = Number(b.downs_total||0);
      if (ad !== bd) return ad - bd;

      // ⑥ power（高い方が上） ← ✅ここが v3.2.0 の符号ミス修正点
      const ap = Number(a.power||0);
      const bp = Number(b.power||0);
      if (bp !== ap) return bp - ap;

      // ⑦ 最後は名前（安定）
      return String(a.name||'').localeCompare(String(b.name||''), 'ja');
    });

    // 同率ランダム（最後の最後）
    for(let i=0;i<teams.length;i++){
      for(let j=i+1;j<teams.length;j++){
        const A = teams[i], B = teams[j];

        const Ae = !!A.eliminated, Be = !!B.eliminated;
        const Ar = Ae ? safeElimRound(A) : 99;
        const Br = Be ? safeElimRound(B) : 99;

        if (Ae === Be &&
            Ar === Br &&
            Number(A.kills_total||0) === Number(B.kills_total||0) &&
            Number(A.downs_total||0) === Number(B.downs_total||0) &&
            Number(A.power||0) === Number(B.power||0)){

          // ここでも H2H があるなら尊重
          const aBeatB = h2hWins(state, A.id, B.id);
          const bBeatA = h2hWins(state, B.id, A.id);
          if (aBeatB > 0 && bBeatA === 0) continue;
          if (bBeatA > 0 && aBeatB === 0){ teams[i]=B; teams[j]=A; continue; }

          if (Math.random() < 0.5){ teams[i]=B; teams[j]=A; }
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
    const byId = new Map((state?.teams || []).map(t=>[t.id,t]));

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
