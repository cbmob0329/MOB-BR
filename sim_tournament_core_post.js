/* =========================================================
   sim_tournament_core_post.js（FULL）
   - “大会終了後”の処理を将来ここに集約できるように分離
   - 現時点では core の挙動を変えないため、全部 “任意フック” だけ
   - core からは「存在したら呼べる」形にしている（無ければ何もしない）
   ========================================================= */
'use strict';

window.MOBBR = window.MOBBR || {};
window.MOBBR.sim = window.MOBBR.sim || {};

(function(){

  // 例：ローカル大会のトップ10入り権利などを保存したい時に使う（現状は未使用）
  function setNationalQualified(v){
    try{
      localStorage.setItem('mobbr_national_qualified', v ? '1' : '0');
    }catch(e){}
  }
  function getNationalQualified(){
    try{
      return localStorage.getItem('mobbr_national_qualified') === '1';
    }catch(e){
      return false;
    }
  }

  // 例：週進行やメイン復帰をゲーム側に依頼するためのイベント（現状は未使用）
  function dispatch(name, detail){
    try{
      window.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
    }catch(e){}
  }

  // 任意フック：core側が「存在したら呼べる」ように置く
  // ※今は core から “必ずは呼ばない” → 挙動は変わらない
  function onLocalTournamentFinished(/* state, total */){
    // ここで top10 判定 → setNationalQualified(true) などを将来実装できる
  }

  function onNationalTournamentFinished(/* state, total */){
    // ここで world/lastchance 判定などを将来実装できる
  }

  window.MOBBR.sim.tournamentCorePost = {
    setNationalQualified,
    getNationalQualified,
    dispatch,
    onLocalTournamentFinished,
    onNationalTournamentFinished
  };

})();
