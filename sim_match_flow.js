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

  ★修正（今回）：
  - 「交戦勝利 = 必ず3キル」を保証（勝って0キル問題を潰す）
  - 敗者のキルは 0〜2 を抽選（敗北側もキルが出る）
  - ✅ H2H（head-to-head）勝敗を ctx.state.h2h に保存（順位ロジックに使う）
  - ✅ power 未設定のPLAYERは、members stats から推定計算して 55固定化を回避
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

  // ===== 推定power（PLAYERだけ55固定回避） =====
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

      // membersが stats を持つケース / 既に数値ステータスを持つケース両対応
      const vals = mem.slice(0,3).map(m=>{
        if (m?.stats) return calcCharBasePower(m.stats);
        // もし member 自体に hp/aim... を持つ形式でも拾う
        return calcCharBasePower(m || {});
      }).filter(v=>Number.isFinite(v));

      if (!vals.length) return null;
      const avg = vals.reduce((a,b)=>a+b,0) / vals.length;

      // ui_team.js と同じ +3 の補正（見た目の%と合わせる）
      return clamp(Math.round(avg + 3), 1, 100);
    }catch{
      return null;
    }
  }

  function ensureTeamShape(t, ctx){
    if (!t) return;

    // power
    if (!Number.isFinite(Number(t.power))){
      // ✅ PLAYERだけは members から推定して 55固定を避ける
      const isPlayer = (t.isPlayer === true) || (String(t.id||'') === 'PLAYER');
      if (isPlayer){
        const est = estimateTeamPowerFromMembers(t);
        if (Number.isFinite(est)) t.power = est;
      }
      if (!Number.isFinite(Number(t.power))) t.power = 55; // 最終保険
    }

    // alive
    if (!Number.isFinite(Number(t.alive))) t.alive = 3;
    if (t.alive < 0) t.alive = 0;

    // totals
    if (!Number.isFinite(Number(t.kills_total))) t.kills_total = 0;
    if (!Number.isFinite(Number(t.assists_total))) t.assists_total = 0;
    if (!Number.isFinite(Number(t.downs_total))) t.downs_total = 0;

    if (!Number.isFinite(Number(t.treasure))) t.treasure = 0;
    if (!Number.isFinite(Number(t.flag))) t.flag = 0;

    // eventBuffs
    if (!t.eventBuffs || typeof t.eventBuffs !== 'object'){
      t.eventBuffs = { aim:0, mental:0, agi:0 };
    }else{
      if (!Number.isFinite(Number(t.eventBuffs.aim))) t.eventBuffs.aim = 0;
      if (!Number.isFinite(Number(t.eventBuffs.mental))) t.eventBuffs.mental = 0;
      if (!Number.isFinite(Number(t.eventBuffs.agi))) t.eventBuffs.agi = 0;
    }

    // members
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

  // 敗者のキル抽選（0〜2）
  function rollLoserKills(round, diff){
    const r = clamp(round, 1, 6);

    // diffが大きいほど（勝者が強いほど）敗者キルが減る
    // diff>0 で「勝者が上」なので敗者は不利
    const bias = clamp(diff / 40, -1, 1);

    const rl = Math.random();
    let p0 = clamp(0.55 + 0.18*bias, 0.25, 0.90);
    let p2 = clamp(0.10 - 0.08*bias, 0.00, 0.18);
    let p1 = 1 - (p0 + p2);

    if (p1 < 0.05){
      const rest = p0 + p2;
      p1 = 0.05;
      const k = (1-p1)/Math.max(1e-6, rest);
      p0*=k; p2*=k;
    }

    let lk = 0;
    if (rl < p0) lk = 0;
    else if (rl < p0 + p1) lk = 1;
    else lk = 2;

    // 終盤は少しだけ撃ち合いが伸びることがある（敗者キルが1上振れ）
    if (r >= 4 && Math.random() < 0.08){
      lk = clamp(lk + 1, 0, 2);
    }

    return lk;
  }

  function resetMatchBuffs(team){
    if (window.MOBBR?.sim?.matchEvents?.resetTeamMatchState){
      window.MOBBR.sim.matchEvents.resetTeamMatchState(team);
      return;
    }
    team.eventBuffs = { aim:0, mental:0, agi:0 };
  }

  // ✅ H2H保存（state.h2h["WIN|LOSE"]=count）
  function recordH2H(ctx, winnerId, loserId){
    try{
      const st = ctx?.state || ctx?.tournamentState || null;
      if (!st) return;
      if (!st.h2h || typeof st.h2h !== 'object') st.h2h = {};
      const k = `${String(winnerId)}|${String(loserId)}`;
      st.h2h[k] = (Number(st.h2h[k])||0) + 1;
    }catch(e){}
  }

  function resolveBattle(teamA, teamB, round, ctx){
    ensureTeamShape(teamA, ctx);
    ensureTeamShape(teamB, ctx);

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
    // ✅勝者は必ず3キル（仕様保証）
    for (let i=0;i<3;i++) addKill(winner);

    // ✅敗者も0〜2キルを取り得る（撃ち合いのトレード表現）
    const diff = (aWin ? (pA - pB) : (pB - pA)); // 勝者−敗者 が正
    const loserKills = rollLoserKills(r, diff);
    for (let i=0;i<loserKills;i++) addKill(loser);

    // ====== 結果：敗者は必ず全滅
    loser.alive = 0;
    loser.eliminated = true;

    // 勝者は生存維持（人数は減らさない：ラウンドの生存推移を絶対崩さない）
    winner.alive = clamp(winner.alive, 1, 3);
    winner.eliminated = false;

    // ✅ H2H保存（順位ロジック用）
    recordH2H(ctx, winner.id, loser.id);

    // ====== バフは両チームリセット（試合中のみ）
    resetMatchBuffs(teamA);
    resetMatchBuffs(teamB);

    return {
      winnerId: winner.id,
      loserId: loser.id,
      winDrop: 0,
      loseDrop: 3,

      // 裏検証用（必要ならUIには出さない運用）
      winnerKills: 3,
      loserKills: loserKills
    };
  }

  // コーチスキルのフラグ口（score_mindなど）
  function getPlayerCoachFlags(){
    return {};
  }

  window.MOBBR.sim.matchFlow = {
    resolveBattle,
    getPlayerCoachFlags
  };

})();
