'use strict';

/* =========================================================
   ui_tournament.js（v3.6.11 split-3 entry）FULL（SKIP廃止版）
   - public API（open/close/render）
   - onNext / bind events
   - ✅変更:
     - SKIPボタン/confirm/step/render の仕組みを完全廃止
     - それ以外（hold/gate/busy/renderingガード・banner/name fix・request分岐）は維持
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
    hidePanels,
    hideSplash,
    showCenterStamp,

    resetEncounterGate,

    openCore,
    closeCore
  } = MOD;

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

  function escapeHtml(str){
    return String(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
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

  function bindOnce(){
    const dom = ensureDom();

    if (!dom._bound){
      dom._bound = true;

      dom.nextBtn.addEventListener('click', onNext);
      dom.closeBtn.addEventListener('click', close);

      // ✅ SKIPは廃止：何もbindしない
    }
  }

  function open(){
    bindOnce();
    openCore();
    postRenderFixups();
  }

  function close(){
    closeCore();
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

      syncSessionBar();

      const holdScreenType = MOD._getHoldScreenType();
      if (holdScreenType){
        if (req && req.type && req.type !== holdScreenType){
          MOD._setPendingReqAfterHold(req);
          return;
        }
      }

      if (req?.type === 'showBattle' && MOD._getEncounterGatePhase() > 0){
        MOD._setPendingBattleReq(req);
        showCenterStamp('');
        return;
      }

      const key = mkReqKey(req);
      if (key === MOD._getLastReqKey()) return;
      MOD._setLastReqKey(key);

      MOD.clearAutoTimer();
      MOD.clearLocalNext();

      if (req?.type !== 'showBattle'){
        setResultStampMode(false);
        showCenterStamp('');
      }

      if (!req || !req.type){
        if (MOD._getEncounterGatePhase() === 0) setBattleMode(false);
        setChampionMode(false);
        setResultStampMode(false);
        syncSessionBar();
        postRenderFixups();
        return;
      }

      if (req.type === 'showEncounter'){
        setBattleMode(false);
        hidePanels();
        showCenterStamp('');
        hideSplash();
        setChampionMode(false);
        setResultStampMode(false);
      }else{
        const isBattleReq = (req.type === 'showBattle');
        if (MOD._getEncounterGatePhase() === 0) setBattleMode(isBattleReq);
        if (req.type !== 'showChampion') setChampionMode(false);
        if (req.type !== 'showBattle') setResultStampMode(false);
      }

      switch(req.type){
        case 'showArrival': await MOD.handleShowArrival(req); break;

        case 'showIntroText': await MOD.handleShowIntroText(); break;
        case 'showTeamList': await MOD.handleShowTeamList(req); break;
        case 'showCoachSelect': await MOD.handleShowCoachSelect(req); break;

        case 'showDropStart': await MOD.handleShowDropStart(req); break;
        case 'showDropLanded': await MOD.handleShowDropLanded(req); break;

        case 'showRoundStart': await MOD.handleShowRoundStart(req); break;
        case 'showEvent': await MOD.handleShowEvent(req); break;

        case 'prepareBattles': await MOD.handlePrepareBattles(req); break;

        case 'showEncounter': await MOD.handleShowEncounter(req); break;
        case 'showBattle': await MOD.handleShowBattle(req); break;

        case 'showMove': await MOD.handleShowMove(req); break;
        case 'showChampion': await MOD.handleShowChampion(req); break;

        case 'showMatchResult': await MOD.handleShowMatchResult(req); break;
        case 'showTournamentResult': await MOD.handleShowTournamentResult(req); break;

        case 'showNationalNotice': await MOD.handleShowNationalNotice(req); break;

        case 'showAutoSession': await MOD.handleShowAutoSession(req); break;
        case 'showAutoSessionDone': await MOD.handleShowAutoSessionDone(req); break;

        case 'endTournament': await MOD.handleEndTournament(req); break;
        case 'endNationalWeek': await MOD.handleEndNationalWeek(req); break;

        case 'nextMatch': await MOD.handleNextMatch(req); break;

        case 'noop':
        default:
          break;
      }

      syncSessionBar();
      postRenderFixups();

    }catch(e){
      console.error('[ui_tournament] request handler error:', e);
      MOD._setBusy(false);
      setChampionMode(false);
      setResultStampMode(false);
      if (MOD._getEncounterGatePhase() === 0) setBattleMode(false);
      syncSessionBar();
      postRenderFixups();
    }finally{
      MOD._setRendering(false);
      unlockUI();
      setNextEnabled(true);
    }
  }

  function onNext(){
    const res = onNextCore();
    if (res && res.shouldRender){
      render();
    }
  }

  MOD.render = render;
  MOD.close = close;

  window.MOBBR.ui.tournament = { open, close, render };
  window.MOBBR.initTournamentUI = function(){ bindOnce(); };

})();
