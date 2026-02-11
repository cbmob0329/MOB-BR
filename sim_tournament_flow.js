'use strict';

/*
  sim_tournament_flow.js v3（フル）
  ローカル大会（単体）
  - 20チーム（プレイヤー1 + CPU19）
  - CPUは大会開始時に team.power を確定（min-max抽選：既存データ構造に柔軟対応）
  - R1〜R6：交戦枠固定（R1-4:4 / R5:2 / R6:1）
  - イベント回数：R1=1 / R2-5=2 / R6=0（同ラウンド重複なし）
  - ログ：プレイヤー視点のみ（プレイヤーに関与したイベント/交戦/結果だけ）
  - プレイヤー全滅後：裏で高速処理（ログ追加なし）→優勝算出
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.sim = window.MOBBR.sim || {};

(function(){

  const K = {
    company: 'mobbr_company',
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

  function clamp01to100(n){
    const v = Number(n);
    if (!Number.isFinite(v)) return 0;
    return Math.max(0, Math.min(100, v));
  }

  // ===== プレイヤーチーム戦闘力（ui_team の重みを簡易再現）=====
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
      return Math.round(avg + 3); // ui_team と同じ「+3」寄せ
    }catch{
      return 55;
    }
  }

  // ===== CPU power 抽選（既存データ構造に柔軟対応）=====
  // 1) もし members があり、各メンバーに min/max がある → 3人抽選平均
  // 2) それ以外 → teamPower/power を base とし、min/max を倍率 or 絶対値として抽選
  function rollCpuPower(cpuTeam){
    // members抽選（推奨：最新仕様寄り）
    const mems = Array.isArray(cpuTeam?.members) ? cpuTeam.members : null;
    if (mems && mems.length){
      const baseTeam = clamp01to100(cpuTeam.teamPower || cpuTeam.power || 55);

      // 「総合力が高いほど安定」＝ブレを縮める（高いほど中心寄り）
      // 0..1（高いほど安定）
      const stability = Math.max(0, Math.min(1, baseTeam / 100));

      const picked = mems.slice(0,3).map(m=>{
        const lo = Number(m.min ?? m.minPower ?? m.powerMin ?? 0);
        const hi = Number(m.max ?? m.maxPower ?? m.powerMax ?? 100);
        const minV = Math.min(lo, hi);
        const maxV = Math.max(lo, hi);

        // 安定度で乱数を中心に寄せる
        // stability=1 だとブレを 35% まで圧縮
        const r0 = Math.random();               // 0..1
        const centered = 0.5 + (r0 - 0.5) * (1 - stability * 0.65);
        const v = minV + centered * (maxV - minV);
        return clamp01to100(v);
      });

      const avg = picked.reduce((a,b)=>a+b,0) / picked.length;
      return Math.round(avg);
    }

    // 旧式：teamPower + min/max（倍率っぽい/絶対値っぽい）対応
    const base = Number(cpuTeam.teamPower || cpuTeam.power || 55);
    const min = Number(cpuTeam.min || cpuTeam.minPower || cpuTeam.powerMin || 0.92);
    const max = Number(cpuTeam.max || cpuTeam.maxPower || cpuTeam.powerMax || 1.08);

    const isMult = (min > 0 && min < 2.5 && max > 0 && max < 2.5);
    if (isMult){
      const r = min + Math.random() * (max - min);
      return Math.round(base * r);
    }

    const lo = Math.min(min, max);
    const hi = Math.max(min, max);
    const v = lo + Math.random() * (hi - lo);
    return Math.round(v);
  }

  // ===== ラウンドごとの交戦枠 =====
  function battleSlots(round){
    if (round <= 4) return 4;
    if (round === 5) return 2;
    return 1; // R6
  }

  // ===== イベント回数（最新版準拠）=====
  function eventCount(round){
    if (round === 1) return 1;
    if (round >= 2 && round <= 5) return 2;
    return 0; // R6
  }

  // ===== State =====
  let state = null;

  function pushPlayerLog(main, sub){
    if (!state) return;
    if (!state.logs) state.logs = [];
    state.logs.push({ main: String(main||''), sub: String(sub||'') });
    if (state.logs.length > 60) state.logs = state.logs.slice(-60);
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
      : null;
    return { player, playerCoach: coachFlags };
  }

  function ensureTeamShape(team){
    if (!team) return;
    if (!Number.isFinite(Number(team.power))) team.power = 55;
    if (!Number.isFinite(Number(team.alive))) team.alive = 3;
    if (team.alive < 0) team.alive = 0;
    if (team.eliminated !== true) team.eliminated = false;

    // matchEvents v2 で使う eventBuffs
    if (!team.eventBuffs || typeof team.eventBuffs !== 'object'){
      team.eventBuffs = { aim:0, mental:0, agi:0 };
    }else{
      if (!Number.isFinite(team.eventBuffs.aim)) team.eventBuffs.aim = 0;
      if (!Number.isFinite(team.eventBuffs.mental)) team.eventBuffs.mental = 0;
      if (!Number.isFinite(team.eventBuffs.agi)) team.eventBuffs.agi = 0;
    }

    if (!Number.isFinite(Number(team.treasure))) team.treasure = 0;
    if (!Number.isFinite(Number(team.flag))) team.flag = 0;
  }

  // ===== マッチ組み（枠固定）=====
  function buildMatchesForRound(round){
    const alive = aliveTeams();
    const slots = battleSlots(round);

    const matches = [];
    const used = new Set();

    // ※「プレイヤー戦は確率で寄せる」仕様が来ているが、
    // areaId 周りがまだ tournamentFlow に入っていないため、現段階は
    // R4〜R6 は必ずプレイヤー参戦、それ以外はランダムで参戦させるだけにする。
    const player = getPlayer();
    const pTable = { 1:0.60, 2:0.70, 3:0.75, 4:1.00, 5:1.00, 6:1.00 };
    const wantPlayer = !!(player && !player.eliminated && (Math.random() < (pTable[round] ?? 0)));

    function pickOpponent(excludeId){
      const pool = alive.filter(t => !used.has(t.id) && t.id !== excludeId);
      if (pool.length === 0) return null;
      return pool[(Math.random()*pool.length)|0];
    }

    if (wantPlayer){
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

  // ===== イベント（R別回数 / 同ラウンド重複なし）=====
  function runRoundEvents(round, ctx){
    const cnt = eventCount(round);
    if (cnt <= 0) return;

    const me = ctx.player;
    const usedIds = new Set();

    for (let i=0;i<cnt;i++){
      const alive = aliveTeams();
      if (!alive.length) break;

      // 対象チーム：eliminated=false のみ（aliveTeamsが既にそう）
      const target = alive[(Math.random()*alive.length)|0];
      ensureTeamShape(target);

      // 同ラウンド重複なし：同じイベントIDが出たら引き直し（最大20回）
      let ev = null;
      if (window.MOBBR?.sim?.matchEvents?.rollForTeam){
        for (let k=0;k<20;k++){
          const tmp = window.MOBBR.sim.matchEvents.rollForTeam(target, round, ctx);
          if (!tmp) break;
          if (!usedIds.has(tmp.id)){
            ev = tmp;
            usedIds.add(tmp.id);
            break;
          }
        }
      }

      // ログはプレイヤー視点：プレイヤーに当たった時だけ出す
      if (ev && me && target.id === me.id){
        // UI側が2行なので、2行に圧縮（数値は出さない）
        pushPlayerLog(ev.log1, `${ev.log2}：${ev.log3}`);
      }
    }
  }

  // ===== 優勝決定（簡易：最後の生存）=====
  function decideChampion(){
    const alive = aliveTeams();
    let champ = null;

    if (alive.length === 1){
      champ = alive[0];
    }else if (alive.length > 1){
      // 想定外保険：生存>0優先→名前
      const s = alive.slice().sort((a,b)=>{
        const aa = a.alive || 0;
        const bb = b.alive || 0;
        if (bb !== aa) return bb - aa;
        return String(a.name||'').localeCompare(String(b.name||''), 'ja');
      });
      champ = s[0];
    }else{
      champ = null;
    }

    state.champion = champ ? { id: champ.id, name: champ.name } : null;

    pushPlayerLog('試合終了！', `チャンピオン：${state.champion?.name || '不明'}`);
    state.bannerLeft = 'RESULT';
    state.bannerRight = '';
    state.logMain = '結果';
    state.logSub = `チャンピオン：${state.champion?.name || '不明'}`;
  }

  // ===== 1ラウンド進行（イベント→交戦）=====
  function stepRound(){
    const round = state.round;
    state.phase = 'battle';

    const ctx = computeCtx();
    const player = ctx.player;

    state.bannerLeft = `ROUND ${round}`;
    state.bannerRight = `交戦：${battleSlots(round)}枠`;

    // 1) イベント（R別回数）
    runRoundEvents(round, ctx);

    // 2) 交戦（枠固定）
    const matches = buildMatchesForRound(round);

    for (const [A,B] of matches){
      ensureTeamShape(A);
      ensureTeamShape(B);

      const res = window.MOBBR?.sim?.matchFlow?.resolveBattle
        ? window.MOBBR.sim.matchFlow.resolveBattle(A, B, round, ctx)
        : null;

      if (!res) continue;

      // プレイヤー関与ログのみ
      if (player && (A.id === player.id || B.id === player.id)){
        const me = (A.id === player.id) ? A : B;
        const foe = (A.id === player.id) ? B : A;

        const iWon = (res.winnerId === me.id);
        if (iWon){
          pushPlayerLog('ファイト勝利！', `相手：${foe.name} / 自軍生存${me.alive}`);
        }else{
          pushPlayerLog('ファイト敗北…', `相手：${foe.name} / 自軍生存${me.alive}`);
        }

        if (me.eliminated){
          pushPlayerLog('全滅…', 'ここから先は自動で高速処理します');
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

    // プレイヤー全滅後：高速処理
    const playerNow = getPlayer();
    if (playerNow && playerNow.eliminated){
      fastForwardToEnd();
      return;
    }

    state.phase = 'ready';
    state.logMain = `ROUND ${round} 終了`;
    state.logSub = '次へで進行';
  }

  function fastForwardToEnd(){
    // プレイヤー全滅後：ログ追加なしで R6 まで回す
    while (state.round < 7){
      const round = state.round;
      const ctx = computeCtx();

      // イベント（内部反映のみ）
      const cnt = eventCount(round);
      if (cnt > 0 && window.MOBBR?.sim?.matchEvents?.rollForTeam){
        const usedIds = new Set();
        for (let i=0;i<cnt;i++){
          const alive = aliveTeams();
          if (!alive.length) break;
          const target = alive[(Math.random()*alive.length)|0];
          ensureTeamShape(target);

          for (let k=0;k<20;k++){
            const tmp = window.MOBBR.sim.matchEvents.rollForTeam(target, round, ctx);
            if (!tmp) break;
            if (!usedIds.has(tmp.id)){
              usedIds.add(tmp.id);
              break;
            }
          }
        }
      }

      // 交戦
      const matches = buildMatchesForRound(round);
      for (const [A,B] of matches){
        ensureTeamShape(A);
        ensureTeamShape(B);
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
      const nm = c.teamName || c.name || id;

      teams.push({
        id,
        name: nm,
        isPlayer: false,
        alive: 3,
        eliminated: false,
        treasure: 0,
        flag: 0,
        power: rollCpuPower(c),
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
      logMain: '大会開始',
      logSub: '次へでR1開始'
    };

    pushPlayerLog('大会開始', `戦闘力：${player.power}`);

    if (window.MOBBR?.ui?.tournament?.open) window.MOBBR.ui.tournament.open();
    if (window.MOBBR?.ui?.tournament?.render) window.MOBBR.ui.tournament.render();
  }

  // ===== 進行（UIの「次へ」から呼ぶ）=====
  function step(){
    if (!state) return;

    if (state.phase === 'result'){
      state.logMain = '結果';
      state.logSub = `チャンピオン：${state.champion?.name || '不明'}`;
      return;
    }

    if (state.phase === 'ready'){
      stepRound();
      return;
    }

    state.phase = 'ready';
    state.logMain = `ROUND ${state.round} 準備`;
    state.logSub = '次へで進行';
  }

  function getState(){
    return state;
  }

  window.MOBBR.sim.tournamentFlow = {
    startLocalTournament,
    step,
    getState
  };

})();
