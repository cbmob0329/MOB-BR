'use strict';

/* =========================================================
   sim_tournament_core_step.js（FULL） v5.5
   - 2分割：base（sim_tournament_core_step_base.js）を先に読み込む前提
   - v5.4b の全機能維持（Local / LastChance / National / WORLD Qual+Losers+Final は壊さない）
   - ✅ resultの件：showMatchResult に渡す currentOverall を毎回更新（base側の safe helper）
   - ✅ PLAYER の power を「試合開始のたびに」localStorageの値で必ず再注入（55化防止）
   - ✅ 試合result → NEXT で必ず総合RESULTを1回挟む
   - ✅ 演出/ログ強化
      - ローカル / ナショナル / ラストチャンス / WORLD の到着時文言を強化
      - 各大会の終了後メッセージを順位別に強化
      - WORLD予選 / LOSERS / FINAL の専用通知を追加
      - 点灯通知 / 世界一決定通知を強化
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

  function _getPlayerOverallRank(state){
    const rows = _getOverallRowsSafe(state);
    const idx = rows.findIndex(r => String(r?.id) === 'PLAYER');
    return idx >= 0 ? (idx + 1) : 999;
  }

  function _getPlayerTeamName(state){
    try{
      const p = getPlayer();
      if (p?.name) return String(p.name);
    }catch(_){}

    try{
      const rows = _getOverallRowsSafe(state);
      const row = rows.find(r => String(r?.id) === 'PLAYER');
      if (row?.name) return String(row.name);
    }catch(_){}

    try{
      const n = localStorage.getItem('mobbr_team');
      if (n) return String(n);
    }catch(_){}

    return 'PLAYER TEAM';
  }

  function _getTeamByIdSafe(state, teamId){
    const id = String(teamId || '');
    if (!id) return null;
    try{
      if (Array.isArray(state?.teams)){
        const t = state.teams.find(x => String(x?.id) === id);
        if (t) return t;
      }
    }catch(_){}
    return null;
  }

  function _getMemberNamesByTeamId(state, teamId){
    const t = _getTeamByIdSafe(state, teamId);
    if (t && Array.isArray(t.members) && t.members.length){
      const names = t.members
        .map(m => String(m?.name || '').trim())
        .filter(Boolean)
        .slice(0, 3);
      if (names.length) return names;
    }
    return [];
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

  function _buildWorldQualArrivalLines(state){
    const s = state.national || {};
    const si = Number(s.sessionIndex || 0);
    const sc = Number(s.sessionCount || 6);
    const key = String(s.sessions?.[si]?.key || `S${si+1}`);
    return [
      'ワールドファイナル開幕！',
      'とうとう来たね世界大会。まずは予選リーグ突破を目指して頑張ろう！',
      `予選 SESSION ${key} (${si+1}/${sc})`
    ];
  }

  function _buildWorldLosersArrivalLines(){
    return [
      'LOSERSリーグ開幕！',
      'ここからが本当の崖っぷち。',
      '上位10チームが決勝へ！まだまだ諦めないで！'
    ];
  }

  function _buildWorldFinalArrivalLines(state){
    ensureWorldFinalMP(state);
    const mp = Number(state.worldFinalMP?.matchPoint || WORLD_FINAL_MATCH_POINT);
    return [
      'いよいよワールドファイナル決勝！',
      `${mp}ポイントで点灯し、点灯状態のチャンピオンで優勝！`,
      `試合は最大${Number(state.matchCount || 12)}試合続きます！`
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

  function _buildWorldQualNoticeByRank(rank){
    if (rank >= 1 && rank <= 10){
      return {
        line1: '決勝確定！',
        line2: '世界一が見えて来た！',
        line3: 'この勢いで最後まで行こう！'
      };
    }
    if (rank >= 11 && rank <= 30){
      return {
        line1: 'LOSERSへ！',
        line2: 'まだまだ諦めないで！',
        line3: 'ここから這い上がろう！'
      };
    }
    return {
      line1: `${rank}位で終了！`,
      line2: `世界${rank}位！自信を持って！`,
      line3: ''
    };
  }

  function _buildWorldLosersNoticeByRank(rank){
    if (rank >= 1 && rank <= 10){
      return {
        line1: '決勝へ！',
        line2: 'これが最後の戦いだよ！',
        line3: 'WORLD FINALへ進出！'
      };
    }
    return {
      line1: '惜しくもここで敗退！',
      line2: '世界の壁は厚いね。',
      line3: 'また頑張ろう！'
    };
  }

  function _buildWorldFinalFinishNotice(state){
    const rank = _getPlayerOverallRank(state);

    if (rank === 1){
      return {
        line1: 'やったね！世界一だよ！世界一！',
        line2: '賞金何に使うのかな？',
        line3: 'とにかくおめでとう！世界王者！'
      };
    }
    if (rank >= 2 && rank <= 9){
      return {
        line1: `今回は${rank}位でフィニッシュ！`,
        line2: `世界${rank}位。`,
        line3: 'よく頑張ったね！'
      };
    }
    return {
      line1: `${rank}位で世界大会終了！`,
      line2: '本当にお疲れ様！',
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
      qualified: true,
      line1: a,
      line2: b,
      line3: c
    }, opts || {}));
  }

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
    // ✅ WORLD FINAL 点灯 notice → NEXTで元の分岐へ戻す
    // =========================================================
    if (state.phase === 'world_final_lit_notice_wait'){
      state.phase = 'match_result_done';
      setRequest('noop', {});
      return;
    }

    // ✅ WORLD FINAL 優勝 notice → NEXTで世界一発表(showChampion)
    if (state.phase === 'world_final_winner_notice_wait'){
      const champName = String(state._worldFinalWinnerName || '???');
      const champId = String(state._worldFinalWinnerId || '');
      const members = _getMemberNamesByTeamId(state, champId);
      const memberLine = members.length ? `メンバーは ${members.join('、')}！` : 'おめでとう！';

      state.ui.rightImg = '';
      state.ui.topLeftName = '';
      state.ui.topRightName = '';

      setCenter3('世界王者は', `${champName}！`, memberLine);
      setRequest('showChampion', {
        matchIndex: state.matchIndex,
        championName: champName,
        worldChampion: true,
        isWorldFinal: true,
        log1: `${champName}が点灯状態でチャンピオンを獲得！`,
        log2: 'この瞬間、世界一のチームが決定！',
        log3: memberLine
      });

      state.phase = 'world_final_worldchamp_show';
      return;
    }

    // ✅ 世界一発表の次 → 総合RESULTへ
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

    // =========================================================
    // ✅ Local 終了通知 → post → close
    // =========================================================
    if (state.phase === 'local_total_result_wait_post'){
      _showThreeLineNotice(state, _buildLocalFinishNotice(state), { qualified: _getPlayerOverallRank(state) <= 10 });
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
      _showThreeLineNotice(state, _buildLastChanceFinishNotice(state), { qualified: _getPlayerOverallRank(state) <= 2 });
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
    // ✅ World FINAL 総合RESULT後 → 最終順位通知 → post
    // =========================================================
    if (state.phase === 'world_total_result_wait_post'){
      _showThreeLineNotice(state, _buildWorldFinalFinishNotice(state), { qualified: _getPlayerOverallRank(state) === 1 });
      state.phase = 'world_final_finish_notice_wait_end';
      return;
    }

    if (state.phase === 'world_final_finish_notice_wait_end'){
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

    // ✅ LOCAL: 各試合の総合RESULT表示後 → 次試合 or 大会終了
    if (state.phase === 'local_match_total_result_wait_next'){
      if (state.matchIndex >= state.matchCount){
        state.phase = 'local_total_result_wait_post';
        setRequest('noop', {});
        return;
      }

      startNextMatch();

      state.ui.bg = 'tent.png';
      state.ui.squareBg = 'tent.png';
      state.ui.leftImg = getPlayerSkin();
      state.ui.rightImg = '';
      state.ui.topLeftName = '';
      state.ui.topRightName = '';

      setCenter3('次の試合へ', `MATCH ${state.matchIndex} / ${state.matchCount}`, '1戦1戦大事にしよう！');
      setRequest('nextMatch', { matchIndex: state.matchIndex });
      state.phase = 'coach_done';
      return;
    }

    // ✅ LASTCHANCE: 各試合の総合RESULT表示後 → 次試合 or 大会終了
    if (state.phase === 'lastchance_match_total_result_wait_next'){
      if (state.matchIndex >= state.matchCount){
        state.phase = 'lastchance_total_result_wait_post';
        setRequest('noop', {});
        return;
      }

      startNextMatch();

      state.ui.bg = 'tent.png';
      state.ui.squareBg = 'tent.png';
      state.ui.leftImg = getPlayerSkin();
      state.ui.rightImg = '';
      state.ui.topLeftName = '';
      state.ui.topRightName = '';

      setCenter3('次の試合へ', `MATCH ${state.matchIndex} / ${state.matchCount}`, '全部出し切るぞ！');
      setRequest('nextMatch', { matchIndex: state.matchIndex });
      state.phase = 'coach_done';
      return;
    }

    // ✅ NATIONAL: 各試合の総合RESULT表示後 → 次試合 or セッション分岐
    if (state.phase === 'national_match_total_result_wait_next'){
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
        setCenter3('次の試合へ', `MATCH ${state.matchIndex} / ${state.matchCount}`, '全国の猛者と決戦だ！');
        setRequest('nextMatch', { matchIndex: state.matchIndex });
        state.phase = 'coach_done';
        return;
      }

      const isLastSession = (si >= sc - 1);

      if (isLastSession){
        state.phase = 'national_total_result_wait_post';
        setRequest('noop', {});
        return;
      }

      state.phase = 'national_session_total_result_wait_notice';
      setRequest('noop', {});
      return;
    }

    // ✅ NATIONAL 最終終了通知 → post
    if (state.phase === 'national_total_result_wait_post'){
      _showThreeLineNotice(state, _buildNationalFinishNotice(state), { qualified: _getPlayerOverallRank(state) <= 8 });
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

    // ✅ WORLD FINAL: 各試合の総合RESULT表示後 → 点灯/優勝判定/次試合
    if (state.phase === 'world_final_match_total_result_wait_next'){
      ensureWorldFinalMP(state);

      updateWorldFinalLitByTotals(state);

      const newlyLit = getNewlyLitIdsThisMatch(state);
      if (Array.isArray(newlyLit) && newlyLit.length){
        markLitAnnounced(state, newlyLit);

        const lineNames = buildLitNamesLine(state, newlyLit);
        const oneName = resolveTeamNameById(state, newlyLit[0]);

        const line1 = (newlyLit.length === 1)
          ? `${oneName}が点灯！`
          : '複数チームが点灯！';

        const line2 = (newlyLit.length === 1)
          ? `${oneName}が80ptに到達！`
          : `点灯：${lineNames}`;

        const line3 = '点灯した次の試合以降にチャンピオンで優勝！';

        _showThreeLineNotice(state, { line1, line2, line3 }, { qualified: true });
        state.phase = 'world_final_lit_notice_wait';
        return;
      }

      const winnerId = checkWorldFinalWinnerByRule(state);

      if (winnerId){
        state.worldFinalMP.winnerId = winnerId;

        const wName = resolveTeamNameById(state, winnerId);
        const members = _getMemberNamesByTeamId(state, winnerId);

        state._worldFinalWinnerName = wName;
        state._worldFinalWinnerId = winnerId;

        _showThreeLineNotice(state, {
          line1: `${wName}が点灯状態でチャンピオンを獲得！`,
          line2: 'この瞬間、世界一のチームが決定！',
          line3: members.length ? `メンバーは ${members.join('、')}！` : 'NEXTで世界一発表！'
        }, { qualified: true });

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

        setCenter3('次の試合へ', `FINAL  MATCH ${state.matchIndex} / ${state.matchCount}`, '世界王者を決める戦いは続く！');
        setRequest('nextMatch', { matchIndex: state.matchIndex });
        state.phase = 'coach_done';
        return;
      }

      const topId = getOverallTopId(state);
      if (topId){
        state.worldFinalMP.winnerId = topId;
      }

      const topName = resolveTeamNameById(state, state.worldFinalMP.winnerId || topId || '');
      state._worldFinalWinnerName = topName;
      state._worldFinalWinnerId = String(state.worldFinalMP.winnerId || topId || '');

      _showThreeLineNotice(state, {
        line1: 'WORLD FINAL 終了！',
        line2: `世界一候補：${topName}`,
        line3: 'NEXTで世界一発表！'
      }, { qualified: true });

      state.phase = 'world_final_winner_notice_wait';
      return;
    }

    // ✅ WORLD LOSERS: 各試合の総合RESULT表示後 → 次試合 or Losers終了分岐
    if (state.phase === 'world_losers_match_total_result_wait_next'){
      if (state.matchIndex < state.matchCount){
        startNextMatch();

        state.ui.bg = 'tent.png';
        state.ui.squareBg = 'tent.png';
        state.ui.leftImg = getPlayerSkin();
        state.ui.rightImg = '';
        state.ui.topLeftName = '';
        state.ui.topRightName = '';

        setWorldBanners(state, '');

        setCenter3('次の試合へ', `LOSERS  MATCH ${state.matchIndex} / ${state.matchCount}`, 'まだまだ諦めないで！');
        setRequest('nextMatch', { matchIndex: state.matchIndex });
        state.phase = 'coach_done';
        return;
      }

      state.phase = 'world_losers_total_result_wait_branch';
      setRequest('noop', {});
      return;
    }

    // ✅ WORLD QUAL: 各試合の総合RESULT表示後 → 次試合 or WORLD予選分岐
    if (state.phase === 'world_qual_match_total_result_wait_next'){
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

        setCenter3('次の試合へ', `MATCH ${state.matchIndex} / ${state.matchCount}`, 'まずは予選突破を目指そう！');
        setRequest('nextMatch', { matchIndex: state.matchIndex });
        state.phase = 'coach_done';
        return;
      }

      const isLastSession = (si >= sc - 1);

      if (isLastSession){
        state.phase = 'world_qual_total_result_wait_branch';
        setRequest('noop', {});
        return;
      }

      state.phase = 'national_session_total_result_wait_notice';
      setRequest('noop', {});
      return;
    }

    // ✅ WORLD 予選総合RESULTの次（分岐前に順位通知）
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

      state._worldQualPlayerRank = playerRank;

      if (playerRank >= 31){
        state.worldPhase = 'eliminated';

        _showThreeLineNotice(state, _buildWorldQualNoticeByRank(playerRank), { qualified: false });

        state.phase = 'world_eliminated_wait_end';
        return;
      }

      if (playerRank <= 10){
        _showThreeLineNotice(state, _buildWorldQualNoticeByRank(playerRank), { qualified: true });
        state.phase = 'world_qual_top10_notice_wait_branch';
        return;
      }

      _showThreeLineNotice(state, _buildWorldQualNoticeByRank(playerRank), { qualified: false });
      state.phase = 'world_qual_losers_notice_wait_branch';
      return;
    }

    // ✅ WORLD予選 1〜10位通知後 → losersをAUTO処理してFinal確定へ
    if (state.phase === 'world_qual_top10_notice_wait_branch'){
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

    // ✅ WORLD予選 11〜30位通知後 → Losersへ（通常進行）
    if (state.phase === 'world_qual_losers_notice_wait_branch'){
      state.worldMeta.losersAuto = false;
      state.worldPhase = 'losers';
      swapTeamsToIds(state, state.worldMeta.losers20);

      state.matchCount = 5;
      state.phase = 'intro';
      setRequest('noop', {});
      return;
    }

    // ✅ WORLD Losers総合RESULTの次（Final確定前に通知）
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

      const playerRank = ranked.indexOf('PLAYER') + 1;
      state._worldLosersPlayerRank = playerRank > 0 ? playerRank : 999;

      _showThreeLineNotice(state, _buildWorldLosersNoticeByRank(state._worldLosersPlayerRank), {
        qualified: state._worldLosersPlayerRank >= 1 && state._worldLosersPlayerRank <= 10
      });
      state.phase = 'world_losers_finish_notice_wait_branch';
      return;
    }

    if (state.phase === 'world_losers_finish_notice_wait_branch'){
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
        const sc = Number(s.sessionCount||6);
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
        const wp = String(state.worldPhase||'qual');
        const s = state.national || {};
        const si = Number(s.sessionIndex||0);
        const sc = Number(s.sessionCount||6);
        const key = String(s.sessions?.[si]?.key || `S${si+1}`);

        if (wp === 'qual'){
          const lines = _buildWorldQualArrivalLines(state);
          setCenter3(lines[0], lines[1], lines[2]);
        }else if (wp === 'losers'){
          const lines = _buildWorldLosersArrivalLines();
          setCenter3(lines[0], lines[1], lines[2]);
        }else if (wp === 'eliminated'){
          setCenter3('WORLD 予選 敗退…', '', '');
        }else{
          const lines = _buildWorldFinalArrivalLines(state);
          setCenter3(lines[0], lines[1], lines[2]);
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
      }else if (String(state.worldPhase||'qual') === 'qual'){
        setCenter3('それでは試合を開始します！', '上位10が決勝確定、11〜30位はLOSERSへ！', '');
      }else if (String(state.worldPhase||'losers') === 'losers'){
        setCenter3('それでは試合を開始します！', '上位10チームがFINALへ！', '');
      }else{
        setCenter3('それでは試合を開始します！', '点灯状態のチャンピオンで世界一！', '');
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
        setCenter3(`${info.name}に到着！`, 'いよいよ今シーズンのローカル大会が開幕！', '10位までに入ればナショナル大会へ！');
      }else if (state.mode === 'national'){
        setCenter3(`${info.name}に到着！`, 'ナショナル大会が開幕！', '上位8チームがワールドファイナルへ！');
      }else if (state.mode === 'lastchance'){
        setCenter3(`${info.name}に到着！`, 'ラストチャンスが開幕！', '1位か2位でワールドファイナルへ進出！');
      }else if (String(state.worldPhase||'qual') === 'qual'){
        setCenter3(`${info.name}に到着！`, 'ワールドファイナル予選が始まる！', contested ? '被った…敵影がいる！' : 'まずは予選突破を目指そう！');
      }else if (String(state.worldPhase||'losers') === 'losers'){
        setCenter3(`${info.name}に到着！`, 'LOSERSリーグ開始！', contested ? '被った…敵影がいる！' : 'ここから這い上がろう！');
      }else{
        setCenter3(`${info.name}に到着！`, 'FINAL ROUND 開始！', contested ? '被った…敵影がいる！' : '世界王者を決める戦いだ！');
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
        const wp = String(state.worldPhase||'qual');

        if (wp === 'final'){
          setRequest('showTournamentResult', { total: state.tournamentTotal });
          state.phase = 'world_final_match_total_result_wait_next';
          return;
        }

        if (wp === 'losers'){
          setRequest('showTournamentResult', { total: state.tournamentTotal });

          if (state.matchIndex < state.matchCount){
            state.phase = 'world_losers_match_total_result_wait_next';
          }else{
            state.phase = 'world_losers_total_result_wait_branch';
          }
          return;
        }

        if (wp === 'qual'){
          const nat = state.national || {};
          const si = Number(nat.sessionIndex||0);
          const sc = Number(nat.sessionCount||6);
          const isLastSession = (si >= sc - 1);

          setRequest('showTournamentResult', { total: state.tournamentTotal });

          if (state.matchIndex < state.matchCount){
            state.phase = 'world_qual_match_total_result_wait_next';
            return;
          }

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
