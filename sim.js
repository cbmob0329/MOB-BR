/* =========================================================
   MOB BR - sim.js (FULL / SPEC COMPLETE)
   試合の流れ.txt 完全準拠
   ---------------------------------------------------------
   ・R1〜R6 進行順固定
   ・交戦枠 必ず成立
   ・敵選び 優先順位固定
   ・プレイヤー戦確率 ラウンド別固定
   ・全滅後の高速処理
   ・紙芝居ログの順序保証
========================================================= */

(function(){
  'use strict';

  const Sim = {};
  window.Sim = Sim;

  /* =========================
     INTERNAL STATE
  ========================== */
  let teams = [];
  let round = 0;
  let stepQueue = [];
  let auto = false;
  let fast = false;
  let busy = false;

  /* =========================
     CONFIG（試合の流れ.txt）
  ========================== */
  const ROUND_FIGHTS = { 1:4, 2:4, 3:4, 4:4, 5:2, 6:1 };
  const PLAYER_FIGHT_RATE = { 1:100, 2:70, 3:75, 4:80, 5:85, 6:100 };

  /* =========================
     PUBLIC API
  ========================== */
  Sim.startMatch = function(opts){
    if(busy) return;
    busy = true;

    teams = clone(opts.teams || []);
    round = 1;
    stepQueue = [];
    auto = false;
    fast = false;

    initTeams();

    // R1 降下
    SimMap.deployR1(teams);
    push('バトルスタート！', RULES.MAP.screens.main1);
    push('降下開始…！', RULES.MAP.screens.map);

    busy = false;
    tick();
  };

  Sim.next = function(){ tick(); };
  Sim.setAuto = function(on){ auto = !!on; if(auto) tick(); };

  /* =========================
     MAIN LOOP
  ========================== */
  function tick(){
    if(busy) return;

    if(stepQueue.length){
      UI.showStep(stepQueue.shift());
      if(auto) setTimeout(tick, RULES.GAME.autoMs || 2500);
      return;
    }

    if(round <= 6){
      runRound(round);
      return;
    }

    finalize();
  }

  /* =========================
     ROUND FLOW
  ========================== */
  function runRound(r){
    busy = true;

    // Round開始
    push(`Round ${r} 開始！`, RULES.MAP.screens.main1);

    // リスポーン
    respawnPhase(r);

    // イベント
    SimEvents.applyRoundEvents({
      round: r,
      teams,
      isFastMode: fast,
      isPlayerTeamFn,
      pushStepsFn: pushSteps
    });

    // 交戦（枠数保証）
    battlePhase(r);

    // 移動（R6以外）
    if(r < 6){
      SimMap.moveAllAliveTo(teams, RULES.MAP.roundAreas[`R${r+1}`]);
      if(!fast){
        push('次のエリアへ移動…', RULES.MAP.screens.ido);
      }
    }

    round++;
    busy = false;
    tick();
  }

  /* =========================
     PHASES
  ========================== */
  function respawnPhase(r){
    for(const t of teams){
      if(t.eliminated) continue;

      if(r === 6){
        if(t.deathBoxes >= 1){
          t.alive = 3;
          t.deathBoxes = 0;
          if(isPlayerTeamFn(t) && !fast){
            push('最終前に全員復帰！', RULES.MAP.screens.main1);
          }
        }
      }else{
        if(t.deathBoxes === 1){
          t.alive += 1;
          t.deathBoxes = 0;
        }else if(t.deathBoxes >= 2){
          t.alive += (Math.random() < 0.7 ? 2 : 1);
          t.deathBoxes = 0;
        }
        t.alive = Math.min(t.alive, 3);
      }
    }
  }

  function battlePhase(r){
    const fights = ROUND_FIGHTS[r];
    for(let i=0;i<fights;i++){
      const pair = pickBattlePair(r);
      if(!pair) break;

      const res = SimBattle.resolveBattle({
        teamA: pair[0],
        teamB: pair[1],
        round: r,
        isFastMode: fast,
        isPlayerTeamFn,
        pushStepsFn: pushSteps,
        getBattleBgFn: ()=>RULES.MAP.screens.battle
      });

      if(res?.loser?.eliminated && res.loser.place == null){
        res.loser.place = calcPlace();
        if(isPlayerTeamFn(res.loser)) fast = true;
      }
    }
  }

  /* =========================
     FINALIZE
  ========================== */
  function finalize(){
    const out = SimResult.finalizeTournament(teams);
    UI.showResult(out);
  }

  /* =========================
     MATCH MAKING
  ========================== */
  function pickBattlePair(r){
    const alive = teams.filter(t=>!t.eliminated);
    if(alive.length < 2) return null;

    const rate = PLAYER_FIGHT_RATE[r];
    const player = alive.find(isPlayerTeamFn);

    // プレイヤー戦優先
    if(player && Math.random()*100 < rate){
      const sameArea = alive.filter(t=>t!==player && t.areaId===player.areaId);
      if(sameArea.length) return [player, pick(sameArea)];

      const near = alive.filter(t=>t!==player && Math.abs(t.areaId-player.areaId)<=1);
      if(near.length) return [player, pick(near)];

      const any = alive.filter(t=>t!==player);
      if(any.length) return [player, pick(any)];
    }

    // CPU同士
    shuffle(alive);
    for(let i=0;i<alive.length;i++){
      for(let j=i+1;j<alive.length;j++){
        if(alive[i].areaId === alive[j].areaId){
          return [alive[i], alive[j]];
        }
      }
    }

    return [alive[0], alive[1]];
  }

  /* =========================
     HELPERS
  ========================== */
  function initTeams(){
    for(const t of teams){
      t.place = null;
      t.eliminated = false;
      t.alive = t.alive ?? 3;
      t.deathBoxes = t.deathBoxes ?? 0;
    }
  }

  function isPlayerTeamFn(t){ return !!t.isPlayer; }

  function calcPlace(){
    return teams.filter(t=>!t.eliminated).length + 1;
  }

  function push(message, bg){
    stepQueue.push({ message, bg, bgAnim:false });
  }
  function pushSteps(arr){
    for(const s of arr) stepQueue.push(s);
  }

  function clone(v){ return JSON.parse(JSON.stringify(v)); }
  function pick(a){ return a[Math.floor(Math.random()*a.length)]; }
  function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } }
})();
