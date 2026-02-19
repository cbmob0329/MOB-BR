'use strict';

/* =========================================================
   ui_tournament.js（v3.6.8 split-3 entry）
   - public API（open/close/render）
   - onNext / bind events
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

    }catch(e){
      console.error('[ui_tournament] request handler error:', e);
      MOD._setBusy(false);
      setChampionMode(false);
      setResultStampMode(false);
      if (MOD._getEncounterGatePhase() === 0) setBattleMode(false);
      syncSessionBar();
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
