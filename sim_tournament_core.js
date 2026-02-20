/* =========================================================
   sim_tournament_core.js（FULL） v4.6
   - tournament core (entry)
   - ✅ 重要：shared(_tcore) を「上書きしない」
     → shared/step と構造がズレると National で teamDef/name/image が壊れる
   - ✅ 修正（今回の要件）:
     1) Nationalで AB以外のキャラクター/チーム名が読めない問題を解消
        → entry側の旧仕様 _tcore 上書きを廃止し、shared仕様の
           nat.plan(groups/sessions) + nat.allTeamDefs(map) を使う
     2) ローカル勝ち上がりTOP10を National roster に反映
        - Playerが勝ち上がり：PLAYER + 9チーム（＝ localIdsは9）
        - Playerが勝ち上がってない：10チーム（＝ localIdsは10）
        ※ plan builder は 9/10 両対応（ここで実装）
  ========================================================= */
'use strict';

window.MOBBR = window.MOBBR || {};
window.MOBBR.sim = window.MOBBR.sim || {};

(function(){

  // =========================================================
  // Dependencies (MUST be loaded before this file)
  //  logic -> result -> core_shared -> core_step -> core(entry)
  // =========================================================
  const T = window.MOBBR?.sim?._tcore;
  if (!T){
    console.error('[tournament_core] shared not loaded: window.MOBBR.sim._tcore missing');
    return;
  }

  const L = T.L;
  if (!L){
    console.error('[tournament_core] tournamentLogic missing on _tcore');
    return;
  }

  // R is dynamic in shared: always use T.getR()
  function getR(){
    return (T.getR && typeof T.getR === 'function') ? T.getR() : (window.MOBBR?.sim?.tournamentResult || null);
  }

  // =========================================================
  // Storage Keys（core_post.js と合わせる）
  // =========================================================
  const K = {
    tourState: 'mobbr_tour_state',
    lastResult: 'mobbr_last_tournament_result',
  };

  function getJSON(key, def){
    try{
      const raw = localStorage.getItem(key);
      if (!raw) return def;
      return JSON.parse(raw);
    }catch(e){ return def; }
  }
  function setJSON(key, val){
    try{ localStorage.setItem(key, JSON.stringify(val)); }catch(e){}
  }

  // =========================================================
  // Local TOP10 key (sharedに合わせる)
  // =========================================================
  const K_LOCAL_TOP10 = T.K_LOCAL_TOP10 || 'mobbr_split1_local_top10';

  // =========================================================
  // Helpers
  // =========================================================
  function uniq(arr){
    const out = [];
    const seen = new Set();
    for (const x of (arr||[])){
      const s = String(x||'').trim();
      if (!s) continue;
      if (seen.has(s)) continue;
      seen.add(s);
      out.push(s);
    }
    return out;
  }

  function initTotalForIds(ids){
    const total = {};
    for (const id0 of (ids||[])){
      const id = String(id0||'');
      if (!id) continue;
      total[id] = total[id] || {
        id,
        sumTotal: 0,
        sumPlacementP: 0,
        sumKP: 0,
        sumAP: 0,
        sumTreasure: 0,
        sumFlag: 0,
        // internal
        sumKills: 0,
        sumAssists: 0,
        sumDowns: 0
      };
    }
    return total;
  }

  function getAllCpuTeams(){
    try{
      const d = window.DataCPU;
      if (!d) return [];
      let all = [];
      if (typeof d.getAllTeams === 'function') all = d.getAllTeams() || [];
      else if (typeof d.getALLTeams === 'function') all = d.getALLTeams() || [];
      else if (Array.isArray(d.TEAMS)) all = d.TEAMS;
      return Array.isArray(all) ? all : [];
    }catch(e){
      return [];
    }
  }

  function getCpuById(teamId){
    try{
      const d = window.DataCPU;
      if (!d) return null;
      if (typeof d.getById === 'function') return d.getById(teamId) || null;

      const all = getAllCpuTeams();
      const id = String(teamId||'');
      return all.find(t => String(t?.teamId || t?.id || '') === id) || null;
    }catch(e){
      return null;
    }
  }

  function getCpuByPrefix(prefix){
    const p = String(prefix||'').toLowerCase();
    const all = getAllCpuTeams();
    return all.filter(t=>{
      const id = String(t?.teamId || t?.id || '').toLowerCase();
      return id.startsWith(p);
    });
  }

  // =========================================================
  // ✅ National plan builder (9/10 local reps supported)
  //   - groups(A,B,C,D) are arrays of teamIds (PLAYER除く)
  //   - sessions fixed
  //   - target sizes: A=9, B=10, C=10, D=10（合計39）
  // =========================================================
  function buildNationalPlan(localIds, nationalPoolIds){
    const local = L.shuffle(uniq(localIds));
    const nat = L.shuffle(uniq(nationalPoolIds));

    const A = [];
    const B = [];
    const C = [];
    const D = [];

    // local distribution:
    // - 9 teams : A1 / B3 / C2 / D3 = 9
    // - 10 teams: A2 / B3 / C2 / D3 = 10  (Aを+1)
    const lc = local.length;

    if (lc >= 9){
      if (lc >= 10){
        // 10
        A.push(...local.slice(0,2));
        B.push(...local.slice(2,5));
        C.push(...local.slice(5,7));
        D.push(...local.slice(7,10));
      }else{
        // 9
        A.push(...local.slice(0,1));
        B.push(...local.slice(1,4));
        C.push(...local.slice(4,6));
        D.push(...local.slice(6,9));
      }
    }else{
      // 足りない場合は可能な限り入れる（壊さない）
      let idx = 0;
      if (lc >= 1){ A.push(local[idx++]); }
      while (idx < lc && B.length < 3) B.push(local[idx++]);
      while (idx < lc && C.length < 2) C.push(local[idx++]);
      while (idx < lc && D.length < 3) D.push(local[idx++]);
      while (idx < lc) {
        // 余りは B→C→D→A の順で入れる
        if (B.length < 3) B.push(local[idx++]);
        else if (C.length < 2) C.push(local[idx++]);
        else if (D.length < 3) D.push(local[idx++]);
        else A.push(local[idx++]);
      }
    }

    const target = { A:9, B:10, C:10, D:10 };

    function hasAny(id){
      return A.includes(id) || B.includes(id) || C.includes(id) || D.includes(id);
    }
    function fillTo(arr, want){
      while (arr.length < want && nat.length){
        const id = String(nat.shift()||'');
        if (!id) continue;
        if (hasAny(id)) continue;
        arr.push(id);
      }
    }

    fillTo(A, target.A);
    fillTo(B, target.B);
    fillTo(C, target.C);
    fillTo(D, target.D);

    const sessions = [
      { key:'AB', groups:['A','B'] },
      { key:'CD', groups:['C','D'] },
      { key:'AC', groups:['A','C'] },
      { key:'BC', groups:['B','C'] },
      { key:'BD', groups:['B','D'] },
      { key:'AD', groups:['A','D'] },
    ];

    return { groups:{A,B,C,D}, sessions };
  }

  // =========================================================
  // State creator (shared/step互換)
  // =========================================================
  function makeBaseState(mode){
    return {
      mode: String(mode||'local'),
      phase: 'intro',

      matchIndex: 1,
      matchCount: 5,
      round: 1,

      teams: [],

      tournamentTotal: {},
      currentOverallRows: [],
      lastMatchResultRows: [],

      bannerLeft: '',
      bannerRight: '',
      center: { a:'', b:'', c:'' },

      selectedCoachSkill: null,
      selectedCoachQuote: '',

      ui: {
        bg: 'maps/neonmain.png',
        squareBg: 'tent.png',
        leftImg: (T.getPlayerSkin ? T.getPlayerSkin() : (L.getEquippedSkin ? L.getEquippedSkin() : 'P1.png')),
        rightImg: '',
        topLeftName: '',
        topRightName: '',
        center3: ['', '', '']
      },

      request: { type:'noop', payload:{} },
    };
  }

  // =========================================================
  // START APIs
  // =========================================================
  function startLocalTournament(){
    const player = (T._makePlayerRuntime && typeof T._makePlayerRuntime === 'function')
      ? T._makePlayerRuntime()
      : {
          id:'PLAYER', name:'PLAYER TEAM', isPlayer:true, power: (L.calcPlayerTeamPower ? Number(L.calcPlayerTeamPower()||55) : 55)
        };

    const locals = getCpuByPrefix('local').slice(0,19);
    const cpu19 = locals.map(def => (T._mkRuntimeTeamFromCpuDef ? T._mkRuntimeTeamFromCpuDef(def) : null)).filter(Boolean);

    const teams = [player, ...cpu19].slice(0,20);

    for (const t of teams) T.ensureTeamRuntimeShape(t);

    const st = makeBaseState('local');
    st.teams = teams;

    // total for these 20 teams
    st.tournamentTotal = initTotalForIds(teams.map(t=>t.id));

    T.setState(st);
    T.setRequest('openTournament', { mode:'local' });
    return st;
  }

  function startNationalTournament(){
    // --- read Local TOP10 from storage ---
    const rawTop = getJSON(K_LOCAL_TOP10, null);
    let topIds = [];

    if (Array.isArray(rawTop)){
      topIds = rawTop.slice();
    }else if (rawTop && typeof rawTop === 'object'){
      // いろんな形式に耐える
      if (Array.isArray(rawTop.ids)) topIds = rawTop.ids.slice();
      else if (Array.isArray(rawTop.teamIds)) topIds = rawTop.teamIds.slice();
      else if (Array.isArray(rawTop.top10)) topIds = rawTop.top10.slice();
    }

    topIds = uniq(topIds);

    // player advanced detection:
    // - TOP10に PLAYER が入っている
    // - or tourState flags
    const tourState = getJSON(K.tourState, {}) || {};
    const playerAdvanced =
      topIds.includes('PLAYER')
      || tourState.localChampionId === 'PLAYER'
      || tourState.localWinnerId === 'PLAYER'
      || tourState.localPlayerAdvanced === true;

    // local reps:
    // - player勝ち上がり: PLAYER + 9 teams → localIds = 9 (exclude PLAYER)
    // - それ以外: 10 teams → localIds = 10
    const localWithoutPlayer = topIds.filter(id => String(id) !== 'PLAYER');

    const wantLocalCount = playerAdvanced ? 9 : 10;
    const localIds = localWithoutPlayer.slice(0, wantLocalCount);

    // --- national pool (national01..national39) ---
    const natAll = getCpuByPrefix('national').map(t=>String(t?.teamId || t?.id || '')).filter(Boolean);
    const nat39 = natAll.slice(0,39);

    // exclude any localIds that might be national ids (just in case)
    const natPool = nat39.filter(id => !localIds.includes(id));

    // We'll fill remaining slots from natPool.
    // Total non-player ids should be 39.
    // localIds length is 9 or 10. Therefore need 30 or 29 nationals.
    const needNat = Math.max(0, 39 - localIds.length);
    const nationalIds = natPool.slice(0, needNat);

    // --- build plan (groups/sessions) ---
    const plan = buildNationalPlan(localIds, nationalIds);

    // --- build allTeamDefs MAP (runtime teams) ---
    const playerRuntime = (T._makePlayerRuntime && typeof T._makePlayerRuntime === 'function')
      ? T._makePlayerRuntime()
      : {
          id:'PLAYER', name:'PLAYER TEAM', isPlayer:true, power: (L.calcPlayerTeamPower ? Number(L.calcPlayerTeamPower()||55) : 55)
        };

    const allIdsNoPlayer = uniq([]
      .concat(plan.groups.A||[])
      .concat(plan.groups.B||[])
      .concat(plan.groups.C||[])
      .concat(plan.groups.D||[])
    ).filter(id => id !== 'PLAYER');

    const allTeamDefs = {};
    allTeamDefs.PLAYER = playerRuntime;

    for (const id of allIdsNoPlayer){
      const def = getCpuById(id);
      if (!def) continue;
      const rt = (T._mkRuntimeTeamFromCpuDef && typeof T._mkRuntimeTeamFromCpuDef === 'function')
        ? T._mkRuntimeTeamFromCpuDef(def)
        : null;
      if (rt) allTeamDefs[id] = rt;
    }

    // safety fill if somehow 부족 (to keep sessions stable)
    // try to fill missing defs from national pool
    if (Object.keys(allTeamDefs).length < (1 + allIdsNoPlayer.length)){
      const fallbackPool = uniq(nat39.concat(getCpuByPrefix('local').map(t=>String(t?.teamId||t?.id||'')).filter(Boolean)));
      for (const id of allIdsNoPlayer){
        if (allTeamDefs[id]) continue;
        const def = getCpuById(id) || getCpuById(fallbackPool.find(x=>x===id));
        if (!def) continue;
        const rt = T._mkRuntimeTeamFromCpuDef ? T._mkRuntimeTeamFromCpuDef(def) : null;
        if (rt) allTeamDefs[id] = rt;
      }
    }

    // --- create state (shared/step compatible) ---
    const split = Number(tourState.split||0) || 1;

    const st = makeBaseState('national');
    st.national = {
      split,
      plan,
      allTeamDefs,        // ✅ MAP（重要）
      sessions: plan.sessions,
      sessionIndex: 0,
      sessionCount: (plan.sessions ? plan.sessions.length : 6),
      doneSessions: []    // step.js(v4.6) は doneSessions を使う
    };

    // build initial 20 teams for session 0 (AB)
    st.teams = (T._buildTeamsForNationalSession && typeof T._buildTeamsForNationalSession === 'function')
      ? T._buildTeamsForNationalSession(allTeamDefs, plan, 0)
      : [];

    for (const t of st.teams) T.ensureTeamRuntimeShape(t);

    // tournament total for all 40 (PLAYER + 39)
    const all40Ids = ['PLAYER'].concat(allIdsNoPlayer);
    st.tournamentTotal = initTotalForIds(all40Ids);

    T.setState(st);
    T.setRequest('openTournament', { mode:'national' });
    return st;
  }

  // =========================================================
  // LastChance / World start (keep API; roster keys handled by post/other modules)
  // =========================================================
  function startLastChanceTournament(){
    // 既存のpost/logic側で必要なkeyを作っている前提。
    // ここは「壊さない」最小限で shared/step が動くstateを用意する。
    const tourState = getJSON(K.tourState, {}) || {};
    const idsSorted = Array.isArray(tourState.lastNationalSortedIds) ? tourState.lastNationalSortedIds.slice() : [];
    const slice = idsSorted.slice(8, 28).map(x=>String(x||'')).filter(Boolean);

    const teams = [];
    for (const id of slice){
      if (id === 'PLAYER'){
        teams.push(T._makePlayerRuntime ? T._makePlayerRuntime() : { id:'PLAYER', isPlayer:true, name:'PLAYER', power:55 });
      }else{
        const def = getCpuById(id);
        const rt = def && T._mkRuntimeTeamFromCpuDef ? T._mkRuntimeTeamFromCpuDef(def) : null;
        if (rt) teams.push(rt);
      }
      if (teams.length >= 20) break;
    }

    // 補完
    if (teams.length < 20){
      const natPool = getCpuByPrefix('national');
      for (const def of natPool){
        if (teams.length >= 20) break;
        const id = String(def?.teamId || def?.id || '');
        if (!id) continue;
        if (teams.some(t=>String(t.id)===id)) continue;
        const rt = T._mkRuntimeTeamFromCpuDef ? T._mkRuntimeTeamFromCpuDef(def) : null;
        if (rt) teams.push(rt);
      }
    }

    for (const t of teams) T.ensureTeamRuntimeShape(t);

    const st = makeBaseState('lastchance');
    st.teams = teams.slice(0,20);
    st.tournamentTotal = initTotalForIds(st.teams.map(t=>t.id));

    T.setState(st);
    T.setRequest('openTournament', { mode:'lastchance' });
    return st;
  }

  function startWorldTournament(phase){
    // Worldの厳密な編成は既存モジュール/キーに依存。
    // ここは shared/step が動くための最低限のstateを用意（壊さない）。
    const ph = String(phase||'qual');
    const st = makeBaseState('world');
    st.worldPhase = ph;

    // roster key があればそれを使う
    const tourState = getJSON(K.tourState, {}) || {};
    const ids = Array.isArray(tourState.worldRosterIds) ? uniq(tourState.worldRosterIds) : [];

    const player = T._makePlayerRuntime ? T._makePlayerRuntime() : { id:'PLAYER', isPlayer:true, name:'PLAYER', power:55 };
    const outIds = ids.length ? ids.slice(0,40) : [];

    if (!outIds.includes('PLAYER')) outIds.unshift('PLAYER');
    outIds.length = Math.min(40, outIds.length);

    // build plan with random split but keep PLAYER in A via shared builder behavior in step
    const rest = outIds.filter(x=>x!=='PLAYER');
    const sh = L.shuffle ? L.shuffle(rest) : rest.slice();

    const A = sh.slice(0,9);
    const B = sh.slice(9,19);
    const C = sh.slice(19,29);
    const D = sh.slice(29,39);

    const plan = { groups:{A,B,C,D}, sessions:[
      { key:'AB', groups:['A','B'] },
      { key:'CD', groups:['C','D'] },
      { key:'AC', groups:['A','C'] },
      { key:'BC', groups:['B','C'] },
      { key:'BD', groups:['B','D'] },
      { key:'AD', groups:['A','D'] }// ← 最後
    ]};

    const allTeamDefs = { PLAYER: player };
    const allNoPlayer = uniq([].concat(A,B,C,D));
    for (const id of allNoPlayer){
      const def = getCpuById(id);
      const rt = def && T._mkRuntimeTeamFromCpuDef ? T._mkRuntimeTeamFromCpuDef(def) : null;
      if (rt) allTeamDefs[id] = rt;
    }

    st.national = {
      plan,
      allTeamDefs,
      sessions: plan.sessions,
      sessionIndex: 0,
      sessionCount: plan.sessions.length,
      doneSessions: []
    };

    st.teams = (T._buildTeamsForNationalSession ? T._buildTeamsForNationalSession(allTeamDefs, plan, 0) : []);
    for (const t of st.teams) T.ensureTeamRuntimeShape(t);

    st.tournamentTotal = initTotalForIds(['PLAYER'].concat(allNoPlayer));

    T.setState(st);
    T.setRequest('openTournament', { mode:'world', phase: ph });
    return st;
  }

  // =========================================================
  // Step wrapper
  // =========================================================
  function step(){
    if (T && typeof T.step === 'function') return T.step();
    if (T && typeof T.setRequest === 'function') T.setRequest('noop', {});
  }

  // =========================================================
  // Public API
  // =========================================================
  window.MOBBR.sim.tournamentCore = {
    startLocalTournament,
    startNationalTournament,
    startLastChanceTournament,
    startWorldTournament,
    step,
    getState: T.getState
  };

  // backward compatibility
  window.MOBBR.sim.tournamentFlow = window.MOBBR.sim.tournamentCore;

})();
