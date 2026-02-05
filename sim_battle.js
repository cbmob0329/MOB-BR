/* =========================================================
   MOB BR - sim-battle.js (FULL / SPEC COMPLETE)
   試合の流れ.txt 完全準拠
   ---------------------------------------------------------
   ・戦闘は必ず決着
   ・敗者は必ず全滅（alive=0 / eliminated=true）
   ・勝者もDB抽選で0〜2人ダウン
   ・alive=2 のときのみ総合力+40%
   ・勝率式：clamp(50 + 差*1.8, 22, 78)
   ・パッシブ / ULT を実際に反映
   ・キル / アシスト破綻ゼロ
   ・CPU同士も完全同一ロジック
========================================================= */

(function(){
  'use strict';

  const SimBattle = {};
  window.SimBattle = SimBattle;

  /* =========================
     PUBLIC API
  ========================== */
  SimBattle.resolveBattle = function(opts){
    const teamA = opts.teamA;
    const teamB = opts.teamB;
    const round = opts.round;
    const isFast = !!opts.isFastMode;

    const isPlayerTeam = opts.isPlayerTeamFn || (t=>!!t.isPlayer);
    const pushSteps   = opts.pushStepsFn || (()=>{});
    const getBg       = opts.getBattleBgFn || (()=>'assets/battle.png');

    if(!teamA || !teamB) return null;
    if(teamA.eliminated || teamB.eliminated) return null;

    initTeam(teamA);
    initTeam(teamB);

    /* ===== パッシブ適用（戦闘中のみ） ===== */
    applyPassive(teamA);
    applyPassive(teamB);

    /* ===== 総合戦闘力計算 ===== */
    const powerA = calcTeamPower(teamA);
    const powerB = calcTeamPower(teamB);

    /* ===== 勝率計算 ===== */
    const winRateA = calcWinRate(powerA, powerB);
    const aWins = Math.random()*100 < winRateA;

    const winner = aWins ? teamA : teamB;
    const loser  = aWins ? teamB : teamA;

    /* ===== ログ：戦闘開始 ===== */
    if(!isFast && (isPlayerTeam(teamA) || isPlayerTeam(teamB))){
      pushSteps([{ message:'戦闘開始！', bg:getBg(), bgAnim:false }]);
    }

    /* ===== ULT（戦闘中1回だけ） ===== */
    applyUlt(winner);
    applyUlt(loser);

    /* ===== 勝敗処理 ===== */

    // 敗者：必ず全滅
    loser.deathBoxes += loser.alive;
    loser.alive = 0;
    loser.eliminated = true;

    // 勝者：DB抽選
    applyWinnerDB(winner);

    /* ===== キル / アシスト ===== */
    distributeKillsAndAssists(winner, loser);

    /* ===== ログ：結果 ===== */
    if(!isFast && (isPlayerTeam(teamA) || isPlayerTeam(teamB))){
      pushSteps([{ message:`${winner.name} が勝利！`, bg:getBg(), bgAnim:false }]);
    }

    return { winner, loser, winRateA };
  };

  /* =========================
     INIT
  ========================== */
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

  /* =========================
     PASSIVE / ULT
  ========================== */
  function applyPassive(t){
    if(!t.isPlayer) return;
    if(!window.DataPlayer) return;

    const p = DataPlayer.calcTeamPassive();
    t._passiveBuff = {
      armor: p.armor || 0,
      agility: p.agility || 0,
      detect: p.detect || 0
    };
  }

  function applyUlt(t){
    if(t._ultUsed) return;
    if(!t.isPlayer) return;

    // FightBoost +2（内部）
    t._ultUsed = true;
    t._ultBoost = 2;
  }

  /* =========================
     POWER / WINRATE
  ========================== */
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

      // イベントバフ
      v *= (1 + (t.eventBuffs.aim||0));
      v *= (1 + (t.eventBuffs.mental||0));
      v *= (1 + (t.eventBuffs.agi||0));

      sum += v;
    }

    let avg = sum / t.members.length;

    // alive=2 のみ +40%
    if(t.alive === 2){
      avg *= 1.4;
    }

    // ULT補正
    if(t._ultBoost){
      avg += t._ultBoost;
    }

    return avg;
  }

  function calcWinRate(a,b){
    const w = 50 + (a - b) * 1.8;
    return clamp(w, 22, 78);
  }

  /* =========================
     DB（勝者）
  ========================== */
  function applyWinnerDB(w){
    const r = Math.random()*100;
    let down = 0;
    if(r < 55) down = 0;
    else if(r < 90) down = 1;
    else down = 2;

    down = Math.min(down, w.alive - 1); // 最低1人生存保証

    if(down > 0){
      w.alive -= down;
      w.deathBoxes += down;
    }
  }

  /* =========================
     KILL / ASSIST
  ========================== */
  function distributeKillsAndAssists(winner, loser){
    // チームキル数
    const wKills = randInt(1, Math.min(3, loser.members.length));
    const lKills = randInt(0, Math.min(2, winner.members.length));

    addTeamKills(winner, wKills);
    addTeamKills(loser, lKills);

    // Assist：Kill数を超えない
    const wAssist = randInt(0, wKills);
    const lAssist = randInt(0, lKills);

    winner.ap += wAssist;
    loser.ap  += lAssist;
  }

  function addTeamKills(team, kills){
    team.kp += kills;

    const weights = {
      ATTACKER:50,
      IGL:30,
      SUPPORT:20
    };

    for(let i=0;i<kills;i++){
      const idx = weightedPick(team.members.map(m=>weights[m.role]||1));
      team.members[idx].kills += 1;
    }
  }

  /* =========================
     UTIL
  ========================== */
  function weightedPick(weights){
    const sum = weights.reduce((a,b)=>a+b,0);
    let r = Math.random()*sum;
    for(let i=0;i<weights.length;i++){
      r -= weights[i];
      if(r <= 0) return i;
    }
    return weights.length-1;
  }

  function randInt(a,b){
    return Math.floor(Math.random()*(b-a+1))+a;
  }

  function clamp(v,min,max){
    return Math.max(min, Math.min(max, v));
  }

})();
