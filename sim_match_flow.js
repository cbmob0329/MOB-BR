'use strict';

/*
  sim_match_flow.js v3.1（フル）
  v3完全維持 + 宝/旗抽選追加
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

  const WEIGHT = {
    aim: 0.25,
    mental: 0.15,
    agi: 0.10,
    tech: 0.10,
    support: 0.10,
    scan: 0.10,
    armor: 0.10,
    hp: 0.10
  };

  function clamp01to100(n){
    const v = Number(n);
    if (!Number.isFinite(v)) return 0;
    return Math.max(0, Math.min(100, v));
  }

  function calcCharBasePower(stats){
    const s = {
      hp: clamp01to100(stats?.hp),
      mental: clamp01to100(stats?.mental),
      aim: clamp01to100(stats?.aim),
      agi: clamp01to100(stats?.agi),
      tech: clamp01to100(stats?.tech),
      support: clamp01to100(stats?.support),
      scan: clamp01to100(stats?.scan),
      armor: clamp01to100(Number.isFinite(Number(stats?.armor)) ? stats.armor : 100)
    };

    let total = 0;
    total += s.aim * WEIGHT.aim;
    total += s.mental * WEIGHT.mental;
    total += s.agi * WEIGHT.agi;
    total += s.tech * WEIGHT.tech;
    total += s.support * WEIGHT.support;
    total += s.scan * WEIGHT.scan;
    total += s.armor * WEIGHT.armor;
    total += s.hp * WEIGHT.hp;

    return Math.max(0, Math.min(100, total));
  }

  function estimateTeamPowerFromMembers(t){
    try{
      const mem = Array.isArray(t?.members) ? t.members : [];
      if (!mem.length) return null;

      const vals = mem.slice(0,3).map(m=>{
        if (m?.stats) return calcCharBasePower(m.stats);
        return calcCharBasePower(m || {});
      }).filter(v=>Number.isFinite(v));

      if (!vals.length) return null;
      const avg = vals.reduce((a,b)=>a+b,0) / vals.length;
      return clamp(Math.round(avg + 3), 1, 100);
    }catch{
      return null;
    }
  }

  function ensureTeamShape(t){
    if (!t) return;

    if (!Number.isFinite(Number(t.power))){
      const isPlayer = (t.isPlayer === true) || (String(t.id||'') === 'PLAYER');
      if (isPlayer){
        const est = estimateTeamPowerFromMembers(t);
        if (Number.isFinite(est)) t.power = est;
      }
      if (!Number.isFinite(Number(t.power))) t.power = 55;
    }

    if (!Number.isFinite(Number(t.alive))) t.alive = 3;
    if (t.alive < 0) t.alive = 0;

    if (!Number.isFinite(Number(t.kills_total))) t.kills_total = 0;
    if (!Number.isFinite(Number(t.assists_total))) t.assists_total = 0;
    if (!Number.isFinite(Number(t.downs_total))) t.downs_total = 0;
    if (!Number.isFinite(Number(t.treasure))) t.treasure = 0;
    if (!Number.isFinite(Number(t.flag))) t.flag = 0;
    if (!Number.isFinite(Number(t.eliminatedRound))) t.eliminatedRound = 0;

    if (!t.eventBuffs || typeof t.eventBuffs !== 'object'){
      t.eventBuffs = { aim:0, mental:0, agi:0 };
    }

    if (!Array.isArray(t.members)) t.members = [];
    if (t.members.length < 3){
      const base = t.members.slice();
      const roles = ['IGL','ATTACKER','SUPPORT'];
      for (let i=base.length;i<3;i++){
        base.push({
          role: roles[i] || 'MEMBER',
          name: `${t.id || 'TEAM'}_${roles[i] || i+1}`,
          kills: 0,
          assists: 0
        });
      }
      t.members = base;
    }

    if (t.eliminated !== true) t.eliminated = false;
  }

  function buffMultiplierFromEventBuffs(t){
    const aim = clamp(t.eventBuffs?.aim ?? 0, -99, 99);
    const mental = clamp(t.eventBuffs?.mental ?? 0, -99, 99);
    const agi = clamp(t.eventBuffs?.agi ?? 0, -99, 99);

    const mAim = 1 + (aim / 100);
    const mMental = 1 + (mental / 120);
    const mAgi = 1 + (agi / 140);

    return clamp(mAim * mMental * mAgi, 0.70, 1.35);
  }

  function roundVariance(round){
    if (round <= 2) return 0.10;
    if (round <= 4) return 0.14;
    if (round === 5) return 0.18;
    return 0.20;
  }

  function computeFightPower(t, round){
    ensureTeamShape(t);
    const base = clamp(t.power, 1, 100);
    const evMult = buffMultiplierFromEventBuffs(t);
    const v = roundVariance(round);
    const rng = 1 + ((Math.random() * 2 - 1) * v);
    return base * evMult * rng;
  }

  function computeWinRateA(powerA, powerB){
    const diff = powerA - powerB;
    let pct = 50 + diff * 1.8;
    pct = clamp(pct, 22, 78);
    return pct / 100;
  }

  function memberWeight(role){
    const r = String(role||'').toUpperCase();
    if (r === 'ATTACKER') return 50;
    if (r === 'IGL') return 30;
    if (r === 'SUPPORT') return 20;
    return 20;
  }

  function pickMemberIndexByWeight(team){
    const mem = team.members || [];
    const w = mem.map(m=>memberWeight(m.role));
    const sum = w.reduce((a,b)=>a+b,0) || 1;
    let r = Math.random() * sum;
    for (let i=0;i<w.length;i++){
      r -= w[i];
      if (r <= 0) return i;
    }
    return mem.length ? (mem.length - 1) : 0;
  }

  function addKill(team){
    const idx = pickMemberIndexByWeight(team);
    const m = team.members[idx];
    m.kills += 1;
    team.kills_total += 1;

    if (team.members.length >= 2 && Math.random() < 0.70){
      let j = pickMemberIndexByWeight(team);
      if (j === idx) j = (j + 1) % team.members.length;
      const a = team.members[j];
      a.assists += 1;
      team.assists_total += 1;
    }
  }

  function rollLoserKills(round, diff){
    const rl = Math.random();
    if (rl < 0.55) return 0;
    if (rl < 0.90) return 1;
    return 2;
  }

  // ★追加：宝抽選
  function rollTreasureGain(team, round){
    const base = 0.10 + (round * 0.02);
    if (Math.random() < base){
      team.treasure += 1;
    }
  }

  // ★追加：旗抽選
  function rollFlagGain(team, round){
    if (round < 4) return;
    const base = (round === 5 ? 0.08 : 0.12);
    if (Math.random() < base){
      team.flag += 1;
    }
  }

  function resolveBattle(teamA, teamB, round, ctx){
    ensureTeamShape(teamA);
    ensureTeamShape(teamB);

    if (!isAlive(teamA) || !isAlive(teamB)) return null;

    const pA = computeFightPower(teamA, round);
    const pB = computeFightPower(teamB, round);

    const winA = computeWinRateA(pA, pB);
    const aWin = (Math.random() < winA);

    const winner = aWin ? teamA : teamB;
    const loser  = aWin ? teamB : teamA;

    for (let i=0;i<3;i++) addKill(winner);

    const diff = (aWin ? (pA - pB) : (pB - pA));
    const loserKills = rollLoserKills(round, diff);
    for (let i=0;i<loserKills;i++) addKill(loser);

    // ★宝旗追加
    rollTreasureGain(winner, round);
    rollTreasureGain(loser, round);
    rollFlagGain(winner, round);

    loser.alive = 0;
    loser.eliminated = true;
    loser.eliminatedRound = (round|0);

    winner.alive = clamp(winner.alive, 1, 3);
    winner.eliminated = false;

    return {
      winnerId: winner.id,
      loserId: loser.id,
      winnerKills: 3,
      loserKills: loserKills
    };
  }

  window.MOBBR.sim.matchFlow = {
    resolveBattle
  };

})();
