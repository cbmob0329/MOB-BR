'use strict';

/*
  sim_tournament_flow.js v2（フル）
  ローカル大会（A/B同時）
  - 20チーム（プレイヤー1 + CPU19）
  - CPU min-max抽選：大会開始時に team.power を確定
  - R1〜R6：交戦枠固定（R1-4:4 / R5:2 / R6:1）
  - R4/R5：プレイヤー戦確率100%
  - ログ：プレイヤー視点のみ（関与したイベント/交戦/結果だけ）
  - プレイヤー全滅後：裏で高速処理（ログ追加なし）→優勝算出
  - タイブレーク：downs_total
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

    // getAllTeams / getALLTeams の両対応
    if (typeof d.getAllTeams === 'function') return d.getAllTeams() || [];
    if (typeof d.getALLTeams === 'function') return d.getALLTeams() || [];

    // それ以外：TEAMS 配列があれば使う
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

  // ===== プレイヤーチーム戦闘力（ui_team の重みを簡易再現）=====
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
      // ui_team と同じ「+3」寄せ
      return Math.round(avg + 3);
    }catch{
      return 55;
    }
  }

  // ===== CPU min-max 抽選 =====
  function rollCpuPower(cpuTeam){
    // data_cpu_teams.js の項目に合わせて柔軟に
    const base = Number(cpuTeam.teamPower || cpuTeam.power || 55);
    const min = Number(cpuTeam.min || cpuTeam.minPower || cpuTeam.powerMin || 0.92);
    const max = Number(cpuTeam.max || cpuTeam.maxPower || cpuTeam.powerMax || 1.08);

    // min/max が 0.9〜1.1 の「倍率」っぽいなら倍率として扱う
    const isMult = (min > 0 && min < 2.5 && max > 0 && max < 2.5);
    if (isMult){
      const r = min + Math.random() * (max - min);
      return Math.round(base * r);
    }

    // そうじゃなければ「絶対値範囲」として扱う
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

  // ===== State =====
  let state = null;

  function pushPlayerLog(main, sub){
    if (!state) return;
    if (!state.logs) state.logs = [];
    state.logs.push({ main: String(main||''), sub: String(sub||'') });
    // ログを溜めすぎない（UI軽量）
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

  function ensureEventBuffShape(team){
    if (!team.eventBuff){
      team.eventBuff = { multPower: 1, addAim:0, addMental:0, addAgi:0 };
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
      // ランダム
      return pool[(Math.random()*pool.length)|0];
    }

    // 先にプレイヤー戦を確保（R4/R5）
    if (player && !player.eliminated && mustPlayer){
      used.add(player.id);
      const opp = pickOpponent(player.id);
      if (opp){
        used.add(opp.id);
        matches.push([player, opp]);
      }
    }

    // 残り枠を埋める
    while (matches.length < slots){
      const pool = alive.filter(t => !used.has(t.id));
      if (pool.length < 2) break;

      // 2チーム選ぶ
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

    // 表示用：このラウンドのプレイヤー関連ログだけ出す
    const player = ctx.player;

    // 交戦ごとにイベント→バトル
    for (const [A,B] of matches){
      ensureEventBuffShape(A);
      ensureEventBuffShape(B);

      // イベント
      const evs = window.MOBBR?.sim?.matchEvents?.rollForMatch
        ? window.MOBBR.sim.matchEvents.rollForMatch(A, B, round, ctx)
        : [];

      // ログ（プレイヤー関与のみ）
      if (player && (A.id === player.id || B.id === player.id)){
        if (evs && evs.length){
          const e = evs[0];
          pushPlayerLog('イベント発生！', e.text);
        }
      }

      // バトル解決
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
          pushPlayerLog('ファイト勝利！', `相手：${foe.name}（相手生存${foe.alive}）/ 自軍生存${me.alive}`);
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
      // R6の後に結果へ
      state.round = 6;
      state.phase = 'result';
      decideChampion();
    }else{
      // プレイヤーが全滅してたら高速処理で最後まで進める
      const playerNow = getPlayer();
      if (playerNow && playerNow.eliminated){
        fastForwardToEnd();
      }else{
        state.phase = 'ready';
        state.logMain = `ROUND ${round} 終了`;
        state.logSub = '次へで進行';
      }
    }
  }

  // ===== 優勝決定（downs_total タイブレーク）=====
  function decideChampion(){
    const alive = aliveTeams();
    let champ = null;

    if (alive.length === 1){
      champ = alive[0];
    }else if (alive.length > 1){
      // aliveが多い→downs_totalが少ない（タイブレーク）→名前
      const s = alive.slice().sort((a,b)=>{
        const aa = a.alive || 0;
        const bb = b.alive || 0;
        if (bb !== aa) return bb - aa;
        const da = a.downs_total || 0;
        const db = b.downs_total || 0;
        if (da !== db) return da - db; // downs少ない方が上
        return String(a.name||'').localeCompare(String(b.name||''), 'ja');
      });
      champ = s[0];
    }else{
      // 全滅だらけの異常時：downs少ない方
      const all = (state.teams || []).slice().sort((a,b)=>{
        const da = a.downs_total || 0;
        const db = b.downs_total || 0;
        if (da !== db) return da - db;
        return String(a.name||'').localeCompare(String(b.name||''), 'ja');
      });
      champ = all[0] || null;
    }

    state.champion = champ ? { id: champ.id, name: champ.name } : null;

    // ログはプレイヤー視点のみ：結果は出す
    pushPlayerLog('試合終了！', `チャンピオン：${state.champion?.name || '不明'}`);
    state.bannerLeft = 'RESULT';
    state.bannerRight = '';
    state.logMain = '結果';
    state.logSub = `チャンピオン：${state.champion?.name || '不明'}`;
  }

  function fastForwardToEnd(){
    // プレイヤー全滅後：ログ追加なしで R6 まで回す
    while (state.round < 7){
      const round = state.round;
      const matches = buildMatchesForRound(round);
      const ctx = computeCtx();

      for (const [A,B] of matches){
        ensureEventBuffShape(A);
        ensureEventBuffShape(B);

        // イベントは内部反映だけ（ログ無し）
        if (window.MOBBR?.sim?.matchEvents?.rollForMatch){
          window.MOBBR.sim.matchEvents.rollForMatch(A, B, round, ctx);
        }

        // バトル
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
    // CPU19
    const cpuRaw = getCpuTeams();
    const cpu19 = shuffle(cpuRaw).slice(0, 19);

    // プレイヤー
    const playerName = localStorage.getItem(K.team) || 'PLAYER TEAM';
    const playerPower = calcPlayerTeamPower();

    const teams = [];

    const player = {
      id: 'PLAYER',
      name: playerName,
      isPlayer: true,
      alive: 3,
      eliminated: false,
      downs_total: 0,
      treasure: 0,
      flag: 0,
      power: playerPower,
      eventBuff: { multPower: 1, addAim:0, addMental:0, addAgi:0 }
    };
    teams.push(player);

    // CPU
    cpu19.forEach((c, i)=>{
      const id = c.teamId || c.id || `CPU_${i+1}`;
      const nm = c.teamName || c.name || id;

      const power = rollCpuPower(c);

      teams.push({
        id,
        name: nm,
        isPlayer: false,
        alive: 3,
        eliminated: false,
        downs_total: 0,
        treasure: 0,
        flag: 0,
        power,
        eventBuff: { multPower: 1, addAim:0, addMental:0, addAgi:0 }
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

    // UI open
    if (window.MOBBR?.ui?.tournament?.open){
      window.MOBBR.ui.tournament.open();
    }
    if (window.MOBBR?.ui?.tournament?.render){
      window.MOBBR.ui.tournament.render();
    }
  }

  // ===== 進行（UIの「次へ」から呼ぶ）=====
  function step(){
    if (!state) return;

    // resultなら止める（将来：リザルト画面へ）
    if (state.phase === 'result'){
      state.logMain = '結果';
      state.logSub = `チャンピオン：${state.champion?.name || '不明'}`;
      return;
    }

    // ready → round実行
    if (state.phase === 'ready'){
      stepRound();
      return;
    }

    // battle後など → readyへ（見た目整理）
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
