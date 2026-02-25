'use strict';

/* =========================================================
   ui_tournament.js（v3.6.14 split-3 FULL）
   - entry / bind / dispatcher / render
   - core: ui_tournament.core.js（split-1）FULL 前提
   - handlers: ui_tournament.handlers.js（split-2）FULL 前提

   ✅ v3.6.14（FIX）
   - ✅ noop req は即 consume（v3.6.13踏襲）
   - ✅ hold中 pendingReq を “必ず復帰して描画” する（止まり根絶）
   - ✅ lastReqKey は「描画成功後」に更新（途中returnで固定化しない）
   - ✅ 同一reqが残留しても “UI側で進行不能にならない” 防止策を追加
========================================================= */

window.MOBBR = window.MOBBR || {};
window.MOBBR.ui = window.MOBBR.ui || {};

(function(){

  const MOD = window.MOBBR.ui._tournamentMod;
  if (!MOD){
    console.error('[ui_tournament] core module missing: window.MOBBR.ui._tournamentMod');
    return;
  }

  // split-2 が後から注入される想定でも動くようにする
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

    // 以下は split-1 に存在（render中の補助）
    syncSessionBar,
    setBattleMode,
    setChampionMode,
    setResultStampMode,
    hidePanels,
    hideSplash,
    showCenterStamp
  } = MOD;

  let bound = false;

  function hasHandlers(){
    return HANDLER_NAMES.every(k => typeof MOD[k] === 'function');
  }

  // ===== 表示の後処理（v3.6.11相当を保持）=====
  function escapeHtml(str){
    return String(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function getOverlayEl(){
    return document.getElementById('mobbrTournamentOverlay');
  }

  function normalizeBannerTextTo2Lines(raw, mode){
    const s0 = String(raw || '').trim();
    if (!s0) return '';
    if (s0.includes('<br>')) return s0;

    if (mode === 'left'){
      const idx = s0.indexOf('MATCH');
      if (idx > 0){
        const a = s0.slice(0, idx).trim();
        const b = s0.slice(idx).trim();
        return `${escapeHtml(a)}<br>${escapeHtml(b)}`;
      }
      return escapeHtml(s0);
    }

    if (mode === 'right'){
      const m = s0.match(/^(ROUND)\s*(\d+.*)$/i);
      if (m){
        return `${escapeHtml(m[1].toUpperCase())}<br>${escapeHtml(m[2])}`;
      }
      return escapeHtml(s0);
    }

    return escapeHtml(s0);
  }

  function applyBannerFix(){
    const st = getState();
    const overlay = getOverlayEl();
    if (!overlay || !st) return;

    const leftEl  = overlay.querySelector('.banner .left');
    const rightEl = overlay.querySelector('.banner .right');
    if (!leftEl || !rightEl) return;

    const leftHtml  = normalizeBannerTextTo2Lines(st.bannerLeft,  'left');
    const rightHtml = normalizeBannerTextTo2Lines(st.bannerRight, 'right');

    try{ leftEl.innerHTML  = leftHtml; }catch(_){ leftEl.textContent = String(st.bannerLeft||''); }
    try{ rightEl.innerHTML = rightHtml; }catch(_){ rightEl.textContent = String(st.bannerRight||''); }
  }

  function applyNameBoxFix(){
    const overlay = getOverlayEl();
    if (!overlay) return;

    const names = overlay.querySelectorAll('.chars .char .name');
    for (const el of names){
      try{
        el.style.whiteSpace = 'pre-line';
        el.style.wordBreak  = 'keep-all';
      }catch(_){}
    }
  }

  function postRenderFixups(){
    applyBannerFix();
    applyNameBoxFix();
  }

  // ===== bind =====
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

  // ✅ v3.6.14: hold解除後は pending を最優先で描画
  function popPendingIfReady(){
    const holdType = MOD._getHoldScreenType ? MOD._getHoldScreenType() : null;
    if (holdType) return null; // まだhold中

    const pending = MOD._getPendingReqAfterHold ? MOD._getPendingReqAfterHold() : null;
    if (!pending) return null;

    // pending取り出し
    if (MOD._setPendingReqAfterHold) MOD._setPendingReqAfterHold(null);
    return pending;
  }

  // =============== Dispatcher ===============
  async function dispatch(req){
    const t = String(req?.type || '');

    switch(t){
      case 'showArrival':            return MOD.handleShowArrival(req);
      case 'showIntroText':          return MOD.handleShowIntroText(req);
      case 'showAutoSession':        return MOD.handleShowAutoSession(req);
      case 'showAutoSessionDone':    return MOD.handleShowAutoSessionDone(req);
      case 'showTeamList':           return MOD.handleShowTeamList(req);
      case 'showCoachSelect':        return MOD.handleShowCoachSelect(req);
      case 'showDropStart':          return MOD.handleShowDropStart(req);
      case 'showDropLanded':         return MOD.handleShowDropLanded(req);
      case 'showRoundStart':         return MOD.handleShowRoundStart(req);
      case 'showEvent':              return MOD.handleShowEvent(req);
      case 'prepareBattles':         return MOD.handlePrepareBattles(req);
      case 'showEncounter':          return MOD.handleShowEncounter(req);
      case 'showBattle':             return MOD.handleShowBattle(req);
      case 'showMove':               return MOD.handleShowMove(req);
      case 'showChampion':           return MOD.handleShowChampion(req);
      case 'showMatchResult':        return MOD.handleShowMatchResult(req);
      case 'showTournamentResult':   return MOD.handleShowTournamentResult(req);
      case 'showNationalNotice':     return MOD.handleShowNationalNotice(req);
      case 'nextMatch':              return MOD.handleNextMatch(req);
      case 'endTournament':          return MOD.handleEndTournament(req);
      case 'endNationalWeek':        return MOD.handleEndNationalWeek(req);
      default:
        // unknown/unused は握りつぶし（止まり要因にしない）
        console.warn('[ui_tournament] unknown req.type:', t, req);
        return;
    }
  }

  // =============== Public API ===============
  async function render(){
    bindOnce();
    ensureDom();

    // rendering中の多重呼び出しガード
    if (MOD._getRendering && MOD._getRendering()) return;

    const flow = getFlow();
    if (!flow){
      setNextEnabled(false);
      return;
    }

    if (!hasHandlers()){
      console.error('[ui_tournament] handlers missing. make sure split-2 is loaded before calling render().');
      setNextEnabled(false);
      return;
    }

    // UI側でも最新化（存在すれば）
    try{ if (typeof syncSessionBar === 'function') syncSessionBar(); }catch(e){}

    // ✅ pending（hold解除後）は最優先で描画する
    const pend = popPendingIfReady();
    if (pend){
      await renderOne(flow, pend, { fromPending:true });
      postRenderFixups();
      return;
    }

    const req = peekReq(flow);

    // ✅ noop は即消化（詰まり防止）
    if (req && String(req.type || '') === 'noop'){
      consumeReq(flow);
      setNextEnabled(true);
      postRenderFixups();
      return;
    }

    if (!req){
      setNextEnabled(true);
      postRenderFixups();
      return;
    }

    // hold中なら “別req” は保管して、現画面維持
    if (stashPendingIfHolding(req)){
      setNextEnabled(true);
      postRenderFixups();
      return;
    }

    await renderOne(flow, req, { fromPending:false });
    postRenderFixups();
  }

  // ✅ v3.6.14: lastReqKey の更新は「描画成功後」
  async function renderOne(flow, req, opt){
    if (MOD._setRendering) MOD._setRendering(true);

    // 描画中はNEXT無効（handlers内の lock/unlock と二重でもOK）
    setNextEnabled(false);

    try{
      // “同一req二重描画防止” は保つが、詰まりを防ぐため扱いを慎重にする
      const key = mkReqKey(req);
      const last = MOD._getLastReqKey ? MOD._getLastReqKey() : '';

      // ただし「同一keyが残り続ける」場合に、ここでreturnすると永遠に止まるので
      // fromPending のときはブロックしない（hold復帰で同一keyになりやすい）
      if (!opt?.fromPending && key && key === last){
        // もし同一keyなのにreqが残っている＝flow側がconsumeできてない可能性があるので
        // UI側で消して先へ進める（詰まり根絶）
        consumeReq(flow);
        setNextEnabled(true);
        return;
      }

      // 画面状態の最低限整合（存在すれば）
      try{
        const t = String(req?.type||'');
        if (!t || t === 'noop'){
          if (typeof setBattleMode === 'function' && MOD._getEncounterGatePhase && MOD._getEncounterGatePhase() === 0){
            setBattleMode(false);
          }
          if (typeof setChampionMode === 'function') setChampionMode(false);
          if (typeof setResultStampMode === 'function') setResultStampMode(false);
          if (typeof hidePanels === 'function') hidePanels();
          if (typeof hideSplash === 'function') hideSplash();
          if (typeof showCenterStamp === 'function') showCenterStamp('');
        }
      }catch(e){}

      await dispatch(req);

      // 基本は描画後にconsume（ここが最重要）
      consumeReq(flow);

      // ✅ 描画成功後に lastReqKey 更新（途中return/例外で固定化しない）
      if (MOD._setLastReqKey){
        const key2 = mkReqKey(req);
        MOD._setLastReqKey(key2);
      }

    }catch(e){
      console.error('[ui_tournament] render error:', e);

      // 例外でも “reqが残って止まる” のを防ぐため、一旦consumeして進行可能にする
      try{ consumeReq(flow); }catch(_){}

    }finally{
      if (MOD._setRendering) MOD._setRendering(false);
      setNextEnabled(true);
    }
  }

  function open(){
    bindOnce();
    openCore();
    render();
  }

  function close(){
    closeCore();
  }

  // ===== expose =====
  Object.assign(MOD, { open, close, render });

  window.MOBBR.ui.tournament = window.MOBBR.ui.tournament || {};
  Object.assign(window.MOBBR.ui.tournament, {
    open: ()=>MOD.open(),
    close: ()=>MOD.close(),
    render: ()=>MOD.render()
  });

})();
