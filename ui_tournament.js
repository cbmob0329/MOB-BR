'use strict';

/* =========================================================
   ui_tournament.js（v3.6.10 split-3 entry） + SkipMatch UI hook（FULL）
   - public API（open/close/render）
   - onNext / bind events
   - ✅ SKIPボタン: confirm→ flow.step() → render() を確実に回す
   - ✅ UI lock / rendering / busy を尊重しつつ、止まらない実装
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

  // ===== SKIP visibility =====
  // 「イベントはnextを押したらすぐスキップしたい」用途を想定：
  // - showEvent / showEncounter / showMove / showBattle / showRoundStart / prepareBattles など、
  //   テンポを上げたい場面で常時出してもOK
  function shouldShowSkip(req){
    const t = String(req?.type || '');
    if (!t) return false;

    // 結果画面はスキップ不要（誤操作防止）
    if (t === 'showMatchResult' || t === 'showTournamentResult' || t === 'endTournament') return false;
    if (t === 'endNationalWeek') return false;

    // それ以外は基本表示
    return true;
  }

  function updateSkipButtonState(){
    const dom = MOD._getDom ? MOD._getDom() : null;
    if (!dom || !dom.skipBtn) return;

    const st = getState();
    const req = st?.request || null;

    const on = shouldShowSkip(req);
    dom.skipBtn.style.display = on ? '' : 'none';

    // NEXTが押せない状態でも、SKIPは「今の演出を飛ばす」目的なので
    // lock/busy/rendering の時だけ無効化（事故防止）
    const disabled = !!(MOD._getBusy && MOD._getBusy()) || !!(MOD._getRendering && MOD._getRendering()) || !!(MOD.isLocked && MOD.isLocked());
    dom.skipBtn.disabled = disabled;
    dom.skipBtn.classList.toggle('isDisabled', disabled);
  }

  function bindOnce(){
    const dom = ensureDom();

    if (!dom._bound){
      dom._bound = true;

      dom.nextBtn.addEventListener('click', onNext);
      dom.closeBtn.addEventListener('click', close);

      // ✅ 追加: SKIPボタン bind
      if (dom.skipBtn){
        dom.skipBtn.addEventListener('click', onSkip);
      }
    }
  }

  function open(){
    bindOnce();
    openCore();
    postRenderFixups();
    updateSkipButtonState();
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
        updateSkipButtonState();
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
      updateSkipButtonState();

    }catch(e){
      console.error('[ui_tournament] request handler error:', e);
      MOD._setBusy(false);
      setChampionMode(false);
      setResultStampMode(false);
      if (MOD._getEncounterGatePhase() === 0) setBattleMode(false);
      syncSessionBar();
      postRenderFixups();
      updateSkipButtonState();
    }finally{
      MOD._setRendering(false);
      unlockUI();
      setNextEnabled(true);
      updateSkipButtonState();
    }
  }

  function onNext(){
    const res = onNextCore();
    if (res && res.shouldRender){
      render();
    }
  }

  // ✅ 追加: SKIP（confirm→step→render）
  function onSkip(){
    const dom = MOD._getDom ? MOD._getDom() : null;
    if (dom?.skipBtn && dom.skipBtn.disabled) return;

    // iOS Safari でも確実に出る同期 confirm
    const ok = window.confirm('本当にスキップしますか？');
    if (!ok) return;

    // 安全ガード（render中/ロック中/ビジー中は事故るので何もしない）
    if (MOD.isLocked && MOD.isLocked()) return;
    if (MOD._getRendering && MOD._getRendering()) return;
    if (MOD._getBusy && MOD._getBusy()) return;

    const flow = MOD.getFlow ? MOD.getFlow() : (window.MOBBR?.sim?.tournamentFlow || window.MOBBR?.tournamentFlow || null);
    if (!flow || typeof flow.step !== 'function') return;

    try{
      // ここが重要：hold / gate で詰まるパターンを潰す
      // - HOLD中なら解除して次reqを取り直す
      if (MOD._getHoldScreenType && MOD._getHoldScreenType()){
        MOD._setHoldScreenType(null);
        MOD._setPendingReqAfterHold(null);
        MOD._setLastReqKey('');
      }

      // - 接敵ゲート中で showBattle 保留してるならゲート解除して強制進行
      if (MOD._getEncounterGatePhase && MOD._getEncounterGatePhase() > 0){
        // 「敵表示で止めたい」仕様があっても、SKIPはそれを飛ばすために解除
        resetEncounterGate();
        MOD._setLastReqKey('');
      }

      // step→render
      flow.step();
      render();

    }catch(e){
      console.error('[ui_tournament] skip error:', e);
    }
  }

  // handlers側からも呼べるように公開（任意）
  MOD.requestSkip = function(){
    onSkip();
  };

  MOD.render = render;
  MOD.close = close;

  window.MOBBR.ui.tournament = { open, close, render };
  window.MOBBR.initTournamentUI = function(){ bindOnce(); };

})();
