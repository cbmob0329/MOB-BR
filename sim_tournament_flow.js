'use strict';

/*
  sim_tournament_flow.js v3.5.1（フル）
  ✅ 修正：powerが55固定のまま → "66%" 等のパーセント文字列も数値化して最大値採用
  ✅ 継続：順位がありえない（R2負けで3位） → eliminatedOrder==0 を最速脱落扱いにして下位固定
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.sim = window.MOBBR.sim || {};

(function(){

  const K = {
    teamName: 'mobbr_team',
    playerTeam: 'mobbr_playerTeam',
    equippedSkin: 'mobbr_equippedSkin',
    equippedCoachSkills: 'mobbr_equippedCoachSkills',

    teamPower: 'mobbr_teamPower',
    teamPowerPct: 'mobbr_teamPowerPct',
    teamPercent: 'mobbr_teamPercent',
    teamOverall: 'mobbr_teamOverall',
    mainState: 'mobbr_main_state',
    main: 'mobbr_main'
  };

  const AREA = {
    1:{ name:'ネオン噴水西',  img:'maps/neonhun.png' },
    2:{ name:'ネオン噴水東',  img:'maps/neonhun.png' },
    3:{ name:'ネオン噴水南',  img:'maps/neonhun.png' },
    4:{ name:'ネオン噴水北',  img:'maps/neonhun.png' },
    5:{ name:'ネオン中心街',  img:'maps/neonmain.png' },
    6:{ name:'ネオンジム',    img:'maps/neongym.png' },
    7:{ name:'ネオンペイント街西', img:'maps/neonstreet.png' },
    8:{ name:'ネオンペイント街東', img:'maps/neonstreet.png' },
    9:{ name:'ネオンパプリカ広場西', img:'maps/neonpap.png' },
    10:{ name:'ネオンパプリカ広場東', img:'maps/neonpap.png' },
    11:{ name:'ネオンパルクール広場西', img:'maps/neonpal.png' },
    12:{ name:'ネオンパルクール広場東', img:'maps/neonpal.png' },
    13:{ name:'ネオン裏路地西', img:'maps/neonura.png' },
    14:{ name:'ネオン裏路地東', img:'maps/neonura.png' },
    15:{ name:'ネオン裏路地南', img:'maps/neonura.png' },
    16:{ name:'ネオン裏路地北', img:'maps/neonura.png' },
    17:{ name:'ネオン大橋', img:'maps/neonbrige.png' },
    18:{ name:'ネオン工場', img:'maps/neonfact.png' },
    19:{ name:'ネオンどんぐり広場西', img:'maps/neondon.png' },
    20:{ name:'ネオンどんぐり広場東', img:'maps/neondon.png' },
    21:{ name:'ネオンスケボー広場', img:'maps/neonske.png' },
    22:{ name:'ネオン秘密基地', img:'maps/neonhimi.png' },
    23:{ name:'ネオンライブハウス', img:'maps/neonlivehouse.png' },
    24:{ name:'ネオンライブステージ', img:'maps/neonlivestage.png' },
    25:{ name:'ネオン街最終エリア', img:'maps/neonfinal.png' }
  };

  function range(a,b){
    const out = [];
    for(let i=a;i<=b;i++) out.push(i);
    return out;
  }
  function areasForRound(r){
    if (r <= 2) return range(1,16);
    if (r === 3) return range(17,20);
    if (r === 4) return range(21,22);
    if (r === 5) return range(23,24);
    return [25];
  }
  function clamp(n, lo, hi){
    const v = Number(n);
    if (!Number.isFinite(v)) return lo;
    return Math.max(lo, Math.min(hi, v));
  }
  function shuffle(arr){
    const a = (arr || []).slice();
    for (let i=a.length-1;i>0;i--){
      const j = (Math.random()*(i+1))|0;
      [a[i],a[j]]=[a[j],a[i]];
    }
    return a;
  }

  function getCpuTeamsLocalOnly(){
    const d = window.DataCPU;
    if (!d) return [];
    let all = [];
    if (typeof d.getAllTeams === 'function') all = d.getAllTeams() || [];
    else if (typeof d.getALLTeams === 'function') all = d.getALLTeams() || [];
    else if (Array.isArray(d.TEAMS)) all = d.TEAMS;
    if (!Array.isArray(all)) all = [];
    return all.filter(t=>{
      const id = String(t.teamId || t.id || '');
      return id.startsWith('local');
    });
  }

  // ✅ "66%" / " 66.0 % " / "power:66%" みたいな文字列も数値にする
  function parseMaybePercentNumber(x){
    if (x === null || x === undefined) return null;

    if (typeof x === 'number'){
      return Number.isFinite(x) ? x : null;
    }

    const s = String(x).trim();
    if (!s) return null;

    // そのまま数値化できるケース
    const n0 = Number(s);
    if (Number.isFinite(n0)) return n0;

    // %や余計な文字が混ざるケース（先頭付近の数値を拾う）
    const m = s.match(/-?\d+(\.\d+)?/);
    if (!m) return null;
    const n1 = Number(m[0]);
    return Number.isFinite(n1) ? n1 : null;
  }

  function tryPickNumber(obj, keys){
    if (!obj || typeof obj !== 'object') return null;
    for (const k of keys){
      const v = parseMaybePercentNumber(obj[k]);
      if (Number.isFinite(v)) return v;
    }
    return null;
  }

  function readAny(key){
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    // 1) "66" / "66%" 直接
    const n = parseMaybePercentNumber(raw);
    if (Number.isFinite(n)) return { v:n, src:`${key}(raw)` };

    // 2) JSON
    try{
      const obj = JSON.parse(raw);

      const v = tryPickNumber(obj, [
        'teamPower','power','totalPower','combatPower','battlePower','overall','basePower',
        'percent','pct','teamPct','teamPercent','team_power','team_power_pct'
      ]);
      if (Number.isFinite(v)) return { v, src:`${key}(json)` };

      const v2 = tryPickNumber(obj?.team, [
        'teamPower','power','overall','basePower','percent','pct','teamPercent'
      ]);
      if (Number.isFinite(v2)) return { v:v2, src:`${key}.team(json)` };

    }catch{}
    return null;
  }

  // ✅ 66がどこかにあるなら必ず66を採用するため、候補を集めて最大値にする
  function calcPlayerTeamPower(){
    const candidates = [];

    // playerTeam
    const a = readAny(K.playerTeam);
    if (a) candidates.push(a);

    // teamName（JSONの可能性）
    const b = readAny(K.teamName);
    if (b) candidates.push(b);

    // よくあるキー総当たり
    const keys = [
      K.teamPower, K.teamPowerPct, K.teamPercent, K.teamOverall, K.mainState, K.main
    ];
    for (const k of keys){
      const r = readAny(k);
      if (r) candidates.push(r);
    }

    // UI計算関数（最後）
    try{
      const fn = window.MOBBR?.ui?.team?.calcTeamPower;
      if (typeof fn === 'function'){
        const v = parseMaybePercentNumber(fn());
        if (Number.isFinite(v)) candidates.push({ v, src:'ui.team.calcTeamPower()' });
      }
    }catch{}

    if (!candidates.length){
      console.warn('[tournamentFlow] playerPower: fallback 66 (no candidates)');
      return 66;
    }

    candidates.sort((x,y)=>Number(y.v)-Number(x.v));
    const pick = candidates[0];

    const picked = clamp(pick.v, 1, 100);
    console.warn('[tournamentFlow] playerPower picked:', picked, 'from:', pick.src, 'all:', candidates);
    return picked;
  }

  function getEquippedSkin(){
    const v = (localStorage.getItem(K.equippedSkin) || 'P1').trim();
    const m = v.match(/^P([1-5])$/);
    const n = m ? `P${m[1]}` : 'P1';
    return `${n}.png`;
  }

  function rollCpuTeamPowerFromMembers(cpuTeam){
    const mem = Array.isArray(cpuTeam?.members) ? cpuTeam.members : [];
    const overall = Number(cpuTeam?.overall ?? cpuTeam?.basePower ?? cpuTeam?.teamPower ?? 70);
    const bp = Number.isFinite(overall) ? clamp(overall, 1, 100) : 70;

    if (mem.length === 0){
      return clamp(bp, 1, 100);
    }

    const stable = clamp((bp - 50) / 50, 0, 1);
    const compress = 1 - (stable * 0.55);

    const vals = mem.slice(0,3).map(m=>{
      const lo0 = Number(m?.min ?? m?.powerMin);
      const hi0 = Number(m?.max ?? m?.powerMax);
      const lo = Number.isFinite(lo0) ? clamp(lo0, 1, 100) : 50;
      const hi = Number.isFinite(hi0) ? clamp(hi0, 1, 100) : 80;

      const mid = (lo + hi) / 2;
      const half = Math.max(0, (hi - lo) / 2);

      const half2 = half * compress;
      const lo2 = mid - half2;
      const hi2 = mid + half2;

      const r = lo2 + Math.random() * (hi2 - lo2);
      return r;
    });

    const avg = vals.reduce((a,b)=>a+b,0) / vals.length;
    return Math.round(clamp(avg, 1, 100));
  }

  const COACH_MASTER = {
    tactics_note:   { mult:1.01, endgame:false, quote:'戦術を大事にして戦おう！' },
    endgame_power:  { mult:1.03, endgame:true,  quote:'終盤一気に攻めるぞ！' },
    score_mind:     { mult:1.00, endgame:false, quote:'お宝狙いだ！全力で探せ！' },
    igl_call:       { mult:1.05, endgame:false, quote:'IGLを信じるんだ！' },
    protagonist:    { mult:1.10, endgame:false, quote:'この試合の主人公はお前たちだ！' }
  };

  function getEquippedCoachSkills(){
    try{
      const raw = localStorage.getItem(K.equippedCoachSkills);
      if (!raw) return [];
      const a = JSON.parse(raw);
      if (!Array.isArray(a)) return [];
      return a.map(x=>String(x||'')).filter(Boolean).slice(0,3);
    }catch{
      return [];
    }
  }

  function battleSlots(round){
    if (round <= 4) return 4;
    if (round === 5) return 2;
    return 1;
  }
  function eventCount(round){
    if (round >= 1 && round <= 5) return 1;
    return 0;
  }
  function playerBattleProb(round, playerContestedAtDrop){
    if (round === 1) return playerContestedAtDrop ? 1.0 : 0.0;
    if (round === 2) return 0.70;
    if (round === 3) return 0.75;
    return 1.0;
  }
  function isAdjacentArea(a,b, round){
    const list = areasForRound(round);
    if (!list.includes(a) || !list.includes(b)) return false;
    return Math.abs(a-b) === 1;
  }

  let state = null;

  function getPlayer(){
    return (state?.teams || []).find(t => t.isPlayer) || null;
  }
  function aliveTeams(){
    return (state?.teams || []).filter(t => !t.eliminated);
  }

  function ensureTeamRuntimeShape(t){
    if (!t) return;
    if (!Number.isFinite(Number(t.alive))) t.alive = 3;
    if (!Number.isFinite(Number(t.power))) t.power = 66;
    if (t.eliminated !== true) t.eliminated = false;
    if (!Number.isFinite(Number(t.areaId))) t.areaId = 1;
    if (!Number.isFinite(Number(t.treasure))) t.treasure = 0;
    if (!Number.isFinite(Number(t.flag))) t.flag = 0;

    if (!Number.isFinite(Number(t.eliminatedOrder))) t.eliminatedOrder = 0;
    if (!Number.isFinite(Number(t.eliminatedRound))) t.eliminatedRound = 0;

    if (!t.eventBuffs || typeof t.eventBuffs !== 'object'){
      t.eventBuffs = { aim:0, mental:0, agi:0 };
    }
  }

  function computeCtx(){
    const coachFlags = window.MOBBR?.sim?.matchFlow?.getPlayerCoachFlags
      ? window.MOBBR.sim.matchFlow.getPlayerCoachFlags()
      : {};
    return { player: getPlayer(), playerCoach: coachFlags };
  }

  function resetForNewMatch(){
    state._elimCounter = 0;

    for(const t of state.teams){
      t.eliminated = false;
      t.alive = 3;
      t.eventBuffs = { aim:0, mental:0, agi:0 };
      t.treasure = 0;
      t.flag = 0;
      t.kills_total = 0;
      t.assists_total = 0;

      t.eliminatedOrder = 0;
      t.eliminatedRound = 0;
    }
    state.playerContestedAtDrop = false;
  }

  function initDropPositions(){
    const teams = state.teams.slice();
    const ids = shuffle(teams.map(t=>t.id));

    const areas = range(1,16);
    const assigned = new Map();
    for(const a of areas) assigned.set(a, []);

    for(let i=0;i<16;i++){
      const teamId = ids[i];
      const areaId = i+1;
      assigned.get(areaId).push(teamId);
    }

    const rest = ids.slice(16,20);
    const dupAreas = shuffle(areas).slice(0,4);
    for(let i=0;i<4;i++){
      assigned.get(dupAreas[i]).push(rest[i]);
    }

    for(const t of state.teams){
      let areaId = 1;
      for(const [a, list] of assigned.entries()){
        if (list.includes(t.id)){ areaId = a; break; }
      }
      t.areaId = areaId;
    }

    const p = getPlayer();
    state.playerContestedAtDrop = !!(p && (assigned.get(p.areaId)?.length >= 2));
  }

  function moveAllTeamsToNextRound(roundJustFinished){
    const nextRound = roundJustFinished + 1;
    const pool = areasForRound(nextRound);

    for(const t of state.teams){
      if (t.eliminated) continue;
      const cur = t.areaId;

      let candidates = pool.slice();
      candidates.sort((a,b)=>Math.abs(a-cur)-Math.abs(b-cur));
      const top = candidates.slice(0, Math.min(3, candidates.length));
      const pick = top[(Math.random()*top.length)|0];
      t.areaId = pick;
    }
  }

  function buildMatchesForRound(round){
    const alive = aliveTeams();
    const slots = battleSlots(round);
    const used = new Set();
    const matches = [];

    const player = getPlayer();

    if (player && !player.eliminated){
      const prob = playerBattleProb(round, !!state.playerContestedAtDrop);
      if (Math.random() < prob){
        used.add(player.id);

        const same = alive.filter(t=>!t.eliminated && t.id!==player.id && t.areaId===player.areaId && !used.has(t.id));
        const near = alive.filter(t=>!t.eliminated && t.id!==player.id && isAdjacentArea(t.areaId, player.areaId, round) && !used.has(t.id));
        let pool = same.length ? same : (near.length ? near : alive.filter(t=>!t.eliminated && t.id!==player.id && !used.has(t.id)));

        const opp = pool.length ? pool[(Math.random()*pool.length)|0] : null;
        if (opp){
          used.add(opp.id);
          matches.push([player, opp]);
        }else{
          used.delete(player.id);
        }
      }
    }

    while(matches.length < slots){
      const pool = alive.filter(t=>!t.eliminated && !used.has(t.id));
      if (pool.length < 2) break;

      const a = pool[(Math.random()*pool.length)|0];
      used.add(a.id);

      const same = pool.filter(t=>t.id!==a.id && !used.has(t.id) && t.areaId===a.areaId);
      const near = pool.filter(t=>t.id!==a.id && !used.has(t.id) && isAdjacentArea(t.areaId, a.areaId, round));
      let pickPool = same.length ? same : (near.length ? near : pool.filter(t=>t.id!==a.id && !used.has(t.id)));

      const b = pickPool.length ? pickPool[(Math.random()*pickPool.length)|0] : null;
      if (!b){
        used.delete(a.id);
        break;
      }
      used.add(b.id);
      matches.push([a,b]);
    }

    return matches.slice(0, slots);
  }

  function coachMultForRound(round){
    const sk = state.selectedCoachSkill;
    if (!sk) return 1.0;
    const m = COACH_MASTER[sk];
    if (!m) return 1.0;
    if (m.endgame) return (round >= 5) ? m.mult : 1.0;
    return m.mult;
  }

  const PLACEMENT_P = (placement)=>{
    if (placement === 1) return 12;
    if (placement === 2) return 8;
    if (placement === 3) return 5;
    if (placement === 4) return 3;
    if (placement === 5) return 2;
    if (placement >= 6 && placement <= 10) return 1;
    return 0;
  };

  function safeElimOrder(t){
    const o = Number(t?.eliminatedOrder || 0);
    return (o > 0) ? o : -999999;
  }

  function computePlacements(){
    const teams = state.teams.slice();

    teams.sort((a,b)=>{
      const ae = a.eliminated ? 1 : 0;
      const be = b.eliminated ? 1 : 0;

      if (ae !== be) return ae - be;

      if (!a.eliminated && !b.eliminated){
        const ak = Number(a.kills_total||0);
        const bk = Number(b.kills_total||0);
        if (bk !== ak) return bk - ak;

        const ap = Number(a.power||0);
        const bp = Number(b.power||0);
        if (bp !== ap) return bp - ap;

        return String(a.name||'').localeCompare(String(b.name||''), 'ja');
      }

      const ao = safeElimOrder(a);
      const bo = safeElimOrder(b);
      if (bo !== ao) return bo - ao;

      const ak = Number(a.kills_total||0);
      const bk = Number(b.kills_total||0);
      if (bk !== ak) return bk - ak;

      const ap = Number(a.power||0);
      const bp = Number(b.power||0);
      if (bp !== ap) return bp - ap;

      return String(a.name||'').localeCompare(String(b.name||''), 'ja');
    });

    return teams.map((t, idx)=>({ id:t.id, name:t.name, placement: idx+1 }));
  }

  function getChampionName(){
    const placements = computePlacements();
    const top = placements && placements[0];
    return top ? String(top.name || top.id || '') : '';
  }

  function computeMatchResultTable(){
    const placements = computePlacements();
    const byId = new Map(state.teams.map(t=>[t.id,t]));

    return placements.map(p=>{
      const t = byId.get(p.id) || {};
      const KP = Number(t.kills_total||0);
      const AP = Number(t.assists_total||0);
      const Treasure = Number(t.treasure||0);
      const Flag = Number(t.flag||0);
      const PlacementP = PLACEMENT_P(p.placement);
      const Total = PlacementP + KP + AP + Treasure + (Flag*2);

      return { placement:p.placement, id:p.id, squad:p.name, KP, AP, Treasure, Flag, Total, PlacementP };
    });
  }

  function addToTournamentTotal(matchRows){
    const total = state.tournamentTotal;
    for(const r of matchRows){
      if (!total[r.id]){
        total[r.id] = { id:r.id, squad:r.squad, sumPlacementP:0, KP:0, AP:0, Treasure:0, Flag:0, sumTotal:0 };
      }
      total[r.id].sumPlacementP += r.PlacementP;
      total[r.id].KP += r.KP;
      total[r.id].AP += r.AP;
      total[r.id].Treasure += r.Treasure;
      total[r.id].Flag += r.Flag;
      total[r.id].sumTotal += r.Total;
    }
  }

  function setRequest(type, payload){
    state.request = { type, ...(payload||{}) };
  }
  function getAreaInfo(areaId){
    const a = AREA[areaId];
    return a ? { id:areaId, name:a.name, img:a.img } : { id:areaId, name:`Area${areaId}`, img:'' };
  }

  function getState(){ return state; }

  function getCoachMaster(){ return COACH_MASTER; }
  function getEquippedCoachList(){ return getEquippedCoachSkills(); }
  function setCoachSkill(skillId){
    const id = String(skillId||'');
    if (!id || !COACH_MASTER[id]){
      state.selectedCoachSkill = null;
      state.selectedCoachQuote = '';
      return;
    }
    state.selectedCoachSkill = id;
    state.selectedCoachQuote = COACH_MASTER[id].quote || '';
  }
  function getPlayerSkin(){ return getEquippedSkin(); }

  function applyEventForTeam(team){
    const ctx = computeCtx();
    if (!window.MOBBR?.sim?.matchEvents?.rollForTeam) return null;
    return window.MOBBR.sim.matchEvents.rollForTeam(team, state.round, ctx);
  }

  function initMatchDrop(){
    resetForNewMatch();
    initDropPositions();

    const p = getPlayer();
    if (p){
      const info = getAreaInfo(p.areaId);
      state.ui.bg = info.img || state.ui.bg;
    }
  }

  function markEliminated(team, round){
    if (!team) return;
    if (team.eliminated) return;

    team.eliminated = true;
    team.alive = 0;

    state._elimCounter = Number(state._elimCounter||0) + 1;
    team.eliminatedOrder = state._elimCounter;
    team.eliminatedRound = Number(round||0);
  }

  function awardWinStats(winner, loser, round){
    if (!winner || !loser) return;
    winner.kills_total = Number(winner.kills_total||0) + 3;
    markEliminated(loser, round);
  }

  function resolveOneBattle(A, B, round){
    ensureTeamRuntimeShape(A);
    ensureTeamRuntimeShape(B);

    const ctx = computeCtx();

    const mult = coachMultForRound(round);
    let aBackup=null, bBackup=null;
    if (A.isPlayer){ aBackup=A.power; A.power=clamp(A.power*mult,1,100); }
    if (B.isPlayer){ bBackup=B.power; B.power=clamp(B.power*mult,1,100); }

    const res = window.MOBBR?.sim?.matchFlow?.resolveBattle
      ? window.MOBBR.sim.matchFlow.resolveBattle(A, B, round, ctx)
      : null;

    if (A.isPlayer && aBackup!==null) A.power=aBackup;
    if (B.isPlayer && bBackup!==null) B.power=bBackup;

    let winnerId = null;
    let loserId = null;

    if (res && typeof res === 'object'){
      if (res.winnerId) winnerId = String(res.winnerId);
      if (res.loserId) loserId = String(res.loserId);
    }

    if (!winnerId){
      const ap = clamp(A.power, 1, 100);
      const bp = clamp(B.power, 1, 100);
      const pA = ap / (ap + bp);
      const aWin = Math.random() < pA;
      winnerId = aWin ? A.id : B.id;
      loserId = aWin ? B.id : A.id;
    }else if (!loserId){
      loserId = (winnerId === String(A.id)) ? String(B.id) : String(A.id);
    }

    const winner = (winnerId === String(A.id)) ? A : B;
    const loser  = (winnerId === String(A.id)) ? B : A;

    awardWinStats(winner, loser, round);

    return { winnerId: winner.id, loserId: loser.id };
  }

  function fastForwardToMatchEnd(){
    while(state.round <= 6){
      const r = state.round;

      if (r === 6){
        for(const t of state.teams){
          if (!t.eliminated) t.areaId = 25;
        }
      }

      const matches = buildMatchesForRound(r);
      for(const [A,B] of matches){
        resolveOneBattle(A, B, r);
      }

      if (r <= 5) moveAllTeamsToNextRound(r);
      state.round++;
    }
    state.round = 7;
  }

  function finishMatchAndBuildResult(){
    const rows = computeMatchResultTable();
    addToTournamentTotal(rows);
    state.lastMatchResultRows = rows;
  }

  function step(){
    if (!state) return;
    const p = getPlayer();

    if (state.phase === 'done'){
      setRequest('noop', {});
      return;
    }

    if (state.phase === 'intro'){
      state.bannerLeft = 'ローカル大会';
      state.bannerRight = '20チーム';

      state.ui.bg = 'maps/neonmain.png';
      state.ui.squareBg = 'tent.png';

      state.ui.leftImg = getPlayerSkin();
      state.ui.rightImg = '';
      state.ui.center3 = ['本日のチームをご紹介！','',''];

      setRequest('showIntroText', {});
      state.phase = 'teamList';
      return;
    }

    if (state.phase === 'teamList'){
      setRequest('showTeamList', { teams: state.teams.map(t=>({
        id:t.id, name:t.name, power:t.power, alive:t.alive, treasure:t.treasure, flag:t.flag, isPlayer:!!t.isPlayer
      }))});
      state.phase = 'teamList_done';
      return;
    }

    if (state.phase === 'teamList_done'){
      setRequest('showCoachSelect', { equipped: getEquippedCoachList(), master: COACH_MASTER });
      state.phase = 'coach_done';
      return;
    }

    if (state.phase === 'coach_done'){
      initMatchDrop();

      state.bannerLeft = `MATCH ${state.matchIndex} / 5`;
      state.bannerRight = '降下';

      state.ui.leftImg = getPlayerSkin();
      state.ui.rightImg = '';
      state.ui.bg = 'tent.png';
      state.ui.squareBg = 'tent.png';

      state.ui.center3 = ['バトルスタート！','降下開始…！',''];
      setRequest('showDropStart', {});
      state.phase = 'drop_land';
      state.round = 1;
      return;
    }

    if (state.phase === 'drop_land'){
      const info = getAreaInfo(p?.areaId || 1);
      state.ui.bg = info.img;
      const contested = !!state.playerContestedAtDrop;
      state.ui.center3 = [
        `${info.name}に降下完了。周囲を確認…`,
        contested ? '被った…敵影がいる！' : '周囲は静かだ…',
        'IGLがコール！戦闘準備！'
      ];
      setRequest('showDropLanded', { areaId: info.id, areaName: info.name, bg: info.img, contested });
      state.phase = 'round_start';
      return;
    }

    if (state.phase === 'round_start'){
      const r = state.round;
      state.bannerLeft = `MATCH ${state.matchIndex} / 5`;
      state.bannerRight = `ROUND ${r}`;
      setRequest('showRoundStart', { round: r });
      state.phase = 'round_events';
      state._eventsToShow = eventCount(r);
      return;
    }

    if (state.phase === 'round_events'){
      const r = state.round;

      if (eventCount(r) === 0 || !p || p.eliminated){
        state.phase = 'round_battles';
        return step();
      }

      const remain = Number(state._eventsToShow||0);
      if (remain <= 0){
        state.phase = 'round_battles';
        return step();
      }

      const ev = applyEventForTeam(p);
      state._eventsToShow = remain - 1;

      if (ev){
        state.ui.center3 = [ev.log1, ev.log2, ev.log3];
        setRequest('showEvent', { icon: ev.icon, log1: ev.log1, log2: ev.log2, log3: ev.log3 });
      }else{
        setRequest('showEvent', { icon:'', log1:'イベント発生！', log2:'……', log3:'' });
      }
      return;
    }

    if (state.phase === 'round_battles'){
      const r = state.round;
      const matches = buildMatchesForRound(r);
      state._roundMatches = matches.map(([A,B])=>({ aId:A.id, bId:B.id }));
      state._matchCursor = 0;
      setRequest('prepareBattles', { round: r, slots: battleSlots(r), matches: state._roundMatches });
      state.phase = 'battle_one';
      return;
    }

    if (state.phase === 'battle_one'){
      const r = state.round;
      const list = Array.isArray(state._roundMatches) ? state._roundMatches : [];
      let cur = Number(state._matchCursor||0);

      while (cur < list.length){
        const pair = list[cur];
        const A = state.teams.find(t=>t.id===pair.aId);
        const B = state.teams.find(t=>t.id===pair.bId);
        if (!A || !B){ cur++; continue; }
        if (A.eliminated || B.eliminated){ cur++; continue; }

        const playerIn = (A.isPlayer || B.isPlayer);
        if (playerIn){
          state._matchCursor = cur;

          const me = A.isPlayer ? A : B;
          const foe = A.isPlayer ? B : A;

          state.ui.leftImg = getPlayerSkin();
          state.ui.rightImg = `${foe.id}.png`;

          setRequest('showEncounter', {
            meId: me.id, foeId: foe.id,
            meName: me.name, foeName: foe.name,
            foeTeamId: foe.id,
            foePower: Number(foe.power||0),
            round: r,
            matchIndex: state.matchIndex
          });

          state.phase = 'battle_resolve';
          return;
        }

        resolveOneBattle(A, B, r);
        cur++;
      }

      state._matchCursor = cur;
      state.phase = (r <= 5) ? 'round_move' : 'match_result';
      return step();
    }

    if (state.phase === 'battle_resolve'){
      const r = state.round;
      const list = Array.isArray(state._roundMatches) ? state._roundMatches : [];
      const cur = Number(state._matchCursor||0);
      const pair = list[cur];

      if (!pair){
        state.phase = (r <= 5) ? 'round_move' : 'match_result';
        return step();
      }

      const A = state.teams.find(t=>t.id===pair.aId);
      const B = state.teams.find(t=>t.id===pair.bId);

      if (!A || !B){
        state._matchCursor = cur + 1;
        state.phase = 'battle_one';
        return step();
      }

      if (A.eliminated || B.eliminated){
        state._matchCursor = cur + 1;
        state.phase = 'battle_one';
        return step();
      }

      const me = A.isPlayer ? A : B;
      const foe = A.isPlayer ? B : A;

      const res = resolveOneBattle(A, B, r);
      const iWon = res ? (String(res.winnerId) === String(me.id)) : false;

      setRequest('showBattle', {
        round: r,
        meId: me.id, foeId: foe.id,
        meName: me.name, foeName: foe.name,
        foeTeamId: foe.id,
        foePower: Number(foe.power||0),
        win: iWon,
        final: (r===6),
        holdMs: 2000
      });

      if (!iWon && me.eliminated){
        fastForwardToMatchEnd();
        const championName = getChampionName();

        setRequest('showChampion', { matchIndex: state.matchIndex, championName });
        state.phase = 'match_result';
        return;
      }

      state._matchCursor = cur + 1;
      state.phase = 'battle_one';
      return;
    }

    if (state.phase === 'round_move'){
      const r = state.round;
      if (r <= 5) moveAllTeamsToNextRound(r);
      state.round += 1;
      state.phase = (state.round <= 6) ? 'round_start' : 'match_result';
      setRequest('noop', {});
      return;
    }

    if (state.phase === 'match_result'){
      finishMatchAndBuildResult();
      setRequest('showMatchResult', {
        matchIndex: state.matchIndex,
        matchCount: state.matchCount,
        rows: state.lastMatchResultRows
      });

      state.matchIndex += 1;
      if (state.matchIndex > state.matchCount){
        setRequest('showTournamentResult', { total: state.tournamentTotal });
        state.phase = 'done';
        return;
      }

      state.round = 1;
      state.selectedCoachSkill = null;
      state.selectedCoachQuote = '';
      state.phase = 'coach_done';
      return;
    }

    setRequest('noop', {});
  }

  function startLocalTournament(){
    const cpuAllLocal = getCpuTeamsLocalOnly();
    const cpu19 = shuffle(cpuAllLocal).slice(0, 19);

    const playerPower = calcPlayerTeamPower();

    const player = {
      id: 'PLAYER',
      name: localStorage.getItem(K.teamName) || 'PLAYER TEAM',
      isPlayer: true,
      power: clamp(playerPower, 1, 100),
      alive: 3,
      eliminated: false,
      areaId: 1,
      kills_total: 0,
      assists_total: 0,
      treasure: 0,
      flag: 0,
      eventBuffs: { aim:0, mental:0, agi:0 },
      eliminatedOrder: 0,
      eliminatedRound: 0
    };

    const teams = [player];

    cpu19.forEach((c, i)=>{
      const id = c.teamId || c.id || `localXX_${i+1}`;
      const nm = String(c.name || c.teamName || c.displayName || c.teamId || c.id || id);

      teams.push({
        id,
        name: nm,
        isPlayer: false,
        power: rollCpuTeamPowerFromMembers(c),
        alive: 3,
        eliminated: false,
        areaId: 1,
        kills_total: 0,
        assists_total: 0,
        treasure: 0,
        flag: 0,
        eventBuffs: { aim:0, mental:0, agi:0 },
        eliminatedOrder: 0,
        eliminatedRound: 0
      });
    });

    state = {
      mode: 'local',
      matchIndex: 1,
      matchCount: 5,
      round: 1,
      phase: 'intro',
      teams,
      tournamentTotal: {},
      playerContestedAtDrop: false,
      selectedCoachSkill: null,
      selectedCoachQuote: '',
      bannerLeft: 'ローカル大会',
      bannerRight: '20チーム',
      ui: {
        bg: 'maps/neonmain.png',
        squareBg: 'tent.png',
        leftImg: getEquippedSkin(),
        rightImg: '',
        center3: ['','','']
      },
      _elimCounter: 0,
      request: null
    };

    if (window.MOBBR?.ui?.tournament?.open) window.MOBBR.ui.tournament.open();
    if (window.MOBBR?.ui?.tournament?.render) window.MOBBR.ui.tournament.render();

    step();
    if (window.MOBBR?.ui?.tournament?.render) window.MOBBR.ui.tournament.render();
  }

  window.MOBBR.sim.tournamentFlow = {
    startLocalTournament,
    step,
    getState,
    getCoachMaster,
    getEquippedCoachList,
    setCoachSkill,
    getPlayerSkin,
    getAreaInfo
  };

})();
