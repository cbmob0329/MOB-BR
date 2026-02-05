/* =========================================================
   MOB BR - sim-events.js (FULL)
   - イベント抽選（重み）
   - 重複なし（イベントも対象チームも）
   - 全滅チーム除外
   - 効果適用（%は内部のみ：eventBuffsへ加算）
   - Treasure / Flag は数値加算
   - 表示はプレイヤーのみ：必ず3段（発生→名前→セリフ）
   ---------------------------------------------------------
   提供：window.SimEvents
   - getCountForRound(round) -> 0/1/2
   - applyRoundEvents({ round, teams, isFastMode, isPlayerTeamFn, getPlayerBgFn, pushStepsFn })
========================================================= */

(function(){
  'use strict';

  const SimEvents = {};
  window.SimEvents = SimEvents;

  /* =========================
     EVENT TABLE（確定）
     ※%は出さない。内部で eventBuffs に加算のみ。
  ========================== */
  const EVENT_TABLE = [
    ev('STRATEGY','作戦会議','作戦会議！連携力がアップ！',35, { agi:+0.01 }),
    ev('CIRCLE',  '円陣',    '円陣を組んだ！ファイト力がアップ！',35, { aim:+0.01 }),
    ev('SCOUT',   '冷静な索敵','冷静に索敵！先手を取りやすくなる！',35, { mental:+0.01 }),

    ev('RARE',  'レア武器ゲット','レア武器を拾った！全員のエイムが大きくアップ！',10, { aim:+0.02 }),
    ev('MISS',  '判断ミス',      '向かう方向が分かれてタイムロス！敏捷性が下がった！',15, { agi:-0.01 }),
    ev('FIGHT', '喧嘩',          'コールが嚙み合わない！全員のメンタルが減少！',10, { mental:-0.01 }),

    ev('ZONE',     'ゾーンに入る','全員がゾーンに入り覚醒！',5, { aim:+0.03, mental:+0.03 }),
    ev('TREASURE', 'お宝ゲット',  'お宝をゲットした！',4, { treasure:+1 }),
    ev('FLAG',     'フラッグゲット','フラッグをゲットした！',2, { flag:+1 }),
  ];

  /* =========================
     PUBLIC
  ========================== */
  SimEvents.getCountForRound = function(round){
    if(round === 1) return 1;
    if(round >= 2 && round <= 5) return 2;
    return 0; // R6は基本なし
  };

  // applyRoundEvents:
  // - isPlayerTeamFn(team) -> boolean
  // - getPlayerBgFn() -> bgPath
  // - pushStepsFn(stepsArray, resetFlag?)
  SimEvents.applyRoundEvents = function(opts){
    const round = opts?.round ?? 1;
    const teams = Array.isArray(opts?.teams) ? opts.teams : [];
    const isFastMode = !!opts?.isFastMode;

    const isPlayerTeamFn = typeof opts?.isPlayerTeamFn === 'function'
      ? opts.isPlayerTeamFn
      : (t => !!t?.isPlayer);

    const getPlayerBgFn = typeof opts?.getPlayerBgFn === 'function'
      ? opts.getPlayerBgFn
      : (() => 'assets/main1.png');

    const pushStepsFn = typeof opts?.pushStepsFn === 'function'
      ? opts.pushStepsFn
      : (() => {});

    const count = SimEvents.getCountForRound(round);
    if(count <= 0) return;

    // 対象：全滅除外
    const aliveTeams = teams.filter(t => t && !t.eliminated);

    // 重複なし
    const usedEventIds = new Set();
    const usedTeamIds = new Set();

    for(let i=0;i<count;i++){
      const e = weightedPickEvent(usedEventIds);
      if(!e) break;
      usedEventIds.add(e.id);

      const t = pickTeamNoDup(aliveTeams, usedTeamIds);
      if(!t) break;
      usedTeamIds.add(t.teamId);

      applyEvent(t, e);

      // ログ：プレイヤーのみ、必ず3段
      if(!isFastMode && isPlayerTeamFn(t)){
        const bg = getPlayerBgFn();
        pushStepsFn([
          step('イベント発生！', bg, false),
          step(`（${e.name}）`, bg, false),
          step(e.line, bg, false),
        ]);
      }
    }
  };

  /* =========================
     APPLY
  ========================== */
  function applyEvent(team, e){
    if(!team.eventBuffs) team.eventBuffs = { aim:0, mental:0, agi:0 };

    if(typeof e.effect.aim === 'number') team.eventBuffs.aim += e.effect.aim;
    if(typeof e.effect.mental === 'number') team.eventBuffs.mental += e.effect.mental;
    if(typeof e.effect.agi === 'number') team.eventBuffs.agi += e.effect.agi;

    if(typeof e.effect.treasure === 'number'){
      team.treasure = (team.treasure || 0) + e.effect.treasure;
    }
    if(typeof e.effect.flag === 'number'){
      team.flag = (team.flag || 0) + e.effect.flag;
    }
  }

  /* =========================
     PICKERS
  ========================== */
  function weightedPickEvent(usedEventIds){
    const pool = EVENT_TABLE.filter(e => !usedEventIds.has(e.id));
    if(pool.length === 0) return null;

    const weights = pool.map(e => e.weight);
    const idx = weightedIndex(weights);
    return pool[idx] || null;
  }

  function pickTeamNoDup(aliveTeams, usedTeamIds){
    const pool = aliveTeams.filter(t => t && !usedTeamIds.has(t.teamId));
    if(pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function weightedIndex(weights){
    const sum = weights.reduce((a,b)=>a+b,0);
    let r = Math.random() * sum;
    for(let i=0;i<weights.length;i++){
      r -= weights[i];
      if(r <= 0) return i;
    }
    return weights.length - 1;
  }

  /* =========================
     STEP（ui.js側に渡す最低限）
  ========================== */
  function step(message, bg, bgAnim){
    return {
      message: String(message ?? ''),
      bg: bg || null,
      bgAnim: !!bgAnim,
    };
  }

  function ev(id, name, line, weight, effect){
    return { id, name, line, weight, effect: effect || {} };
  }

})();
