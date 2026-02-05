/* =========================================================
   MOB BR - sim.js (FULL)
   - 司令塔：試合の流れ.txt 準拠
   - R1〜R6：復活 → イベント → 交戦（枠数保証）→ 移動
   - AUTO / NEXT 制御
   - プレイヤー脱落後の高速処理
   ---------------------------------------------------------
   依存：
   - SimMap / SimEvents / SimBattle / SimResult
   - RULES / Storage / UI（最低限）
   ---------------------------------------------------------
   提供：window.Sim
   - startMatch({ teams })
   - next()
   - setAuto(on)
========================================================= */

(function(){
  'use strict';

  const Sim = {};
  window.Sim = Sim;

  /* =========================
     INTERNAL STATE
  ========================== */
  let _teams = [];
  let _round = 0;
  let _steps = [];     // UIに渡すステップキュー
  let _auto = false;
  let _fast = false;   // プレイヤー脱落後の高速処理
  let _busy = false;

  /* =========================
     PUBLIC API
  ========================== */
  Sim.startMatch = function(opts){
    if(_busy) return;
    _busy = true;

    _teams = cloneTeams(opts?.teams || []);
    _round = 1;
    _steps = [];
    _auto = false;
    _fast = false;

    // 初期化
    for(const t of _teams){
      t.place = null;
      t.eliminated = false;
      t.alive = t.alive ?? (RULES?.GAME?.teamSize || 3);
      t.deathBoxes = 0;
      t.kp = 0; t.ap = 0; t.treasure = 0; t.flag = 0;
      t.eventBuffs = { aim:0, mental:0, agi:0 };
      t._ultUsed = false;
    }

    // R1降下
    SimMap.deployR1(_teams);
    pushStep(`降下開始！`, RULES?.MAP?.screens?.map || 'assets/map.png');

    _busy = false;
    tick();
  };

  Sim.next = function(){
    tick();
  };

  Sim.setAuto = function(on){
    _auto = !!on;
    if(_auto) tick();
  };

  /* =========================
     MAIN TICK
  ========================== */
  function tick(){
    if(_busy) return;

    // ステップがあれば消化
    if(_steps.length){
      const s = _steps.shift();
      UI.showStep(s); // ui.js 側で表示
      if(_auto){
        setTimeout(tick, RULES?.GAME?.autoMs || 2500);
      }
      return;
    }

    // ステップが無い＝次のフェーズへ
    if(_round <= 6){
      runRound(_round);
      return;
    }

    // 全ラウンド終了 → リザルト
    finalize();
  }

  /* =========================
     ROUND FLOW
  ========================== */
  function runRound(r){
    _busy = true;

    // ---- 復活（R1〜R5 / R6特例）----
    revivePhase(r);

    // ---- イベント ----
    SimEvents.applyRoundEvents({
      round: r,
      teams: _teams,
      isFastMode: _fast,
      isPlayerTeamFn,
      getPlayerBgFn,
      pushStepsFn: pushSteps
    });

    // ---- 交戦（枠数保証）----
    battlePhase(r);

    // ---- 移動（R6以外）----
    if(r < 6){
      movePhase(r);
    }

    _round++;
    _busy = false;
    tick();
  }

  /* =========================
     PHASES
  ========================== */
  function revivePhase(r){
    for(const t of _teams){
      if(t.eliminated) continue;

      if(r === 6){
        if(t.deathBoxes >= 1){
          // 最終：全復活
          t.alive = RULES?.GAME?.teamSize || 3;
          t.deathBoxes = 0;
          if(isPlayerTeamFn(t) && !_fast){
            pushStep('最終前に全員復帰！万全で行く！', getPlayerBgFn());
          }
        }
      }else{
        if(t.deathBoxes === 1){
          t.alive = Math.min((RULES?.GAME?.teamSize || 3), t.alive + 1);
          t.deathBoxes = 0;
        }else if(t.deathBoxes >= 2){
          // 70/30
          if(Math.random() < 0.7){
            t.alive = Math.min((RULES?.GAME?.teamSize || 3), t.alive + 2);
          }else{
            t.alive = Math.min((RULES?.GAME?.teamSize || 3), t.alive + 1);
          }
          t.deathBoxes = 0;
        }
      }
    }
  }

  function battlePhase(r){
    const cfg = RULES?.MATCH?.rounds?.find(x => x.r === r);
    const fights = cfg?.fights || 0;

    for(let i=0;i<fights;i++){
      const pair = pickBattlePair(r);
      if(!pair) break;

      const res = SimBattle.resolveBattle({
        teamA: pair[0],
        teamB: pair[1],
        round: r,
        isFastMode: _fast,
        isPlayerTeamFn,
        pushStepsFn: pushSteps,
        getBattleBgFn: ()=> (RULES?.MAP?.screens?.battle || 'assets/battle.png')
      });

      // 脱落時の place 仮付け（後で確定）
      if(res?.loser?.eliminated && res.loser.place == null){
        res.loser.place = calcPlace();
        if(isPlayerTeamFn(res.loser)) _fast = true; // プレイヤー脱落後は高速
      }
    }
  }

  function movePhase(r){
    const nextAreas = (RULES?.MAP?.roundAreas?.[`R${r+1}`]) || [];
    SimMap.moveAllAliveTo(_teams, nextAreas);
    if(!_fast){
      pushStep(`次のエリアへ移動…`, RULES?.MAP?.screens?.ido || 'assets/ido.png');
    }
  }

  /* =========================
     FINALIZE
  ========================== */
  function finalize(){
    const out = SimResult.finalizeTournament(_teams);
    UI.showResult(out); // ui.js 側で結果表示
  }

  /* =========================
     HELPERS
  ========================== */
  function pickBattlePair(r){
    // 生存のみ
    const alive = _teams.filter(t => !t.eliminated);
    if(alive.length < 2) return null;

    // プレイヤー優先率
    const pref = RULES?.MATCH?.rounds?.find(x=>x.r===r)?.playerFightRate ?? 0;

    const player = alive.find(isPlayerTeamFn);
    if(player && Math.random() < pref){
      const enemy = alive.find(t => t !== player);
      if(enemy) return [player, enemy];
    }

    // 同エリア優先
    alive.sort(()=>Math.random()-0.5);
    for(let i=0;i<alive.length;i++){
      for(let j=i+1;j<alive.length;j++){
        if(alive[i].areaId === alive[j].areaId){
          return [alive[i], alive[j]];
        }
      }
    }

    // フォールバック
    return [alive[0], alive[1]];
  }

  function calcPlace(){
    // 残りチーム数から下位順に
    const aliveCount = _teams.filter(t=>!t.eliminated).length;
    return aliveCount + 1;
  }

  function pushStep(message, bg){
    _steps.push({ message, bg, bgAnim:false });
  }
  function pushSteps(arr){
    for(const s of arr) _steps.push(s);
  }

  function isPlayerTeamFn(t){
    return !!t?.isPlayer;
  }
  function getPlayerBgFn(){
    return RULES?.MAP?.screens?.battle || 'assets/battle.png';
  }

  function cloneTeams(teams){
    return JSON.parse(JSON.stringify(teams));
  }

})();
