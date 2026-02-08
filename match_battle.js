'use strict';

/*
  match_battle.js
  ---------------------------
  役割：
  ・1交戦の勝敗を決定
  ・ダウン / DB処理
  ・キル / アシスト配分
  ・チーム状態更新
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.matchBattle = (function(){

  /* ===========================
     ユーティリティ
  ============================*/

  function clamp(v, min, max){
    return Math.max(min, Math.min(max, v));
  }

  function rand(min, max){
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function chance(p){
    return Math.random() < p;
  }

  /* ===========================
     戦闘力計算
  ============================*/

  function calcTeamPower(team){

    if (team.alive <= 0) return 0;

    let base = team.basePower || 50;

    // イベントbuff
    if (team.eventBuffs){
      base *= (1 + (team.eventBuffs.aim || 0));
      base *= (1 + (team.eventBuffs.mental || 0));
      base *= (1 + (team.eventBuffs.agility || 0));
    }

    // 人数補正
    if (team.alive === 2){
      base *= 1.4; // 指定仕様
    }

    return base;
  }

  /* ===========================
     勝敗決定
  ============================*/

  function decideWinner(teamA, teamB){

    const powerA = calcTeamPower(teamA);
    const powerB = calcTeamPower(teamB);

    const diff = powerA - powerB;

    let winRateA = 50 + diff * 1.8;
    winRateA = clamp(winRateA, 22, 78);

    if (chance(winRateA / 100)){
      return { winner: teamA, loser: teamB };
    } else {
      return { winner: teamB, loser: teamA };
    }
  }

  /* ===========================
     DB処理
  ============================*/

  function applyDB(winner){

    const roll = Math.random();

    let downCount = 0;

    if (roll < 0.55){
      downCount = 0;
    } else if (roll < 0.90){
      downCount = 1;
    } else {
      downCount = 2;
    }

    downCount = Math.min(downCount, winner.alive);

    winner.alive -= downCount;
    winner.deathBoxes += downCount;
  }

  /* ===========================
     キル抽選
  ============================*/

  function rollKills(winner, loser){

    let winnerKills = rand(0,3);
    let loserKills  = rand(0,2);

    // 敗者は基本0-1寄せ
    if (loserKills === 2 && Math.random() < 0.6){
      loserKills = 1;
    }

    return { winnerKills, loserKills };
  }

  /* ===========================
     個人キル配分
  ============================*/

  function distributeKills(team, killCount){

    const weights = [
      { role: 'attacker', w: 50 },
      { role: 'igl', w: 30 },
      { role: 'support', w: 20 }
    ];

    for (let i = 0; i < killCount; i++){

      const totalW = 100;
      const r = Math.random() * totalW;

      let acc = 0;
      for (let w of weights){
        acc += w.w;
        if (r <= acc){
          const member = team.members.find(m => m.role === w.role);
          if (member){
            member.kills++;
            team.kills_total++;
          }
          break;
        }
      }
    }
  }

  /* ===========================
     アシスト配分（絶対に Kill超えない）
  ============================*/

  function distributeAssists(team, killCount){

    for (let i = 0; i < killCount; i++){

      // 最大1アシスト
      if (!chance(0.6)) continue;

      const assister = team.members[rand(0,2)];
      assister.assists++;
      team.assists_total++;
    }
  }

  /* ===========================
     メイン戦闘処理
  ============================*/

  function executeBattle(teamA, teamB){

    if (teamA.eliminated || teamB.eliminated){
      return null;
    }

    const { winner, loser } = decideWinner(teamA, teamB);

    const { winnerKills, loserKills } = rollKills(winner, loser);

    distributeKills(winner, winnerKills);
    distributeKills(loser, loserKills);

    distributeAssists(winner, winnerKills);
    distributeAssists(loser, loserKills);

    // 敗者は全滅
    loser.alive = 0;
    loser.eliminated = true;

    // 勝者は削れる
    applyDB(winner);

    return {
      winnerId: winner.teamId,
      loserId: loser.teamId
    };
  }

  return {
    executeBattle
  };

})();
