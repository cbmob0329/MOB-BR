'use strict';

/* =========================================================
   ui_tournament.js（v3.6.14 split-3 entry）FULL
   - split-1(core) / split-2(handlers) を前提にする entry
   - ✅ バナー補正（WORLD FINAL / MATCH総数）は core 側に統一（entry上書き禁止）
   - ✅ NEXT停止事故対策：hold解除/同一req再描画の抜けを塞ぐ
   - ✅ sessionBar 表示更新は core の syncSessionBar に統一
========================================================= */

window.MOBBR = window.MOBBR || {};
window.MOBBR.ui = window.MOBBR.ui || {};

(function(){

  const MOD = window.MOBBR.ui._tournamentMod;
  if (!MOD){
    console.error('[ui_tournament.entry] module missing (core not loaded)');
    return;
  }

  const {
    ensureDom,
    getFlow,
    getState,
    mkReqKey,

    lockUI,
    unlockUI,

    setNextEnabled,
    onNextCore,

    syncSessionBar,
    setBattleMode,
    setChampionMode,
    setResultStampMode,

    openCore,
    closeCore
  } = MOD;

  function bindOnce(){
    const dom = ensureDom();
    if (!dom._bound){
      dom._bound = true;
      dom.nextBtn.addEventListener('click', onNext);
      dom.closeBtn.addEventListener('click', close);
    }
  }

  function open(){
    bindOnce();
    openCore();
    // entry側でバナー/ネーム等を上書きしない（core/handlersに統一）
  }

  function close(){
    closeCore();
  }

  function callHandlerByReq(req){
    // switch を最小化：存在する handler を優先して呼ぶ
    if (!req || !req.type) return null;

    // よくあるタイプは直呼び（存在保証しやすい）
    if (req.type === 'showMatchResult' && MOD.handleShowMatchResult) return MOD.handleShowMatchResult(req);
    if (req.type === 'showTournamentResult' && MOD.handleShowTournamentResult) return MOD.handleShowTournamentResult(req);
    if (req.type === 'showBattle' && MOD.handleShowBattle) return MOD.handleShowBattle(req);
    if (req.type === 'showEncounter' && MOD.handleShowEncounter) return MOD.handleShowEncounter(req);

    const name = `handle${req.type.charAt(0).toUpperCase()}${req.type.slice(1)}`;
    if (typeof MOD[name] === 'function') return MOD[name](req);

    return null;
  }

  async function render(){
    bindOnce();
    ensureDom();

    if (MOD._getRendering()) return;
    MOD._setRendering(true);
    lockUI();

    try{
      const st = getState();
      const req = st?.request || null;

      // sessionBar は常に同期
      syncSessionBar();

      // hold中は “同じ種類のreq” 以外を一旦保留
      const hold = MOD._getHoldScreenType();
      if (hold && req && req.type !== hold){
        MOD._setPendingReqAfterHold(req);
        return;
      }

      // 同一requestキーはスキップ（ただし hold解除直後は強制描画する仕組みが onNext にある）
      const key = mkReqKey(req);
      if (key && key === MOD._getLastReqKey()){
        return;
      }
      MOD._setLastReqKey(key);

      MOD.clearAutoTimer();
      MOD.clearLocalNext();

      if (!req || !req.type){
        // “何も表示するものがない” 状態の整形
        setBattleMode(false);
        setChampionMode(false);
        setResultStampMode(false);
        syncSessionBar();
        return;
      }

      const p = callHandlerByReq(req);
      if (p && typeof p.then === 'function'){
        await p;
      }

      syncSessionBar();

    }catch(e){
      console.error('[ui_tournament] render error:', e);
    }finally{
      MOD._setRendering(false);
      unlockUI();
      setNextEnabled(true);
    }
  }

  /* =========================================================
     NEXT安定化（事故防止）
     - onNextCore() が “shouldRender:true” を返したら即 render()
     - hold解除直後は lastReqKey を空にして強制 render()
     - step後に request が消える/遷移しないケースの保険を入れる
  ========================================================= */
  function onNext(){
    const flow = getFlow();
    const holdBefore = MOD._getHoldScreenType();

    const res = onNextCore();

    // onNextCoreが “描画して” の合図を出したら描画
    if (res && res.shouldRender){
      render();
      return;
    }

    const holdAfter = MOD._getHoldScreenType();

    // hold解除直後は “同一req” ガードを外して強制再描画
    if (holdBefore && !holdAfter){
      MOD._setLastReqKey('');
      render();
      return;
    }

    // ここから下は “安全弁”
    // stepで request が消えた/変化しない状態が起きた場合にもう一押しする
    const stAfter = getState();
    if (flow && stAfter && !stAfter.request){
      flow.step();
      MOD._setLastReqKey('');
      render();
      return;
    }
  }

  MOD.render = render;
  MOD.close = close;

  window.MOBBR.ui.tournament = { open, close, render };
  window.MOBBR.initTournamentUI = function(){ bindOnce(); };

})();
