'use strict';

/*
  sim_tournament_core_post.js（ローカル終了処理 実装版）

  ■ 追加機能
  1. ローカル大会終了後
     - 1週進行
     - メイン画面へ戻す
  2. TOP10ならナショナル出場権付与
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.sim = window.MOBBR.sim || {};

(function(){

  const QUALIFY_KEY = 'mobbr_national_qualified';

  function setNationalQualified(v){
    try{
      localStorage.setItem(QUALIFY_KEY, v ? '1' : '0');
    }catch(e){}
  }

  function getNationalQualified(){
    try{
      return localStorage.getItem(QUALIFY_KEY) === '1';
    }catch(e){
      return false;
    }
  }

  function dispatch(name, detail){
    try{
      window.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
    }catch(e){}
  }

  // ============================================
  // ローカル大会終了処理
  // ============================================
  function onLocalTournamentFinished(state, total){

    if (!state || !total) return;

    const playerId = 'PLAYER';

    // ---- 総合順位計算 ----
    const list = Object.values(total || []);

    list.sort((a,b)=>{
      if ((b.sumTotal||0) !== (a.sumTotal||0)) return (b.sumTotal||0)-(a.sumTotal||0);
      if ((b.sumPlacementP||0)!==(a.sumPlacementP||0)) return (b.sumPlacementP||0)-(a.sumPlacementP||0);
      return 0;
    });

    const rank = list.findIndex(x => x.id === playerId) + 1;

    // ---- TOP10判定 ----
    const qualified = rank > 0 && rank <= 10;

    setNationalQualified(qualified);

    // ---- 1週進行 ----
    dispatch('mobbr:advanceWeek', { weeks:1 });

    // ---- メインへ戻す ----
    dispatch('mobbr:goMain', {
      localFinished: true,
      rank,
      qualified
    });
  }

  // ============================================
  // ナショナル終了処理（今は未使用）
  // ============================================
  function onNationalTournamentFinished(state, total){
    dispatch('mobbr:goMain', {
      nationalFinished: true
    });
  }

  window.MOBBR.sim.tournamentCorePost = {
    setNationalQualified,
    getNationalQualified,
    dispatch,
    onLocalTournamentFinished,
    onNationalTournamentFinished
  };

})();
