'use strict';

/*
  sim_tournament_flow.js v3（フル）
  ✅「試合最新版.txt」準拠（現時点の実装範囲：ローカル大会・5試合・マップ・ローカルのみ抽選・プレイヤー戦闘力一致）
  - ローカル大会：CPUは local01〜local20 のみから抽選（プレイヤー1 + CPU19）
  - 5試合（matchIndex:1..5）を連続実行（各試合はR1〜R6）
  - マップ画像：tent/ido + maps/Area画像 を state.bgImage として提供（UIがそれを表示）
  - プレイヤー戦闘力：可能なら ui_team の「表示用戦闘力」を直接参照して一致させる（無ければ保存値→最後にフォールバック計算）
  - CPU実戦戦闘力：3人 min-max 抽選平均。総合力(basePower)は「安定度（ブレ幅）」にのみ影響
  - 交戦枠固定：R1-4=4 / R5=2 / R6=1（＝必ず1チーム脱落×枠数）
  - プレイヤー戦確率：R1(被りなら100) / R2=70 / R3=75 / R4-6=100
  - ログ：プレイヤー視点のみ（CPU同士の詳細ログは出さない）
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.sim = window.MOBBR.sim || {};

(function(){

  const K = {
    team: 'mobbr_team',
    playerTeam: 'mobbr_playerTeam'
  };

  // ========= MAP =========
  // 画像は maps/ に入っている前提（あなたのフォルダ構成）
  const MAP = {
    // R1-R2 (Area1〜16)
    1:{id:1, name:'ネオン噴水西', img:'maps/neonhun.png'},
    2:{id:2, name:'ネオン噴水東', img:'maps/neonhun.png'},
    3:{id:3, name:'ネオン噴水南', img:'maps/neonhun.png'},
    4:{id:4, name:'ネオン噴水北', img:'maps/neonhun.png'},
    5:{id:5, name:'ネオン中心街', img:'maps/neonmain.png'},
    6:{id:6, name:'ネオンジム', img:'maps/neongym.png'},
    7:{id:7, name:'ネオンペイント街西', img:'maps/neonstreet.png'},
    8:{id:8, name:'ネオンペイント街東', img:'maps/neonstreet.png'},
    9:{id:9, name:'ネオンパプリカ広場西', img:'maps/neonpap.png'},
    10:{id:10, name:'ネオンパプリカ広場東', img:'maps/neonpap.png'},
    11:{id:11, name:'ネオンパルクール広場西', img:'maps/neonpal.png'},
    12:{id:12, name:'ネオンパルクール広場東', img:'maps/neonpal.png'},
    13:{id:13, name:'ネオン裏路地西', img:'maps/neonura.png'},
    14:{id:14, name:'ネオン裏路地東', img:'maps/neonura.png'},
    15:{id:15, name:'ネオン裏路地南', img:'maps/neonura.png'},
    16:{id:16, name:'ネオン裏路地北', img:'maps/neonura.png'},

    // R3 (Area17〜20)
    17:{id:17, name:'ネオン大橋', img:'maps/neonbrige.png'},
    18:{id:18, name:'ネオン工場', img:'maps/neonfact.png'},
    19:{id:19, name:'ネオンどんぐり広場西', img:'maps/neondon.png'},
    20:{id:20, name:'ネオンどんぐり広場東', img:'maps/neondon.png'},

    // R4 (Area21〜22)
    21:{id:21, name:'ネオンスケボー広場', img:'maps/neonske.png'},
    22:{id:22, name:'ネオン秘密基地', img:'maps/neonhimi.png'},

    // R5 (Area23〜24)
    23:{id:23, name:'ネオンライブハウス', img:'maps/neonlivehouse.png'},
    24:{id:24, name:'ネオンライブステージ', img:'maps/neonlivestage.png'},

    // R6 (Area25)
    25:{id:25, name:'ネオン街最終エリア', img:'maps/neonfinal.png'}
  };

  function areaPoolForRound(round){
    if (round <= 2) return range(1,16);
    if (round === 3) return range(17,20);
    if (round === 4) return range(21,22);
    if (round === 5) return range(23,24);
    return [25];
  }

  function isAdjacentInRound(round, aId, bId){
    const pool = areaPoolForRound(round);
    const set = new Set(pool);
    if (!set.has(aId) || !set.has(bId)) return false;
    return Math.abs((aId|0) - (bId|0)) === 1;
  }

  // ========= DataCPU =========
  function getCpuTeamsLocalOnly(){
    const d = window.DataCPU;
    if (!d) return [];

    let all = [];
    if (typeof d.getAllTeams === 'function') all = d.getAllTeams() || [];
    else if (typeof d.getALLTeams === 'function') all = d.getALLTeams() || [];
    else if (Array.isArray(d.TEAMS)) all = d.TEAMS;
    else all = [];

    // ✅ ローカルだけ：teamId が localXX のものに限定
    const locals = all.filter(t => {
      const id = String(t?.teamId || t?.id || '');
      return /^local\d{2}$/i.test(id);
    });

    return locals;
  }

  // ========= utils =========
  function range(a,b){
    const out = [];
    for(let i=a;i<=b;i++) out.push(i);
    return out;
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

  function pickRandom(arr){
    if (!arr || arr.length === 0) return null;
    return arr[(Math.random()*arr.length)|0];
  }

  // ========= Player power (一致) =========
  function getPlayerDisplayPowerFromUI(){
    try{
      // ありそうな候補を全部試す（存在すれば “UI表示値” をそのまま採用）
      if (window.MOBBR?.ui?.team){
        const t = window.MOBBR.ui.team;
        if (typeof t.getTeamPower === 'function') return Number(t.getTeamPower());
        if (typeof t.getDisplayedPower === 'function') return Number(t.getDisplayedPower());
        if (typeof t.calcTeamPower === 'function') return Number(t.calcTeamPower());
      }
      if (typeof window.MOBBR?.calcPlayerTeamPower === 'function'){
        return Number(window.MOBBR.calcPlayerTeamPower());
      }
    }catch(e){}
    return NaN;
  }

  function getPlayerDisplayPowerFromStorage(){
    try{
      const raw = localStorage.getItem(K.playerTeam);
      if (!raw) return NaN;
      const t = JSON.parse(raw);
      // ui_team が保存している可能性のあるフィールドを吸収
      const cands = [
        t?.teamPower,
        t?.power,
        t?.displayPower,
        t?.powerDisplay
      ];
      for (const v of cands){
        const n = Number(v);
        if (Number.isFinite(n)) return n;
      }
    }catch(e){}
    return NaN;
  }

  // 最後の手段（※UIと完全一致しない可能性があるため “最後のフォールバック”）
  const WEIGHT = { aim:0.25, mental:0.15, agi:0.10, tech:0.10, support:0.10, scan:0.10, armor:0.10, hp:0.10 };

  function clamp01to100(n){
    const v = Number(n);
    if (!Number.isFinite(v)) return 0;
    return Math.max(0, Math.min(100, v));
  }

  function calcCharBasePowerFallback(stats){
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

  function calcPlayerTeamPowerFallback(){
    try{
      const raw = localStorage.getItem(K.playerTeam);
      if (!raw) return 55;
      const t = JSON.parse(raw);
      if (!t || !Array.isArray(t.members) || t.members.length < 1) return 55;
      const members = t.members.slice(0,3);
      const vals = members.map(m => calcCharBasePowerFallback(m.stats || {}));
      const avg = vals.reduce((a,b)=>a+b,0) / vals.length;
      return Math.round(avg + 3);
    }catch{
      return 55;
    }
  }

  function calcPlayerTeamPowerUnified(){
    // 1) UI直接
    const uiPow = getPlayerDisplayPowerFromUI();
    if (Number.isFinite(uiPow) && uiPow > 0) return Math.round(uiPow);

    // 2) UIが保存している値（あれば一致）
    const stPow = getPlayerDisplayPowerFromStorage();
    if (Number.isFinite(stPow) && stPow > 0) return Math.round(stPow);

    // 3) 最終フォールバック
    return calcPlayerTeamPowerFallback();
  }

  // ========= CPU power (3人min-max平均 + 安定度) =========
  function rollMember(min, max, stability){
    const lo = Number(min), hi = Number(max);
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return 55;
    const a = Math.min(lo, hi), b = Math.max(lo, hi);

    const mid = (a + b) / 2;
    const span = (b - a) / 2;

    // 安定度が高いほど、mid に寄る（ブレ幅縮小）
    // stability: 0..1
    const tighten = lerp(1.00, 0.35, clamp(stability,0,1));

    const u = (Math.random()*2 - 1); // -1..1
    return clamp(mid + u * span * tighten, a, b);
  }

  function lerp(a,b,t){ return a + (b-a)*t; }

  function rollCpuTeamPowerFromMembers(team){
    const basePower = Number(team?.basePower);
    const bp = Number.isFinite(basePower) ? clamp(basePower, 1, 100) : 55;

    // 総合力が高いほど安定（ブレ幅縮小）
    const stability = clamp((bp - 50) / 50, 0, 1);

    const members = Array.isArray(team?.members) ? team.members.slice(0,3) : [];
    if (members.length === 0){
      // 予備：basePower をそのまま（安定度の意味がないが、欠損防止）
      return Math.round(bp);
    }

    const rolls = members.map(m => {
      const mn = m?.powerMin ?? m?.min ?? 50;
      const mx = m?.powerMax ?? m?.max ?? 60;
      return rollMember(mn, mx, stability);
    });

    const avg = rolls.reduce((a,b)=>a+b,0) / rolls.length;
    return Math.round(clamp(avg, 1, 100));
  }

  // ========= tournament state =========
  let state = null;

  function getPlayer(){
    return (state?.teams || []).find(t => t.isPlayer) || null;
  }

  function aliveTeams(){
    return (state?.teams || []).filter(t => !t.eliminated);
  }

  function pushLog3(l1, l2, l3){
    if (!state) return;
    state.logs = state.logs || [];
    state.logs.push({
      l1: String(l1||''),
      l2: String(l2||''),
      l3: String(l3||'')
    });
    if (state.logs.length > 80) state.logs = state.logs.slice(-80);
  }

  function setBg(src){
    if (!state) return;
    state.bgImage = String(src || '');
  }

  function setBanner(left, right){
    if (!state) return;
    state.bannerLeft = String(left||'');
    state.bannerRight = String(right||'');
  }

  function computeCtx(){
    const player = getPlayer();
    const coachFlags = window.MOBBR?.sim?.matchFlow?.getPlayerCoachFlags
      ? window.MOBBR.sim.matchFlow.getPlayerCoachFlags()
      : {};
    return { player, playerCoach: coachFlags || {} };
  }

  // ========= match setup =========
  function assignInitialDrop(){
    // 20チームをシャッフル
    const teams = shuffle(state.teams);

    // 先頭16チームをArea1〜16へ1チームずつ配置（空きなし）
    for (let i=0;i<16;i++){
      teams[i].areaId = (i+1);
    }

    // 残り4チームを「被りArea」を4つ選んで追加（=2チームエリアが4つ）
    const overlapAreas = shuffle(range(1,16)).slice(0,4);
    for (let i=16;i<20;i++){
      teams[i].areaId = overlapAreas[i-16];
    }

    // state.teams をこの順で固定
    state.teams = teams;

    // プレイヤー視点：降下エリアの背景に切替
    const p = getPlayer();
    const a = MAP[p?.areaId] || null;
    if (a) setBg(a.img);
  }

  function countEnemiesInSameArea(areaId){
    const p = getPlayer();
    if (!p) return 0;
    return aliveTeams().filter(t => !t.isPlayer && t.areaId === areaId).length;
  }

  // ========= events =========
  function runRoundEvents(round){
    const ctx = computeCtx();
    const Event = window.MOBBR?.sim?.matchEvents;

    const count = (round === 1) ? 1 : (round <= 5 ? 2 : 0);
    if (!Event || typeof Event.rollForTeam !== 'function' || count <= 0) return;

    const usedEventId = new Set();

    for (let i=0;i<count;i++){
      // eliminated=false のチームのみ
      const alive = aliveTeams();
      if (alive.length === 0) break;

      // 重複なし：同ラウンドで同イベントIDを避ける
      let guard = 0;
      let ev = null;
      let target = null;

      while (guard++ < 60){
        target = pickRandom(alive);
        if (!target) break;
        ev = Event.rollForTeam(target, round, ctx);
        if (!ev) continue;
        if (!usedEventId.has(ev.id)){
          usedEventId.add(ev.id);
          break;
        }
        // かぶったらもう一回
        ev = null;
      }

      if (!ev || !target) continue;

      // プレイヤーに関与したイベントだけログ
      if (target.isPlayer){
        // イベント表示は3段固定
        pushLog3(ev.log1, ev.log2, ev.log3);
        // アイコン表示も持たせる（UI側が対応していれば出せる）
        state.eventIcon = ev.icon || '';
      }
    }
  }

  // ========= battle matching =========
  function battleSlots(round){
    if (round <= 4) return 4;
    if (round === 5) return 2;
    return 1; // R6
  }

  function playerBattleProbability(round){
    if (round === 1) return null;     // 特別：被りなら100 / いなければ0
    if (round === 2) return 0.70;
    if (round === 3) return 0.75;
    return 1.00; // R4-6
  }

  function pickPlayerOpponent(round){
    const player = getPlayer();
    if (!player || player.eliminated) return null;

    const alive = aliveTeams().filter(t => !t.isPlayer);
    if (alive.length === 0) return null;

    // 1) 同じArea
    const same = alive.filter(t => t.areaId === player.areaId);
    if (same.length) return pickRandom(same);

    // 2) 近接Area（同Roundプール内で±1）
    const near = alive.filter(t => isAdjacentInRound(round, player.areaId, t.areaId));
    if (near.length) return pickRandom(near);

    // 3) 生存チームから
    return pickRandom(alive);
  }

  function pairPreferAreaOrNear(round, pool){
    // pool: alive & not used
    const a = pool[0];
    const rest = pool.slice(1);

    // 同エリア優先
    let idx = rest.findIndex(t => t.areaId === a.areaId);
    if (idx >= 0) return [a, rest[idx]];

    // 近接優先
    idx = rest.findIndex(t => isAdjacentInRound(round, a.areaId, t.areaId));
    if (idx >= 0) return [a, rest[idx]];

    // だめならランダム
    return [a, pickRandom(rest)];
  }

  function buildMatchesForRound(round){
    const alive = aliveTeams();
    const slots = battleSlots(round);

    const matches = [];
    const used = new Set();

    const player = getPlayer();
    const pProb = playerBattleProbability(round);

    // ---- プレイヤー戦を “確率で寄せる” ----
    if (player && !player.eliminated && slots > 0){
      let doPlayer = false;

      if (round === 1){
        // R1：被りなら100% / いなければ0
        doPlayer = (countEnemiesInSameArea(player.areaId) > 0);
      }else{
        doPlayer = (Math.random() < (pProb || 0));
      }

      if (doPlayer){
        const opp = pickPlayerOpponent(round);
        if (opp){
          used.add(player.id);
          used.add(opp.id);
          matches.push([player, opp]);
        }
      }
    }

    // ---- 残り枠をCPU同士で埋める（同エリア/近接を優先） ----
    while (matches.length < slots){
      const pool = alive.filter(t => !used.has(t.id));
      if (pool.length < 2) break;

      // シャッフルして先頭から組む（優先探索は pairPreferAreaOrNear）
      const sp = shuffle(pool);
      const [a,b] = pairPreferAreaOrNear(round, sp);

      if (!a || !b) break;

      used.add(a.id);
      used.add(b.id);
      matches.push([a,b]);
    }

    return matches.slice(0, slots);
  }

  // ========= battle resolve =========
  function ensureTeamShape(t){
    if (!t) return;
    if (!Number.isFinite(Number(t.power))) t.power = 55;
    if (!Number.isFinite(Number(t.alive))) t.alive = 3;
    if (!Number.isFinite(Number(t.areaId))) t.areaId = 1;
    if (t.eliminated !== true) t.eliminated = false;
    if (!Number.isFinite(Number(t.treasure))) t.treasure = 0;
    if (!Number.isFinite(Number(t.flag))) t.flag = 0;
    if (!t.eventBuffs || typeof t.eventBuffs !== 'object') t.eventBuffs = { aim:0, mental:0, agi:0 };
  }

  function eliminateTeam(team){
    if (!team) return;
    team.alive = 0;
    team.eliminated = true;
  }

  function resolveOneBattle(teamA, teamB, round){
    ensureTeamShape(teamA);
    ensureTeamShape(teamB);

    const MF = window.MOBBR?.sim?.matchFlow;
    const ctx = computeCtx();

    let res = null;
    if (MF && typeof MF.resolveBattle === 'function'){
      res = MF.resolveBattle(teamA, teamB, round, ctx);
    }

    // ✅最新版の生存推移を守るため「1交戦=必ず1チーム脱落」
    // matchFlowが “減るだけ” 実装でも、ここで必ず負け側を全滅に固定する
    if (res && res.loserId){
      const loser = (teamA.id === res.loserId) ? teamA : teamB;
      eliminateTeam(loser);
    }else{
      // フォールバック：戦闘が返らない場合もランダムで負け側を全滅
      const aLose = (Math.random() < 0.5);
      eliminateTeam(aLose ? teamA : teamB);
      res = res || { winnerId: aLose ? teamB.id : teamA.id, loserId: aLose ? teamA.id : teamB.id };
    }

    return res;
  }

  // ========= movement =========
  function moveAllTeamsToNextRound(nextRound){
    const pool = areaPoolForRound(nextRound);
    const alive = aliveTeams();

    for (const t of alive){
      t.areaId = pool[(Math.random()*pool.length)|0];
    }

    // プレイヤー視点：到着したArea背景へ
    const p = getPlayer();
    const a = MAP[p?.areaId] || null;
    if (a) setBg(a.img);
  }

  // ========= per-round step =========
  function stepRound(){
    const round = state.round;
    const ctx = computeCtx();
    const player = ctx.player;

    // Round開始：まだ移動しない
    setBanner(`ROUND ${round}`, '');
    if (round === 1 && state.phase === 'drop'){
      // 降下ログ（tent→Area）
      pushLog3('バトルスタート！', '降下開始…！', '');
      state.phase = 'round';
      // プレイヤーの降下エリア背景へ
      const pa = MAP[player?.areaId] || null;
      if (pa) setBg(pa.img);

      const enemies = countEnemiesInSameArea(player?.areaId);
      if (pa){
        const msg2 = `${pa.name}に降下完了。周囲を確認…`;
        const msg3 = enemies > 0 ? '被った…敵影がいる！' : '周囲は静かだ…';
        pushLog3(msg2, msg3, 'IGLがコール！戦闘準備！');
      }
      return;
    }

    pushLog3(`Round ${round} 開始！`, '', '');

    // イベント（R1:1 / R2-5:2 / R6:基本なし）
    runRoundEvents(round);

    // 交戦
    const matches = buildMatchesForRound(round);
    setBanner(`ROUND ${round}`, `交戦：${matches.length}枠`);

    for (const [A,B] of matches){
      const res = resolveOneBattle(A, B, round);

      // プレイヤー関与のみログ
      if (player && (A.id === player.id || B.id === player.id)){
        const me = (A.id === player.id) ? A : B;
        const foe = (A.id === player.id) ? B : A;
        const iWon = (res.winnerId === me.id);

        // 戦闘演出ログ（数値無し）
        if (iWon){
          pushLog3('交戦！', `${foe.name}チームに勝利した！`, 'よし！次に備えるぞ！');
        }else{
          pushLog3('交戦！', '全滅してしまった、、', 'ここから先は自動で高速処理します');
          // プレイヤーは以後高速処理
          fastForwardToMatchEnd();
          return;
        }
      }
    }

    // R6なら試合終了へ
    if (round >= 6){
      finishMatch();
      return;
    }

    // Round終了：ここで移動
    setBg('ido.png');
    pushLog3('安置が縮む…移動開始！', 'ルート変更。急げ！', '');

    const nextRound = round + 1;
    moveAllTeamsToNextRound(nextRound);

    const p = getPlayer();
    const a = MAP[p?.areaId] || null;
    if (a){
      pushLog3(`${a.name}へ到着！`, '', '');
    }

    state.round = nextRound;
    state.phase = 'ready';
  }

  function fastForwardToMatchEnd(){
    // プレイヤー脱落後：ログ追加なしで R6 まで裏処理 → result
    while (state.round <= 6){
      const round = state.round;

      // イベント（内部反映のみ）
      if (round <= 5){
        const Event = window.MOBBR?.sim?.matchEvents;
        const ctx = computeCtx();
        const count = (round === 1) ? 1 : 2;
        if (Event && typeof Event.rollForTeam === 'function'){
          const used = new Set();
          for (let i=0;i<count;i++){
            const alive = aliveTeams();
            if (!alive.length) break;
            let guard=0, ev=null;
            while(guard++<60){
              const t = pickRandom(alive);
              ev = Event.rollForTeam(t, round, ctx);
              if (ev && !used.has(ev.id)){ used.add(ev.id); break; }
              ev = null;
            }
          }
        }
      }

      // 交戦枠分だけ回して必ず脱落させる
      const matches = buildMatchesForRound(round);
      for (const [A,B] of matches){
        resolveOneBattle(A, B, round);
      }

      if (round >= 6) break;

      // 移動
      moveAllTeamsToNextRound(round+1);
      state.round++;
    }

    finishMatch();
  }

  function finishMatch(){
    // チャンピオン決定（最後の生存1チーム）
    const alive = aliveTeams();
    let champ = null;

    if (alive.length === 1){
      champ = alive[0];
    }else if (alive.length > 1){
      // 想定外保険：aliveが多いなら power高い→名前（ここは後でresult仕様の厳密版に置換）
      const s = alive.slice().sort((a,b)=>{
        const ap = Number(a.power)||0;
        const bp = Number(b.power)||0;
        if (bp !== ap) return bp - ap;
        return String(a.name||'').localeCompare(String(b.name||''), 'ja');
      });
      champ = s[0];
    }

    state.champion = champ ? { id: champ.id, name: champ.name } : null;

    // プレイヤー視点：結果だけは出す
    pushLog3('試合終了！', `チャンピオン：${state.champion?.name || '不明'}`, '');

    state.phase = 'match_result';
    setBanner('RESULT', `試合 ${state.matchIndex}/5`);
  }

  function startNextMatchOrEndTournament(){
    if (state.matchIndex >= 5){
      // 大会終了（大会resultは後段で本実装へ）
      state.phase = 'tournament_result';
      setBanner('TOURNAMENT RESULT', '5試合終了');
      pushLog3('大会終了！', 'メイン画面へ戻ります', '');
      return;
    }

    // 次の試合を初期化
    state.matchIndex++;
    initOneMatch();
  }

  function initOneMatch(){
    // 20チーム（プレイヤー1 + CPU19）
    const cpuRaw = getCpuTeamsLocalOnly();
    const cpuPool = shuffle(cpuRaw);

    // ローカルだけで19確保（足りない場合は守り）
    const cpu19 = cpuPool.slice(0, 19);

    const playerName = localStorage.getItem(K.team) || 'PLAYER TEAM';
    const playerPower = calcPlayerTeamPowerUnified();

    const teams = [];

    const player = {
      id: 'PLAYER',
      name: playerName,
      isPlayer: true,
      alive: 3,
      eliminated: false,
      areaId: 1,
      power: clamp(playerPower, 1, 100),
      treasure: 0,
      flag: 0,
      eventBuffs: { aim:0, mental:0, agi:0 }
    };
    teams.push(player);

    cpu19.forEach((c, i)=>{
      const id = String(c.teamId || c.id || `local${String(i+1).padStart(2,'0')}`);
      const nm = String(c.name || c.teamName || id);

      // 実戦戦闘力：3人min-max抽選平均
      const power = rollCpuTeamPowerFromMembers(c);

      teams.push({
        id,
        name: nm,
        isPlayer: false,
        alive: 3,
        eliminated: false,
        areaId: 1,
        power: clamp(power, 1, 100),
        treasure: 0,
        flag: 0,
        eventBuffs: { aim:0, mental:0, agi:0 }
      });
    });

    // ✅ “ローカル大会なのにローカル以外が混ざる” を絶対に防ぐ安全策
    // もし local が 19未満などで埋まらない場合：プレイヤー + 19 に満たないならゲーム停止（事故防止）
    if (teams.length !== 20){
      state.phase = 'error';
      setBanner('ERROR', '');
      pushLog3('ローカルCPUが不足しています', 'data_cpu_teams.js の local01〜local20 を確認してください', '');
      return;
    }

    state.teams = teams;
    state.round = 1;
    state.phase = 'drop';
    state.eventIcon = '';
    state.bgImage = 'tent.png';

    // 降下配置
    assignInitialDrop();

    // 表示開始
    setBanner('ローカル大会', `試合 ${state.matchIndex}/5`);
    pushLog3('本日の出場チームをご紹介！', '次へで降下開始', '');
  }

  // ========= public =========
  function startLocalTournament(){
    state = {
      mode: 'local',
      matchIndex: 1,
      round: 1,
      phase: 'drop',
      teams: [],
      logs: [],
      bgImage: 'tent.png',
      bannerLeft: 'ローカル大会',
      bannerRight: '試合 1/5',
      champion: null,
      eventIcon: ''
    };

    initOneMatch();

    if (window.MOBBR?.ui?.tournament?.open) window.MOBBR.ui.tournament.open();
    if (window.MOBBR?.ui?.tournament?.render) window.MOBBR.ui.tournament.render();
  }

  function step(){
    if (!state) return;

    // エラーは止める
    if (state.phase === 'error') return;

    // 大会終了
    if (state.phase === 'tournament_result'){
      // メイン復帰イベント（必要なら）
      window.dispatchEvent(new Event('mobbr:goMain'));
      return;
    }

    // 1試合result → 次試合 or 終了
    if (state.phase === 'match_result'){
      startNextMatchOrEndTournament();
      return;
    }

    // 通常進行
    stepRound();
  }

  function getState(){
    return state;
  }

  window.MOBBR.sim.tournamentFlow = { startLocalTournament, step, getState };

})();
