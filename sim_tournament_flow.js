'use strict';

/*
  sim_tournament_flow.js v4（フル）
  ✅追加：
  - プレイヤー戦の紙芝居バトル表示（brbattle/brwin/brlose）用に「battleView」をstateに出す
  - 1試合result（APEX風）を作って state.matchResult を出す（5試合分の大会合算も保持）
  - 5試合を回す（matchIndex 1..5）

  ✅維持：
  - ローカル大会：CPUは local01〜local20 のみ
  - マップ画像：state.bgImage（tent/ido/maps/*）
  - プレイヤー戦確率：R1(被りなら100) / R2=70 / R3=75 / R4-6=100
  - 交戦枠固定：R1-4=4 / R5=2 / R6=1（＝必ず脱落枠ぶん脱落させる）
  - ログ：プレイヤー視点のみ（CPU同士は裏処理）
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.sim = window.MOBBR.sim || {};

(function(){

  const K = {
    team: 'mobbr_team',
    playerTeam: 'mobbr_playerTeam'
  };

  // ===== PlacementP 固定 =====
  function placementP(place){
    const p = Number(place);
    if (p === 1) return 12;
    if (p === 2) return 8;
    if (p === 3) return 5;
    if (p === 4) return 3;
    if (p === 5) return 2;
    if (p >= 6 && p <= 10) return 1;
    return 0;
  }

  // ========= MAP =========
  const MAP = {
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

    17:{id:17, name:'ネオン大橋', img:'maps/neonbrige.png'},
    18:{id:18, name:'ネオン工場', img:'maps/neonfact.png'},
    19:{id:19, name:'ネオンどんぐり広場西', img:'maps/neondon.png'},
    20:{id:20, name:'ネオンどんぐり広場東', img:'maps/neondon.png'},

    21:{id:21, name:'ネオンスケボー広場', img:'maps/neonske.png'},
    22:{id:22, name:'ネオン秘密基地', img:'maps/neonhimi.png'},

    23:{id:23, name:'ネオンライブハウス', img:'maps/neonlivehouse.png'},
    24:{id:24, name:'ネオンライブステージ', img:'maps/neonlivestage.png'},

    25:{id:25, name:'ネオン街最終エリア', img:'maps/neonfinal.png'}
  };

  function range(a,b){ const out=[]; for(let i=a;i<=b;i++) out.push(i); return out; }

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

    return all.filter(t => {
      const id = String(t?.teamId || t?.id || '');
      return /^local\d{2}$/i.test(id);
    });
  }

  // ========= utils =========
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
  function lerp(a,b,t){ return a + (b-a)*t; }

  // ========= Player power (一致) =========
  function getPlayerDisplayPowerFromUI(){
    try{
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
      const cands = [t?.teamPower, t?.power, t?.displayPower, t?.powerDisplay];
      for (const v of cands){
        const n = Number(v);
        if (Number.isFinite(n)) return n;
      }
    }catch(e){}
    return NaN;
  }

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
    const uiPow = getPlayerDisplayPowerFromUI();
    if (Number.isFinite(uiPow) && uiPow > 0) return Math.round(uiPow);

    const stPow = getPlayerDisplayPowerFromStorage();
    if (Number.isFinite(stPow) && stPow > 0) return Math.round(stPow);

    return calcPlayerTeamPowerFallback();
  }

  // ========= CPU power (3人min-max平均 + 安定度) =========
  function rollMember(min, max, stability){
    const lo = Number(min), hi = Number(max);
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return 55;
    const a = Math.min(lo, hi), b = Math.max(lo, hi);

    const mid = (a + b) / 2;
    const span = (b - a) / 2;

    const tighten = lerp(1.00, 0.35, clamp(stability,0,1));
    const u = (Math.random()*2 - 1);
    return clamp(mid + u * span * tighten, a, b);
  }

  function rollCpuTeamPowerFromMembers(team){
    const basePower = Number(team?.basePower);
    const bp = Number.isFinite(basePower) ? clamp(basePower, 1, 100) : 55;

    const stability = clamp((bp - 50) / 50, 0, 1);

    const members = Array.isArray(team?.members) ? team.members.slice(0,3) : [];
    if (members.length === 0) return Math.round(bp);

    const rolls = members.map(m => {
      const mn = m?.powerMin ?? m?.min ?? 50;
      const mx = m?.powerMax ?? m?.max ?? 60;
      return rollMember(mn, mx, stability);
    });

    const avg = rolls.reduce((a,b)=>a+b,0) / rolls.length;
    return Math.round(clamp(avg, 1, 100));
  }

  // ========= battle chatter =========
  const BATTLE_LINES = [
    'やってやんべ！','裏取るぞ！','展開する！','サポートするぞ！','うわあー！','ミスった！',
    '一気に行くぞ！','今のうちに回復だ！','絶対勝つぞ！','撃て―！','なんて動きだ！',
    '撃ちまくれ！','グレ使う！','グレ投げろ！','リロードする！','被弾した！',
    'カバー頼む！','大丈夫か!?','走れーー！','耐えるぞー！'
  ];
  const WIN_LINES = ['よし！次に備えるぞ！','やったー！勝ったぞ！','ナイスー！'];
  const LOSE_LINES = ['やられた..','次だ次！','負けちまった..'];
  const CHAMP_LINES = ['チャンピオンだ―！！','みんなよくやった！！','獲ったぞー！！'];

  // ========= tournament state =========
  let state = null;

  function getPlayer(){ return (state?.teams || []).find(t => t.isPlayer) || null; }
  function aliveTeams(){ return (state?.teams || []).filter(t => !t.eliminated); }

  function pushLog3(l1, l2, l3){
    if (!state) return;
    state.logs = state.logs || [];
    state.logs.push({ l1:String(l1||''), l2:String(l2||''), l3:String(l3||'') });
    if (state.logs.length > 120) state.logs = state.logs.slice(-120);
  }

  function setBg(src){ if (state) state.bgImage = String(src||''); }
  function setBanner(left, right){ if (state){ state.bannerLeft=String(left||''); state.bannerRight=String(right||''); } }

  function computeCtx(){
    const player = getPlayer();
    const coachFlags = window.MOBBR?.sim?.matchFlow?.getPlayerCoachFlags
      ? window.MOBBR.sim.matchFlow.getPlayerCoachFlags()
      : {};
    return { player, playerCoach: coachFlags || {} };
  }

  function ensureTeamShape(t){
    if (!t) return;
    if (!Number.isFinite(Number(t.power))) t.power = 55;
    if (!Number.isFinite(Number(t.alive))) t.alive = 3;
    if (!Number.isFinite(Number(t.areaId))) t.areaId = 1;
    if (t.eliminated !== true) t.eliminated = false;
    if (!Number.isFinite(Number(t.kp))) t.kp = 0;
    if (!Number.isFinite(Number(t.ap))) t.ap = 0;
    if (!Number.isFinite(Number(t.treasure))) t.treasure = 0;
    if (!Number.isFinite(Number(t.flag))) t.flag = 0;
    if (!t.eventBuffs || typeof t.eventBuffs !== 'object') t.eventBuffs = { aim:0, mental:0, agi:0 };
  }

  // ========= drop =========
  function assignInitialDrop(){
    const teams = shuffle(state.teams);

    for (let i=0;i<16;i++) teams[i].areaId = (i+1);

    const overlapAreas = shuffle(range(1,16)).slice(0,4);
    for (let i=16;i<20;i++) teams[i].areaId = overlapAreas[i-16];

    state.teams = teams;

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
      const alive = aliveTeams();
      if (!alive.length) break;

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
        ev = null;
      }

      if (!ev || !target) continue;

      if (target.isPlayer){
        pushLog3(ev.log1, ev.log2, ev.log3);
        state.eventIcon = ev.icon || '';
      }
    }
  }

  // ========= battle matching =========
  function battleSlots(round){
    if (round <= 4) return 4;
    if (round === 5) return 2;
    return 1;
  }

  function playerBattleProbability(round){
    if (round === 1) return null;
    if (round === 2) return 0.70;
    if (round === 3) return 0.75;
    return 1.00;
  }

  function pickPlayerOpponent(round){
    const player = getPlayer();
    if (!player || player.eliminated) return null;

    const alive = aliveTeams().filter(t => !t.isPlayer);
    if (!alive.length) return null;

    const same = alive.filter(t => t.areaId === player.areaId);
    if (same.length) return pickRandom(same);

    const near = alive.filter(t => isAdjacentInRound(round, player.areaId, t.areaId));
    if (near.length) return pickRandom(near);

    return pickRandom(alive);
  }

  function pairPreferAreaOrNear(round, pool){
    const a = pool[0];
    const rest = pool.slice(1);

    let idx = rest.findIndex(t => t.areaId === a.areaId);
    if (idx >= 0) return [a, rest[idx]];

    idx = rest.findIndex(t => isAdjacentInRound(round, a.areaId, t.areaId));
    if (idx >= 0) return [a, rest[idx]];

    return [a, pickRandom(rest)];
  }

  function buildMatchesForRound(round){
    const alive = aliveTeams();
    const slots = battleSlots(round);

    const matches = [];
    const used = new Set();

    const player = getPlayer();
    const pProb = playerBattleProbability(round);

    if (player && !player.eliminated && slots > 0){
      let doPlayer = false;
      if (round === 1) doPlayer = (countEnemiesInSameArea(player.areaId) > 0);
      else doPlayer = (Math.random() < (pProb || 0));

      if (doPlayer){
        const opp = pickPlayerOpponent(round);
        if (opp){
          used.add(player.id);
          used.add(opp.id);
          matches.push([player, opp]);
        }
      }
    }

    while (matches.length < slots){
      const pool = alive.filter(t => !used.has(t.id));
      if (pool.length < 2) break;

      const sp = shuffle(pool);
      const [a,b] = pairPreferAreaOrNear(round, sp);
      if (!a || !b) break;

      used.add(a.id);
      used.add(b.id);
      matches.push([a,b]);
    }

    return matches.slice(0, slots);
  }

  // ========= KPI (KP/AP) =========
  function rollTeamKP(isWinner){
    // winner: 0-3 / loser: 0-2
    const r = Math.random();
    if (isWinner){
      if (r < 0.15) return 0;
      if (r < 0.55) return 1;
      if (r < 0.85) return 2;
      return 3;
    }else{
      if (r < 0.35) return 0;
      if (r < 0.75) return 1;
      return 2;
    }
  }

  function rollTeamAPFromKP(kp){
    // 1キルにつき最大1アシスト、チーム合計APは 0..KP の範囲
    if (kp <= 0) return 0;
    return (Math.random() < 0.55) ? Math.max(0, kp-1) : kp;
  }

  function applyKPAP(team, kp, ap){
    team.kp = (team.kp|0) + (kp|0);
    team.ap = (team.ap|0) + (ap|0);
  }

  // ========= elimination / placement tracking =========
  function startMatchPlacementTracking(){
    state._elimSeq = 0;
    for (const t of state.teams){
      t._elimOrder = 0;     // 小さいほど先に落ちた
      t._place = 0;         // 1..20（試合終了時に確定）
    }
  }

  function eliminateTeam(team){
    if (!team || team.eliminated) return;
    team.alive = 0;
    team.eliminated = true;
    state._elimSeq = (state._elimSeq|0) + 1;
    team._elimOrder = state._elimSeq;
  }

  function finalizePlacements(){
    // elimOrder 早い＝先に落ちた＝順位は低い（20位側）
    const teams = state.teams.slice();

    const alive = teams.filter(t => !t.eliminated);
    if (alive.length === 1){
      alive[0]._place = 1;
    }else{
      // 保険：生存が複数なら power高い方を上（本番は後で確定ロジックへ）
      alive.sort((a,b)=> (b.power||0) - (a.power||0));
      alive.forEach((t,i)=> t._place = 1+i);
    }

    const dead = teams.filter(t => t.eliminated).slice();
    dead.sort((a,b)=> (b._elimOrder|0) - (a._elimOrder|0)); // 後に落ちた方が上位（place小さめ）
    // place を 2..20 に詰める（aliveが複数の場合も自然に続く）
    const nextPlaceStart = (alive.length ? (alive.length + 1) : 1);
    let p = nextPlaceStart;
    for (const t of dead){
      t._place = p++;
    }

    // もし place が欠けたら保険で埋める
    for (const t of teams){
      if (!t._place) t._place = 20;
    }
  }

  function buildMatchResult(){
    finalizePlacements();

    const rows = state.teams.slice().sort((a,b)=> (a._place|0) - (b._place|0)).map(t=>{
      const pl = t._place|0;
      const pp = placementP(pl);
      const kp = t.kp|0;
      const ap = t.ap|0;
      const tr = t.treasure|0;
      const fl = t.flag|0;
      const total = pp + kp + ap + tr + (fl*2);

      return {
        placement: pl,
        squad: t.name || t.id,
        teamId: t.id,
        kp, ap,
        treasure: tr,
        flag: fl,
        placementP: pp,
        total
      };
    });

    state.matchResult = {
      matchIndex: state.matchIndex|0,
      rows
    };

    // 大会合算（全チーム）
    state.tournamentTotals = state.tournamentTotals || {};
    for (const r of rows){
      const id = r.teamId;
      if (!state.tournamentTotals[id]){
        state.tournamentTotals[id] = {
          teamId: id,
          squad: r.squad,
          sumPlacementP: 0,
          kp: 0,
          ap: 0,
          treasure: 0,
          flag: 0,
          totalP: 0
        };
      }
      const tt = state.tournamentTotals[id];
      tt.sumPlacementP += r.placementP;
      tt.kp += r.kp;
      tt.ap += r.ap;
      tt.treasure += r.treasure;
      tt.flag += r.flag;
      tt.totalP = tt.sumPlacementP + tt.kp + tt.ap + tt.treasure + (tt.flag*2);
    }
  }

  function buildTournamentResult(){
    const map = state.tournamentTotals || {};
    const rows = Object.values(map).slice().sort((a,b)=>{
      if (b.totalP !== a.totalP) return b.totalP - a.totalP;
      if (b.sumPlacementP !== a.sumPlacementP) return b.sumPlacementP - a.sumPlacementP;
      if (b.kp !== a.kp) return b.kp - a.kp;
      if (b.ap !== a.ap) return b.ap - a.ap;
      return String(a.squad||'').localeCompare(String(b.squad||''), 'ja');
    });

    state.tournamentResult = { rows };
  }

  // ========= battle resolve =========
  function resolveBattle(teamA, teamB, round){
    ensureTeamShape(teamA);
    ensureTeamShape(teamB);

    const MF = window.MOBBR?.sim?.matchFlow;
    const ctx = computeCtx();

    let res = null;
    if (MF && typeof MF.resolveBattle === 'function'){
      res = MF.resolveBattle(teamA, teamB, round, ctx);
    }

    // winner/loser 推定
    let winner = null;
    let loser = null;

    if (res && res.winnerId && res.loserId){
      winner = (teamA.id === res.winnerId) ? teamA : teamB;
      loser  = (teamA.id === res.loserId) ? teamA : teamB;
    }else{
      const aWin = (Math.random() < 0.5);
      winner = aWin ? teamA : teamB;
      loser  = aWin ? teamB : teamA;
    }

    // ✅ 交戦枠ぶん必ず脱落を作る（＝敗者は必ず全滅）
    eliminateTeam(loser);

    // KP/AP 抽選（裏集計）
    const wkp = rollTeamKP(true);
    const wap = rollTeamAPFromKP(wkp);
    const lkp = rollTeamKP(false);
    const lap = rollTeamAPFromKP(lkp);

    applyKPAP(winner, wkp, wap);
    applyKPAP(loser, lkp, lap);

    return {
      winnerId: winner.id,
      loserId: loser.id
    };
  }

  // ========= movement =========
  function moveAllTeamsToNextRound(nextRound){
    const pool = areaPoolForRound(nextRound);
    const alive = aliveTeams();

    for (const t of alive){
      t.areaId = pool[(Math.random()*pool.length)|0];
    }

    const p = getPlayer();
    const a = MAP[p?.areaId] || null;
    if (a) setBg(a.img);
  }

  // ========= player battle view (pause flow) =========
  function openBattleView(player, enemy, round, didWin, isFinal){
    const area = MAP[player?.areaId] || null;

    // battleView は UI が勝手に演出できるように必要情報だけ持つ
    state.battleView = {
      round,
      areaName: area?.name || '',
      bg: area?.img || state.bgImage || '',
      playerTeamName: player?.name || 'PLAYER',
      enemyTeamName: enemy?.name || 'ENEMY',
      enemyTeamId: enemy?.id || '',
      result: didWin ? (isFinal ? 'champ' : 'win') : 'lose',
      chatter: shuffle(BATTLE_LINES).slice(0,10),
      afterLine: didWin
        ? (isFinal ? pickRandom(CHAMP_LINES) : pickRandom(WIN_LINES))
        : pickRandom(LOSE_LINES)
    };

    state.phase = 'battle_view';
    setBanner(`ROUND ${round}`, '交戦中');
  }

  // ========= per-round step =========
  function stepRound(){
    const round = state.round;
    const player = getPlayer();

    // 降下（tent→Area）演出
    if (state.phase === 'drop'){
      setBg('tent.png');
      setBanner('ローカル大会', `試合 ${state.matchIndex}/5`);
      pushLog3('バトルスタート！', '降下開始…！', '');

      const a = MAP[player?.areaId] || null;
      if (a) setBg(a.img);

      const enemies = countEnemiesInSameArea(player?.areaId);
      if (a){
        pushLog3(`${a.name}に降下完了。周囲を確認…`, enemies>0 ? '被った…敵影がいる！' : '周囲は静かだ…', 'IGLがコール！戦闘準備！');
      }

      state.phase = 'ready';
      return;
    }

    // Round開始（移動はまだ）
    pushLog3(`Round ${round} 開始！`, '', '');

    // イベント
    runRoundEvents(round);

    // 交戦枠
    const matches = buildMatchesForRound(round);
    setBanner(`ROUND ${round}`, `交戦：${matches.length}枠`);

    // 交戦を順に処理。プレイヤー戦が出たら “そこで止める（battle_view）”
    for (const [A,B] of matches){
      const isPlayerIn = (A.isPlayer || B.isPlayer);
      const me = A.isPlayer ? A : (B.isPlayer ? B : null);
      const foe = A.isPlayer ? B : (B.isPlayer ? A : null);

      const res = resolveBattle(A, B, round);

      // プレイヤー戦なら battle_view を開いて停止
      if (isPlayerIn && me && foe){
        const didWin = (res.winnerId === me.id);
        const isFinal = (round === 6);
        openBattleView(me, foe, round, didWin, isFinal);

        // 勝っても負けても、この戦闘のログだけは残す（数値なし）
        if (didWin){
          pushLog3('交戦！', `${foe.name}チームに勝利した！`, '');
        }else{
          pushLog3('交戦！', '全滅してしまった、、', '');
        }
        return; // ✅ここで止める（UIが演出→次へで続き）
      }
    }

    // R6は試合終了へ
    if (round >= 6){
      finishMatch();
      return;
    }

    // Round終了 → 移動（ido）
    setBg('ido.png');
    pushLog3('安置が縮む…移動開始！', 'ルート変更。急げ！', '');

    moveAllTeamsToNextRound(round+1);

    const pa = MAP[player?.areaId] || null;
    if (pa) pushLog3(`${pa.name}へ到着！`, '', '');

    state.round = round + 1;
    state.phase = 'ready';
  }

  function fastForwardToMatchEndFromPlayerDeath(){
    // プレイヤー脱落後：ログ追加なしで R6 まで裏処理 → 試合終了
    while (state.round <= 6){
      const round = state.round;

      // イベント内部のみ
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

      // 交戦枠を消化
      const matches = buildMatchesForRound(round);
      for (const [A,B] of matches){
        resolveBattle(A, B, round);
      }

      if (round >= 6) break;

      moveAllTeamsToNextRound(round+1);
      state.round++;
    }

    finishMatch();
  }

  function finishMatch(){
    // 試合結果作成
    buildMatchResult();

    // チャンピオン（1位）
    const top = state.matchResult?.rows?.[0] || null;
    state.champion = top ? { id: top.teamId, name: top.squad } : null;

    pushLog3('試合終了！', `チャンピオン：${state.champion?.name || '不明'}`, '');

    state.phase = 'match_result';
    state.battleView = null;
    setBg('battle.png'); // result背景（仕様）
    setBanner('RESULT', `試合 ${state.matchIndex}/5`);
  }

  function startNextMatchOrEndTournament(){
    if (state.matchIndex >= 5){
      // 大会result
      buildTournamentResult();
      state.phase = 'tournament_result';
      setBg('battle.png');
      setBanner('TOURNAMENT RESULT', '5試合合算');
      pushLog3('大会終了！', '総合結果', '');
      return;
    }

    state.matchIndex++;
    initOneMatch();
  }

  function initOneMatch(){
    const cpuRaw = getCpuTeamsLocalOnly();
    const cpuPool = shuffle(cpuRaw);
    const cpu19 = cpuPool.slice(0, 19);

    const playerName = localStorage.getItem(K.team) || 'PLAYER TEAM';
    const playerPower = calcPlayerTeamPowerUnified();

    const teams = [];

    teams.push({
      id: 'PLAYER',
      name: playerName,
      isPlayer: true,
      alive: 3,
      eliminated: false,
      areaId: 1,
      power: clamp(playerPower, 1, 100),
      kp: 0, ap: 0,
      treasure: 0, flag: 0,
      eventBuffs: { aim:0, mental:0, agi:0 }
    });

    cpu19.forEach((c, i)=>{
      const id = String(c.teamId || c.id || `local${String(i+1).padStart(2,'0')}`);
      const nm = String(c.name || c.teamName || id);
      const power = rollCpuTeamPowerFromMembers(c);

      teams.push({
        id,
        name: nm,
        isPlayer: false,
        alive: 3,
        eliminated: false,
        areaId: 1,
        power: clamp(power, 1, 100),
        kp: 0, ap: 0,
        treasure: 0, flag: 0,
        eventBuffs: { aim:0, mental:0, agi:0 }
      });
    });

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
    state.matchResult = null;
    state.battleView = null;

    // placement tracking
    startMatchPlacementTracking();

    // drop
    assignInitialDrop();

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
      eventIcon: '',
      battleView: null,
      matchResult: null,
      tournamentTotals: {},   // 合算用
      tournamentResult: null
    };

    initOneMatch();

    if (window.MOBBR?.ui?.tournament?.open) window.MOBBR.ui.tournament.open();
    if (window.MOBBR?.ui?.tournament?.render) window.MOBBR.ui.tournament.render();
  }

  function step(){
    if (!state) return;
    if (state.phase === 'error') return;

    // battle_view の次へ：演出が終わった扱いで続行
    if (state.phase === 'battle_view'){
      const bv = state.battleView;
      const player = getPlayer();

      // 負けていたら高速処理 → 試合resultへ
      if (bv && bv.result === 'lose'){
        // プレイヤーは既に eliminate 済みなのでそのまま裏処理
        fastForwardToMatchEndFromPlayerDeath();
        return;
      }

      // 勝っていたら次の処理へ（移動 or 次交戦など）
      state.battleView = null;

      // R6勝利＝即result
      if (bv && bv.result === 'champ'){
        finishMatch();
        return;
      }

      // そのラウンドの残り枠は “もう裏で終わった” 扱いにして、移動へ進める
      // （ここは後で「残り枠も逐次表示したい」なら分割する）
      if (state.round >= 6){
        finishMatch();
        return;
      }

      setBg('ido.png');
      pushLog3('安置が縮む…移動開始！', 'ルート変更。急げ！', '');
      moveAllTeamsToNextRound(state.round + 1);

      const a = MAP[player?.areaId] || null;
      if (a) pushLog3(`${a.name}へ到着！`, '', '');

      state.round += 1;
      state.phase = 'ready';
      return;
    }

    if (state.phase === 'match_result'){
      startNextMatchOrEndTournament();
      return;
    }

    if (state.phase === 'tournament_result'){
      // ここでは閉じるだけ（メイン復帰は app側で好きに）
      return;
    }

    stepRound();
  }

  function getState(){ return state; }

  window.MOBBR.sim.tournamentFlow = { startLocalTournament, step, getState };

})();
