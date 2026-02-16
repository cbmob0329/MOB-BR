'use strict';

/*
  sim_tournament_core_post.js（ローカル終了処理 実装版 / tour_state対応・フル）

  ■ 目的（今回の修正ポイント）
  1. ローカル大会終了後
     - 1週進行
     - メイン画面へ戻す
  2. TOP10ならナショナル出場権付与

  ■ 重要（仕様統一）
  - 出場権の“正”は localStorage 'mobbr_tour_state'
    ui_schedule.js はこれを見て「次の大会」を決める。
  - 旧キー 'mobbr_national_qualified' は互換用に残す（あっても害なし）。
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.sim = window.MOBBR.sim || {};

(function(){

  // 旧互換キー（残す）
  const LEGACY_QUALIFY_KEY = 'mobbr_national_qualified';

  // 正式キー（ui_schedule.js と一致）
  const TOUR_STATE_KEY = 'mobbr_tour_state';

  function safeJSONParse(raw){
    try{ return JSON.parse(raw); }catch(e){ return null; }
  }

  function getTourState(){
    try{
      const raw = localStorage.getItem(TOUR_STATE_KEY);
      const obj = raw ? safeJSONParse(raw) : null;
      if (obj && typeof obj === 'object') return obj;
    }catch(e){}
    return {
      split: 1,
      stage: 'local',
      qualifiedNational: false,
      qualifiedWorld: false,
      clearedNational: false
    };
  }

  function setTourState(obj){
    try{
      localStorage.setItem(TOUR_STATE_KEY, JSON.stringify(obj || {}));
    }catch(e){}
  }

  function setLegacyNationalQualified(v){
    try{
      localStorage.setItem(LEGACY_QUALIFY_KEY, v ? '1' : '0');
    }catch(e){}
  }

  function getLegacyNationalQualified(){
    try{
      return localStorage.getItem(LEGACY_QUALIFY_KEY) === '1';
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

    // ---- 出場権を“正式キー”へ反映（ここが本命） ----
    // 1) storage.js が新APIを持っていればそれを使う
    try{
      const S = window.MOBBR?.storage;
      if (qualified && S && typeof S.grantNationalQualification === 'function'){
        S.grantNationalQualification();
      }else{
        // 2) フォールバック：tour_state を直接更新
        const ts = getTourState();
        ts.qualifiedNational = !!qualified;

        // stage/split はここでは強制しない（次の大会判定は qualifiedNational だけで成立）
        // ただし stage が空/不正なら最低限補正
        if (!ts.stage) ts.stage = 'local';
        if (!Number.isFinite(Number(ts.split))) ts.split = 1;

        setTourState(ts);
      }
    }catch(e){
      // 3) 最終フォールバック：最低限 tour_state を直接更新
      const ts = getTourState();
      ts.qualifiedNational = !!qualified;
      if (!ts.stage) ts.stage = 'local';
      if (!Number.isFinite(Number(ts.split))) ts.split = 1;
      setTourState(ts);
    }

    // ---- 旧互換キーも更新（残しておく） ----
    setLegacyNationalQualified(qualified);

    // ---- 1週進行 ----
    dispatch('mobbr:advanceWeek', { weeks: 1 });

    // ---- メインへ戻す ----
    dispatch('mobbr:goMain', {
      localFinished: true,
      rank,
      qualified
    });

    // （任意）UIが次大会表示を即更新したい場合に使える通知
    dispatch('mobbr:tourStateUpdated', {
      qualifiedNational: qualified,
      rank
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
    // legacy
    setNationalQualified: setLegacyNationalQualified,
    getNationalQualified: getLegacyNationalQualified,

    // tour state helpers（必要なら使える）
    getTourState,
    setTourState,

    dispatch,
    onLocalTournamentFinished,
    onNationalTournamentFinished
  };

})();
