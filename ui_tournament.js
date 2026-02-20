'use strict';

/* =========================================================
   ui_tournament.js（v3.6.9 split-3 entry）
   - public API（open/close/render）
   - onNext / bind events

   ✅ v3.6.9 修正（表示崩れ対策）
   1) 左上バナー：MATCH を必ず2段目に（見切れ/ellipsis 根絶）
   2) 右上バナー：ROUND の数字を必ず2段目に
   3) メンバー名：IGL / AT / SUP を3段で表示できるよう
      .char .name の white-space を pre-line に強制（改行が潰れない）
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

  // ==========================================
  // ✅ banner / name 表示を “確実に” 直す後処理
  // ==========================================
  function getOverlayEl(){
    return document.getElementById('mobbrTournamentOverlay');
  }

  function normalizeBannerTextTo2Lines(raw, mode){
    // mode: 'left' | 'right'
    const s0 = String(raw || '').trim();
    if (!s0) return '';

    // 既に <br> が入っているならそのまま
    if (s0.includes('<br>')) return s0;

    if (mode === 'left'){
      // 例: "NATIONAL AB (1/6) MATCH 1/5"
      // MATCH を2行目へ
      const idx = s0.indexOf('MATCH');
      if (idx > 0){
        const a = s0.slice(0, idx).trim();
        const b = s0.slice(idx).trim();
        return `${escapeHtml(a)}<br>${escapeHtml(b)}`;
      }
      // WORLD/LOCAL 等で "MATCH" がない場合は折り返しなし
      return escapeHtml(s0);
    }

    if (mode === 'right'){
      // 例: "ROUND 1" → "ROUND<br>1"
      // 例: "ROUND 10" → "ROUND<br>10"
      const m = s0.match(/^(ROUND)\s*(\d+.*)$/i);
      if (m){
        return `${escapeHtml(m[1].toUpperCase())}<br>${escapeHtml(m[2])}`;
      }

      // "降下" 等のときはそのまま（1行でOK）
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

    // innerHTML を使って <br> を効かせる
    try{ leftEl.innerHTML  = leftHtml; }catch(_){ leftEl.textContent = String(st.bannerLeft||''); }
    try{ rightEl.innerHTML = rightHtml; }catch(_){ rightEl.textContent = String(st.bannerRight||''); }
  }

  function applyNameBoxFix(){
    const overlay = getOverlayEl();
    if (!overlay) return;

    // .char .name に改行が入っている前提で、改行が潰れないようにする
    // CSSを触れなくても “表示だけ” はここで保証できる
    const names = overlay.querySelectorAll('.chars .char .name');
    for (const el of names){
      try{
        el.style.whiteSpace = 'pre-line';  // \n を行として扱う
        el.style.wordBreak  = 'keep-all';
      }catch(_){}
    }
  }

  function postRenderFixups(){
    // 毎回呼んでOK（軽い）
    applyBannerFix();
    applyNameBoxFix();
  }

  // ===== bind buttons once =====
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
    // open直後にも一応当てる
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

      // showBattle は encounterGate 中は握る
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
        // ✅ ここでもバナー/名前補正
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

      // ===== dispatch to handlers =====
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

      // ✅ handlers が描画した “後” に、確実に補正を当てる
      postRenderFixups();

    }catch(e){
      console.error('[ui_tournament] request handler error:', e);
      MOD._setBusy(false);
      setChampionMode(false);
      setResultStampMode(false);
      if (MOD._getEncounterGatePhase() === 0) setBattleMode(false);
      syncSessionBar();
      // ✅ 失敗時でもバナー/名前補正だけは当てる
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

  // handlers側から呼ばれる可能性があるので、entryで上書き
  MOD.render = render;
  MOD.close = close;

  // public API
  window.MOBBR.ui.tournament = { open, close, render };
  window.MOBBR.initTournamentUI = function(){ bindOnce(); };

})();
