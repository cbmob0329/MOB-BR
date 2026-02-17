/* =========================================================
   sim_tournament_core.js（FULL）
   - 進行（state/step/公開API）を担当
   - National：
     ✅ セッション順 AB→CD→AC→AD→BC→BD
     ✅ Aが出ないセッション（CD/BC/BD）は「完全オート高速処理」
     ✅ 5試合ごとに「40チーム総合RESULT」を必ず表示
     ✅ セッション完了は state.national.doneSessions に記録（UIで赤表示用）
     ✅ ローカルTOP10（mobbr_split1_local_top10）を必ず40枠に含める
     ✅ ローカルTOP10（Player除く9チーム）を A～D に 1/3/2/3 で振り分け
        （AはPlayerが別枠で入るので合計 2/3/2/3 になる）
   - “大会終了後処理” は tournamentCorePost が存在すれば呼ぶ
     ✅ Local: 「総合RESULT表示 → 次のNEXTで notice → 次のNEXTで post実行 → UI閉じる」
     ✅ National: 「総合RESULT表示 → 次のNEXTで notice → 次のNEXTで post実行（あれば） → 無ければ endNationalWeek 通知」
   - FIX:
     ✅ セッション6後に存在しないセッション7へ行こうとして BD が無限ループする問題を完全修正
   ========================================================= */
'use strict';

window.MOBBR = window.MOBBR || {};
window.MOBBR.sim = window.MOBBR.sim || {};

