'use strict';

/*
  sim_tournament_core.js（FULL / National対応版）
  - state保持
  - stepマシン
  - UI request 発行
  - 公開API: window.MOBBR.sim.tournamentFlow（名称維持）

  【既存維持】
  - ローカル大会：20チーム / 5試合 / 6R
  - UI側の showEncounter 2段階、resultホールド、%非表示などは UI 側のまま

  【修正（powerが55固定になる件）】
  - startLocalTournament() の player.power を NaN/undefined にならないように保険
  - ensureTeamRuntimeShape() で player.power が NaN/undefined の時だけ、calcPlayerTeamPower() で再計算して復旧

  【修正（順位矯正/逆転バグ関連）】
  - computeCtx() に ctx.state を渡す（match_flow が H2H を state.h2h に保存できるように）
  - 各試合開始ごとに state.h2h を必ずリセット（前試合のH2H汚染を防ぐ）

  【追加：NATIONAL（40チーム運用）】
  - data_cpu_teams.js の national01〜national39 を使う
  - 40チームを4グループ(A/B/C/D)に分け、6セッション（AB/CD/AC/AD/BC/BD）を回す
  - 1セッション = 20チームで「いつもの5試合」
  - 合計 6セッション（＝全体で 30試合）で総合ポイントを累積し、最後に総合result表示
  - 既存の「20チーム前提ロジック」を壊さずに40チーム運用できる方式

  【今回追加：ローカル大会終了後の挙動】
  - 総合result表示（showTournamentResult）の次のNEXTで：
    ① 1週進める
    ② トップ10ならナショナル参加権を保存
    ③ 大会UIを閉じてメインへ戻す（endTournament）
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.sim = window.MOBBR.sim || {};

(function(){

  const L = window.MOBBR.sim.tournamentLogic;
  const R = window.MOBBR.sim.tournamentResult;

  const K_LOCAL_QUAL_NAT_S1 = 'mobbr_national_qualified_s1';
  const EVT_ADVANCE_WEEK = 'mobbr:advanceWeek';
  const EVT_LOCAL_DONE = 'mobbr:localTournamentDone';

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

    // eliminatedRound は result 側が見る（ここでは shape だけ）
    if (!Number.isFinite(Number(t.eliminatedRound))) t.eliminatedRound = 0;

    if (!t.eventBuffs || typeof t.eventBuffs !== 'object'){
      t.eventBuffs = { aim:0, mental:0, agi:0 };
    }

    // ✅ members を必ず3人分持つ（キル/アシストの裏集計が壊れないように）
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
    // ✅ ctx.state を渡す（H2H保存/順位矯正で必須）
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
    // ✅ 試合開始ごとに H2H をリセット（前試合の汚染を防ぐ）
    state.h2h = {};

    L.resetForNewMatch(state);
    L.initDropPositions(state, getPlayer);

    const p = getPlayer();
    if (p){
      const info = getAreaInfo(p.areaId);
      state.ui.bg = info.img || state.ui.bg;
    }
  }

  // ===== core sim (kept) =====
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

    // localは従来通り
    if (state.mode === 'local'){
      return state.matchIndex > state.matchCount;
    }

    // nationalは「6セッションすべて完走」したら終了
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
  // LOCAL finish helpers（top10/週進行/メイン復帰）
  // =========================================================
  function buildTotalRankingRows(){
    const total = state?.tournamentTotal || {};
    const arr = Object.values(total || {}).filter(Boolean);

    // result側に専用関数があるならそれを使う（あれば優先）
    try{
      if (R && typeof R.computeTournamentTotalTable === 'function'){
        const rows = R.computeTournamentTotalTable(state);
        if (Array.isArray(rows) && rows.length) return rows;
      }
      if (R && typeof R.computeTournamentResultTable === 'function'){
        const rows = R.computeTournamentResultTable(state);
        if (Array.isArray(rows) && rows.length) return rows;
      }
    }catch(e){}

    // フォールバック：UIと同じ並び（sumTotal desc → KP desc）
    arr.sort((a,b)=>{
      const ta = Number(a.sumTotal ?? a.Total ?? 0);
      const tb = Number(b.sumTotal ?? b.Total ?? 0);
      if (tb !== ta) return tb - ta;

      const ppa = Number(a.sumPlacementP ?? a.PlacementP ?? 0);
      const ppb = Number(b.sumPlacementP ?? b.PlacementP ?? 0);
      if (ppb !== ppa) return ppb - ppa;

      const ka = Number(a.KP ?? 0);
      const kb = Number(b.KP ?? 0);
      if (kb !== ka) return kb - ka;

      const aa = Number(a.AP ?? 0);
      const ab = Number(b.AP ?? 0);
      if (ab !== aa) return ab - aa;

      const na = String(a.squad ?? a.name ?? a.id ?? '');
      const nb = String(b.squad ?? b.name ?? b.id ?? '');
      return na.localeCompare(nb);
    });

    return arr;
  }

  function getPlayerPlacementFromTotal(){
    const rows = buildTotalRankingRows();
    const pid = 'PLAYER';

    for (let i=0;i<rows.length;i++){
      const r = rows[i];
      const id = String(r?.id ?? r?.teamId ?? r?.squadId ?? '');
      const isPlayer = !!r?.isPlayer || id === pid || String(r?.squad ?? '').toUpperCase().includes('PLAYER');
      if (isPlayer) return i + 1;
    }

    // state.teamsからも拾う（totalのidが欠けている場合）
    for (let i=0;i<rows.length;i++){
      const r = rows[i];
      const squad = String(r?.squad ?? '');
      if (squad && squad.toUpperCase().includes('PLAYER')) return i + 1;
    }

    return 999;
  }

  function setNationalQualifiedFlag(qualified){
    try{
      localStorage.setItem(K_LOCAL_QUAL_NAT_S1, qualified ? '1' : '0');
    }catch(e){}
  }

  function advanceWeek(n){
    const weeks = Number(n||0) || 0;
    if (!weeks) return;

    // 可能なら既存関数を叩く
    try{
      const uiMain = window.MOBBR?.ui?.main;
      if (uiMain && typeof uiMain.advanceWeek === 'function'){
        uiMain.advanceWeek(weeks);
        return;
      }
    }catch(e){}

    try{
      const core = window.MOBBR;
      if (core && typeof core.advanceWeek === 'function'){
        core.advanceWeek(weeks);
        return;
      }
    }catch(e){}

    // 汎用イベント
    try{
      window.dispatchEvent(new CustomEvent(EVT_ADVANCE_WEEK, { detail:{ weeks } }));
    }catch(e){}
  }

  function notifyLocalTournamentDone(payload){
    try{
      window.dispatchEvent(new CustomEvent(EVT_LOCAL_DONE, { detail: payload || {} }));
    }catch(e){}
  }

  function finalizeLocalTournamentAndReturnToMain(){
    const placement = getPlayerPlacementFromTotal();
    const qualified = (placement <= 10);

    setNationalQualifiedFlag(qualified);
    advanceWeek(1);

    notifyLocalTournamentDone({
      placement,
      qualifiedNational: qualified,
      key: K_LOCAL_QUAL_NAT_S1
    });

    // UI閉じる（メインへ戻る）
    setRequest('endTournament', {});
  }

  // =========================================================
  // NATIONAL helpers（DataCPU から national01〜39 を読む）
  // =========================================================

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
    const id = String(c?.teamId || c?.id || '');
    const nm = String(c?.name || id || '');

    // DataCPUの members（powerMin/powerMax）を「名前/役割」に使う
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

      // ✅ powerは membersレンジ＋basePower を使って抽選（logicの関数を使用）
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

  function cloneDeep(v){
    return JSON.parse(JSON.stringify(v));
  }

  function buildNationalPlan(cpu39){
    // 39チームをシャッフルして、A(9) / B(10) / C(10) / D(10)
    const ids = L.shuffle(cpu39.map(t=>String(t.teamId||t.id||'')).filter(Boolean));
    const A = ids.slice(0, 9);
    const B = ids.slice(9, 19);
    const C = ids.slice(19, 29);
    const D = ids.slice(29, 39);

    // 6セッション（AB / CD / AC / AD / BC / BD）
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
    // ✅ player.power の NaN/undefined を防止
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

  function buildTeamsForNationalSession(allTeamDefs, plan, sessionIndex){
    const s = plan.sessions[sessionIndex];
    const g = plan.groups;

    const pick = [];
    for (const gr of (s?.groups || [])){
      const list = g[gr] || [];
      pick.push(...list);
    }

    // 20チームにする：Aを含むセッションは PLAYER を必ず入れる（9+10+PLAYER=20）
    // Aを含まないセッション（例 CD）は 10+10=20 なので PLAYER は入れない
    const includesA = (s?.groups || []).includes('A');

    const out = [];
    if (includesA){
      out.push(cloneDeep(allTeamDefs.PLAYER));
    }

    for (const id of pick){
      const def = allTeamDefs[id];
      if (def) out.push(cloneDeep(def));
    }

    // 念のため 20に揃える（不足時はA/B/C/Dから補充、超過時は切る）
    if (out.length < 20){
      const allIds = []
        .concat(g.A||[], g.B||[], g.C||[], g.D||[])
        .filter(Boolean);
      const rest = allIds.filter(x => !out.some(t=>t.id===x));
      for (const id of rest){
        if (out.length >= 20) break;
        const def = allTeamDefs[id];
        if (def) out.push(cloneDeep(def));
      }
    }
    if (out.length > 20) out.length = 20;

    return out;
  }

  function setNationalBanners(){
    const s = state.national || {};
    const si = Number(s.sessionIndex||0);
    const sc = Number(s.sessionCount||6);
    const key = String(s.sessions?.[si]?.key || `S${si+1}`);

    state.bannerLeft  = `NATIONAL ${key} (${si+1}/${sc})`;
    state.bannerRight = `MATCH ${state.matchIndex} / ${state.matchCount}`;
  }

  // =========================================================
  // ===== main step machine =====
  // =========================================================
  function step(){
    if (!state) return;

    const p = getPlayer();

    if (state.phase === 'done'){
      setRequest('noop', {});
      return;
    }

    // ===== local: after tournament total shown =====
    if (state.phase === 'local_finish_after_total'){
      finalizeLocalTournamentAndReturnToMain();
      state.phase = 'done';
      return;
    }

    // ===== intro =====
    if (state.phase === 'intro'){
      if (state.mode === 'national'){
        setNationalBanners();
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

      // intro文
      if (state.mode === 'national'){
        const s = state.national || {};
        const si = Number(s.sessionIndex||0);
        const sc = Number(s.sessionCount||6);
        const key = String(s.sessions?.[si]?.key || `S${si+1}`);
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
        setNationalBanners();
        // 右側は降下固定表示にする
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
        setNationalBanners();
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
      finishMatchAndBuildResult();

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

      // =========================
      // LOCAL（従来通り + 終了後処理）
      // =========================
      if (state.mode === 'local'){
        if (state.matchIndex >= state.matchCount){
          setRequest('showTournamentResult', { total: state.tournamentTotal });
          state.phase = 'local_finish_after_total'; // ✅ 次のNEXTで週進行/参加権/閉じる
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

      // =========================
      // NATIONAL（6セッション）
      // =========================
      if (state.mode === 'national'){
        const nat = state.national || {};
        const si = Number(nat.sessionIndex||0);
        const sc = Number(nat.sessionCount||6);

        // まだセッション内の試合が残っている → 次の試合へ
        if (state.matchIndex < state.matchCount){
          startNextMatch();

          state.ui.bg = 'tent.png';
          state.ui.squareBg = 'tent.png';
          state.ui.leftImg = getPlayerSkin();
          state.ui.rightImg = '';
          state.ui.topLeftName = '';
          state.ui.topRightName = '';

          setNationalBanners();
          setCenter3(`次の試合へ`, `MATCH ${state.matchIndex} / ${state.matchCount}`, '');
          setRequest('nextMatch', { matchIndex: state.matchIndex });
          state.phase = 'coach_done';
          return;
        }

        // セッション終了
        const isLastSession = (si >= sc - 1);

        if (isLastSession){
          // 全セッション完走 → 総合result
          setRequest('showTournamentResult', { total: state.tournamentTotal });
          state.phase = 'done';
          return;
        }

        // 次セッションへ行く通知
        const curKey  = String(nat.sessions?.[si]?.key || `S${si+1}`);
        const nextKey = String(nat.sessions?.[si+1]?.key || `S${si+2}`);

        setRequest('showNationalNotice', {
          qualified: false,
          line1: `SESSION ${curKey} 終了！`,
          line2: `次：SESSION ${nextKey} へ`,
          line3: 'NEXTで進行'
        });

        state.phase = 'national_next_session';
        return;
      }

      // fallback
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

      // セッション切替：teamsを差し替える（tournamentTotalは保持）
      const plan = nat.plan;
      const defs = nat.allTeamDefs;

      state.teams = buildTeamsForNationalSession(defs, plan, nextIndex);

      // セッション内試合をリセット
      state.matchIndex = 1;
      state.round = 1;

      state.selectedCoachSkill = null;
      state.selectedCoachQuote = '';

      // 画面はintroから（チーム紹介→コーチ→降下）
      state.phase = 'intro';

      setRequest('noop', {});
      return;
    }

    setRequest('noop', {});
  }

  // =========================================================
  // ===== start: LOCAL =====
  // =========================================================
  function startLocalTournament(){
    const cpuAllLocal = L.getCpuTeamsLocalOnly();
    const cpu19 = L.shuffle(cpuAllLocal).slice(0, 19);

    // ✅ player.power の NaN/undefined を防止（66→試合55問題の直撃点）
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

      // ✅プレイヤーも3人枠を用意（名前は後でUIで差し替え可）
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

      // ✅CPUのメンバー名/役割をDataCPUから持ち込む（無い場合はフォールバック）
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

      // ✅ H2H（順位矯正用）…試合ごとに initMatchDrop でリセット
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
  // ===== start: NATIONAL =====
  // =========================================================
  function startNationalTournament(){
    // DataCPUから national01〜national39 を取る
    const cpu39 = getCpuTeamsByPrefix('national');
    if (!cpu39 || cpu39.length < 10){
      console.error('[tournament_core] National teams not found. Check data_cpu_teams.js');
      // フォールバック：ローカルを開始
      startLocalTournament();
      return;
    }

    // 39を前提（足りない場合も一応動く）
    const plan = buildNationalPlan(cpu39);

    // 全チームの「基礎定義」を最初に作って固定（セッションごとに再抽選しない）
    const allTeamDefs = {};
    allTeamDefs.PLAYER = makePlayerRuntime();

    for (const c of cpu39){
      const rt = mkRuntimeTeamFromCpuDef(c);
      if (rt?.id) allTeamDefs[rt.id] = rt;
    }

    const sessionCount = plan.sessions.length;

    // 初回セッションの20チームを作る
    const teams = buildTeamsForNationalSession(allTeamDefs, plan, 0);

    state = {
      mode: 'national',

      // セッション内の試合（いつも通り 5試合）
      matchIndex: 1,
      matchCount: 5,
      round: 1,

      phase: 'intro',

      teams,

      // 総合合算（全セッションで累積）
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
        allTeamDefs
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
    // starts
    startLocalTournament,
    startNationalTournament,

    // core stepping
    step,
    getState,

    // ui bridges
    getCoachMaster,
    getEquippedCoachList,
    setCoachSkill,
    getPlayerSkin,
    getAreaInfo,

    // internals
    initMatchDrop,
    applyEventForTeam,
    simulateRound,
    fastForwardToMatchEnd,
    finishMatchAndBuildResult,
    startNextMatch,
    isTournamentFinished
  };

})();
