'use strict';

/*
  sim_tournament_flow.js v4（フル）
  ローカル大会（単体）— 試合最新版.txt の骨格に合わせる
  - 20チーム（プレイヤー1 + CPU19）
  - CPU power：大会開始時に確定（既存データ構造に柔軟対応）
  - 降下：
      * 20チームをシャッフル
      * 先頭16チーム → Area1〜16へ1チームずつ（空きなし）
      * 残り4チーム → 1〜16から「被りArea」を4つ選び、各1チームずつ追加（=2チームエリアが4つ）
  - ラウンドの範囲（確定）：
      * R1-R2: Area1-16
      * R3: Area17-20
      * R4: Area21-22
      * R5: Area23-24
      * R6: Area25固定
  - 交戦枠（確定）：
      * R1: 4戦（被り4箇所で自動確定）
      * R2: 4戦
      * R3: 4戦
      * R4: 4戦
      * R5: 2戦
      * R6: 1戦（決勝）
  - プレイヤー戦（確率）：
      * R1: 被りなら100%（R1は被り戦のみ）
      * R2: 70%
      * R3: 75%
      * R4: 100%
      * R5: 100%
      * R6: 100%
  - イベント回数（確定）：R1=1 / R2-5=2（同ラウンド重複なし）/ R6=0
    ※イベントは matchEvents.rollForTeam(team, round, ctx) を使用（v2対応）
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

  // ===== Area master（名前/画像は今後 UI 用に拡張。ここは ID と範囲だけ固定）=====
  const ROUND_AREA = {
    1: { min: 1,  max: 16 },
    2: { min: 1,  max: 16 },
    3: { min: 17, max: 20 },
    4: { min: 21, max: 22 },
    5: { min: 23, max: 24 },
    6: { min: 25, max: 25 }
  };

  function roundAreaRange(round){
    return ROUND_AREA[round] || { min: 1, max: 16 };
  }

  function isAreaInRound(areaId, round){
    const r = roundAreaRange(round);
    return (areaId|0) >= r.min && (areaId|0) <= r.max;
  }

  function clamp(n, lo, hi){
    const v = Number(n);
    if (!Number.isFinite(v)) return lo;
    return Math.max(lo, Math.min(hi, v));
  }

  function randInt(lo, hi){
    lo = lo|0; hi = hi|0;
    if (hi < lo) [lo,hi] = [hi,lo];
    return lo + ((Math.random() * (hi - lo + 1))|0);
  }

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
    return clamp(n, 0, 100);
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
      return Math.round(avg + 3); // ui_team と同じ「+3」寄せ
    }catch{
      return 55;
    }
  }

  // ===== CPU power 抽選（柔軟対応）=====
  // 1) members があり、各メンバーに min/max（%）がある → 3人抽選平均（安定度＝teamPowerで中心寄り）
  // 2) それ以外 → teamPower/power を base とし、min/max を倍率 or 絶対値として抽選
  function rollCpuPower(cpuTeam){
    const mems = Array.isArray(cpuTeam?.members) ? cpuTeam.members : null;
    if (mems && mems.length){
      const baseTeam = clamp01to100(cpuTeam.teamPower || cpuTeam.power || 55);
      const stability = clamp(baseTeam / 100, 0, 1); // 高いほど中心寄り

      const picked = mems.slice(0,3).map(m=>{
        const lo = Number(m.min ?? m.minPower ?? m.powerMin ?? 0);
        const hi = Number(m.max ?? m.maxPower ?? m.powerMax ?? 100);
        const minV = Math.min(lo, hi);
        const maxV = Math.max(lo, hi);

        const r0 = Math.random();
        const centered = 0.5 + (r0 - 0.5) * (1 - stability * 0.65); // 安定ほどブレ圧縮
        const v = minV + centered * (maxV - minV);
        return clamp01to100(v);
      });

      const avg = picked.reduce((a,b)=>a+b,0) / picked.length;
      return Math.round(avg);
    }

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

  // ===== 交戦枠 =====
  function battleSlots(round){
    if (round <= 4) return 4;
    if (round === 5) return 2;
    return 1; // R6
  }

  // ===== イベント回数 =====
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

  function ensureTeamShape(t){
    if (!t) return;
    if (!Number.isFinite(Number(t.power))) t.power = 55;
    if (!Number.isFinite(Number(t.alive))) t.alive = 3;
    t.alive = clamp(t.alive|0, 0, 3);
    if (t.eliminated !== true) t.eliminated = false;

    if (!Number.isFinite(Number(t.areaId))) t.areaId = 1;
    t.areaId = t.areaId|0;

    if (!t.eventBuffs || typeof t.eventBuffs !== 'object'){
      t.eventBuffs = { aim:0, mental:0, agi:0 };
    }else{
      if (!Number.isFinite(t.eventBuffs.aim)) t.eventBuffs.aim = 0;
      if (!Number.isFinite(t.eventBuffs.mental)) t.eventBuffs.mental = 0;
      if (!Number.isFinite(t.eventBuffs.agi)) t.eventBuffs.agi = 0;
    }

    if (!Number.isFinite(Number(t.treasure))) t.treasure = 0;
    if (!Number.isFinite(Number(t.flag))) t.flag = 0;
  }

  // ===== 降下（配置確定）=====
  function dropAssignAreas(teams){
    // teams は 20 を想定
    const shuffled = shuffle(teams);

    // 先頭16：Area1〜16へ1チームずつ
    for (let i=0;i<16 && i<shuffled.length;i++){
      shuffled[i].areaId = i + 1;
    }

    // 残り：被りAreaを4つ選ぶ（1〜16の中から重複なし）
    const overlapAreas = shuffle(Array.from({length:16}, (_,i)=>i+1)).slice(0, 4);
    for (let j=16;j<20 && j<shuffled.length;j++){
      shuffled[j].areaId = overlapAreas[j - 16];
    }

    // 戻りは state.teams をそのまま更新したいので、元配列要素が書き換わればOK
    return { overlapAreas };
  }

  function buildAreaMap(){
    // areaId -> teams[]
    const map = new Map();
    for (const t of aliveTeams()){
      const a = t.areaId|0;
      if (!map.has(a)) map.set(a, []);
      map.get(a).push(t);
    }
    return map;
  }

  function adjacentCandidates(areaId, round){
    const r = roundAreaRange(round);
    const a = areaId|0;
    const out = [];
    const prev = a - 1;
    const next = a + 1;
    if (prev >= r.min && prev <= r.max) out.push(prev);
    if (next >= r.min && next <= r.max) out.push(next);
    return out;
  }

  // ===== イベント（同ラウンド重複なし）=====
  function runRoundEvents(round, ctx){
    const cnt = eventCount(round);
    if (cnt <= 0) return;

    const usedEventIds = new Set();
    const me = ctx.player;

    for (let i=0;i<cnt;i++){
      const alive = aliveTeams();
      if (!alive.length) break;

      const target = alive[(Math.random()*alive.length)|0];
      ensureTeamShape(target);

      let ev = null;

      if (window.MOBBR?.sim?.matchEvents?.rollForTeam){
        for (let k=0;k<30;k++){
          const tmp = window.MOBBR.sim.matchEvents.rollForTeam(target, round, ctx);
          if (!tmp) break;
          if (!usedEventIds.has(tmp.id)){
            usedEventIds.add(tmp.id);
            ev = tmp;
            break;
          }
        }
      }

      // プレイヤー視点：プレイヤーに当たった時だけ
      if (ev && me && target.id === me.id){
        pushPlayerLog(ev.log1, `${ev.log2}：${ev.log3}`);
      }
    }
  }

  // ===== マッチ組み（R1は被り4箇所で確定）=====
  function buildMatchesForRound(round){
    const slots = battleSlots(round);
    const used = new Set();
    const matches = [];

    const alive = aliveTeams();
    if (alive.length < 2) return matches;

    const player = getPlayer();

    // プレイヤー戦確率
    const pTable = { 1: 1.00, 2: 0.70, 3: 0.75, 4: 1.00, 5: 1.00, 6: 1.00 };

    const areaMap = buildAreaMap();

    // --- R1：被りエリア（2チームの場所）を4つ作っている前提で「そこだけ」戦う ---
    if (round === 1){
      // 2チーム以上いるAreaを集める
      const overlapped = [];
      for (const [a, list] of areaMap.entries()){
        if (list.length >= 2) overlapped.push({ a, list: shuffle(list) });
      }
      // 最大4箇所想定
      overlapped.sort((x,y)=> (y.list.length - x.list.length));

      for (const obj of overlapped){
        if (matches.length >= slots) break;
        const list = obj.list.filter(t => !used.has(t.id));
        if (list.length < 2) continue;
        const A = list[0];
        const B = list[1];
        used.add(A.id); used.add(B.id);
        matches.push([A,B]);
      }
      // R1はこれで終わり（被り戦のみ）
      return matches;
    }

    // --- R2〜R6：プレイヤー戦を確率で寄せ、敵選びは 同Area→近接→ランダム ---
    const wantPlayer = !!(player && !player.eliminated && (Math.random() < (pTable[round] ?? 0)));

    function pickFrom(list){
      if (!list || !list.length) return null;
      return list[(Math.random()*list.length)|0];
    }

    function pickOpponentForPlayer(){
      if (!player || player.eliminated) return null;

      // 1) 同Area
      const same = (areaMap.get(player.areaId|0) || []).filter(t => !t.eliminated && t.id !== player.id && !used.has(t.id));
      if (same.length) return pickFrom(same);

      // 2) 近接Area（±1）
      const adjAreas = adjacentCandidates(player.areaId|0, round);
      const adj = [];
      for (const a of adjAreas){
        const list = areaMap.get(a) || [];
        for (const t of list){
          if (!t.eliminated && t.id !== player.id && !used.has(t.id)) adj.push(t);
        }
      }
      if (adj.length) return pickFrom(adj);

      // 3) 生存からランダム
      const any = aliveTeams().filter(t => t.id !== player.id && !used.has(t.id));
      return pickFrom(any);
    }

    if (wantPlayer){
      used.add(player.id);
      const opp = pickOpponentForPlayer();
      if (opp){
        used.add(opp.id);
        matches.push([player, opp]);
      }else{
        // 相手が取れないなら参加取り消し
        used.delete(player.id);
      }
    }

    // --- 残り枠：CPU同士（同Area or 近接を優先） ---
    function pickPair(){
      const pool = aliveTeams().filter(t => !used.has(t.id));
      if (pool.length < 2) return null;

      // まず「同Area」候補を探す
      // ランダムな起点チームを選び、同Area→近接→ランダムで相手
      const a = pickFrom(pool);
      if (!a) return null;

      const aArea = a.areaId|0;

      // 同Area
      const same = (areaMap.get(aArea) || []).filter(t => !used.has(t.id) && t.id !== a.id);
      if (same.length) return [a, pickFrom(same)];

      // 近接Area
      const adjAreas = adjacentCandidates(aArea, round);
      const adj = [];
      for (const aa of adjAreas){
        const list = areaMap.get(aa) || [];
        for (const t of list){
          if (!used.has(t.id) && t.id !== a.id) adj.push(t);
        }
      }
      if (adj.length) return [a, pickFrom(adj)];

      // ランダム
      const any = pool.filter(t => t.id !== a.id);
      if (!any.length) return null;
      return [a, pickFrom(any)];
    }

    while (matches.length < slots){
      const pair = pickPair();
      if (!pair) break;
      const [A,B] = pair;
      if (!A || !B) break;
      if (used.has(A.id) || used.has(B.id)) continue;
      used.add(A.id); used.add(B.id);
      matches.push([A,B]);
    }

    return matches;
  }

  // ===== 敗者は必ず全滅（仕様）=====
  function forceEliminateLoser(teamA, teamB, res){
    if (!res) return;
    const winId = res.winnerId;
    const loseId = res.loserId || (winId === teamA.id ? teamB.id : teamA.id);

    const loser = (teamA.id === loseId) ? teamA : ((teamB.id === loseId) ? teamB : null);
    if (!loser) return;

    loser.alive = 0;
    loser.eliminated = true;
  }

  // ===== ラウンド終了時の移動（全チーム）=====
  function moveAllTeamsToNextRoundArea(nextRound){
    const r = roundAreaRange(nextRound);

    // 「全員が次Roundの範囲へ移動した」ことにする（CPUは裏、プレイヤーは表示用）
    for (const t of aliveTeams()){
      // 次ラウンド範囲が狭いほど被りやすい（遭遇増）
      // ここでは単純に均等ランダムでOK（後で“近接優先”などに強化可）
      t.areaId = randInt(r.min, r.max);
    }
  }

  function playerAreaText(){
    const p = getPlayer();
    if (!p || p.eliminated) return '';
    return `現在エリア：Area${p.areaId|0}`;
  }

  // ===== 優勝決定（最後の生存）=====
  function decideChampion(){
    const alive = aliveTeams();
    let champ = null;

    if (alive.length === 1){
      champ = alive[0];
    }else if (alive.length > 1){
      // 想定外保険：alive多い→名前
      const s = alive.slice().sort((a,b)=> String(a.name||'').localeCompare(String(b.name||''), 'ja'));
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

  // ===== 1ラウンド進行（開始ログ→イベント→交戦→移動）=====
  function stepRound(){
    const round = state.round;
    state.phase = 'battle';

    const ctx = computeCtx();
    const player = ctx.player;

    state.bannerLeft = `ROUND ${round}`;
    state.bannerRight = `交戦：${battleSlots(round)}枠`;

    // Round開始ログ（プレイヤーが生存している時だけ、画面中央に出す想定）
    if (player && !player.eliminated){
      pushPlayerLog(`Round ${round} 開始！`, `残り ${aliveTeams().length} チーム / ${playerAreaText()}`);
    }

    // 1) イベント
    runRoundEvents(round, ctx);

    // 2) 交戦
    const matches = buildMatchesForRound(round);

    for (const [A,B] of matches){
      ensureTeamShape(A);
      ensureTeamShape(B);

      const res = window.MOBBR?.sim?.matchFlow?.resolveBattle
        ? window.MOBBR.sim.matchFlow.resolveBattle(A, B, round, ctx)
        : null;

      if (!res) continue;

      // 仕様：敗者は必ず全滅
      forceEliminateLoser(A, B, res);

      // プレイヤー関与ログのみ
      if (player && (A.id === player.id || B.id === player.id)){
        const me = (A.id === player.id) ? A : B;
        const foe = (A.id === player.id) ? B : A;

        const iWon = (res.winnerId === me.id);
        if (iWon){
          pushPlayerLog('勝利！', `${foe.name} に勝利した！`);
        }else{
          pushPlayerLog('敗北…', `全滅してしまった、、この試合はここで終了！`);
        }

        if (me.eliminated){
          pushPlayerLog('全滅…', 'ここから先は自動で高速処理します');
        }
      }
    }

    // 次へ
    state.round += 1;

    // R6後は結果
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

    // 3) 移動（ラウンド終了時固定）
    state.phase = 'move';
    state.logMain = '移動開始';
    state.logSub = '次へで移動完了';

    // move フェーズは step() で処理する（NEXTで「ido演出→到着」用）
  }

  function doMovePhase(){
    // 現在 round は “次ラウンド番号” になっている（stepRoundで+1済み）
    const nextRound = state.round;

    // R6突入ならArea25固定
    moveAllTeamsToNextRoundArea(nextRound);

    const p = getPlayer();
    if (p && !p.eliminated){
      pushPlayerLog('到着！', `${playerAreaText()} に到着！`);
    }

    state.phase = 'ready';
    state.logMain = `ROUND ${nextRound} 準備`;
    state.logSub = '次へで進行';
  }

  function fastForwardToEnd(){
    // プレイヤー全滅後：ログ無しで最後まで回す
    while (state.round < 7){
      const round = state.round;
      const ctx = computeCtx();

      // イベント（内部反映のみ）
      const cnt = eventCount(round);
      if (cnt > 0 && window.MOBBR?.sim?.matchEvents?.rollForTeam){
        const usedEventIds = new Set();
        for (let i=0;i<cnt;i++){
          const alive = aliveTeams();
          if (!alive.length) break;
          const target = alive[(Math.random()*alive.length)|0];
          ensureTeamShape(target);

          for (let k=0;k<30;k++){
            const tmp = window.MOBBR.sim.matchEvents.rollForTeam(target, round, ctx);
            if (!tmp) break;
            if (!usedEventIds.has(tmp.id)){
              usedEventIds.add(tmp.id);
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
          const res = window.MOBBR.sim.matchFlow.resolveBattle(A, B, round, ctx);
          if (res) forceEliminateLoser(A, B, res);
        }else{
          // フォールバック：ランダムでB敗北扱い
          B.alive = 0;
          B.eliminated = true;
        }
      }

      // 移動（ラウンド終了）
      state.round += 1;
      if (state.round <= 6){
        moveAllTeamsToNextRoundArea(state.round);
      }
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
      eventBuffs: { aim:0, mental:0, agi:0 },
      areaId: 1
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
        eventBuffs: { aim:0, mental:0, agi:0 },
        areaId: 1
      });
    });

    // shape
    teams.forEach(ensureTeamShape);

    // 降下配置（R1はArea1-16 + 被り4箇所）
    dropAssignAreas(teams);

    state = {
      mode: 'local',
      round: 1,
      phase: 'ready',
      teams,
      logs: [],
      bannerLeft: 'ローカル大会',
      bannerRight: '20チーム',
      logMain: '大会開始',
      logSub: '次へで降下開始'
    };

    pushPlayerLog('バトルスタート！', '降下開始…！');

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

    // 初回：ready かつ round=1 のとき「降下完了」ログを出してからRound1へ
    if (state.phase === 'ready' && state.round === 1 && state.logs && state.logs.length <= 2){
      const p = getPlayer();
      if (p && !p.eliminated){
        pushPlayerLog('降下完了。周囲を確認…', `${playerAreaText()}`);
        // 被りならそれっぽく
        const areaMap = buildAreaMap();
        const here = areaMap.get(p.areaId|0) || [];
        if (here.length >= 2){
          pushPlayerLog('被った…敵影がいる！', 'IGLがコール！戦闘準備！');
        }else{
          pushPlayerLog('周囲は静かだ…', 'IGLがコール！戦闘準備！');
        }
      }
      state.logMain = '降下完了';
      state.logSub = '次へでR1開始';
      return;
    }

    // move フェーズ：NEXTで移動完了
    if (state.phase === 'move'){
      doMovePhase();
      return;
    }

    // ready → round実行
    if (state.phase === 'ready'){
      stepRound();
      return;
    }

    // battleなど → ready（見た目整理）
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
