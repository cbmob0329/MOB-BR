'use strict';

/*
  MOB BR - tournament_flow.js v1（FULL）
  役割：
  - 大会の「状態遷移（NEXTでどう進むか）」のみを管理する純粋エンジン
  - UI / 画像 / 戦闘 / 順位計算は一切しない（hooks に完全委譲）
  - B案：runtime から start / next を呼ばれる前提
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.tournament = window.MOBBR.tournament || {};

(function(){

  /* =========================
     STATE 定義（固定）
  ========================= */
  const STATE = Object.freeze({
    IDLE: 'IDLE',

    WEEK_START_BANNER: 'WEEK_START_BANNER',
    ENTER_CONFIRM: 'ENTER_CONFIRM',
    ENTER_TRANSITION: 'ENTER_TRANSITION',
    VENUE_ANNOUNCE: 'VENUE_ANNOUNCE',

    MATCHDAY_START: 'MATCHDAY_START',
    MATCHDAY_RUN: 'MATCHDAY_RUN',
    MATCHDAY_RESULT: 'MATCHDAY_RESULT',
    OVERALL_UPDATE: 'OVERALL_UPDATE',

    PHASE_END_UI: 'PHASE_END_UI',
    RETURN_TO_MAIN: 'RETURN_TO_MAIN',
    TOURNAMENT_END: 'TOURNAMENT_END'
  });

  /* =========================
     util
  ========================= */
  const isFn = (v)=>typeof v === 'function';
  const clone = (o)=>JSON.parse(JSON.stringify(o||{}));

  /* =========================
     PLAN 定義
     ※「構造」だけ。中身の意味は hooks 側が解釈する
  ========================= */
  function makeMatchDays5(lobbies){
    const arr=[];
    for(let i=1;i<=5;i++){
      arr.push({
        index:i,
        total:5,
        lobbies:lobbies.map(k=>({lobbyKey:k}))
      });
    }
    return arr;
  }

  const PLAN = {
    LOCAL: [
      {
        phaseId:'local_main',
        title:'ローカル大会',
        announceKey:'LOCAL_OPEN',
        matchDays: makeMatchDays5(['LOCAL']),
        endKey:'LOCAL_END',
        returnToMainAfterPhase:false
      }
    ]
  };

  /* =========================
     default hooks
  ========================= */
  function defaultHooks(){
    return {
      onWeekStartBanner:null,
      onEnterConfirm:null,
      onEnterTransition:null,
      onVenueAnnounce:null,
      onMatchDayStart:null,
      onRunMatchDay:null,
      onShowMatchDayResult:null,
      onShowOverall:null,
      onPhaseEndUI:null,
      onReturnToMain:null,
      onTournamentEnd:null,
      onStateChange:null
    };
  }

  /* =========================
     Flow Engine
  ========================= */
  function createFlow(opts){
    const tournamentType = String(opts?.tournamentType||'').toUpperCase();
    const hooks = Object.assign(defaultHooks(), opts?.hooks||{});
    const plan = PLAN[tournamentType];

    if(!plan) throw new Error('Unknown tournamentType: '+tournamentType);

    const ctx = {
      tournamentType,
      state: STATE.IDLE,
      phaseIndex:0,
      matchDayIndex:0,
      currentPhase:null,
      currentMatchDay:null,
      lastResults:null,
      overall:null
    };

    function emit(prev,next){
      if(isFn(hooks.onStateChange)){
        hooks.onStateChange({prev,next,ctx:clone(ctx)});
      }
    }

    function setState(next){
      const prev = ctx.state;
      ctx.state = next;
      emit(prev,next);
    }

    function getPhase(){ return plan[ctx.phaseIndex]||null; }
    function getMatchDay(p){ return p?.matchDays?.[ctx.matchDayIndex]||null; }

    /* ===== 開始 ===== */
    function startWeekBanner(){
      ctx.phaseIndex=0;
      ctx.matchDayIndex=0;
      ctx.currentPhase=null;
      ctx.currentMatchDay=null;
      ctx.lastResults=null;
      ctx.overall=null;

      setState(STATE.WEEK_START_BANNER);
      hooks.onWeekStartBanner?.({tournamentType});
    }

    function openEnterConfirm(){
      setState(STATE.ENTER_CONFIRM);
      hooks.onEnterConfirm?.({tournamentType});
    }

    function chooseEnter(yes){
      if(ctx.state!==STATE.ENTER_CONFIRM) return;
      if(!yes){
        setState(STATE.IDLE);
        return;
      }

      ctx.currentPhase = getPhase();
      setState(STATE.ENTER_TRANSITION);
      hooks.onEnterTransition?.({
        tournamentType,
        phase:clone(ctx.currentPhase)
      });

      setState(STATE.VENUE_ANNOUNCE);
      hooks.onVenueAnnounce?.({
        tournamentType,
        phase:clone(ctx.currentPhase),
        announceKey:ctx.currentPhase.announceKey
      });
    }

    /* ===== NEXT ===== */
    async function next(){
      switch(ctx.state){

        case STATE.VENUE_ANNOUNCE:{
          ctx.matchDayIndex=0;
          ctx.currentMatchDay = getMatchDay(ctx.currentPhase);
          setState(STATE.MATCHDAY_START);
          hooks.onMatchDayStart?.({
            tournamentType,
            phase:clone(ctx.currentPhase),
            matchDay:clone(ctx.currentMatchDay)
          });
          return;
        }

        case STATE.MATCHDAY_START:{
          setState(STATE.MATCHDAY_RUN);
          return runMatchDay();
        }

        case STATE.MATCHDAY_RESULT:{
          setState(STATE.OVERALL_UPDATE);
          hooks.onShowOverall?.({
            tournamentType,
            phase:clone(ctx.currentPhase),
            matchDay:clone(ctx.currentMatchDay),
            overall:ctx.overall,
            progressText:`(${ctx.currentMatchDay.index}/5)`
          });
          return;
        }

        case STATE.OVERALL_UPDATE:{
          if(ctx.matchDayIndex+1 < ctx.currentPhase.matchDays.length){
            ctx.matchDayIndex++;
            ctx.currentMatchDay = getMatchDay(ctx.currentPhase);
            setState(STATE.MATCHDAY_START);
            hooks.onMatchDayStart?.({
              tournamentType,
              phase:clone(ctx.currentPhase),
              matchDay:clone(ctx.currentMatchDay)
            });
          }else{
            setState(STATE.PHASE_END_UI);
            hooks.onPhaseEndUI?.({
              tournamentType,
              phase:clone(ctx.currentPhase),
              endKey:ctx.currentPhase.endKey,
              overall:ctx.overall
            });
          }
          return;
        }

        case STATE.PHASE_END_UI:{
          setState(STATE.TOURNAMENT_END);
          hooks.onTournamentEnd?.({
            tournamentType,
            overall:ctx.overall
          });
          return;
        }

        default:
          return;
      }
    }

    async function runMatchDay(){
      const out = await hooks.onRunMatchDay?.({
        tournamentType,
        phase:clone(ctx.currentPhase),
        matchDay:clone(ctx.currentMatchDay)
      }) || {};

      ctx.lastResults = out.resultsByLobbyKey||{};
      ctx.overall = out.updatedOverall||ctx.overall;

      setState(STATE.MATCHDAY_RESULT);
      hooks.onShowMatchDayResult?.({
        tournamentType,
        phase:clone(ctx.currentPhase),
        matchDay:clone(ctx.currentMatchDay),
        resultsByLobbyKey:clone(ctx.lastResults)
      });
    }

    return {
      STATE,
      getState:()=>ctx.state,
      startWeekBanner,
      openEnterConfirm,
      chooseEnter,
      next
    };
  }

  /* =========================
     export
  ========================= */
  window.MOBBR.tournament.flow = {
    VERSION:'v1',
    STATE,
    PLAN: clone(PLAN),
    createFlow
  };

})();
