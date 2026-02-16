/* =========================================================
   sim_tournament_core.js（FULL / split版）
   - 進行（state/step/公開API）を担当
   - National専用は tournamentCoreNational を使う（無ければ内蔵フォールバック）
   - “大会終了後処理” は tournamentCorePost が存在すれば呼ぶ

   ✅ 今回追加（要望対応）
   1) プレイヤーが出ない試合はオート高速処理（Aグループが出ないセッションは全部スキップ）
   2) National：5試合（=1セッション）終わるごとに「40チーム総合RESULT」を表示
   3) National：40チーム編成に「ローカルトップ10」を必ず含める（Aグループ=ローカルトップ10）
   4) National終了後：post側で1週進行＆次大会更新（post呼び出しは従来通り）

   仕様メモ：
   - Nationalは 4グループ(A/B/C/D) x 10チーム = 40チーム
   - Aグループ = ローカルトップ10（PLAYER含む10）
   - セッション順：AB, CD, AC, AD, BC, BD（6セッション）
   - Aが含まれないセッション（CD/BC/BD）は「観戦無しでオート高速処理」
   ========================================================= */
'use strict';

window.MOBBR = window.MOBBR || {};
window.MOBBR.sim = window.MOBBR.sim || {};

(function(){

  const L = window.MOBBR.sim.tournamentLogic;
  const R = window.MOBBR.sim.tournamentResult;

  const N = window.MOBBR?.sim?.tournamentCoreNational || null;
  const P = window.MOBBR?.sim?.tournamentCorePost || null;

  // ===== State =====
  let state = null;

  function getState(){ return state; }

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
  function setRequest(type, payload){
    state.request = { type, ...(payload||{}) };
  }

  function setCenter3(a,b,c){
    state.ui.center3 = [String(a||''), String(b||''), String(c||'')];
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
    return rows;
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
  // NATIONAL helpers（分離モジュールがあればそれを使う）
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

  function _getCpuTeamById(teamId){
    const id0 = String(teamId||'');
    if (!id0) return null;
    const all = _getAllCpuTeams();
    for (const t of all){
      const id = String(t?.teamId || t?.id || '');
      if (id === id0) return t;
    }
    return null;
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

  // ===== National: roster build (40 teams) =====
  function _readLocalTop10Ids(){
    try{
      const raw = localStorage.getItem('mobbr_split1_local_top10');
      if (!raw) return [];
      const a = JSON.parse(raw);
      if (!Array.isArray(a)) return [];
      return a.map(x=>String(x||'')).filter(Boolean);
    }catch(e){
      return [];
    }
  }

  function _buildNationalRoster40(){
    // Aグループ = ローカルトップ10（PLAYER含む10）
    const localTop10 = _readLocalTop10Ids();
    const aIds = [];
    // PLAYERは必ず含める（ローカルトップ10に入ってなくてもAの基準になる）
    if (!aIds.includes('PLAYER')) aIds.push('PLAYER');

    for (const id of localTop10){
      const v = String(id||'');
      if (!v) continue;
      if (v === 'PLAYER') continue;
      if (aIds.length >= 10) break;
      if (!aIds.includes(v)) aIds.push(v);
    }

    // ローカルトップ10が不足する場合は、local系CPUから補完（害のないフォールバック）
    if (aIds.length < 10){
      const cpuLocal = (typeof L.getCpuTeamsLocalOnly === 'function') ? (L.getCpuTeamsLocalOnly() || []) : [];
      const fill = L.shuffle(cpuLocal).map(c=>String(c.teamId||c.id||'')).filter(Boolean);
      for (const id of fill){
        if (aIds.length >= 10) break;
        if (id === 'PLAYER') continue;
        if (!aIds.includes(id)) aIds.push(id);
      }
    }

    // 30枠は national prefix から（被り除外）
    const pool = _getCpuTeamsByPrefix('national');
    const poolIds = L.shuffle(pool).map(c=>String(c.teamId||c.id||'')).filter(Boolean);
    const rest = [];
    for (const id of poolIds){
      if (rest.length >= 30) break;
      if (!id) continue;
      if (id === 'PLAYER') continue;
      if (aIds.includes(id)) continue;
      if (!rest.includes(id)) rest.push(id);
    }

    // もし不足したら全CPUから補完
    if (rest.length < 30){
      const all = L.shuffle(_getAllCpuTeams()).map(c=>String(c.teamId||c.id||'')).filter(Boolean);
      for (const id of all){
        if (rest.length >= 30) break;
        if (id === 'PLAYER') continue;
        if (aIds.includes(id)) continue;
        if (!rest.includes(id)) rest.push(id);
      }
    }

    const roster = aIds.concat(rest.slice(0,30));
    // roster.length should be 40
    return {
      rosterIds: roster.slice(0,40),
      groupAIds: aIds.slice(0,10)
    };
  }

  function _buildNationalPlanFromRoster(rosterInfo){
    // A=ローカルトップ10(10)
    // 残り30を B/C/D に10ずつ
    const rosterIds = rosterInfo.rosterIds.slice();
    const groupA = rosterInfo.groupAIds.slice(0,10);

    const others = rosterIds.filter(id => !groupA.includes(id) && id !== 'PLAYER');
    const sh = L.shuffle(others);

    const B = sh.slice(0,10);
    const C = sh.slice(10,20);
    const D = sh.slice(20,30);

    const sessions = [
      { key:'AB', groups:['A','B'] },
      { key:'CD', groups:['C','D'] },
      { key:'AC', groups:['A','C'] },
      { key:'AD', groups:['A','D'] },
      { key:'BC', groups:['B','C'] },
      { key:'BD', groups:['B','D'] },
    ];
    return { groups:{ A:groupA, B, C, D }, sessions };
  }

  function _buildAllTeamDefsFromRoster(rosterIds){
    const defs = {};
    defs.PLAYER = _makePlayerRuntime();

    for (const id of rosterIds){
      const tid = String(id||'');
      if (!tid) continue;
      if (tid === 'PLAYER') continue;

      const cpu = _getCpuTeamById(tid);
      if (cpu){
        const rt = _mkRuntimeTeamFromCpuDef(cpu);
        if (rt?.id) defs[rt.id] = rt;
      }
    }

    // 最終保険：足りない場合は national prefix から埋める
    if (Object.keys(defs).length < 40){
      const pool = L.shuffle(_getCpuTeamsByPrefix('national'));
      for (const c of pool){
        if (Object.keys(defs).length >= 40) break;
        const rt = _mkRuntimeTeamFromCpuDef(c);
        if (rt?.id && !defs[rt.id]) defs[rt.id] = rt;
      }
    }

    return defs;
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

    // Aが含まれるなら PLAYERは必ず出す
    if (includesA){
      out.push(_cloneDeep(allTeamDefs.PLAYER));
    }

    for (const id of pick){
      const def = allTeamDefs[id];
      if (def){
        // PLAYERは上で入れてるので重複回避
        if (String(def.id) === 'PLAYER') continue;
        out.push(_cloneDeep(def));
      }
    }

    // 20未満なら同セッションの他グループから補完
    if (out.length < 20){
      const allIds = []
        .concat(g.A||[], g.B||[], g.C||[], g.D||[])
        .filter(Boolean);

      const rest = allIds.filter(x => !out.some(t=>t.id===x) && x !== 'PLAYER');
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

  // ===== National: 40-team total aggregator =====
  function _ensureTotalRow(totalObj, teamId, teamName, isPlayer){
    if (!totalObj[teamId]){
      totalObj[teamId] = {
        id: teamId,
        squad: teamName || teamId,
        isPlayer: !!isPlayer,
        sumTotal: 0,
        sumPlacementP: 0,
        KP: 0,
        AP: 0,
        Treasure: 0,
        Flag: 0
      };
    }
    const r = totalObj[teamId];
    if (!r.squad) r.squad = teamName || teamId;
    if (isPlayer) r.isPlayer = true;
    return r;
  }

  function _addMatchRowsToTotal40(rows){
    if (!state?.national) return;
    if (!state.national.total40) state.national.total40 = {};

    const total40 = state.national.total40;

    for (const row of (rows||[])){
      const id = String(row.id||'');
      if (!id) continue;

      const nm = String(row.squad || row.name || id);
      const r0 = _ensureTotalRow(total40, id, nm, !!row.isPlayer);

      const pp = Number(row.PlacementP ?? 0) || 0;
      const kp = Number(row.KP ?? 0) || 0;
      const ap = Number(row.AP ?? 0) || 0;
      const tre = Number(row.Treasure ?? 0) || 0;
      const flg = Number(row.Flag ?? 0) || 0;
      const tot = Number(row.Total ?? (pp+kp+ap+tre+(flg*2))) || 0;

      r0.sumPlacementP += pp;
      r0.KP += kp;
      r0.AP += ap;
      r0.Treasure += tre;
      r0.Flag += flg;
      r0.sumTotal += tot;
    }
  }

  function _buildTotal40ObjectForUI(){
    const out = {};
    const total40 = state?.national?.total40 || {};
    for (const k in total40){
      out[k] = {
        id: total40[k].id,
        squad: total40[k].squad,
        isPlayer: !!total40[k].isPlayer,
        sumTotal: total40[k].sumTotal || 0,
        sumPlacementP: total40[k].sumPlacementP || 0,
        KP: total40[k].KP || 0,
        AP: total40[k].AP || 0,
        Treasure: total40[k].Treasure || 0,
        Flag: total40[k].Flag || 0
      };
    }
    return out;
  }

  // ===== National: auto session (no player) =====
  function _hasPlayerInCurrentSession(){
    return !!getPlayer();
  }

  function _autoSimulateOneMatchNoUI(){
    // セッション内の1試合を完全に裏で回す
    // - UI requestは出さない
    // - state.tournamentTotalは従来通り更新（そのセッション内20チーム）
    // - national.total40 は40総合に加算する

    // match init
    state.round = 1;
    state.selectedCoachSkill = null;
    state.selectedCoachQuote = '';
    initMatchDrop();

    // rounds 1-6
    while(state.round <= 6){
      const r = state.round;

      if (r === 6){
        for (const t of state.teams){
          if (!t.eliminated) t.areaId = 25;
        }
      }

      const matches = L.buildMatchesForRound(state, r, getPlayer, aliveTeams);
      const ctx = computeCtx();

      for (const [A,B] of matches){
        ensureTeamRuntimeShape(A);
        ensureTeamRuntimeShape(B);
        if (window.MOBBR?.sim?.matchFlow?.resolveBattle){
          window.MOBBR.sim.matchFlow.resolveBattle(A, B, r, ctx);
        }
      }

      if (r <= 5) L.moveAllTeamsToNextRound(state, r);
      state.round++;
    }

    // result
    const rows = finishMatchAndBuildResult();
    _addMatchRowsToTotal40(rows);

    // next match index
    state.matchIndex += 1;
  }

  function _autoRunWholeSessionNoPlayer(){
    // 5試合を裏で回して「40チーム総合RESULT」を出す
    // ※ ここでは UI を開いている前提なので「結果画面だけは表示」する（要件2）
    // ※ 観戦はさせない（要件1）
    state.phase = 'national_auto_session_running';
    setRequest('noop', {});

    // セッションの matchIndex は 1..5 の運用に揃える
    state.matchIndex = 1;
    state.matchCount = 5;

    // セッション開始時に team runtime を整形
    for (const t of state.teams) ensureTeamRuntimeShape(t);

    // 5 matches
    while(state.matchIndex <= state.matchCount){
      _autoSimulateOneMatchNoUI();
    }

    // matchIndex は 6 になっているはず
    // 40総合RESULTを表示 → NEXTで次セッション/終了へ
    _setNationalBanners();
    setRequest('showTournamentResult', { total: _buildTotal40ObjectForUI() });
    state.phase = 'national_overall40_wait_next';
    state._afterOverall40 = { type:'next_session_or_finish' };
  }

  // =========================================================
  // ===== main step machine =====
  // =========================================================
  function step(){
    if (!state) return;

    const p = getPlayer();

    // ✅ Local: 総合RESULTを見せたあと、次のNEXTで終了後処理 → UI閉じる
    if (state.phase === 'local_total_result_wait_post'){
      try{
        if (P?.onLocalTournamentFinished){
          P.onLocalTournamentFinished(state, state.tournamentTotal);
        }else if (window.MOBBR?.sim?.tournamentCorePost?.onLocalTournamentFinished){
          window.MOBBR.sim.tournamentCorePost.onLocalTournamentFinished(state, state.tournamentTotal);
        }
      }catch(e){
        console.error('[tournament_core] onLocalTournamentFinished error:', e);
      }
      state.phase = 'done';
      setRequest('endTournament', {});
      return;
    }

    // ✅ National: 最終総合RESULTを見せたあと、次のNEXTで終了後処理 → post優先 / 無ければ endNationalWeek
    if (state.phase === 'national_total_result_wait_post'){
      let handled = false;

      try{
        if (P?.onNationalTournamentFinished){
          P.onNationalTournamentFinished(state, state.tournamentTotal);
          handled = true;
        }else if (window.MOBBR?.sim?.tournamentCorePost?.onNationalTournamentFinished){
          window.MOBBR.sim.tournamentCorePost.onNationalTournamentFinished(state, state.tournamentTotal);
          handled = true;
        }
      }catch(e){
        console.error('[tournament_core] onNationalTournamentFinished error:', e);
      }

      state.phase = 'done';

      if (handled){
        // post側で週進行/メイン復帰が完結している前提。UIだけ閉じる。
        setRequest('endTournament', {});
      }else{
        // postが無い場合は UIに任せて「閉じる→外側へ週進行通知」
        setRequest('endNationalWeek', { weeks: 1 });
      }
      return;
    }

    // ✅ National: 40総合RESULTを見せた後のNEXT
    if (state.phase === 'national_overall40_wait_next'){
      const nat = state.national || {};
      const si = Number(nat.sessionIndex||0);
      const sc = Number(nat.sessionCount||6);

      // 最終セッションなら → 最終総合RESULT（現状：40総合を「大会結果」として見せた後にpostへ）
      if (si >= sc - 1){
        // 最終の総合RESULTは「40総合」をもう一度出しても良いが、ここでは“次のNEXTでpost”へ繋ぐため
        // request は既に showTournamentResult を出しているので、ここで post待ちへ。
        state.phase = 'national_total_result_wait_post';
        setRequest('noop', {});
        return;
      }

      // 次セッションへ
      setRequest('showNationalNotice', {
        qualified: false,
        line1: `SESSION ${String(nat.sessions?.[si]?.key || `S${si+1}`)} 終了！`,
        line2: `次：SESSION ${String(nat.sessions?.[si+1]?.key || `S${si+2}`)} へ`,
        line3: 'NEXTで進行'
      });
      state.phase = 'national_next_session';
      return;
    }

    if (state.phase === 'done'){
      setRequest('noop', {});
      return;
    }

    // ===== intro =====
    if (state.phase === 'intro'){
      if (state.mode === 'national'){
        _setNationalBanners();
      }else{
        state.bannerLeft = 'ローカル大会';
        state.bannerRight = '20チーム';
      }

      state.ui.bg = 'maps/neonmain.png';
      state.ui.squareBg = 'tent.png';

      state.ui.leftImg = getPlayerSkin();
      state.ui.rightImg = '';
      state.ui.topLeftName = '';
      state.ui.topRightName = '';

      if (state.mode === 'national'){
        const s = state.national || {};
        const si = Number(s.sessionIndex||0);
        const sc = Number(s.sessionCount||6);
        const key = String(s.sessions?.[si]?.key || `S${si+1}`);

        // ✅ Aが含まれないセッション（=PLAYER不在）は intro すら出さずに自動処理へ
        const teamsHasPlayer = _hasPlayerInCurrentSession();
        if (!teamsHasPlayer){
          _autoRunWholeSessionNoPlayer();
          return;
        }

        setCenter3('ナショナルリーグ開幕！', `SESSION ${key} (${si+1}/${sc})`, '');
      }else{
        setCenter3('本日のチームをご紹介！', '', '');
      }

      setRequest('showIntroText', {});
      state.phase = 'teamList';
      return;
    }

    // ===== team list =====
    if (state.phase === 'teamList'){
      setCenter3('', '', '');
      setRequest('showTeamList', { teams: state.teams.map(t=>({
        id:t.id, name:t.name, power:t.power, alive:t.alive, eliminated:t.eliminated, treasure:t.treasure, flag:t.flag, isPlayer:!!t.isPlayer
      }))});
      state.phase = 'teamList_done';
      return;
    }

    // ===== coach select =====
    if (state.phase === 'teamList_done'){
      setCenter3('それでは試合を開始します！', '使用するコーチスキルを選択してください！', '');
      setRequest('showCoachSelect', {
        equipped: getEquippedCoachList(),
        master: L.COACH_MASTER
      });
      state.phase = 'coach_done';
      return;
    }

    // ===== match start =====
    if (state.phase === 'coach_done'){
      initMatchDrop();

      if (state.mode === 'national'){
        _setNationalBanners();
        state.bannerRight = '降下';
      }else{
        state.bannerLeft = `MATCH ${state.matchIndex} / 5`;
        state.bannerRight = '降下';
      }

      state.ui.leftImg = getPlayerSkin();
      state.ui.rightImg = '';
      state.ui.topLeftName = '';
      state.ui.topRightName = '';

      state.ui.bg = 'tent.png';
      state.ui.squareBg = 'tent.png';

      setCenter3('バトルスタート！', '降下開始…！', '');
      setRequest('showDropStart', {});
      state.phase = 'drop_land';
      return;
    }

    // ===== landed =====
    if (state.phase === 'drop_land'){
      const p2 = getPlayer();
      const info = getAreaInfo(p2?.areaId || 1);
      state.ui.bg = info.img;

      const contested = !!state.playerContestedAtDrop;
      setCenter3(`${info.name}に降下完了。周囲を確認…`, contested ? '被った…敵影がいる！' : '周囲は静かだ…', 'IGLがコール！戦闘準備！');

      state.ui.rightImg = '';
      state.ui.topLeftName = '';
      state.ui.topRightName = '';

      setRequest('showDropLanded', { areaId: info.id, areaName: info.name, bg: info.img, contested });
      state.phase = 'round_start';
      state.round = 1;
      return;
    }

    // ===== round start =====
    if (state.phase === 'round_start'){
      const r = state.round;

      if (state.mode === 'national'){
        _setNationalBanners();
        state.bannerRight = `ROUND ${r}`;
      }else{
        state.bannerLeft = `MATCH ${state.matchIndex} / 5`;
        state.bannerRight = `ROUND ${r}`;
      }

      state.ui.rightImg = '';
      state.ui.topLeftName = '';
      state.ui.topRightName = '';

      setCenter3(`Round ${r} 開始！`, '', '');
      setRequest('showRoundStart', { round: r });

      state.phase = 'round_events';
      state._eventsToShow = L.eventCount(r);
      return;
    }

    // ===== events =====
    if (state.phase === 'round_events'){
      const r = state.round;

      if (L.eventCount(r) === 0){
        state.phase = 'round_battles';
        return step();
      }

      if (!p || p.eliminated){
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

      state.ui.rightImg = '';
      state.ui.topLeftName = '';
      state.ui.topRightName = '';

      if (ev){
        setCenter3(ev.log1, ev.log2, ev.log3);
        setRequest('showEvent', { icon: ev.icon, log1: ev.log1, log2: ev.log2, log3: ev.log3 });
      }else{
        setCenter3('イベント発生！', '……', '');
        setRequest('showEvent', { icon: '', log1:'イベント発生！', log2:'……', log3:'' });
      }
      return;
    }

    // ===== prepare battles =====
    if (state.phase === 'round_battles'){
      const r = state.round;

      const matches = L.buildMatchesForRound(state, r, getPlayer, aliveTeams);
      state._roundMatches = matches.map(([A,B])=>({ aId:A.id, bId:B.id }));
      state._matchCursor = 0;

      setRequest('prepareBattles', { round: r, slots: L.battleSlots(r), matches: state._roundMatches });
      state.phase = 'battle_one';
      return;
    }

    // ===== battle loop =====
    if (state.phase === 'battle_one'){
      const r = state.round;
      const list = Array.isArray(state._roundMatches) ? state._roundMatches : [];
      let cur = Number(state._matchCursor||0);

      while (cur < list.length){
        const pair = list[cur];
        const A = state.teams.find(t=>t.id===pair.aId);
        const B = state.teams.find(t=>t.id===pair.bId);

        if (!A || !B){
          cur++;
          continue;
        }

        const playerIn = (A.isPlayer || B.isPlayer);
        if (playerIn){
          state._matchCursor = cur;

          const me = A.isPlayer ? A : B;
          const foe = A.isPlayer ? B : A;

          state.ui.leftImg = getPlayerSkin();
          state.ui.rightImg = `${foe.id}.png`;
          state.ui.topLeftName = me.name;
          state.ui.topRightName = foe.name;

          setCenter3('接敵‼︎', `${me.name} vs ${foe.name}‼︎`, '交戦スタート‼︎');
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

    // ===== resolve player battle =====
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

      const playerIn = (A.isPlayer || B.isPlayer);
      if (!playerIn){
        resolveOneBattle(A, B, r);
        state._matchCursor = cur + 1;
        state.phase = 'battle_one';
        return step();
      }

      const me = A.isPlayer ? A : B;
      const foe = A.isPlayer ? B : A;

      const res = resolveOneBattle(A, B, r);
      const iWon = res ? (res.winnerId === me.id) : false;

      state.ui.leftImg = getPlayerSkin();
      state.ui.rightImg = `${foe.id}.png`;
      state.ui.topLeftName = me.name;
      state.ui.topRightName = foe.name;

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
        const championName = R.getChampionName(state);
        state._afterBattleGo = { type:'champion', championName };
        state.phase = 'battle_after';
        return;
      }

      state._afterBattleGo = { type:'nextBattle' };
      state.phase = 'battle_after';
      return;
    }

    // ===== after battle =====
    if (state.phase === 'battle_after'){
      const cur = Number(state._matchCursor||0);
      const go = state._afterBattleGo || { type:'nextBattle' };
      state._afterBattleGo = null;

      if (go.type === 'champion'){
        state.ui.rightImg = '';
        state.ui.topLeftName = '';
        state.ui.topRightName = '';

        setCenter3(`この試合のチャンピオンは`, String(go.championName || '???'), '‼︎');
        setRequest('showChampion', {
          matchIndex: state.matchIndex,
          championName: String(go.championName || '')
        });

        state.phase = 'match_result';
        return;
      }

      state._matchCursor = cur + 1;
      state.phase = 'battle_one';
      setRequest('noop', {});
      return;
    }

    // ===== move =====
    if (state.phase === 'round_move'){
      const r = state.round;

      const p3 = getPlayer();
      const before = p3 ? getAreaInfo(p3.areaId) : null;

      L.moveAllTeamsToNextRound(state, r);

      const p4 = getPlayer();
      const after = p4 ? getAreaInfo(p4.areaId) : null;

      state.ui.bg = 'ido.png';
      state.ui.leftImg = getPlayerSkin();

      state.ui.rightImg = '';
      state.ui.topLeftName = '';
      state.ui.topRightName = '';

      setCenter3('', '', '');
      setRequest('showMove', {
        fromAreaId: before?.id || 0,
        toAreaId: after?.id || 0,
        toAreaName: after?.name || '',
        toBg: after?.img || '',
        holdMs: 0
      });

      state.phase = 'round_move_done';
      return;
    }

    if (state.phase === 'round_move_done'){
      state.round += 1;
      state.phase = (state.round <= 6) ? 'round_start' : 'match_result';
      setRequest('noop', {});
      return;
    }

    // ===== match result =====
    if (state.phase === 'match_result'){
      const rows = finishMatchAndBuildResult();
      if (state.mode === 'national'){
        _addMatchRowsToTotal40(rows);
      }

      state.ui.rightImg = '';
      state.ui.topLeftName = '';
      state.ui.topRightName = '';

      setRequest('showMatchResult', {
        matchIndex: state.matchIndex,
        matchCount: state.matchCount,
        rows: state.lastMatchResultRows
      });
      state.phase = 'match_result_done';
      return;
    }

    // ===== match result done =====
    if (state.phase === 'match_result_done'){

      // LOCAL
      if (state.mode === 'local'){
        if (state.matchIndex >= state.matchCount){
          // ✅ まず総合RESULTを表示
          setRequest('showTournamentResult', { total: state.tournamentTotal });
          // ✅ 次のNEXTで post を実行してメインへ戻す（UI閉じる）
          state.phase = 'local_total_result_wait_post';
          return;
        }

        startNextMatch();

        state.ui.bg = 'tent.png';
        state.ui.squareBg = 'tent.png';
        state.ui.leftImg = getPlayerSkin();
        state.ui.rightImg = '';
        state.ui.topLeftName = '';
        state.ui.topRightName = '';

        setCenter3(`次の試合へ`, `MATCH ${state.matchIndex} / 5`, '');
        setRequest('nextMatch', { matchIndex: state.matchIndex });
        state.phase = 'coach_done';
        return;
      }

      // NATIONAL（6セッション）
      if (state.mode === 'national'){
        const nat = state.national || {};
        const si = Number(nat.sessionIndex||0);
        const sc = Number(nat.sessionCount||6);

        if (state.matchIndex < state.matchCount){
          startNextMatch();

          state.ui.bg = 'tent.png';
          state.ui.squareBg = 'tent.png';
          state.ui.leftImg = getPlayerSkin();
          state.ui.rightImg = '';
          state.ui.topLeftName = '';
          state.ui.topRightName = '';

          _setNationalBanners();
          setCenter3(`次の試合へ`, `MATCH ${state.matchIndex} / ${state.matchCount}`, '');
          setRequest('nextMatch', { matchIndex: state.matchIndex });
          state.phase = 'coach_done';
          return;
        }

        // ✅ ここで「5試合(=1セッション)終了」なので 40総合RESULT を必ず出す（要件2）
        setRequest('showTournamentResult', { total: _buildTotal40ObjectForUI() });
        state.phase = 'national_overall40_wait_next';
        return;
      }

      setRequest('showTournamentResult', { total: state.tournamentTotal });
      state.phase = 'done';
      return;
    }

    // ===== national: next session handler =====
    if (state.phase === 'national_next_session'){
      const nat = state.national || {};
      const si = Number(nat.sessionIndex||0);
      const sc = Number(nat.sessionCount||6);

      const nextIndex = Math.min(sc-1, si+1);
      nat.sessionIndex = nextIndex;
      state.national = nat;

      const plan = nat.plan;
      const defs = nat.allTeamDefs;

      state.teams = _buildTeamsForNationalSession(defs, plan, nextIndex);

      state.matchIndex = 1;
      state.round = 1;

      state.selectedCoachSkill = null;
      state.selectedCoachQuote = '';

      // ✅ Aが含まれないセッション（=PLAYER不在）は、introへ行かず自動処理
      state.phase = 'intro';

      setRequest('noop', {});
      return;
    }

    setRequest('noop', {});
  }

  // =========================================================
  // start: LOCAL
  // =========================================================
  function startLocalTournament(){
    const cpuAllLocal = L.getCpuTeamsLocalOnly();
    const cpu19 = L.shuffle(cpuAllLocal).slice(0, 19);

    const pPowRaw = (L && typeof L.calcPlayerTeamPower === 'function') ? Number(L.calcPlayerTeamPower()) : NaN;
    const pPow = Number.isFinite(pPowRaw) ? pPowRaw : 55;

    const player = {
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

    const teams = [player];

    cpu19.forEach((c, i)=>{
      const id = c.teamId || c.id || `localXX_${i+1}`;
      const nm = String(c.name || c.teamId || c.id || id);

      const memSrc = Array.isArray(c.members) ? c.members.slice(0,3) : [];
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

      teams.push({
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

      h2h: {},

      playerContestedAtDrop: false,
      _dropAssigned: null,

      selectedCoachSkill: null,
      selectedCoachQuote: '',

      bannerLeft: 'ローカル大会',
      bannerRight: '20チーム',

      ui: {
        bg: 'maps/neonmain.png',
        squareBg: 'tent.png',
        leftImg: L.getEquippedSkin(),
        rightImg: '',
        center3: ['','',''],
        topLeftName: '',
        topRightName: ''
      },

      request: null
    };

    if (window.MOBBR?.ui?.tournament?.open){
      window.MOBBR.ui.tournament.open();
    }
    if (window.MOBBR?.ui?.tournament?.render){
      window.MOBBR.ui.tournament.render();
    }

    step();
    if (window.MOBBR?.ui?.tournament?.render){
      window.MOBBR.ui.tournament.render();
    }
  }

  // =========================================================
  // start: NATIONAL
  // =========================================================
  function startNationalTournament(){
    // ✅ 40チーム = A(ローカルトップ10=10) + 30(ナショナル枠)
    const rosterInfo = _buildNationalRoster40();
    const rosterIds = rosterInfo.rosterIds;

    if (!rosterIds || rosterIds.length < 20){
      console.error('[tournament_core] National roster not ready. Check DataCPU / local top10 storage.');
      startLocalTournament();
      return;
    }

    const plan = _buildNationalPlanFromRoster(rosterInfo);
    const allTeamDefs = _buildAllTeamDefsFromRoster(rosterIds);

    const sessionCount = plan.sessions.length;
    const teams = _buildTeamsForNationalSession(allTeamDefs, plan, 0);

    state = {
      mode: 'national',

      matchIndex: 1,
      matchCount: 5,
      round: 1,

      phase: 'intro',

      teams,

      tournamentTotal: {},

      h2h: {},

      playerContestedAtDrop: false,
      _dropAssigned: null,

      selectedCoachSkill: null,
      selectedCoachQuote: '',

      bannerLeft: 'NATIONAL',
      bannerRight: '20チーム',

      national: {
        plan,
        groups: plan.groups,
        sessions: plan.sessions,
        sessionIndex: 0,
        sessionCount,
        allTeamDefs,

        // ✅ 40総合
        total40: {}
      },

      ui: {
        bg: 'maps/neonmain.png',
        squareBg: 'tent.png',
        leftImg: L.getEquippedSkin(),
        rightImg: '',
        center3: ['','',''],
        topLeftName: '',
        topRightName: ''
      },

      request: null
    };

    if (window.MOBBR?.ui?.tournament?.open){
      window.MOBBR.ui.tournament.open();
    }
    if (window.MOBBR?.ui?.tournament?.render){
      window.MOBBR.ui.tournament.render();
    }

    step();
    if (window.MOBBR?.ui?.tournament?.render){
      window.MOBBR.ui.tournament.render();
    }
  }

  // =========================================================
  // Export API
  // =========================================================
  window.MOBBR.sim.tournamentFlow = {
    startLocalTournament,
    startNationalTournament,

    step,
    getState,

    getCoachMaster,
    getEquippedCoachList,
    setCoachSkill,
    getPlayerSkin,
    getAreaInfo,

    initMatchDrop,
    applyEventForTeam,
    simulateRound,
    fastForwardToMatchEnd,
    finishMatchAndBuildResult,
    startNextMatch,
    isTournamentFinished
  };

})();
