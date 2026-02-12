'use strict';

/*
  sim_tournament_logic.js（フル）
  - ロジック/定数/データ取得/マップ/抽選/移動/イベント/バトル解決
  - state は保持しない（core から渡される state / getPlayer / aliveTeams / computeCtx を使用）
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.sim = window.MOBBR.sim || {};

(function(){

  const K = {
    teamName: 'mobbr_team',
    playerTeam: 'mobbr_playerTeam',
    equippedSkin: 'mobbr_equippedSkin',
    equippedCoachSkills: 'mobbr_equippedCoachSkills'
  };

  // ===== Map Master（固定）=====
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

  function getAreaInfo(areaId){
    const a = AREA[areaId];
    return a ? { id:areaId, name:a.name, img:a.img } : { id:areaId, name:`Area${areaId}`, img:'' };
  }

  function isAdjacentArea(a,b, round){
    const list = areasForRound(round);
    if (!list.includes(a) || !list.includes(b)) return false;
    return Math.abs(a-b) === 1;
  }

  // ===== DataCPU：ローカルのみ =====
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

  // ===== プレイヤー戦闘力 =====
  function calcPlayerTeamPower(){
    try{
      const fn = window.MOBBR?.ui?.team?.calcTeamPower;
      if (typeof fn === 'function'){
        const v = fn();
        if (Number.isFinite(v)) return clamp(v, 1, 100);
      }
    }catch(e){}

    try{
      const raw = localStorage.getItem(K.playerTeam);
      if (raw){
        const t = JSON.parse(raw);
        const v = Number(t?.teamPower);
        if (Number.isFinite(v)) return clamp(v, 1, 100);
      }
    }catch(e){}

    return 55;
  }

  function getEquippedSkin(){
    const v = (localStorage.getItem(K.equippedSkin) || 'P1').trim();
    const m = v.match(/^P([1-5])$/);
    const n = m ? `P${m[1]}` : 'P1';
    return `${n}.png`;
  }

  // ===== CPU 実戦戦闘力抽選 =====
  function rollCpuTeamPowerFromMembers(cpuTeam){
    const mem = Array.isArray(cpuTeam?.members) ? cpuTeam.members : [];
    const overall = Number(cpuTeam?.overall ?? cpuTeam?.basePower ?? cpuTeam?.teamPower ?? 70);
    const bp = Number.isFinite(overall) ? clamp(overall, 1, 100) : 70;

    if (mem.length === 0){
      return clamp(bp, 1, 100);
    }

    const stable = clamp((bp - 50) / 50, 0, 1); // 0..1
    const compress = 1 - (stable * 0.55);       // 1.00 → 0.45

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

  // ===== コーチスキル（効果確定5種）=====
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

  // ===== round settings =====
  function battleSlots(round){
    if (round <= 4) return 4;
    if (round === 5) return 2;
    return 1;
  }
  function eventCount(round){
    if (round === 1) return 1;
    if (round >= 2 && round <= 5) return 2;
    return 0;
  }
  function playerBattleProb(round, playerContestedAtDrop){
    if (round === 1) return playerContestedAtDrop ? 1.0 : 0.0;
    if (round === 2) return 0.70;
    if (round === 3) return 0.75;
    return 1.0;
  }

  // ===== drop =====
  function resetForNewMatch(state){
    for(const t of state.teams){
      t.eliminated = false;
      t.alive = 3;
      t.eventBuffs = { aim:0, mental:0, agi:0 };
      t.treasure = 0;
      t.flag = 0;
      t.kills_total = 0;
      t.assists_total = 0;
      t.downs_total = 0;
      // members個人は試合単位で集計したいならここで0へ
      if (Array.isArray(t.members)){
        for (const m of t.members){
          if (m){ m.kills = 0; m.assists = 0; }
        }
      }
    }
    state.playerContestedAtDrop = false;
  }

  function initDropPositions(state, getPlayer){
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

    // R1の「被りエリアの4戦」を確定させるため保持
    state._dropAssigned = {};
    for (const [a, list] of assigned.entries()){
      state._dropAssigned[a] = list.slice();
    }

    const p = getPlayer();
    state.playerContestedAtDrop = !!(p && (assigned.get(p.areaId)?.length >= 2));
  }

  function moveAllTeamsToNextRound(state, roundJustFinished){
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

  // ===== matches =====
  function buildMatchesForRound(state, round, getPlayer, aliveTeams){
    const alive = aliveTeams();
    const slots = battleSlots(round);
    const used = new Set();
    const matches = [];

    const player = getPlayer();

    // ✅ R1は「降下の被り4箇所＝4戦」を優先して確定
    if (round === 1 && state && state._dropAssigned){
      const areas = Object.keys(state._dropAssigned).map(n=>Number(n)).filter(Number.isFinite);
      const dupAreas = areas.filter(a => (state._dropAssigned[a]||[]).length >= 2);

      // dupAreasは4つ想定。順序はシャッフルで良い
      const pickedAreas = shuffle(dupAreas).slice(0, 4);

      for (const a of pickedAreas){
        const ids = (state._dropAssigned[a] || []).slice().filter(Boolean);
        if (ids.length < 2) continue;
        const A = state.teams.find(t=>t.id===ids[0]);
        const B = state.teams.find(t=>t.id===ids[1]);
        if (!A || !B) continue;
        if (A.eliminated || B.eliminated) continue;

        // プレイヤー戦は「確率」だが、R1は被りなら100%（仕様）
        // つまりプレイヤーが被りなら必ずこのペアに含まれる
        matches.push([A,B]);
        used.add(A.id);
        used.add(B.id);
      }

      // 念のため不足時：残りを埋める（通常ロジック）
      // （本来は不足しない）
    }

    // player確率戦（R1は被り時は上の固定で入ってる想定）
    if (player && !player.eliminated && round !== 1){
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

  // ===== coach mult =====
  function coachMultForRound(state, round){
    const sk = state.selectedCoachSkill;
    if (!sk) return 1.0;
    const m = COACH_MASTER[sk];
    if (!m) return 1.0;
    if (m.endgame) return (round >= 5) ? m.mult : 1.0;
    return m.mult;
  }

  // ===== event =====
  function applyEventForTeam(state, team, computeCtx){
    const ctx = computeCtx();
    if (!window.MOBBR?.sim?.matchEvents?.rollForTeam) return null;
    return window.MOBBR.sim.matchEvents.rollForTeam(team, state.round, ctx);
  }

  // ===== internal: resolve one battle =====
  function resolveOneBattle(state, A, B, round, ensureTeamRuntimeShape, computeCtx){
    ensureTeamRuntimeShape(A);
    ensureTeamRuntimeShape(B);

    const ctx = computeCtx();

    const mult = coachMultForRound(state, round);
    let aBackup=null, bBackup=null;
    if (A.isPlayer){ aBackup=A.power; A.power=clamp(A.power*mult,1,100); }
    if (B.isPlayer){ bBackup=B.power; B.power=clamp(B.power*mult,1,100); }

    const res = window.MOBBR?.sim?.matchFlow?.resolveBattle
      ? window.MOBBR.sim.matchFlow.resolveBattle(A, B, round, ctx)
      : null;

    if (A.isPlayer && aBackup!==null) A.power=aBackup;
    if (B.isPlayer && bBackup!==null) B.power=bBackup;

    return res;
  }

  window.MOBBR.sim.tournamentLogic = {
    K,

    AREA,
    range,
    areasForRound,
    clamp,
    shuffle,
    getAreaInfo,
    isAdjacentArea,

    getCpuTeamsLocalOnly,
    calcPlayerTeamPower,
    getEquippedSkin,
    rollCpuTeamPowerFromMembers,

    COACH_MASTER,
    getEquippedCoachSkills,

    battleSlots,
    eventCount,
    playerBattleProb,

    resetForNewMatch,
    initDropPositions,
    moveAllTeamsToNextRound,
    buildMatchesForRound,
    coachMultForRound,
    applyEventForTeam,
    resolveOneBattle
  };

})();
