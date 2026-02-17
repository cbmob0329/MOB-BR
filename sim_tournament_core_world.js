/* =========================================================
   sim_tournament_core_world.js（FULL） v1.0
   - ワールドファイナル専用（週分割：qual → wl → final）
   - mobbr_tour_state.world に進行保存
   - 各週終了時に mobbr:goMain(advanceWeeks:1)
========================================================= */
'use strict';

window.MOBBR = window.MOBBR || {};
window.MOBBR.sim = window.MOBBR.sim || {};

(function(){

  const K = {
    tourState: 'mobbr_tour_state'
  };

  function getJSON(key, def){
    try{
      const raw = localStorage.getItem(key);
      if (!raw) return def;
      return JSON.parse(raw);
    }catch(e){
      return def;
    }
  }
  function setJSON(key, val){
    try{ localStorage.setItem(key, JSON.stringify(val)); }catch(e){}
  }

  function dispatch(name, detail){
    try{
      window.dispatchEvent(new CustomEvent(name, { detail: detail||{} }));
    }catch(e){}
  }

  // =========================================================
  // ===== 初回開始（予選リーグ）=====
  // =========================================================
  function startWorldQual(allTeamDefs, groups){
    const tourState = getJSON(K.tourState, {}) || {};

    tourState.world = {
      phase: 'qual',

      allTeamDefs,
      groups,

      tournamentTotal: {},

      qual: {
        sessionIndex: 0,
        matchIndex: 1
      }
    };

    setJSON(K.tourState, tourState);
  }

  // =========================================================
  // ===== 予選終了 → WLへ =====
  // =========================================================
  function finishQualAndBuildWL(tournamentTotal){
    const tourState = getJSON(K.tourState, {}) || {};
    if (!tourState.world) return;

    const total = tournamentTotal || {};
    const list = Object.values(total);

    list.sort((a,b)=>{
      if ((b.sumTotal||0)!==(a.sumTotal||0))
        return (b.sumTotal||0)-(a.sumTotal||0);
      return 0;
    });

    const top20 = list.slice(0,20).map(x=>x.id);
    const bottom20 = list.slice(20,40).map(x=>x.id);

    tourState.world.phase = 'wl';
    tourState.world.tournamentTotal = total;
    tourState.world.wlPools = {
      winners20: top20,
      losers20: bottom20
    };

    setJSON(K.tourState, tourState);

    dispatch('mobbr:goMain', { worldFinished:true, advanceWeeks:1 });
  }

  // =========================================================
  // ===== WL終了 → Finalへ =====
  // =========================================================
  function finishWLAndBuildFinal(final20Ids){
    const tourState = getJSON(K.tourState, {}) || {};
    if (!tourState.world) return;

    tourState.world.phase = 'final';
    tourState.world.final = {
      teams: final20Ids,
      matchPointLit: {}
    };

    setJSON(K.tourState, tourState);

    dispatch('mobbr:goMain', { worldFinished:true, advanceWeeks:1 });
  }

  // =========================================================
  // ===== Final終了 =====
  // =========================================================
  function finishWorldFinal(championId){
    const tourState = getJSON(K.tourState, {}) || {};
    if (!tourState.world) return;

    tourState.world.phase = 'done';
    tourState.world.champion = championId;

    setJSON(K.tourState, tourState);

    dispatch('mobbr:goMain', { worldFinished:true, advanceWeeks:1 });
  }

  window.MOBBR.sim.tournamentCoreWorld = {
    startWorldQual,
    finishQualAndBuildWL,
    finishWLAndBuildFinal,
    finishWorldFinal
  };

})();
