/* =========================================================
   sim_tournament_core.js（FULL） v4.8
   - tournament core (entry)
   - ✅ 重要：shared(_tcore) を「上書きしない」
     → shared/step と構造がズレると National で teamDef/name/image が壊れる
   - ✅ v4.7 追加（World編成を“確定ルール”で実装）
     - worldQualifiedIds(10) = nationalTop8 + lastchanceTop2 を “nationalTop10” として扱う
     - world30 = world basePower上位10確定 + 残りからランダム20
     - 合計40を A〜D (10ずつ) に分配（PLAYERは必ずAグループ）
     - tour_state.worldRosterIds / worldGroups を保存し、phase間で再利用
   - ✅ v4.8 追加（World FINAL が 5試合で終わる問題を修正）
     - FINALだけ「セッション型(AB/CD...)」を使わない
     - FINALは 20チーム固定 + matchCount=12
     - tour_state.world.finalIds があればそれを優先、無ければ roster40Ids の先頭20を使用
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

  function shuffleSafe(arr){
    if (L && typeof L.shuffle === 'function') return L.shuffle(arr);
    // fallback Fisher-Yates
    const a = (arr||[]).slice();
    for (let i=a.length-1;i>0;i--){
      const j = (Math.random()*(i+1))|0;
      const tmp = a[i]; a[i]=a[j]; a[j]=tmp;
    }
    return a;
  }

  // =========================================================
  // ✅ National plan builder (9/10 local reps supported)
  //   - groups(A,B,C,D) are arrays of teamIds (PLAYER除く)
  //   - sessions fixed
  //   - target sizes: A=9, B=10, C=10, D=10（合計39）
  // =========================================================
  function buildNationalPlan(localIds, nationalPoolIds){
    const local = shuffleSafe(uniq(localIds));
    const nat = shuffleSafe(uniq(nationalPoolIds));

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
  // ✅ World roster builder (確定ルール)
  //   - nationalTop10: tourState.worldQualifiedIds（10想定）
  //   - world30: basePower top10確定 + 残りからランダム20
  //   - 40をA〜Dに分配（PLAYERは必ずA）
  //   - tourState.worldRosterIds / worldGroups 保存（phase間で固定）
  // =========================================================
  function ensureWorldStateObj(ts){
    const t = ts || {};
    if (!t.world || typeof t.world !== 'object') t.world = { phase:'qual' };
    if (!t.world.phase) t.world.phase = 'qual';
    return t;
  }

  function getPlayerRuntime(){
    return (T._makePlayerRuntime && typeof T._makePlayerRuntime === 'function')
      ? T._makePlayerRuntime()
      : {
          id:'PLAYER',
          name:'PLAYER TEAM',
          isPlayer:true,
          power: (L.calcPlayerTeamPower ? Number(L.calcPlayerTeamPower()||55) : 55)
        };
  }

  function pickWorld30IdsExcluding(excludeSet){
    const allWorldDefs = getCpuByPrefix('world').slice(); // world01..world40想定
    // basePowerで降順
    allWorldDefs.sort((a,b)=> Number(b?.basePower||0) - Number(a?.basePower||0));

    const top10 = [];
    const rest = [];

    for (const def of allWorldDefs){
      const id = String(def?.teamId || def?.id || '');
      if (!id) continue;
      if (excludeSet && excludeSet.has(id)) continue;
      if (top10.length < 10) top10.push(id);
      else rest.push(id);
    }

    const pick20 = shuffleSafe(rest).slice(0,20);
    return uniq(top10.concat(pick20)).slice(0,30);
  }

  function buildWorldGroups40(roster40Ids){
    // roster40Ids: PLAYER含む（または後で入れる）
    let ids = uniq(roster40Ids || []);
    if (!ids.includes('PLAYER')) ids.unshift('PLAYER');

    // 40に満たない場合の安全弁（worldから補完）
    if (ids.length < 40){
      const need = 40 - ids.length;
      const ex = new Set(ids);
      const add = pickWorld30IdsExcluding(ex); // 30しか返らないが、まず足りる想定
      for (const id of add){
        if (ids.length >= 40) break;
        if (ex.has(id)) continue;
        ex.add(id);
        ids.push(id);
      }
    }

    ids = ids.slice(0,40);

    // PLAYERをAグループ固定：Aは「PLAYER + 9」
    const rest = ids.filter(x=>x!=='PLAYER');
    const sh = shuffleSafe(rest);

    const A = sh.slice(0,9);
    const B = sh.slice(9,19);
    const C = sh.slice(19,29);
    const D = sh.slice(29,39);

    return { ids, groups:{ A, B, C, D } };
  }

  function buildWorldPlanFromGroups(groups){
    const A = (groups?.A||[]).slice(0,9);
    const B = (groups?.B||[]).slice(0,10);
    const C = (groups?.C||[]).slice(0,10);
    const D = (groups?.D||[]).slice(0,10);

    const sessions = [
      { key:'AB', groups:['A','B'] },
      { key:'CD', groups:['C','D'] },
      { key:'AC', groups:['A','C'] },
      { key:'BC', groups:['B','C'] },
      { key:'BD', groups:['B','D'] },
      { key:'AD', groups:['A','D'] }
    ];

    return { groups:{A,B,C,D}, sessions };
  }

  function buildAllTeamDefsFromIds(idsNoPlayer, playerRuntime){
    const allTeamDefs = {};
    allTeamDefs.PLAYER = playerRuntime;

    for (const id of (idsNoPlayer||[])){
      const def = getCpuById(id);
      if (!def) continue;
      const rt = (T._mkRuntimeTeamFromCpuDef && typeof T._mkRuntimeTeamFromCpuDef === 'function')
        ? T._mkRuntimeTeamFromCpuDef(def)
        : null;
      if (rt) allTeamDefs[id] = rt;
    }

    return allTeamDefs;
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
    const player = getPlayerRuntime();

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
    const playerRuntime = getPlayerRuntime();

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
  // LastChance / World start
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
        teams.push(getPlayerRuntime());
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
    const ph = String(phase || 'qual').trim().toLowerCase();

    // -----------------------------
    // tour_state から World前提を取得
    // -----------------------------
    let tourState = getJSON(K.tourState, {}) || {};
    tourState = ensureWorldStateObj(tourState);

    // phaseは detail/app.js 側が主、ここでは保険で同期
    if (ph === 'qual' || ph === 'wl' || ph === 'final'){
      tourState.world.phase = ph;
    }else{
      tourState.world.phase = 'qual';
    }

    // -----------------------------
    // 1) roster40 / groups を “固定” できるなら再利用
    // -----------------------------
    const savedRoster = Array.isArray(tourState.worldRosterIds) ? uniq(tourState.worldRosterIds) : [];
    const savedGroups = tourState.worldGroups && typeof tourState.worldGroups === 'object' ? tourState.worldGroups : null;

    let roster40Ids = [];
    let groups = null;

    if (savedRoster.length >= 39 && savedGroups && savedGroups.A && savedGroups.B && savedGroups.C && savedGroups.D){
      // 既に構築済み（phase間は同じ40＆同じグループを使う）
      roster40Ids = savedRoster.slice(0,40);
      groups = {
        A: uniq(savedGroups.A).slice(0,9),
        B: uniq(savedGroups.B).slice(0,10),
        C: uniq(savedGroups.C).slice(0,10),
        D: uniq(savedGroups.D).slice(0,10)
      };
    }else{
      // -----------------------------
      // 2) ルール通りに World40 を生成
      //    nationalTop10 + world30（top10確定 + random20）
      // -----------------------------
      const nationalTop10 = uniq(Array.isArray(tourState.worldQualifiedIds) ? tourState.worldQualifiedIds : []).slice(0,10);

      // safety: worldQualifiedIdsが空でも壊さない
      const exclude = new Set(nationalTop10);
      exclude.add('PLAYER');

      const world30 = pickWorld30IdsExcluding(exclude); // 30
      // 参加40（PLAYERは含めない。後で必ず入る）
      roster40Ids = uniq(nationalTop10.concat(world30));
      // 39までならOK（PLAYERを後で足す）
      // ただし、万一重複や不足があれば補完
      groups = buildWorldGroups40(['PLAYER'].concat(roster40Ids)).groups;
      roster40Ids = ['PLAYER'].concat(uniq(roster40Ids)).slice(0,40);

      // 保存（phase間固定）
      tourState.worldRosterIds = roster40Ids.slice(0,40);
      tourState.worldGroups = {
        A: groups.A.slice(0,9),
        B: groups.B.slice(0,10),
        C: groups.C.slice(0,10),
        D: groups.D.slice(0,10)
      };
    }

    // 保存（phaseも含めて）
    setJSON(K.tourState, tourState);

    // -----------------------------
    // 3) shared/step互換の state を作る
    //    ※今のstep資産を最大限活かすため、
    //      “national構造(plan/allTeamDefs/sessions)”を worldでも使う
    // -----------------------------
    const playerRuntime = getPlayerRuntime();
    const plan = buildWorldPlanFromGroups(groups);

    const allNoPlayer = uniq([].concat(plan.groups.A||[], plan.groups.B||[], plan.groups.C||[], plan.groups.D||[])).filter(Boolean);

    const allTeamDefs = buildAllTeamDefsFromIds(allNoPlayer, playerRuntime);

    // 欠け補完（壊さない）
    if (Object.keys(allTeamDefs).length < (1 + allNoPlayer.length)){
      const fallback = uniq(
        getCpuByPrefix('world').map(t=>String(t?.teamId||t?.id||'')).filter(Boolean)
          .concat(getCpuByPrefix('national').map(t=>String(t?.teamId||t?.id||'')).filter(Boolean))
          .concat(getCpuByPrefix('local').map(t=>String(t?.teamId||t?.id||'')).filter(Boolean))
      );

      for (const id of allNoPlayer){
        if (allTeamDefs[id]) continue;
        if (!fallback.includes(id)) continue;
        const def = getCpuById(id);
        const rt = def && T._mkRuntimeTeamFromCpuDef ? T._mkRuntimeTeamFromCpuDef(def) : null;
        if (rt) allTeamDefs[id] = rt;
      }
    }

    const st = makeBaseState('world');

    // world専用メタ（postやUI側が使えるように）
    st.world = {
      phase: tourState?.world?.phase || ph || 'qual',
      roster40Ids: ['PLAYER'].concat(allNoPlayer).slice(0,40),
      groups: {
        A: (plan.groups.A||[]).slice(0,9),
        B: (plan.groups.B||[]).slice(0,10),
        C: (plan.groups.C||[]).slice(0,10),
        D: (plan.groups.D||[]).slice(0,10)
      }
    };

    // ✅ step.js が見る判定キー（ここがズレると QUAL 扱いになる）
    st.worldPhase = st.world.phase;

    // ---------------------------------------------------------
    // ✅ v4.8: FINALは「セッション型」を使わない（5試合固定バグ潰し）
    // ---------------------------------------------------------
    if (String(st.world.phase||'').toLowerCase() === 'final'){
      // FINALは20チーム固定（tour_state.world.finalIds があれば最優先）
      const savedFinal = Array.isArray(tourState?.world?.finalIds) ? tourState.world.finalIds.slice() : [];
      const finalIds = (savedFinal.length >= 20)
        ? uniq(savedFinal).slice(0,20)
        : uniq(st.world.roster40Ids).slice(0,20);

      const finalTeams = [];
      for (const id0 of finalIds){
        const id = String(id0||'');
        if (!id) continue;

        if (id === 'PLAYER'){
          finalTeams.push(playerRuntime);
        }else{
          const def = getCpuById(id);
          const rt = def && T._mkRuntimeTeamFromCpuDef ? T._mkRuntimeTeamFromCpuDef(def) : null;
          if (rt) finalTeams.push(rt);
        }

        if (finalTeams.length >= 20) break;
      }

      // 補完（足りない場合はworldから）
      if (finalTeams.length < 20){
        const pool = getCpuByPrefix('world');
        for (const def of pool){
          if (finalTeams.length >= 20) break;
          const cid = String(def?.teamId || def?.id || '');
          if (!cid) continue;
          if (finalTeams.some(t=>String(t?.id||'') === cid)) continue;
          const rt = T._mkRuntimeTeamFromCpuDef ? T._mkRuntimeTeamFromCpuDef(def) : null;
          if (rt) finalTeams.push(rt);
        }
      }

      for (const t of finalTeams) T.ensureTeamRuntimeShape(t);

      st.teams = finalTeams.slice(0,20);

      // 🔥 FINALは12試合固定
      st.matchCount = 12;

      // FINALは session 構造を使わない（AB(1/6) 等を出さない）
      st.national = null;

      // total for FINAL 20
      st.tournamentTotal = initTotalForIds(st.teams.map(t=>t.id));

      T.setState(st);
      T.setRequest('openTournament', { mode:'world', phase: st.world.phase });
      return st;
    }

    // step互換（現行資産の再利用：QUAL/WL は national構造を使う）
    st.national = {
      split: Number(tourState.split||0) || 1,
      plan,
      allTeamDefs,
      sessions: plan.sessions,
      sessionIndex: 0,
      sessionCount: plan.sessions.length,
      doneSessions: []
    };

    // 初期20（AB）
    st.teams = (T._buildTeamsForNationalSession && typeof T._buildTeamsForNationalSession === 'function')
      ? T._buildTeamsForNationalSession(allTeamDefs, plan, 0)
      : [];

    for (const t of st.teams) T.ensureTeamRuntimeShape(t);

    // total for 40
    st.tournamentTotal = initTotalForIds(['PLAYER'].concat(allNoPlayer));

    T.setState(st);
    T.setRequest('openTournament', { mode:'world', phase: st.world.phase });
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
