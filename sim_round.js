/* =========================================================
   MOB BR - sim_round.js (FULL)
   - 1試合を Round1〜Round6 で進行させる司令塔
   - NEXT1回＝内部ステップ1つ進行
   ---------------------------------------------------------
   依存：
   - sim-map.js   : SimMap
   - sim_event.js : SimEvent（未実装でもOK）
   - sim_battle.js: SimBattle（未実装でもOK）
========================================================= */

(function(){
  'use strict';

  const SimRound = {};
  window.SimRound = SimRound;

  /* =========================
     定数
  ========================== */
  const MAX_ROUND = 6;

  // ラウンドごとの仕様
  const ROUND_RULES = {
    1:{ events:1, battles:4, move:true },
    2:{ events:2, battles:4, move:true },
    3:{ events:2, battles:4, move:true },
    4:{ events:2, battles:4, move:true },
    5:{ events:2, battles:2, move:true },
    6:{ events:0, battles:1, move:false } // FINAL
  };

  /* =========================
     Match State 生成
  ========================== */
  SimRound.createMatchState = function(teams, opts){
    opts = opts || {};
    return {
      matchId: opts.matchId || Date.now(),
      round: 1,
      step: 'INIT',               // 内部ステップ
      teams: teams || [],
      playerTeamId: opts.playerTeamId || 'player',
      lastOverlappedAreas: [],
      matchLogQueue: [],
      finished: false
    };
  };

  /* =========================
     試合開始（R1準備）
  ========================== */
  SimRound.startMatch = function(state){
    if(!state) return null;

    // R1 降下
    if(window.SimMap && SimMap.deployR1){
      const info = SimMap.deployR1(state.teams);
      state.lastOverlappedAreas = info?.overlappedAreas || [];
    }

    state.step = 'ROUND_START';

    return {
      state,
      out:{
        kind:'LOG',
        payload:{
          title:`Round 1 開始！`,
          lines:[
            '各チームが降下を開始',
            '初動の戦いが始まる…'
          ]
        }
      }
    };
  };

  /* =========================
     NEXT で進める
  ========================== */
  SimRound.next = function(state){
    if(!state || state.finished){
      return { state, out:{ kind:'MATCH_END' } };
    }

    const r = state.round;
    const rule = ROUND_RULES[r];

    /* ---------- ROUND START ---------- */
    if(state.step === 'ROUND_START'){
      state.step = 'EVENT';
      return {
        state,
        out:{
          kind:'LOG',
          payload:{
            title:`Round ${r}`,
            lines:[`Round ${r} が開始された`]
          }
        }
      };
    }

    /* ---------- EVENT ---------- */
    if(state.step === 'EVENT'){
      state.step = 'BATTLE';

      let events = [];
      if(window.SimEvent && SimEvent.applyRoundEvents){
        events = SimEvent.applyRoundEvents(state, r) || [];
      }

      return {
        state,
        out:{
          kind:'LOG',
          payload:{
            title:`イベント発生`,
            events
          }
        }
      };
    }

    /* ---------- BATTLE ---------- */
    if(state.step === 'BATTLE'){
      state.step = 'ROUND_END';

      let summary = {};
      if(window.SimBattle && SimBattle.runBattlesForRound){
        summary = SimBattle.runBattlesForRound(state, r) || {};
      }

      return {
        state,
        out:{
          kind:'BATTLE',
          payload: summary
        }
      };
    }

    /* ---------- ROUND END ---------- */
    if(state.step === 'ROUND_END'){
      if(r === MAX_ROUND){
        state.step = 'MATCH_END';
      }else{
        state.step = rule.move ? 'MOVE' : 'ROUND_START';
      }

      return {
        state,
        out:{
          kind:'ROUND_END',
          payload:{
            round:r
          }
        }
      };
    }

    /* ---------- MOVE ---------- */
    if(state.step === 'MOVE'){
      if(window.SimMap && SimMap.moveAllAliveTo){
        // 次エリア候補（簡易：全エリアからランダム）
        const targets = [];
        for(let i=1;i<=25;i++) targets.push(i);
        SimMap.moveAllAliveTo(state.teams, targets);
      }

      state.round++;
      state.step = 'ROUND_START';

      return {
        state,
        out:{
          kind:'MOVE',
          payload:{
            round:state.round
          }
        }
      };
    }

    /* ---------- MATCH END ---------- */
    if(state.step === 'MATCH_END'){
      state.finished = true;
      return {
        state,
        out:{
          kind:'MATCH_END',
          payload:{
            message:'試合終了'
          }
        }
      };
    }

    return { state, out:{ kind:'LOG' } };
  };

})();
