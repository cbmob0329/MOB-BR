'use strict';

/*
  sim_tournament_core.js（フル）
  ✅ sim_tournament_flow.js v3.2.0 を “挙動そのまま” で3分割した core
  - state保持
  - stepマシン
  - UI request 発行
  - 公開API: window.MOBBR.sim.tournamentFlow（名称維持）

  v3.2.1（今回修正）
  ✅ CPUチーム名：teamIdではなく data_cpu_teams.js の「name（日本語名）」を優先して採用
  ✅ ui_tournament.js 側の表示に合わせて showMatchResult / showTournamentResult のpayload形を補正
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
    if (!Number.isFinite(Number(t.power))) t.power = 55;
    if (t.eliminated !== true) t.eliminated = false;
    if (!Number.isFinite(Number(t.areaId))) t.areaId = 1;
    if (!Number.isFinite(Number(t.treasure))) t.treasure = 0;
    if (!Number.isFinite(Number(t.flag))) t.flag = 0;
    if (!t.eventBuffs || typeof t.eventBuffs !== 'object'){
      t.eventBuffs = { aim:0, mental:0, agi:0 };
    }
  }

  function computeCtx(){
    const player = getPlayer();
    const coachFlags = window.MOBBR?.sim?.matchFlow?.getPlayerCoachFlags
      ? window.MOBBR.sim.matchFlow.getPlayerCoachFlags()
      : {};
    return { player, playerCoach: coachFlags };
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

  // UI側（ui_tournament.js）は selectCoachSkill を呼ぶ可能性があるので、両方用意
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
  function selectCoachSkill(skillId){ setCoachSkill(skillId); }

  function getPlayerSkin(){ return L.getEquippedSkin(); }
  function getAreaInfo(areaId){ return L.getAreaInfo(areaId); }

  function applyEventForTeam(team){
    return L.applyEventForTeam(state, team, computeCtx);
  }

  function initMatchDrop(){
    L.resetForNewMatch(state);
    L.initDropPositions(state, getPlayer);

    const p = getPlayer();
    if (p){
      const info = getAreaInfo(p.areaId);
      state.ui.bg = info.img || state.ui.bg;
    }
  }

  // ===== core sim: one round (unused by UI step machine, kept) =====
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

  function _buildUiMatchRows(rows){
    const byId = new Map((state?.teams || []).map(t=>[t.id, t]));
    return (rows || []).map(r=>{
      const t = byId.get(r.id) || {};
      const kills = Number(r.KP ?? r.kills_total ?? 0); // uiはK列
      const treasure = Number(r.Treasure ?? r.treasure ?? 0);
      const flag = Number(r.Flag ?? r.flag ?? 0);
      return {
        rank: Number(r.placement ?? r.rank ?? 0),
        id: String(r.id ?? ''),
        name: String(r.squad ?? r.name ?? r.id ?? ''),
        kills_total: kills,
        treasure,
        flag,
        isPlayer: !!t.isPlayer
      };
    });
  }

  function _buildUiTournamentTotal(){
    const total = state.tournamentTotal || {};
    const out = {};
    for (const [id, v] of Object.entries(total)){
      // v: { id, squad, sumPlacementP, KP, AP, Treasure, Flag, sumTotal }
      const t = (state.teams || []).find(x=>x.id===id) || null;
      out[id] = {
        id: String(id),
        name: String(v.squad || t?.name || id),
        points: Number(v.sumTotal ?? 0),
        kills_total: Number(v.KP ?? 0) + Number(v.AP ?? 0),
        treasure: Number(v.Treasure ?? 0),
        flag: Number(v.Flag ?? 0),
        isPlayer: !!t?.isPlayer
      };
    }
    return out;
  }

  function finishMatchAndBuildResult(){
    const rows = R.computeMatchResultTable(state);
    R.addToTournamentTotal(state, rows);
    state.lastMatchResultRows = rows;

    // ui_tournament.js 表示用（互換）
    state.lastMatchUiRows = _buildUiMatchRows(rows);
  }

  function startNextMatch(){
    state.matchIndex += 1;
    state.round = 1;
    state.selectedCoachSkill = null;
    state.selectedCoachQuote = '';
    initMatchDrop();
  }

  function isTournamentFinished(){
    return state.matchIndex > state.matchCount;
  }

  function resolveOneBattle(A, B, round){
    return L.resolveOneBattle(state, A, B, round, ensureTeamRuntimeShape, computeCtx);
  }

  // ===== main step machine =====
  function step(){
    if (!state) return;

    // 毎stepで request 上書き（UI迷子防止）
    const p = getPlayer();

    if (state.phase === 'done'){
      setRequest('noop', {});
      return;
    }

    // intro
    if (state.phase === 'intro'){
      state.bannerLeft = 'ローカル大会';
      state.bannerRight = '20チーム';

      state.ui.bg = 'maps/neonmain.png';
      state.ui.squareBg = 'tent.png';

      state.ui.leftImg = getPlayerSkin();
      state.ui.rightImg = '';
      state.ui.topLeftName = '';
      state.ui.topRightName = '';

      setCenter3('本日のチームをご紹介！', '', '');
      setRequest('showIntroText', {});
      state.phase = 'teamList';
      return;
    }

    if (state.phase === 'teamList'){
      setCenter3('', '', '');
      setRequest('showTeamList', { teams: state.teams.map(t=>({
        id:t.id, name:t.name, power:t.power, alive:t.alive, eliminated:t.eliminated, treasure:t.treasure, flag:t.flag, isPlayer:!!t.isPlayer
      }))});
      state.phase = 'teamList_done';
      return;
    }

    if (state.phase === 'teamList_done'){
      setCenter3('それでは試合を開始します！', '使用するコーチスキルを選択してください！', '');
      setRequest('showCoachSelect', {
        equipped: getEquippedCoachList(),
        master: L.COACH_MASTER
      });
      state.phase = 'coach_done';
      return;
    }

    if (state.phase === 'coach_done'){
      initMatchDrop();

      state.bannerLeft = `MATCH ${state.matchIndex} / 5`;
      state.bannerRight = '降下';

      state.ui.leftImg = getPlayerSkin();
      state.ui.rightImg = '';
      state.ui.topLeftName = '';
      state.ui.topRightName = '';

      // ✅ tent は毎試合共通（開始前）
      state.ui.bg = 'tent.png';
      state.ui.squareBg = 'tent.png';

      setCenter3('バトルスタート！', '降下開始…！', '');
      setRequest('showDropStart', {});
      state.phase = 'drop_land';
      return;
    }

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

    // ===== round loop =====
    if (state.phase === 'round_start'){
      const r = state.round;

      state.bannerLeft = `MATCH ${state.matchIndex} / 5`;
      state.bannerRight = `ROUND ${r}`;

      // ✅交戦以外は右側クリア
      state.ui.rightImg = '';
      state.ui.topLeftName = '';
      state.ui.topRightName = '';

      setCenter3(`Round ${r} 開始！`, '', '');
      setRequest('showRoundStart', { round: r });

      state.phase = 'round_events';
      state._eventsToShow = L.eventCount(r);
      return;
    }

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

      // ✅交戦以外は右側クリア
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

    if (state.phase === 'round_battles'){
      const r = state.round;

      const matches = L.buildMatchesForRound(state, r, getPlayer, aliveTeams);
      state._roundMatches = matches.map(([A,B])=>({ aId:A.id, bId:B.id }));
      state._matchCursor = 0;

      setRequest('prepareBattles', { round: r, slots: L.battleSlots(r), matches: state._roundMatches });
      state.phase = 'battle_one';
      return;
    }

    // ✅ battle_one：CPU同士はここで即解決してスキップ（ユーザー入力を消費しない）
    if (state.phase === 'battle_one'){
      const r = state.round;
      const list = Array.isArray(state._roundMatches) ? state._roundMatches : [];
      let cur = Number(state._matchCursor||0);

      // まずCPU同士を連続処理（プレイヤー関与が来るまで進める）
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
          // ここで止めて encounter を出す
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

        // CPU同士はここで即resolve
        resolveOneBattle(A, B, r);
        cur++;
      }

      // roundの交戦が終わった → 移動 or R6結果へ
      state._matchCursor = cur;
      state.phase = (r <= 5) ? 'round_move' : 'match_result';
      return step();
    }

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
        // 念のため：ここに来たら即処理して次へ
        resolveOneBattle(A, B, r);
        state._matchCursor = cur + 1;
        state.phase = 'battle_one';
        return step();
      }

      const me = A.isPlayer ? A : B;
      const foe = A.isPlayer ? B : A;

      const res = resolveOneBattle(A, B, r);
      const iWon = res ? (res.winnerId === me.id) : false;

      // ✅交戦中だけ右側を保持（UI側も交戦以外で必ず消す）
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

      // ✅負けて全滅したら：裏で最後まで進行→チャンピオン表示→result
      if (!iWon && me.eliminated){
        // 裏処理
        fastForwardToMatchEnd();

        // Champion表示（この時点で placements は確定）
        const championName = R.getChampionName(state);

        // showBattle を UI に見せた後、NEXTで champion に行くため phase を分ける
        state._afterBattleGo = { type:'champion', championName };
        state.phase = 'battle_after';
        return;
      }

      // 次の交戦へ（NEXTで進む）
      state._afterBattleGo = { type:'nextBattle' };
      state.phase = 'battle_after';
      return;
    }

    // showBattle を見せ終わった後の遷移点（NEXTでここに来る）
    if (state.phase === 'battle_after'){
      const cur = Number(state._matchCursor||0);
      const go = state._afterBattleGo || { type:'nextBattle' };

      state._afterBattleGo = null;

      if (go.type === 'champion'){
        // 交戦以外は右側クリア
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

      // 次の交戦へ
      state._matchCursor = cur + 1;
      state.phase = 'battle_one';
      // ここでstep()は呼ばず、次のNEXTで battle_one が動く（表示テンポを守る）
      setRequest('noop', {});
      return;
    }

    if (state.phase === 'round_move'){
      const r = state.round;

      const p3 = getPlayer();
      const before = p3 ? getAreaInfo(p3.areaId) : null;

      // round移動：ここで全員動かす
      L.moveAllTeamsToNextRound(state, r);

      const p4 = getPlayer();
      const after = p4 ? getAreaInfo(p4.areaId) : null;

      state.ui.bg = 'ido.png';
      state.ui.leftImg = getPlayerSkin();

      // ✅移動中/到着は右側不要
      state.ui.rightImg = '';
      state.ui.topLeftName = '';
      state.ui.topRightName = '';

      setCenter3('', '', '');
      setRequest('showMove', {
        fromAreaId: before?.id || 0,
        toAreaId: after?.id || 0,
        toName: after?.name || '',
        toBg: after?.img || '',
        holdMs: 0
      });

      // ✅showArriveは廃止：NEXTで次roundへ
      state.phase = 'round_move_done';
      return;
    }

    if (state.phase === 'round_move_done'){
      // NEXTで次roundへ（UIはshowMove内で到着演出を完結させている想定）
      state.round += 1;
      state.phase = (state.round <= 6) ? 'round_start' : 'match_result';
      setRequest('noop', {});
      return;
    }

    if (state.phase === 'match_result'){
      finishMatchAndBuildResult();

      // ✅交戦以外は右側クリア
      state.ui.rightImg = '';
      state.ui.topLeftName = '';
      state.ui.topRightName = '';

      // ui_tournament.js は payload.result を見に行くので、互換payloadを渡す
      setRequest('showMatchResult', {
        matchIndex: state.matchIndex,
        matchCount: state.matchCount,
        result: state.lastMatchUiRows || []
      });
      state.phase = 'match_result_done';
      return;
    }

    if (state.phase === 'match_result_done'){
      if (state.matchIndex >= state.matchCount){
        // ui_tournament.js は total の中身を points/score でソートするので points を入れる
        setRequest('showTournamentResult', { total: _buildUiTournamentTotal() });
        state.phase = 'done';
        return;
      }

      startNextMatch();

      // ✅次試合開始前は毎回 tent
      state.ui.bg = 'tent.png';
      state.ui.squareBg = 'tent.png';
      state.ui.leftImg = getPlayerSkin();
      state.ui.rightImg = '';
      state.ui.topLeftName = '';
      state.ui.topRightName = '';

      setCenter3(`次の試合へ`, `MATCH ${state.matchIndex} / 5`, '');
      setRequest('nextMatch', { matchIndex: state.matchIndex });
      state.phase = 'coach_done'; // 次試合は毎回「コーチ選択」から入る（仕様通り）
      return;
    }

    setRequest('noop', {});
  }

  // ===== start =====
  function startLocalTournament(){
    const cpuAllLocal = L.getCpuTeamsLocalOnly();
    const cpu19 = L.shuffle(cpuAllLocal).slice(0, 19);

    const player = {
      id: 'PLAYER',
      name: localStorage.getItem(L.K.teamName) || 'PLAYER TEAM',
      isPlayer: true,

      power: L.calcPlayerTeamPower(),

      alive: 3,
      eliminated: false,
      areaId: 1,

      kills_total: 0,
      assists_total: 0,
      members: [],
      treasure: 0,
      flag: 0,
      eventBuffs: { aim:0, mental:0, agi:0 }
    };

    const teams = [player];

    cpu19.forEach((c, i)=>{
      const id = c.teamId || c.id || `localXX_${i+1}`;

      // ✅ここが今回の本題：表示名は teamId じゃなく data_cpu_teams.js の c.name を最優先
      const nm = String(c.name || c.teamName || c.team_id || c.teamId || c.id || id);

      teams.push({
        id,
        name: nm,
        isPlayer: false,

        power: L.rollCpuTeamPowerFromMembers(c),

        alive: 3,
        eliminated: false,
        areaId: 1,

        kills_total: 0,
        assists_total: 0,
        members: [],
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

      playerContestedAtDrop: false,

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

  // ✅ 公開API（従来名維持）
  window.MOBBR.sim.tournamentFlow = {
    startLocalTournament,
    step,
    getState,

    getCoachMaster,
    getEquippedCoachList,

    // ui側互換
    setCoachSkill,
    selectCoachSkill,

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
