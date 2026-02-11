'use strict';

/*
  MOB BR - sim_match_flow.js v1
  試合最新版.txt 準拠
  - R1〜R6進行
  - イベント→交戦→移動
  - R6決勝
  - eliminated完全除外
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.sim = window.MOBBR.sim || {};

(function(){

  const Flow = {};

  let state = null;

  function init(matchTeams){
    state = {
      round: 1,
      teams: matchTeams.map(t => ({
        ...t,
        eliminated: false,
        downs_total: 0
      })),
      finished: false
    };
  }

  function getAliveTeams(){
    return state.teams.filter(t => !t.eliminated);
  }

  function log(main, sub=''){
    if(window.MOBBR?.ui?.match?.log){
      window.MOBBR.ui.match.log(main, sub);
    }
  }

  function next(){

    if(state.finished) return;

    if(state.round <= 5){
      runNormalRound();
    }else if(state.round === 6){
      runFinalRound();
    }
  }

  function runNormalRound(){

    const r = state.round;

    log(`R${r} 開始`, `残り ${getAliveTeams().length} チーム`);

    // イベント
    const eventCount = (r === 1) ? 1 : 2;

    for(let i=0;i<eventCount;i++){
      if(window.MOBBR.sim?.matchEvents){
        window.MOBBR.sim.matchEvents.run(state);
      }
    }

    // 交戦
    if(window.MOBBR.sim?.matchBattle){
      window.MOBBR.sim.matchBattle.run(state);
    }

    // 移動演出
    if(window.MOBBR?.ui?.match?.showMove){
      window.MOBBR.ui.match.showMove();
    }

    state.round++;
  }

  function runFinalRound(){

    log(`R6 最終局面`, `決勝交戦`);

    if(window.MOBBR?.ui?.match?.showFinalArea){
      window.MOBBR.ui.match.showFinalArea();
    }

    if(window.MOBBR.sim?.matchBattle){
      window.MOBBR.sim.matchBattle.runFinal(state);
    }

    const alive = getAliveTeams();

    if(alive.length === 1){
      log(`優勝`, `${alive[0].name} がチャンピオン！`);
    }else{
      log(`試合終了`, `複数生存（想定外）`);
    }

    state.finished = true;
  }

  Flow.start = function(matchTeams){
    init(matchTeams);

    if(window.MOBBR?.ui?.match?.open){
      window.MOBBR.ui.match.open();
    }

    next();
  };

  Flow.next = function(){
    next();
  };

  Flow.getState = function(){
    return state;
  };

  window.MOBBR.sim.matchFlow = Flow;

})();
