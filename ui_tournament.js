'use strict';

/* =========================================================
   ui_tournament.js（v3.6.12 split-3 FULL）
   - entry / bind / dispatcher / render だけ担当（core+handlers を利用）
   - ✅ core: ui_tournament.core.js（split-1）FULL が先に読み込まれている前提
   - ✅ handlers: ui_tournament.handlers.js（split-2）FULL が先に読み込まれている前提

   ✅ v3.6.12（今回の②対応：UI側の最終まとめ）
   - 試合result と 総合result の “表示分離” は handlers 側で対応済み
   - 総合result の通過ライン色分け / WORLD FINAL点灯色分け は handlers 側で対応済み
   - スクロール位置リセットは core 側で対応済み
========================================================= */

window.MOBBR = window.MOBBR || {};
window.MOBBR.ui = window.MOBBR.ui || {};

(function(){

  const MOD = window.MOBBR.ui._tournamentMod;
  if (!MOD){
    console.error('[ui_tournament] core module missing: window.MOBBR.ui._tournamentMod');
    return;
  }

  // split-2 が先に読めてない場合でも “後から” 注入される想定で動くようにする
  //（ただし handlers が無いと render できない）
  const HANDLER_NAMES = [
    'handleShowArrival',
    'handleShowIntroText',
    'handleShowAutoSession',
    'handleShowAutoSessionDone',
    'handleShowTeamList',
    'handleShowCoachSelect',
    'handleShowDropStart',
    'handleShowDropLanded',
    'handleShowRoundStart',
    'handleShowEvent',
    'handlePrepareBattles',
    'handleShowEncounter',
    'handleShowBattle',
    'handleShowMove',
    'handleShowChampion',
    'handleShowMatchResult',
    'handleShowTournamentResult',
    'handleShowNationalNotice',
    'handleEndTournament',
    'handleEndNationalWeek',
    'handleNextMatch'
  ];

  const {
    ensureDom,
    openCore,
    closeCore,

    getFlow,
    getState,

    mkReqKey,
    setNextEnabled,
    onNextCore,

    lockUI,
    unlockUI
  } = MOD;

  let bound = false;

  function hasHandlers(){
    return HANDLER_NAMES.every(k => typeof MOD[k] === 'function');
  }

  function bindOnce(){
    if (bound) return;
    bound = true;

    const dom = ensureDom();

    dom.nextBtn.addEventListener('click', ()=>{
      const r = onNextCore();
      if (r && r.shouldRender){
        MOD.render();
      }
    });

    dom.closeBtn.addEventListener('click', ()=>{
      MOD.close();
    });

    // キーボード（PCデバッグ）
    window.addEventListener('keydown', (e)=>{
      if (!dom.overlay.classList.contains('isOpen')) return;
      if (e.key === 'Enter' || e.key === ' '){
        e.preventDefault();
        const r = onNextCore();
        if (r && r.shouldRender) MOD.render();
      }
      if (e.key === 'Escape'){
        e.preventDefault();
        MOD.close();
      }
    });
  }

  // =============== Request pickup (robust) ===============
  function peekReq(flow){
    if (!flow) return null;

    // “参照だけ”
    try{
      if (typeof flow.peekUiRequest === 'function') return flow.peekUiRequest() || null;
    }catch(e){}

    try{
      if (typeof flow.peekRequest === 'function') return flow.peekRequest() || null;
    }catch(e){}

    // state.ui.req などに載せている実装もある
    try{
      const st = getState();
      if (st && st.ui && st.ui.req) return st.ui.req;
      if (st && st.ui && st.ui.request) return st.ui.request;
    }catch(e){}

    try{
      if (flow.uiReq) return flow.uiReq;
      if (flow.uiRequest) return flow.uiRequest;
      if (flow.req) return flow.req;
      if (flow.request) return flow.request;
    }catch(e){}

    return null;
  }

  function consumeReq(flow){
    if (!flow) return;

    try{
      if (typeof flow.consumeUiRequest === 'function'){ flow.consumeUiRequest(); return; }
    }catch(e){}
    try{
      if (typeof flow.consumeRequest === 'function'){ flow.consumeRequest(); return; }
    }catch(e){}

    // state.ui.req を使う実装
    try{
      const st = getState();
      if (st && st.ui){
        if ('req' in st.ui) st.ui.req = null;
        if ('request' in st.ui) st.ui.request = null;
      }
    }catch(e){}

    // 最終手段
    try{
      if ('uiReq' in flow) flow.uiReq = null;
      if ('uiRequest' in flow) flow.uiRequest = null;
      if ('req' in flow) flow.req = null;
      if ('request' in flow) flow.request = null;
    }catch(e){}
  }

  function stashPendingIfHolding(req){
    const holdType = MOD._getHoldScreenType ? MOD._getHoldScreenType() : null;
    if (!holdType) return false;

    const pending = MOD._getPendingReqAfterHold ? MOD._getPendingReqAfterHold() : null;
    if (pending) return true; // すでに待ちがある → 何もしない

    const t = String(req?.type || '');
    if (!t) return false;

    // hold中に “同じ種別” が来た場合は上書きしない（そのまま表示維持）
    if (t === holdType) return true;

    // hold中に別reqが来た → 保管して、NEXTで解除→描画へ
    if (MOD._setPendingReqAfterHold) MOD._setPendingReqAfterHold(req);
    return true;
  }

  // =============== Dispatcher ===============
  async function dispatch(req){
    const t = String(req?.type || '');
    const p = req?.payload ?? req;

    // ここで “UNKNOWN” は食わない（デバッグで分かるように）
    switch(t){
      case 'showArrival':            return MOD.handleShowArrival(p);
      case 'showIntroText':          return MOD.handleShowIntroText(p);
      case 'showAutoSession':        return MOD.handleShowAutoSession(p);
      case 'showAutoSessionDone':    return MOD.handleShowAutoSessionDone(p);
      case 'showTeamList':           return MOD.handleShowTeamList(p);
      case 'showCoachSelect':        return MOD.handleShowCoachSelect(p);
      case 'showDropStart':          return MOD.handleShowDropStart(p);
      case 'showDropLanded':         return MOD.handleShowDropLanded(p);
      case 'showRoundStart':         return MOD.handleShowRoundStart(p);
      case 'showEvent':              return MOD.handleShowEvent(p);
      case 'prepareBattles':         return MOD.handlePrepareBattles(p);
      case 'showEncounter':          return MOD.handleShowEncounter(p);
      case 'showBattle':             return MOD.handleShowBattle(p);
      case 'showMove':               return MOD.handleShowMove(p);
      case 'showChampion':           return MOD.handleShowChampion(p);
      case 'showMatchResult':        return MOD.handleShowMatchResult(p);
      case 'showTournamentResult':   return MOD.handleShowTournamentResult(p);
      case 'showNationalNotice':     return MOD.handleShowNationalNotice(p);
      case 'nextMatch':              return MOD.handleNextMatch(p);
      case 'endTournament':          return MOD.handleEndTournament(p);
      case 'endNationalWeek':        return MOD.handleEndNationalWeek(p);
      default:
        console.warn('[ui_tournament] unknown req.type:', t, req);
        return;
    }
  }

  // =============== Public API ===============
  async function render(){
    if (MOD._getRendering && MOD._getRendering()) return;

    const flow = getFlow();
    if (!flow){
      // flow が居ないときはUIだけ開いていても意味がないので落とさないが操作不能に
      setNextEnabled(false);
      return;
    }

    if (!hasHandlers()){
      console.error('[ui_tournament] handlers missing. make sure split-2 is loaded before calling render().');
      setNextEnabled(false);
      return;
    }

    const req = peekReq(flow);
    if (!req){
      // リクエスト無し：NEXTだけ押せる状態に戻す（busy/lockはcoreが面倒見る）
      setNextEnabled(true);
      return;
    }

    // hold中なら “別req” は保管して、現画面維持
    if (stashPendingIfHolding(req)){
      setNextEnabled(true);
      return;
    }

    // 同じreqを二重描画しない
    const key = mkReqKey(req);
    const last = MOD._getLastReqKey ? MOD._getLastReqKey() : '';
    if (key && key === last){
      // ただし、NEXTが止まる事故を避けるため enable は戻す
      setNextEnabled(true);
      return;
    }

    if (MOD._setRendering) MOD._setRendering(true);
    if (MOD._setLastReqKey) MOD._setLastReqKey(key);

    // 描画中はNEXT無効（handlers内の lock/unlock と二重でもOK）
    setNextEnabled(false);

    try{
      await dispatch(req);
      consumeReq(flow);
    }catch(e){
      console.error('[ui_tournament] render error:', e);
    }finally{
      if (MOD._setRendering) MOD._setRendering(false);
      // lock/busyが無ければNEXT戻す
      setNextEnabled(true);
    }
  }

  function open(){
    bindOnce();
    openCore();

    // open直後に1回描画
    render();
  }

  function close(){
    closeCore();
  }

  // ===== expose =====
  Object.assign(MOD, {
    open,
    close,
    render
  });

  // 既存互換：window.MOBBR.ui.tournament
  window.MOBBR.ui.tournament = window.MOBBR.ui.tournament || {};
  Object.assign(window.MOBBR.ui.tournament, {
    open: ()=>MOD.open(),
    close: ()=>MOD.close(),
    render: ()=>MOD.render()
  });

})();
