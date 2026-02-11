'use strict';

/*
  sim_tournament_flow.js v3（フル）
  ✅「試合最新版.txt」準拠：ローカル大会（単一進行）
  - 20チーム（プレイヤー1 + CPU19）
  - CPU min-max抽選：大会開始時に team.power を確定（data_cpu_teams.js の basePower/min-max を使用）
  - R1〜R6：交戦枠固定（R1-4:4 / R5:2 / R6:1）
  - R4/R5：プレイヤー戦 確率100%
  - ログ：プレイヤー視点のみ（関与した「イベント」「交戦」「結果」だけ）
  - プレイヤー全滅後：裏で高速処理（ログ追加なし）→優勝算出
  - ダウン概念なし（downs_total 一切なし）
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.sim = window.MOBBR.sim || {};

(function(){

  const K = {
    team: 'mobbr_team',
    playerTeam: 'mobbr_playerTeam'
  };

  // ===== DataCPU API 吸収 =====
  function getCpuTeams(){
    const d = window.DataCPU;
    if (!d) return [];
    if (typeof d.getAllTeams === 'function') return d.getAllTeams() || [];
    if (typeof d.getALLTeams === 'function') return d.getALLTeams() || [];
    if (Array.isArray(d.TEAMS)) return d.TEAMS;
    return [];
  }

  function shuffle(arr){
    const a = arr.slice();
    for (let i=a.length-1;i>0;i--){
      const j = (Math.random()*(i+1))|0;
      [a[i],a[j]]=[a[j],a[i]];
    }
    return a;
  }

  function clamp(n, lo, hi){
    const v = Number(n);
    if (!Number.isFinite(v)) return lo;
    return Math.max(lo, Math.min(hi, v));
  }

  // ===== プレイヤーチーム戦闘力（簡易）=====
  function clamp01to100(n){
    const v = Number(n);
    if (!Number.isFinite(v)) return 0;
    return Math.max(0, Math.min(100, v));
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

    return clamp(total, 1, 100);
  }

  function calcPlayerTeamPower(){
    try{
      const raw = localStorage.getItem(K.playerTeam);
      if (!raw) return 55;
      const t = JSON.parse(raw);
      if (!t || !Array.isArray(t.members) || t.members.length < 1) return 55;
      const members = t.members.slice(0,3);
      const vals = members.map(m => calcCharBasePower(m.stats || {}));
      const avg = vals.reduce((a,b)=>a+b,0) / vals.length;
      return Math.round(avg + 3);
    }catch{
      return 55;
    }
  }

  // ===== CPU min-max 抽選（data_cpu_teams.js: basePower / members powerMin/powerMax を利用）=====
  function rollCpuPower(cpuTeam){
    // 1) basePower があればそれをベース
    const base = Number.isFinite(Number(cpuTeam?.basePower)) ? Number(cpuTeam.basePower) : 55;

    // 2) members の powerMin/powerMax から倍率レンジを作る（無ければ ±8%）
    let minMult = 0.92;
    let maxMult = 1.08;

    if (cpuTeam && Array.isArray(cpuTeam.members) && cpuTeam.members.length){
      // 各メンバーの min/max を集計 → チームのぶれ幅に使う（やりすぎないよう弱め）
      const mins = cpuTeam.members.map(m => Number(m?.powerMin)).filter(v => Number.isFinite(v));
      const maxs = cpuTeam.members.map(m => Number(m?.powerMax)).filter(v => Number.isFinite(v));
      if (mins.length && maxs.length){
        const avgMin = mins.reduce((a,b)=>a+b,0)/mins.length; // 例: 60〜90
        const avgMax = maxs.reduce((a,b)=>a+b,0)/maxs.length;
        // だいたい basePower の周辺で揺れるように倍率化（雑な対応でOK、後で調整可）
        // basePower を中心に「±(avgMax-avgMin)の一部」だけ揺らす
        const span = clamp((avgMax - avgMin) / 100, 0.06, 0.18); // 6%〜18%
        minMult = 1 - span*0.55;
        maxMult = 1 + span*0.55;
      }
    }

    const r = minMult + Math.random() * (maxMult - minMult);
    return clamp(Math.round(base * r), 1, 100);
  }

  // ===== ラウンドごとの交戦枠 =====
  function battleSlots(round){
    if (round <= 4) return 4;
    if (round === 5) return 2;
    return 1; // R6
  }

  // ===== State =====
  let state = null;

  function pushPlayerLog3(l1, l2, l3, icon){
    if (!state) return;
    if (!state.logs) state.logs = [];
    state.logs.push({
      l1: String(l1 || ''),
      l2: String(l2 || ''),
      l3: String(l3 || ''),
      icon: icon ? String(icon) : ''
    });
    if (state.logs.length > 80) state.logs = state.logs.slice(-80);
  }

  function aliveTeams(){
    return (state?.teams || []).filter(t => !t.eliminated);
  }

  function getPlayer(){
    return (state?.teams || []).find(t => t.isPlayer) || null;
  }

  function computeCtx(){
    const player = getPlayer();
    const coachFlags = window.MOBBR?.sim?.matchFlow?.getPlayerCoachFlags
      ? window.MOBBR.sim.matchFlow.getPlayerCoachFlags()
      : {};
    return { player, playerCoach: coachFlags };
  }

  function ensureTeamRuntimeShape(team){
    if (!team) return;
    if (!Number.isFinite(Number(team.power))) team.power = 55;
    if (!Number.isFinite(Number(team.alive))) team.alive = 3;
    if (team.alive < 0) team.alive = 0;
    if (team.eliminated !== true) team.eliminated = false;
    if (!Number.isFinite(Number(team.treasure))) team.treasure = 0;
    if (!Number.isFinite(Number(team.flag))) team.flag = 0;
    if (!team.eventBuffs || typeof team.eventBuffs !== 'object'){
      team.eventBuffs = { aim:0, mental:0, agi:0 };
    }else{
      if (!Number.isFinite(team.eventBuffs.aim)) team.eventBuffs.aim = 0;
      if (!Number.isFinite(team.eventBuffs.mental)) team.eventBuffs.mental = 0;
      if (!Number.isFinite(team.eventBuffs.agi)) team.eventBuffs.agi = 0;
    }
  }

  // ===== マッチ組み（枠固定 + R4/R5プレイヤー確定参戦）=====
  function buildMatchesForRound(round){
    const alive = aliveTeams();
    const slots = battleSlots(round);

    const matches = [];
    const used = new Set();

    const player = getPlayer();
    const mustPlayer = (round === 4 || round === 5);

    function pickOpponent(excludeId){
      const pool = alive.filter(t => !used.has(t.id) && t.id !== excludeId);
      if (pool.length === 0) return null;
      return pool[(Math.random()*pool.length)|0];
    }

    if (player && !player.eliminated && mustPlayer){
      used.add(player.id);
      const opp = pickOpponent(player.id);
      if (opp){
        used.add(opp.id);
        matches.push([player, opp]);
      }
    }

    while (matches.length < slots){
      const pool = alive.filter(t => !used.has(t.id));
      if (pool.length < 2) break;

      const a = pool[(Math.random()*pool.length)|0];
      used.add(a.id);
      const b = pickOpponent(a.id);
      if (!b){
        used.delete(a.id);
        break;
      }
      used.add(b.id);
      matches.push([a,b]);
    }

    return matches;
  }

  // ===== そのラウンドの「イベント対象数」 =====
  function eventCountByRound(round){
    // 仕様の「テンポ優先」で固定（調整しやすい）
    if (round <= 2) return 2;
    if (round <= 4) return 1;
    return 1;
  }

  // ===== 1ラウンド進行（イベント→交戦）=====
  function stepRound(){
    const round = state.round;
    state.phase = 'battle';

    const ctx = computeCtx();
    const matches = buildMatchesForRound(round);

    state.bannerLeft = `ROUND ${round}`;
    state.bannerRight = `交戦：${matches.length}枠`;

    const player = ctx.player;

    // このラウンドのイベント（生存チームから抽選）
    const alive = aliveTeams();
    const evN = Math.min(eventCountByRound(round), alive.length);
    for (let i=0; i<evN; i++){
      const target = alive[(Math.random()*alive.length)|0];
      ensureTeamRuntimeShape(target);

      const ev = window.MOBBR?.sim?.matchEvents?.rollForTeam
        ? window.MOBBR.sim.matchEvents.rollForTeam(target, round, ctx)
        : null;

      // ✅ ログはプレイヤー視点のみ
      if (player && target.id === player.id && ev){
        pushPlayerLog3(ev.log1, ev.log2, ev.log3, ev.icon);
      }
    }

    // 交戦解決（matchFlow.resolveBattle）
    for (const [A,B] of matches){
      ensureTeamRuntimeShape(A);
      ensureTeamRuntimeShape(B);

      const res = window.MOBBR?.sim?.matchFlow?.resolveBattle
        ? window.MOBBR.sim.matchFlow.resolveBattle(A, B, round, ctx)
        : null;

      if (!res) continue;

      // ✅ プレイヤー関与ログのみ（3段固定に揃える）
      if (player && (A.id === player.id || B.id === player.id)){
        const me = (A.id === player.id) ? A : B;
        const foe = (A.id === player.id) ? B : A;

        const iWon = (res.winnerId === me.id);
        if (iWon){
          pushPlayerLog3(
            '交戦結果！',
            'ファイト勝利！',
            `相手：${foe.name} / 自軍生存${me.alive}`,
            'battle.png'
          );
        }else{
          pushPlayerLog3(
            '交戦結果！',
            'ファイト敗北…',
            `相手：${foe.name} / 自軍生存${me.alive}`,
            'battle.png'
          );
        }

        if (me.eliminated){
          pushPlayerLog3('全滅…', 'プレイヤー脱落', 'ここから先は自動で高速処理します', '');
        }
      }
    }

    // 次ラウンドへ
    state.round += 1;

    if (state.round >= 7){
      state.round = 6;
      state.phase = 'result';
      decideChampion();
      return;
    }

    const playerNow = getPlayer();
    if (playerNow && playerNow.eliminated){
      fastForwardToEnd();
      return;
    }

    state.phase = 'ready';
    state.log1 = `ROUND ${round} 終了`;
    state.log2 = '';
    state.log3 = '次へで進行';
  }

  // ===== 優勝決定（ダウン無し）=====
  function decideChampion(){
    const alive = aliveTeams();
    let champ = null;

    if (alive.length === 1){
      champ = alive[0];
    }else if (alive.length > 1){
      // 優先：生存人数（基本は同じ=1想定）→ treasure+flag → power → 名前
      const s = alive.slice().sort((a,b)=>{
        const aa = a.alive || 0;
        const bb = b.alive || 0;
        if (bb !== aa) return bb - aa;

        const aScore = (a.treasure||0) + (a.flag||0);
        const bScore = (b.treasure||0) + (b.flag||0);
        if (bScore !== aScore) return bScore - aScore;

        const ap = a.power || 0;
        const bp = b.power || 0;
        if (bp !== ap) return bp - ap;

        return String(a.name||'').localeCompare(String(b.name||''), 'ja');
      });
      champ = s[0];
    }else{
      // 全滅のみの異常時：power→名前
      const all = (state.teams || []).slice().sort((a,b)=>{
        const ap = a.power || 0;
        const bp = b.power || 0;
        if (bp !== ap) return bp - ap;
        return String(a.name||'').localeCompare(String(b.name||''), 'ja');
      });
      champ = all[0] || null;
    }

    state.champion = champ ? { id: champ.id, name: champ.name } : null;

    // 結果は必ずログに残す（プレイヤー視点）
    pushPlayerLog3('試合終了！', 'RESULT', `チャンピオン：${state.champion?.name || '不明'}`, 'winner.png');

    state.bannerLeft = 'RESULT';
    state.bannerRight = '';
    state.log1 = '結果';
    state.log2 = '';
    state.log3 = `チャンピオン：${state.champion?.name || '不明'}`;
  }

  function fastForwardToEnd(){
    while (state.round < 7){
      const round = state.round;
      const matches = buildMatchesForRound(round);
      const ctx = computeCtx();

      // イベント（ログ無し）
      const alive = aliveTeams();
      const evN = Math.min(eventCountByRound(round), alive.length);
      for (let i=0; i<evN; i++){
        const target = alive[(Math.random()*alive.length)|0];
        ensureTeamRuntimeShape(target);
        if (window.MOBBR?.sim?.matchEvents?.rollForTeam){
          window.MOBBR.sim.matchEvents.rollForTeam(target, round, ctx);
        }
      }

      // バトル
      for (const [A,B] of matches){
        ensureTeamRuntimeShape(A);
        ensureTeamRuntimeShape(B);
        if (window.MOBBR?.sim?.matchFlow?.resolveBattle){
          window.MOBBR.sim.matchFlow.resolveBattle(A, B, round, ctx);
        }
      }

      state.round += 1;
    }

    state.round = 6;
    state.phase = 'result';
    decideChampion();
  }

  // ===== 開始（ローカル大会）=====
  function startLocalTournament(){
    const cpuRaw = getCpuTeams();
    const cpu19 = shuffle(cpuRaw).slice(0, 19);

    const playerName = localStorage.getItem(K.team) || 'PLAYER TEAM';
    const playerPower = calcPlayerTeamPower();

    const teams = [];

    const player = {
      id: 'PLAYER',
      name: playerName,
      isPlayer: true,
      alive: 3,
      eliminated: false,
      treasure: 0,
      flag: 0,
      power: playerPower,
      eventBuffs: { aim:0, mental:0, agi:0 }
    };
    teams.push(player);

    cpu19.forEach((c, i)=>{
      const id = c.teamId || c.id || `CPU_${i+1}`;
      const nm = c.name || c.teamName || id;

      const power = rollCpuPower(c);

      teams.push({
        id,
        name: nm,
        isPlayer: false,
        alive: 3,
        eliminated: false,
        treasure: 0,
        flag: 0,
        power,
        eventBuffs: { aim:0, mental:0, agi:0 }
      });
    });

    state = {
      mode: 'local',
      round: 1,
      phase: 'ready',
      teams,
      logs: [],
      bannerLeft: 'ローカル大会',
      bannerRight: '20チーム',
      log1: '大会開始',
      log2: '',
      log3: '次へでR1開始'
    };

    pushPlayerLog3('大会開始', 'PLAYER', `戦闘力：${player.power}`, '');

    if (window.MOBBR?.ui?.tournament?.open) window.MOBBR.ui.tournament.open();
    if (window.MOBBR?.ui?.tournament?.render) window.MOBBR.ui.tournament.render();
  }

  // ===== 進行（UIの「次へ」から呼ぶ）=====
  function step(){
    if (!state) return;

    if (state.phase === 'result'){
      state.log1 = '結果';
      state.log2 = '';
      state.log3 = `チャンピオン：${state.champion?.name || '不明'}`;
      return;
    }

    if (state.phase === 'ready'){
      stepRound();
      return;
    }

    state.phase = 'ready';
    state.log1 = `ROUND ${state.round} 準備`;
    state.log2 = '';
    state.log3 = '次へで進行';
  }

  function getState(){ return state; }

  window.MOBBR.sim.tournamentFlow = {
    startLocalTournament,
    step,
    getState
  };

})();
