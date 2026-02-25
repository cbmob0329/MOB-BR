'use strict';

/*
  sim_tournament_core_shared.js（FULL） v4.9
  - sim_tournament_core.js を 3分割するための「共通土台」
  - state/共通関数/内部ユーティリティを集約（削除ゼロで移植）
  - step本体は sim_tournament_core_step.js に置く
  - start/export は sim_tournament_core.js（entry）に置く

  ✅FIX（重要・大会が始まらない対策の本命）:
  - request を「新旧両対応」にする（互換レイヤー）
    新: state.requestObj = { type, payload }
    旧: state.request = 'openTournament'（文字列も維持）
    さらに互換：state.ui.req / state.ui.request / state.ui.reqObj も保持
  - UI側がどの形式を見ていても確実に拾えるように
    peekUiRequest / consumeUiRequest を _tcore に提供

  ✅既存FIX（維持）:
  - setCenter3 を「state.center {a,b,c}」に統一（entry/ui と整合）
    かつ互換のため state.ui.center3 も同時保持
  - tournamentResult(R) を “固定参照” しない（ロード順/差し替えで総合0になるのを防止）
  - NATIONAL / WORLD の左上表示で「MATCH」を必ず表記できるように、
    _setNationalBanners() で bannerLeft に MATCH を常時含める（bannerRight は ROUND/降下 等の上書き用）
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.sim = window.MOBBR.sim || {};

(function(){

  // ===== dependency refs (keep same as original core) =====
  const L = window.MOBBR.sim.tournamentLogic;

  // ✅ IMPORTANT: R はロード順/差し替えで変わりうるので固定参照しない
  function getR(){
    return window.MOBBR?.sim?.tournamentResult
        || window.MOBBR?.sim?._tcore?.R
        || null;
  }

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

  // =========================================================
  // ✅ UI Request helper（新旧両対応の核）
  //  - UIがどこを見ていても request を拾えるようにする
  // =========================================================

  function _ensureUiObj(){
    if (!state) return null;
    if (!state.ui || typeof state.ui !== 'object') state.ui = {};
    return state.ui;
  }

  // ✅FIX: requestの形を「新旧両対応」で保持
  //
  // 新: state.requestObj = { type, payload }
  // 旧: state.request = 'openTournament'（文字列）
  // 互換: state.request（オブジェクト）を見ている実装にも耐えるため
  //      state.requestObj のコピーを state.requestObjFlat に持つ
  //      さらに state.ui.req / state.ui.request / state.ui.reqObj / state.ui.requestObj も同期
  function setRequest(type, payload){
    if (!state) return;

    const t = String(type || 'noop');
    const p = (payload && typeof payload === 'object') ? payload : {};

    // --- NEW canonical ---
    state.requestObj = { type: t, payload: p };

    // --- also keep a flat copy for legacy "req.icon" style reads ---
    // (ui_tournament 側が req.payload ではなく req.icon を見ても壊れない)
    state.requestObjFlat = { type: t, payload: p };
    try{
      for (const k of Object.keys(p)){
        state.requestObjFlat[k] = p[k];
      }
    }catch(_){}

    // --- LEGACY string mode (most common old pattern) ---
    // old UI might do: if (state.request === 'openTournament') ...
    state.request = t;

    // --- LEGACY object mode (some old implementations) ---
    // old UI might do: st.request.type / st.request.payload
    // ただし上の文字列と衝突するので、別名で置く方が安全。
    // それでも "state.request" をオブジェクトとして参照している場合に備えて
    // state.ui.req を必ずオブジェクトで持つ。
    const ui = _ensureUiObj();
    if (ui){
      ui.reqObj = { type: t, payload: p };
      ui.requestObj = ui.reqObj;

      // よくある旧キー
      ui.req = ui.reqObj;
      ui.request = ui.reqObj;

      // 旧UIが ui.req.icon を直接読むケースにも耐える
      try{
        for (const k of Object.keys(p)){
          ui.reqObj[k] = p[k];
        }
      }catch(_){}
    }
  }

  // UI（ui_tournament側）から「次の描画要求」を取得するための共通API
  function peekUiRequest(){
    const st = state;
    if (!st) return null;

    // 1) ui.req / ui.request（最優先：今回ここに必ず入れる）
    try{
      const u = st.ui;
      if (u && u.req && typeof u.req === 'object' && u.req.type) return u.req;
      if (u && u.request && typeof u.request === 'object' && u.request.type) return u.request;
      if (u && u.reqObj && typeof u.reqObj === 'object' && u.reqObj.type) return u.reqObj;
      if (u && u.requestObj && typeof u.requestObj === 'object' && u.requestObj.type) return u.requestObj;
    }catch(_){}

    // 2) requestObj（新）
    try{
      if (st.requestObj && typeof st.requestObj === 'object' && st.requestObj.type) return st.requestObj;
    }catch(_){}

    // 3) requestObjFlat（新・flat）
    try{
      if (st.requestObjFlat && typeof st.requestObjFlat === 'object' && st.requestObjFlat.type) return st.requestObjFlat;
    }catch(_){}

    // 4) request（旧：文字列）
    try{
      if (typeof st.request === 'string' && st.request){
        return { type: st.request, payload: {} };
      }
    }catch(_){}

    return null;
  }

  function consumeUiRequest(){
    const st = state;
    if (!st) return;

    // ui側
    try{
      if (st.ui){
        if ('req' in st.ui) st.ui.req = null;
        if ('request' in st.ui) st.ui.request = null;
        if ('reqObj' in st.ui) st.ui.reqObj = null;
        if ('requestObj' in st.ui) st.ui.requestObj = null;
      }
    }catch(_){}

    // core側
    try{
      if ('requestObj' in st) st.requestObj = null;
      if ('requestObjFlat' in st) st.requestObjFlat = null;
    }catch(_){}

    // 旧文字列は noop に戻す（null だと旧UIが詰まる実装があるため）
    try{
      st.request = 'noop';
    }catch(_){}
  }

  // ===== UI helper =====
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
    // ✅ R を都度取得（固定参照禁止）
    const R2 = getR();
    if (!R2 || typeof R2.computeMatchResultTable !== 'function' || typeof R2.addToTournamentTotal !== 'function'){
      console.error('[tournament_core_shared] tournamentResult not ready / missing methods', {
        hasR: !!R2,
        computeMatchResultTable: !!R2?.computeMatchResultTable,
        addToTournamentTotal: !!R2?.addToTournamentTotal
      });
      state.lastMatchResultRows = [];
      return;
    }

    const rows = R2.computeMatchResultTable(state);
    R2.addToTournamentTotal(state, rows);
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

    // ✅ MATCHを必ず常時表示（bannerRightはROUND/降下など上書き用）
    state.bannerLeft  = `NATIONAL ${key} (${si+1}/${sc})  MATCH ${state.matchIndex} / ${state.matchCount}`;
    state.bannerRight = ''; // ROUND/降下/AUTO 等で上書きされる前提
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
  T.R = getR();          // 初期値（※固定参照ではない。実利用は getR() を推奨）
  T.getR = getR;         // ✅ 外からも最新Rを取れるように
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

  // ✅ request (new+legacy)
  T.setRequest = setRequest;
  T.peekUiRequest = peekUiRequest;
  T.consumeUiRequest = consumeUiRequest;

  // center
  T.setCenter3 = setCenter3;

  // UI-facing helpers
  T.getCoachMaster = getCoachMaster;
  T.getEquippedCoachList = getEquippedCoachList;
  T.setCoachSkill = setCoachSkill;
  T.getPlayerSkin = getPlayerSkin;
  T.getAreaInfo = getAreaInfo;

  T.applyEventForTeam = applyEventForTeam;
  T.initMatchDrop = initMatchDrop;

  // sim
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
