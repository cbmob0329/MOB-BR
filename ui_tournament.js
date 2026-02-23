'use strict';

/* =========================================================
   ui_tournament.js（v3.6.13 split-3 entry）FULL
   - WORLD FINAL 表記補正
   - MATCH総数自動補正
   - NEXT停止事故 安定化
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

  function escapeHtml(str){
    return String(str)
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'","&#039;");
  }

  /* =========================================================
     MATCH総数推定
  ========================================================= */
  function getMatchTotal(st){
    if (!st) return 5;

    const candidates = [
      st.totalMatches,
      st.matchTotal,
      st.matchesTotal,
      st.ui?.totalMatches
    ];

    for (const v of candidates){
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) return n;
    }

    if (st.mode === 'world') return 12;
    return 5;
  }

  function patchMatchDenominator(text, total){
    const s = String(text||'');
    if (!s) return s;
    return s.replace(/(MATCH\s*\d+\s*\/\s*)(\d+)/i,(m,p1)=>`${p1}${total}`);
  }

  /* =========================================================
     WORLD FINAL AB除去強化
  ========================================================= */
  function stripWorldFinalNoise(text){
    let s = String(text||'');

    // AB (1/6) / A&B (1/6) / AB(1/6)
    s = s.replace(/\bA\s*&?\s*B\s*\(\s*\d+\s*\/\s*\d+\s*\)/ig,'');
    s = s.replace(/\bAB\s*\(\s*\d+\s*\/\s*\d+\s*\)/ig,'');

    return s.replace(/\s+/g,' ').trim();
  }

  function normalizeBanner(raw,mode){
    const s0 = String(raw||'').trim();
    if (!s0) return '';
    if (s0.includes('<br>')) return s0;

    if (mode==='left'){
      const idx=s0.indexOf('MATCH');
      if(idx>0){
        const a=s0.slice(0,idx).trim();
        const b=s0.slice(idx).trim();
        return `${escapeHtml(a)}<br>${escapeHtml(b)}`;
      }
    }
    return escapeHtml(s0);
  }

  function applyBannerFix(){
    const st=getState();
    const overlay=getOverlayEl();
    if(!overlay||!st)return;

    const leftEl=overlay.querySelector('.banner .left');
    const rightEl=overlay.querySelector('.banner .right');
    if(!leftEl||!rightEl)return;

    let left=String(st.bannerLeft||'');
    let right=String(st.bannerRight||'');

    if(st.mode==='world'){
      left=stripWorldFinalNoise(left);
      right=stripWorldFinalNoise(right);

      const total=getMatchTotal(st);
      left=patchMatchDenominator(left,total);
    }

    leftEl.innerHTML=normalizeBanner(left,'left');
    rightEl.innerHTML=normalizeBanner(right,'right');
  }

  function applyNameBoxFix(){
    const overlay=getOverlayEl();
    if(!overlay)return;

    const names=overlay.querySelectorAll('.chars .char .name');
    names.forEach(el=>{
      el.style.whiteSpace='pre-line';
      el.style.wordBreak='keep-all';
    });
  }

  function postRenderFixups(){
    applyBannerFix();
    applyNameBoxFix();
  }

  function bindOnce(){
    const dom=ensureDom();
    if(!dom._bound){
      dom._bound=true;
      dom.nextBtn.addEventListener('click',onNext);
      dom.closeBtn.addEventListener('click',close);
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

    if(MOD._getRendering())return;
    MOD._setRendering(true);
    lockUI();

    try{
      const st=getState();
      const req=st?.request||null;

      syncSessionBar();

      const hold=MOD._getHoldScreenType();
      if(hold&&req&&req.type!==hold){
        MOD._setPendingReqAfterHold(req);
        return;
      }

      const key=mkReqKey(req);
      if(key===MOD._getLastReqKey())return;
      MOD._setLastReqKey(key);

      MOD.clearAutoTimer();
      MOD.clearLocalNext();

      if(!req||!req.type){
        setBattleMode(false);
        setChampionMode(false);
        setResultStampMode(false);
        syncSessionBar();
        postRenderFixups();
        return;
      }

      switch(req.type){
        case 'showMatchResult': await MOD.handleShowMatchResult(req); break;
        case 'showTournamentResult': await MOD.handleShowTournamentResult(req); break;
        case 'showBattle': await MOD.handleShowBattle(req); break;
        case 'showEncounter': await MOD.handleShowEncounter(req); break;
        default:
          if(MOD[`handle${req.type.charAt(0).toUpperCase()+req.type.slice(1)}`]){
            await MOD[`handle${req.type.charAt(0).toUpperCase()+req.type.slice(1)}`](req);
          }
      }

      syncSessionBar();
      postRenderFixups();

    }catch(e){
      console.error('[ui_tournament] error:',e);
    }finally{
      MOD._setRendering(false);
      unlockUI();
      setNextEnabled(true);
    }
  }

  /* =========================================================
     NEXT安定化（事故防止版）
  ========================================================= */
  function onNext(){
    const flow=getFlow();
    const stBefore=getState();
    const holdBefore=MOD._getHoldScreenType();

    const res=onNextCore();

    if(res&&res.shouldRender){
      render();
      return;
    }

    const stAfter=getState();
    const holdAfter=MOD._getHoldScreenType();

    // hold解除直後は強制再描画
    if(holdBefore&&!holdAfter){
      MOD._setLastReqKey('');
      render();
      return;
    }

    // requestが無くなった時だけ step
    if(flow && stAfter && !stAfter.request){
      flow.step();
      render();
    }
  }

  MOD.render=render;
  MOD.close=close;

  window.MOBBR.ui.tournament={open,close,render};
  window.MOBBR.initTournamentUI=function(){bindOnce();};

})();
