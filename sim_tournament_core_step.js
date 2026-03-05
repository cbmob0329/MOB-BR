'use strict';

/* =========================================================
   sim_tournament_core_step.js（FULL） v5.4b
   - 2分割：base（sim_tournament_core_step_base.js）を先に読み込む前提
   - v5.4 の全機能維持（Local / LastChance / National / WORLD Qual+Losers+Final は壊さない）
   - ✅ resultの件：showMatchResult に渡す currentOverall を毎回更新（base側の safe helper）
   - ✅ 追加修正: PLAYER の power を「試合開始のたびに」localStorageの値で必ず再注入（55化防止）
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
  // ✅ 追加: PLAYER power を localStorage から再注入（試合で55になるのを防ぐ）
  // - 「部分差し替えできない」前提なので、このファイル内で完結させる
  // =========================================================
  function _readPlayerPowerFromStorage(){
    try{
      // まずは既存で使っているキー（base側でも使っている）
      let v = Number(localStorage.getItem('mobbr_team_power'));
      if (Number.isFinite(v) && v > 0) return v;

      // 予備（環境差吸収）
      v = Number(localStorage.getItem('mobbr_teamPower'));
      if (Number.isFinite(v) && v > 0) return v;

      // それでも無ければ null
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

      // PLAYERだけ確実に上書き（CPUには触らない）
      p.power = v;

      // 念のため teams内のPLAYER参照も合わせる（参照ズレ対策）
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
  // ✅ 追加: MATCH SKIP（外部から呼ぶAPI）
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
    // ✅ v5.4: WORLD FINAL 点灯 notice → NEXTで元の分岐へ戻す
    // =========================================================
    if (state.phase === 'world_final_lit_notice_wait'){
      state.phase = 'match_result_done';
      setRequest('noop', {});
      return;
    }

    // ✅ v5.4: WORLD FINAL 優勝 notice → NEXTで世界一発表(showChampion)
    if (state.phase === 'world_final_winner_notice_wait'){
      const champName = String(state._worldFinalWinnerName || '???');

      state.ui.rightImg = '';
      state.ui.topLeftName = '';
      state.ui.topRightName = '';

      setCenter3('🏆 世界一に輝いたのは', `${champName}‼︎`, 'おめでとう！');
      setRequest('showChampion', {
        matchIndex: state.matchIndex,
        championName: champName,
        worldChampion: true,
        isWorldFinal: true
      });

      state.phase = 'world_final_worldchamp_show';
      return;
    }

    // ✅ v5.4: 世界一発表の次 → 総合RESULTへ
    if (state.phase === 'world_final_worldchamp_show'){
      setRequest('showTournamentResult', { total: state.tournamentTotal });
      state.phase = 'world_total_result_wait_post';
      return;
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

    // ✅ LastChance: 総合RESULTを見せたあと、次のNEXTで終了後処理 → UI閉じる
    if (state.phase === 'lastchance_total_result_wait_post'){
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

    // ✅ World: FINAL後の総合RESULT → 次のNEXTで post へ
    if (state.phase === 'world_total_result_wait_post'){
      try{
        if (P?.onWorldFinalFinished) P.onWorldFinalFinished(state, state.tournamentTotal);
        else if (window.MOBBR?.sim?.tournamentCorePost?.onWorldFinalFinished) window.MOBBR.sim.tournamentCorePost.onWorldFinalFinished(state, state.tournamentTotal);
      }catch(e){
        console.error('[tournament_core] world post error:', e);
      }
      state.phase = 'done';
      setRequest('endTournament', {});
      return;
    }

    // ✅ Losers終了→Final予約表示の次 → 終了
    if (state.phase === 'world_final_reserved_wait_end'){
      state.phase = 'done';
      setRequest('endTournament', {});
      return;
    }

    // ✅ WORLD予選 31〜40位 敗退表示 → 次のNEXTで終了
    if (state.phase === 'world_eliminated_wait_end'){
      state.phase = 'done';
      setRequest('endTournament', {});
      return;
    }

    // ✅ WORLD 予選総合RESULTの次（分岐）
    if (state.phase === 'world_qual_total_result_wait_branch'){
      initWorldMetaIfNeeded(state);

      const ranked = computeRankedIdsFromTotal(state.tournamentTotal);
      const top10 = ranked.slice(0,10);
      const mid20 = ranked.slice(10,30);
      const bot10 = ranked.slice(30,40);

      state.worldMeta.seedTop10 = top10.slice(0,10);
      state.worldMeta.losers20 = mid20.slice(0,20);
      state.worldMeta.eliminated10 = bot10.slice(0,10);

      try{
        if (P?.onWorldQualFinished) P.onWorldQualFinished(state, state.tournamentTotal);
        else if (window.MOBBR?.sim?.tournamentCorePost?.onWorldQualFinished) window.MOBBR.sim.tournamentCorePost.onWorldQualFinished(state, state.tournamentTotal);
      }catch(e){}

      const playerId = 'PLAYER';
      const pr = ranked.indexOf(playerId) + 1;
      const playerRank = pr > 0 ? pr : 999;

      if (playerRank >= 31){
        state.worldPhase = 'eliminated';

        state.ui.rightImg = '';
        state.ui.topLeftName = '';
        state.ui.topRightName = '';

        setCenter3('WORLD 予選 敗退…', `総合順位：${playerRank}位`, '31〜40位は敗退');
        setRequest('showNationalNotice', {
          qualified: false,
          line1: 'WORLD 予選 敗退…',
          line2: `総合順位：${playerRank}位`,
          line3: 'NEXTで終了'
        });

        state.phase = 'world_eliminated_wait_end';
        return;
      }

      // 1-10でも「この週はLosersをAUTO処理してFinal確定」へ
      if (playerRank <= 10){
        state.worldMeta.losersAuto = true;

        state.worldPhase = 'losers';
        swapTeamsToIds(state, state.worldMeta.losers20);
        state.matchCount = 5;

        try{
          for (let i=0; i<5; i++){
            try{ fastForwardToMatchEnd(); }catch(_){}
            try{ finishMatchAndBuildResult(); }catch(_){}
            try{ ensureMatchResultRows(state); }catch(_){}
            try{ ensureCurrentOverallRows(state); }catch(_){}
            if (i < 4){
              try{ startNextMatch(); }catch(_){}
            }
          }
        }catch(_){}

        setRequest('showTournamentResult', { total: state.tournamentTotal });
        state.phase = 'world_losers_total_result_wait_branch';
        return;
      }

      // 11〜30位 → Losersへ（通常進行）
      state.worldMeta.losersAuto = false;
      state.worldPhase = 'losers';
      swapTeamsToIds(state, state.worldMeta.losers20);

      state.matchCount = 5;
      state.phase = 'intro';
      setRequest('noop', {});
      return;
    }

    // ✅ WORLD Losers総合RESULTの次（Final確定→来週予約）
    if (state.phase === 'world_losers_total_result_wait_branch'){
      initWorldMetaIfNeeded(state);

      const ranked = computeRankedIdsFromTotal(state.tournamentTotal);
      const top10 = ranked.slice(0,10);

      const finalIds = [];
      const pushU = (id)=>{
        const s = String(id||'');
        if (!s) return;
        if (finalIds.includes(s)) return;
        finalIds.push(s);
      };
      for (const id of (state.worldMeta.seedTop10||[])) pushU(id);
      for (const id of top10) pushU(id);

      state.worldMeta.finalIds = finalIds.slice(0,20);

      if (showWorldFinalReservedAndGoMain(state, state.worldMeta.finalIds)){
        return;
      }

      state.worldPhase = 'final';
      swapTeamsToIds(state, state.worldMeta.finalIds);
      state.matchCount = 12;
      state.phase = 'intro';
      setRequest('noop', {});
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

      // ✅ v5.2: matchCount 固定（introでだけ上書き）
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
        const s = state.national || {};
        const si = Number(s.sessionIndex||0);
        const sc = Number(s.sessionCount||6);
        const key = String(s.sessions?.[si]?.key || `S${si+1}`);
        setCenter3('ナショナルリーグ開幕！', `SESSION ${key} (${si+1}/${sc})`, '');

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
        const wp = String(state.worldPhase||'qual');
        const s = state.national || {};
        const si = Number(s.sessionIndex||0);
        const sc = Number(s.sessionCount||6);
        const key = String(s.sessions?.[si]?.key || `S${si+1}`);

        if (wp === 'qual'){
          setCenter3('ワールドファイナル予選 開幕！', `SESSION ${key} (${si+1}/${sc})`, '総合順位で決着！');
        }else if (wp === 'losers'){
          setCenter3('LOSERSリーグ 開幕！', '20チーム / 5試合', '上位10がFINALへ！');
        }else if (wp === 'eliminated'){
          setCenter3('WORLD 予選 敗退…', '', '');
        }else{
          ensureWorldFinalMP(state);
          const mp = Number(state.worldFinalMP?.matchPoint||WORLD_FINAL_MATCH_POINT);

          let litLine = '';
          try{
            const litIds = Object.keys(state.worldFinalMP?.litAtMatch || {}).filter(Boolean);
            if (litIds.length){
              litLine = `点灯：${buildLitNamesLine(state, litIds)}`;
            }
          }catch(_){}

          setCenter3('FINAL ROUND 開始！', `${mp}ptで点灯（マッチポイント）`, litLine || '点灯した次の試合以降にチャンピオンで優勝‼︎');
        }

        if (wp === 'qual'){
          if (!_sessionHasPlayer(si)){
            setWorldBanners(state, `AUTO SESSION ${key}`);

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
        }
      }else if (state.mode === 'lastchance'){
        setCenter3('ラストチャンス開幕！', '上位2チームがワールド出場！', '');
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
      setRequest('showTeamList', { teams: state.teams.map(t=>( {
        id:t.id, name:t.name, power:t.power, alive:t.alive, eliminated:t.eliminated, treasure:t.treasure, flag:t.flag, isPlayer:!!t.isPlayer
      }))});
      state.phase = 'teamList_done';
      return;
    }

    // ===== coach select（廃止）→ NEXTで降下へ =====
    if (state.phase === 'teamList_done'){
      setCenter3('それでは試合を開始します！', 'NEXTで降下へ', '');
      setRequest('showIntroText', {});
      state.phase = 'coach_done';
      return;
    }

    // ===== match start =====
    if (state.phase === 'coach_done'){

      // ✅ 追加修正: 試合開始前に必ず PLAYER power をメインの値で注入（55化防止）
      _syncPlayerPower(state);

      initMatchDrop();

      // ✅ 追加修正: initMatchDrop 内で上書きされても、直後にもう一度注入して戻す
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
        if (state.matchIndex >= state.matchCount){
          setRequest('showTournamentResult', { total: state.tournamentTotal });
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

        setCenter3('次の試合へ', `MATCH ${state.matchIndex} / ${state.matchCount}`, '');
        setRequest('nextMatch', { matchIndex: state.matchIndex });
        state.phase = 'coach_done';
        return;
      }

      // LAST CHANCE
      if (state.mode === 'lastchance'){
        if (state.matchIndex >= state.matchCount){
          setRequest('showTournamentResult', { total: state.tournamentTotal });
          state.phase = 'lastchance_total_result_wait_post';
          return;
        }

        startNextMatch();

        state.ui.bg = 'tent.png';
        state.ui.squareBg = 'tent.png';
        state.ui.leftImg = getPlayerSkin();
        state.ui.rightImg = '';
        state.ui.topLeftName = '';
        state.ui.topRightName = '';

        setCenter3('次の試合へ', `MATCH ${state.matchIndex} / ${state.matchCount}`, '');
        setRequest('nextMatch', { matchIndex: state.matchIndex });
        state.phase = 'coach_done';
        return;
      }

      // NATIONAL
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
          setCenter3('次の試合へ', `MATCH ${state.matchIndex} / ${state.matchCount}`, '');
          setRequest('nextMatch', { matchIndex: state.matchIndex });
          state.phase = 'coach_done';
          return;
        }

        const isLastSession = (si >= sc - 1);

        setRequest('showTournamentResult', { total: state.tournamentTotal });

        if (isLastSession){
          state.phase = 'national_total_result_wait_post';
          return;
        }

        state.phase = 'national_session_total_result_wait_notice';
        return;
      }

      // WORLD
      if (state.mode === 'world'){
        const wp = String(state.worldPhase||'qual');

        // FINAL（マッチポイント制）
        if (wp === 'final'){
          ensureWorldFinalMP(state);

          updateWorldFinalLitByTotals(state);

          const newlyLit = getNewlyLitIdsThisMatch(state);
          if (Array.isArray(newlyLit) && newlyLit.length){
            markLitAnnounced(state, newlyLit);

            const lineNames = buildLitNamesLine(state, newlyLit);
            const oneName = resolveTeamNameById(state, newlyLit[0]);

            const line1 = (newlyLit.length === 1)
              ? `${oneName}チームが点灯！`
              : '複数チームが点灯！';

            const line2 = (newlyLit.length === 1)
              ? `${oneName}が80ptに到達！`
              : `点灯：${lineNames}`;

            setRequest('showNationalNotice', {
              qualified: true,
              line1,
              line2,
              line3: 'NEXTで進行'
            });

            state.phase = 'world_final_lit_notice_wait';
            return;
          }

          const winnerId = checkWorldFinalWinnerByRule(state);

          if (winnerId){
            state.worldFinalMP.winnerId = winnerId;

            const wName = resolveTeamNameById(state, winnerId);

            setRequest('showNationalNotice', {
              qualified: true,
              line1: `${wName}チームが`,
              line2: '点灯状態でチャンピオンを獲得！',
              line3: 'NEXTで世界一発表！'
            });

            state._worldFinalWinnerName = wName;
            state.phase = 'world_final_winner_notice_wait';
            return;
          }

          if (state.matchIndex < state.matchCount){
            startNextMatch();

            state.ui.bg = 'tent.png';
            state.ui.squareBg = 'tent.png';
            state.ui.leftImg = getPlayerSkin();
            state.ui.rightImg = '';
            state.ui.topLeftName = '';
            state.ui.topRightName = '';

            setWorldBanners(state, '');

            setCenter3('次の試合へ', `FINAL  MATCH ${state.matchIndex} / ${state.matchCount}`, '');
            setRequest('nextMatch', { matchIndex: state.matchIndex });
            state.phase = 'coach_done';
            return;
          }

          const topId = getOverallTopId(state);
          if (topId){
            state.worldFinalMP.winnerId = topId;
          }

          const topName = resolveTeamNameById(state, state.worldFinalMP.winnerId || topId || '');

          setRequest('showNationalNotice', {
            qualified: true,
            line1: 'WORLD FINAL 終了！',
            line2: `世界一候補：${topName}`,
            line3: 'NEXTで世界一発表！'
          });

          state._worldFinalWinnerName = topName;
          state.phase = 'world_final_winner_notice_wait';
          return;
        }

        // Losers（5試合固定）
        if (wp === 'losers'){
          if (state.matchIndex < state.matchCount){
            startNextMatch();

            state.ui.bg = 'tent.png';
            state.ui.squareBg = 'tent.png';
            state.ui.leftImg = getPlayerSkin();
            state.ui.rightImg = '';
            state.ui.topLeftName = '';
            state.ui.topRightName = '';

            setWorldBanners(state, '');

            setCenter3('次の試合へ', `LOSERS  MATCH ${state.matchIndex} / ${state.matchCount}`, '');
            setRequest('nextMatch', { matchIndex: state.matchIndex });
            state.phase = 'coach_done';
            return;
          }

          setRequest('showTournamentResult', { total: state.tournamentTotal });
          state.phase = 'world_losers_total_result_wait_branch';
          return;
        }

        // qual（セッション進行：matchCount=3）
        if (wp === 'qual'){
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

            setWorldBanners(state, '');

            setCenter3('次の試合へ', `MATCH ${state.matchIndex} / ${state.matchCount}`, '');
            setRequest('nextMatch', { matchIndex: state.matchIndex });
            state.phase = 'coach_done';
            return;
          }

          const isLastSession = (si >= sc - 1);

          setRequest('showTournamentResult', { total: state.tournamentTotal });

          if (isLastSession){
            state.phase = 'world_qual_total_result_wait_branch';
            return;
          }

          state.phase = 'national_session_total_result_wait_notice';
          return;
        }
      }

      setRequest('showTournamentResult', { total: state.tournamentTotal });
      state.phase = 'done';
      return;
    }

    setRequest('noop', {});
  }

  // register
  T.step = step;

})();
