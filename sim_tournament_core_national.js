/* =========================================================
   sim_tournament_core_national.js（FULL）
   - National専用ユーティリティを分離
   - core から呼ばれる想定（先に読み込む）
   ========================================================= */
'use strict';

window.MOBBR = window.MOBBR || {};
window.MOBBR.sim = window.MOBBR.sim || {};

(function(){
  function getL(){
    return window.MOBBR?.sim?.tournamentLogic || null;
  }

  function cloneDeep(v){
    return JSON.parse(JSON.stringify(v));
  }

  function getCpuTeamsByPrefix(prefix){
    try{
      const d = window.DataCPU;
      if (!d) return [];
      let all = [];
      if (typeof d.getAllTeams === 'function') all = d.getAllTeams() || [];
      else if (typeof d.getALLTeams === 'function') all = d.getALLTeams() || [];
      else if (Array.isArray(d.TEAMS)) all = d.TEAMS;
      if (!Array.isArray(all)) all = [];

      const p = String(prefix||'').toLowerCase();
      return all.filter(t=>{
        const id = String(t?.teamId || t?.id || '').toLowerCase();
        return id.startsWith(p);
      });
    }catch(e){
      return [];
    }
  }

  function mkRuntimeTeamFromCpuDef(c){
    const L = getL();
    const id = String(c?.teamId || c?.id || '');
    const nm = String(c?.name || id || '');

    const memSrc = Array.isArray(c?.members) ? c.members.slice(0,3) : [];
    const roles = ['IGL','ATTACKER','SUPPORT'];
    const members = [];
    for (let k=0;k<3;k++){
      const m = memSrc[k];
      members.push({
        role: String(m?.role || roles[k]),
        name: String(m?.name || `${id}_${roles[k]}`),
        kills: 0,
        assists: 0
      });
    }

    const pow = (L && typeof L.rollCpuTeamPowerFromMembers === 'function')
      ? L.rollCpuTeamPowerFromMembers(c)
      : 55;

    return {
      id,
      name: nm,
      isPlayer: false,

      power: pow,

      alive: 3,
      eliminated: false,
      eliminatedRound: 0,
      areaId: 1,

      kills_total: 0,
      assists_total: 0,
      downs_total: 0,

      members,

      treasure: 0,
      flag: 0,
      eventBuffs: { aim:0, mental:0, agi:0 }
    };
  }

  function buildNationalPlan(cpu39){
    const L = getL();
    const idsRaw = (cpu39||[]).map(t=>String(t?.teamId||t?.id||'')).filter(Boolean);

    const ids = (L && typeof L.shuffle === 'function') ? L.shuffle(idsRaw) : idsRaw.slice();
    if (!ids.length){
      return { groups:{A:[],B:[],C:[],D:[]}, sessions:[] };
    }

    // 39チームを想定：A(9) / B(10) / C(10) / D(10)
    const A = ids.slice(0, 9);
    const B = ids.slice(9, 19);
    const C = ids.slice(19, 29);
    const D = ids.slice(29, 39);

    const sessions = [
      { key:'AB', groups:['A','B'] },
      { key:'CD', groups:['C','D'] },
      { key:'AC', groups:['A','C'] },
      { key:'AD', groups:['A','D'] },
      { key:'BC', groups:['B','C'] },
      { key:'BD', groups:['B','D'] },
    ];

    return { groups:{A,B,C,D}, sessions };
  }

  function makePlayerRuntime(){
    const L = getL();
    const pPowRaw = (L && typeof L.calcPlayerTeamPower === 'function') ? Number(L.calcPlayerTeamPower()) : NaN;
    const pPow = Number.isFinite(pPowRaw) ? pPowRaw : 55;

    return {
      id: 'PLAYER',
      name: localStorage.getItem(L?.K?.teamName) || 'PLAYER TEAM',
      isPlayer: true,

      power: pPow,

      alive: 3,
      eliminated: false,
      eliminatedRound: 0,
      areaId: 1,

      kills_total: 0,
      assists_total: 0,
      downs_total: 0,

      members: [
        { role:'IGL',      name:'PLAYER_IGL',      kills:0, assists:0 },
        { role:'ATTACKER', name:'PLAYER_ATTACKER', kills:0, assists:0 },
        { role:'SUPPORT',  name:'PLAYER_SUPPORT',  kills:0, assists:0 }
      ],

      treasure: 0,
      flag: 0,
      eventBuffs: { aim:0, mental:0, agi:0 }
    };
  }

  function buildTeamsForNationalSession(allTeamDefs, plan, sessionIndex){
    const s = plan?.sessions?.[sessionIndex] || null;
    const g = plan?.groups || {A:[],B:[],C:[],D:[]};

    const pick = [];
    for (const gr of (s?.groups || [])){
      const list = g[gr] || [];
      pick.push(...list);
    }

    const includesA = (s?.groups || []).includes('A');
    const out = [];

    if (includesA && allTeamDefs?.PLAYER){
      out.push(cloneDeep(allTeamDefs.PLAYER));
    }

    for (const id of pick){
      const def = allTeamDefs?.[id];
      if (def) out.push(cloneDeep(def));
    }

    // 念のため 20に揃える
    if (out.length < 20){
      const allIds = []
        .concat(g.A||[], g.B||[], g.C||[], g.D||[])
        .filter(Boolean);
      const rest = allIds.filter(x => !out.some(t=>t.id===x));
      for (const id of rest){
        if (out.length >= 20) break;
        const def = allTeamDefs?.[id];
        if (def) out.push(cloneDeep(def));
      }
    }
    if (out.length > 20) out.length = 20;

    return out;
  }

  function setNationalBanners(state){
    if (!state) return;
    const s = state.national || {};
    const si = Number(s.sessionIndex||0);
    const sc = Number(s.sessionCount||6);
    const key = String(s.sessions?.[si]?.key || `S${si+1}`);

    state.bannerLeft  = `NATIONAL ${key} (${si+1}/${sc})`;
    state.bannerRight = `MATCH ${state.matchIndex} / ${state.matchCount}`;
  }

  window.MOBBR.sim.tournamentCoreNational = {
    cloneDeep,
    getCpuTeamsByPrefix,
    mkRuntimeTeamFromCpuDef,
    buildNationalPlan,
    makePlayerRuntime,
    buildTeamsForNationalSession,
    setNationalBanners
  };
})();