(function(){

  const L = window.MOBBR.sim.tournamentLogic;
  const R = window.MOBBR.sim.tournamentResult;

  const N = window.MOBBR?.sim?.tournamentCoreNational || null;
  const P = window.MOBBR?.sim?.tournamentCorePost || null;

  // ---- Local TOP10 key（post側と合わせる）----
  const K_LOCAL_TOP10 = 'mobbr_split1_local_top10';

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
  // FINAL順位算出（notice用）
  // =========================================================
  function _buildSortedTotalRows(total){
    const t = total || {};
    const arr = Object.values(t || {});
    arr.sort((a,b)=>{
      const pa = Number(a.sumTotal ?? 0);
      const pb = Number(b.sumTotal ?? 0);
      if (pb !== pa) return pb - pa;

      const ppa = Number(a.sumPlacementP ?? 0);
      const ppb = Number(b.sumPlacementP ?? 0);
      if (ppb !== ppa) return ppb - ppa;

      const ka = Number(a.sumKP ?? a.KP ?? 0);
      const kb = Number(b.sumKP ?? b.KP ?? 0);
      if (kb !== ka) return kb - ka;

      const aa = Number(a.sumAP ?? a.AP ?? 0);
      const ab = Number(b.sumAP ?? b.AP ?? 0);
      if (ab !== aa) return ab - aa;

      const da = Number(a.downs_total ?? 0);
      const db = Number(b.downs_total ?? 0);
      if (da !== db) return da - db; // downsは少ない方が上（タイブレ）

      const pwa = Number(a.power ?? 0);
      const pwb = Number(b.power ?? 0);
      if (pwb !== pwa) return pwb - pwa;

      const na = String(a.squad ?? a.id ?? '');
      const nb = String(b.squad ?? b.id ?? '');
      return na.localeCompare(nb);
    });
    return arr;
  }

  function _findTeamRankFromTotal(teamId){
    const id = String(teamId || 'PLAYER');
    const arr = _buildSortedTotalRows(state?.tournamentTotal || {});
    for (let i=0;i<arr.length;i++){
      const r = arr[i];
      const rid = String(r.id ?? r.teamId ?? '');
      if (rid === id) return { rank:i+1, row:r, arr };
    }
    return { rank:999, row:null, arr };
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

  function _getSessionKey(){
    const s = state?.national || {};
    const si = Number(s.sessionIndex||0);
    return String(s.sessions?.[si]?.key || '');
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

  // ✅ A無しセッションを「完全オート高速処理」：5試合分を即解決 → 総合RESULT表示へ
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
  // ===== main step machine =====
  // =========================================================
  function step(){
    if (!state) return;

    const p = getPlayer();

    // ✅ Local: 総合RESULTを見せたあと、次のNEXTで「進出/敗退メッセージ」→ 次のNEXTで post → UI閉じる
    if (state.phase === 'local_total_result_wait_notice'){
      const rk = _findTeamRankFromTotal('PLAYER');
      const rank = Number(rk.rank || 999);

      if (rank <= 10){
        setRequest('showNationalNotice', {
          qualified: true,
          line1: `${rank}位でナショナル大会進出を決めた！`,
          line2: '大会に備えよう！',
          line3: 'NEXTで進行'
        });
      }else{
        setRequest('showNationalNotice', {
          qualified: false,
          line1: `${rank}位で敗退。。`,
          line2: '次こそはナショナル大会に出られるよう頑張ろう！',
          line3: 'NEXTで進行'
        });
      }
      state.phase = 'local_total_result_wait_post';
      return;
    }

    // ✅ Local: post 実行 → UI閉じる
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

    // ✅ National: 最終総合RESULT後 → 次のNEXTで「進出/敗退メッセージ」→ 次のNEXTで post or endNationalWeek
    if (state.phase === 'national_total_result_wait_notice'){
      const rk = _findTeamRankFromTotal('PLAYER');
      const rank = Number(rk.rank || 999);

      if (rank <= 8){
        setRequest('showNationalNotice', {
          qualified: true,
          line1: '世界大会出場決定！',
          line2: 'NEXTで進行',
          line3: ''
        });
        // 次のNEXTで追加メッセージを出したい → もう1段階
        state.phase = 'national_total_result_wait_notice2';
        return;
      }

      if (rank >= 9 && rank <= 28){
        setRequest('showNationalNotice', {
          qualified: true,
          line1: 'ラストチャンスへの繋がった！',
          line2: '絶対勝つぞ！',
          line3: 'NEXTで進行'
        });
      }else{
        setRequest('showNationalNotice', {
          qualified: false,
          line1: 'ここで敗退。',
          line2: '次のシーズンこそは。。',
          line3: 'NEXTで進行'
        });
      }

      state.phase = 'national_total_result_wait_post';
      return;
    }

    if (state.phase === 'national_total_result_wait_notice2'){
      setRequest('showNationalNotice', {
        qualified: true,
        line1: 'ワールドファイナルに向けて特訓だ！',
        line2: '',
        line3: 'NEXTで進行'
      });
      state.phase = 'national_total_result_wait_post';
      return;
    }

    // ✅ National: 最終総合RESULT後 → 次のNEXTで post（あれば）→ 無ければ endNationalWeek
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
        setRequest('endTournament', {});
      }else{
        setRequest('endNationalWeek', { weeks: 1 });
      }
      return;
    }

    // ✅ National: セッションごとの総合RESULT表示後（= 5試合終わるごと）
    if (state.phase === 'national_session_total_result_wait_notice'){
      const nat = state.national || {};
      const si = Number(nat.sessionIndex||0);
      const sc = Number(nat.sessionCount||6);

      // ★★★ FIX（決定打）：最終セッションなら「存在しない次セッション」へ行かず、最終処理へ ★★★
      if (si >= sc - 1){
        // ここに来るのは「A無しのオート最終(BD)」などのケース
        setRequest('showTournamentResult', { total: state.tournamentTotal });
        state.phase = 'national_total_result_wait_notice';
        return;
      }

      const curKey  = String(nat.sessions?.[si]?.key || `S${si+1}`);
      const nextKey = String(nat.sessions?.[si+1]?.key || `S${si+2}`);

      // このタイミングで完了マーク（UIで赤）
      _markSessionDone(curKey);

      setRequest('showNationalNotice', {
        qualified: false,
        line1: `SESSION ${curKey} 終了！`,
        line2: `次：SESSION ${nextKey} へ`,
        line3: 'NEXTで進行'
      });
      state.phase = 'national_notice_wait_next_session';
      return;
    }

    // ✅ National: Notice後 → 次セッションへ組み替え
    if (state.phase === 'national_notice_wait_next_session'){
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

      state.phase = 'intro';
      setRequest('noop', {});
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
        setCenter3('ナショナルリーグ開幕！', `SESSION ${key} (${si+1}/${sc})`, '');

        // ✅ Aが出ないセッションは即オート
        if (!_sessionHasPlayer(si)){
          // バナー更新
          _setNationalBanners();
          state.bannerRight = `AUTO SESSION ${key}`;

          // ここでオート実行し、いきなり総合RESULTへ
          _autoRunNationalSession();

          // ★★★ FIX（保険）：最終セッションなら notice→postへ ★★★
          if (si >= (state.national.sessionCount - 1)){
            setRequest('showTournamentResult', { total: state.tournamentTotal });
            state.phase = 'national_total_result_wait_notice';
            return;
          }

          setRequest('showTournamentResult', { total: state.tournamentTotal });
          state.phase = 'national_session_total_result_wait_notice';
          return;
        }
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
          // ※チャンピオン画像不要は ui_tournament.js 側で最終対応（次）
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

      // LOCAL
      if (state.mode === 'local'){
        if (state.matchIndex >= state.matchCount){
          setRequest('showTournamentResult', { total: state.tournamentTotal });
          state.phase = 'local_total_result_wait_notice'; // ★追加：notice を挟む
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

        // 次のmatchへ（同セッション内）
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

        const isLastSession = (si >= sc - 1);

        // ✅ 5試合ごとに40チーム総合RESULT
        setRequest('showTournamentResult', { total: state.tournamentTotal });

        if (isLastSession){
          // ★変更：最終は notice を挟んでから post/endNationalWeek
          state.phase = 'national_total_result_wait_notice';
          return;
        }

        // 非最終：次のNEXTで Notice → 次セッションへ
        state.phase = 'national_session_total_result_wait_notice';
        return;
      }

      setRequest('showTournamentResult', { total: state.tournamentTotal });
      state.phase = 'done';
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

    // ---- Local TOP10 ids（PLAYER含む可能性あり）----
    let localTopIds = [];
    try{
      const raw = localStorage.getItem(K_LOCAL_TOP10);
      if (raw){
        const j = JSON.parse(raw);
        if (Array.isArray(j)) localTopIds = j.map(x=>String(x||'')).filter(Boolean);
      }
    }catch(e){}

    // Playerは別枠なので除外
    localTopIds = localTopIds.filter(id => String(id) !== 'PLAYER');

    // ---- local top 9 defs ----
    const localTopDefs = _getCpuTeamsByIds(localTopIds);

    // ---- national 30 defs（prefix: national）----
    const nationalDefs = _getCpuTeamsByPrefix('national');

    // 40枠：PLAYER + local9 + national30 が理想
    // local9が不足する場合は nationalから補う（ただし40は維持）
    const localIds9 = L.shuffle(localTopDefs.map(t=>String(t.teamId||t.id||'')).filter(Boolean)).slice(0,9);

    const nationalIdsAll = L.shuffle(nationalDefs.map(t=>String(t.teamId||t.id||'')).filter(Boolean));
    const nationalIds30 = nationalIdsAll.slice(0, 30);

    if (nationalIds30.length < 10){
      console.error('[tournament_core] National teams not found. Check data_cpu_teams.js');
      startLocalTournament();
      return;
    }

    const plan = _buildNationalPlanWithLocalTop10(localIds9, nationalIds30);

    // ---- build allTeamDefs（40チーム）----
    const allTeamDefs = {};
    allTeamDefs.PLAYER = _makePlayerRuntime();

    // local9
    const localDefMap = {};
    for (const c of localTopDefs){
      const rt = _mkRuntimeTeamFromCpuDef(c);
      if (rt?.id) localDefMap[rt.id] = rt;
    }
    for (const id of localIds9){
      if (localDefMap[id]) allTeamDefs[id] = localDefMap[id];
    }

    // national30
    const natDefMap = {};
    for (const c of nationalDefs){
      const rt = _mkRuntimeTeamFromCpuDef(c);
      if (rt?.id) natDefMap[rt.id] = rt;
    }
    for (const id of nationalIds30){
      if (natDefMap[id]) allTeamDefs[id] = natDefMap[id];
    }

    // セッション0の20チーム
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
        sessionCount: plan.sessions.length,
        allTeamDefs,
        doneSessions: [] // ✅ UIで赤表示するため
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
