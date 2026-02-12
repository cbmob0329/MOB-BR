'use strict';

/*
  sim_match_flow.js v3（フル）
  ✅「試合最新版.txt」運用向け（大会側から呼ばれる “交戦解決エンジン” ）
  - resolveBattle(teamA, teamB, round, ctx)
  - 敗者は必ず全滅（eliminated=true / alive=0）
  - eventBuffs（aim/mental/agi の%加算）を勝率に反映
  - キル/アシスト（個人配分）を裏で集計（Assist ≤ Kill保証）
  - downs_total は内部のみ（タイブレーク用）※表示しない
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

    if (!Number.isFinite(Number(t.kills_total))) t.kills_total = 0;
    if (!Number.isFinite(Number(t.assists_total))) t.assists_total = 0;
    if (!Number.isFinite(Number(t.downs_total))) t.downs_total = 0;

    if (!Number.isFinite(Number(t.treasure))) t.treasure = 0;
    if (!Number.isFinite(Number(t.flag))) t.flag = 0;

    if (!t.eventBuffs || typeof t.eventBuffs !== 'object'){
      t.eventBuffs = { aim:0, mental:0, agi:0 };
    }else{
      if (!Number.isFinite(Number(t.eventBuffs.aim))) t.eventBuffs.aim = 0;
      if (!Number.isFinite(Number(t.eventBuffs.mental))) t.eventBuffs.mental = 0;
      if (!Number.isFinite(Number(t.eventBuffs.agi))) t.eventBuffs.agi = 0;
    }

    if (!Array.isArray(t.members)) t.members = [];
    // members: [{role,name,kills,assists}, ...] 3人前提。無ければ作る（バグ回避）
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
    }else{
      for (let i=0;i<t.members.length;i++){
        const m = t.members[i] || (t.members[i]={});
        if (!m.role) m.role = (i===0?'IGL':(i===1?'ATTACKER':'SUPPORT'));
        if (!m.name) m.name = `${t.id || 'TEAM'}_${m.role}`;
        if (!Number.isFinite(Number(m.kills))) m.kills = 0;
        if (!Number.isFinite(Number(m.assists))) m.assists = 0;
      }
    }

    if (t.eliminated !== true) t.eliminated = false;
  }

  // eventBuffs（%加算）→ 乗算係数へ（暴れないよう弱め）
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

  // 勝率式（仕様の「差×1.8 / clamp(22..78)」に合わせる）
  function computeWinRateA(powerA, powerB){
    const diff = powerA - powerB;
    let pct = 50 + diff * 1.8;           // 22..78 にクランプ
    pct = clamp(pct, 22, 78);
    return pct / 100;
  }

  // 役割重み：ATT 50 / IGL 30 / SUP 20
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

    // 1キルにつき最大1アシスト（Assist ≤ Kill保証）
    // なるべく別メンバーに付くようにする
    if (team.members.length >= 2){
      const assistChance = 0.70;
      if (Math.random() < assistChance){
        let j = pickMemberIndexByWeight(team);
        if (j === idx) j = (j + 1) % team.members.length;
        const a = team.members[j];
        a.assists += 1;
        team.assists_total += 1;
      }
    }
  }

  function rollTeamKillsForBattle(winner, loser, round, diff){
    // winner: 0〜3 / loser: 0〜2
    // diffが大きいほどwinnerのキルが寄る（内部のみ）
    const r = clamp(round, 1, 6);

    // winner kills
    let wKills = 0;
    const wBias = clamp(diff / 35, -1, 1); // -1..1
    // 基本：Rが上がるほど少し増える
    const baseW = (r <= 2) ? 1.1 : (r <= 4 ? 1.3 : 1.5);

    // 0〜3 の分布を作る
    const rw = Math.random();
    let p0 = clamp(0.25 - 0.08*wBias, 0.10, 0.45);
    let p3 = clamp(0.12 + 0.10*wBias, 0.03, 0.28);
    let p2 = clamp(0.28 + 0.08*wBias, 0.10, 0.45);
    let p1 = 1 - (p0+p2+p3);
    if (p1 < 0.05){
      // 破綻防止：p1を確保して残りを正規化
      const rest = p0+p2+p3;
      p1 = 0.05;
      const k = (1-p1)/Math.max(1e-6, rest);
      p0*=k; p2*=k; p3*=k;
    }

    if (rw < p0) wKills = 0;
    else if (rw < p0 + p1) wKills = 1;
    else if (rw < p0 + p1 + p2) wKills = 2;
    else wKills = 3;

    // 少しラウンド補正（終盤はキルが出やすい）
    if (Math.random() < (baseW - 1.0) * 0.20){
      wKills = clamp(wKills + 1, 0, 3);
    }

    // loser kills
    let lKills = 0;
    const rl = Math.random();
    // diffで負け側は減る
    const lBias = clamp(diff / 40, -1, 1);
    let lp0 = clamp(0.55 + 0.15*lBias, 0.30, 0.85); // diff>0ならlp0増える
    let lp2 = clamp(0.08 - 0.06*lBias, 0.00, 0.15);
    let lp1 = 1 - (lp0 + lp2);
    if (lp1 < 0.05){
      const rest = lp0 + lp2;
      lp1 = 0.05;
      const k = (1-lp1)/Math.max(1e-6, rest);
      lp0*=k; lp2*=k;
    }

    if (rl < lp0) lKills = 0;
    else if (rl < lp0 + lp1) lKills = 1;
    else lKills = 2;

    return { wKills, lKills };
  }

  function resetMatchBuffs(team){
    if (window.MOBBR?.sim?.matchEvents?.resetTeamMatchState){
      window.MOBBR.sim.matchEvents.resetTeamMatchState(team);
      return;
    }
    team.eventBuffs = { aim:0, mental:0, agi:0 };
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

    // ====== downs_total（内部のみ。表示しない。バグりにくい最小構造）
    // 敗者は必ず全滅＝3ダウン扱い、勝者は0〜2の軽傷
    const r = clamp(round, 1, 6);
    let winDowns = 0;
    const w1 = (r <= 2) ? 0.20 : (r <= 4 ? 0.28 : 0.35);
    const w2 = (r <= 2) ? 0.05 : (r <= 4 ? 0.08 : 0.12);
    const x = Math.random();
    if (x < w2) winDowns = 2;
    else if (x < w2 + w1) winDowns = 1;

    winner.downs_total += winDowns;
    loser.downs_total  += 3;

    // ====== キル/アシスト（裏集計）
    const diff = (aWin ? (pA - pB) : (pB - pA));
    const ka = rollTeamKillsForBattle(winner, loser, r, diff);

    for (let i=0;i<ka.wKills;i++) addKill(winner);
    for (let i=0;i<ka.lKills;i++) addKill(loser);

    // ====== 結果：敗者は必ず全滅
    loser.alive = 0;
    loser.eliminated = true;

    // 勝者は生存維持（人数は減らさない：ラウンドの生存推移を絶対崩さない）
    winner.alive = clamp(winner.alive, 1, 3);
    winner.eliminated = false;

    // ====== バフは両チームリセット（試合中のみ）
    resetMatchBuffs(teamA);
    resetMatchBuffs(teamB);

    return {
      winnerId: winner.id,
      loserId: loser.id,
      // UIが使うなら残す（数値は表示しない運用）
      winDrop: 0,
      loseDrop: 3,
      // 裏検証用
      winnerKills: ka.wKills,
      loserKills: ka.lKills
    };
  }

  // コーチスキルのフラグ口（score_mindなど）
  function getPlayerCoachFlags(){
    // tournament_core.computeCtx() が参照する口
    // 現状はUI側で「選択したスキル」からフラグ化して返したいが、
    // ここは最小で空にしておき、必要になったらui/flow側で差し替える。
    return {};
  }

  window.MOBBR.sim.matchFlow = {
    resolveBattle,
    getPlayerCoachFlags
  };

})();
