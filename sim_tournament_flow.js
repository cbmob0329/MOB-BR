'use strict';

/*
  sim_tournament_flow.js v3（フル）
  ローカル大会（1本）
  - 20チーム（プレイヤー1 + CPU19）
  - CPU min-max抽選：大会開始時に team.power を確定
  - R1〜R6：交戦枠固定（R1-4:4 / R5:2 / R6:1）
  - R4/R5：プレイヤー戦 確率100%（生存している限り必ず当てる）
  - ログ：プレイヤー視点のみ（関与したイベント/交戦/結果だけ）
  - プレイヤー全滅後：裏で高速処理（ログ追加なし）→優勝算出
  - ダウン概念なし（downs_total は一切使わない）
  - タイブレーク（複数生存時）：
      1) alive 多い
      2) treasure 多い
      3) flag 多い
      4) 名前（ja）
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

    return Math.max(1, Math.min(100, total));
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

  // ===== CPU power 抽選（data_cpu_teams.js は basePower を持つ）=====
  function rollCpuPower(cpuTeam){
    const base = Number(cpuTeam.basePower ?? cpuTeam.teamPower ?? cpuTeam.power ?? 55);

    // このプロジェクトでは min/max を持っていないので「軽い揺れ」を標準で入れる
    // （必要なら data_cpu_teams.js に powerMin/powerMax を追加してここを強化できる）
    const minMult = Number(cpuTeam.powerMinMult ?? 0.92);
    const maxMult = Number(cpuTeam.powerMaxMult ?? 1.08);

    const r = minMult + Math.random() * (maxMult - minMult);
    return Math.max(1, Math.min(100, Math.round(base * r)));
  }

  // ===== ラウンドごとの交戦枠 =====
  function battleSlots(round){
    if (round <= 4) return 4;
    if (round === 5) return 2;
    return 1;
  }

  // ===== State =====
  let state = null;

  function pushPlayerLog3(log1, log2, log3, icon){
    if (!state) return;
    if (!state.logs) state.logs = [];
    state.logs.push({
      log1: String(log1 || ''),
      log2: String(log2 || ''),
      log3: String(log3 || ''),
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

  // ===== マッチ組み（枠固定 + R4/R5プレイヤー確定）=====
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

  // ===== 1ラウンド進行（イベント→交戦）=====
  function stepRound(){
    const round = state.round;
    state.phase = 'battle';

    const ctx = computeCtx();
    const matches = buildMatchesForRound(round);

    state.bannerLeft = `ROUND ${round}`;
    state.bannerRight = `交戦：${matches.length}枠`;

    const player = ctx.player;

    for (const [A,B] of matches){
      // 1) イベント（最新版v2のAPI：rollForTeam）
      let evA = null;
      let evB = null;

      if (window.MOBBR?.sim?.matchEvents?.rollForTeam){
        evA = window.MOBBR.sim.matchEvents.rollForTeam(A, round, ctx);
        evB = window.MOBBR.sim.matchEvents.rollForTeam(B, round, ctx);
      }

      // ログ（プレイヤー関与のみ：3段固定）
      if (player && (A.id === player.id || B.id === player.id)){
        const mine = (A.id === player.id) ? evA : evB;
        if (mine){
          pushPlayerLog3(mine.log1, mine.log2, mine.log3, mine.icon);
        }
      }

      // 2) バトル解決（ダウン無し）
      const res = window.MOBBR?.sim?.matchFlow?.resolveBattle
        ? window.MOBBR.sim.matchFlow.resolveBattle(A, B, round, ctx)
        : null;

      if (!res) continue;

      if (player && (A.id === player.id || B.id === player.id)){
        const me = (A.id === player.id) ? A : B;
        const foe = (A.id === player.id) ? B : A;

        if (res.winnerId === me.id){
          pushPlayerLog3('ファイト勝利！', `相手：${foe.name}`, `相手生存${foe.alive} / 自軍生存${me.alive}`, '');
        }else{
          pushPlayerLog3('ファイト敗北…', `相手：${foe.name}`, `自軍生存${me.alive}`, '');
        }

        if (me.eliminated){
          pushPlayerLog3('全滅…', '', 'ここから先は自動で高速処理します', '');
        }
      }
    }

    // 次へ
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

  // ===== 優勝決定（downs無し）=====
  function decideChampion(){
    const alive = aliveTeams();

    let champ = null;
    if (alive.length === 1){
      champ = alive[0];
    }else{
      const all = (alive.length ? alive : (state.teams || [])).slice();
      all.sort((a,b)=>{
        const aa = a.eliminated ? -999 : (a.alive||0);
        const bb = b.eliminated ? -999 : (b.alive||0);
        if (bb !== aa) return bb - aa;

        const ta = a.treasure || 0;
        const tb = b.treasure || 0;
        if (tb !== ta) return tb - ta;

        const fa = a.flag || 0;
        const fb = b.flag || 0;
        if (fb !== fa) return fb - fa;

        return String(a.name||'').localeCompare(String(b.name||''), 'ja');
      });
      champ = all[0] || null;
    }

    state.champion = champ ? { id: champ.id, name: champ.name } : null;

    pushPlayerLog3('試合終了！', 'チャンピオン', `${state.champion?.name || '不明'}`, '');
    state.bannerLeft = 'RESULT';
    state.bannerRight = '';
    state.log1 = '結果';
    state.log2 = 'チャンピオン';
    state.log3 = `${state.champion?.name || '不明'}`;
  }

  function fastForwardToEnd(){
    while (state.round < 7){
      const round = state.round;
      const matches = buildMatchesForRound(round);
      const ctx = computeCtx();

      for (const [A,B] of matches){
        if (window.MOBBR?.sim?.matchEvents?.rollForTeam){
          window.MOBBR.sim.matchEvents.rollForTeam(A, round, ctx);
          window.MOBBR.sim.matchEvents.rollForTeam(B, round, ctx);
        }
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
      eventBuffs: { aim: 0, mental: 0, agi: 0 }
    };
    teams.push(player);

    cpu19.forEach((c, i)=>{
      const id = c.teamId || c.id || `CPU_${i+1}`;
      const nm = c.name || c.teamName || id;

      teams.push({
        id,
        name: nm,
        isPlayer: false,
        alive: 3,
        eliminated: false,
        treasure: 0,
        flag: 0,
        power: rollCpuPower(c),
        eventBuffs: { aim: 0, mental: 0, agi: 0 }
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

    pushPlayerLog3('大会開始', '', `戦闘力：${player.power}`, '');

    if (window.MOBBR?.ui?.tournament?.open) window.MOBBR.ui.tournament.open();
    if (window.MOBBR?.ui?.tournament?.render) window.MOBBR.ui.tournament.render();
  }

  // ===== 進行（UI「次へ」）=====
  function step(){
    if (!state) return;

    if (state.phase === 'result'){
      state.log1 = '結果';
      state.log2 = 'チャンピオン';
      state.log3 = `${state.champion?.name || '不明'}`;
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

  window.MOBBR.sim.tournamentFlow = { startLocalTournament, step, getState };

})();
