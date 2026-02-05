/* =========================================================
   MOB BR - sim-battle.js (FULL)
   - 戦闘解決（勝率/ULT/DB/キル&アシスト）
   - 破綻ゼロのK/A配分（Assist <= Kill を保証）
   - CPU同士も同一ロジックで裏処理
   - ログはプレイヤー戦のみ（簡潔）
   ---------------------------------------------------------
   依存：
   - data_rules.js (RULES)
   - data_player.js (DataPlayer)
   ---------------------------------------------------------
   提供：window.SimBattle
   - resolveBattle({ teamA, teamB, round, isFastMode, isPlayerTeamFn, pushStepsFn, getBattleBgFn })
========================================================= */

(function(){
  'use strict';

  const SimBattle = {};
  window.SimBattle = SimBattle;

  /* =========================
     PUBLIC
  ========================== */
  SimBattle.resolveBattle = function(opts){
    const teamA = opts?.teamA;
    const teamB = opts?.teamB;
    const round = opts?.round ?? 1;
    const isFastMode = !!opts?.isFastMode;

    const isPlayerTeamFn = typeof opts?.isPlayerTeamFn === 'function'
      ? opts.isPlayerTeamFn
      : (t => !!t?.isPlayer);

    const pushStepsFn = typeof opts?.pushStepsFn === 'function'
      ? opts.pushStepsFn
      : (() => {});

    const getBattleBgFn = typeof opts?.getBattleBgFn === 'function'
      ? opts.getBattleBgFn
      : (() => (window.RULES?.MAP?.screens?.battle || 'assets/battle.png'));

    if(!teamA || !teamB) return null;
    if(teamA.eliminated || teamB.eliminated) return null;

    // 初期化（不足分）
    initTeamRuntime(teamA);
    initTeamRuntime(teamB);

    // ===== バフ計算（イベント＋パッシブ） =====
    const buffA = calcTeamBuff(teamA);
    const buffB = calcTeamBuff(teamB);

    // ===== 戦闘力 =====
    const powerA = calcTeamPower(teamA, buffA);
    const powerB = calcTeamPower(teamB, buffB);

    // ===== 勝率 =====
    const winA = calcWinRate(powerA, powerB);
    const aWins = Math.random()*100 < winA;

    const winner = aWins ? teamA : teamB;
    const loser  = aWins ? teamB : teamA;

    // ===== ログ（開始） =====
    if(!isFastMode && (isPlayerTeamFn(teamA) || isPlayerTeamFn(teamB))){
      const bg = getBattleBgFn();
      pushStepsFn([ step('戦闘開始！', bg) ]);
    }

    // ===== ULT（各チーム1回まで・内部） =====
    applyUltOnce(teamA);
    applyUltOnce(teamB);

    // ===== 勝者も削れる（DB） =====
    applyWinnerDowns(winner);

    // ===== 敗者ダウン =====
    applyLoserDowns(loser);

    // ===== キル／アシスト配分 =====
    distributeKillsAssists(winner, loser);

    // ===== 脱落判定 =====
    checkElimination(loser);
    checkElimination(winner);

    // ===== ログ（結果） =====
    if(!isFastMode && (isPlayerTeamFn(teamA) || isPlayerTeamFn(teamB))){
      const bg = getBattleBgFn();
      const msg = winner === teamA
        ? `${teamA.name} が勝利！`
        : `${teamB.name} が勝利！`;
      pushStepsFn([ step(msg, bg) ]);
    }

    return {
      winner,
      loser,
      winRateA: winA
    };
  };

  /* =========================
     INITIALIZE
  ========================== */
  function initTeamRuntime(t){
    if(typeof t.alive !== 'number') t.alive = window.RULES?.GAME?.teamSize || 3;
    if(typeof t.deathBoxes !== 'number') t.deathBoxes = 0;
    if(typeof t.kp !== 'number') t.kp = 0;
    if(typeof t.ap !== 'number') t.ap = 0;
    if(!t.eventBuffs) t.eventBuffs = { aim:0, mental:0, agi:0 };
    if(!t._ultUsed) t._ultUsed = false;
  }

  /* =========================
     BUFF / POWER
  ========================== */
  function calcTeamBuff(t){
    // イベント
    const eb = t.eventBuffs || { aim:0, mental:0, agi:0 };

    // パッシブ（プレイヤーのみ）
    let passive = { armor:0, agility:0, detect:0 };
    if(t.isPlayer && window.DataPlayer?.calcTeamPassive){
      passive = DataPlayer.calcTeamPassive();
    }

    return {
      aimMul: 1 + (eb.aim || 0),
      mentalMul: 1 + (eb.mental || 0),
      agiMul: 1 + (eb.agi || 0),
      twoManBonus: (t.alive === 2) ? (window.RULES?.MATCH?.battle?.twoManBonus || 0) : 0,
      passive
    };
  }

  function calcTeamPower(t, buff){
    // メンバー平均（内部％）
    const members = t.members || [];
    let sum = 0;
    for(const m of members){
      const s = m.stats || {};
      const v =
        (s.aim||0)   * buff.aimMul +
        (s.mental||0)* buff.mentalMul +
        (s.agility||0)* buff.agiMul +
        (s.tech||0) +
        (s.support||0) +
        (s.detect||0);
      sum += v;
    }
    let avg = members.length ? sum / members.length : 0;
    if(buff.twoManBonus) avg *= (1 + buff.twoManBonus);
    return avg;
  }

  function calcWinRate(powerA, powerB){
    const base = window.RULES?.MATCH?.battle?.baseWin ?? 50;
    const mul  = window.RULES?.MATCH?.battle?.diffMul ?? 1.8;
    const min  = window.RULES?.MATCH?.battle?.clampMin ?? 22;
    const max  = window.RULES?.MATCH?.battle?.clampMax ?? 78;
    const diff = powerA - powerB;
    const w = clamp(base + diff * mul, min, max);
    return w;
  }

  /* =========================
     ULT / DOWNS
  ========================== */
  function applyUltOnce(t){
    if(t._ultUsed) return;
    // 内部効果のみ（FightBoost +2 相当を power に反映済みとみなす）
    t._ultUsed = true;
  }

  function applyWinnerDowns(winner){
    const table = window.RULES?.MATCH?.deathBoxOnWin || [];
    if(table.length === 0) return;
    const pick = weightedPick(table.map(x => x.prob));
    const down = table[pick]?.down ?? 0;
    if(down > 0){
      winner.alive = Math.max(0, winner.alive - down);
      winner.deathBoxes += down;
    }
  }

  function applyLoserDowns(loser){
    // 敗者は 1〜2 ダウン想定（安全側）
    const down = Math.min(loser.alive, randInt(1,2));
    loser.alive = Math.max(0, loser.alive - down);
    loser.deathBoxes += down;
  }

  function checkElimination(t){
    if(t.alive <= 0){
      t.eliminated = true;
    }
  }

  /* =========================
     KILLS / ASSISTS
  ========================== */
  function distributeKillsAssists(winner, loser){
    // 勝者：0〜3K、敗者：0〜2K（内部）
    const wKills = randInt(0, Math.min(3, loser.deathBoxes));
    const lKills = randInt(0, Math.min(2, winner.deathBoxes));

    // 重み（役割）
    const wWeights = window.RULES?.MATCH?.killRoleWeights || { ATTACKER:50, IGL:30, SUPPORT:20 };
    const lWeights = wWeights;

    addTeamKills(winner, wKills, wWeights);
    addTeamKills(loser, lKills, lWeights);

    // アシスト：1Kにつき最大1A（破綻防止）
    const wAssists = randInt(0, wKills);
    const lAssists = randInt(0, lKills);
    winner.ap += wAssists;
    loser.ap  += lAssists;
  }

  function addTeamKills(team, kills, weights){
    team.kp += kills;
    if(!Array.isArray(team.members)) return;

    for(let i=0;i<kills;i++){
      const idx = weightedPick(team.members.map(m => weights[m.role] || 1));
      const m = team.members[idx];
      if(!m.kills) m.kills = 0;
      m.kills += 1;
    }
  }

  /* =========================
     HELPERS
  ========================== */
  function weightedPick(weights){
    const sum = weights.reduce((a,b)=>a+b,0);
    let r = Math.random() * sum;
    for(let i=0;i<weights.length;i++){
      r -= weights[i];
      if(r <= 0) return i;
    }
    return weights.length - 1;
  }

  function randInt(a,b){
    return Math.floor(Math.random()*(b-a+1))+a;
  }

  function clamp(v,min,max){
    return Math.max(min, Math.min(max, v));
  }

  function step(message, bg){
    return {
      message: String(message ?? ''),
      bg: bg || null,
      bgAnim: false
    };
  }

})();
