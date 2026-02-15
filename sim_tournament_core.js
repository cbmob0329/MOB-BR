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

  【NATIONAL（Split1 前半：3月第1週）対応】
  - 40チーム（ローカル勝ち上がり10＋ナショナル30）を A〜D（各10）に振り分け
  - プレイヤーチームは必ず A
  - 前半の進行：
      ① AB 20チームで5試合（プレイヤー参加）
      ② 40チーム総合順位を表示（この時点で C/D は0点）
      ③ CD 20チームで5試合（裏処理・画面には出さない）
      ④ AC 20チームで5試合（プレイヤー参加）
      ⑤ 40チーム総合順位を表示
      ⑥ 1週進めてメインへ（ここではUIへ通知するrequestを出す）

  ※「裏処理」は “UIを出さずに内部で5試合分を即解決→合計に加算” で実現
  ※ 既存の「20チーム前提ロジック」は壊さない（セッション毎に20チームのstate.teamsで回す）
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.sim = window.MOBBR.sim || {};

(function(){

  const L = window.MOBBR.sim.tournamentLogic;
  const R = window.MOBBR.sim.tournamentResult;

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

    if (state.mode === 'local'){
      return state.matchIndex > state.matchCount;
    }

    // national split1-week1 は「3セッション完走」したら終了（AB/CD/AC）
    if (state.mode === 'national'){
      const s = state.national || {};
      const lastSession = (Number(s.sessionIndex||0) >= (Number(s.sessionCount||3) - 1));
      const lastMatchDone = (state.matchIndex > state.matchCount);
      return !!(lastSession && lastMatchDone);
    }

    return state.matchIndex > state.matchCount;
  }

  function resolveOneBattle(A, B, round){
    return L.resolveOneBattle(state, A, B, round, ensureTeamRuntimeShape, computeCtx);
  }

  // =========================================================
  // NATIONAL helpers（DataCPU から nationalXX を読む）
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

  function cloneDeep(v){
    return JSON.parse(JSON.stringify(v));
  }

  // ---- Split1 Week1 plan（AB → CD(裏) → AC）----
  function buildNationalWeek1Plan(ids39){
    // 40チームにするため「Aは PLAYER + 9」「B/C/Dは10ずつ」
    // ids39 は PLAYER以外の39
    const ids = L.shuffle(ids39.slice());
    const A = ids.slice(0, 9);
    const B = ids.slice(9, 19);
    const C = ids.slice(19, 29);
    const D = ids.slice(29, 39);

    const sessions = [
      { key:'AB', groups:['A','B'], play:true,  showStandings:true },
      { key:'CD', groups:['C','D'], play:false, showStandings:false }, // 裏処理
      { key:'AC', groups:['A','C'], play:true,  showStandings:true },
    ];

    return { groups:{A,B,C,D}, sessions };
  }

  function makePlayerRuntime(){
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

    const includesA = (s?.groups || []).includes('A');

    const out = [];
    if (includesA){
      out.push(cloneDeep(allTeamDefs.PLAYER));
    }

    for (const id of pick){
      const def = allTeamDefs[id];
      if (def) out.push(cloneDeep(def));
    }

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

  function initTournamentTotalFor40(allTeamIds){
    // tournamentTotal に 0点で全員分を作っておく（C/Dが未試合でも0で出すため）
    try{
      if (!state.tournamentTotal || typeof state.tournamentTotal !== 'object') state.tournamentTotal = {};
      for (const id of allTeamIds){
        if (!state.tournamentTotal[id]){
          state.tournamentTotal[id] = {
            id,
            name: id,
            matchCount: 0,
            placementP: 0,
            kp: 0,
            ap: 0,
            treasure: 0,
            flag: 0,
            total: 0
          };
        }
      }
      // PLAYERの名前は正しいものへ
      if (state.tournamentTotal.PLAYER){
        state.tournamentTotal.PLAYER.name = localStorage.getItem(L.K.teamName) || state.tournamentTotal.PLAYER.name || 'PLAYER TEAM';
      }
      // CPUのnameも入れ直し
      if (state.national?.allTeamDefs){
        for (const id of allTeamIds){
          const def = state.national.allTeamDefs[id];
          if (def && state.tournamentTotal[id]) state.tournamentTotal[id].name = def.name || state.tournamentTotal[id].name;
        }
      }
    }catch(e){}
  }

  function setNationalBanners(){
    const s = state.national || {};
    const si = Number(s.sessionIndex||0);
    const sc = Number(s.sessionCount||3);
    const key = String(s.sessions?.[si]?.key || `S${si+1}`);

    state.bannerLeft  = `NATIONAL ${key} (${si+1}/${sc})`;
    state.bannerRight = `MATCH ${state.matchIndex} / ${state.matchCount}`;
  }

  // ---- CD裏処理（5試合ぶんをUI無しで一気に解決）----
  function runSessionSilently(){
    // 現在の state.teams（20）で 5試合回して、結果を tournamentTotal に加算する
    for (let mi = 1; mi <= state.matchCount; mi++){
      // 試合開始shape
      state.matchIndex = mi;
      state.round = 1;
      state.selectedCoachSkill = null;
      state.selectedCoachQuote = '';
      initMatchDrop();

      // 6RぶんをUI無しで完走
      while(state.round <= 6){
        const r = state.round;

        if (r === 6){
          for(const t of state.teams){
            if (!t.eliminated) t.areaId = 25;
          }
        }

        // eventもUI無しで適用（プレイヤーはいない前提だが安全に回す）
        const ec = L.eventCount(r);
        if (ec > 0){
          for (const tm of state.teams){
            if (!tm || tm.eliminated) continue;
            for (let k=0;k<ec;k++){
              L.applyEventForTeam(state, tm, computeCtx);
            }
          }
        }

        const matches = L.buildMatchesForRound(state, r, getPlayer, aliveTeams);
        const ctx = computeCtx();
        for(const [A,B] of matches){
          ensureTeamRuntimeShape(A);
          ensureTeamRuntimeShape(B);
          if (window.MOBBR?.sim?.matchFlow?.resolveBattle){
            window.MOBBR.sim.matchFlow.resolveBattle(A, B, r, ctx);
          }
        }

        if (r <= 5) L.moveAllTeamsToNextRound(state, r);
        state.round++;
      }
      state.round = 7;

      finishMatchAndBuildResult();
    }

    // 次のセッションへ行く前提なので matchIndex をリセットする
    state.matchIndex = 1;
    state.round = 1;
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

      if (state.mode === 'national'){
        const s = state.national || {};
        const si = Number(s.sessionIndex||0);
        const sc = Number(s.sessionCount||3);
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
      // LOCAL（従来通り）
      // =========================
      if (state.mode === 'local'){
        if (state.matchIndex >= state.matchCount){
          setRequest('showTournamentResult', { total: state.tournamentTotal });
          state.phase = 'done';
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
      // NATIONAL（Split1 Week1：AB→CD裏→AC）
      // =========================
      if (state.mode === 'national'){
        const nat = state.national || {};
        const si = Number(nat.sessionIndex||0);
        const sc = Number(nat.sessionCount||3);
        const ses = nat.sessions?.[si] || {};
        const key = String(ses.key || `S${si+1}`);

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

        // --- セッション終了 ---
        // standings表示が必要なセッション（AB/AC）は 40総合順位を出す
        if (ses.showStandings){
          // 40全員分0点含めて表示できるように初期化
          initTournamentTotalFor40(nat.allTeamIds || []);
          setRequest('showTournamentResult', {
            total: state.tournamentTotal,
            national: true,
            sessionKey: key
          });
          state.phase = 'national_standings_done';
          return;
        }

        // standings無し（CD裏）は 次セッションへ
        state.phase = 'national_next_session';
        return;
      }

      setRequest('showTournamentResult', { total: state.tournamentTotal });
      state.phase = 'done';
      return;
    }

    // ===== national: standings done =====
    if (state.phase === 'national_standings_done'){
      // ABのあと：CDを裏処理してからACへ（プレイ感覚はAB→AC）
      const nat = state.national || {};
      const si = Number(nat.sessionIndex||0);
      const ses = nat.sessions?.[si] || {};
      const key = String(ses.key || '');

      if (key === 'AB'){
        // 次はCD（裏処理）
        nat.sessionIndex = si + 1; // CDへ
        state.national = nat;

        // CDの20チームをセットして裏処理
        const plan = nat.plan;
        const defs = nat.allTeamDefs;

        state.teams = buildTeamsForNationalSession(defs, plan, nat.sessionIndex);
        state.matchIndex = 1;
        state.round = 1;
        state.selectedCoachSkill = null;
        state.selectedCoachQuote = '';

        // 裏処理実行（UI無し）
        runSessionSilently();

        // CD完了 → ACへ
        nat.sessionIndex = nat.sessionIndex + 1; // ACへ
        state.national = nat;

        state.teams = buildTeamsForNationalSession(defs, plan, nat.sessionIndex);
        state.matchIndex = 1;
        state.round = 1;
        state.selectedCoachSkill = null;
        state.selectedCoachQuote = '';
        state.phase = 'intro';
        setRequest('noop', {});
        return;
      }

      if (key === 'AC'){
        // 前半終了：1週進めてメインへ（UIに通知）
        setRequest('showNationalNotice', {
          qualified: false,
          line1: '3月第1週終了！',
          line2: 'メイン画面へ戻ります',
          line3: 'NEXTで進行'
        });
        state.phase = 'national_week_end';
        return;
      }

      // 想定外：次へ
      state.phase = 'national_next_session';
      setRequest('noop', {});
      return;
    }

    // ===== national: next session handler =====
    if (state.phase === 'national_next_session'){
      const nat = state.national || {};
      const si = Number(nat.sessionIndex||0);
      const sc = Number(nat.sessionCount||3);

      const nextIndex = Math.min(sc-1, si+1);
      nat.sessionIndex = nextIndex;
      state.national = nat;

      const plan = nat.plan;
      const defs = nat.allTeamDefs;

      state.teams = buildTeamsForNationalSession(defs, plan, nextIndex);

      state.matchIndex = 1;
      state.round = 1;

      state.selectedCoachSkill = null;
      state.selectedCoachQuote = '';

      state.phase = 'intro';

      setRequest('noop', {});
      return;
    }

    // ===== national: week end =====
    if (state.phase === 'national_week_end'){
      // 「週進行＆メニュー復帰」は外側（メイン側）に任せるため、ここでは明示requestを出す
      setRequest('endNationalWeek', { weeks: 1 });
      state.phase = 'done';
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
  // ===== start: NATIONAL（Split1 Week1） =====
  // =========================================================
  function startNationalTournament(){
    // national01〜national39 が居ても「30だけ使う」想定（足りないときはあるだけ）
    const cpuNationalAll = getCpuTeamsByPrefix('national');

    // ローカル勝ち上がり枠（9つ）…専用データが無い場合は local pool から取る
    let cpuQual = [];
    try{
      if (typeof L.getCpuTeamsLocalOnly === 'function'){
        cpuQual = L.shuffle(L.getCpuTeamsLocalOnly()).slice(0, 9);
      }
    }catch(e){
      cpuQual = [];
    }

    const national30 = (cpuNationalAll || []).slice(0, 30);

    // PLAYER以外39枠：ローカル9 + ナショナル30
    const cpu39 = []
      .concat(cpuQual || [])
      .concat(national30 || [])
      .slice(0, 39);

    if (!cpu39 || cpu39.length < 20){
      console.error('[tournament_core] National teams not found. Check data_cpu_teams.js');
      startLocalTournament();
      return;
    }

    const plan = buildNationalWeek1Plan(cpu39.map(t=>String(t.teamId||t.id||'')).filter(Boolean));

    // 全チームの「基礎定義」を固定（セッションごとに再抽選しない）
    const allTeamDefs = {};
    allTeamDefs.PLAYER = makePlayerRuntime();

    for (const c of cpu39){
      const rt = mkRuntimeTeamFromCpuDef(c);
      if (rt?.id) allTeamDefs[rt.id] = rt;
    }

    const allTeamIds = ['PLAYER'].concat(Object.keys(allTeamDefs).filter(id=>id!=='PLAYER')).slice(0,40);

    const sessionCount = plan.sessions.length;

    const teams = buildTeamsForNationalSession(allTeamDefs, plan, 0);

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
        allTeamIds
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

    // 40チームの0点初期化（AB後の総合順位でC/Dが0で出るため）
    initTournamentTotalFor40(allTeamIds);

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
