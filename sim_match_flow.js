'use strict';

/*
  sim_match_flow.js v3（完全版）
  試合最新版準拠
  ✅ ダウン概念なし
  ✅ チーム単位即決着
  ✅ eventBuffs % を乗算反映
  ✅ resolveBattle(A,B,round,ctx) を外部公開
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.sim = window.MOBBR.sim || {};

(function(){

  // =========================
  // 内部ユーティリティ
  // =========================

  function clamp(n){
    const v = Number(n);
    if (!Number.isFinite(v)) return 0;
    return Math.max(0, v);
  }

  function ensureBuffShape(team){
    if (!team.eventBuffs){
      team.eventBuffs = { aim:0, mental:0, agi:0 };
    }
    if (!Number.isFinite(team.eventBuffs.aim)) team.eventBuffs.aim = 0;
    if (!Number.isFinite(team.eventBuffs.mental)) team.eventBuffs.mental = 0;
    if (!Number.isFinite(team.eventBuffs.agi)) team.eventBuffs.agi = 0;
  }

  function calcTeamFightPower(team){
    ensureBuffShape(team);

    const base = clamp(team.power);

    const aimMul    = 1 + (team.eventBuffs.aim    || 0) / 100;
    const mentalMul = 1 + (team.eventBuffs.mental || 0) / 100;
    const agiMul    = 1 + (team.eventBuffs.agi    || 0) / 100;

    const total = base * aimMul * mentalMul * agiMul;

    return Math.max(1, total);
  }

  function decideWinner(A, B){
    const pA = calcTeamFightPower(A);
    const pB = calcTeamFightPower(B);

    const sum = pA + pB;
    if (sum <= 0) return A;

    const winRateA = pA / sum;

    const r = Math.random();
    return (r < winRateA) ? A : B;
  }

  function eliminateTeam(team){
    team.alive = 0;
    team.eliminated = true;
  }

  function resetMatchBuffs(team){
    if (!team) return;
    team.eventBuffs = { aim:0, mental:0, agi:0 };
  }

  // =========================
  // 公開API
  // =========================

  function resolveBattle(A, B, round, ctx){

    if (!A || !B) return null;
    if (A.eliminated || B.eliminated) return null;

    // 勝者決定
    const winner = decideWinner(A, B);
    const loser  = (winner === A) ? B : A;

    // 敗者は即全滅
    eliminateTeam(loser);

    // 勝者は生存3固定（減らさない）
    winner.alive = 3;
    winner.eliminated = false;

    // バフは試合終了でリセット
    resetMatchBuffs(A);
    resetMatchBuffs(B);

    return {
      winnerId: winner.id,
      loserId: loser.id
    };
  }

  // コーチスキル取得（将来拡張用）
  function getPlayerCoachFlags(){
    // ここは将来 localStorage 等から読む設計
    // 今は仮で null を返す
    return null;
  }

  window.MOBBR.sim.matchFlow = {
    resolveBattle,
    getPlayerCoachFlags
  };

})();
