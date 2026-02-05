/* =========================================================
   MOB BR - sim-battle.js (FULL / SPEC COMPLETE + UI ENEMY)
   - 交戦時に「敵チーム名＋画像」をUIに渡す（プレイヤー戦のみ）
========================================================= */

(function(){
  'use strict';

  const SimBattle = {};
  window.SimBattle = SimBattle;

  SimBattle.resolveBattle = function(opts){
    const teamA = opts.teamA;
    const teamB = opts.teamB;
    const round = opts.round;
    const isFast = !!opts.isFastMode;

    const isPlayerTeam = opts.isPlayerTeamFn || (t=>!!t.isPlayer);
    const pushSteps   = opts.pushStepsFn || (()=>{});
    const getBg       = opts.getBattleBgFn || (()=>'battle.png');

    if(!teamA || !teamB) return null;
    if(teamA.eliminated || teamB.eliminated) return null;

    initTeam(teamA);
    initTeam(teamB);

    applyPassive(teamA);
    applyPassive(teamB);

    const powerA = calcTeamPower(teamA);
    const powerB = calcTeamPower(teamB);

    const winRateA = calcWinRate(powerA, powerB);
    const aWins = Math.random()*100 < winRateA;

    const winner = aWins ? teamA : teamB;
    const loser  = aWins ? teamB : teamA;

    const playerInvolved = isPlayerTeam(teamA) || isPlayerTeam(teamB);
    const playerTeam = isPlayerTeam(teamA) ? teamA : (isPlayerTeam(teamB) ? teamB : null);
    const enemyTeam  = playerTeam ? (playerTeam === teamA ? teamB : teamA) : null;

    // ログ：戦闘開始（プレイヤー戦なら敵表示）
    if(!isFast && playerInvolved){
      const step = { message:'戦闘開始！', bg:getBg(), bgAnim:false };
      if(enemyTeam){
        step.enemy = {
          name: enemyTeam.name || '敵チーム',
          members: memberNames(enemyTeam),
          img: `cpu/${enemyTeam.teamId}.png`
        };
      }
      pushSteps([step]);
    }

    applyUlt(winner);
    applyUlt(loser);

    // 敗者：必ず全滅
    loser.deathBoxes += loser.alive;
    loser.alive = 0;
    loser.eliminated = true;

    // 勝者：DB抽選（最低1人生存）
    applyWinnerDB(winner);

    // K/A
    distributeKillsAndAssists(winner, loser);

    // ログ：結果（交戦終了で敵消す）
    if(!isFast && playerInvolved){
      pushSteps([
        { message:`${winner.name} が勝利！`, bg:getBg(), bgAnim:false },
        { message:`交戦終了`, bg:getBg(), bgAnim:false, clearEnemy:true }
      ]);
    }

    return { winner, loser, winRateA };
  };

  function initTeam(t){
    if(typeof t.alive !== 'number') t.alive = 3;
    if(typeof t.deathBoxes !== 'number') t.deathBoxes = 0;
    if(!t.eventBuffs) t.eventBuffs = { aim:0, mental:0, agi:0 };
    if(!t.members) t.members = [];
    if(typeof t.kp !== 'number') t.kp = 0;
    if(typeof t.ap !== 'number') t.ap = 0;
    for(const m of t.members){
      if(typeof m.kills !== 'number') m.kills = 0;
      if(typeof m.assists !== 'number') m.assists = 0;
    }
  }

  function memberNames(t){
    if(!Array.isArray(t.members) || !t.members.length) return 'メンバー';
    return t.members.map(m=>m.name).join(' / ');
  }

  function applyPassive(t){
    if(!t.isPlayer) return;
    if(!window.DataPlayer) return;
    const p = DataPlayer.calcTeamPassive();
    t._passiveBuff = { armor: p.armor||0, agility: p.agility||0, detect: p.detect||0 };
  }

  function applyUlt(t){
    if(t._ultUsed) return;
    if(!t.isPlayer) return;
    t._ultUsed = true;
    t._ultBoost = 2;
  }

  function calcTeamPower(t){
    let sum = 0;
    for(const m of t.members){
      const s = m.stats || {};
      let v =
        (s.aim||0) +
        (s.mental||0) +
        (s.agility||0) +
        (s.tech||0) +
        (s.support||0) +
        (s.detect||0);

      v *= (1 + (t.eventBuffs.aim||0));
      v *= (1 + (t.eventBuffs.mental||0));
      v *= (1 + (t.eventBuffs.agi||0));
      sum += v;
    }

    let avg = t.members.length ? (sum / t.members.length) : 0;

    if(t.alive === 2) avg *= 1.4;
    if(t._ultBoost) avg += t._ultBoost;

    return avg;
  }

  function calcWinRate(a,b){
    const w = 50 + (a - b) * 1.8;
    return clamp(w, 22, 78);
  }

  function applyWinnerDB(w){
    const r = Math.random()*100;
    let down = 0;
    if(r < 55) down = 0;
    else if(r < 90) down = 1;
    else down = 2;

    down = Math.min(down, w.alive - 1); // 最低1人生存
    if(down > 0){
      w.alive -= down;
      w.deathBoxes += down;
    }
  }

  function distributeKillsAndAssists(winner, loser){
    const wKills = randInt(1, Math.min(3, loser.members.length || 3));
    const lKills = randInt(0, Math.min(2, winner.members.length || 3));

    addTeamKills(winner, wKills);
    addTeamKills(loser, lKills);

    // Assist ≤ Kill を保証（チームAPに加算）
    winner.ap += randInt(0, wKills);
    loser.ap  += randInt(0, lKills);
  }

  function addTeamKills(team, kills){
    team.kp += kills;
    const weights = { ATTACKER:50, IGL:30, SUPPORT:20 };
    for(let i=0;i<kills;i++){
      const idx = weightedPick(team.members.map(m => weights[m.role] || 1));
      team.members[idx].kills += 1;
    }
  }

  function weightedPick(weights){
    const sum = weights.reduce((a,b)=>a+b,0);
    let r = Math.random()*sum;
    for(let i=0;i<weights.length;i++){
      r -= weights[i];
      if(r <= 0) return i;
    }
    return weights.length-1;
  }

  function randInt(a,b){ return Math.floor(Math.random()*(b-a+1))+a; }
  function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }

})();
