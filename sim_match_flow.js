'use strict';

/*
  sim_match_flow.js v2（フル）
  ✅「試合最新版.txt」運用向け（大会側から呼ばれる “交戦解決エンジン” ）
  - resolveBattle(teamA, teamB, round, ctx) を提供
  - ダウン概念なし（downs_total 一切なし）
  - eventBuffs（aim/mental/agi の%加算）を勝率に反映
  - バトル後、eventBuffs は「その試合中のみ」なので両チーム分リセット
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.sim = window.MOBBR.sim || {};

(function(){

  function clamp(n, lo, hi){
    const v = Number(n);
    if (!Number.isFinite(v)) return lo;
    return Math.max(lo, Math.min(hi, v));
  }

  function isAlive(t){
    return t && !t.eliminated && (t.alive|0) > 0;
  }

  function ensureTeamShape(t){
    if (!t) return;
    if (!Number.isFinite(Number(t.power))) t.power = 55;
    if (!Number.isFinite(Number(t.alive))) t.alive = 3;
    if (t.alive < 0) t.alive = 0;
    if (!t.eventBuffs || typeof t.eventBuffs !== 'object'){
      t.eventBuffs = { aim:0, mental:0, agi:0 };
    }else{
      if (!Number.isFinite(t.eventBuffs.aim)) t.eventBuffs.aim = 0;
      if (!Number.isFinite(t.eventBuffs.mental)) t.eventBuffs.mental = 0;
      if (!Number.isFinite(t.eventBuffs.agi)) t.eventBuffs.agi = 0;
    }
    if (!Number.isFinite(Number(t.treasure))) t.treasure = 0;
    if (!Number.isFinite(Number(t.flag))) t.flag = 0;
    if (t.eliminated !== true) t.eliminated = false;
  }

  // eventBuffs（%加算）→ 乗算係数へ
  function buffMultiplierFromEventBuffs(t){
    const aim = clamp(t.eventBuffs?.aim ?? 0, -99, 99);
    const mental = clamp(t.eventBuffs?.mental ?? 0, -99, 99);
    const agi = clamp(t.eventBuffs?.agi ?? 0, -99, 99);

    // ここは「勝率に効く」ための係数化（過剰に暴れないよう弱め）
    // 例：aim +5% → 1.05、mental +5% → 1.04、agi +5% → 1.03 くらいの感覚
    const mAim = 1 + (aim / 100);
    const mMental = 1 + (mental / 120);
    const mAgi = 1 + (agi / 140);

    return clamp(mAim * mMental * mAgi, 0.70, 1.35);
  }

  // ラウンドが進むほど事故りやすい（終盤は波乱）
  function roundVariance(round){
    if (round <= 2) return 0.10;
    if (round <= 4) return 0.14;
    if (round === 5) return 0.18;
    return 0.20;
  }

  function computeFightPower(t, round){
    ensureTeamShape(t);

    const base = clamp(t.power, 1, 100);
    const alive = clamp(t.alive, 0, 3);

    // 生存数が少ないと不利（超強烈にはしない）
    const aliveMult = (alive >= 3) ? 1.00 : (alive === 2 ? 0.92 : (alive === 1 ? 0.82 : 0.60));

    const evMult = buffMultiplierFromEventBuffs(t);

    // 小さい乱数（ラウンドに応じて）
    const v = roundVariance(round);
    const rng = 1 + ((Math.random() * 2 - 1) * v);

    return base * aliveMult * evMult * rng;
  }

  function resolveCasualties(winner, loser, round){
    // ダウン無し：単純に「生存数が減る」だけ
    // ラウンドが進むほど削れやすい
    const r = clamp(round, 1, 6);

    // loser は 1〜3 減り（終盤ほど2,3が増える）
    let loseDrop = 1;
    const p2 = (r <= 2) ? 0.25 : (r <= 4 ? 0.40 : 0.55);
    const p3 = (r <= 2) ? 0.05 : (r <= 4 ? 0.10 : 0.18);

    const x = Math.random();
    if (x < p3) loseDrop = 3;
    else if (x < p3 + p2) loseDrop = 2;

    // winner も少し減ることがある（0〜2）
    let winDrop = 0;
    const wp1 = (r <= 2) ? 0.15 : (r <= 4 ? 0.22 : 0.30);
    const wp2 = (r <= 2) ? 0.03 : (r <= 4 ? 0.06 : 0.10);
    const y = Math.random();
    if (y < wp2) winDrop = 2;
    else if (y < wp2 + wp1) winDrop = 1;

    winner.alive = clamp((winner.alive|0) - winDrop, 0, 3);
    loser.alive  = clamp((loser.alive|0)  - loseDrop, 0, 3);

    if (winner.alive <= 0){
      winner.alive = 0;
      winner.eliminated = true;
    }
    if (loser.alive <= 0){
      loser.alive = 0;
      loser.eliminated = true;
    }

    return { winDrop, loseDrop };
  }

  function resetMatchBuffs(team){
    if (window.MOBBR?.sim?.matchEvents?.resetTeamMatchState){
      window.MOBBR.sim.matchEvents.resetTeamMatchState(team);
      return;
    }
    // フォールバック
    team.eventBuffs = { aim:0, mental:0, agi:0 };
  }

  function resolveBattle(teamA, teamB, round, ctx){
    ensureTeamShape(teamA);
    ensureTeamShape(teamB);

    if (!isAlive(teamA) || !isAlive(teamB)) return null;

    const pA = computeFightPower(teamA, round);
    const pB = computeFightPower(teamB, round);

    // 勝率（極端にならないようクランプ）
    const sum = Math.max(1e-6, pA + pB);
    let winA = pA / sum;
    winA = clamp(winA, 0.15, 0.85);

    const aWin = (Math.random() < winA);

    const winner = aWin ? teamA : teamB;
    const loser  = aWin ? teamB : teamA;

    const dmg = resolveCasualties(winner, loser, round);

    // 試合中のみのバフはここでリセット（両チーム）
    resetMatchBuffs(teamA);
    resetMatchBuffs(teamB);

    return {
      winnerId: winner.id,
      loserId: loser.id,
      winDrop: dmg.winDrop,
      loseDrop: dmg.loseDrop
    };
  }

  // いまはコーチスキルは “フラグ提供口” だけ用意（後で実装拡張）
  function getPlayerCoachFlags(){
    // 例：{ score_mind:true } を返すようにすると match_events 側が Treasure+1 する
    return {};
  }

  window.MOBBR.sim.matchFlow = {
    resolveBattle,
    getPlayerCoachFlags
  };

})();
