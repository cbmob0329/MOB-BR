/* =========================================================
   sim_tournament_core.js（FULL） v4.3
   - tournament core (entry)
   - shared(_tcore) + step(_tcore.step) を使って駆動
   - Local / National / LastChance / World(qual/wl/final) の開始API
   - ✅ LastChance:
       - 20チーム固定 / セッション分割なし / 5試合 / 上位2のみWorld権利
       - 参加チームは National最終順位 9〜28位（20チーム）
   - ✅ World:
       - 権利10（National上位8 + LastChance上位2）
       - world01〜world40 の「戦闘力トップ10」は毎回固定出場
       - 残り20は重み抽選（強いほど出やすい）で決定
   ========================================================= */
'use strict';

window.MOBBR = window.MOBBR || {};
window.MOBBR.sim = window.MOBBR.sim || {};

(function(){

  // =========================================================
  // Storage Keys（core_post.js と合わせる）
  // =========================================================
  const K = {
    tourState: 'mobbr_tour_state',
    lastResult: 'mobbr_last_tournament_result',

    // 互換（昔）
    playerTeam: 'mobbr_playerTeam',
    teamName: 'mobbr_team',
    equippedSkin: 'mobbr_equippedSkin',
    equippedCoachSkills: 'mobbr_equippedCoachSkills'
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
  // Shared object scaffold
  // =========================================================
  const _tcore = window.MOBBR.sim._tcore = window.MOBBR.sim._tcore || {};

  // ---- dependencies (logic / result / step are loaded before this file) ----
  const L = window.MOBBR?.sim?.tournamentLogic;
  const R = window.MOBBR?.sim?.tournamentResult;

  if (!L || !R){
    console.error('[tournament_core] logic/result missing. Ensure load order: logic -> result -> core_shared -> core_step -> core(entry)');
    return;
  }

  _tcore.L = L;
  _tcore.R = R;

  // post hook (optional)
  _tcore.P = window.MOBBR?.sim?.tournamentCorePost || null;

  // =========================================================
  // State holder
  // =========================================================
  let _state = null;

  function getState(){ return _state; }
  function setState(s){ _state = s; }

  _tcore.getState = getState;
  _tcore._setState = setState;

  // =========================================================
  // Utilities (team shape, player getter, etc.)
  // =========================================================
  function ensureTeamRuntimeShape(t){
    if (!t) return;

    if (t.alive === undefined || t.alive === null) t.alive = 3;
    if (t.eliminated === undefined || t.eliminated === null) t.eliminated = false;

    if (!t.eventBuffs || typeof t.eventBuffs !== 'object'){
      t.eventBuffs = { aim:0, mental:0, agi:0 };
    }else{
      t.eventBuffs.aim = Number(t.eventBuffs.aim||0);
      t.eventBuffs.mental = Number(t.eventBuffs.mental||0);
      t.eventBuffs.agi = Number(t.eventBuffs.agi||0);
    }

    if (t.treasure === undefined || t.treasure === null) t.treasure = 0;
    if (t.flag === undefined || t.flag === null) t.flag = 0;

    if (t.kills_total === undefined || t.kills_total === null) t.kills_total = 0;
    if (t.assists_total === undefined || t.assists_total === null) t.assists_total = 0;
    if (t.downs_total === undefined || t.downs_total === null) t.downs_total = 0;

    if (!Array.isArray(t.members)) t.members = [];
  }

  _tcore.ensureTeamRuntimeShape = ensureTeamRuntimeShape;

  function getPlayer(){
    if (!_state || !_state.teams) return null;
    return _state.teams.find(t => !!t.isPlayer) || _state.teams.find(t => String(t.id) === 'PLAYER') || null;
  }
  _tcore.getPlayer = getPlayer;

  function aliveTeams(){
    if (!_state || !_state.teams) return [];
    return _state.teams.filter(t => t && !t.eliminated);
  }
  _tcore.aliveTeams = aliveTeams;

  function computeCtx(){
    // matchEvents / matchFlow が使うコンテキスト
    const s = _state || {};
    return {
      mode: String(s.mode||''),
      round: Number(s.round||0),
      matchIndex: Number(s.matchIndex||0),
      matchCount: Number(s.matchCount||0),
      split: Number(getJSON(K.tourState, {})?.split || 0),
      // UIに%は出さない前提なので、ここは内部で使うだけ
      now: Date.now()
    };
  }
  _tcore.computeCtx = computeCtx;

  // UI request pipe (ui_tournament.js が読む)
  function setRequest(type, payload){
    if (!_state) return;
    _state.request = { type: String(type||'noop'), payload: payload || {} };
  }
  _tcore.setRequest = setRequest;

  function setCenter3(a,b,c){
    if (!_state) return;
    _state.center = { a:String(a||''), b:String(b||''), c:String(c||'') };
  }
  _tcore.setCenter3 = setCenter3;

  function getEquippedCoachList(){
    return L.getEquippedCoachSkills ? (L.getEquippedCoachSkills() || []) : [];
  }
  _tcore.getEquippedCoachList = getEquippedCoachList;

  function getPlayerSkin(){
    return L.getEquippedSkin ? L.getEquippedSkin() : 'P1.png';
  }
  _tcore.getPlayerSkin = getPlayerSkin;

  function getAreaInfo(areaId){
    return L.getAreaInfo ? L.getAreaInfo(areaId) : { id:areaId, name:`Area${areaId}`, img:'' };
  }
  _tcore.getAreaInfo = getAreaInfo;

  // =========================================================
  // Event / Drop / Battle helpers
  // =========================================================
  function applyEventForTeam(team){
    if (!_state || !team) return null;
    if (!L.applyEventForTeam) return null;
    return L.applyEventForTeam(_state, team, computeCtx);
  }
  _tcore.applyEventForTeam = applyEventForTeam;

  function initMatchDrop(){
    if (!_state) return;

    // reset
    if (L.resetForNewMatch) L.resetForNewMatch(_state);

    // assign base powers for CPU, and player power
    for (const t of (_state.teams||[])){
      ensureTeamRuntimeShape(t);

      // Power:
      if (t.isPlayer){
        // ✅ UIのチーム%（teamPower）を反映（logicのcalcPlayerTeamPower）
        const pwr = L.calcPlayerTeamPower ? L.calcPlayerTeamPower() : 55;
        t.power = Number(pwr||55);
      }else{
        // CPU power roll from members（min-max抽選）
        const pwr = L.rollCpuTeamPowerFromMembers ? L.rollCpuTeamPowerFromMembers(t._def || t) : (t.basePower||70);
        t.power = Number(pwr||70);
      }
    }

    // drop positions
    if (L.initDropPositions) L.initDropPositions(_state, getPlayer);
  }
  _tcore.initMatchDrop = initMatchDrop;

  function resolveOneBattle(A,B,round){
    if (!_state) return null;
    if (!L.resolveOneBattle) return null;
    return L.resolveOneBattle(_state, A, B, round, ensureTeamRuntimeShape, computeCtx);
  }
  _tcore.resolveOneBattle = resolveOneBattle;

  // =========================================================
  // Match end / results
  // =========================================================
  function fastForwardToMatchEnd(){
    if (!_state) return;

    // プレイヤー敗北全滅時：残りの進行を高速で終わらせる
    // （イベント/接敵はもう発生させない：match_result へ直行）
    // roundを最終へ
    _state.round = 6;

    // CPU同士の残りバトル解決は result側の集計に任せつつ
    // ここでは「生存者を1チームに絞る」だけやるのではなく、
    // matchFlow.resolveBattle で逐次進めたいが、時間/安全性のため:
    // -> finishMatchAndBuildResult 内で整合する設計（result.jsが順位確定）
  }
  _tcore.fastForwardToMatchEnd = fastForwardToMatchEnd;

  function finishMatchAndBuildResult(){
    if (!_state) return;

    // resultモジュールへ試合結果確定を委譲
    if (R.finishMatchAndBuildResult){
      const out = R.finishMatchAndBuildResult(_state);
      if (out && out.rows) _state.lastMatchResultRows = out.rows;
      if (out && out.total) _state.tournamentTotal = out.total;
      return;
    }

    // fallback（最低限）
    _state.lastMatchResultRows = [];
    _state.tournamentTotal = _state.tournamentTotal || {};
  }
  _tcore.finishMatchAndBuildResult = finishMatchAndBuildResult;

  function startNextMatch(){
    if (!_state) return;

    _state.matchIndex = Number(_state.matchIndex||1) + 1;
    _state.round = 1;

    _state.selectedCoachSkill = null;
    _state.selectedCoachQuote = '';

    // teamsの試合内リセット
    if (L.resetForNewMatch) L.resetForNewMatch(_state);
  }
  _tcore.startNextMatch = startNextMatch;

  // =========================================================
  // National session helpers (existing flow used by step.js)
  // =========================================================
  function _setNationalBanners(){
    if (!_state) return;
    const nat = _state.national || {};
    const si = Number(nat.sessionIndex||0);
    const sc = Number(nat.sessionCount||6);
    const key = String(nat.sessions?.[si]?.key || `S${si+1}`);
    _state.bannerLeft = `NATIONAL ${key}`;
    _state.bannerRight = `${si+1}/${sc}`;
  }
  _tcore._setNationalBanners = _setNationalBanners;

  function _getSessionKey(idx){
    const nat = _state?.national || {};
    const s = nat.sessions?.[Number(idx)||0];
    return s ? String(s.key||'') : '';
  }
  _tcore._getSessionKey = _getSessionKey;

  function _markSessionDone(key){
    if (!_state) return;
    if (!_state.national) _state.national = {};
    if (!_state.national.doneMap) _state.national.doneMap = {};
    _state.national.doneMap[String(key||'')] = true;
  }
  _tcore._markSessionDone = _markSessionDone;

  function _sessionHasPlayer(sessionIndex){
    const nat = _state?.national || {};
    const s = nat.sessions?.[Number(sessionIndex)||0];
    const groups = Array.isArray(s?.groups) ? s.groups : [];
    // プレイヤーは必ずA
    return groups.includes('A');
  }
  _tcore._sessionHasPlayer = _sessionHasPlayer;

  function _buildTeamsForNationalSession(allTeamDefs, plan, sessionIndex){
    // plan: nat.plan, allTeamDefs: nat.allTeamDefs
    // session: groups A/B/C/D
    const nat = _state?.national || {};
    const s = nat.sessions?.[Number(sessionIndex)||0];
    const groups = Array.isArray(s?.groups) ? s.groups : [];

    // plan.groupMap: { A:[teamIds], B:[...], ... } を想定
    const groupMap = plan && plan.groupMap ? plan.groupMap : {};
    const ids = [];
    for (const g of groups){
      const a = Array.isArray(groupMap[g]) ? groupMap[g] : [];
      for (const id of a) ids.push(String(id||''));
    }

    // ids should be 20
    const defsById = new Map();
    for (const d of (allTeamDefs||[])){
      const id = String(d.id||d.teamId||'');
      if (id) defsById.set(id, d);
    }

    const teams = ids.map(id => {
      const def = defsById.get(id);
      if (!def) return null;
      return materializeTeamFromDef(def);
    }).filter(Boolean);

    return teams;
  }
  _tcore._buildTeamsForNationalSession = _buildTeamsForNationalSession;

  function _autoRunNationalSession(){
    // プレイヤー不在セッションを高速処理：
    // 5試合分を core/step と同等に回す（UI無し）
    if (!_state) return;

    const maxMatches = Number(_state.matchCount||5);
    for (let mi=Number(_state.matchIndex||1); mi<=maxMatches; mi++){
      _state.matchIndex = mi;
      _state.round = 1;

      _state.selectedCoachSkill = null;
      _state.selectedCoachQuote = '';

      initMatchDrop();

      // R1..R6
      for (let r=1; r<=6; r++){
        _state.round = r;

        // events (player無いので実質無しだが、CPUにもイベントがある仕様なら回す)
        const evCount = L.eventCount ? L.eventCount(r) : 0;
        if (evCount > 0){
          // CPU全員に一括で…は重いので「抽選は内部」でOK。
          // ここは UI出さないため省略し、battle結果に委ねる。
        }

        // battles
        const matches = L.buildMatchesForRound ? L.buildMatchesForRound(_state, r, getPlayer, aliveTeams) : [];
        for (const pair of (matches||[])){
          const A = pair?.[0], B = pair?.[1];
          if (!A || !B) continue;
          resolveOneBattle(A,B,r);
        }

        // move
        if (r <= 5 && L.moveAllTeamsToNextRound){
          L.moveAllTeamsToNextRound(_state, r);
        }
      }

      // result
      finishMatchAndBuildResult();
    }
  }
  _tcore._autoRunNationalSession = _autoRunNationalSession;

  // =========================================================
  // Team materialization
  // =========================================================
  function getCpuAll(){
    const d = window.DataCPU;
    if (!d || typeof d.getAllTeams !== 'function') return [];
    const all = d.getAllTeams() || [];
    return Array.isArray(all) ? all : [];
  }

  function getCpuById(teamId){
    const d = window.DataCPU;
    if (!d) return null;

    if (typeof d.getById === 'function'){
      return d.getById(teamId);
    }

    const all = getCpuAll();
    return all.find(t => String(t.teamId) === String(teamId)) || null;
  }

  function materializeTeamFromDef(def){
    if (!def) return null;

    // def can be:
    // - player def: { id:'PLAYER', isPlayer:true, name, basePower/power, members, image }
    // - cpu def:    { id:'national01'|'world01' etc ... or teamId }

    const id = String(def.id || def.teamId || '');
    const isPlayer = !!def.isPlayer || (id === 'PLAYER');

    if (isPlayer){
      const name = String(def.name || 'PLAYER');
      return {
        id: 'PLAYER',
        isPlayer: true,
        name,
        power: Number(def.power || def.basePower || L.calcPlayerTeamPower?.() || 55),
        basePower: Number(def.basePower || def.power || 55),
        members: Array.isArray(def.members) ? def.members : [],
        image: String(def.image || getPlayerSkin()),
        _def: def
      };
    }

    // CPU team definition (from DataCPU)
    const cpu = def.teamId ? def : getCpuById(id);
    if (!cpu) return null;

    const teamId = String(cpu.teamId || id);
    return {
      id: teamId,
      isPlayer: false,
      name: String(cpu.name || teamId),
      power: Number(cpu.basePower || 70),
      basePower: Number(cpu.basePower || 70),
      members: Array.isArray(cpu.members) ? cpu.members : [],
      image: String(cpu.image || `cpu/${teamId}.png`),
      _def: cpu
    };
  }

  function buildPlayerDef(){
    // playerTeam storage fallback
    let nm = 'PLAYER';
    try{
      const raw = localStorage.getItem(K.playerTeam);
      if (raw){
        const t = JSON.parse(raw);
        nm = String(t?.teamName || t?.name || nm);
      }
    }catch(e){}
    return {
      id:'PLAYER',
      isPlayer:true,
      name:nm,
      power: L.calcPlayerTeamPower ? L.calcPlayerTeamPower() : 55,
      image: getPlayerSkin(),
      members:[]
    };
  }

  // =========================================================
  // Tournament total init
  // =========================================================
  function initTotalForTeams(teams){
    const total = {};
    for (const t of (teams||[])){
      if (!t) continue;
      const id = String(t.id||'');
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

  // =========================================================
  // ====== START APIs =======================================
  // =========================================================

  function startLocalTournament(){
    const playerDef = buildPlayerDef();

    // 20 teams: PLAYER + local01..local19
    const all = getCpuAll().filter(t => String(t.teamId||'').startsWith('local'));
    const cpu19 = all.slice(0,19);

    const teams = [
      materializeTeamFromDef(playerDef),
      ...cpu19.map(def => materializeTeamFromDef(def))
    ].filter(Boolean);

    // shape
    for (const t of teams) ensureTeamRuntimeShape(t);

    const state = {
      mode: 'local',
      phase: 'intro',

      matchIndex: 1,
      matchCount: 5,
      round: 1,

      teams,
      tournamentTotal: initTotalForTeams(teams),
      lastMatchResultRows: [],

      bannerLeft: '',
      bannerRight: '',
      center: { a:'', b:'', c:'' },

      selectedCoachSkill: null,
      selectedCoachQuote: '',

      ui: {
        bg: 'maps/neonmain.png',
        squareBg: 'tent.png',
        leftImg: getPlayerSkin(),
        rightImg: '',
        topLeftName: '',
        topRightName: ''
      },

      request: { type:'noop', payload:{} }
    };

    setState(state);
    setRequest('openTournament', { mode:'local' });
    return state;
  }

  function startNationalTournament(){
    // Nationalの編成自体は既存の安定版ロジック側に合わせる必要があるため、
    // ここでは「tourStateに保存されたNational roster」を使う方式に寄せる。
    const tourState = getJSON(K.tourState, null) || {};
    const split = Number(tourState.split||0) || 1;

    // Nationalは40チーム：
    // - Splitのローカルトップ10(保存済)は既存側で組み込み済想定
    // - それ以外の枠は national01..national39 から埋める
    // ただし、ここは既存安定版の構造（plan/session/auto-run）に合わせる
    const playerDef = buildPlayerDef();

    const allNat = getCpuAll().filter(t => String(t.teamId||'').startsWith('national'));
    const allNat39 = allNat.slice(0,39);

    // group plan: A/B/C/D 各10
    // Aには必ずPLAYER（仕様）
    const ids = [];
    ids.push('PLAYER');

    // 残り39枠は national01..national39
    for (const t of allNat39) ids.push(String(t.teamId||''));

    const allTeamDefs = ids.map(id=>{
      if (id === 'PLAYER') return playerDef;
      const cpu = getCpuById(id);
      return cpu ? { id: String(cpu.teamId), teamId:String(cpu.teamId) } : null;
    }).filter(Boolean);

    // plan: A/B/C/D 10ずつ (AはPLAYER含む)
    const pool = ids.slice(1); // exclude player
    const shuffled = L.shuffle ? L.shuffle(pool) : pool.slice();

    const A = ['PLAYER', ...shuffled.slice(0,9)];
    const B = shuffled.slice(9,19);
    const C = shuffled.slice(19,29);
    const D = shuffled.slice(29,39);

    const plan = { groupMap: { A, B, C, D } };

    const sessions = [
      { key:'AB', groups:['A','B'] },
      { key:'CD', groups:['C','D'] },
      { key:'AC', groups:['A','C'] },
      { key:'AD', groups:['A','D'] },
      { key:'BC', groups:['B','C'] },
      { key:'BD', groups:['B','D'] }
    ];

    // session0 teams (A+B)
    const state = {
      mode: 'national',
      phase: 'intro',

      matchIndex: 1,
      matchCount: 5,
      round: 1,

      teams: [],

      tournamentTotal: {},
      lastMatchResultRows: [],

      bannerLeft: '',
      bannerRight: '',
      center: { a:'', b:'', c:'' },

      selectedCoachSkill: null,
      selectedCoachQuote: '',

      ui: {
        bg: 'maps/neonmain.png',
        squareBg: 'tent.png',
        leftImg: getPlayerSkin(),
        rightImg: '',
        topLeftName: '',
        topRightName: ''
      },

      request: { type:'noop', payload:{} },

      national: {
        split,
        plan,
        allTeamDefs,
        sessions,
        sessionIndex: 0,
        sessionCount: 6,
        doneMap: {}
      }
    };

    setState(state);

    // build initial 20 teams for session AB
    const defs = allTeamDefs.map(d=>{
      // normalize defs
      const id = String(d.id||d.teamId||'');
      if (id === 'PLAYER') return playerDef;
      const cpu = getCpuById(id);
      return cpu || null;
    }).filter(Boolean);

    state.national.allTeamDefs = defs;

    state.teams = _buildTeamsForNationalSession(defs, plan, 0);
    for (const t of state.teams) ensureTeamRuntimeShape(t);

    // total is for 40 teams overall (PLAYER + 39)
    const totalTeams = ['PLAYER', ...pool].map(id=>{
      if (id === 'PLAYER') return materializeTeamFromDef(playerDef);
      const cpu = getCpuById(id);
      return materializeTeamFromDef(cpu);
    }).filter(Boolean);

    state.tournamentTotal = initTotalForTeams(totalTeams);

    setRequest('openTournament', { mode:'national' });
    return state;
  }

  // =========================================================
  // ✅ LastChance（20 teams / 5 matches / TOP2 -> World）
  //   roster: National final 9〜28位（20 teams）
  // =========================================================
  function startLastChanceTournament(){
    const tourState = getJSON(K.tourState, null) || {};

    // 必須：National最終順位の並び（PLAYER含む想定）
    const idsSorted = Array.isArray(tourState.lastNationalSortedIds) ? tourState.lastNationalSortedIds.slice() : [];

    // 9〜28位（index 8..27）
    const slice = idsSorted.slice(8, 28);
    if (slice.length !== 20){
      console.warn('[LastChance] roster not ready. Need tourState.lastNationalSortedIds with 40 ids (incl PLAYER). got=', slice.length);
    }

    const teams = slice.map(id=>{
      const sid = String(id||'');
      if (!sid) return null;
      if (sid === 'PLAYER'){
        return materializeTeamFromDef(buildPlayerDef());
      }
      const cpu = getCpuById(sid);
      return materializeTeamFromDef(cpu);
    }).filter(Boolean);

    // 20固定（不足していたら安全弁で national から補完）
    if (teams.length < 20){
      const poolNat = getCpuAll().filter(t=>String(t.teamId||'').startsWith('national')).map(t=>String(t.teamId||''));
      for (const nid of poolNat){
        if (teams.length >= 20) break;
        if (teams.some(x=>String(x.id)===nid)) continue;
        const cpu = getCpuById(nid);
        const t = materializeTeamFromDef(cpu);
        if (t) teams.push(t);
      }
    }

    for (const t of teams) ensureTeamRuntimeShape(t);

    const state = {
      mode: 'lastchance',
      phase: 'intro',

      matchIndex: 1,
      matchCount: 5,
      round: 1,

      teams,
      tournamentTotal: initTotalForTeams(teams),
      lastMatchResultRows: [],

      bannerLeft: '',
      bannerRight: '',
      center: { a:'', b:'', c:'' },

      selectedCoachSkill: null,
      selectedCoachQuote: '',

      ui: {
        bg: 'maps/neonmain.png',
        squareBg: 'tent.png',
        leftImg: getPlayerSkin(),
        rightImg: '',
        topLeftName: '',
        topRightName: ''
      },

      request: { type:'noop', payload:{} }
    };

    setState(state);
    setRequest('openTournament', { mode:'lastchance' });
    return state;
  }

  // =========================================================
  // ✅ World: phase = 'qual' | 'wl' | 'final'
  //   roster rule:
  //     - qualifiedIds(10): National TOP8 + LastChance TOP2
  //     - world fixed top10(by basePower) always appear
  //     - remaining 20 weighted pick from rest (without replacement)
  // =========================================================
  function startWorldTournament(phase){
    const tourState = getJSON(K.tourState, null) || {};
    const ph = String(phase||'qual').trim();

    // 10権利
    const q10 = Array.isArray(tourState.worldQualifiedIds) ? tourState.worldQualifiedIds.slice() : [];
    const qualified10 = q10.map(x=>String(x||'')).filter(Boolean);

    // world teams
    const allWorldDefs = getCpuAll().filter(t=>String(t.teamId||'').startsWith('world'));
    const allWorld = allWorldDefs.map(d=>getCpuById(d.teamId)).filter(Boolean);

    // fixed top10 by basePower desc
    const sortedWorld = allWorld.slice().sort((a,b)=>Number(b.basePower||0) - Number(a.basePower||0));
    const fixed10 = sortedWorld.slice(0,10).map(t=>String(t.teamId||'')).filter(Boolean);

    // remaining pool (exclude fixed10)
    const remaining = sortedWorld.slice(10);

    // weighted pick 20 from remaining
    const picked20 = weightedPickWithoutReplacement(
      remaining.map(t=>({ id:String(t.teamId||''), w:Number(t.basePower||1) })),
      20,
      2.0 // power exponent (強いほど出やすい)
    );

    const world30 = [
      ...fixed10,
      ...picked20
    ].slice(0,30);

    // 40 = qualified10 + world30 (重複は除去しつつ、足りなければ補完)
    const ids = [];
    const pushUnique = (id)=>{
      const s = String(id||'');
      if (!s) return;
      if (ids.includes(s)) return;
      ids.push(s);
    };

    for (const id of qualified10) pushUnique(id);
    for (const id of world30) pushUnique(id);

    // 補完（万一の重複で不足したら）
    for (const t of sortedWorld){
      if (ids.length >= 40) break;
      pushUnique(String(t.teamId||''));
    }

    // グループ分け A-D（AにPLAYER固定）
    // ✅ ただし、プレイヤーチームが権利10にいない場合でも「必ずA」は要件なので、
    //    World参加時点では PLAYER は必ず qualified10 に含まれる想定。
    //    安全弁として、いなければ先頭に差し込む（40維持）
    if (!ids.includes('PLAYER')){
      ids.unshift('PLAYER');
      ids.length = 40;
    }

    const playerDef = buildPlayerDef();

    // random split to A/B/C/D 10 each with PLAYER in A
    const rest = ids.filter(x=>x!=='PLAYER');
    const sh = L.shuffle ? L.shuffle(rest) : rest.slice();

    const A = ['PLAYER', ...sh.slice(0,9)];
    const B = sh.slice(9,19);
    const C = sh.slice(19,29);
    const D = sh.slice(29,39);

    const plan = { groupMap: { A, B, C, D } };

    // World sessions: AB/CD/AC/AD/BC/BD (6) それぞれ5試合
    const sessions = [
      { key:'AB', groups:['A','B'] },
      { key:'CD', groups:['C','D'] },
      { key:'AC', groups:['A','C'] },
      { key:'AD', groups:['A','D'] },
      { key:'BC', groups:['B','C'] },
      { key:'BD', groups:['B','D'] }
    ];

    // allTeamDefs: materialize map
    const allTeamDefs = ids.map(id=>{
      if (id === 'PLAYER') return playerDef;
      const cpu = getCpuById(id);
      return cpu || null;
    }).filter(Boolean);

    // initial 20 for session AB
    const state = {
      mode: 'world',
      worldPhase: ph, // 'qual' | 'wl' | 'final'
      phase: 'intro',

      matchIndex: 1,
      matchCount: 5,
      round: 1,

      teams: [],

      tournamentTotal: initTotalForTeams(allTeamDefs.map(def=>materializeTeamFromDef(def)).filter(Boolean)),
      lastMatchResultRows: [],

      bannerLeft: '',
      bannerRight: '',
      center: { a:'', b:'', c:'' },

      selectedCoachSkill: null,
      selectedCoachQuote: '',

      ui: {
        bg: 'maps/neonmain.png',
        squareBg: 'tent.png',
        leftImg: getPlayerSkin(),
        rightImg: '',
        topLeftName: '',
        topRightName: ''
      },

      request: { type:'noop', payload:{} },

      // world also uses national-like sessions with auto-run
      national: {
        // reuse structure name for step.js compatibility
        plan,
        allTeamDefs,
        sessions,
        sessionIndex: 0,
        sessionCount: 6,
        doneMap: {}
      }
    };

    setState(state);

    state.teams = _buildTeamsForNationalSession(allTeamDefs, plan, 0);
    for (const t of state.teams) ensureTeamRuntimeShape(t);

    setRequest('openTournament', { mode:'world', phase: ph });
    return state;
  }

  // =========================================================
  // Weighted pick (without replacement)
  // =========================================================
  function weightedPickWithoutReplacement(items, k, exponent){
    const out = [];
    const pool = (items||[]).filter(x=>x && x.id && Number.isFinite(Number(x.w||0)));

    // sanitize weights
    for (const it of pool){
      const w0 = Math.max(0.0001, Number(it.w||0));
      it._w = Math.pow(w0, Number.isFinite(Number(exponent)) ? Number(exponent) : 1.0);
    }

    while (out.length < k && pool.length > 0){
      const sum = pool.reduce((a,b)=>a + (b._w||0), 0);
      let r = Math.random() * sum;
      let idx = -1;

      for (let i=0;i<pool.length;i++){
        r -= (pool[i]._w||0);
        if (r <= 0){ idx = i; break; }
      }
      if (idx < 0) idx = pool.length - 1;

      const picked = pool.splice(idx, 1)[0];
      out.push(String(picked.id));
    }

    return out;
  }

  // =========================================================
  // Public API
  // =========================================================
  function step(){
    // step本体は core_step.js が _tcore.step に登録する
    if (typeof _tcore.step === 'function'){
      return _tcore.step();
    }
    setRequest('noop', {});
  }

  window.MOBBR.sim.tournamentCore = {
    startLocalTournament,
    startNationalTournament,
    startLastChanceTournament,
    startWorldTournament,

    step,
    getState
  };

  // expose for step.js to call
  _tcore.ensureTeamRuntimeShape = ensureTeamRuntimeShape;
  _tcore.getCpuById = getCpuById;

})();
