/* =========================================================
   sim_tournament_core_shared.js（FULL）
   - sim_tournament_core.js を 3分割するための「共通土台」
   - state/共通関数/内部ユーティリティを集約（削除ゼロで移植）
   - step本体は sim_tournament_core_step.js に置く
   - start/export は sim_tournament_core.js（entry）に置く

   ✅FIX（重要）:
   - setRequest を「{ type, payload }」に統一（entry/ui と整合）
     かつ互換のため payload の直置きも同時保持
   - setCenter3 を「state.center {a,b,c}」に統一（entry/ui と整合）
     かつ互換のため state.ui.center3 も同時保持
   ========================================================= */
'use strict';

window.MOBBR = window.MOBBR || {};
window.MOBBR.sim = window.MOBBR.sim || {};

(function(){

  // ===== dependency refs (keep same as original core) =====
  const L = window.MOBBR.sim.tournamentLogic;
  const R = window.MOBBR.sim.tournamentResult;

  const N = window.MOBBR?.sim?.tournamentCoreNational || null;
  const P = window.MOBBR?.sim?.tournamentCorePost || null;

  // ---- Local TOP10 key（post側と合わせる）----
  const K_LOCAL_TOP10 = 'mobbr_split1_local_top10';

  // ===== State =====
  let state = null;

  function getState(){ return state; }
  function setState(next){ state = next; return state; }

  function getPlayer(){
    return (state?.teams || []).find(t => t.isPlayer) || null;
  }
  function aliveTeams(){
    return (state?.teams || []).filter(t => !t.eliminated);
  }

  function ensureTeamRuntimeShape(t){
    if (!t) return;
    if (!Number.isFinite(Number(t.alive))) t.alive = 3;

    // ✅ power が NaN/undefined なら復旧（playerだけは calcPlayerTeamPower で復元）
    if (!Number.isFinite(Number(t.power))){
      if (t.isPlayer && L && typeof L.calcPlayerTeamPower === 'function'){
        const v = Number(L.calcPlayerTeamPower());
        t.power = Number.isFinite(v) ? v : 55;
      }else{
        t.power = 55;
      }
    }

    if (t.eliminated !== true) t.eliminated = false;
    if (!Number.isFinite(Number(t.areaId))) t.areaId = 1;
    if (!Number.isFinite(Number(t.treasure))) t.treasure = 0;
    if (!Number.isFinite(Number(t.flag))) t.flag = 0;

    if (!Number.isFinite(Number(t.kills_total))) t.kills_total = 0;
    if (!Number.isFinite(Number(t.assists_total))) t.assists_total = 0;
    if (!Number.isFinite(Number(t.downs_total))) t.downs_total = 0;

    if (!Number.isFinite(Number(t.eliminatedRound))) t.eliminatedRound = 0;

    if (!t.eventBuffs || typeof t.eventBuffs !== 'object'){
      t.eventBuffs = { aim:0, mental:0, agi:0 };
    }

    if (!Array.isArray(t.members)) t.members = [];
    if (t.members.length < 3){
      const roles = ['IGL','ATTACKER','SUPPORT'];
      const base = t.members.slice();
      for (let i=base.length;i<3;i++){
        base.push({
          role: roles[i],
          name: `${t.id || 'TEAM'}_${roles[i]}`,
          kills: 0,
          assists: 0
        });
      }
      t.members = base;
    }else{
      for (let i=0;i<t.members.length;i++){
        const m = t.members[i] || (t.members[i]={});
        if (!m.role) m.role = (i===0?'IGL':(i===1?'ATTACKER':'SUPPORT'));
        if (!m.name) m.name = `${t.id || 'TEAM'}_${m.role}`;
        if (!Number.isFinite(Number(m.kills))) m.kills = 0;
        if (!Number.isFinite(Number(m.assists))) m.assists = 0;
      }
    }
  }

  function computeCtx(){
    const player = getPlayer();
    const coachFlags = window.MOBBR?.sim?.matchFlow?.getPlayerCoachFlags
      ? window.MOBBR.sim.matchFlow.getPlayerCoachFlags()
      : {};
    return { state, player, playerCoach: coachFlags };
  }

  // ===== UI helper =====
  // ✅FIX: requestの形を core(entry)/ui と揃える
  //  - state.request = { type, payload }
  //  - 互換のため payload のキーも直置き（UIが request.icon を見ても動く）
  function setRequest(type, payload){
    if (!state) return;
    const t = String(type || 'noop');
    const p = (payload && typeof payload === 'object') ? payload : {};
    state.request = { type: t, payload: p };
    try{
      for (const k of Object.keys(p)){
        state.request[k] = p[k];
      }
    }catch(_){}
  }

  // ✅FIX: centerの形を core(entry) と揃える
  //  - state.center = {a,b,c}
  //  - 互換のため state.ui.center3 = [a,b,c] も同時保持
  function setCenter3(a,b,c){
    if (!state) return;
    const A = String(a||'');
    const B = String(b||'');
    const C = String(c||'');
    state.center = { a:A, b:B, c:C };
    if (!state.ui || typeof state.ui !== 'object') state.ui = {};
    state.ui.center3 = [A,B,C];
  }

  // ===== public methods for UI to call =====
  function getCoachMaster(){ return L.COACH_MASTER; }
  function getEquippedCoachList(){ return L.getEquippedCoachSkills(); }
  function setCoachSkill(skillId){
    const id = String(skillId||'');
    if (!id || !L.COACH_MASTER[id]){
      state.selectedCoachSkill = null;
      state.selectedCoachQuote = '';
      return;
    }
    state.selectedCoachSkill = id;
    state.selectedCoachQuote = L.COACH_MASTER[id].quote || '';
  }
  function getPlayerSkin(){ return L.getEquippedSkin(); }
  function getAreaInfo(areaId){ return L.getAreaInfo(areaId); }

  function applyEventForTeam(team){
    return L.applyEventForTeam(state, team, computeCtx);
  }

  function initMatchDrop(){
    state.h2h = {};

    L.resetForNewMatch(state);
    L.initDropPositions(state, getPlayer);

    const p = getPlayer();
    if (p){
      const info = getAreaInfo(p.areaId);
      if (!state.ui || typeof state.ui !== 'object') state.ui = {};
      state.ui.bg = info.img || state.ui.bg;
    }
  }

  // ===== core sim =====
  function simulateRound(round){
    const ctx = computeCtx();
    const matches = L.buildMatchesForRound(state, round, getPlayer, aliveTeams);

    const out = {
      round,
      matches: matches.map(([A,B])=>({ aId:A.id, bId:B.id }))
    };

    for(const [A,B] of matches){
      ensureTeamRuntimeShape(A);
      ensureTeamRuntimeShape(B);

      const mult = L.coachMultForRound(state, round);
      let aBackup = null, bBackup = null;

      if (A.isPlayer){
        aBackup = A.power;
        A.power = L.clamp(A.power * mult, 1, 100);
      }
      if (B.isPlayer){
        bBackup = B.power;
        B.power = L.clamp(B.power * mult, 1, 100);
      }

      const res = window.MOBBR?.sim?.matchFlow?.resolveBattle
        ? window.MOBBR.sim.matchFlow.resolveBattle(A, B, round, ctx)
        : null;

      if (A.isPlayer && aBackup !== null) A.power = aBackup;
      if (B.isPlayer && bBackup !== null) B.power = bBackup;

      if (res){
        if (!out.results) out.results = [];
        out.results.push(res);
      }

      const pNow = getPlayer();
      if (pNow && pNow.eliminated){
        out.playerEliminated = true;
        break;
      }
    }

    if (round <= 5) L.moveAllTeamsToNextRound(state, round);
    else{
      for(const t of state.teams){
        if (!t.eliminated) t.areaId = 25;
      }
    }

    return out;
  }

  function fastForwardToMatchEnd(){
    while(state.round <= 6){
      const r = state.round;

      if (r === 6){
        for(const t of state.teams){
          if (!t.eliminated) t.areaId = 25;
        }
      }

      const matches = L.buildMatchesForRound(state, r, getPlayer, aliveTeams);
      const ctx = computeCtx();

      for(const [A,B] of matches){
        if (window.MOBBR?.sim?.matchFlow?.resolveBattle){
          window.MOBBR.sim.matchFlow.resolveBattle(A, B, r, ctx);
        }
      }

      if (r <= 5) L.moveAllTeamsToNextRound(state, r);
      state.round++;
    }
    state.round = 7;
  }

  function finishMatchAndBuildResult(){
    const rows = R.computeMatchResultTable(state);
    R.addToTournamentTotal(state, rows);
    state.lastMatchResultRows = rows;
  }

  function startNextMatch(){
    state.matchIndex += 1;
    state.round = 1;
    state.selectedCoachSkill = null;
    state.selectedCoachQuote = '';
    initMatchDrop();
  }

  function isTournamentFinished(){
    if (!state) return true;

    if (state.mode === 'local'){
      return state.matchIndex > state.matchCount;
    }

    if (state.mode === 'national'){
      const s = state.national || {};
      const lastSession = (Number(s.sessionIndex||0) >= (Number(s.sessionCount||6) - 1));
      const lastMatchDone = (state.matchIndex > state.matchCount);
      return !!(lastSession && lastMatchDone);
    }

    return state.matchIndex > state.matchCount;
  }

  function resolveOneBattle(A, B, round){
    return L.resolveOneBattle(state, A, B, round, ensureTeamRuntimeShape, computeCtx);
  }

  // =========================================================
  // NATIONAL（分離モジュールがあればそれを使う）
  // =========================================================
  function _cloneDeep(v){
    if (N?.cloneDeep) return N.cloneDeep(v);
    return JSON.parse(JSON.stringify(v));
  }

  function _getAllCpuTeams(){
    try{
      const d = window.DataCPU;
      if (!d) return [];
      let all = [];
      if (typeof d.getAllTeams === 'function') all = d.getAllTeams() || [];
      else if (typeof d.getALLTeams === 'function') all = d.getALLTeams() || [];
      else if (Array.isArray(d.TEAMS)) all = d.TEAMS;
      if (!Array.isArray(all)) all = [];
      return all;
    }catch(e){
      return [];
    }
  }

  function _getCpuTeamsByPrefix(prefix){
    if (N?.getCpuTeamsByPrefix) return N.getCpuTeamsByPrefix(prefix);

    const all = _getAllCpuTeams();
    const p = String(prefix||'').toLowerCase();
    return all.filter(t=>{
      const id = String(t?.teamId || t?.id || '').toLowerCase();
      return id.startsWith(p);
    });
  }

  function _getCpuTeamsByIds(ids){
    const set = new Set((ids||[]).map(x=>String(x||'')).filter(Boolean));
    if (!set.size) return [];
    const all = _getAllCpuTeams();
    return all.filter(t=>{
      const id = String(t?.teamId || t?.id || '');
      return set.has(id);
    });
  }

  function _mkRuntimeTeamFromCpuDef(c){
    if (N?.mkRuntimeTeamFromCpuDef) return N.mkRuntimeTeamFromCpuDef(c);

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

    return {
      id,
      name: nm,
      isPlayer: false,
      power: L.rollCpuTeamPowerFromMembers(c),

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

  function _makePlayerRuntime(){
    if (N?.makePlayerRuntime) return N.makePlayerRuntime();

    const pPowRaw = (L && typeof L.calcPlayerTeamPower === 'function') ? Number(L.calcPlayerTeamPower()) : NaN;
    const pPow = Number.isFinite(pPowRaw) ? pPowRaw : 55;

    return {
      id: 'PLAYER',
      name: localStorage.getItem(L.K.teamName) || 'PLAYER TEAM',
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

  // ✅ ローカルTOP10（Player除く9）を A～D に 1/3/2/3 で振り分け、残りはナショナルで埋める
  function _buildNationalPlanWithLocalTop10(localIds9, nationalIds30){
    const local = L.shuffle((localIds9||[]).map(String).filter(Boolean));
    const nat = L.shuffle((nationalIds30||[]).map(String).filter(Boolean));

    // groups（PLAYERは別枠で入れるのでここには入れない）
    const A = [];
    const B = [];
    const C = [];
    const D = [];

    // local 9: A1 / B3 / C2 / D3 ＝ 合計9
    const aLocal = local.slice(0, 1);
    const bLocal = local.slice(1, 4);
    const cLocal = local.slice(4, 6);
    const dLocal = local.slice(6, 9);

    A.push(...aLocal);
    B.push(...bLocal);
    C.push(...cLocal);
    D.push(...dLocal);

    // 目標：A=9 / B=10 / C=10 / D=10（合計39）
    const target = { A:9, B:10, C:10, D:10 };

    function fillTo(arr, want){
      while(arr.length < want && nat.length){
        const id = nat.shift();
        if (!id) continue;
        if (A.includes(id) || B.includes(id) || C.includes(id) || D.includes(id)) continue;
        arr.push(id);
      }
    }

    fillTo(A, target.A);
    fillTo(B, target.B);
    fillTo(C, target.C);
    fillTo(D, target.D);

    // セッション順固定
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

  function _buildTeamsForNationalSession(allTeamDefs, plan, sessionIndex){
    if (N?.buildTeamsForNationalSession) return N.buildTeamsForNationalSession(allTeamDefs, plan, sessionIndex);

    const s = plan.sessions[sessionIndex];
    const g = plan.groups;

    const pick = [];
    for (const gr of (s?.groups || [])){
      const list = g[gr] || [];
      pick.push(...list);
    }

    const includesA = (s?.groups || []).includes('A');
    const out = [];

    if (includesA){
      out.push(_cloneDeep(allTeamDefs.PLAYER));
    }
    for (const id of pick){
      const def = allTeamDefs[id];
      if (def) out.push(_cloneDeep(def));
    }

    // 念のため不足埋め（通常は20になる）
    if (out.length < 20){
      const allIds = []
        .concat(g.A||[], g.B||[], g.C||[], g.D||[])
        .filter(Boolean);
      const rest = allIds.filter(x => !out.some(t=>t.id===x));
      for (const id of rest){
        if (out.length >= 20) break;
        const def = allTeamDefs[id];
        if (def) out.push(_cloneDeep(def));
      }
    }
    if (out.length > 20) out.length = 20;

    return out;
  }

  function _setNationalBanners(){
    const s = state.national || {};
    const si = Number(s.sessionIndex||0);
    const sc = Number(s.sessionCount||6);
    const key = String(s.sessions?.[si]?.key || `S${si+1}`);

    state.bannerLeft  = `NATIONAL ${key} (${si+1}/${sc})`;
    state.bannerRight = `MATCH ${state.matchIndex} / ${state.matchCount}`;
  }

  function _getSessionKey(idx){
    const s = state?.national || {};
    const i = Number.isFinite(Number(idx)) ? Number(idx) : Number(s.sessionIndex||0);
    return String(s.sessions?.[i]?.key || '');
  }

  function _markSessionDone(key){
    if (!state?.national) return;
    const k = String(key||'').trim();
    if (!k) return;
    if (!Array.isArray(state.national.doneSessions)) state.national.doneSessions = [];
    if (!state.national.doneSessions.includes(k)) state.national.doneSessions.push(k);
  }

  function _sessionHasPlayer(sessionIndex){
    const nat = state?.national || {};
    const s = nat.sessions?.[sessionIndex];
    const groups = s?.groups || [];
    return groups.includes('A'); // Aを含むセッションだけPLAYERが出る
  }

  // ✅ A無しセッションを「完全オート高速処理」：5 match
  function _autoRunNationalSession(){
    // 5 match
    for (let mi=1; mi<=state.matchCount; mi++){
      state.matchIndex = mi;
      state.round = 1;
      state.selectedCoachSkill = null;
      state.selectedCoachQuote = '';

      initMatchDrop();
      // 全ラウンド高速
      fastForwardToMatchEnd();
      finishMatchAndBuildResult();
    }
  }

  // =========================================================
  // LastChance / World 用のユーティリティ（元ファイルから移植）
  // =========================================================
  function _getCpuTeamsByPrefixStrict(prefix){
    // 互換：World/LastChance は prefix で引くので、上の _getCpuTeamsByPrefix を使う
    return _getCpuTeamsByPrefix(prefix);
  }

  // =========================================================
  // expose internal shared namespace
  // =========================================================
  window.MOBBR.sim._tcore = window.MOBBR.sim._tcore || {};

  const T = window.MOBBR.sim._tcore;

  // deps
  T.L = L;
  T.R = R;
  T.N = N;
  T.P = P;

  // constants
  T.K_LOCAL_TOP10 = K_LOCAL_TOP10;

  // state
  T.getState = getState;
  T.setState = setState;
  T.getPlayer = getPlayer;
  T.aliveTeams = aliveTeams;

  // shared funcs
  T.ensureTeamRuntimeShape = ensureTeamRuntimeShape;
  T.computeCtx = computeCtx;

  T.setRequest = setRequest;
  T.setCenter3 = setCenter3;

  T.getCoachMaster = getCoachMaster;
  T.getEquippedCoachList = getEquippedCoachList;
  T.setCoachSkill = setCoachSkill;
  T.getPlayerSkin = getPlayerSkin;
  T.getAreaInfo = getAreaInfo;

  T.applyEventForTeam = applyEventForTeam;
  T.initMatchDrop = initMatchDrop;

  T.simulateRound = simulateRound;
  T.fastForwardToMatchEnd = fastForwardToMatchEnd;
  T.finishMatchAndBuildResult = finishMatchAndBuildResult;
  T.startNextMatch = startNextMatch;
  T.isTournamentFinished = isTournamentFinished;
  T.resolveOneBattle = resolveOneBattle;

  // national internals
  T._cloneDeep = _cloneDeep;
  T._getAllCpuTeams = _getAllCpuTeams;
  T._getCpuTeamsByPrefix = _getCpuTeamsByPrefix;
  T._getCpuTeamsByIds = _getCpuTeamsByIds;
  T._mkRuntimeTeamFromCpuDef = _mkRuntimeTeamFromCpuDef;
  T._makePlayerRuntime = _makePlayerRuntime;
  T._buildNationalPlanWithLocalTop10 = _buildNationalPlanWithLocalTop10;
  T._buildTeamsForNationalSession = _buildTeamsForNationalSession;

  T._setNationalBanners = _setNationalBanners;
  T._getSessionKey = _getSessionKey;
  T._markSessionDone = _markSessionDone;
  T._sessionHasPlayer = _sessionHasPlayer;
  T._autoRunNationalSession = _autoRunNationalSession;

  // misc
  T._getCpuTeamsByPrefixStrict = _getCpuTeamsByPrefixStrict;

})();
