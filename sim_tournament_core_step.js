'use strict';

/* =========================================================
   sim_tournament_core_step.js（FULL） v5.7
   - 2分割：base（sim_tournament_core_step_base.js）を先に読み込む前提
   - 親ファイル名はそのまま維持
   - world系は sim_tournament_core_step.world.js へ分離
   - ✅ app.js を触らずに済むよう、world側はこのファイルから自動読込
   - v5.6 の全機能維持（Local / LastChance / National / WORLD Qual+Losers+Final は壊さない）
   - ✅ resultの件：showMatchResult に渡す currentOverall を毎回更新（base側の safe helper）
   - ✅ PLAYER の power を「試合開始のたびに」localStorageの値で必ず再注入（55化防止）
   - ✅ 試合result → NEXT で必ず総合RESULTを1回挟む
   - ✅ 演出/ログ強化
      - ローカル / ナショナル / ラストチャンス / WORLD の到着時文言を強化
      - 各大会の終了後メッセージを順位別に強化
      - WORLD予選 / LOSERS / FINAL の専用通知を追加
      - 点灯通知 / 世界一決定通知を強化
   - ✅ v5.7（今回）
      - FIX: 到着時ログがマッチごとに「大会到着演出」っぽく見える問題を修正
        → 大会開幕文言は intro だけ、drop_land は純粋な着地/初動文言だけに整理
      - FIX: ナショナルで通過していないのに通過メッセージが出る問題を修正
        → 順位判定を currentOverallRows 依存だけでなく tournamentTotal からも厳密算出
========================================================= */

window.MOBBR = window.MOBBR || {};
window.MOBBR.sim = window.MOBBR.sim || {};

