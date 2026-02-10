'use strict';

/*
  MOB BR - tournament_runtime.js（FULL）
  役割：
  - tournament_flow のインスタンスを一元管理
  - UI / app.js からは start(type) / next() だけを公開
  - B案：ui_tournament → runtime.next() → flow.next()
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.tournament = window.MOBBR.tournament || {};

(function(){

  let flow = null;          // 現在稼働中の flow
  let currentType = null;  // LOCAL / NATIONAL / etc
  let hooks = null;        // 接続中 hooks

  /* =========================
     内部 util
  ========================= */
  function hasFlow(){
    return !!flow;
  }

  function reset(){
    flow = null;
    currentType = null;
    hooks = null;
  }

  /* =========================
     start
     - 新しい大会を開始
     - 既に動いていたら破棄して作り直す
  ========================= */
  function start(type, optHooks){
    const t = String(type || '').toUpperCase();

    if (!window.MOBBR?.tournament?.flow){
      console.error('[tournament_runtime] tournament_flow not loaded');
      return;
    }

    // 既存大会があれば強制リセット
    reset();

    hooks = optHooks || {};

    try{
      flow = window.MOBBR.tournament.flow.createFlow({
        tournamentType: t,
        hooks
      });
      currentType = t;
    }catch(e){
      console.error('[tournament_runtime] failed to create flow', e);
      reset();
      return;
    }

    // 開始は「週バナー」から
    flow.startWeekBanner();
  }

  /* =========================
     next
     - ui_tournament の NEXT ボタンから必ずここに来る
  ========================= */
  function next(){
    if (!flow){
      console.warn('[tournament_runtime] next() called but no active flow');
      return;
    }

    try{
      flow.next();
    }catch(e){
      console.error('[tournament_runtime] flow.next() error', e);
    }
  }

  /* =========================
     enter confirm
     - ENTER確認（はい／いいえ）を流す
  ========================= */
  function chooseEnter(isYes){
    if (!flow){
      console.warn('[tournament_runtime] chooseEnter() but no flow');
      return;
    }
    if (typeof flow.chooseEnter === 'function'){
      flow.chooseEnter(!!isYes);
    }
  }

  /* =========================
     状態取得（デバッグ用）
  ========================= */
  function getState(){
    return flow ? flow.getState() : null;
  }

  function getType(){
    return currentType;
  }

  /* =========================
     export
  ========================= */
  window.MOBBR.tournament.runtime = {
    start,        // start('LOCAL', hooks)
    next,         // NEXT進行
    chooseEnter,  // ENTER確認用
    getState,
    getType,
    hasFlow
  };

})();