(function(){

  const T = window.MOBBR?.sim?._tcore;
  if (!T){
    console.error('[tournament_core_step] shared not loaded: window.MOBBR.sim._tcore missing');
    return;
  }

  const B = T._stepBase;
  if (!B){
    console.error('[tournament_core_step] base not loaded: T._stepBase missing (load sim_tournament_core_step_base.js first)');
    return;
  }

  const L = B.L;
  const P = B.P;

  // base shortcuts
  const getPlayer = B.getPlayer;
  const aliveTeams = B.aliveTeams;

  const ensureTeamRuntimeShape = B.ensureTeamRuntimeShape;
  const setRequest = B.setRequest;
  const setCenter3 = B.setCenter3;

  const getPlayerSkin = B.getPlayerSkin;
  const getAreaInfo = B.getAreaInfo;

  const applyEventForTeam = B.applyEventForTeam;
  const initMatchDrop = B.initMatchDrop;

  const fastForwardToMatchEnd = B.fastForwardToMatchEnd;
  const finishMatchAndBuildResult = B.finishMatchAndBuildResult;
  const startNextMatch = B.startNextMatch;
  const resolveOneBattle = B.resolveOneBattle;

  const _setNationalBanners = B._setNationalBanners;
  const _getSessionKey = B._getSessionKey;
  const _markSessionDone = B._markSessionDone;
  const _sessionHasPlayer = B._sessionHasPlayer;
  const _autoRunNationalSession = B._autoRunNationalSession;

  // helpers
  const initTotalForIds = B.initTotalForIds;
  const cpuLootRollOncePerRound = B.cpuLootRollOncePerRound;

  const getChampionNameSafe = B.getChampionNameSafe;
  const ensureMatchResultRows = B.ensureMatchResultRows;
  const ensureCurrentOverallRows = B.ensureCurrentOverallRows;

  const resolveFullMatchToEndAfterPlayerEliminated = B.resolveFullMatchToEndAfterPlayerEliminated;

  const setWorldBanners = B.setWorldBanners;

  const computeRankedIdsFromTotal = B.computeRankedIdsFromTotal;
  const swapTeamsToIds = B.swapTeamsToIds;
  const initWorldMetaIfNeeded = B.initWorldMetaIfNeeded;
  const showWorldFinalReservedAndGoMain = B.showWorldFinalReservedAndGoMain;

  const WORLD_FINAL_MATCH_POINT = B.WORLD_FINAL_MATCH_POINT;
  const ensureWorldFinalMP = B.ensureWorldFinalMP;
  const updateWorldFinalLitByTotals = B.updateWorldFinalLitByTotals;
  const checkWorldFinalWinnerByRule = B.checkWorldFinalWinnerByRule;
  const getOverallTopId = B.getOverallTopId;

  const resolveTeamNameById = B.resolveTeamNameById;
  const getNewlyLitIdsThisMatch = B.getNewlyLitIdsThisMatch;
  const markLitAnnounced = B.markLitAnnounced;
  const buildLitNamesLine = B.buildLitNamesLine;

  // =========================================================
  // world split shared export
  // =========================================================
  const WORLD_SHARED = window.MOBBR.sim._tcoreStepWorldShared = window.MOBBR.sim._tcoreStepWorldShared || {};

  // =========================================================
  // world split autoload
  // =========================================================
  let worldStepReadyPromise = null;

  function getVersionSuffixFromCurrentScript(){
    try{
      const cur = document.currentScript;
      if (cur && cur.src){
        const u = new URL(cur.src, window.location.href);
        return u.search || '';
      }
    }catch(_){}
    return '';
  }

  function ensureWorldStepReady(){
    if (window.MOBBR.sim._tcoreStepWorldLoaded){
      return Promise.resolve(window.MOBBR.sim._tcoreStepWorld || {});
    }

    if (worldStepReadyPromise) return worldStepReadyPromise;

    worldStepReadyPromise = new Promise((resolve, reject)=>{
      try{
        const existing = document.querySelector('script[data-mobbr="sim_tournament_core_step.world"]');
        if (existing){
          existing.addEventListener('load', ()=>resolve(window.MOBBR.sim._tcoreStepWorld || {}), { once:true });
          existing.addEventListener('error', reject, { once:true });
          return;
        }

        const suffix = getVersionSuffixFromCurrentScript();
        const s = document.createElement('script');
        s.src = `sim_tournament_core_step.world.js${suffix}`;
        s.defer = true;
        s.dataset.mobbr = 'sim_tournament_core_step.world';

        s.onload = ()=>{
          window.MOBBR.sim._tcoreStepWorldLoaded = true;
          resolve(window.MOBBR.sim._tcoreStepWorld || {});
        };
        s.onerror = (e)=>{
          console.error('[tournament_core_step] failed to load sim_tournament_core_step.world.js');
          reject(e);
        };

        document.head.appendChild(s);
      }catch(e){
        reject(e);
      }
    });

    return worldStepReadyPromise;
  }

  function callWorldHandler(name, state){
    try{
      const api = window.MOBBR.sim._tcoreStepWorld || {};
      const fn = api[name];
      if (typeof fn === 'function'){
        return !!fn(state);
      }
    }catch(e){
      console.error(`[tournament_core_step] world handler failed: ${name}`, e);
    }
    return false;
  }

  function worldHandlersReady(){
    return !!window.MOBBR.sim._tcoreStepWorldLoaded;
  }

  // =========================================================
  // ✅ 追加: PLAYER power を localStorage から再注入（試合で55になるのを防ぐ）
  // =========================================================
  function _readPlayerPowerFromStorage(){
    try{
      let v = Number(localStorage.getItem('mobbr_team_power'));
      if (Number.isFinite(v) && v > 0) return v;

      v = Number(localStorage.getItem('mobbr_teamPower'));
      if (Number.isFinite(v) && v > 0) return v;

      return null;
    }catch(_){
      return null;
    }
  }

  function _syncPlayerPower(state){
    try{
      if (!state) return false;

      const p = getPlayer();
      if (!p) return false;

      ensureTeamRuntimeShape(p);

      const v = _readPlayerPowerFromStorage();
      if (v == null) return false;

      p.power = v;

      try{
        if (Array.isArray(state.teams)){
          const idx = state.teams.findIndex(t => String(t?.id) === String(p.id));
          if (idx >= 0){
            state.teams[idx].power = v;
          }
        }
      }catch(_){}

      return true;
    }catch(_){
      return false;
    }
  }

  // =========================================================
  // 演出/通知 helper
  // =========================================================
  function _getOverallRowsSafe(state){
    try{
      ensureCurrentOverallRows(state);
    }catch(_){}
    return Array.isArray(state?.currentOverallRows) ? state.currentOverallRows : [];
  }

  function _rankRowsFromTournamentTotal(state){
    try{
      const total = state?.tournamentTotal || {};
      const arr = Object.values(total || {});
      if (!arr.length) return [];

      arr.sort((a,b)=>{
        const pa = Number(a.sumTotal ?? a.total ?? 0);
        const pb = Number(b.sumTotal ?? b.total ?? 0);
        if (pb !== pa) return pb - pa;

        const ka = Number(a.sumKP ?? a.KP ?? a.kp ?? 0);
        const kb = Number(b.sumKP ?? b.KP ?? b.kp ?? 0);
        if (kb !== ka) return kb - ka;

        const ppa = Number(a.sumPlacementP ?? a.PP ?? a.placementP ?? 0);
        const ppb = Number(b.sumPlacementP ?? b.PP ?? b.placementP ?? 0);
        if (ppb !== ppa) return ppb - ppa;

        return String(a.name || a.squad || a.id || '').localeCompare(String(b.name || b.squad || b.id || ''));
      });

      return arr;
    }catch(_){
      return [];
    }
  }

  function _getPlayerOverallRank(state){
    const rows = _getOverallRowsSafe(state);
    const idx = rows.findIndex(r => String(r?.id) === 'PLAYER');
    if (idx >= 0) return idx + 1;

    const ranked = _rankRowsFromTournamentTotal(state);
    const idx2 = ranked.findIndex(r => String(r?.id) === 'PLAYER');
    if (idx2 >= 0) return idx2 + 1;

    return 999;
  }

  function _buildLocalArrivalLines(){
    return [
      'いよいよ今シーズンのローカル大会が開幕！',
      '10位までに入ればナショナル大会へ！',
      '1戦1戦大事にしよう！'
    ];
  }

  function _buildNationalArrivalLines(){
    return [
      'ナショナル大会が開幕！',
      '上位8チームがワールドファイナルへ！',
      '全国の猛者と決戦だ！'
    ];
  }

  function _buildLastChanceArrivalLines(){
    return [
      'ラストチャンスが開幕！',
      'ナショナル9位〜28位が闘志を燃やす！',
      '1位か2位でワールドファイナルへ進出出来る！'
    ];
  }

  function _buildLocalFinishNotice(state){
    const rank = _getPlayerOverallRank(state);

    if (rank === 1){
      return {
        line1: 'やったね！1位でナショナル大会へ進出を決めたよ！',
        line2: '自信を持って次へ備えよう！',
        line3: '最高のローカル制覇！'
      };
    }
    if (rank >= 2 && rank <= 5){
      return {
        line1: '上位で突破！',
        line2: '次はナショナル大会！',
        line3: 'しっかり準備しよう！'
      };
    }
    if (rank >= 6 && rank <= 9){
      return {
        line1: 'なんとかナショナル出場権を獲得！',
        line2: 'ギリギリでも突破は突破！',
        line3: '頑張るぞ！'
      };
    }
    if (rank === 10){
      return {
        line1: 'ボーダーでナショナル出場権を獲得！',
        line2: '危なかった..',
        line3: 'ここから巻き返そう！'
      };
    }
    return {
      line1: `今回のローカル大会は${rank}位で終了。`,
      line2: '次のシーズンに備えよう！',
      line3: ''
    };
  }

  function _buildNationalFinishNotice(state){
    const rank = _getPlayerOverallRank(state);

    if (rank === 1){
      return {
        line1: 'やったー！1位でワールドファイナル進出を決めたよ！',
        line2: '最高の形で世界へ！',
        line3: '全国制覇達成！'
      };
    }
    if (rank >= 2 && rank <= 8){
      return {
        line1: '世界大会決定！',
        line2: 'やったね！',
        line3: '世界の舞台へ進もう！'
      };
    }
    if (rank >= 9 && rank <= 28){
      return {
        line1: '突破ならず。',
        line2: 'でもラストチャンスの権利を手に入れた！',
        line3: '最後まで諦めないで！'
      };
    }
    return {
      line1: `今回のナショナル大会は${rank}位で終了。`,
      line2: '次のシーズンに備えよう！',
      line3: ''
    };
  }

  function _buildLastChanceFinishNotice(state){
    const rank = _getPlayerOverallRank(state);

    if (rank === 1){
      return {
        line1: 'やったー！1位でワールドファイナル進出を決めたよ！',
        line2: '世界一が見えて来た！',
        line3: '最後の切符を堂々獲得！'
      };
    }
    if (rank === 2){
      return {
        line1: '2位で突破！',
        line2: 'やったね！',
        line3: '帰ってトレーニングだ！'
      };
    }
    return {
      line1: `${rank}位で終了。`,
      line2: 'また次のシーズンで頑張ろう！',
      line3: ''
    };
  }

  function _showThreeLineNotice(state, lines, opts){
    const a = String(lines?.line1 || '');
    const b = String(lines?.line2 || '');
    const c = String(lines?.line3 || '');

    state.ui.rightImg = '';
    state.ui.topLeftName = '';
    state.ui.topRightName = '';

    setCenter3(a, b, c);
    setRequest('showNationalNotice', Object.assign({
      qualified: false,
      line1: a,
      line2: b,
      line3: c
    }, opts || {}));
  }

  // =========================================================
  // shared exports for world split
  // =========================================================
  Object.assign(WORLD_SHARED, {
    T, B, L, P,

    getPlayer,
    aliveTeams,
    ensureTeamRuntimeShape,
    setRequest,
    setCenter3,
    getPlayerSkin,
    getAreaInfo,
    applyEventForTeam,
    initMatchDrop,
    fastForwardToMatchEnd,
    finishMatchAndBuildResult,
    startNextMatch,
    resolveOneBattle,

    _setNationalBanners,
    _getSessionKey,
    _markSessionDone,
    _sessionHasPlayer,
    _autoRunNationalSession,

    initTotalForIds,
    cpuLootRollOncePerRound,
    getChampionNameSafe,
    ensureMatchResultRows,
    ensureCurrentOverallRows,
    resolveFullMatchToEndAfterPlayerEliminated,

    setWorldBanners,
    computeRankedIdsFromTotal,
    swapTeamsToIds,
    initWorldMetaIfNeeded,
    showWorldFinalReservedAndGoMain,

    WORLD_FINAL_MATCH_POINT,
    ensureWorldFinalMP,
    updateWorldFinalLitByTotals,
    checkWorldFinalWinnerByRule,
    getOverallTopId,

    resolveTeamNameById,
    getNewlyLitIdsThisMatch,
    markLitAnnounced,
    buildLitNamesLine,

    _readPlayerPowerFromStorage,
    _syncPlayerPower,
    _getOverallRowsSafe,
    _getPlayerOverallRank,

    _buildLocalArrivalLines,
    _buildNationalArrivalLines,
    _buildLastChanceArrivalLines,
    _buildLocalFinishNotice,
    _buildNationalFinishNotice,
    _buildLastChanceFinishNotice,
    _showThreeLineNotice
  });

  // =========================================================
  // ✅ MATCH SKIP（外部から呼ぶAPI）
  // =========================================================
  function skipCurrentMatch(){
    const state = T.getState();
    if (!state) return;
    if (state.phase === 'match_result' || state.phase === 'match_result_done') return;
    state.phase = 'match_skip_fast';
  }
  T.skipCurrentMatch = skipCurrentMatch;

  // =========================================================
  // ===== main step machine ====
  // =========================================================
  function step(){
    const state = T.getState();
    if (!state) return;

    const p = getPlayer();

    // =========================================================
    // world split delegated phases
    // =========================================================
    if (worldHandlersReady() && callWorldHandler('handleWorldPhase', state)){
      return;
    }

    if (state.mode === 'world' && !worldHandlersReady()){
      console.warn('[tournament_core_step] world split not ready yet');
    }

    // =========================================================
    // ✅ match skip fast
    // =========================================================
    if (state.phase === 'match_skip_fast'){
      try{
        const pt = getPlayer();
        if (pt){
          ensureTeamRuntimeShape(pt);
          pt.eventBuffs = { aim:-20, mental:-20, agi:-20 };
          pt.treasure = 0;
          pt.flag = 0;
        }
      }catch(_){}

      try{ fastForwardToMatchEnd(); }catch(_){}
      try{ finishMatchAndBuildResult(); }catch(_){}
      try{ ensureMatchResultRows(state); }catch(_){}
      try{ ensureCurrentOverallRows(state); }catch(_){}

      state.ui.rightImg = '';
      state.ui.topLeftName = '';
      state.ui.topRightName = '';

      setRequest('showMatchResult', {
        matchIndex: state.matchIndex,
        matchCount: state.matchCount,
        rows: state.lastMatchResultRows,
        currentOverall: Array.isArray(state.currentOverallRows) ? state.currentOverallRows : []
      });

      state.phase = 'match_result_done';
      return;
    }

    // =========================================================
    // ✅ Local 終了通知 → post → close
    // =========================================================
    if (state.phase === 'local_total_result_wait_post'){
      _showThreeLineNotice(
        state,
        _buildLocalFinishNotice(state),
        { qualified: (_getPlayerOverallRank(state) <= 10) }
      );
      state.phase = 'local_finish_notice_wait_end';
      return;
    }

    if (state.phase === 'local_finish_notice_wait_end'){
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

    // =========================================================
    // ✅ LastChance 終了通知 → post → close
    // =========================================================
    if (state.phase === 'lastchance_total_result_wait_post'){
      _showThreeLineNotice(
        state,
        _buildLastChanceFinishNotice(state),
        { qualified: (_getPlayerOverallRank(state) <= 2) }
      );
      state.phase = 'lastchance_finish_notice_wait_end';
      return;
    }

    if (state.phase === 'lastchance_finish_notice_wait_end'){
      try{
        if (P?.onLastChanceTournamentFinished){
          P.onLastChanceTournamentFinished(state, state.tournamentTotal);
        }else if (window.MOBBR?.sim?.tournamentCorePost?.onLastChanceTournamentFinished){
          window.MOBBR.sim.tournamentCorePost.onLastChanceTournamentFinished(state, state.tournamentTotal);
        }
      }catch(e){
        console.error('[tournament_core] onLastChanceTournamentFinished error:', e);
      }
      state.phase = 'done';
      setRequest('endTournament', {});
      return;
    }

    // =========================================================
    // ✅ NATIONAL 最終終了通知 → post
    // =========================================================
    if (state.phase === 'national_total_result_wait_post'){
      const rank = _getPlayerOverallRank(state);
      _showThreeLineNotice(
        state,
        _buildNationalFinishNotice(state),
        { qualified: (rank >= 1 && rank <= 8) }
      );
      state.phase = 'national_finish_notice_wait_end';
      return;
    }

    if (state.phase === 'national_finish_notice_wait_end'){
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

    // ✅ National: AUTOセッション開始表示
    if (state.phase === 'national_auto_session_wait_run'){
      const nat = state.national || {};
      const si = Number(nat.sessionIndex||0);
      const key = _getSessionKey(si) || `S${si+1}`;

      _autoRunNationalSession();
      _markSessionDone(key);

      const label = String((nat.sessions?.[si]?.groups || []).join(' & ') || key);
      setRequest('showAutoSessionDone', {
        sessionKey: key,
        line1: '全試合終了！',
        line2: '現在の総合ポイントはこちら！',
        line3: 'NEXTでRESULT表示',
        title: '全試合終了！',
        sub: '現在の総合ポイントはこちら！',
        sessionLabel: label
      });
      state.phase = 'national_auto_session_done_wait_result';
      return;
    }

    // ✅ National: AUTOセッション完了表示の次 → 総合RESULT表示
    if (state.phase === 'national_auto_session_done_wait_result'){
      const nat = state.national || {};
      const si = Number(nat.sessionIndex||0);
      const sc = Number(nat.sessionCount||6);
      const isLastSession = (si >= sc - 1);

      setRequest('showTournamentResult', { total: state.tournamentTotal });

      if (state.mode === 'world' && String(state.worldPhase||'qual') === 'qual' && isLastSession){
        state.phase = 'world_qual_total_result_wait_branch';
        return;
      }

      if (isLastSession){
        state.phase = 'national_total_result_wait_post';
      }else{
        state.phase = 'national_session_total_result_wait_notice';
      }
      return;
    }

    // ✅ National: セッションごとの総合RESULT表示後
    if (state.phase === 'national_session_total_result_wait_notice'){
      const nat = state.national || {};
      const si = Number(nat.sessionIndex||0);
      const sc = Number(nat.sessionCount||6);

      const curKey  = String(nat.sessions?.[si]?.key || `S${si+1}`);
      const isLastSession = (si >= sc - 1);

      if (isLastSession){
        if (state.mode === 'world' && String(state.worldPhase||'qual') === 'qual'){
          state.phase = 'world_qual_total_result_wait_branch';
          setRequest('noop', {});
          return;
        }

        state.phase = 'national_total_result_wait_post';
        setRequest('noop', {});
        return;
      }

      const nextKey = String(nat.sessions?.[si+1]?.key || `S${si+2}`);

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

      if (si >= sc - 1){
        state.phase = 'national_total_result_wait_post';
        setRequest('noop', {});
        return;
      }

      const nextIndex = si + 1;
      nat.sessionIndex = nextIndex;
      state.national = nat;

      const plan = nat.plan;
      const defs = nat.allTeamDefs;

      state.teams = T._buildTeamsForNationalSession(defs, plan, nextIndex);

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
        state.matchCount = 3;
      }
      if (state.mode === 'world' && String(state.worldPhase||'qual') === 'qual'){
        state.matchCount = 3;
      }

      if (state.mode === 'national'){
        _setNationalBanners();
      }else if (state.mode === 'lastchance'){
        state.bannerLeft = 'ラストチャンス';
        state.bannerRight = '20チーム';
      }else if (state.mode === 'world'){
        setWorldBanners(state, '');
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
        const lines = _buildNationalArrivalLines();
        setCenter3(lines[0], lines[1], lines[2]);

        const s = state.national || {};
        const si = Number(s.sessionIndex||0);
        const key = String(s.sessions?.[si]?.key || `S${si+1}`);

        if (!_sessionHasPlayer(si)){
          _setNationalBanners();
          state.bannerRight = `AUTO SESSION ${key}`;

          const groups = s.sessions?.[si]?.groups || [];
          const label = groups.length === 2 ? `${groups[0]} & ${groups[1]}` : key;

          setRequest('showAutoSession', {
            sessionKey: key,
            line1: `${label} 試合進行中..`,
            line2: '',
            line3: 'NEXTで進行',
            title: `${label} 試合進行中..`,
            sub: ''
          });
          state.phase = 'national_auto_session_wait_run';
          return;
        }
      }else if (state.mode === 'world'){
        if (worldHandlersReady() && callWorldHandler('handleWorldIntro', state)){
          return;
        }
      }else if (state.mode === 'lastchance'){
        const lines = _buildLastChanceArrivalLines();
        setCenter3(lines[0], lines[1], lines[2]);
      }else{
        const lines = _buildLocalArrivalLines();
        setCenter3(lines[0], lines[1], lines[2]);
      }

      setRequest('showIntroText', {});
      state.phase = 'teamList';
      return;
    }

    // ===== team list =====
    if (state.phase === 'teamList'){
      setCenter3('', '', '');
      setRequest('showTeamList', { teams: state.teams.map(t=>( {
        id:t.id, name:t.name, power:t.power, alive:t.alive, eliminated:t.eliminated, treasure:t.treasure, flag:t.flag, isPlayer:!!t.isPlayer
      }))});
      state.phase = 'teamList_done';
      return;
    }

    // ===== coach select（廃止）→ NEXTで降下へ =====
    if (state.phase === 'teamList_done'){
      if (state.mode === 'local'){
        setCenter3('それでは試合を開始します！', '10位以内を目指して頑張ろう！', '');
      }else if (state.mode === 'national'){
        setCenter3('それでは試合を開始します！', '上位8チームがワールドファイナルへ！', '');
      }else if (state.mode === 'lastchance'){
        setCenter3('それでは試合を開始します！', '1位か2位でワールドファイナルへ！', '');
      }else if (state.mode === 'world'){
        if (worldHandlersReady() && callWorldHandler('handleWorldTeamListDone', state)){
          return;
        }
      }else{
        setCenter3('それでは試合を開始します！', '', '');
      }

      setRequest('showIntroText', {});
      state.phase = 'coach_done';
      return;
    }

    // ===== match start =====
    if (state.phase === 'coach_done'){

      _syncPlayerPower(state);

      initMatchDrop();

      _syncPlayerPower(state);

      if (state.mode === 'national'){
        _setNationalBanners();
        state.bannerRight = '降下';
      }else if (state.mode === 'world'){
        setWorldBanners(state, '降下');
      }else{
        state.bannerLeft = `MATCH ${state.matchIndex} / ${state.matchCount || 5}`;
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

      if (state.mode === 'local'){
        setCenter3(
          `${info.name}に到着！`,
          contested ? '初動から敵影あり！' : 'まずは周囲を確認しよう！',
          contested ? '落ち着いて最初の接敵に備えよう！' : '安全に装備を整えよう！'
        );
      }else if (state.mode === 'national'){
        setCenter3(
          `${info.name}に到着！`,
          contested ? '全国の猛者と初動から接触！' : 'ここから試合開始だ！',
          contested ? '序盤から油断するな！' : '上位8を目指して動こう！'
        );
      }else if (state.mode === 'lastchance'){
        setCenter3(
          `${info.name}に到着！`,
          contested ? 'いきなり接敵の気配！' : '最後の切符を懸けた戦いが始まる！',
          contested ? 'ここで負けられない！' : '1位か2位を目指そう！'
        );
      }else if (state.mode === 'world'){
        if (worldHandlersReady() && callWorldHandler('handleWorldDropLand', state)){
          state.ui.rightImg = '';
          state.ui.topLeftName = '';
          state.ui.topRightName = '';

          setRequest('showDropLanded', { areaId: info.id, areaName: info.name, bg: info.img, contested });
          state.phase = 'round_start';
          state.round = 1;
          return;
        }
      }else{
        setCenter3(`${info.name}に到着！`, '', '');
      }

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
      }else if (state.mode === 'world'){
        setWorldBanners(state, `ROUND ${r}`);
      }else{
        state.bannerLeft = `MATCH ${state.matchIndex} / ${state.matchCount || 5}`;
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

      cpuLootRollOncePerRound(state, r);

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
            matchIndex: state.matchIndex,

            meMembers: Array.isArray(me.members) ? me.members.slice(0,3) : [],
            foeMembers: Array.isArray(foe.members) ? foe.members.slice(0,3) : []
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
        holdMs: 2000,

        meMembers: Array.isArray(me.members) ? me.members.slice(0,3) : [],
        foeMembers: Array.isArray(foe.members) ? foe.members.slice(0,3) : []
      });

      if (!iWon && me.eliminated){
        try{ state.lastMatchResultRows = []; }catch(_){}
        try{ state.currentOverallRows = Array.isArray(state.currentOverallRows) ? state.currentOverallRows : []; }catch(_){}

        resolveFullMatchToEndAfterPlayerEliminated(state);
        try{ fastForwardToMatchEnd(); }catch(_){}

        const championName = getChampionNameSafe(state);

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

        setCenter3('この試合のチャンピオンは', String(go.championName || '???'), '‼︎');
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
      ensureMatchResultRows(state);
      ensureCurrentOverallRows(state);

      state.ui.rightImg = '';
      state.ui.topLeftName = '';
      state.ui.topRightName = '';

      setRequest('showMatchResult', {
        matchIndex: state.matchIndex,
        matchCount: state.matchCount,
        rows: state.lastMatchResultRows,
        currentOverall: Array.isArray(state.currentOverallRows) ? state.currentOverallRows : []
      });

      state.phase = 'match_result_done';
      return;
    }

    // ===== match result done =====
    if (state.phase === 'match_result_done'){

      // LOCAL
      if (state.mode === 'local'){
        setRequest('showTournamentResult', { total: state.tournamentTotal });

        if (state.matchIndex >= state.matchCount){
          state.phase = 'local_total_result_wait_post';
        }else{
          state.phase = 'local_match_total_result_wait_next';
        }
        return;
      }

      // LAST CHANCE
      if (state.mode === 'lastchance'){
        setRequest('showTournamentResult', { total: state.tournamentTotal });

        if (state.matchIndex >= state.matchCount){
          state.phase = 'lastchance_total_result_wait_post';
        }else{
          state.phase = 'lastchance_match_total_result_wait_next';
        }
        return;
      }

      // NATIONAL
      if (state.mode === 'national'){
        const nat = state.national || {};
        const si = Number(nat.sessionIndex||0);
        const sc = Number(nat.sessionCount||6);
        const isLastSession = (si >= sc - 1);

        setRequest('showTournamentResult', { total: state.tournamentTotal });

        if (state.matchIndex < state.matchCount){
          state.phase = 'national_match_total_result_wait_next';
          return;
        }

        if (isLastSession){
          state.phase = 'national_total_result_wait_post';
          return;
        }

        state.phase = 'national_session_total_result_wait_notice';
        return;
      }

      // WORLD
      if (state.mode === 'world'){
        if (worldHandlersReady() && callWorldHandler('handleWorldMatchResultDone', state)){
          return;
        }

        setRequest('showTournamentResult', { total: state.tournamentTotal });
        state.phase = 'done';
        return;
      }

      setRequest('showTournamentResult', { total: state.tournamentTotal });
      state.phase = 'done';
      return;
    }

    setRequest('noop', {});
  }

  // preload world split immediately
  ensureWorldStepReady().catch((e)=>{
    console.error('[tournament_core_step] world split preload failed:', e);
  });

  // register
  T.step = step;

})();
